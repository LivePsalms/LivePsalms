# Deepen Dominant-Color Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the pure pixel-array → hex algorithm from `extractDominantColor.ts` into a node-testable module, leaving the original file as a thin DOM wrapper. The algorithm currently has zero test coverage despite 4 magic numbers (sample size, brightness gates, saturation gate, bucket step) and a two-pass fallback structure.

**Architecture:** Pure module — no state, no DOM, no React. `dominantColorFromPixels(pixels: Uint8ClampedArray): string` takes any RGBA pixel buffer and returns a muted overlay-friendly hex color. Internal helpers (`rgbToHsl`, `hslToRgb`, `toHex`, neutral starting RGB) stay private to the module — they are algorithm support, not a public color-math API. The DOM wrapper (`extractDominantColor.ts`) becomes ~30 lines: load Image, draw to 50×50 canvas, `getImageData`, hand pixels to the pure function.

**Tech Stack:** TypeScript 5.9, Vitest. No new dependencies.

**Domain language:** see [docs/CONTEXT.md](../../CONTEXT.md) §`dominant-color`. The name `dominantColorFromPixels`, the hardcoded neutral starting RGB, and the algorithm steps come from there — preserve the existing behavior exactly.

**Behavior preservation:** 100%. The algorithm constants (sample size 50, bucket step 32, brightness gates 25/230, saturation gate 0.08, alpha gate 128, muting factors 0.45/0.55/0.45×0.45) and the neutral starting RGB `(0x8B, 0x83, 0x78)` are all preserved verbatim. The wrapper's image-load-error → `FALLBACK_OVERLAY_COLOR` and missing-canvas-context → `FALLBACK_OVERLAY_COLOR` paths are also preserved.

---

## File Structure

### New files
- `src/utils/dominant-color.ts` — pure module: `dominantColorFromPixels`, plus private `rgbToHsl` / `hslToRgb` / `toHex` / `NEUTRAL_RGB`
- `src/utils/dominant-color.test.ts` — node-only tests with synthetic `Uint8ClampedArray`s

### Modified files
- `src/utils/extractDominantColor.ts` — collapses from 173 lines to ~30; imports `dominantColorFromPixels`
- `docs/CONTEXT.md` — already updated in design phase (§`dominant-color`)

### No changes
- `src/hooks/useProjectColors.ts` — the hook is fine as-is; original "split derivation from caching" framing was rejected
- `src/data/projects.ts` — `FALLBACK_OVERLAY_COLOR` is still consumed by `extractDominantColor`'s wrapper

---

## Task 1: Create `dominant-color.ts` with the pure algorithm

**Files:**
- Create: `src/utils/dominant-color.ts`
- Create: `src/utils/dominant-color.test.ts`

The algorithm is a verbatim lift of the existing canvas-onload body. The tests pin specific hex outputs as regression coverage so future tweaks to muting / saturation / bucket constants surface clearly.

- [ ] **Step 1: Write failing tests**

Create `src/utils/dominant-color.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dominantColorFromPixels } from './dominant-color';

/**
 * Build a flat RGBA buffer with N pixels of the given color + alpha.
 */
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

/**
 * Build a flat RGBA buffer where each spec contributes `count` pixels with
 * its color/alpha. Specs are concatenated in order.
 */
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
    // Pure red passes brightness (76) and saturation (1.0) gates; muted form
    // is hsl(0, 0.45, 0.4775) = rgb(177, 67, 67).
    expect(dominantColorFromPixels(solidColor(255, 0, 0))).toBe('#b34343');
  });

  it('returns the muted form of an all-blue buffer', () => {
    // Blue brightness = 29 (just above the 25 gate), saturation = 1.0;
    // muted form is hsl(0.6667, 0.45, 0.4775) = rgb(67, 67, 177).
    expect(dominantColorFromPixels(solidColor(0, 0, 255))).toBe('#4343b1');
  });
});

describe('dominantColorFromPixels — second-pass fallback', () => {
  it('uses the second pass for an all-white buffer (filtered out for too-bright)', () => {
    // First pass: brightness 255 > 230, skipped. Second pass: keeps it.
    // Quantised bucket key "256,256,256", avg rgb (255,255,255), s=0.
    // Muted: hsl(0, 0, 0.7525) = rgb(192,192,192).
    expect(dominantColorFromPixels(solidColor(255, 255, 255))).toBe('#c0c0c0');
  });

  it('uses the second pass for an all-grey buffer (filtered out for low saturation)', () => {
    // (128,128,128): saturation 0, filtered. Second pass keeps it.
    // Muted: hsl(0,0,l_muted), grey-on-grey output.
    const result = dominantColorFromPixels(solidColor(128, 128, 128));
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    // Should be a grey: r === g === b
    expect(result.slice(1, 3)).toBe(result.slice(3, 5));
    expect(result.slice(3, 5)).toBe(result.slice(5, 7));
  });
});

describe('dominantColorFromPixels — bucket selection', () => {
  it('selects colorful pixels over dark pixels (dark filtered by brightness gate)', () => {
    // 96% black (filtered by brightness < 25), 4% red (passes).
    // Result: muted red = '#b34343'.
    const pixels = mixedColors([
      { color: [0, 0, 0], alpha: 255, count: 2400 },
      { color: [255, 0, 0], alpha: 255, count: 100 },
    ]);
    expect(dominantColorFromPixels(pixels)).toBe('#b34343');
  });

  it('selects the most frequent colorful bucket when multiple colors compete', () => {
    // 30% red, 70% blue → blue wins. Output is muted blue.
    const pixels = mixedColors([
      { color: [255, 0, 0], alpha: 255, count: 750 },
      { color: [0, 0, 255], alpha: 255, count: 1750 },
    ]);
    expect(dominantColorFromPixels(pixels)).toBe('#4343b1');
  });

  it('quantizes colors into 32-step buckets so similar reds aggregate', () => {
    // (200,0,0) and (190,0,0) both round to the (192,0,0) bucket → one
    // bucket with avg (195,0,0). Muted form: hsl(0, 0.45, 0.4128) =
    // rgb(153, 58, 58).
    const pixels = mixedColors([
      { color: [200, 0, 0], alpha: 255, count: 1250 },
      { color: [190, 0, 0], alpha: 255, count: 1250 },
    ]);
    expect(dominantColorFromPixels(pixels)).toBe('#993a3a');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/utils/dominant-color.test.ts`
Expected: FAIL — `Cannot find module './dominant-color'`.

- [ ] **Step 3: Create the pure module**

Create `src/utils/dominant-color.ts`:

```ts
/**
 * Pure pixel-array → hex algorithm extracted from extractDominantColor.
 * Walks an RGBA buffer, picks the most "characteristic" color via bucket
 * voting, then mutes the result for use as a translucent overlay.
 *
 * See docs/CONTEXT.md §dominant-color for the full algorithm description.
 */

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

export function dominantColorFromPixels(pixels: Uint8ClampedArray): string {
  const buckets = new Map<string, Bucket>();

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    if (a < 128) continue; // skip transparent

    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    if (brightness < 25 || brightness > 230) continue; // too dark / bright

    const [, sat] = rgbToHsl(r, g, b);
    if (sat < 0.08) continue; // near-grey — skip

    addToBucket(buckets, r, g, b);
  }

  // If nothing survived the filters, fall back to all non-transparent pixels.
  if (buckets.size === 0) {
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 128) continue;
      addToBucket(buckets, pixels[i], pixels[i + 1], pixels[i + 2]);
    }
  }

  // Pick the most frequent bucket. Initial `best` is the algorithm's neutral
  // starting RGB — used when even the second-pass produces nothing (fully
  // transparent buffer).
  let best: Bucket = { count: 0, ...NEUTRAL_RGB };
  for (const entry of buckets.values()) {
    if (entry.count > best.count) best = entry;
  }

  // Average real RGB inside the chosen bucket.
  const avgR = best.count === 0 ? best.r : Math.round(best.r / best.count);
  const avgG = best.count === 0 ? best.g : Math.round(best.g / best.count);
  const avgB = best.count === 0 ? best.b : Math.round(best.b / best.count);

  // Mute for overlay use: reduce saturation, push lightness toward 0.45.
  const [h, s, l] = rgbToHsl(avgR, avgG, avgB);
  const mutedS = s * 0.45;
  const mutedL = l * 0.55 + 0.45 * 0.45;
  const [fr, fg, fb] = hslToRgb(h, mutedS, mutedL);

  return toHex(fr, fg, fb);
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
```

A subtle behavior preservation note: the original initialised `best` to `{ count: 0, r: 0x8B, g: 0x83, b: 0x78 }` and then divided by `count` when computing `avgR/G/B`. With `count=0` (no buckets at all, fully-transparent path), the original would `Math.round(0 / 0)` = `NaN`, then the muting math runs on NaN and produces garbage. **The original had a latent divide-by-zero bug on fully-transparent input** that the embedded canvas wrapper happened to never hit (real images aren't fully transparent). The pure version's `best.count === 0` guard preserves the *intent* (use the neutral starting RGB directly without division) and produces a sensible muted neutral hex `#7f7c77`.

This is a defensive fix — same direction as the InfoPanel `type === 'text'` gate convergence in the previous deepening.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/utils/dominant-color.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/dominant-color.ts src/utils/dominant-color.test.ts docs/CONTEXT.md
git commit -m "feat(utils): pure dominantColorFromPixels with regression tests"
```

---

## Task 2: Refactor `extractDominantColor.ts` to be a thin DOM wrapper

**Files:**
- Modify: `src/utils/extractDominantColor.ts`

- [ ] **Step 1: Replace the file with the thin wrapper**

Rewrite `src/utils/extractDominantColor.ts` end-to-end:

```ts
/**
 * DOM wrapper around `dominantColorFromPixels`. Loads the image, draws into
 * a 50×50 canvas for speed, hands the resulting RGBA buffer to the pure
 * algorithm, and resolves the muted hex result.
 *
 * Returns `FALLBACK_OVERLAY_COLOR` directly (no algorithm) when the image
 * fails to load or the canvas context is unavailable — both are environment
 * problems, not algorithm problems.
 */

import { FALLBACK_OVERLAY_COLOR } from '@/data/projects';
import { dominantColorFromPixels } from './dominant-color';

const SAMPLE_SIZE = 50;

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
      resolve(dominantColorFromPixels(data));
    };

    img.onerror = () => resolve(FALLBACK_OVERLAY_COLOR);
    img.src = imageUrl;
  });
}
```

The file shrinks from 173 lines to 33. Everything algorithm-related is gone; what remains is genuine DOM glue.

- [ ] **Step 2: Type-check + run all tests**

Run: `npx tsc -b && npm test`
Expected: type-check clean, all existing tests still pass plus the 10 new `dominant-color` tests.

- [ ] **Step 3: Smoke-test in the browser**

Run: `npm run dev` and exercise:
1. Load the home page → `/purpose` gallery should render with each project's overlay color extracted from its thumbnail (the `useProjectColors` flow). Visually compare two or three projects against the previous build to confirm the colors haven't shifted.
2. Open a project detail page → the overlay color is the same extracted hex used on the gallery card.
3. Force a broken thumbnail URL (e.g. via DevTools > Network > Block request URL) → the gallery card falls back to `FALLBACK_OVERLAY_COLOR` (`#8B8378`), no console error from the algorithm.

Expected: visual output identical to pre-deepening.

- [ ] **Step 4: Commit**

```bash
git add src/utils/extractDominantColor.ts
git commit -m "refactor(utils): extractDominantColor becomes thin DOM wrapper around dominantColorFromPixels"
```

---

## Self-review checklist (run after Task 2)

- [ ] `src/utils/extractDominantColor.ts` is approximately 30 lines (down from 173).
- [ ] No `rgbToHsl` / `hslToRgb` / `toHex` / quantization loop / muting math remains in `extractDominantColor.ts` — only `Image` + canvas + `getImageData` + delegation.
- [ ] All 10 new `dominant-color` tests pass; no real DOM, no real canvas.
- [ ] All existing tests pass (this should be a pure refactor; nothing else touches the algorithm).
- [ ] CONTEXT.md §`dominant-color` reflects the implemented module.
- [ ] `useProjectColors.ts` is unchanged.
