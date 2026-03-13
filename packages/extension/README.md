# PixelCheck Chrome Extension

Capture any browser tab with one click for visual regression comparison.

## Install (Developer Mode)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this folder: `pixelcheck/packages/extension`
5. Pin the PixelCheck extension to your toolbar

The extension icon appears in Chrome's toolbar. A green dot means the PixelCheck API server is running.

## Usage

1. Start the PixelCheck API server: `npm run dev:api`
2. Navigate to the screen you want to test in Chrome
3. Click the PixelCheck extension icon
4. Fill in Story ID, Screen Name, and Figma/Zeplin IDs
5. Choose capture mode:
   - **Viewport** — captures exactly what's visible (recommended)
   - **Full page** — scrolls and captures the entire page
   - **Pick element** — enter a CSS selector to capture a specific component
   - **Draw region** — drag to select an area
6. Click **Capture & Compare**
7. Score and issue count appear in the popup
8. Click **View full report** to open the dashboard

## Capture Modes

| Mode | Best for |
|------|---------|
| Viewport | Full-page screen comparisons |
| Full page | Long scrollable pages |
| Pick element | Isolated component testing (e.g. a card, header, modal) |
| Draw region | Ad-hoc crop of a specific area |

## The popup remembers

Story ID, screen name, Figma/Zeplin IDs, and capture mode are all saved in Chrome's local storage — no re-entering on every capture.

## Troubleshooting

**Red dot (server not connected)**
- Make sure `npm run dev:api` is running in the project root
- Check the server URL in the popup footer (default: `http://localhost:3001`)

**"Capture failed"**
- The extension needs `activeTab` permission — make sure you clicked the icon while on the target tab
- Some pages block screenshot capture (chrome:// URLs, extension pages) — this is a Chrome security restriction

**Score not showing**
- Check API server logs for errors
- Verify FIGMA_TOKEN / ZEPLIN_TOKEN / ANTHROPIC_API_KEY are set in `.env`
