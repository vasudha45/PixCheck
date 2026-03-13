import express from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fsp from 'fs/promises';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR ?? './pixelcheck-reports');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/reports', express.static(REPORTS_DIR));

// ── Health ────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    figmaToken: !!process.env.FIGMA_TOKEN,
    zeplinToken: !!process.env.ZEPLIN_TOKEN,
    anthropicApiKey: !!process.env.ANTHROPIC_API_KEY,
    version: '1.0.0',
  });
});

// ── POST /api/capture  (Chrome extension → web screens) ───────
app.post('/api/capture', async (req, res) => {
  const { storyId, screenName, designSource, figmaFileId, figmaNodeId,
          zeplinProjectId, zeplinScreenId, screenshotDataUrl, viewport } = req.body;

  if (!storyId || !screenName || !screenshotDataUrl)
    return res.status(400).json({ error: 'Missing: storyId, screenName, screenshotDataUrl' });

  try {
    const base64 = screenshotDataUrl.replace(/^data:image\/png;base64,/, '');
    const screenshotBuf = Buffer.from(base64, 'base64');
    const result = await runComparison({
      storyId, screenName, platform: 'web', designSource,
      figmaFileId, figmaNodeId, zeplinProjectId, zeplinScreenId,
      screenshotBuf, viewport,
    });
    res.json(result);
  } catch (err) {
    console.error('[/api/capture]', err);
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/devices/android ──────────────────────────────────
app.get('/api/devices/android', async (_req, res) => {
  try {
    const { stdout } = await execAsync('adb devices -l');
    res.json({ devices: parseAdbDevices(stdout) });
  } catch {
    res.json({ devices: [], error: 'adb not found — install Android SDK platform-tools and add to PATH' });
  }
});

// ── GET /api/devices/ios ──────────────────────────────────────
app.get('/api/devices/ios', async (_req, res) => {
  const simulators = await listIOSSimulators();
  const physical   = await listIOSPhysicalDevices();
  res.json({ simulators, physical });
});

// ── POST /api/capture/android ─────────────────────────────────
app.post('/api/capture/android', async (req, res) => {
  const { storyId, screenName, designSource, figmaFileId, figmaNodeId,
          zeplinProjectId, zeplinScreenId, deviceSerial } = req.body;

  if (!storyId || !screenName)
    return res.status(400).json({ error: 'Missing: storyId, screenName' });

  try {
    const screenshotBuf = await captureAndroid(deviceSerial);
    const viewport      = await getAndroidScreenSize(deviceSerial);
    const result = await runComparison({
      storyId, screenName, platform: 'android', designSource,
      figmaFileId, figmaNodeId, zeplinProjectId, zeplinScreenId,
      screenshotBuf, viewport,
    });
    res.json(result);
  } catch (err) {
    console.error('[/api/capture/android]', err);
    res.status(500).json({ error: String(err) });
  }
});

// ── POST /api/capture/ios ─────────────────────────────────────
app.post('/api/capture/ios', async (req, res) => {
  const { storyId, screenName, designSource, figmaFileId, figmaNodeId,
          zeplinProjectId, zeplinScreenId, deviceUdid, isSimulator } = req.body;

  if (!storyId || !screenName)
    return res.status(400).json({ error: 'Missing: storyId, screenName' });

  try {
    const screenshotBuf = isSimulator
      ? await captureIOSSimulator(deviceUdid)
      : await captureIOSPhysical(deviceUdid);
    const result = await runComparison({
      storyId, screenName, platform: 'ios', designSource,
      figmaFileId, figmaNodeId, zeplinProjectId, zeplinScreenId,
      screenshotBuf, viewport: { width: 390, height: 844 },
    });
    res.json(result);
  } catch (err) {
    console.error('[/api/capture/ios]', err);
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/reports ──────────────────────────────────────────
app.get('/api/reports', async (_req, res) => {
  try {
    await fsp.mkdir(REPORTS_DIR, { recursive: true });
    const entries = await fsp.readdir(REPORTS_DIR, { withFileTypes: true });
    const reports = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      try {
        const raw = await fsp.readFile(path.join(REPORTS_DIR, e.name, 'report.json'), 'utf-8');
        const r = JSON.parse(raw);
        reports.push({ reportId: r.reportId, storyId: r.storyId, generatedAt: r.generatedAt, summary: r.summary });
      } catch {}
    }
    reports.sort((a: any, b: any) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    res.json(reports);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/api/reports/:reportId', async (req, res) => {
  try {
    const raw = await fsp.readFile(path.join(REPORTS_DIR, req.params.reportId, 'report.json'), 'utf-8');
    const report = JSON.parse(raw);
    report.screens = report.screens?.map((s: any) => ({
      ...s, images: buildImageUrls(req.params.reportId, s.screenName),
    }));
    res.json(report);
  } catch { res.status(404).json({ error: 'Report not found' }); }
});

// ── Android helpers ───────────────────────────────────────────
async function captureAndroid(serial?: string): Promise<Buffer> {
  const flag   = serial ? `-s ${serial}` : '';
  const remote = `/sdcard/__pc_${Date.now()}.png`;
  const local  = path.join(os.tmpdir(), `pc_android_${Date.now()}.png`);
  try {
    await execAsync(`adb ${flag} shell screencap -p ${remote}`);
    await execAsync(`adb ${flag} pull ${remote} "${local}"`);
    await execAsync(`adb ${flag} shell rm ${remote}`).catch(() => {});
    const buf = await fsp.readFile(local);
    await fsp.unlink(local).catch(() => {});
    return buf;
  } catch (err) {
    await fsp.unlink(local).catch(() => {});
    throw new Error(`Android capture failed: ${err}`);
  }
}

async function getAndroidScreenSize(serial?: string): Promise<{ width: number; height: number }> {
  try {
    const flag = serial ? `-s ${serial}` : '';
    const { stdout } = await execAsync(`adb ${flag} shell wm size`);
    const m = stdout.match(/Physical size:\s*(\d+)x(\d+)/);
    if (m) return { width: +m[1], height: +m[2] };
  } catch {}
  return { width: 1080, height: 2340 };
}

function parseAdbDevices(output: string) {
  return output.split('\n').slice(1)
    .filter(l => l.trim() && !l.startsWith('*'))
    .map(l => {
      const parts = l.trim().split(/\s+/);
      const model = l.match(/model:(\S+)/)?.[1]?.replace(/_/g, ' ') ?? parts[0];
      return { serial: parts[0], status: parts[1], model };
    })
    .filter(d => d.serial && d.status);
}

// ── iOS helpers ───────────────────────────────────────────────
async function captureIOSSimulator(udid?: string): Promise<Buffer> {
  const local = path.join(os.tmpdir(), `pc_ios_${Date.now()}.png`);
  try {
    let target = udid;
    if (!target) {
      const { stdout } = await execAsync('xcrun simctl list devices booted --json');
      const data = JSON.parse(stdout);
      const booted: any = Object.values(data.devices as Record<string, any[]>)
        .flat().find((d: any) => d.state === 'Booted');
      if (!booted) throw new Error('No booted iOS simulator — open Simulator.app and boot a device');
      target = booted.udid;
    }
    await execAsync(`xcrun simctl io "${target}" screenshot "${local}"`);
    const buf = await fsp.readFile(local);
    await fsp.unlink(local).catch(() => {});
    return buf;
  } catch (err) {
    await fsp.unlink(local).catch(() => {});
    throw new Error(`iOS simulator capture failed: ${err}`);
  }
}

async function captureIOSPhysical(udid?: string): Promise<Buffer> {
  const local = path.join(os.tmpdir(), `pc_ios_${Date.now()}.png`);
  try {
    const args = udid ? ['-u', udid, local] : [local];
    await execFileAsync('idevicescreenshot', args);
    const buf = await fsp.readFile(local);
    await fsp.unlink(local).catch(() => {});
    return buf;
  } catch (err) {
    await fsp.unlink(local).catch(() => {});
    throw new Error(`iOS physical capture failed: ${err}\nInstall: brew install libimobiledevice`);
  }
}

async function listIOSSimulators() {
  try {
    const { stdout } = await execAsync('xcrun simctl list devices --json');
    const data = JSON.parse(stdout);
    const out: any[] = [];
    for (const [osVer, devices] of Object.entries(data.devices as Record<string, any[]>)) {
      for (const d of devices) {
        if (d.isAvailable)
          out.push({ udid: d.udid, name: d.name, os: osVer.replace('com.apple.CoreSimulator.SimRuntime.', '').replace('-', ' '), state: d.state });
      }
    }
    return out.sort((a, b) => (b.state === 'Booted' ? 1 : 0) - (a.state === 'Booted' ? 1 : 0));
  } catch { return []; }
}

async function listIOSPhysicalDevices() {
  try {
    const { stdout } = await execAsync('idevice_id -l');
    const udids = stdout.trim().split('\n').filter(Boolean);
    return Promise.all(udids.map(async udid => {
      try {
        const { stdout: name } = await execAsync(`ideviceinfo -u ${udid} -k DeviceName`);
        const { stdout: type } = await execAsync(`ideviceinfo -u ${udid} -k ProductType`);
        return { udid, name: name.trim(), productType: type.trim() };
      } catch { return { udid, name: udid, productType: 'Unknown' }; }
    }));
  } catch { return []; }
}

// ── Comparison pipeline ───────────────────────────────────────
async function runComparison(opts: {
  storyId: string; screenName: string; platform: string; designSource: string;
  figmaFileId?: string; figmaNodeId?: string; zeplinProjectId?: string; zeplinScreenId?: string;
  screenshotBuf: Buffer; viewport: { width: number; height: number };
}) {
  const { runPixelCheck } = await import('@pixelcheck/core');
  const reportId   = `rpt_${Date.now()}_${slugify(opts.screenName)}`;
  const outputDir  = path.join(REPORTS_DIR, reportId);
  await fsp.mkdir(outputDir, { recursive: true });

  const screenshotPath = path.join(outputDir, 'screenshot_input.png');
  await fsp.writeFile(screenshotPath, opts.screenshotBuf);

  const report = await runPixelCheck({
    config: {
      storyId: opts.storyId,
      screens: [{
        name: opts.screenName,
        designSource: opts.designSource as any,
        figmaFileId: opts.figmaFileId,
        figmaNodeId: opts.figmaNodeId,
        zeplinProjectId: opts.zeplinProjectId,
        zeplinScreenId: opts.zeplinScreenId,
        platform: opts.platform as any,
        preCapuredScreenshotPath: screenshotPath,
        viewport: opts.viewport,
      }],
      output: { dir: REPORTS_DIR, formats: ['html', 'json'] },
    },
    credentials: {
      figmaToken: process.env.FIGMA_TOKEN,
      zeplinToken: process.env.ZEPLIN_TOKEN,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    },
  });

  const screen = report.screens[0];
  return {
    reportId,
    accuracyScore: Math.round(screen.accuracyScore),
    mismatchPercent: screen.pixelDiff.mismatchPercent,
    totalIssues: screen.aiAnalysis.issues.length,
    status: screen.status,
  };
}

function buildImageUrls(reportId: string, screenName: string) {
  const slug = slugify(screenName);
  return {
    design:     `/reports/${reportId}/assets/${slug}_design.png`,
    screenshot: `/reports/${reportId}/assets/${slug}_screenshot.png`,
    annotated:  `/reports/${reportId}/assets/${slug}_annotated.png`,
    diff:       `/reports/${reportId}/assets/${slug}_diff.png`,
  };
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

app.listen(PORT, () => {
  console.log(`\n⬡  PixelCheck API  →  http://localhost:${PORT}`);
  console.log(`   Figma:      ${process.env.FIGMA_TOKEN    ? '✓' : '✗ missing FIGMA_TOKEN'}`);
  console.log(`   Zeplin:     ${process.env.ZEPLIN_TOKEN   ? '✓' : '✗ missing ZEPLIN_TOKEN'}`);
  console.log(`   Anthropic:  ${process.env.ANTHROPIC_API_KEY ? '✓' : '✗ missing ANTHROPIC_API_KEY'}`);
});

export default app;
