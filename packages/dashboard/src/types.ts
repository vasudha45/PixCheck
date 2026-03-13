// Client-safe types (no Node.js Buffer references)

export type DesignSource = 'figma' | 'zeplin';
export type Platform = 'web' | 'android' | 'ios';
export type SeverityLevel = 'critical' | 'major' | 'minor' | 'info';
export type ScreenStatus = 'pass' | 'fail' | 'warning' | 'running' | 'pending';
export type AIIssueCategory =
  | 'color' | 'typography' | 'spacing' | 'layout'
  | 'missing_element' | 'extra_element' | 'wrong_copy'
  | 'wrong_icon' | 'alignment' | 'sizing'
  | 'border_radius' | 'shadow' | 'other';

export interface BoundingBox {
  x: number; y: number; width: number; height: number;
  label: string; severity: SeverityLevel; source: 'pixel' | 'ai';
}

export interface AIIssue {
  id: string;
  severity: SeverityLevel;
  category: AIIssueCategory;
  description: string;
  suggestedFix?: string;
  confidence: number;
  boundingBox?: BoundingBox;
  affectedElement?: string;
}

export interface PixelDiffSummary {
  mismatchPixels: number;
  mismatchPercent: number;
  ssimScore: number;
  totalPixels: number;
}

export interface AIAnalysisSummary {
  issues: AIIssue[];
  overallAssessment: string;
  positives: string[];
  confidenceScore: number;
}

export interface ScreenResult {
  screenName: string;
  platform: Platform;
  designSource: DesignSource;
  status: ScreenStatus;
  accuracyScore: number;
  pixelDiff: PixelDiffSummary;
  aiAnalysis: AIAnalysisSummary;
  boundingBoxes: BoundingBox[];
  durationMs: number;
  // Image URLs (served by API)
  images?: {
    design: string;
    screenshot: string;
    annotated: string;
    diff: string;
  };
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

export interface RunReport {
  reportId: string;
  storyId: string;
  generatedAt: string;
  durationMs: number;
  summary: ReportSummary;
  screens: ScreenResult[];
}

export interface RunConfig {
  storyId: string;
  screens: ScreenConfigUI[];
  thresholds?: {
    pixelMismatchPercent: number;
    aiConfidenceMin: number;
    overallScoreMin: number;
  };
}

export interface ScreenConfigUI {
  name: string;
  designSource: DesignSource;
  figmaFileId?: string;
  figmaNodeId?: string;
  zeplinProjectId?: string;
  zeplinScreenId?: string;
  platform: Platform;
  url?: string;
  selector?: string;
  deviceName?: string;
  viewport?: { width: number; height: number };
}

export type RunStatus = 'idle' | 'running' | 'done' | 'error';

export interface LiveProgress {
  type: 'screen_start' | 'screen_done' | 'step' | 'complete' | 'error';
  screenName?: string;
  step?: string;
  current?: number;
  total?: number;
  result?: ScreenResult;
  report?: RunReport;
  error?: string;
}
