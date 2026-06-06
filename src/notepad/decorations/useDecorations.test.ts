// src/notepad/decorations/useDecorations.test.ts
// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useDecorations } from './useDecorations';
import type { Note } from '../types';

const note = (decorations: Note['decorations'] = [], id = 'n1'): Note => ({
  id, title: 'T', content: '', folderId: 'root', type: 'devotion',
  tags: [], decorations, wordCount: 0, createdAt: '', updatedAt: '',
});

describe('useDecorations', () => {
  it('adds a decoration and persists via updateNote', () => {
    const updateNote = vi.fn();
    const { result } = renderHook(() => useDecorations(note(), updateNote));
    act(() => {
      result.current.add({ assetId: 'arrow-01', xPct: 0.5, yPx: 100, widthPct: 0.2, rotation: 0 });
    });
    expect(result.current.decorations).toHaveLength(1);
    expect(updateNote).toHaveBeenCalledWith('n1', {
      decorations: expect.arrayContaining([expect.objectContaining({ assetId: 'arrow-01' })]),
    });
  });

  it('reflects the active note when it switches to a different note', () => {
    const updateNote = vi.fn();
    const { result, rerender } = renderHook(
      ({ n }) => useDecorations(n, updateNote),
      { initialProps: { n: note([], 'n1') } },
    );
    rerender({ n: note([{ id: 'x', assetId: 'shape-01', xPct: 0, yPx: 0, widthPct: 0.1, rotation: 0, z: 1 }], 'n2') });
    expect(result.current.decorations).toHaveLength(1);
  });
});
