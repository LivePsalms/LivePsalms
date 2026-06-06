// src/notepad/decorations/decoration-geometry.test.ts
import { describe, it, expect } from 'vitest';
import {
  moveTo, resizeWidthPct, rotationDeg, clampDecoration,
} from './decoration-geometry';
import type { NoteDecoration } from '../types';

const d: NoteDecoration = {
  id: 'a', assetId: 'arrow-01', xPct: 0.5, yPx: 100, widthPct: 0.2, rotation: 0, z: 1,
};

describe('moveTo', () => {
  it('converts a pixel delta to a normalized x and absolute y', () => {
    // content width 1000px: +100px x → +0.1 xPct; +30px y.
    expect(moveTo(d, { dxPx: 100, dyPx: 30, contentWidth: 1000 }))
      .toMatchObject({ xPct: 0.6, yPx: 130 });
  });

  it('ignores horizontal delta when contentWidth is 0 but still moves vertically', () => {
    expect(moveTo(d, { dxPx: 100, dyPx: 30, contentWidth: 0 }))
      .toMatchObject({ xPct: 0.5, yPx: 130 });
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
  it('keeps xPct within [0, 1] and yPx non-negative', () => {
    expect(clampDecoration({ ...d, xPct: 1.5, yPx: -20 })).toMatchObject({ xPct: 1, yPx: 0 });
    expect(clampDecoration({ ...d, xPct: -0.2 }).xPct).toBe(0);
  });
});
