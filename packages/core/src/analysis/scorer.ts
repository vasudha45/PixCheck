import { PixelDiffResult, AIAnalysisResult, SeverityLevel } from '../types';

const SEVERITY_PENALTY: Record<SeverityLevel, number> = {
  critical: 15,
  major: 8,
  minor: 3,
  info: 0.5,
};

/**
 * Compute overall accuracy score (0–100) combining pixel diff and AI analysis.
 *
 * Weighting:
 *   40% SSIM score
 *   30% Pixel mismatch penalty
 *   30% AI issue penalties
 */
export function computeAccuracyScore(
  pixelDiff: PixelDiffResult,
  aiAnalysis: AIAnalysisResult
): number {
  // 1. SSIM component (0–100)
  const ssimScore = Math.max(0, Math.min(100, pixelDiff.ssimScore * 100));

  // 2. Pixel mismatch component
  // 0% mismatch = 100 points, 20%+ mismatch = 0 points
  const pixelScore = Math.max(0, 100 - (pixelDiff.mismatchPercent / 20) * 100);

  // 3. AI issue penalties
  let aiPenalty = 0;
  for (const issue of aiAnalysis.issues) {
    const weight = issue.confidence ?? 1;
    aiPenalty += SEVERITY_PENALTY[issue.severity] * weight;
  }
  // Cap AI penalty at 100
  aiPenalty = Math.min(100, aiPenalty);
  const aiScore = Math.max(0, 100 - aiPenalty);

  // Weighted average
  const finalScore = ssimScore * 0.4 + pixelScore * 0.3 + aiScore * 0.3;

  return Math.round(Math.max(0, Math.min(100, finalScore)));
}

export function getStatus(
  score: number,
  mismatchPercent: number,
  criticalIssues: number
): 'pass' | 'fail' | 'warning' {
  if (criticalIssues > 0 || score < 60 || mismatchPercent > 20) return 'fail';
  if (score < 80 || mismatchPercent > 8) return 'warning';
  return 'pass';
}
