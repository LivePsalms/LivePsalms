// src/notepad/decorations/decoration-geometry.ts
import type { NoteDecoration } from '../types';

// Vertical position as a fraction of content width. Tolerates legacy decorations
// that still carry an absolute `yPx` until migration persists `yPct`.
export function resolveYPct(d: NoteDecoration, width: number): number {
  const yPct = (d as { yPct?: number }).yPct;
  if (typeof yPct === 'number') return yPct;
  return width > 0 ? (d.yPx ?? 0) / width : 0;
}

// True if a decoration predates uniform zoom (no yPct, or a lingering legacy yPx).
export function isLegacyDecoration(d: NoteDecoration): boolean {
  return typeof (d as { yPct?: number }).yPct !== 'number' || d.yPx !== undefined;
}

// Convert a legacy decoration (absolute `yPx`) to the uniform-zoom `yPct` unit
// using the given content width, dropping the legacy field. Already-migrated
// decorations are returned with any lingering `yPx` removed.
export function migrateLegacyDecoration(d: NoteDecoration, width: number): NoteDecoration {
  const next = { ...d, yPct: resolveYPct(d, width) };
  delete (next as { yPx?: number }).yPx;
  return next;
}

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
    yPct: resolveYPct(d, contentWidth) + (contentWidth > 0 ? dyPx / contentWidth : 0),
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
    yPct: Math.max(0, d.yPct),
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
  return { left: d.xPct * refWidth, top: resolveYPct(d, refWidth) * refWidth, width, height };
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
