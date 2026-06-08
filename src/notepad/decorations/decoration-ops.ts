// src/notepad/decorations/decoration-ops.ts
import type { NoteDecoration } from '../types';

type NewDecoration = Omit<NoteDecoration, 'id' | 'z'>;

export function nextZ(list: NoteDecoration[]): number {
  return list.reduce((max, d) => Math.max(max, d.z), 0) + 1;
}

export function prevZ(list: NoteDecoration[]): number {
  return list.reduce((min, d) => Math.min(min, d.z), 0) - 1;
}

export function addDecoration(
  list: NoteDecoration[],
  init: NewDecoration,
  idGen: () => string,
): NoteDecoration[] {
  return [...list, { ...init, id: idGen(), z: nextZ(list) }];
}

export function updateDecoration(
  list: NoteDecoration[],
  id: string,
  patch: Partial<Omit<NoteDecoration, 'id'>>,
): NoteDecoration[] {
  return list.map((d) => (d.id === id ? { ...d, ...patch } : d));
}

export function removeDecoration(
  list: NoteDecoration[],
  id: string,
): NoteDecoration[] {
  return list.filter((d) => d.id !== id);
}

export function duplicateDecoration(
  list: NoteDecoration[],
  id: string,
  idGen: () => string,
): NoteDecoration[] {
  const src = list.find((d) => d.id === id);
  if (!src) return list;
  return [
    ...list,
    { ...src, id: idGen(), xPct: src.xPct + 0.02, yPct: ((src as { yPct?: number }).yPct ?? 0) + 0.02, z: nextZ(list) },
  ];
}

export function bringToFront(
  list: NoteDecoration[],
  id: string,
): NoteDecoration[] {
  const top = nextZ(list);
  return list.map((d) => (d.id === id ? { ...d, z: top, behindText: false } : d));
}

export function sendToBack(
  list: NoteDecoration[],
  id: string,
): NoteDecoration[] {
  const bottom = prevZ(list);
  return list.map((d) => (d.id === id ? { ...d, z: bottom, behindText: true } : d));
}
