/**
 * Extracts the dominant *characteristic* colour from an image via canvas
 * sampling, then mutes it into an overlay-friendly tone.
 *
 * Algorithm:
 * 1. Draw image into a tiny canvas (50×50) for speed.
 * 2. Walk every pixel, skipping very dark / very bright / near-grey pixels
 *    so we isolate the most "colourful" region.
 * 3. Quantise into 32-step buckets, pick the most frequent bucket.
 * 4. Average the real pixel values inside that bucket.
 * 5. Desaturate + shift lightness toward a muted mid-tone so the result
 *    works as a translucent overlay and as a solid detail-page background.
 */

import { FALLBACK_OVERLAY_COLOR } from '@/data/projects';

const SAMPLE_SIZE = 50;

/* ── helpers ────────────────────────────────────────────────────────── */

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function toHex(r: number, g: number, b: number): string {
  return (
    '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0')
  );
}

/* ── main ───────────────────────────────────────────────────────────── */

export function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = SAMPLE_SIZE;
      canvas.height = SAMPLE_SIZE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(FALLBACK_OVERLAY_COLOR);
        return;
      }

      ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

      // Bucket map: quantised key → { count, sumR, sumG, sumB }
      const buckets = new Map<
        string,
        { count: number; r: number; g: number; b: number }
      >();

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 128) continue; // skip transparent

        // Compute brightness & saturation to filter uninteresting pixels
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        if (brightness < 25 || brightness > 230) continue; // too dark / bright

        const [, sat] = rgbToHsl(r, g, b);
        if (sat < 0.08) continue; // near-grey — skip

        // Quantise to 32-step buckets
        const qr = Math.round(r / 32) * 32;
        const qg = Math.round(g / 32) * 32;
        const qb = Math.round(b / 32) * 32;
        const key = `${qr},${qg},${qb}`;

        const entry = buckets.get(key);
        if (entry) {
          entry.count++;
          entry.r += r;
          entry.g += g;
          entry.b += b;
        } else {
          buckets.set(key, { count: 1, r, g, b });
        }
      }

      // If nothing survived filtering, fall back to all non-transparent pixels
      if (buckets.size === 0) {
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const qr = Math.round(r / 32) * 32;
          const qg = Math.round(g / 32) * 32;
          const qb = Math.round(b / 32) * 32;
          const key = `${qr},${qg},${qb}`;
          const entry = buckets.get(key);
          if (entry) {
            entry.count++;
            entry.r += r;
            entry.g += g;
            entry.b += b;
          } else {
            buckets.set(key, { count: 1, r, g, b });
          }
        }
      }

      // Pick most frequent bucket
      let best = { count: 0, r: 0x8B, g: 0x83, b: 0x78 }; // FALLBACK_OVERLAY_COLOR in RGB
      for (const entry of buckets.values()) {
        if (entry.count > best.count) best = entry;
      }

      // Average real colours inside that bucket
      const avgR = Math.round(best.r / best.count);
      const avgG = Math.round(best.g / best.count);
      const avgB = Math.round(best.b / best.count);

      // Mute for overlay use: reduce saturation to ~35%, push lightness to ~45%
      const [h, s, l] = rgbToHsl(avgR, avgG, avgB);
      const mutedS = s * 0.45; // keep some colour character
      const mutedL = l * 0.55 + 0.45 * 0.45; // blend toward 0.45
      const [fr, fg, fb] = hslToRgb(h, mutedS, mutedL);

      resolve(toHex(fr, fg, fb));
    };

    img.onerror = () => resolve(FALLBACK_OVERLAY_COLOR); // fallback
    img.src = imageUrl;
  });
}
