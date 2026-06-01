/// <reference types="node" />
// Regression guard: in the mobile devotion variants every <PhotoDevelopImage>
// renders with object-cover, so an image whose native aspect ratio is far from
// its slot's aspect-* class gets cropped to a band (a portrait photo jammed
// into a landscape slot, or vice versa). This test resolves each mobile image,
// reads its real pixel dimensions, and asserts the crop factor stays small.
// Pairs with moodboard-assets.test.ts (which guards file existence).
import { describe, it, expect } from 'vitest';
import { readFileSync, openSync, readSync, closeSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const publicDir = path.join(repoRoot, 'public');
const source = readFileSync(
  path.join(repoRoot, 'src/components/sections/MoodBoard.tsx'),
  'utf8',
);
const lines = source.split('\n');

// Tailwind aspect-* class -> width/height ratio used as the slot shape.
const SLOT: Record<string, number> = {
  'aspect-[2/3]': 2 / 3,
  'aspect-[3/4]': 3 / 4,
  'aspect-square': 1,
  'aspect-[4/3]': 4 / 3,
  'aspect-[3/2]': 3 / 2,
  'aspect-video': 16 / 9,
};

// Above this, object-cover discards a visually significant slice of the image.
// Aspect-matched pairings sit at ~1.0–1.2; portrait-in-landscape sits at ~2.0+.
const MAX_CROP = 1.45;

// --- parse the const image maps: const X = { key: '/path.png', ... } ----------
const maps: Record<string, Record<string, string>> = {};
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^const ([A-Za-z0-9_]+) = \{/);
  if (!m) continue;
  const obj: Record<string, string> = {};
  for (let j = i + 1; j < lines.length && !lines[j].startsWith('};'); j++) {
    const kv = lines[j].match(/^\s*([A-Za-z0-9_]+):\s*'([^']+)'/);
    if (kv) obj[kv[1]] = kv[2];
  }
  maps[m[1]] = obj;
}

function resolveSrc(raw: string): string | null {
  const lit = raw.match(/^"([^"]+)"$/);
  if (lit) return lit[1];
  const ref = raw.match(/^\{([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\}$/);
  if (ref && maps[ref[1]]) return maps[ref[1]][ref[2]] ?? null;
  return null; // dynamic / unknown — not statically checkable
}

// --- read pixel dimensions from the file header (PNG + JPEG), no deps ---------
function imageRatio(absPath: string): number | null {
  const fd = openSync(absPath, 'r');
  try {
    const buf = Buffer.alloc(131072);
    const n = readSync(fd, buf, 0, buf.length, 0);
    // PNG: 8-byte sig, IHDR length(4)+type(4), then width(4) @16, height(4) @20
    if (n > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      return w && h ? w / h : null;
    }
    // JPEG: scan for a SOF marker (0xFFC0..0xFFCF, excluding C4/C8/CC)
    if (n > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let off = 2;
      while (off + 9 < n) {
        if (buf[off] !== 0xff) { off++; continue; }
        const marker = buf[off + 1];
        const len = buf.readUInt16BE(off + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          const h = buf.readUInt16BE(off + 5);
          const w = buf.readUInt16BE(off + 7);
          return w && h ? w / h : null;
        }
        off += 2 + len;
      }
    }
    return null;
  } finally {
    closeSync(fd);
  }
}

// --- collect (mobile fn, line, src, slot) tuples ------------------------------
const fns: { name: string; start: number; end: number }[] = [];
lines.forEach((l, i) => {
  const m = l.match(/^function ([A-Za-z0-9_]+)\(/);
  if (m) fns.push({ name: m[1], start: i, end: lines.length });
});
fns.forEach((f, i) => { if (i + 1 < fns.length) f.end = fns[i + 1].start; });

interface Img { fn: string; line: number; path: string; slot: string; }
const mobileImages: Img[] = [];
for (const f of fns) {
  if (!f.name.endsWith('Mobile')) continue;
  for (let i = f.start; i < f.end; i++) {
    if (!lines[i].includes('PhotoDevelopImage')) continue;
    const srcM = lines[i].match(/src=(\{[^}]+\}|"[^"]+")/);
    const clsM = lines[i].match(/className="([^"]+)"/);
    if (!srcM || !clsM) continue;
    const slot = Object.keys(SLOT).find((k) => clsM[1].includes(k));
    const path = resolveSrc(srcM[1]);
    if (!slot || !path) continue; // no fixed aspect or dynamic src — skip
    mobileImages.push({ fn: f.name, line: i + 1, path, slot });
  }
}

describe('MoodBoard mobile image aspect ratios', () => {
  it('found mobile images with fixed-aspect slots (sanity check)', () => {
    expect(mobileImages.length).toBeGreaterThan(50);
  });

  it('no mobile image is severely cropped by its slot (object-cover)', () => {
    const cropped: string[] = [];
    for (const im of mobileImages) {
      const ratio = imageRatio(path.join(publicDir, im.path.replace(/^\//, '')));
      if (ratio == null) continue; // unreadable header — covered by assets test
      const factor = Math.max(SLOT[im.slot] / ratio, ratio / SLOT[im.slot]);
      if (factor > MAX_CROP) {
        cropped.push(
          `${im.fn} L${im.line}: ${im.path.split('/').pop()} (${ratio.toFixed(2)}) in ${im.slot} (${SLOT[im.slot].toFixed(2)}) → crop ×${factor.toFixed(2)}`,
        );
      }
    }
    expect(cropped).toEqual([]);
  });
});
