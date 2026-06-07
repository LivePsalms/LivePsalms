// src/notepad/prettify/anchor-geometry.test.ts
import { describe, expect, it } from 'vitest';
import {
  decorationPlacement, connectorPlacement,
  UNDERLINE_GAP, BRACKET_OFFSET, BRACKET_WIDTH_PX, MARGIN_X, ARROW_WIDTH_PX,
} from './anchor-geometry';

const cw = 1000;
const rect = { left: 100, top: 50, width: 200, height: 20 };

describe('decorationPlacement', () => {
  it('places an underline below the quote', () => {
    const p = decorationPlacement('underline', rect, cw);
    expect(p.xPct).toBeCloseTo(0.1, 5);
    expect(p.widthPct).toBeCloseTo(0.2, 5);
    expect(p.yPx).toBe(rect.top + rect.height + UNDERLINE_GAP);
    expect(p.rotation).toBe(0);
  });

  it('places a bracket to the left of the quote', () => {
    const p = decorationPlacement('bracket', rect, cw);
    expect(p.xPct).toBeCloseTo((100 - BRACKET_OFFSET - BRACKET_WIDTH_PX) / cw, 5);
    expect(p.widthPct).toBeCloseTo(BRACKET_WIDTH_PX / cw, 5);
    expect(p.yPx).toBe(rect.top);
  });

  it('clamps the bracket x to zero when the quote hugs the left edge', () => {
    const p = decorationPlacement('bracket', { ...rect, left: 4 }, cw);
    expect(p.xPct).toBe(0);
  });

  it('places a margin arrow in the left margin', () => {
    const p = decorationPlacement('margin-arrow', rect, cw);
    expect(p.xPct).toBeCloseTo(MARGIN_X / cw, 5);
    expect(p.widthPct).toBeCloseTo(ARROW_WIDTH_PX / cw, 5);
    expect(p.yPx).toBe(rect.top);
  });
});

describe('connectorPlacement', () => {
  it('spans two horizontally separated rects at zero rotation', () => {
    const a = { left: 0, top: 0, width: 0, height: 0 };
    const b = { left: 100, top: 0, width: 0, height: 0 };
    const p = connectorPlacement(a, b, cw);
    expect(p.widthPct).toBeCloseTo(0.1, 5);
    expect(p.rotation).toBeCloseTo(0, 5);
    expect(p.xPct).toBeCloseTo(0, 5);
    expect(p.yPx).toBeCloseTo(0, 5);
  });

  it('rotates 90 degrees for vertically separated rects', () => {
    const a = { left: 0, top: 0, width: 0, height: 0 };
    const b = { left: 0, top: 100, width: 0, height: 0 };
    const p = connectorPlacement(a, b, cw);
    expect(p.rotation).toBeCloseTo(90, 5);
    expect(p.widthPct).toBeCloseTo(0.1, 5);
    expect(p.yPx).toBeCloseTo(50, 5);
  });
});
