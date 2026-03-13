import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, Play, ChevronDown, ChevronUp,
  Smartphone, Monitor, Apple, Wifi, WifiOff,
  Camera, CheckCircle, XCircle, RefreshCw
} from 'lucide-react';
import { PageHeader, Button, Card, ScoreRing, Spinner } from '../components/ui';
import { ScreenConfigUI, DesignSource, Platform } from '../types';

// ── Types ─────────────────────────────────────────────────────
interface AndroidDevice { serial: string; model: string; status: string; }
interface IOSSimulator  { udid: string; name: string; os: string; state: string; }
interface IOSPhysical   { udid: string; name: string; productType: string; }

interface ScreenCapture {
  status: 'idle' | 'capturing' | 'done' | 'error';
  score?: number;
  issues?: number;
  mismatch?: number;
  reportId?: string;
  error?: string;
}

const DEFAULT_SCREEN: ScreenConfigUI = {
  name: '', designSource: 'figma', platform: 'web',
  figmaFileId: '', figmaNodeId: '',
  url: 'http://localhost:3000',
  viewport: { width: 1440, height: 900 },
};

const API = 'http://localhost:3001';

// ── Page ──────────────────────────────────────────────────────
export default function RunPage() {
  const navigate = useNavigate();
  const [storyId, setStoryId]   = useState('');
  const [screens, setScreens]   = useState<ScreenConfigUI[]>([{ ...DEFAULT_SCREEN }]);
  const [expandedIdx, setExpanded] = useState(0);
  const [captures, setCaptures] = useState<Record<string, ScreenCapture>>({});

  // Device lists
  const [androidDevices, setAndroidDevices] = useState<AndroidDevice[]>([]);
  const [iosSimulators, setIosSimulators]   = useState<IOSSimulator[]>([]);
  const [iosPhysical, setIosPhysical]       = useState<IOSPhysical[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  // Extension status
  const [extConnected, setExtConnected] = useState<boolean | null>(null);

  useEffect(() => { checkExtension(); }, []);

  const checkExtension = async () => {
    try {
      const res = await fetch(`${API}/health`).catch(() => null);
      // Extension readiness is indicated by the API being up
      setExtConnected(!!res);
    } catch { setExtConnected(false); }
  };

  const refreshDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const [aRes, iRes] = await Promise.all([
        fetch(`${API}/api/devices/android`).then(r => r.json()).catch(() => ({ devices: [] })),
        fetch(`${API}/api/devices/ios`).then(r => r.json()).catch(() => ({ simulators: [], physical: [] })),
      ]);
      setAndroidDevices(aRes.devices ?? []);
      setIosSimulators(iRes.simulators ?? []);
      setIosPhysical(iRes.physical ?? []);
    } finally { setDevicesLoading(false); }
  }, []);

  // Auto-refresh devices when any screen is android/ios
  useEffect(() => {
    if (screens.some(s => s.platform === 'android' || s.platform === 'ios')) {
      refreshDevices();
    }
  }, [screens.map(s => s.platform).join(',')]);

  const addScreen    = () => { setScreens(p => [...p, { ...DEFAULT_SCREEN }]); setExpanded(screens.length); };
  const removeScreen = (i: number) => { setScreens(p => p.filter((_, x) => x !== i)); setExpanded(Math.max(0, i - 1)); };
  const updateScreen = (i: number, patch: Partial<ScreenConfigUI>) =>
    setScreens(p => p.map((s, x) => x === i ? { ...s, ...patch } : s));

  const setCapture = (name: string, patch: Partial<ScreenCapture>) =>
    setCaptures(p => ({ ...p, [name]: { ...p[name], ...patch } as ScreenCapture }));

  // ── Capture handlers ────────────────────────────────────────

  const captureWeb = async (screen: ScreenConfigUI) => {
    if (!storyId.trim()) { alert('Enter a Story ID first'); return; }
    setCapture(screen.name, { status: 'capturing' });
    try {
      // Ask the extension (via the API relay) to capture the active Chrome tab
      const res = await fetch(`${API}/api/capture/trigger-extension`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId, screenName: screen.name, designSource: screen.designSource,
          figmaFileId: screen.figmaFileId, figmaNodeId: screen.figmaNodeId,
          zeplinProjectId: screen.zeplinProjectId, zeplinScreenId: screen.zeplinScreenId,
          viewport: screen.viewport,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCapture(screen.name, {
        status: 'done', score: data.accuracyScore,
        issues: data.totalIssues, mismatch: data.mismatchPercent,
        reportId: data.reportId,
      });
    } catch (err) {
      setCapture(screen.name, { status: 'error', error: String(err) });
    }
  };

  const captureAndroid = async (screen: ScreenConfigUI) => {
    if (!storyId.trim()) { alert('Enter a Story ID first'); return; }
    setCapture(screen.name, { status: 'capturing' });
    try {
      const device = androidDevices.find(d => d.status === 'device') ?? androidDevices[0];
      const res = await fetch(`${API}/api/capture/android`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId, screenName: screen.name, designSource: screen.designSource,
          figmaFileId: screen.figmaFileId, figmaNodeId: screen.figmaNodeId,
          zeplinProjectId: screen.zeplinProjectId, zeplinScreenId: screen.zeplinScreenId,
          deviceSerial: screen.deviceName ?? device?.serial,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCapture(screen.name, {
        status: 'done', score: data.accuracyScore,
        issues: data.totalIssues, mismatch: data.mismatchPercent,
        reportId: data.reportId,
      });
    } catch (err) {
      setCapture(screen.name, { status: 'error', error: String(err) });
    }
  };

  const captureIOS = async (screen: ScreenConfigUI) => {
    if (!storyId.trim()) { alert('Enter a Story ID first'); return; }
    setCapture(screen.name, { status: 'capturing' });
    try {
      const bootedSim = iosSimulators.find(s => s.state === 'Booted');
      const isSimulator = !!(bootedSim || !iosPhysical.length);
      const deviceUdid = screen.deviceName
        ?? (isSimulator ? bootedSim?.udid : iosPhysical[0]?.udid);

      const res = await fetch(`${API}/api/capture/ios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId, screenName: screen.name, designSource: screen.designSource,
          figmaFileId: screen.figmaFileId, figmaNodeId: screen.figmaNodeId,
          zeplinProjectId: screen.zeplinProjectId, zeplinScreenId: screen.zeplinScreenId,
          deviceUdid, isSimulator,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCapture(screen.name, {
        status: 'done', score: data.accuracyScore,
        issues: data.totalIssues, mismatch: data.mismatchPercent,
        reportId: data.reportId,
      });
    } catch (err) {
      setCapture(screen.name, { status: 'error', error: String(err) });
    }
  };

  const handleCapture = (screen: ScreenConfigUI) => {
    if (!screen.name.trim()) { alert('Give this screen a name first'); return; }
    if (screen.platform === 'web')     return captureWeb(screen);
    if (screen.platform === 'android') return captureAndroid(screen);
    if (screen.platform === 'ios')     return captureIOS(screen);
  };

  return (
    <div>
      <PageHeader
        title="New Run"
        subtitle="Configure screens and capture them one-by-one or all at once"
        actions={
          <Button variant="primary"
            onClick={() => screens.forEach(handleCapture)}
            disabled={!storyId || screens.some(s => !s.name)}>
            <Play size={14} /> Capture All
          </Button>
        }
      />

      <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>

        {/* Left col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Story ID */}
          <Card>
            <div style={{ padding: '14px 18px' }}>
              <label style={labelStyle}>Story / Ticket ID</label>
              <input value={storyId} onChange={e => setStoryId(e.target.value)}
                placeholder="e.g. STORY-421 or JIRA-1234" style={inputStyle} />
            </div>
          </Card>

          {/* Screen cards */}
          {screens.map((screen, i) => (
            <ScreenCard
              key={i}
              screen={screen}
              index={i}
              expanded={expandedIdx === i}
              onToggle={() => setExpanded(expandedIdx === i ? -1 : i)}
              onChange={p => updateScreen(i, p)}
              onRemove={() => removeScreen(i)}
              capture={captures[screen.name] ?? { status: 'idle' }}
              onCapture={() => handleCapture(screen)}
              androidDevices={androidDevices}
              iosSimulators={iosSimulators}
              iosPhysical={iosPhysical}
            />
          ))}

          <button onClick={addScreen} style={addBtnStyle}
            onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'var(--purple)'; (e.target as HTMLElement).style.color = 'var(--purple)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border2)'; (e.target as HTMLElement).style.color = 'var(--text3)'; }}>
            <Plus size={14} /> Add Screen
          </button>
        </div>

        {/* Right col — status panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Extension / connection status */}
          <Card>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Connections
            </div>
            <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* Web / extension */}
              <ConnectionRow
                icon={<Monitor size={13} />}
                label="Chrome extension"
                status={extConnected === null ? 'checking' : extConnected ? 'connected' : 'disconnected'}
                hint={extConnected === false ? 'Load extension from packages/extension' : undefined}
              />

              {/* Android */}
              <ConnectionRow
                icon={<Smartphone size={13} />}
                label={androidDevices.length > 0 ? `Android — ${androidDevices[0].model}` : 'Android'}
                status={devicesLoading ? 'checking' : androidDevices.length > 0 ? 'connected' : 'disconnected'}
                hint={androidDevices.length === 0 ? 'Connect device via USB & enable USB debugging' : undefined}
              />

              {/* iOS */}
              <ConnectionRow
                icon={<Apple size={13} />}
                label={iosSimulators.find(s => s.state === 'Booted')?.name ?? iosPhysical[0]?.name ?? 'iOS'}
                status={devicesLoading ? 'checking' : (iosSimulators.some(s => s.state === 'Booted') || iosPhysical.length > 0) ? 'connected' : 'disconnected'}
                hint={!iosSimulators.some(s => s.state === 'Booted') && !iosPhysical.length ? 'Boot a simulator or connect iPhone via USB' : undefined}
              />

              <button onClick={refreshDevices} disabled={devicesLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
                  background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11.5,
                  cursor: 'pointer', padding: '3px 0' }}>
                <RefreshCw size={11} style={{ animation: devicesLoading ? 'spin 1s linear infinite' : 'none' }} />
                Refresh devices
              </button>
            </div>
          </Card>

          {/* Capture results */}
          {Object.keys(captures).length > 0 && (
            <Card>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Results
              </div>
              {screens.map(s => {
                const c = captures[s.name];
                if (!c || c.status === 'idle') return null;
                return (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      {c.status === 'capturing' && <div style={{ fontSize: 11, color: 'var(--purple)' }}>Capturing…</div>}
                      {c.status === 'done' && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.issues} issues · {c.mismatch?.toFixed(1)}% diff</div>}
                      {c.status === 'error' && <div style={{ fontSize: 11, color: 'var(--fail)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.error}</div>}
                    </div>
                    {c.status === 'capturing' && <Spinner size={14} />}
                    {c.status === 'done' && c.score !== undefined && <ScoreRing score={c.score} size={38} />}
                    {c.status === 'done' && c.reportId && (
                      <button onClick={() => navigate(`/report/${c.reportId}`)}
                        style={{ background: 'none', border: 'none', color: 'var(--purple)', fontSize: 11, cursor: 'pointer' }}>→</button>
                    )}
                    {c.status === 'error' && <XCircle size={14} color="var(--fail)" />}
                  </div>
                );
              })}
            </Card>
          )}

          {/* How it works box */}
          <Card>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              How capture works
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: <Monitor size={12} />, platform: 'Web', desc: 'Chrome extension captures your active tab exactly as you see it' },
                { icon: <Smartphone size={12} />, platform: 'Android', desc: 'ADB triggers screencap on connected device or emulator' },
                { icon: <Apple size={12} />, platform: 'iOS', desc: 'xcrun captures booted simulator; idevicescreenshot for physical iPhone' },
              ].map(({ icon, platform, desc }) => (
                <div key={platform} style={{ display: 'flex', gap: 8 }}>
                  <div style={{ color: 'var(--purple)', marginTop: 2, flexShrink: 0 }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{platform}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Screen card ───────────────────────────────────────────────
function ScreenCard({
  screen, index, expanded, onToggle, onChange, onRemove,
  capture, onCapture, androidDevices, iosSimulators, iosPhysical,
}: {
  screen: ScreenConfigUI; index: number; expanded: boolean;
  onToggle: () => void; onChange: (p: Partial<ScreenConfigUI>) => void;
  onRemove: () => void; capture: ScreenCapture; onCapture: () => void;
  androidDevices: AndroidDevice[]; iosSimulators: IOSSimulator[]; iosPhysical: IOSPhysical[];
}) {
  const isCapturing = capture.status === 'capturing';

  const captureLabel = {
    idle: 'Capture',
    capturing: 'Capturing…',
    done: 'Re-capture',
    error: 'Retry',
  }[capture.status];

  const captureBtnColor = {
    idle: 'var(--purple)',
    capturing: 'var(--text3)',
    done: 'var(--pass)',
    error: 'var(--fail)',
  }[capture.status];

  return (
    <Card>
      {/* Header row */}
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>
          {index + 1}
        </div>
        <PlatformIcon platform={screen.platform} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: screen.name ? 'var(--text)' : 'var(--text3)' }}>
          {screen.name || 'Unnamed screen'}
        </span>
        {/* Capture button — always visible in header */}
        <button
          onClick={e => { e.stopPropagation(); onCapture(); }}
          disabled={isCapturing || !screen.name}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', border: `1px solid ${captureBtnColor}44`,
            borderRadius: 6, background: `${captureBtnColor}14`,
            color: captureBtnColor, fontSize: 11.5, fontWeight: 600,
            fontFamily: 'inherit', cursor: isCapturing ? 'wait' : 'pointer',
            opacity: (!screen.name) ? 0.4 : 1,
          }}>
          {isCapturing ? <Spinner size={11} /> : <Camera size={11} />}
          {captureLabel}
        </button>
        {capture.status === 'done' && capture.score !== undefined && (
          <ScoreRing score={capture.score} size={34} />
        )}
        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}>
          <Trash2 size={12} />
        </button>
        {expanded ? <ChevronUp size={13} color="var(--text3)" /> : <ChevronDown size={13} color="var(--text3)" />}
      </div>

      {/* Error message */}
      {capture.status === 'error' && (
        <div style={{ padding: '0 16px 10px' }}>
          <div style={{ background: 'var(--fail-dim)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, padding: '7px 10px', fontSize: 11.5, color: 'var(--fail)' }}>
            {capture.error}
          </div>
        </div>
      )}

      {/* Expanded config */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px' }}>
          <Field label="Screen name">
            <input value={screen.name} onChange={e => onChange({ name: e.target.value })}
              placeholder="e.g. Home Screen" style={inputStyle} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <Field label="Design source">
              <select value={screen.designSource} onChange={e => onChange({ designSource: e.target.value as DesignSource })} style={inputStyle}>
                <option value="figma">Figma</option>
                <option value="zeplin">Zeplin</option>
              </select>
            </Field>
            <Field label="Platform">
              <select value={screen.platform} onChange={e => onChange({ platform: e.target.value as Platform })} style={inputStyle}>
                <option value="web">Web</option>
                <option value="android">Android</option>
                <option value="ios">iOS</option>
              </select>
            </Field>
          </div>

          {/* Design IDs */}
          {screen.designSource === 'figma' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <Field label="Figma file ID"><input value={screen.figmaFileId ?? ''} onChange={e => onChange({ figmaFileId: e.target.value })} placeholder="abc123xyz" style={inputStyle} /></Field>
              <Field label="Figma node ID"><input value={screen.figmaNodeId ?? ''} onChange={e => onChange({ figmaNodeId: e.target.value })} placeholder="123:456" style={inputStyle} /></Field>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <Field label="Zeplin project ID"><input value={screen.zeplinProjectId ?? ''} onChange={e => onChange({ zeplinProjectId: e.target.value })} placeholder="project-id" style={inputStyle} /></Field>
              <Field label="Zeplin screen ID"><input value={screen.zeplinScreenId ?? ''} onChange={e => onChange({ zeplinScreenId: e.target.value })} placeholder="screen-id" style={inputStyle} /></Field>
            </div>
          )}

          {/* Platform-specific fields */}
          {screen.platform === 'web' && (
            <>
              <Field label="Local URL (for reference only — extension captures active tab)">
                <input value={screen.url ?? ''} onChange={e => onChange({ url: e.target.value })} placeholder="http://localhost:3000/page" style={inputStyle} />
              </Field>
              <div style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 6, padding: '8px 12px', fontSize: 11.5, color: 'var(--purple)', marginBottom: 12 }}>
                Navigate to this screen in Chrome, then click Capture — the extension will capture exactly what you see.
              </div>
            </>
          )}

          {screen.platform === 'android' && (
            <Field label="Android device">
              {androidDevices.length > 0 ? (
                <select value={screen.deviceName ?? ''} onChange={e => onChange({ deviceName: e.target.value })} style={inputStyle}>
                  <option value="">Auto-detect (first connected)</option>
                  {androidDevices.map(d => (
                    <option key={d.serial} value={d.serial}>{d.model} ({d.serial}) — {d.status}</option>
                  ))}
                </select>
              ) : (
                <div style={{ background: 'var(--fail-dim)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, padding: '8px 10px', fontSize: 11.5, color: 'var(--fail)' }}>
                  No Android devices found. Connect via USB and enable USB Debugging in Developer Options.
                </div>
              )}
            </Field>
          )}

          {screen.platform === 'ios' && (
            <Field label="iOS device">
              {(iosSimulators.length > 0 || iosPhysical.length > 0) ? (
                <select value={screen.deviceName ?? ''} onChange={e => onChange({ deviceName: e.target.value })} style={inputStyle}>
                  <option value="">Auto-detect (booted simulator or connected iPhone)</option>
                  {iosSimulators.filter(s => s.state === 'Booted').map(s => (
                    <option key={s.udid} value={s.udid}>🟢 {s.name} — {s.os} (Simulator)</option>
                  ))}
                  {iosSimulators.filter(s => s.state !== 'Booted').slice(0, 5).map(s => (
                    <option key={s.udid} value={s.udid}>○ {s.name} — {s.os} (Simulator, not booted)</option>
                  ))}
                  {iosPhysical.map(d => (
                    <option key={d.udid} value={d.udid}>📱 {d.name} ({d.productType})</option>
                  ))}
                </select>
              ) : (
                <div style={{ background: 'var(--fail-dim)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, padding: '8px 10px', fontSize: 11.5, color: 'var(--fail)' }}>
                  No iOS devices found. Boot a simulator in Simulator.app or connect iPhone via USB (install libimobiledevice).
                </div>
              )}
            </Field>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Viewport W">
              <input type="number" value={screen.viewport?.width ?? 1440} onChange={e => onChange({ viewport: { ...screen.viewport!, width: +e.target.value } })} style={inputStyle} />
            </Field>
            <Field label="Viewport H">
              <input type="number" value={screen.viewport?.height ?? 900} onChange={e => onChange({ viewport: { ...screen.viewport!, height: +e.target.value } })} style={inputStyle} />
            </Field>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Connection row ────────────────────────────────────────────
function ConnectionRow({ icon, label, status, hint }: {
  icon: React.ReactNode; label: string;
  status: 'connected' | 'disconnected' | 'checking'; hint?: string;
}) {
  const dot = { connected: 'var(--pass)', disconnected: 'var(--fail)', checking: 'var(--warn)' }[status];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ color: 'var(--text3)' }}>{icon}</span>
        <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>{label}</span>
        {status === 'checking'
          ? <Spinner size={10} />
          : <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />
        }
      </div>
      {hint && <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2, paddingLeft: 20 }}>{hint}</div>}
    </div>
  );
}

// ── Platform icon ─────────────────────────────────────────────
function PlatformIcon({ platform }: { platform: string }) {
  const color = 'var(--purple)';
  if (platform === 'android') return <Smartphone size={13} color={color} />;
  if (platform === 'ios')     return <Apple size={13} color={color} />;
  return <Monitor size={13} color={color} />;
}

// ── Small helpers ─────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10.5, fontWeight: 700,
  color: 'var(--text3)', textTransform: 'uppercase',
  letterSpacing: '0.07em', marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface2)',
  border: '1px solid var(--border)', borderRadius: 6,
  color: 'var(--text)', padding: '7px 10px',
  fontSize: 12.5, outline: 'none', fontFamily: 'inherit',
};

const addBtnStyle: React.CSSProperties = {
  width: '100%', padding: '10px',
  border: '1px dashed var(--border2)', background: 'transparent',
  borderRadius: 10, color: 'var(--text3)', fontSize: 13,
  cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', gap: 6, transition: 'all 0.12s',
  fontFamily: 'inherit',
};
