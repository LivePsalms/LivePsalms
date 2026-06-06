// src/notepad/decorations/decoration-ops.test.ts
import { describe, it, expect } from 'vitest';
import {
  addDecoration, updateDecoration, removeDecoration,
  duplicateDecoration, bringToFront, sendToBack, nextZ,
} from './decoration-ops';
import type { NoteDecoration } from '../types';

const base: NoteDecoration = {
  id: 'a', assetId: 'arrow-01', xPct: 0.5, yPx: 100, widthPct: 0.2, rotation: 0, z: 1,
};

let counter = 0;
const idGen = () => `id-${++counter}`;

describe('decoration-ops', () => {
  it('addDecoration appends with a generated id and next z', () => {
    counter = 0;
    const out = addDecoration([base], { assetId: 'shape-01', xPct: 0.1, yPx: 10, widthPct: 0.3, rotation: 0 }, idGen);
    expect(out).toHaveLength(2);
    expect(out[1].id).toBe('id-1');
    expect(out[1].z).toBe(2); // max z (1) + 1
  });

  it('updateDecoration patches only the matching item', () => {
    const out = updateDecoration([base], 'a', { rotation: 45 });
    expect(out[0].rotation).toBe(45);
    expect(out[0].xPct).toBe(0.5);
  });

  it('removeDecoration drops the matching item', () => {
    expect(removeDecoration([base], 'a')).toEqual([]);
  });

  it('duplicateDecoration clones with a new id, nudged position, and next z', () => {
    counter = 0;
    const out = duplicateDecoration([base], 'a', idGen);
    expect(out).toHaveLength(2);
    expect(out[1].id).toBe('id-1');
    expect(out[1].assetId).toBe('arrow-01');
    expect(out[1].xPct).toBeCloseTo(0.52);
    expect(out[1].yPx).toBe(120);
    expect(out[1].z).toBe(2);
  });

  it('bringToFront / sendToBack reassign z relative to the set', () => {
    const two = [base, { ...base, id: 'b', z: 2 }];
    expect(bringToFront(two, 'a').find((d) => d.id === 'a')!.z).toBe(3);
    expect(sendToBack(two, 'b').find((d) => d.id === 'b')!.z).toBe(0);
  });

  it('nextZ returns max z + 1, or 1 for an empty set', () => {
    expect(nextZ([])).toBe(1);
    expect(nextZ([base])).toBe(2);
  });
});
