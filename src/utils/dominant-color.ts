const NEUTRAL_RGB = { r: 0x8B, g: 0x83, b: 0x78 } as const;

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

interface Bucket {
  count: number;
  r: number;
  g: number;
  b: number;
}

function addToBucket(buckets: Map<string, Bucket>, r: number, g: number, b: number): void {
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

export function dominantColorFromPixels(pixels: Uint8ClampedArray): string {
  const buckets = new Map<string, Bucket>();

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    if (a < 128) continue;

    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    if (brightness < 25 || brightness > 230) continue;

    const [, sat] = rgbToHsl(r, g, b);
    if (sat < 0.08) continue;

    addToBucket(buckets, r, g, b);
  }

  if (buckets.size === 0) {
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 128) continue;
      addToBucket(buckets, pixels[i], pixels[i + 1], pixels[i + 2]);
    }
  }

  let best: Bucket = { count: 0, ...NEUTRAL_RGB };
  for (const entry of buckets.values()) {
    if (entry.count > best.count) best = entry;
  }

  const avgR = best.count === 0 ? best.r : Math.round(best.r / best.count);
  const avgG = best.count === 0 ? best.g : Math.round(best.g / best.count);
  const avgB = best.count === 0 ? best.b : Math.round(best.b / best.count);

  const [h, s, l] = rgbToHsl(avgR, avgG, avgB);
  const mutedS = s * 0.45;
  const mutedL = l * 0.55 + 0.45 * 0.45;
  const [fr, fg, fb] = hslToRgb(h, mutedS, mutedL);

  return toHex(fr, fg, fb);
}
