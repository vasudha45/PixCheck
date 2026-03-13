import sharp from 'sharp';
import { DesignAsset, CapturedScreenshot } from '../types';

export interface NormalizedPair {
  designBuffer: Buffer;
  screenshotBuffer: Buffer;
  width: number;
  height: number;
}

/**
 * Resizes both images to the same dimensions (screenshot dims take precedence
 * since the design is the reference we're comparing against the live implementation).
 * Both outputs are raw RGBA PNG buffers suitable for pixelmatch.
 */
export async function normalizeImages(
  design: DesignAsset,
  screenshot: CapturedScreenshot
): Promise<NormalizedPair> {
  // Use screenshot as the target size (it's the real rendered size)
  const targetWidth = screenshot.width || 1440;
  const targetHeight = screenshot.height || 900;

  const [designBuffer, screenshotBuffer] = await Promise.all([
    sharp(design.imageBuffer)
      .resize(targetWidth, targetHeight, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, a: 255 },
      })
      .ensureAlpha()
      .raw()
      .toBuffer(),

    sharp(screenshot.imageBuffer)
      .resize(targetWidth, targetHeight, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, a: 255 },
      })
      .ensureAlpha()
      .raw()
      .toBuffer(),
  ]);

  return { designBuffer, screenshotBuffer, width: targetWidth, height: targetHeight };
}

/**
 * Convert raw RGBA buffer back to PNG for storage/display
 */
export async function rawToPng(
  rawBuffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  return sharp(rawBuffer, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * Resize a PNG buffer to given dimensions, return PNG
 */
export async function resizePng(
  buffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  return sharp(buffer)
    .resize(width, height, { fit: 'contain', background: { r: 255, g: 255, b: 255, a: 255 } })
    .png()
    .toBuffer();
}
