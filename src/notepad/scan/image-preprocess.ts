//
// Cheap, dependency-free image cleanup before OCR upload. Pure helpers
// (targetDimensions, grayscaleContrastInPlace) are unit-tested; preprocessImage
// orchestrates them on a canvas and lazily runs the heavy deskew pass.

const LONG_EDGE_CAP = 1500;
const JPEG_QUALITY = 0.85;

export interface Dimensions { width: number; height: number }

/** Scale so the long edge ≤ cap, preserving aspect ratio. No upscaling. */
export function targetDimensions(w: number, h: number, cap = LONG_EDGE_CAP): Dimensions {
  const long = Math.max(w, h);
  if (long <= cap) return { width: w, height: h };
  const scale = cap / long;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/**
 * Convert RGBA pixel data to grayscale (luminance) and stretch contrast so the
 * darkest luminance maps to 0 and the brightest to 255. Mutates in place;
 * alpha is preserved. Two-pass: find min/max luminance, then map.
 */
export function grayscaleContrastInPlace(data: Uint8ClampedArray): void {
  let min = 255, max = 0;
  const lum = new Uint8ClampedArray(data.length / 4);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const y = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    lum[p] = y;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  const range = max - min || 1;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const stretched = Math.round(((lum[p] - min) / range) * 255);
    data[i] = data[i + 1] = data[i + 2] = stretched;
  }
}

/**
 * Full pipeline: decode → downscale → grayscale+contrast → (lazy) deskew →
 * JPEG Blob. Smoke-tested via the capture UI (canvas + WASM, not unit-tested).
 */
export async function preprocessImage(input: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(input);
  const { width, height } = targetDimensions(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  grayscaleContrastInPlace(imgData.data);
  ctx.putImageData(imgData, 0, 0);

  // Heavy deskew is loaded only here, only when an image is actually processed.
  try {
    const { deskewCanvas } = await import('./deskew');
    await deskewCanvas(canvas);
  } catch {
    // no-op: if deskew fails or finds no page quad, keep the contrast-only image
  }

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b ?? input), 'image/jpeg', JPEG_QUALITY),
  );
}
