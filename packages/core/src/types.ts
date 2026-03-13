// ============================================================
// PixelCheck Core — Shared Types
// ============================================================

export type DesignSource = 'figma' | 'zeplin';
export type Platform = 'web' | 'android' | 'ios';
export type SeverityLevel = 'critical' | 'major' | 'minor' | 'info';

// ── Input Config ─────────────────────────────────────────────

export interface PixelCheckConfig {
  storyId: string;
  screens: ScreenConfig[];
  output?: OutputConfig;
  thresholds?: Thresholds;
}

export interface ScreenConfig {
  name: string;
  // Design source
  designSource: DesignSource;
  figmaNodeId?: string;          // e.g. "123:456"
  figmaFileId?: string;          // Figma file key from URL
  zeplinScreenId?: string;       // Zeplin screen/component ID
  zeplinProjectId?: string;
  // Implementation source
  platform: Platform;
  url?: string;                  // Web: http://localhost:3000/page
  selector?: string;             // Optional CSS selector to capture specific element
  deviceName?: string;           // Mobile: "iPhone 14", "Pixel 7"
  // Viewport
  viewport?: { width: number; height: number };
}

export interface OutputConfig {
  dir: string;                   // Where to write reports
  formats: ('html' | 'json' | 'pdf')[];
  openOnComplete?: boolean;
}

export interface Thresholds {
  pixelMismatchPercent: number;  // Fail if pixel diff exceeds this (default: 5)
  aiConfidenceMin: number;       // Minimum AI confidence to include issue (default: 0.6)
  overallScoreMin: number;       // Fail if overall accuracy below this (default: 80)
}

// ── Fetched Assets ────────────────────────────────────────────

export interface DesignAsset {
  screenName: string;
  source: DesignSource;
  imageBuffer: Buffer;
  width: number;
  height: number;
  metadata: Record<string, unknown>;
}

export interface CapturedScreenshot {
  screenName: string;
  platform: Platform;
  imageBuffer: Buffer;
  width: number;
  height: number;
  capturedAt: Date;
}

// ── Analysis Results ──────────────────────────────────────────

export interface PixelDiffResult {
  mismatchPixels: number;
  mismatchPercent: number;
  ssimScore: number;             // 0–1, higher is better
  diffImageBuffer: Buffer;       // PNG with highlighted diffs
  totalPixels: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  severity: SeverityLevel;
  source: 'pixel' | 'ai';
}

export interface AIIssue {
  id: string;
  severity: SeverityLevel;
  category: AIIssueCategory;
  description: string;
  suggestedFix?: string;
  confidence: number;            // 0–1
  boundingBox?: BoundingBox;
  affectedElement?: string;
}

export type AIIssueCategory =
  | 'color'
  | 'typography'
  | 'spacing'
  | 'layout'
  | 'missing_element'
  | 'extra_element'
  | 'wrong_copy'
  | 'wrong_icon'
  | 'alignment'
  | 'sizing'
  | 'border_radius'
  | 'shadow'
  | 'other';

export interface AIAnalysisResult {
  issues: AIIssue[];
  overallAssessment: string;
  positives: string[];
  confidenceScore: number;
}

// ── Screen Result ─────────────────────────────────────────────

export interface ScreenResult {
  screenName: string;
  platform: Platform;
  designSource: DesignSource;
  status: 'pass' | 'fail' | 'warning';
  accuracyScore: number;         // 0–100

  designAsset: DesignAsset;
  screenshot: CapturedScreenshot;

  pixelDiff: PixelDiffResult;
  aiAnalysis: AIAnalysisResult;

  boundingBoxes: BoundingBox[];  // Merged from both engines
  annotatedImageBuffer: Buffer;  // Screenshot with bounding boxes drawn

  durationMs: number;
}

// ── Final Report ──────────────────────────────────────────────

export interface PixelCheckReport {
  reportId: string;
  storyId: string;
  generatedAt: Date;
  durationMs: number;

  summary: ReportSummary;
  screens: ScreenResult[];
  config: PixelCheckConfig;
}

export interface ReportSummary {
  totalScreens: number;
  passed: number;
  failed: number;
  warned: number;
  overallAccuracyScore: number;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
}

// ── API Credentials ───────────────────────────────────────────

export interface Credentials {
  figmaToken?: string;
  zeplinToken?: string;
  anthropicApiKey?: string;
}
