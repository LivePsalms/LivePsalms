import { describe, it, expect } from 'vitest';
import { dominantColorFromPixels } from './dominant-color';

function solidColor(
  r: number,
  g: number,
  b: number,
  alpha = 255,
  pixelCount = 50 * 50,
): Uint8ClampedArray {
  const arr = new Uint8ClampedArray(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    arr[i * 4] = r;
    arr[i * 4 + 1] = g;
    arr[i * 4 + 2] = b;
    arr[i * 4 + 3] = alpha;
  }
  return arr;
}

function mixedColors(
  specs: Array<{ color: [number, number, number]; alpha?: number; count: number }>,
): Uint8ClampedArray {
  const total = specs.reduce((n, s) => n + s.count, 0);
  const arr = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const spec of specs) {
    for (let k = 0; k < spec.count; k++) {
      arr[i * 4] = spec.color[0];
      arr[i * 4 + 1] = spec.color[1];
      arr[i * 4 + 2] = spec.color[2];
      arr[i * 4 + 3] = spec.alpha ?? 255;
      i++;
    }
  }
  return arr;
}

describe('dominantColorFromPixels — fallback paths', () => {
  it('returns the muted neutral when the buffer is empty', () => {
    expect(dominantColorFromPixels(new Uint8ClampedArray(0))).toBe('#7f7c77');
  });

  it('returns the muted neutral when every pixel is fully transparent', () => {
    const pixels = solidColor(255, 0, 0, 0);
    expect(dominantColorFromPixels(pixels)).toBe('#7f7c77');
  });

  it('always returns a 7-character hex string starting with #', () => {
    const result = dominantColorFromPixels(solidColor(123, 45, 67));
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('dominantColorFromPixels — single-color buffers', () => {
  it('returns the muted form of an all-red buffer', () => {
    expect(dominantColorFromPixels(solidColor(255, 0, 0))).toBe('#b14343');
  });

  it('returns the muted form of an all-blue buffer', () => {
    expect(dominantColorFromPixels(solidColor(0, 0, 255))).toBe('#4343b1');
  });
});

describe('dominantColorFromPixels — second-pass fallback', () => {
  it('uses the second pass for an all-white buffer (filtered out for too-bright)', () => {
    expect(dominantColorFromPixels(solidColor(255, 255, 255))).toBe('#c0c0c0');
  });

  it('uses the second pass for an all-grey buffer (filtered out for low saturation)', () => {
    const result = dominantColorFromPixels(solidColor(128, 128, 128));
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    expect(result.slice(1, 3)).toBe(result.slice(3, 5));
    expect(result.slice(3, 5)).toBe(result.slice(5, 7));
  });
});

describe('dominantColorFromPixels — bucket selection', () => {
  it('selects colorful pixels over dark pixels (dark filtered by brightness gate)', () => {
    const pixels = mixedColors([
      { color: [0, 0, 0], alpha: 255, count: 2400 },
      { color: [255, 0, 0], alpha: 255, count: 100 },
    ]);
    expect(dominantColorFromPixels(pixels)).toBe('#b14343');
  });

  it('selects the most frequent colorful bucket when multiple colors compete', () => {
    const pixels = mixedColors([
      { color: [255, 0, 0], alpha: 255, count: 750 },
      { color: [0, 0, 255], alpha: 255, count: 1750 },
    ]);
    expect(dominantColorFromPixels(pixels)).toBe('#4343b1');
  });

  it('quantizes colors into 32-step buckets so similar reds aggregate', () => {
    const pixels = mixedColors([
      { color: [200, 0, 0], alpha: 255, count: 1250 },
      { color: [190, 0, 0], alpha: 255, count: 1250 },
    ]);
    expect(dominantColorFromPixels(pixels)).toBe('#993a3a');
  });
});
