// Regression guard: in the mobile devotion variants every <PhotoDevelopImage>
// renders with object-cover, so an image whose native aspect ratio is far from
// its slot's aspect-* class gets cropped to a band (a portrait photo jammed
// into a landscape slot, or vice versa). This test walks the data-driven
// moodboards, resolves each mobile image, reads its real pixel dimensions, and
// asserts the crop factor stays small. Pairs with moodboard-assets.test.ts
// (which guards file existence).
import { describe, it, expect } from 'vitest';
import { openSync, readSync, closeSync } from 'node:fs';
import path from 'node:path';
import { moodBoards, collectMobileImageSlots } from '@/data/devotion-moodboards';

const repoRoot = process.cwd();
const publicDir = path.join(repoRoot, 'public');

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

// --- collect (where, src, slot) tuples for every fixed-aspect mobile image -----
interface Img { where: string; src: string; slot: string; }
const mobileImages: Img[] = [];
for (const board of Object.values(moodBoards)) {
  for (const { where, src, aspectClass } of collectMobileImageSlots(board)) {
    if (!aspectClass || !(aspectClass in SLOT)) continue; // no fixed aspect — skip
    mobileImages.push({ where, src, slot: aspectClass });
  }
}

describe('MoodBoard mobile image aspect ratios', () => {
  it('found mobile images with fixed-aspect slots (sanity check)', () => {
    expect(mobileImages.length).toBeGreaterThan(50);
  });

  it('no mobile image is severely cropped by its slot (object-cover)', () => {
    const cropped: string[] = [];
    for (const im of mobileImages) {
      const ratio = imageRatio(path.join(publicDir, im.src.replace(/^\//, '')));
      if (ratio == null) continue; // unreadable header — covered by assets test
      const factor = Math.max(SLOT[im.slot] / ratio, ratio / SLOT[im.slot]);
      if (factor > MAX_CROP) {
        cropped.push(
          `${im.where}: ${im.src.split('/').pop()} (${ratio.toFixed(2)}) in ${im.slot} (${SLOT[im.slot].toFixed(2)}) → crop ×${factor.toFixed(2)}`,
        );
      }
    }
    expect(cropped).toEqual([]);
  });
});
