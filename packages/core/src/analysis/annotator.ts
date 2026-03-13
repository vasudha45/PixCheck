import sharp from 'sharp';
import { BoundingBox, SeverityLevel } from '../types';

interface Color { r: number; g: number; b: number; a: number }

const SEVERITY_COLORS: Record<SeverityLevel, Color> = {
  critical: { r: 239, g: 68,  b: 68,  a: 220 }, // Red
  major:    { r: 249, g: 115, b: 22,  a: 220 }, // Orange
  minor:    { r: 234, g: 179, b: 8,   a: 220 }, // Yellow
  info:     { r: 59,  g: 130, b: 246, a: 220 }, // Blue
};

/**
 * Draw bounding boxes on a screenshot image and return annotated PNG
 */
export async function annotateScreenshot(
  screenshotBuffer: Buffer,
  boundingBoxes: BoundingBox[]
): Promise<Buffer> {
  if (boundingBoxes.length === 0) return screenshotBuffer;

  const meta = await sharp(screenshotBuffer).metadata();
  const imgWidth = meta.width ?? 1440;
  const imgHeight = meta.height ?? 900;

  // Build SVG overlay with all bounding boxes
  const svgElements: string[] = [];

  for (const box of boundingBoxes) {
    const color = SEVERITY_COLORS[box.severity];
    const colorHex = rgbToHex(color.r, color.g, color.b);
    const fillHex = rgbToHex(color.r, color.g, color.b);

    // Clamp to image bounds
    const x = Math.max(0, Math.min(box.x, imgWidth - 1));
    const y = Math.max(0, Math.min(box.y, imgHeight - 1));
    const w = Math.min(box.width, imgWidth - x);
    const h = Math.min(box.height, imgHeight - y);

    const strokeWidth = box.severity === 'critical' ? 3 : box.severity === 'major' ? 2.5 : 2;

    // Rectangle border
    svgElements.push(`
      <rect
        x="${x}" y="${y}" width="${w}" height="${h}"
        fill="none"
        stroke="${colorHex}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${box.source === 'ai' ? 'none' : '8 4'}"
        rx="2"
        opacity="0.9"
      />
    `);

    // Fill tint
    svgElements.push(`
      <rect
        x="${x}" y="${y}" width="${w}" height="${h}"
        fill="${fillHex}"
        opacity="0.06"
      />
    `);

    // Label pill
    const labelText = truncate(box.label, 30);
    const labelWidth = Math.min(labelText.length * 7 + 16, w, 280);
    const labelHeight = 18;
    const labelY = y > labelHeight + 2 ? y - labelHeight - 2 : y + 2;
    const labelX = Math.min(x, imgWidth - labelWidth - 4);

    svgElements.push(`
      <rect
        x="${labelX}" y="${labelY}"
        width="${labelWidth}" height="${labelHeight}"
        fill="${colorHex}" rx="3" opacity="0.92"
      />
      <text
        x="${labelX + 6}" y="${labelY + 13}"
        font-family="monospace" font-size="11"
        fill="white" font-weight="600"
      >${escapeXml(labelText)}</text>
    `);

    // Source indicator (AI = solid, pixel = dashed corner)
    if (box.source === 'ai') {
      svgElements.push(`
        <circle cx="${x + w - 8}" cy="${y + 8}" r="5"
          fill="${colorHex}" opacity="0.9"/>
        <text x="${x + w - 8}" y="${y + 12}"
          font-family="monospace" font-size="8" fill="white"
          text-anchor="middle">AI</text>
      `);
    }
  }

  const svgOverlay = `
    <svg width="${imgWidth}" height="${imgHeight}"
         xmlns="http://www.w3.org/2000/svg">
      ${svgElements.join('\n')}
    </svg>
  `;

  return sharp(screenshotBuffer)
    .composite([{
      input: Buffer.from(svgOverlay),
      top: 0,
      left: 0,
    }])
    .png()
    .toBuffer();
}

/**
 * Create a side-by-side comparison image (design | screenshot | diff)
 */
export async function createComparisonImage(
  designBuffer: Buffer,
  screenshotBuffer: Buffer,
  diffBuffer: Buffer,
  annotatedBuffer: Buffer,
  targetWidth = 1440
): Promise<Buffer> {
  const panelWidth = Math.floor(targetWidth / 2);

  const [resizedDesign, resizedAnnotated] = await Promise.all([
    sharp(designBuffer)
      .resize(panelWidth, undefined, { fit: 'inside' })
      .png()
      .toBuffer(),
    sharp(annotatedBuffer)
      .resize(panelWidth, undefined, { fit: 'inside' })
      .png()
      .toBuffer(),
  ]);

  const designMeta = await sharp(resizedDesign).metadata();
  const maxHeight = Math.max(designMeta.height ?? 900, 900);

  // Combine side by side
  return sharp({
    create: {
      width: panelWidth * 2 + 2, // 2px divider
      height: maxHeight,
      channels: 4,
      background: { r: 30, g: 30, b: 30, alpha: 255 },
    },
  })
    .composite([
      { input: resizedDesign, left: 0, top: 0 },
      { input: Buffer.from([100, 100, 100, 255]), raw: { width: 1, height: maxHeight, channels: 4 }, left: panelWidth, top: 0 },
      { input: resizedAnnotated, left: panelWidth + 2, top: 0 },
    ])
    .png()
    .toBuffer();
}

// ── Helpers ───────────────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
