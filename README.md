# ⬡ PixelCheck — Visual Regression Testing Suite

> Compare Figma & Zeplin designs against your live implementation. Pixel-perfect diff + Claude AI analysis. Web, iOS, Android.

---

## Architecture

```
pixelcheck/
├── packages/
│   ├── core/          # Engine: design fetching, capture, diff, AI analysis, reports
│   ├── cli/           # npx pixelcheck run -c pixelcheck.config.json
│   └── dashboard/     # React web UI + Express API server
├── pixelcheck.config.json
└── .env
```

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

Create a `.env` file in the project root:

```env
FIGMA_TOKEN=figd_your_personal_access_token
ZEPLIN_TOKEN=zpat_your_personal_access_token
ANTHROPIC_API_KEY=sk-ant-your_api_key
```

**Getting credentials:**
- **Figma**: figma.com → Account Settings → Personal access tokens
- **Zeplin**: zeplin.io → Profile → Developer → Personal access tokens  
- **Anthropic**: console.anthropic.com → API Keys

### 3. Configure your screens

Edit `pixelcheck.config.json`:

```json
{
  "storyId": "STORY-421",
  "screens": [
    {
      "name": "Home Screen",
      "designSource": "figma",
      "figmaFileId": "abc123xyz",
      "figmaNodeId": "123:456",
      "platform": "web",
      "url": "http://localhost:3000/",
      "viewport": { "width": 1440, "height": 900 }
    }
  ]
}
```

**Finding Figma IDs:**
- File ID: from the URL — `figma.com/design/FILE_ID/...`
- Node ID: right-click a frame → Copy/Paste → Copy link — the `node-id=` param

**Finding Zeplin IDs:**
- Project ID: from URL — `app.zeplin.io/project/PROJECT_ID`
- Screen ID: click a screen → from URL `screen/SCREEN_ID`

### 4. Run via CLI

```bash
# Run from config file
npx ts-node packages/cli/src/index.ts run -c pixelcheck.config.json

# Quick single-screen check
npx ts-node packages/cli/src/index.ts check \
  --story STORY-421 \
  --name "Home Screen" \
  --platform web \
  --url http://localhost:3000 \
  --figma-file abc123xyz \
  --figma-node 123:456

# List all frames in a Figma file
npx ts-node packages/cli/src/index.ts list-figma --file abc123xyz

# List all screens in a Zeplin project
npx ts-node packages/cli/src/index.ts list-zeplin --project your-project-id
```

### 5. Run the Dashboard

```bash
# Start both API server and React dashboard
npm run dev
```

- Dashboard: http://localhost:5173
- API Server: http://localhost:3001

---

## How It Works

### Step 1 — Design Fetching
- **Figma**: Uses the Figma REST API to export the specified frame as PNG at 2x resolution
- **Zeplin**: Uses the Zeplin API to download the screen's original image

### Step 2 — Screenshot Capture
- **Web**: Playwright launches headless Chromium, navigates to your local URL, captures screenshot at specified viewport
- **Android**: Connects via ADB (`adb screencap`), works with physical devices and emulators
- **iOS**: Uses `xcrun simctl io screenshot` for simulators, `idevicescreenshot` for physical devices

### Step 3 — Image Normalization
Both images are resized/aligned to the same dimensions using Sharp, producing raw RGBA buffers for pixel-level comparison.

### Step 4 — Pixel Diff Engine
Uses **Pixelmatch** to compare pixel-by-pixel with configurable threshold. Outputs:
- Mismatch pixel count & percentage
- SSIM (Structural Similarity Index) score
- Diff image with red highlights on mismatches
- Bounding boxes around mismatch regions (via flood-fill connected-component analysis)

### Step 5 — Claude AI Visual Analysis
Sends both images to **Claude claude-opus-4-5** with a specialized prompt. Claude identifies:
- Color discrepancies (shades, opacity)
- Typography issues (font size, weight, family, line-height)
- Spacing & padding differences
- Layout & alignment issues
- Missing or extra elements
- Wrong copy/text content
- Wrong icons, border-radius, shadows

Each issue includes severity, category, suggested fix, confidence score, and bounding box coordinates.

### Step 6 — Report Generation
Merges pixel diff boxes + AI bounding boxes, draws annotations on the screenshot, computes overall accuracy score (0–100), generates HTML report with:
- Side-by-side design vs implementation view
- Annotated screenshots with colored bounding boxes
- Full issue list filterable by severity
- AI assessment and positives
- Pixel diff overlay with SSIM and mismatch stats

---

## Accuracy Score

The score (0–100) is a weighted combination:

| Component | Weight | Source |
|-----------|--------|--------|
| SSIM score | 40% | Pixel diff engine |
| Pixel mismatch penalty | 30% | Pixel diff engine |
| AI issue penalties | 30% | Claude AI analysis |

**Status thresholds** (configurable):
- ✅ **Pass**: score ≥ 80, mismatch < 8%, no critical issues
- ⚠️ **Warning**: score 60–80 or mismatch 8–20%
- ❌ **Fail**: score < 60, mismatch > 20%, or any critical issues

---

## Mobile Setup

### Android
1. Enable Developer Options + USB Debugging on device
2. Connect via USB or start an emulator
3. Install Android SDK platform-tools (includes `adb`)
4. Verify: `adb devices`

### iOS Simulator
1. Open Xcode → Simulators → Boot target device
2. Verify: `xcrun simctl list devices booted`
3. PixelCheck auto-detects booted simulators

### iOS Physical Device
```bash
brew install libimobiledevice
idevicescreenshot test.png  # Verify it works
```

---

## CI/CD Integration

```yaml
# .github/workflows/visual-regression.yml
- name: Run PixelCheck
  run: |
    npx ts-node packages/cli/src/index.ts run \
      -c pixelcheck.config.json \
      --output ./pixelcheck-reports
  env:
    FIGMA_TOKEN: ${{ secrets.FIGMA_TOKEN }}
    ZEPLIN_TOKEN: ${{ secrets.ZEPLIN_TOKEN }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

- name: Upload report
  uses: actions/upload-artifact@v4
  with:
    name: pixelcheck-report
    path: pixelcheck-reports/
```

The CLI exits with code 1 if any screens fail, making it compatible with CI pass/fail gates.

---

## Configuration Reference

```jsonc
{
  "storyId": "STORY-123",           // Required: ticket/story ID for the report
  "screens": [{
    "name": "Screen Name",          // Required: human-readable label
    "designSource": "figma",        // "figma" | "zeplin"
    
    // Figma (when designSource = "figma"):
    "figmaFileId": "abc123",        // Figma file key from URL
    "figmaNodeId": "123:456",       // Frame/component node ID
    
    // Zeplin (when designSource = "zeplin"):
    "zeplinProjectId": "proj_id",
    "zeplinScreenId": "scr_id",
    
    "platform": "web",              // "web" | "android" | "ios"
    
    // Web only:
    "url": "http://localhost:3000",
    "selector": ".main-content",    // Optional: capture specific element
    
    // Mobile only:
    "deviceName": "iPhone 14 Pro",  // Optional: target specific device
    
    "viewport": { "width": 1440, "height": 900 }
  }],
  "output": {
    "dir": "./pixelcheck-reports",
    "formats": ["html", "json"],
    "openOnComplete": true
  },
  "thresholds": {
    "pixelMismatchPercent": 5,      // Fail if pixel diff > 5%
    "aiConfidenceMin": 0.6,         // Ignore AI issues below 60% confidence
    "overallScoreMin": 80           // Fail if score < 80
  }
}
```

---

## Bounding Box Legend

In annotated screenshots:
- 🔴 **Red solid border** — Critical AI-detected issue
- 🟠 **Orange solid border** — Major AI-detected issue  
- 🟡 **Yellow dashed border** — Pixel diff region (minor)
- 🔵 **Blue border** — Info-level issue
- **AI badge** (small circle) — Issue detected by Claude Vision

---

## Troubleshooting

**Playwright not launching:**
```bash
npx playwright install chromium
```

**ADB device not found:**
```bash
adb kill-server && adb start-server
adb devices
```

**iOS simulator not detected:**
```bash
xcrun simctl list devices booted
# If empty, open Simulator.app and boot a device
```

**Figma 403 error:**
- Verify your token has read access to the file
- Check the file isn't in a restricted workspace

**Out of memory on large screens:**
- Reduce viewport size
- Use `selector` to capture specific components instead of full page
