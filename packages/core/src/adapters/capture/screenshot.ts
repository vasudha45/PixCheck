import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CapturedScreenshot, ScreenConfig } from '../../types';

const execAsync = promisify(exec);

// ── Web Capture via Playwright ────────────────────────────────

export async function captureWeb(config: ScreenConfig): Promise<CapturedScreenshot> {
  if (!config.url) throw new Error(`[Web Capture] url is required for screen "${config.name}"`);

  // Dynamic import playwright to avoid hard dep at module load
  const { chromium } = await import('playwright');

  const viewport = config.viewport ?? { width: 1440, height: 900 };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    await page.goto(config.url, { waitUntil: 'networkidle', timeout: 30_000 });

    // Small delay for animations to settle
    await page.waitForTimeout(500);

    let imageBuffer: Buffer;

    if (config.selector) {
      const element = await page.$(config.selector);
      if (!element) throw new Error(`[Web Capture] Selector "${config.selector}" not found`);
      imageBuffer = await element.screenshot({ type: 'png' }) as Buffer;
    } else {
      imageBuffer = await page.screenshot({ type: 'png', fullPage: false }) as Buffer;
    }

    return {
      screenName: config.name,
      platform: 'web',
      imageBuffer,
      width: viewport.width,
      height: viewport.height,
      capturedAt: new Date(),
    };
  } finally {
    await browser.close();
  }
}

// ── Android Capture via ADB ───────────────────────────────────

export async function captureAndroid(config: ScreenConfig): Promise<CapturedScreenshot> {
  const tmpFile = path.join(os.tmpdir(), `pixelcheck_android_${Date.now()}.png`);

  try {
    // Check ADB is available
    try {
      execSync('adb version', { stdio: 'pipe' });
    } catch {
      throw new Error('[Android Capture] ADB not found. Install Android SDK platform-tools.');
    }

    // Get connected devices
    const { stdout: devicesOut } = await execAsync('adb devices');
    const devices = devicesOut
      .split('\n')
      .slice(1)
      .filter(l => l.includes('\tdevice'))
      .map(l => l.split('\t')[0].trim());

    if (devices.length === 0) {
      throw new Error('[Android Capture] No Android device connected. Connect a device or start an emulator.');
    }

    const deviceSerial = config.deviceName
      ? devices.find(d => d.includes(config.deviceName!)) ?? devices[0]
      : devices[0];

    // Capture screenshot via ADB
    const deviceTmp = '/sdcard/pixelcheck_tmp.png';
    await execAsync(`adb -s ${deviceSerial} shell screencap -p ${deviceTmp}`);
    await execAsync(`adb -s ${deviceSerial} pull ${deviceTmp} ${tmpFile}`);
    await execAsync(`adb -s ${deviceSerial} shell rm ${deviceTmp}`);

    if (!fs.existsSync(tmpFile)) {
      throw new Error('[Android Capture] Screenshot file was not created');
    }

    const imageBuffer = fs.readFileSync(tmpFile);

    // Get screen resolution
    const { stdout: wm } = await execAsync(`adb -s ${deviceSerial} shell wm size`);
    const match = wm.match(/(\d+)x(\d+)/);
    const width = match ? parseInt(match[1]) : 1080;
    const height = match ? parseInt(match[2]) : 1920;

    return {
      screenName: config.name,
      platform: 'android',
      imageBuffer,
      width,
      height,
      capturedAt: new Date(),
    };
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// ── iOS Capture via xcrun / idevicescreenshot ─────────────────

export async function captureIOS(config: ScreenConfig): Promise<CapturedScreenshot> {
  const tmpFile = path.join(os.tmpdir(), `pixelcheck_ios_${Date.now()}.png`);

  try {
    // Try simulator first (xcrun)
    let capturedViaSimulator = false;

    try {
      const { stdout: simList } = await execAsync('xcrun simctl list devices booted --json');
      const simData = JSON.parse(simList);
      const booted: { udid: string; name: string }[] = Object.values(simData.devices as Record<string, { udid: string; name: string; state: string }[]>)
        .flat()
        .filter((d) => d.state === 'Booted');

      if (booted.length > 0) {
        const sim = config.deviceName
          ? booted.find(d => d.name.includes(config.deviceName!)) ?? booted[0]
          : booted[0];

        await execAsync(`xcrun simctl io ${sim.udid} screenshot ${tmpFile}`);
        capturedViaSimulator = true;
      }
    } catch {
      // xcrun not available or no simulators running
    }

    // Fall back to physical device via idevicescreenshot
    if (!capturedViaSimulator) {
      try {
        execSync('idevicescreenshot --version', { stdio: 'pipe' });
      } catch {
        throw new Error(
          '[iOS Capture] No booted simulator found and idevicescreenshot not installed.\n' +
          'Boot an iOS Simulator or install libimobiledevice: brew install libimobiledevice'
        );
      }

      await execAsync(`idevicescreenshot ${tmpFile}`);
    }

    if (!fs.existsSync(tmpFile)) {
      throw new Error('[iOS Capture] Screenshot file was not created');
    }

    const imageBuffer = fs.readFileSync(tmpFile);

    return {
      screenName: config.name,
      platform: 'ios',
      imageBuffer,
      width: config.viewport?.width ?? 390,
      height: config.viewport?.height ?? 844,
      capturedAt: new Date(),
    };
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// ── Dispatcher ────────────────────────────────────────────────

export async function captureScreen(config: ScreenConfig): Promise<CapturedScreenshot> {
  switch (config.platform) {
    case 'web':
      return captureWeb(config);
    case 'android':
      return captureAndroid(config);
    case 'ios':
      return captureIOS(config);
    default:
      throw new Error(`[Capture] Unknown platform: ${(config as ScreenConfig).platform}`);
  }
}
