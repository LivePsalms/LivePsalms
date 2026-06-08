// src/notepad/decorations/decoration-geometry.test.ts
import { describe, it, expect } from 'vitest';
import {
  moveTo, resizeWidthPct, rotationDeg, clampDecoration, pinchTransform,
  decorationZIndex, pointerAngleDeg, applyRotationDrag, TEXT_Z, SELECTED_Z,
  decorationBox, pointInBox, topmostBehindAtPoint,
  resolveYPct, isLegacyDecoration, migrateLegacyDecoration,
} from './decoration-geometry';
import type { NoteDecoration } from '../types';

const d: NoteDecoration = {
  id: 'a', assetId: 'arrow-01', xPct: 0.5, yPct: 0.1, widthPct: 0.2, rotation: 0, z: 1,
};

describe('moveTo', () => {
  it('converts a pixel delta to a normalized x and y (fraction of width)', () => {
    // content width 1000px: +100px → +0.1 xPct; +30px → +0.03 yPct.
    expect(moveTo(d, { dxPx: 100, dyPx: 30, contentWidth: 1000 }))
      .toMatchObject({ xPct: expect.closeTo(0.6, 5), yPct: expect.closeTo(0.13, 5) });
  });

  it('ignores both deltas when contentWidth is 0', () => {
    expect(moveTo(d, { dxPx: 100, dyPx: 30, contentWidth: 0 }))
      .toMatchObject({ xPct: 0.5, yPct: 0.1 });
  });
});

describe('resizeWidthPct', () => {
  it('grows width from a pixel delta and clamps to [0.03, 1]', () => {
    expect(resizeWidthPct(d, { dxPx: 100, contentWidth: 1000 }).widthPct).toBeCloseTo(0.3);
    expect(resizeWidthPct({ ...d, widthPct: 0.98 }, { dxPx: 1000, contentWidth: 1000 }).widthPct).toBe(1);
    expect(resizeWidthPct({ ...d, widthPct: 0.05 }, { dxPx: -1000, contentWidth: 1000 }).widthPct).toBe(0.03);
  });

  it('leaves width unchanged when contentWidth is 0', () => {
    expect(resizeWidthPct(d, { dxPx: 100, contentWidth: 0 }).widthPct).toBe(0.2);
  });
});

describe('rotationDeg', () => {
  it('normalizes an angle into [0, 360)', () => {
    expect(rotationDeg(370)).toBe(10);
    expect(rotationDeg(-10)).toBe(350);
  });
});

describe('clampDecoration', () => {
  it('keeps xPct within [0, 1] and yPct non-negative', () => {
    expect(clampDecoration({ ...d, xPct: 1.5, yPct: -0.02 })).toMatchObject({ xPct: 1, yPct: 0 });
    expect(clampDecoration({ ...d, xPct: -0.2 }).xPct).toBe(0);
  });
});

describe('pinchTransform', () => {
  const base: NoteDecoration = {
    id: 'a', assetId: 'arrow-01', xPct: 0.5, yPct: 0.1, widthPct: 0.2, rotation: 0, z: 1,
  };

  it('scales width by the distance ratio and clamps', () => {
    const out = pinchTransform(base, { startDist: 100, dist: 200, startAngle: 0, angle: 0 });
    expect(out.widthPct).toBeCloseTo(0.4); // 0.2 * 2
  });

  it('adds the angle delta to rotation, normalized', () => {
    const out = pinchTransform(base, { startDist: 100, dist: 100, startAngle: 350, angle: 20 });
    expect(out.rotation).toBe(30); // 0 + (20 - 350) = -330 → 30
  });

  it('ignores a zero start distance (no NaN)', () => {
    const out = pinchTransform(base, { startDist: 0, dist: 50, startAngle: 0, angle: 0 });
    expect(out.widthPct).toBe(base.widthPct);
  });
});

describe('decorationZIndex', () => {
  const base: NoteDecoration = {
    id: 'a', assetId: 'arrow-01', xPct: 0.5, yPct: 0.1, widthPct: 0.2, rotation: 0, z: 5,
  };

  it('returns SELECTED_Z when selected, regardless of behindText', () => {
    expect(decorationZIndex(base, true)).toBe(SELECTED_Z);
    expect(decorationZIndex({ ...base, behindText: true }, true)).toBe(SELECTED_Z);
  });

  it('returns d.z when behindText (sits below text)', () => {
    expect(decorationZIndex({ ...base, behindText: true }, false)).toBe(5);
  });

  it('returns TEXT_Z + d.z by default (sits above text)', () => {
    expect(decorationZIndex(base, false)).toBe(TEXT_Z + 5);
    expect(decorationZIndex({ ...base, behindText: false }, false)).toBe(TEXT_Z + 5);
  });
});

describe('pointerAngleDeg', () => {
  it('returns 0 for a point to the right of center', () => {
    expect(pointerAngleDeg({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
  });

  it('returns 90 for a point below center', () => {
    expect(pointerAngleDeg({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(90);
  });

  it('returns 180 for a point to the left of center', () => {
    expect(pointerAngleDeg({ x: 0, y: 0 }, { x: -1, y: 0 })).toBe(180);
  });
});

describe('applyRotationDrag', () => {
  it('adds the angle delta to the start rotation', () => {
    expect(applyRotationDrag(10, 0, 30)).toBe(40);
  });

  it('normalizes the result via rotationDeg', () => {
    expect(applyRotationDrag(350, 0, 30)).toBe(20); // 350 + 30 = 380 → 20
    expect(applyRotationDrag(0, 30, 0)).toBe(330); // 0 + (0 - 30) = -30 → 330
  });
});

describe('decorationBox', () => {
  it('computes px bounds from the frozen reference width and aspect ratio (w/h)', () => {
    // refWidth 1000, widthPct 0.2 → 200px wide; aspectRatio 2 (w/h) → 100px tall.
    expect(decorationBox(d, 1000, 2)).toEqual({ left: 500, top: 100, width: 200, height: 100 });
  });

  it('falls back to a square when aspectRatio is non-positive', () => {
    expect(decorationBox(d, 1000, 0)).toEqual({ left: 500, top: 100, width: 200, height: 200 });
  });
});

describe('pointInBox', () => {
  const box = { left: 500, top: 100, width: 200, height: 100 };
  it('is true inside and on the edges, false outside', () => {
    expect(pointInBox(550, 150, box)).toBe(true);
    expect(pointInBox(500, 100, box)).toBe(true); // top-left corner
    expect(pointInBox(700, 200, box)).toBe(true); // bottom-right corner
    expect(pointInBox(499, 150, box)).toBe(false);
    expect(pointInBox(550, 201, box)).toBe(false);
  });
});

describe('topmostBehindAtPoint', () => {
  const ar = () => 2; // every asset is 2:1
  const back: NoteDecoration = { id: 'back', assetId: 'x', xPct: 0.5, yPct: 0.1, widthPct: 0.2, rotation: 0, z: 1, behindText: true };
  const front: NoteDecoration = { id: 'front', assetId: 'x', xPct: 0.5, yPct: 0.1, widthPct: 0.2, rotation: 0, z: 1 };

  it('returns the id of a behind-text decoration under the point', () => {
    expect(topmostBehindAtPoint([back], 550, 150, 1000, ar)).toBe('back');
  });

  it('ignores decorations that are NOT behind text (they are reachable directly)', () => {
    expect(topmostBehindAtPoint([front], 550, 150, 1000, ar)).toBeNull();
  });

  it('returns null when the point misses every behind decoration', () => {
    expect(topmostBehindAtPoint([back], 0, 0, 1000, ar)).toBeNull();
  });

  it('picks the highest-z behind decoration when several overlap', () => {
    const lo = { ...back, id: 'lo', z: 1 };
    const hi = { ...back, id: 'hi', z: 5 };
    expect(topmostBehindAtPoint([lo, hi], 550, 150, 1000, ar)).toBe('hi');
  });
});

describe('resolveYPct', () => {
  const legacy = { id: 'l', assetId: 'x', xPct: 0.5, yPx: 300, widthPct: 0.2, rotation: 0, z: 1 } as unknown as NoteDecoration;

  it('returns yPct directly when present', () => {
    expect(resolveYPct({ ...d, yPct: 0.25 }, 1000)).toBe(0.25);
  });
  it('derives yPct from legacy yPx and width when yPct is absent', () => {
    expect(resolveYPct(legacy, 1000)).toBe(0.3);
  });
  it('is 0 when width is 0', () => {
    expect(resolveYPct(legacy, 0)).toBe(0);
  });
});

describe('isLegacyDecoration', () => {
  const legacy = { id: 'l', assetId: 'x', xPct: 0.5, yPx: 300, widthPct: 0.2, rotation: 0, z: 1 } as unknown as NoteDecoration;

  it('is true when yPct is missing', () => {
    expect(isLegacyDecoration(legacy)).toBe(true);
  });
  it('is true when a lingering yPx remains even with yPct present', () => {
    expect(isLegacyDecoration({ ...d, yPct: 0.1, yPx: 50 })).toBe(true);
  });
  it('is false for a clean migrated decoration', () => {
    expect(isLegacyDecoration({ ...d, yPct: 0.1 })).toBe(false);
  });
});

describe('migrateLegacyDecoration', () => {
  const legacy = { id: 'l', assetId: 'x', xPct: 0.5, yPx: 300, widthPct: 0.2, rotation: 0, z: 1 } as unknown as NoteDecoration;

  it('converts legacy yPx to yPct by width and drops yPx', () => {
    const out = migrateLegacyDecoration(legacy, 1000);
    expect(out.yPct).toBe(0.3);
    expect((out as { yPx?: number }).yPx).toBeUndefined();
  });
  it('leaves an already-migrated decoration unchanged and yPx-free', () => {
    const out = migrateLegacyDecoration({ ...d, yPct: 0.4 }, 1000);
    expect(out.yPct).toBe(0.4);
    expect((out as { yPx?: number }).yPx).toBeUndefined();
  });
});
