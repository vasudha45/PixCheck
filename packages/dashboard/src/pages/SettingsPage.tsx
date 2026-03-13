import { useState } from 'react';
import { Key, Eye, EyeOff, Save, CheckCircle } from 'lucide-react';
import { PageHeader, Card, Button } from '../components/ui';

interface Creds { figma: string; zeplin: string; anthropic: string; }

export default function SettingsPage() {
  const [creds, setCreds] = useState<Creds>({ figma: '', zeplin: '', anthropic: '' });
  const [show, setShow] = useState<Record<keyof Creds, boolean>>({ figma: false, zeplin: false, anthropic: false });
  const [saved, setSaved] = useState(false);
  const [thresholds, setThresholds] = useState({ pixelMismatch: 5, aiConfidence: 60, minScore: 80 });

  const handleSave = () => {
    // In production: POST to /api/settings
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const credField = (key: keyof Creds, label: string, placeholder: string, hint: string) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show[key] ? 'text' : 'password'}
          value={creds[key]}
          onChange={e => setCreds(c => ({ ...c, [key]: e.target.value }))}
          placeholder={placeholder}
          style={{
            width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '9px 38px 9px 12px',
            fontSize: 13, outline: 'none', fontFamily: creds[key] ? 'var(--mono)' : 'inherit',
          }}
        />
        <button
          onClick={() => setShow(s => ({ ...s, [key]: !s[key] }))}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}
        >
          {show[key] ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{hint}</div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="API credentials and default thresholds"
        actions={
          <Button variant="primary" onClick={handleSave}>
            {saved ? <><CheckCircle size={14} /> Saved!</> : <><Save size={14} /> Save Changes</>}
          </Button>
        }
      />

      <div style={{ padding: '24px 32px', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* API Keys */}
        <Card>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={14} color="var(--purple)" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>API Credentials</span>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 20, fontSize: 12, color: 'var(--warn)' }}>
              Credentials are stored locally. Never commit them to version control — use a .env file instead.
            </div>
            {credField('figma', 'Figma Personal Access Token', 'figd_...', 'Get from figma.com → Account Settings → Personal access tokens')}
            {credField('zeplin', 'Zeplin Personal Access Token', 'zpat_...', 'Get from zeplin.io → Profile → Developer → Access tokens')}
            {credField('anthropic', 'Anthropic API Key', 'sk-ant-...', 'Get from console.anthropic.com — used for Claude AI visual analysis')}
          </div>
        </Card>

        {/* Thresholds */}
        <Card>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>Default Thresholds</div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { key: 'pixelMismatch' as const, label: 'Max Pixel Mismatch %', min: 0, max: 30, unit: '%', desc: 'Fail if pixel diff exceeds this threshold' },
              { key: 'aiConfidence' as const, label: 'Min AI Confidence %', min: 0, max: 100, unit: '%', desc: 'Only include AI issues above this confidence level' },
              { key: 'minScore' as const, label: 'Min Accuracy Score', min: 0, max: 100, unit: '/100', desc: 'Fail the run if overall score is below this' },
            ].map(({ key, label, min, max, unit, desc }) => (
              <div key={key}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>{label}</label>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple)', fontFamily: 'var(--mono)' }}>{thresholds[key]}{unit}</span>
                </div>
                <input
                  type="range" min={min} max={max} value={thresholds[key]}
                  onChange={e => setThresholds(t => ({ ...t, [key]: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--purple)' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{desc}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* .env reference */}
        <Card>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>Environment Variables (.env)</div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>You can also set credentials via a .env file in the project root:</div>
            <pre style={{
              background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '14px 16px', fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)',
              lineHeight: 1.8, overflowX: 'auto',
            }}>
{`FIGMA_TOKEN=figd_your_token_here
ZEPLIN_TOKEN=zpat_your_token_here
ANTHROPIC_API_KEY=sk-ant-your_key_here`}
            </pre>
          </div>
        </Card>
      </div>
    </div>
  );
}
