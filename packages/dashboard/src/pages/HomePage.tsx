import { useNavigate } from 'react-router-dom';
import { Play, TrendingUp, CheckCircle, XCircle, AlertTriangle, Layers, ArrowRight } from 'lucide-react';
import { PageHeader, StatCard, Button, Card, StatusBadge, ScoreRing, ProgressBar } from '../components/ui';

// Mock recent runs — in production, fetched from /api/history
const RECENT_RUNS = [
  {
    reportId: 'rpt_001', storyId: 'STORY-421', generatedAt: '2024-01-15T10:32:00Z',
    summary: { totalScreens: 6, passed: 5, warned: 1, failed: 0, overallAccuracyScore: 91, criticalIssues: 0, majorIssues: 1, minorIssues: 3 },
  },
  {
    reportId: 'rpt_002', storyId: 'STORY-389', generatedAt: '2024-01-14T16:04:00Z',
    summary: { totalScreens: 10, passed: 7, warned: 1, failed: 2, overallAccuracyScore: 74, criticalIssues: 2, majorIssues: 4, minorIssues: 6 },
  },
  {
    reportId: 'rpt_003', storyId: 'STORY-402', generatedAt: '2024-01-13T09:18:00Z',
    summary: { totalScreens: 4, passed: 4, warned: 0, failed: 0, overallAccuracyScore: 96, criticalIssues: 0, majorIssues: 0, minorIssues: 2 },
  },
];

const TREND_DATA = [72, 78, 74, 81, 88, 91, 96, 91];

export default function HomePage() {
  const navigate = useNavigate();

  const avgScore = Math.round(RECENT_RUNS.reduce((s, r) => s + r.summary.overallAccuracyScore, 0) / RECENT_RUNS.length);
  const totalScreens = RECENT_RUNS.reduce((s, r) => s + r.summary.totalScreens, 0);
  const totalFailed = RECENT_RUNS.reduce((s, r) => s + r.summary.failed, 0);
  const totalPassed = RECENT_RUNS.reduce((s, r) => s + r.summary.passed, 0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Visual regression overview across all recent runs"
        actions={
          <Button variant="primary" onClick={() => navigate('/run')}>
            <Play size={14} /> New Run
          </Button>
        }
      />

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatCard label="Avg Accuracy" value={`${avgScore}%`} color={avgScore >= 85 ? 'var(--pass)' : 'var(--warn)'} />
          <StatCard label="Screens Tested" value={totalScreens} color="var(--blue)" />
          <StatCard label="Passed" value={totalPassed} color="var(--pass)" />
          <StatCard label="Failed" value={totalFailed} color={totalFailed > 0 ? 'var(--fail)' : 'var(--text3)'} />
        </div>

        {/* Trend + Quick start */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

          {/* Trend chart */}
          <Card>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={15} color="var(--purple)" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Accuracy trend</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>last 8 runs</span>
            </div>
            <div style={{ padding: '20px', height: 160, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              {TREND_DATA.map((val, i) => {
                const color = val >= 85 ? 'var(--pass)' : val >= 70 ? 'var(--warn)' : 'var(--fail)';
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{val}</span>
                    <div style={{
                      width: '100%', height: `${(val / 100) * 100}px`,
                      background: color, borderRadius: '4px 4px 2px 2px', opacity: 0.85,
                      transition: 'height 0.5s ease',
                    }} />
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Quick start card */}
          <Card>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={15} color="var(--purple)" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Quick start</span>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Configure screens', desc: 'Add Figma/Zeplin IDs and URLs', done: true },
                { label: 'Set credentials', desc: 'API tokens in settings', done: true },
                { label: 'Run first check', desc: 'Compare design vs implementation', done: false },
                { label: 'Review report', desc: 'Annotated diffs + AI analysis', done: false },
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                    background: step.done ? 'var(--pass-dim)' : 'var(--surface3)',
                    border: `1px solid ${step.done ? 'rgba(52,211,153,0.3)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: step.done ? 'var(--pass)' : 'var(--text3)', fontWeight: 700,
                  }}>
                    {step.done ? '✓' : i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: step.done ? 'var(--text2)' : 'var(--text)' }}>{step.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{step.desc}</div>
                  </div>
                </div>
              ))}
              <Button variant="primary" style={{ marginTop: 4, width: '100%', justifyContent: 'center' }} onClick={() => navigate('/run')}>
                <Play size={13} /> Start a run <ArrowRight size={12} />
              </Button>
            </div>
          </Card>
        </div>

        {/* Recent runs */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Recent runs</span>
            <button onClick={() => navigate('/history')} style={{
              background: 'none', border: 'none', color: 'var(--purple)',
              fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              View all <ArrowRight size={12} />
            </button>
          </div>

          <Card>
            {RECENT_RUNS.map((run, i) => {
              const s = run.summary;
              const status = s.failed > 0 ? 'fail' : s.warned > 0 ? 'warning' : 'pass';
              return (
                <div
                  key={run.reportId}
                  onClick={() => navigate(`/report/${run.reportId}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
                    borderBottom: i < RECENT_RUNS.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <ScoreRing score={s.overallAccuracyScore} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{run.storyId}</span>
                      <StatusBadge status={status} />
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', display: 'flex', gap: 12 }}>
                      <span>{s.totalScreens} screens</span>
                      <span style={{ color: 'var(--pass)' }}>{s.passed} passed</span>
                      {s.failed > 0 && <span style={{ color: 'var(--fail)' }}>{s.failed} failed</span>}
                      {s.criticalIssues > 0 && <span style={{ color: 'var(--critical)' }}>{s.criticalIssues} critical issues</span>}
                    </div>
                    <ProgressBar
                      value={s.overallAccuracyScore}
                      color={s.overallAccuracyScore >= 85 ? 'var(--pass)' : s.overallAccuracyScore >= 65 ? 'var(--warn)' : 'var(--fail)'}
                      height={3}
                    />
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {new Date(run.generatedAt).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {new Date(run.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <ArrowRight size={14} color="var(--text3)" />
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </div>
  );
}
