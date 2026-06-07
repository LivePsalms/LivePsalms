// src/notepad/prettify/anchor-geometry.ts
import type { DecorationKind } from './prettify-types';

export const UNDERLINE_GAP = 2;
export const BRACKET_OFFSET = 12;
export const BRACKET_WIDTH_PX = 14;
export const MARGIN_X = 8;
export const ARROW_WIDTH_PX = 28;

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Placement {
  xPct: number;
  yPx: number;
  widthPct: number;
  rotation: number;
}

export function decorationPlacement(
  kind: DecorationKind,
  rect: Rect,
  contentWidth: number,
): Placement {
  switch (kind) {
    case 'underline':
      return {
        xPct: rect.left / contentWidth,
        yPx: rect.top + rect.height + UNDERLINE_GAP,
        widthPct: rect.width / contentWidth,
        rotation: 0,
      };
    case 'bracket':
      return {
        xPct: Math.max(0, rect.left - BRACKET_OFFSET - BRACKET_WIDTH_PX) / contentWidth,
        yPx: rect.top,
        widthPct: BRACKET_WIDTH_PX / contentWidth,
        rotation: 0,
      };
    case 'margin-arrow':
      return {
        xPct: MARGIN_X / contentWidth,
        yPx: rect.top,
        widthPct: ARROW_WIDTH_PX / contentWidth,
        rotation: 0,
      };
  }
}

export function connectorPlacement(a: Rect, b: Rect, contentWidth: number): Placement {
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const bx = b.left + b.width / 2;
  const by = b.top + b.height / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (ax + bx) / 2;
  const midY = (ay + by) / 2;
  return {
    xPct: (midX - dist / 2) / contentWidth,
    yPx: midY,
    widthPct: dist / contentWidth,
    rotation,
  };
}
