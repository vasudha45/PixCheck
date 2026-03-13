import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search, Filter } from 'lucide-react';
import { PageHeader, Card, StatusBadge, ScoreRing, ProgressBar } from '../components/ui';

const ALL_RUNS = [
  { reportId: 'rpt_001', storyId: 'STORY-421', generatedAt: '2024-01-15T10:32:00Z', durationMs: 47200, summary: { totalScreens: 6, passed: 5, warned: 1, failed: 0, overallAccuracyScore: 91, criticalIssues: 0, majorIssues: 1, minorIssues: 3 } },
  { reportId: 'rpt_002', storyId: 'STORY-389', generatedAt: '2024-01-14T16:04:00Z', durationMs: 82400, summary: { totalScreens: 10, passed: 7, warned: 1, failed: 2, overallAccuracyScore: 74, criticalIssues: 2, majorIssues: 4, minorIssues: 6 } },
  { reportId: 'rpt_003', storyId: 'STORY-402', generatedAt: '2024-01-13T09:18:00Z', durationMs: 38100, summary: { totalScreens: 4, passed: 4, warned: 0, failed: 0, overallAccuracyScore: 96, criticalIssues: 0, majorIssues: 0, minorIssues: 2 } },
  { reportId: 'rpt_004', storyId: 'STORY-375', generatedAt: '2024-01-12T14:22:00Z', durationMs: 61700, summary: { totalScreens: 8, passed: 5, warned: 2, failed: 1, overallAccuracyScore: 81, criticalIssues: 1, majorIssues: 3, minorIssues: 5 } },
  { reportId: 'rpt_005', storyId: 'STORY-360', generatedAt: '2024-01-11T11:45:00Z', durationMs: 29800, summary: { totalScreens: 3, passed: 3, warned: 0, failed: 0, overallAccuracyScore: 98, criticalIssues: 0, majorIssues: 0, minorIssues: 1 } },
];

export default function HistoryPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = ALL_RUNS.filter(r => {
    const matchSearch = r.storyId.toLowerCase().includes(search.toLowerCase());
    const status = r.summary.failed > 0 ? 'fail' : r.summary.warned > 0 ? 'warning' : 'pass';
    const matchFilter = filter === 'all' || status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div>
      <PageHeader title="Run History" subtitle="All previous visual regression checks" />

      <div style={{ padding: '20px 32px', display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by story ID…"
            style={{
              width: '100%', paddingLeft: 30, padding: '8px 12px 8px 30px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13, outline: 'none',
            }}
          />
        </div>
        {['all', 'pass', 'warning', 'fail'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '7px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500,
              fontFamily: 'inherit', cursor: 'pointer', border: '1px solid',
              background: filter === f ? 'var(--purple-dim)' : 'var(--surface)',
              borderColor: filter === f ? 'rgba(167,139,250,0.3)' : 'var(--border)',
              color: filter === f ? 'var(--purple)' : 'var(--text3)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 32px 32px' }}>
        <Card>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>No runs match your filter.</div>
          ) : filtered.map((run, i) => {
            const s = run.summary;
            const status = s.failed > 0 ? 'fail' : s.warned > 0 ? 'warning' : 'pass';
            return (
              <div
                key={run.reportId}
                onClick={() => navigate(`/report/${run.reportId}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer', transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <ScoreRing score={s.overallAccuracyScore} size={52} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{run.storyId}</span>
                    <StatusBadge status={status} />
                    <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>
                      {(run.durationMs / 1000).toFixed(0)}s · {s.totalScreens} screens
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', display: 'flex', gap: 12, marginBottom: 6 }}>
                    <span style={{ color: 'var(--pass)' }}>{s.passed} passed</span>
                    {s.failed > 0 && <span style={{ color: 'var(--fail)' }}>{s.failed} failed</span>}
                    {s.warned > 0 && <span style={{ color: 'var(--warn)' }}>{s.warned} warned</span>}
                    {s.criticalIssues > 0 && <span style={{ color: 'var(--critical)' }}>🔴 {s.criticalIssues} critical</span>}
                    {s.majorIssues > 0 && <span style={{ color: 'var(--major)' }}>⚠ {s.majorIssues} major</span>}
                  </div>
                  <ProgressBar
                    value={s.overallAccuracyScore}
                    color={s.overallAccuracyScore >= 85 ? 'var(--pass)' : s.overallAccuracyScore >= 65 ? 'var(--warn)' : 'var(--fail)'}
                    height={3}
                  />
                </div>
                <div style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--text3)' }}>
                  <div>{new Date(run.generatedAt).toLocaleDateString()}</div>
                  <div>{new Date(run.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <ArrowRight size={14} color="var(--text3)" />
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
