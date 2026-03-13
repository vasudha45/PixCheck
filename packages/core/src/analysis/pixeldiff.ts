import pixelmatch from 'pixelmatch';
import sharp from 'sharp';
import { PixelDiffResult, BoundingBox } from '../types';
import { NormalizedPair, rawToPng } from './normalizer';

interface Region {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Run pixel-level comparison between design and screenshot.
 * Returns diff image with highlighted mismatches and statistics.
 */
export async function runPixelDiff(pair: NormalizedPair): Promise<PixelDiffResult> {
  const { designBuffer, screenshotBuffer, width, height } = pair;

  // Output buffer for diff visualization
  const diffBuffer = Buffer.alloc(width * height * 4);

  const mismatchPixels = pixelmatch(
    designBuffer,
    screenshotBuffer,
    diffBuffer,
    width,
    height,
    {
      threshold: 0.1,           // Sensitivity (0 = strict, 1 = lenient)
      includeAA: false,         // Ignore anti-aliasing differences
      diffColor: [255, 50, 50], // Red for mismatches
      diffColorAlt: [0, 100, 255], // Blue for inverted mismatches
    }
  );

  const totalPixels = width * height;
  const mismatchPercent = (mismatchPixels / totalPixels) * 100;

  // Compute SSIM via structural similarity
  const ssimScore = computeSSIM(designBuffer, screenshotBuffer, width, height);

  // Convert raw diff buffer back to PNG
  const diffImageBuffer = await rawToPng(diffBuffer, width, height);

  return {
    mismatchPixels,
    mismatchPercent,
    ssimScore,
    diffImageBuffer,
    totalPixels,
  };
}

/**
 * Extract bounding boxes of mismatch regions by finding connected components
 * in the diff image.
 */
export async function extractMismatchRegions(
  diffImageBuffer: Buffer,
  width: number,
  height: number,
  minRegionSize = 100 // Ignore tiny specks
): Promise<BoundingBox[]> {
  // Get raw pixel data from diff PNG
  const raw = await sharp(diffImageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer();

  // Build a boolean mismatch mask (red pixels = mismatch)
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = raw[i * 4];
    const g = raw[i * 4 + 1];
    const b = raw[i * 4 + 2];
    // Red-dominant pixels are diffs
    if (r > 200 && g < 100 && b < 100) {
      mask[i] = 1;
    }
  }

  // Simple connected-component analysis — flood fill to find regions
  const visited = new Uint8Array(width * height);
  const regions: Region[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] && !visited[idx]) {
        const region = floodFill(mask, visited, x, y, width, height);
        const area = (region.maxX - region.minX) * (region.maxY - region.minY);
        if (area >= minRegionSize) {
          regions.push(region);
        }
      }
    }
  }

  // Merge overlapping regions with some padding
  const merged = mergeRegions(regions, 20);

  return merged.map((r, i) => ({
    x: Math.max(0, r.minX - 4),
    y: Math.max(0, r.minY - 4),
    width: Math.min(width, r.maxX - r.minX + 8),
    height: Math.min(height, r.maxY - r.minY + 8),
    label: `Pixel diff region ${i + 1}`,
    severity: getSeverity((r.maxX - r.minX) * (r.maxY - r.minY), width * height),
    source: 'pixel' as const,
  }));
}

function floodFill(
  mask: Uint8Array,
  visited: Uint8Array,
  startX: number,
  startY: number,
  width: number,
  height: number
): Region {
  const stack: [number, number][] = [[startX, startY]];
  let minX = startX, minY = startY, maxX = startX, maxY = startY;

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const idx = y * width + x;

    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited[idx] || !mask[idx]) continue;

    visited[idx] = 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return { minX, minY, maxX, maxY };
}

function mergeRegions(regions: Region[], padding: number): Region[] {
  if (regions.length === 0) return [];

  let merged = [...regions];
  let changed = true;

  while (changed) {
    changed = false;
    const next: Region[] = [];

    for (const r of merged) {
      let didMerge = false;
      for (const existing of next) {
        if (overlaps(r, existing, padding)) {
          existing.minX = Math.min(existing.minX, r.minX);
          existing.minY = Math.min(existing.minY, r.minY);
          existing.maxX = Math.max(existing.maxX, r.maxX);
          existing.maxY = Math.max(existing.maxY, r.maxY);
          didMerge = true;
          changed = true;
          break;
        }
      }
      if (!didMerge) next.push({ ...r });
    }

    merged = next;
  }

  return merged;
}

function overlaps(a: Region, b: Region, pad: number): boolean {
  return (
    a.minX - pad < b.maxX &&
    a.maxX + pad > b.minX &&
    a.minY - pad < b.maxY &&
    a.maxY + pad > b.minY
  );
}

function getSeverity(regionArea: number, totalArea: number): 'critical' | 'major' | 'minor' | 'info' {
  const pct = (regionArea / totalArea) * 100;
  if (pct > 15) return 'critical';
  if (pct > 5) return 'major';
  if (pct > 1) return 'minor';
  return 'info';
}

/**
 * Simple SSIM approximation using luminance correlation
 */
function computeSSIM(
  buf1: Buffer,
  buf2: Buffer,
  width: number,
  height: number
): number {
  const n = width * height;
  let sum1 = 0, sum2 = 0, sum1sq = 0, sum2sq = 0, sum12 = 0;

  for (let i = 0; i < n; i++) {
    const p = i * 4;
    // Luminance from RGBA
    const l1 = (0.299 * buf1[p] + 0.587 * buf1[p + 1] + 0.114 * buf1[p + 2]) / 255;
    const l2 = (0.299 * buf2[p] + 0.587 * buf2[p + 1] + 0.114 * buf2[p + 2]) / 255;
    sum1 += l1;
    sum2 += l2;
    sum1sq += l1 * l1;
    sum2sq += l2 * l2;
    sum12 += l1 * l2;
  }

  const mu1 = sum1 / n;
  const mu2 = sum2 / n;
  const sigma1sq = sum1sq / n - mu1 * mu1;
  const sigma2sq = sum2sq / n - mu2 * mu2;
  const sigma12 = sum12 / n - mu1 * mu2;

  const C1 = 0.01 ** 2;
  const C2 = 0.03 ** 2;

  return (
    ((2 * mu1 * mu2 + C1) * (2 * sigma12 + C2)) /
    ((mu1 ** 2 + mu2 ** 2 + C1) * (sigma1sq + sigma2sq + C2))
  );
}
