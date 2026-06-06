// src/notepad/decorations/decoration-geometry.ts
import type { NoteDecoration } from '../types';

const MIN_WIDTH_PCT = 0.03;
const MAX_WIDTH_PCT = 1;

export function moveTo(
  d: NoteDecoration,
  { dxPx, dyPx, contentWidth }: { dxPx: number; dyPx: number; contentWidth: number },
): NoteDecoration {
  return clampDecoration({
    ...d,
    xPct: d.xPct + (contentWidth > 0 ? dxPx / contentWidth : 0),
    yPx: d.yPx + dyPx,
  });
}

export function resizeWidthPct(
  d: NoteDecoration,
  { dxPx, contentWidth }: { dxPx: number; contentWidth: number },
): NoteDecoration {
  const raw = d.widthPct + (contentWidth > 0 ? dxPx / contentWidth : 0);
  return { ...d, widthPct: Math.min(MAX_WIDTH_PCT, Math.max(MIN_WIDTH_PCT, raw)) };
}

export function rotationDeg(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function clampDecoration(d: NoteDecoration): NoteDecoration {
  return {
    ...d,
    xPct: Math.min(1, Math.max(0, d.xPct)),
    yPx: Math.max(0, d.yPx),
  };
}

export function pinchTransform(
  d: NoteDecoration,
  { startDist, dist, startAngle, angle }:
    { startDist: number; dist: number; startAngle: number; angle: number },
): NoteDecoration {
  const factor = startDist > 0 ? dist / startDist : 1;
  const raw = d.widthPct * factor;
  return {
    ...d,
    widthPct: Math.min(MAX_WIDTH_PCT, Math.max(MIN_WIDTH_PCT, raw)),
    rotation: rotationDeg(d.rotation + (angle - startAngle)),
  };
}
