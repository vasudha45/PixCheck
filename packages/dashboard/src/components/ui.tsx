import { SeverityLevel, ScreenStatus } from '../types';

// ── Score Ring ────────────────────────────────────────────────

export function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 85 ? 'var(--pass)' : score >= 65 ? 'var(--warn)' : 'var(--fail)';

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface3)" strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={5}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: size < 60 ? 13 : 16,
        fontWeight: 700, color, letterSpacing: '-0.04em'
      }}>
        {score}
      </div>
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────

const STATUS_STYLES: Record<ScreenStatus, { bg: string; color: string; border: string }> = {
  pass:    { bg: 'rgba(52,211,153,0.1)',  color: 'var(--pass)', border: 'rgba(52,211,153,0.25)' },
  fail:    { bg: 'rgba(248,113,113,0.1)', color: 'var(--fail)', border: 'rgba(248,113,113,0.25)' },
  warning: { bg: 'rgba(251,191,36,0.1)',  color: 'var(--warn)', border: 'rgba(251,191,36,0.25)' },
  running: { bg: 'rgba(167,139,250,0.1)', color: 'var(--purple)', border: 'rgba(167,139,250,0.25)' },
  pending: { bg: 'var(--surface2)',        color: 'var(--text3)', border: 'var(--border)' },
};

export function StatusBadge({ status }: { status: ScreenStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const icons: Record<ScreenStatus, string> = { pass: '✓', fail: '✗', warning: '⚠', running: '●', pending: '○' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 99,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {icons[status]} {status}
    </span>
  );
}

// ── Severity Badge ────────────────────────────────────────────

const SEV_COLORS: Record<SeverityLevel, string> = {
  critical: 'var(--critical)', major: 'var(--major)',
  minor: 'var(--minor)', info: 'var(--info-clr)',
};

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  const color = SEV_COLORS[severity];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '1px 8px', borderRadius: 99,
      fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
      background: `${color}1a`, color, border: `1px solid ${color}44`,
    }}>
      {severity}
    </span>
  );
}

// ── Platform Badge ────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, string> = { web: '⬡', android: '◈', ios: '◉' };

export function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99,
      fontSize: 11, fontWeight: 600,
      background: 'var(--purple-dim)', color: 'var(--purple)',
      border: '1px solid rgba(167,139,250,0.2)',
    }}>
      {PLATFORM_ICONS[platform]} {platform}
    </span>
  );
}

// ── Progress Bar ──────────────────────────────────────────────

export function ProgressBar({ value, color = 'var(--purple)', height = 4 }: {
  value: number; color?: string; height?: number;
}) {
  return (
    <div style={{ height, background: 'var(--surface3)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.max(0, Math.min(100, value))}%`,
        background: color, borderRadius: 99,
        transition: 'width 0.5s ease',
      }} />
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────

export function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '14px 16px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', color: color ?? 'var(--text)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

// ── Metric Pill ───────────────────────────────────────────────

export function MetricPill({ label, value, unit, color }: {
  label: string; value: string | number; unit?: string; color?: string;
}) {
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '10px 14px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', color: color ?? 'var(--text)', fontFamily: 'var(--mono)' }}>
        {value}<span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>{unit}</span>
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────

export function PageHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode;
}) {
  return (
    <div style={{
      padding: '28px 32px 20px',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 16,
    }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

export function Button({ variant = 'ghost', size = 'md', children, style, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: '1px solid',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
    transition: 'all 0.12s',
    padding: size === 'sm' ? '5px 12px' : '8px 16px',
    fontSize: size === 'sm' ? 12 : 13.5,
  };

  const variants = {
    primary: { background: 'var(--purple)', borderColor: 'var(--purple)', color: '#fff' },
    ghost: { background: 'var(--surface2)', borderColor: 'var(--border2)', color: 'var(--text2)' },
    danger: { background: 'var(--fail-dim)', borderColor: 'rgba(248,113,113,0.3)', color: 'var(--fail)' },
  };

  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...props}>
      {children}
    </button>
  );
}

// ── Tab bar ───────────────────────────────────────────────────

export function TabBar({ tabs, active, onChange }: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{
      display: 'flex', gap: 0,
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface2)',
      padding: '0 20px',
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            padding: '10px 14px', border: 'none',
            background: 'transparent',
            color: active === tab.id ? 'var(--text)' : 'var(--text3)',
            fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
            borderBottom: `2px solid ${active === tab.id ? 'var(--purple)' : 'transparent'}`,
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'color 0.12s',
          }}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '0px 5px',
              borderRadius: 99, background: 'var(--surface3)', color: 'var(--text3)',
            }}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────

export function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 32px', color: 'var(--text3)' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 13, maxWidth: 360, margin: '0 auto 20px' }}>{description}</div>}
      {action}
    </div>
  );
}

// ── Loading Spinner ───────────────────────────────────────────

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid var(--border2)`,
      borderTopColor: 'var(--purple)',
      animation: 'spin 0.7s linear infinite',
    }} />
  );
}

// Inject keyframes once
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}
