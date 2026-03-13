import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, ExternalLink, ChevronLeft, Eye, Cpu, GitCompare, CheckCircle } from 'lucide-react';
import {
  PageHeader, Button, Card, StatCard, StatusBadge, SeverityBadge,
  PlatformBadge, ScoreRing, TabBar, MetricPill, EmptyState
} from '../components/ui';
import { ScreenResult, AIIssue, SeverityLevel } from '../types';

// ── Mock report data ──────────────────────────────────────────
const MOCK_REPORT = {
  reportId: 'rpt_001',
  storyId: 'STORY-421',
  generatedAt: '2024-01-15T10:32:00Z',
  durationMs: 47200,
  summary: {
    totalScreens: 3,
    passed: 2,
    warned: 1,
    failed: 0,
    overallAccuracyScore: 88,
    criticalIssues: 0,
    majorIssues: 2,
    minorIssues: 5,
  },
  screens: [
    {
      screenName: 'Home Screen',
      platform: 'web' as const,
      designSource: 'figma' as const,
      status: 'pass' as const,
      accuracyScore: 94,
      durationMs: 14200,
      pixelDiff: { mismatchPixels: 4820, mismatchPercent: 2.1, ssimScore: 0.97, totalPixels: 229376 },
      aiAnalysis: {
        overallAssessment: 'The implementation closely matches the Figma design. The layout, spacing, and primary color palette are accurately reproduced. A few minor typography and spacing discrepancies were detected.',
        positives: ['Primary navigation matches design exactly', 'Hero section colors and gradients are accurate', 'Button states match the design system', 'Responsive grid layout is correct'],
        confidenceScore: 0.92,
        issues: [
          { id: 'i1', severity: 'minor' as SeverityLevel, category: 'typography', description: 'Body text font-size appears to be 15px instead of 16px as specified in the design.', suggestedFix: 'Update body font-size to 16px in your global CSS.', confidence: 0.85, affectedElement: 'Body text', boundingBox: { x: 40, y: 320, width: 600, height: 120, label: 'Body text size', severity: 'minor' as SeverityLevel, source: 'ai' as const } },
          { id: 'i2', severity: 'minor' as SeverityLevel, category: 'spacing', description: 'Section padding-top is 40px but design specifies 48px.', suggestedFix: 'Change section padding-top from 40px to 48px.', confidence: 0.78, affectedElement: 'Section container' },
          { id: 'i3', severity: 'info' as SeverityLevel, category: 'color', description: 'Hover state color on nav links is #4f46e5 vs #4338ca in design — very close.', confidence: 0.65, affectedElement: 'Nav links' },
        ],
      },
      boundingBoxes: [],
      images: { design: '', screenshot: '', annotated: '', diff: '' },
    },
    {
      screenName: 'Product Card',
      platform: 'web' as const,
      designSource: 'figma' as const,
      status: 'warning' as const,
      accuracyScore: 78,
      durationMs: 18600,
      pixelDiff: { mismatchPixels: 18240, mismatchPercent: 7.9, ssimScore: 0.88, totalPixels: 230400 },
      aiAnalysis: {
        overallAssessment: 'The product card has several notable differences from the Figma design. The price badge color is incorrect, the image border-radius does not match, and there are alignment issues with the CTA button.',
        positives: ['Card shadow and elevation match design', 'Product title typography is correct', 'Tag/badge layout is accurate'],
        confidenceScore: 0.88,
        issues: [
          { id: 'i4', severity: 'major' as SeverityLevel, category: 'color', description: 'Price badge background is #22c55e but design specifies #16a34a. The green is noticeably lighter.', suggestedFix: 'Change price badge background from green-500 to green-600 (#16a34a).', confidence: 0.93, affectedElement: 'Price badge', boundingBox: { x: 220, y: 180, width: 80, height: 28, label: 'Price badge color', severity: 'major' as SeverityLevel, source: 'ai' as const } },
          { id: 'i5', severity: 'major' as SeverityLevel, category: 'border_radius', description: 'Product image border-radius is 8px but design shows 12px.', suggestedFix: 'Update product image border-radius from 8px to 12px.', confidence: 0.89, affectedElement: 'Product image', boundingBox: { x: 20, y: 60, width: 320, height: 200, label: 'Image border radius', severity: 'major' as SeverityLevel, source: 'ai' as const } },
          { id: 'i6', severity: 'minor' as SeverityLevel, category: 'alignment', description: 'CTA button is not centered — appears 4px off to the right.', confidence: 0.72, affectedElement: 'CTA button' },
          { id: 'i7', severity: 'minor' as SeverityLevel, category: 'spacing', description: 'Gap between product title and description is 6px vs 8px in design.', confidence: 0.81, affectedElement: 'Card content' },
          { id: 'i8', severity: 'info' as SeverityLevel, category: 'typography', description: 'Description line-height appears slightly tighter than design.', confidence: 0.61, affectedElement: 'Product description' },
        ],
      },
      boundingBoxes: [],
      images: { design: '', screenshot: '', annotated: '', diff: '' },
    },
    {
      screenName: 'Mobile Nav',
      platform: 'ios' as const,
      designSource: 'zeplin' as const,
      status: 'pass' as const,
      accuracyScore: 91,
      durationMs: 14400,
      pixelDiff: { mismatchPixels: 6840, mismatchPercent: 3.1, ssimScore: 0.95, totalPixels: 220416 },
      aiAnalysis: {
        overallAssessment: 'The iOS navigation bar implementation is very close to the Zeplin design. Icons, labels, and safe area handling are all correctly implemented.',
        positives: ['Tab bar icons match design exactly', 'Safe area insets handled correctly', 'Active state indicator color matches', 'Font sizes on labels are correct'],
        confidenceScore: 0.90,
        issues: [
          { id: 'i9', severity: 'minor' as SeverityLevel, category: 'color', description: 'Tab bar background blur appears slightly less intense than Zeplin specification.', confidence: 0.68, affectedElement: 'Tab bar background' },
          { id: 'i10', severity: 'info' as SeverityLevel, category: 'sizing', description: 'Tab icon touch target area is 42×42pt vs 44×44pt in design.', suggestedFix: 'Increase tab icon touch target to minimum 44×44pt for accessibility compliance.', confidence: 0.74, affectedElement: 'Tab bar icons' },
        ],
      },
      boundingBoxes: [],
      images: { design: '', screenshot: '', annotated: '', diff: '' },
    },
  ] as ScreenResult[],
};

// ── Page ──────────────────────────────────────────────────────

export default function ReportPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const report = MOCK_REPORT; // In production: fetch from /api/reports/:reportId
  const { summary, screens } = report;

  return (
    <div>
      <PageHeader
        title={`Report — ${report.storyId}`}
        subtitle={`${screens.length} screens · Generated ${new Date(report.generatedAt).toLocaleString()} · ${(report.durationMs / 1000).toFixed(1)}s`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ChevronLeft size={14} /> Back
            </Button>
            <Button variant="ghost">
              <Download size={14} /> Export PDF
            </Button>
          </div>
        }
      />

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'center' }}>
          <ScoreRing score={summary.overallAccuracyScore} size={100} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
            <StatCard label="Screens" value={summary.totalScreens} />
            <StatCard label="Passed" value={summary.passed} color="var(--pass)" />
            <StatCard label="Warned" value={summary.warned} color="var(--warn)" />
            <StatCard label="Failed" value={summary.failed} color={summary.failed > 0 ? 'var(--fail)' : 'var(--text3)'} />
            <StatCard label="Critical" value={summary.criticalIssues} color={summary.criticalIssues > 0 ? 'var(--critical)' : 'var(--text3)'} />
            <StatCard label="Major" value={summary.majorIssues} color={summary.majorIssues > 0 ? 'var(--major)' : 'var(--text3)'} />
          </div>
        </div>

        {/* Screen cards */}
        {screens.map(screen => (
          <ScreenCard key={screen.screenName} screen={screen} />
        ))}
      </div>
    </div>
  );
}

// ── Screen Card ───────────────────────────────────────────────

function ScreenCard({ screen }: { screen: ScreenResult }) {
  const [activeTab, setActiveTab] = useState('compare');
  const allIssues = screen.aiAnalysis.issues;
  const criticals = allIssues.filter(i => i.severity === 'critical');
  const majors = allIssues.filter(i => i.severity === 'major');
  const minors = allIssues.filter(i => i.severity === 'minor').concat(allIssues.filter(i => i.severity === 'info'));

  const tabs = [
    { id: 'compare', label: 'Comparison', },
    { id: 'issues', label: 'Issues', count: allIssues.length },
    { id: 'diff', label: 'Pixel Diff' },
    { id: 'ai', label: 'AI Analysis' },
  ];

  return (
    <Card>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <StatusBadge status={screen.status} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{screen.screenName}</span>
        <PlatformBadge platform={screen.platform} />
        <span style={{ fontSize: 11, background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
          {screen.designSource}
        </span>
        <ScoreRing score={screen.accuracyScore} size={52} />
      </div>

      {/* Tabs */}
      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Content */}
      <div style={{ padding: '20px' }}>

        {activeTab === 'compare' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              <MetricPill
                label="Pixel Mismatch"
                value={screen.pixelDiff.mismatchPercent.toFixed(1)}
                unit="%"
                color={screen.pixelDiff.mismatchPercent < 5 ? 'var(--pass)' : screen.pixelDiff.mismatchPercent < 10 ? 'var(--warn)' : 'var(--fail)'}
              />
              <MetricPill
                label="SSIM Score"
                value={(screen.pixelDiff.ssimScore * 100).toFixed(1)}
                unit="%"
                color={screen.pixelDiff.ssimScore > 0.93 ? 'var(--pass)' : screen.pixelDiff.ssimScore > 0.80 ? 'var(--warn)' : 'var(--fail)'}
              />
              <MetricPill label="AI Issues" value={allIssues.length} color={allIssues.length === 0 ? 'var(--pass)' : 'var(--text)'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ImagePanel label="Design (Figma/Zeplin)" src={screen.images?.design} placeholder="design" />
              <ImagePanel label="Implementation — annotated" src={screen.images?.annotated} placeholder="annotated" accent />
            </div>
          </>
        )}

        {activeTab === 'issues' && (
          <div>
            {allIssues.length === 0 ? (
              <EmptyState icon={<CheckCircle color="var(--pass)" size={36} />} title="No issues detected" description="Both images match within acceptable thresholds." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...criticals, ...majors, ...minors].map(issue => (
                  <IssueRow key={issue.id} issue={issue} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'diff' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              <MetricPill label="Mismatched Pixels" value={screen.pixelDiff.mismatchPixels.toLocaleString()} />
              <MetricPill label="Total Pixels" value={screen.pixelDiff.totalPixels.toLocaleString()} />
              <MetricPill label="Pixel Diff %" value={screen.pixelDiff.mismatchPercent.toFixed(2)} unit="%" color={screen.pixelDiff.mismatchPercent < 5 ? 'var(--pass)' : 'var(--warn)'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <ImagePanel label="Design" src={screen.images?.design} placeholder="design" />
              <ImagePanel label="Pixel Diff (red = mismatch)" src={screen.images?.diff} placeholder="diff" accent />
              <ImagePanel label="Screenshot" src={screen.images?.screenshot} placeholder="screenshot" />
            </div>
          </>
        )}

        {activeTab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: 'var(--purple-dim)', border: '1px solid rgba(167,139,250,0.2)',
              borderRadius: 'var(--radius-sm)', padding: '14px 16px',
              fontSize: 13.5, lineHeight: 1.7, color: 'var(--text2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                <Cpu size={12} /> Claude AI Assessment
              </div>
              {screen.aiAnalysis.overallAssessment}
            </div>

            {screen.aiAnalysis.positives.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pass)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>✓ Correctly Implemented</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {screen.aiAnalysis.positives.map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 8, alignItems: 'flex-start',
                      background: 'var(--pass-dim)', border: '1px solid rgba(52,211,153,0.15)',
                      borderRadius: 'var(--radius-sm)', padding: '7px 10px',
                      fontSize: 12.5, color: 'var(--text2)',
                    }}>
                      <span style={{ color: 'var(--pass)', flexShrink: 0, marginTop: 1 }}>✓</span>
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 11.5, color: 'var(--text3)', fontFamily: 'var(--mono)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px' }}>
              AI confidence: {Math.round(screen.aiAnalysis.confidenceScore * 100)}% · Model: claude-opus-4-5
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Image Panel ───────────────────────────────────────────────

function ImagePanel({ label, src, placeholder, accent }: { label: string; src?: string; placeholder: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
      <div style={{
        background: 'var(--surface2)', border: `1px solid ${accent ? 'rgba(167,139,250,0.2)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)', overflow: 'hidden', minHeight: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {src ? (
          <img src={src} alt={label} style={{ width: '100%', display: 'block' }} />
        ) : (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>
            <Eye size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div style={{ fontSize: 12 }}>Image preview</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Loaded from report assets/{placeholder}.png</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Issue Row ─────────────────────────────────────────────────

function IssueRow({ issue }: { issue: AIIssue }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${issue.severity === 'critical' ? 'var(--critical)' : issue.severity === 'major' ? 'var(--major)' : issue.severity === 'minor' ? 'var(--minor)' : 'var(--info-clr)'}`,
      borderRadius: 'var(--radius-sm)', overflow: 'hidden',
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer' }}
      >
        <SeverityBadge severity={issue.severity} />
        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', background: 'var(--surface3)', padding: '1px 6px', borderRadius: 4 }}>{issue.category}</span>
        {issue.affectedElement && (
          <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{issue.affectedElement}</span>
        )}
        <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {issue.description}
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--text3)', flexShrink: 0 }}>{Math.round(issue.confidence * 100)}%</span>
      </div>
      {open && issue.suggestedFix && (
        <div style={{ padding: '0 12px 10px', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>SUGGESTED FIX</div>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6 }}>{issue.suggestedFix}</div>
        </div>
      )}
    </div>
  );
}
