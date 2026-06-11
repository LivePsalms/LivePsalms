// src/notepad/decorations/decoration-geometry.ts
import type { NoteDecoration } from '../types';

const MIN_WIDTH_PCT = 0.03;
const MAX_WIDTH_PCT = 1;

// zIndex of the editor text wrapper. Single source of truth (Editor.tsx imports it).
export const TEXT_Z = 100000;
// A selected decoration always sits on top so its handles stay grabbable.
export const SELECTED_Z = 1000000;

export function decorationZIndex(d: NoteDecoration, selected: boolean): number {
  if (selected) return SELECTED_Z;
  if (d.behindText) return d.z;
  return TEXT_Z + d.z;
}

export function pointerAngleDeg(
  center: { x: number; y: number },
  point: { x: number; y: number },
): number {
  return Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI;
}

export function applyRotationDrag(
  startRotation: number,
  startAngle: number,
  currentAngle: number,
): number {
  return rotationDeg(startRotation + (currentAngle - startAngle));
}

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

export interface DecorationBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Axis-aligned px box a decoration occupies on the canvas, given the frozen
// reference width. Height derives from the asset aspect ratio (stored as
// width/height), matching the <img width:100% height:auto> render. Rotation is
// ignored — the un-rotated AABB is accurate enough for click selection.
export function decorationBox(
  d: NoteDecoration,
  refWidth: number,
  aspectRatio: number,
): DecorationBox {
  const width = d.widthPct * refWidth;
  const height = aspectRatio > 0 ? width / aspectRatio : width;
  return { left: d.xPct * refWidth, top: d.yPx, width, height };
}

export function pointInBox(px: number, py: number, b: DecorationBox): boolean {
  return px >= b.left && px <= b.left + b.width && py >= b.top && py <= b.top + b.height;
}

// Finds the topmost behind-text decoration whose box contains the point (canvas
// px). Only behind-text decorations are considered — front ones receive clicks
// directly through their own island, so they never need this fallback path.
export function topmostBehindAtPoint(
  decorations: NoteDecoration[],
  px: number,
  py: number,
  refWidth: number,
  aspectRatioOf: (assetId: string) => number | undefined,
): string | null {
  const behind = decorations
    .filter((d) => d.behindText)
    .sort((a, b) => b.z - a.z); // highest z is visually on top — test it first
  for (const d of behind) {
    const aspectRatio = aspectRatioOf(d.assetId);
    if (aspectRatio == null) continue;
    if (pointInBox(px, py, decorationBox(d, refWidth, aspectRatio))) return d.id;
  }
  return null;
}

// Snaps an angle to the nearest multiple of `step` when within `threshold`
// degrees of it (handling the 360/0 wrap), else returns the normalized angle.
// Used on mobile so rotation locks onto cardinal/diagonal angles instead of
// drifting. Pure — desktop never calls it, keeping desktop rotation unchanged.
export function snapAngle(
  deg: number,
  { step, threshold }: { step: number; threshold: number },
): number {
  const norm = rotationDeg(deg);
  const nearest = Math.round(norm / step) * step;
  return Math.abs(norm - nearest) <= threshold ? rotationDeg(nearest) : norm;
}

export type ResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// Proportional (aspect-locked) resize from a corner, keeping the diagonally
// opposite corner fixed on the canvas. Width is the driver; height follows the
// asset aspect ratio (width / aspectRatio), matching the <img> render. Width is
// clamped to [MIN_WIDTH_PCT, MAX_WIDTH_PCT]; position is recomputed from the
// anchored corner and intentionally NOT passed through clampDecoration so the
// anchor stays exact (the move path owns position clamping).
export function resizeFromCorner(
  d: NoteDecoration,
  { corner, dxPx, contentWidth, aspectRatio }:
    { corner: ResizeCorner; dxPx: number; dyPx: number; contentWidth: number; aspectRatio: number },
): NoteDecoration {
  if (contentWidth <= 0) return d;

  const left = d.xPct * contentWidth;
  const top = d.yPx;
  const width = d.widthPct * contentWidth;
  const height = aspectRatio > 0 ? width / aspectRatio : width;
  const right = left + width;
  const bottom = top + height;

  // Left-edge corners grow as the pointer moves left (negative dx).
  const growsRight = corner === 'top-right' || corner === 'bottom-right';
  const rawWidth = growsRight ? width + dxPx : width - dxPx;

  const widthPct = Math.min(MAX_WIDTH_PCT, Math.max(MIN_WIDTH_PCT, rawWidth / contentWidth));
  const newWidth = widthPct * contentWidth;
  const newHeight = aspectRatio > 0 ? newWidth / aspectRatio : newWidth;

  // Anchor the opposite corner.
  const anchorsLeft = corner === 'top-left' || corner === 'bottom-left'; // opposite corner is on the right
  const anchorsTop = corner === 'top-left' || corner === 'top-right';    // opposite corner is on the bottom
  const newLeft = anchorsLeft ? right - newWidth : left;
  const newTop = anchorsTop ? bottom - newHeight : top;

  return { ...d, widthPct, xPct: newLeft / contentWidth, yPx: newTop };
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
