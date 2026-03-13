import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  PixelCheckConfig,
  PixelCheckReport,
  ScreenResult,
  ScreenConfig,
  Credentials,
  BoundingBox,
  ReportSummary,
} from './types';
import { fetchFigmaScreen } from './adapters/design/figma';
import { fetchZeplinScreen } from './adapters/design/zeplin';
import { captureScreen } from './adapters/capture/screenshot';
import { normalizeImages } from './analysis/normalizer';
import { runPixelDiff, extractMismatchRegions } from './analysis/pixeldiff';
import { runAIAnalysis } from './analysis/aianalysis';
import { annotateScreenshot } from './analysis/annotator';
import { computeAccuracyScore, getStatus } from './analysis/scorer';
import { generateHTMLReport } from './report/htmlreport';
import sharp from 'sharp';

export interface RunOptions {
  config: PixelCheckConfig;
  credentials: Credentials;
  onProgress?: (event: ProgressEvent) => void;
}

export interface ProgressEvent {
  type: 'screen_start' | 'screen_done' | 'step';
  screenName?: string;
  step?: string;
  current?: number;
  total?: number;
  result?: ScreenResult;
}

export async function runPixelCheck(options: RunOptions): Promise<PixelCheckReport> {
  const { config, credentials, onProgress } = options;
  const startTime = Date.now();
  const reportId = uuidv4();

  const screenResults: ScreenResult[] = [];
  const imageBuffers = new Map<string, { design: Buffer; screenshot: Buffer; annotated: Buffer; diff: Buffer }>();

  for (let i = 0; i < config.screens.length; i++) {
    const screenConfig = config.screens[i];
    const screenStart = Date.now();

    emit(onProgress, { type: 'screen_start', screenName: screenConfig.name, current: i + 1, total: config.screens.length });

    try {
      const result = await processScreen(screenConfig, credentials, imageBuffers, onProgress);
      result.durationMs = Date.now() - screenStart;
      screenResults.push(result);
      emit(onProgress, { type: 'screen_done', screenName: screenConfig.name, result });
    } catch (err) {
      console.error(`[PixelCheck] Failed to process screen "${screenConfig.name}":`, err);
      // Push a failed placeholder
      screenResults.push(makeFailed(screenConfig, String(err)));
    }
  }

  const summary = computeSummary(screenResults);
  const outputDir = config.output?.dir ?? './pixelcheck-reports';

  // Generate report
  emit(onProgress, { type: 'step', step: 'Generating HTML report…' });
  const reportPath = await generateHTMLReport({ reportId, storyId: config.storyId, generatedAt: new Date(), durationMs: Date.now() - startTime, summary, screens: screenResults, config }, outputDir, imageBuffers);

  const report: PixelCheckReport = {
    reportId,
    storyId: config.storyId,
    generatedAt: new Date(),
    durationMs: Date.now() - startTime,
    summary,
    screens: screenResults,
    config,
  };

  return report;
}

async function processScreen(
  screenConfig: ScreenConfig,
  creds: Credentials,
  imageBuffers: Map<string, { design: Buffer; screenshot: Buffer; annotated: Buffer; diff: Buffer }>,
  onProgress?: (e: ProgressEvent) => void
): Promise<ScreenResult> {

  // 1. Fetch design asset
  emit(onProgress, { type: 'step', step: 'Fetching design asset…', screenName: screenConfig.name });
  const designAsset = screenConfig.designSource === 'figma'
    ? await fetchFigmaScreen(screenConfig, creds.figmaToken!)
    : await fetchZeplinScreen(screenConfig, creds.zeplinToken!);

  // 2. Capture screenshot
  emit(onProgress, { type: 'step', step: 'Capturing screenshot…', screenName: screenConfig.name });
  const screenshot = await captureScreen(screenConfig);

  // 3. Normalize images
  emit(onProgress, { type: 'step', step: 'Normalizing images…', screenName: screenConfig.name });
  const pair = await normalizeImages(designAsset, screenshot);

  // Convert raw buffers back to PNG for AI
  const designPng = await sharp(pair.designBuffer, { raw: { width: pair.width, height: pair.height, channels: 4 } }).png().toBuffer();
  const screenshotPng = await sharp(pair.screenshotBuffer, { raw: { width: pair.width, height: pair.height, channels: 4 } }).png().toBuffer();

  // 4. Pixel diff
  emit(onProgress, { type: 'step', step: 'Running pixel diff…', screenName: screenConfig.name });
  const pixelDiff = await runPixelDiff(pair);
  const pixelBoxes = await extractMismatchRegions(pixelDiff.diffImageBuffer, pair.width, pair.height);

  // 5. AI analysis
  emit(onProgress, { type: 'step', step: 'Running AI visual analysis…', screenName: screenConfig.name });
  const aiAnalysis = await runAIAnalysis(designPng, screenshotPng, screenConfig.name, screenConfig.platform, pair.width, pair.height);

  // 6. Merge bounding boxes
  const aiBoxes: BoundingBox[] = aiAnalysis.issues
    .filter(i => i.boundingBox)
    .map(i => i.boundingBox!);

  const allBoxes: BoundingBox[] = [...pixelBoxes, ...aiBoxes];

  // 7. Annotate screenshot
  emit(onProgress, { type: 'step', step: 'Annotating screenshot…', screenName: screenConfig.name });
  const annotatedImageBuffer = await annotateScreenshot(screenshotPng, allBoxes);

  // 8. Score
  const accuracyScore = computeAccuracyScore(pixelDiff, aiAnalysis);
  const criticalCount = aiAnalysis.issues.filter(i => i.severity === 'critical').length + pixelBoxes.filter(b => b.severity === 'critical').length;
  const status = getStatus(accuracyScore, pixelDiff.mismatchPercent, criticalCount);

  // Store image buffers for report
  imageBuffers.set(screenConfig.name, {
    design: designPng,
    screenshot: screenshotPng,
    annotated: annotatedImageBuffer,
    diff: pixelDiff.diffImageBuffer,
  });

  return {
    screenName: screenConfig.name,
    platform: screenConfig.platform,
    designSource: screenConfig.designSource,
    status,
    accuracyScore,
    designAsset,
    screenshot,
    pixelDiff,
    aiAnalysis,
    boundingBoxes: allBoxes,
    annotatedImageBuffer,
    durationMs: 0,
  };
}

function computeSummary(screens: ScreenResult[]): ReportSummary {
  const passed = screens.filter(s => s.status === 'pass').length;
  const failed = screens.filter(s => s.status === 'fail').length;
  const warned = screens.filter(s => s.status === 'warning').length;
  const overallAccuracyScore = screens.length > 0
    ? Math.round(screens.reduce((sum, s) => sum + s.accuracyScore, 0) / screens.length)
    : 0;

  let criticalIssues = 0, majorIssues = 0, minorIssues = 0;
  for (const s of screens) {
    for (const issue of s.aiAnalysis.issues) {
      if (issue.severity === 'critical') criticalIssues++;
      else if (issue.severity === 'major') majorIssues++;
      else if (issue.severity === 'minor') minorIssues++;
    }
  }

  return { totalScreens: screens.length, passed, failed, warned, overallAccuracyScore, criticalIssues, majorIssues, minorIssues };
}

function makeFailed(config: ScreenConfig, error: string): ScreenResult {
  const emptyBuffer = Buffer.alloc(0);
  return {
    screenName: config.name,
    platform: config.platform,
    designSource: config.designSource,
    status: 'fail',
    accuracyScore: 0,
    designAsset: { screenName: config.name, source: config.designSource, imageBuffer: emptyBuffer, width: 0, height: 0, metadata: { error } },
    screenshot: { screenName: config.name, platform: config.platform, imageBuffer: emptyBuffer, width: 0, height: 0, capturedAt: new Date() },
    pixelDiff: { mismatchPixels: 0, mismatchPercent: 100, ssimScore: 0, diffImageBuffer: emptyBuffer, totalPixels: 0 },
    aiAnalysis: { issues: [{ id: 'error', severity: 'critical', category: 'other', description: error, confidence: 1 }], overallAssessment: `Screen processing failed: ${error}`, positives: [], confidenceScore: 0 },
    boundingBoxes: [],
    annotatedImageBuffer: emptyBuffer,
    durationMs: 0,
  };
}

function emit(fn: ((e: ProgressEvent) => void) | undefined, event: ProgressEvent): void {
  fn?.(event);
}
