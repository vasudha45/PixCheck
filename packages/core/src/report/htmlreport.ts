import * as fs from 'fs';
import * as path from 'path';
import { PixelCheckReport, ScreenResult, SeverityLevel } from '../types';

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  critical: '#ef4444',
  major: '#f97316',
  minor: '#eab308',
  info: '#3b82f6',
};

const STATUS_COLORS = {
  pass: '#22c55e',
  fail: '#ef4444',
  warning: '#f59e0b',
};

export async function generateHTMLReport(
  report: PixelCheckReport,
  outputDir: string,
  imageBuffers: Map<string, { design: Buffer; screenshot: Buffer; annotated: Buffer; diff: Buffer }>
): Promise<string> {
  fs.mkdirSync(outputDir, { recursive: true });
  const assetsDir = path.join(outputDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  // Write images to disk
  for (const [screenName, buffers] of imageBuffers.entries()) {
    const slug = slugify(screenName);
    fs.writeFileSync(path.join(assetsDir, `${slug}_design.png`), buffers.design);
    fs.writeFileSync(path.join(assetsDir, `${slug}_screenshot.png`), buffers.screenshot);
    fs.writeFileSync(path.join(assetsDir, `${slug}_annotated.png`), buffers.annotated);
    fs.writeFileSync(path.join(assetsDir, `${slug}_diff.png`), buffers.diff);
  }

  const html = buildHTML(report, imageBuffers);
  const reportPath = path.join(outputDir, 'report.html');
  fs.writeFileSync(reportPath, html, 'utf-8');

  // Also write JSON
  const jsonPath = path.join(outputDir, 'report.json');
  const jsonReport = {
    ...report,
    screens: report.screens.map(s => ({
      ...s,
      designAsset: { ...s.designAsset, imageBuffer: undefined },
      screenshot: { ...s.screenshot, imageBuffer: undefined },
      pixelDiff: { ...s.pixelDiff, diffImageBuffer: undefined },
      annotatedImageBuffer: undefined,
    })),
  };
  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf-8');

  return reportPath;
}

function buildHTML(
  report: PixelCheckReport,
  imageBuffers: Map<string, { design: Buffer; screenshot: Buffer; annotated: Buffer; diff: Buffer }>
): string {
  const { summary, screens } = report;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PixelCheck Report — ${report.storyId}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f0f13;
    --surface: #1a1a24;
    --surface2: #22222f;
    --border: #2e2e3e;
    --text: #e8e8f0;
    --text-muted: #888899;
    --pass: #22c55e;
    --fail: #ef4444;
    --warn: #f59e0b;
    --critical: #ef4444;
    --major: #f97316;
    --minor: #eab308;
    --info: #3b82f6;
    --purple: #a78bfa;
    --radius: 10px;
    --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  }
  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    min-height: 100vh;
  }
  /* Header */
  .header {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    border-bottom: 1px solid var(--border);
    padding: 2rem 2.5rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
  }
  .header-left h1 {
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    background: linear-gradient(90deg, #a78bfa, #60a5fa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .header-left .subtitle {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-top: 4px;
    font-family: var(--mono);
  }
  .header-meta {
    text-align: right;
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.8;
  }
  /* Summary cards */
  .summary {
    padding: 1.5rem 2.5rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
  }
  .stat-card {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem 1.25rem;
    text-align: center;
  }
  .stat-card .value {
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .stat-card .label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 4px;
  }
  .score-ring {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    padding: 1.5rem 2.5rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .ring-chart {
    position: relative;
    width: 100px;
    height: 100px;
    flex-shrink: 0;
  }
  .ring-chart svg { transform: rotate(-90deg); }
  .ring-chart .ring-value {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 700;
  }
  /* Screen section */
  .screens { padding: 2rem 2.5rem; display: flex; flex-direction: column; gap: 2.5rem; }
  .screen-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) + 4px);
    overflow: hidden;
  }
  .screen-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border);
    gap: 1rem;
    flex-wrap: wrap;
  }
  .screen-title {
    font-size: 1.05rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    border-radius: 99px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .badge-pass { background: rgba(34,197,94,0.15); color: var(--pass); border: 1px solid rgba(34,197,94,0.3); }
  .badge-fail { background: rgba(239,68,68,0.15); color: var(--fail); border: 1px solid rgba(239,68,68,0.3); }
  .badge-warning { background: rgba(245,158,11,0.15); color: var(--warn); border: 1px solid rgba(245,158,11,0.3); }
  .badge-platform { background: rgba(167,139,250,0.12); color: var(--purple); border: 1px solid rgba(167,139,250,0.25); }
  .badge-source { background: rgba(96,165,250,0.1); color: #60a5fa; border: 1px solid rgba(96,165,250,0.2); }
  .screen-score {
    font-size: 1.4rem;
    font-weight: 700;
    letter-spacing: -0.04em;
    min-width: 60px;
    text-align: right;
  }
  /* Tabs */
  .screen-tabs {
    display: flex;
    gap: 0;
    padding: 0 1.5rem;
    background: var(--surface2);
    border-bottom: 1px solid var(--border);
  }
  .tab-btn {
    padding: 0.7rem 1.1rem;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
    font-family: var(--font);
  }
  .tab-btn.active { color: var(--text); border-bottom-color: var(--purple); }
  .tab-btn:hover:not(.active) { color: var(--text); }
  /* Tab content */
  .tab-content { display: none; padding: 1.5rem; }
  .tab-content.active { display: block; }
  /* Image comparison */
  .image-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .image-grid.three { grid-template-columns: 1fr 1fr 1fr; }
  .img-wrapper { position: relative; }
  .img-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 6px;
  }
  .img-wrapper img {
    width: 100%;
    border-radius: 6px;
    border: 1px solid var(--border);
    display: block;
  }
  /* Metrics bar */
  .metrics-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .metric { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1rem; }
  .metric .m-label { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
  .metric .m-value { font-size: 1.2rem; font-weight: 700; margin-top: 2px; font-family: var(--mono); }
  /* Issues */
  .issue {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-left: 3px solid;
    border-radius: 8px;
    padding: 0.9rem 1rem;
    margin-bottom: 0.6rem;
  }
  .issue-critical { border-left-color: var(--critical); }
  .issue-major { border-left-color: var(--major); }
  .issue-minor { border-left-color: var(--minor); }
  .issue-info { border-left-color: var(--info); }
  .issue-header { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 4px; }
  .issue-severity {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 1px 7px;
    border-radius: 99px;
  }
  .issue-cat {
    font-size: 0.72rem;
    color: var(--text-muted);
    font-family: var(--mono);
    background: var(--surface);
    padding: 1px 7px;
    border-radius: 4px;
  }
  .issue-src {
    font-size: 0.65rem;
    color: var(--text-muted);
    margin-left: auto;
  }
  .issue-desc { font-size: 0.875rem; color: var(--text); }
  .issue-fix { font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; }
  .issue-fix strong { color: #60a5fa; }
  .positives { list-style: none; display: flex; flex-direction: column; gap: 4px; }
  .positive-item {
    display: flex; align-items: flex-start; gap: 8px;
    font-size: 0.875rem; color: var(--text);
    background: rgba(34,197,94,0.05);
    border: 1px solid rgba(34,197,94,0.15);
    border-radius: 6px;
    padding: 6px 10px;
  }
  .positive-item::before { content: "✓"; color: var(--pass); font-weight: 700; flex-shrink: 0; }
  /* Assessment */
  .assessment {
    background: rgba(167,139,250,0.07);
    border: 1px solid rgba(167,139,250,0.2);
    border-radius: 8px;
    padding: 1rem;
    font-size: 0.875rem;
    line-height: 1.7;
    color: var(--text);
    margin-bottom: 1rem;
  }
  /* Progress bar */
  .progress-bar {
    height: 6px;
    background: var(--surface2);
    border-radius: 99px;
    overflow: hidden;
    margin-top: 8px;
  }
  .progress-fill { height: 100%; border-radius: 99px; transition: width 0.3s; }
  footer {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
    font-size: 0.8rem;
    border-top: 1px solid var(--border);
  }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="header-left">
    <h1>⬡ PixelCheck Report</h1>
    <div class="subtitle">Story: ${report.storyId} · Report ID: ${report.reportId}</div>
  </div>
  <div class="header-meta">
    <div>Generated: ${new Date(report.generatedAt).toLocaleString()}</div>
    <div>Duration: ${(report.durationMs / 1000).toFixed(1)}s</div>
    <div>Screens: ${summary.totalScreens}</div>
  </div>
</div>

<!-- Summary bar -->
<div class="summary">
  <div class="stat-card">
    <div class="value" style="color: ${getScoreColor(summary.overallAccuracyScore)}">${summary.overallAccuracyScore}</div>
    <div class="label">Overall Score</div>
    <div class="progress-bar" style="margin-top: 8px">
      <div class="progress-fill" style="width: ${summary.overallAccuracyScore}%; background: ${getScoreColor(summary.overallAccuracyScore)}"></div>
    </div>
  </div>
  <div class="stat-card">
    <div class="value" style="color: var(--pass)">${summary.passed}</div>
    <div class="label">Passed</div>
  </div>
  <div class="stat-card">
    <div class="value" style="color: var(--warn)">${summary.warned}</div>
    <div class="label">Warnings</div>
  </div>
  <div class="stat-card">
    <div class="value" style="color: var(--fail)">${summary.failed}</div>
    <div class="label">Failed</div>
  </div>
  <div class="stat-card">
    <div class="value" style="color: var(--critical)">${summary.criticalIssues}</div>
    <div class="label">Critical Issues</div>
  </div>
  <div class="stat-card">
    <div class="value" style="color: var(--major)">${summary.majorIssues}</div>
    <div class="label">Major Issues</div>
  </div>
  <div class="stat-card">
    <div class="value" style="color: var(--minor)">${summary.minorIssues}</div>
    <div class="label">Minor Issues</div>
  </div>
</div>

<!-- Screen Results -->
<div class="screens">
${screens.map((screen, si) => buildScreenHTML(screen, si, imageBuffers)).join('\n')}
</div>

<footer>
  PixelCheck Visual Regression Suite · Generated ${new Date(report.generatedAt).toISOString()}
</footer>

<script>
function switchTab(screenIdx, tabName) {
  const card = document.querySelectorAll('.screen-card')[screenIdx];
  card.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
  card.querySelectorAll('.tab-content').forEach(tc => tc.classList.toggle('active', tc.dataset.tab === tabName));
}
</script>
</body>
</html>`;
}

function buildScreenHTML(
  screen: ScreenResult,
  idx: number,
  imageBuffers: Map<string, { design: Buffer; screenshot: Buffer; annotated: Buffer; diff: Buffer }>
): string {
  const slug = slugify(screen.screenName);
  const statusClass = `badge-${screen.status}`;
  const scoreColor = getScoreColor(screen.accuracyScore);

  const criticalIssues = screen.aiAnalysis.issues.filter(i => i.severity === 'critical');
  const majorIssues = screen.aiAnalysis.issues.filter(i => i.severity === 'major');
  const minorIssues = screen.aiAnalysis.issues.filter(i => i.severity === 'minor');
  const infoIssues = screen.aiAnalysis.issues.filter(i => i.severity === 'info');

  const allIssues = [...criticalIssues, ...majorIssues, ...minorIssues, ...infoIssues];

  return `
<div class="screen-card">
  <div class="screen-header">
    <div class="screen-title">
      <span class="badge ${statusClass}">${screen.status.toUpperCase()}</span>
      ${screen.screenName}
      <span class="badge badge-platform">${screen.platform}</span>
      <span class="badge badge-source">${screen.designSource}</span>
    </div>
    <div class="screen-score" style="color: ${scoreColor}">${screen.accuracyScore}/100</div>
  </div>

  <div class="screen-tabs">
    <button class="tab-btn active" data-tab="compare" onclick="switchTab(${idx}, 'compare')">Comparison</button>
    <button class="tab-btn" data-tab="issues" onclick="switchTab(${idx}, 'issues')">Issues (${allIssues.length})</button>
    <button class="tab-btn" data-tab="diff" onclick="switchTab(${idx}, 'diff')">Pixel Diff</button>
    <button class="tab-btn" data-tab="ai" onclick="switchTab(${idx}, 'ai')">AI Analysis</button>
  </div>

  <div class="tab-content active" data-tab="compare">
    <div class="metrics-row">
      <div class="metric">
        <div class="m-label">Pixel Mismatch</div>
        <div class="m-value" style="color: ${screen.pixelDiff.mismatchPercent > 10 ? 'var(--fail)' : screen.pixelDiff.mismatchPercent > 3 ? 'var(--warn)' : 'var(--pass)'}">
          ${screen.pixelDiff.mismatchPercent.toFixed(2)}%
        </div>
      </div>
      <div class="metric">
        <div class="m-label">SSIM Score</div>
        <div class="m-value" style="color: ${screen.pixelDiff.ssimScore > 0.9 ? 'var(--pass)' : screen.pixelDiff.ssimScore > 0.75 ? 'var(--warn)' : 'var(--fail)'}">
          ${(screen.pixelDiff.ssimScore * 100).toFixed(1)}%
        </div>
      </div>
      <div class="metric">
        <div class="m-label">AI Issues Found</div>
        <div class="m-value">${allIssues.length}</div>
      </div>
    </div>
    <div class="image-grid">
      <div class="img-wrapper">
        <div class="img-label">Design (${screen.designSource})</div>
        <img src="assets/${slug}_design.png" alt="Design" loading="lazy" />
      </div>
      <div class="img-wrapper">
        <div class="img-label">Implementation (annotated)</div>
        <img src="assets/${slug}_annotated.png" alt="Annotated screenshot" loading="lazy" />
      </div>
    </div>
  </div>

  <div class="tab-content" data-tab="issues">
    ${allIssues.length === 0
      ? '<p style="color: var(--pass); text-align: center; padding: 2rem;">✓ No issues detected</p>'
      : allIssues.map(issue => buildIssueHTML(issue)).join('\n')
    }
  </div>

  <div class="tab-content" data-tab="diff">
    <div class="metrics-row">
      <div class="metric">
        <div class="m-label">Mismatched Pixels</div>
        <div class="m-value">${screen.pixelDiff.mismatchPixels.toLocaleString()}</div>
      </div>
      <div class="metric">
        <div class="m-label">Total Pixels</div>
        <div class="m-value">${screen.pixelDiff.totalPixels.toLocaleString()}</div>
      </div>
      <div class="metric">
        <div class="m-label">Diff Regions</div>
        <div class="m-value">${screen.boundingBoxes.filter(b => b.source === 'pixel').length}</div>
      </div>
    </div>
    <div class="image-grid three">
      <div class="img-wrapper">
        <div class="img-label">Design</div>
        <img src="assets/${slug}_design.png" alt="Design" loading="lazy" />
      </div>
      <div class="img-wrapper">
        <div class="img-label">Pixel Diff</div>
        <img src="assets/${slug}_diff.png" alt="Diff" loading="lazy" />
      </div>
      <div class="img-wrapper">
        <div class="img-label">Screenshot</div>
        <img src="assets/${slug}_screenshot.png" alt="Screenshot" loading="lazy" />
      </div>
    </div>
  </div>

  <div class="tab-content" data-tab="ai">
    <div class="assessment">${screen.aiAnalysis.overallAssessment}</div>
    ${screen.aiAnalysis.positives.length > 0 ? `
    <p style="font-size: 0.8rem; font-weight: 600; color: var(--pass); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.08em;">✓ Correctly Implemented</p>
    <ul class="positives" style="margin-bottom: 1.5rem">
      ${screen.aiAnalysis.positives.map(p => `<li class="positive-item">${p}</li>`).join('')}
    </ul>` : ''}
  </div>
</div>`;
}

function buildIssueHTML(issue: { severity: SeverityLevel; category: string; description: string; suggestedFix?: string; affectedElement?: string; confidence: number }): string {
  const color = SEVERITY_COLORS[issue.severity];
  return `
<div class="issue issue-${issue.severity}">
  <div class="issue-header">
    <span class="issue-severity" style="background: ${color}22; color: ${color}; border: 1px solid ${color}44">${issue.severity}</span>
    <span class="issue-cat">${issue.category}</span>
    ${issue.affectedElement ? `<span style="font-size:0.78rem; color: var(--text-muted)">${issue.affectedElement}</span>` : ''}
    <span class="issue-src">confidence: ${Math.round(issue.confidence * 100)}%</span>
  </div>
  <div class="issue-desc">${issue.description}</div>
  ${issue.suggestedFix ? `<div class="issue-fix"><strong>Fix:</strong> ${issue.suggestedFix}</div>` : ''}
</div>`;
}

function getScoreColor(score: number): string {
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#f59e0b';
  return '#ef4444';
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
