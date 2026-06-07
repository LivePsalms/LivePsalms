// src/notepad/decorations/useDecorations.test.ts
// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDecorations } from './useDecorations';
import type { Note } from '../types';

const note = (decorations: Note['decorations'] = [], id = 'n1'): Note => ({
  id, title: 'T', content: '', folderId: 'root', type: 'devotion',
  tags: [], decorations, wordCount: 0, createdAt: '', updatedAt: '',
});

describe('useDecorations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds a decoration and persists via updateNote', () => {
    const updateNote = vi.fn();
    const { result } = renderHook(() => useDecorations(note(), updateNote));
    act(() => {
      result.current.add({ assetId: 'arrow-01', xPct: 0.5, yPx: 100, widthPct: 0.2, rotation: 0 });
    });
    // UI reflects the add synchronously.
    expect(result.current.decorations).toHaveLength(1);
    // Persistence is debounced — only fires after the window elapses.
    act(() => {
      vi.advanceTimersByTime(500);
    });
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

  it('coalesces rapid successive updates into ONE persisted updateNote with the latest state', () => {
    const updateNote = vi.fn();
    const initial = note(
      [{ id: 'd1', assetId: 'arrow-01', xPct: 0, yPx: 0, widthPct: 0.2, rotation: 0, z: 1 }],
      'n1',
    );
    const { result } = renderHook(() => useDecorations(initial, updateNote));

    // Simulate a drag: 10 rapid update calls in the same debounce window.
    act(() => {
      for (let i = 1; i <= 10; i++) {
        result.current.update('d1', { xPct: i / 100 });
      }
    });

    // Before the debounce fires, nothing has been persisted.
    expect(updateNote).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Exactly ONE persistence call, carrying the LATEST state (xPct = 0.1).
    expect(updateNote).toHaveBeenCalledTimes(1);
    expect(updateNote).toHaveBeenCalledWith('n1', {
      decorations: [expect.objectContaining({ id: 'd1', xPct: 0.1 })],
    });
  });

  it('updates on-screen decorations synchronously before the debounce fires', () => {
    const updateNote = vi.fn();
    const initial = note(
      [{ id: 'd1', assetId: 'arrow-01', xPct: 0, yPx: 0, widthPct: 0.2, rotation: 0, z: 1 }],
      'n1',
    );
    const { result } = renderHook(() => useDecorations(initial, updateNote));

    act(() => {
      result.current.update('d1', { xPct: 0.42 });
    });

    // Synchronous UI: state reflects the change immediately, no timer advance.
    expect(result.current.decorations[0].xPct).toBe(0.42);
    expect(updateNote).not.toHaveBeenCalled();
  });

  it('flushes a pending change on unmount', () => {
    const updateNote = vi.fn();
    const initial = note(
      [{ id: 'd1', assetId: 'arrow-01', xPct: 0, yPx: 0, widthPct: 0.2, rotation: 0, z: 1 }],
      'n1',
    );
    const { result, unmount } = renderHook(() => useDecorations(initial, updateNote));

    act(() => {
      result.current.update('d1', { xPct: 0.77 });
    });
    expect(updateNote).not.toHaveBeenCalled();

    act(() => {
      unmount();
    });

    expect(updateNote).toHaveBeenCalledTimes(1);
    expect(updateNote).toHaveBeenCalledWith('n1', {
      decorations: [expect.objectContaining({ id: 'd1', xPct: 0.77 })],
    });
  });

  it('flushes a pending change to the ORIGINAL note when the active note switches', () => {
    const updateNote = vi.fn();
    const { result, rerender } = renderHook(
      ({ n }) => useDecorations(n, updateNote),
      {
        initialProps: {
          n: note(
            [{ id: 'd1', assetId: 'arrow-01', xPct: 0, yPx: 0, widthPct: 0.2, rotation: 0, z: 1 }],
            'n1',
          ),
        },
      },
    );

    act(() => {
      result.current.update('d1', { xPct: 0.55 });
    });
    expect(updateNote).not.toHaveBeenCalled();

    // Switch to a different note before the debounce fires.
    act(() => {
      rerender({ n: note([], 'n2') });
    });

    // The pending write must land on the ORIGINAL note id (n1), not n2.
    expect(updateNote).toHaveBeenCalledTimes(1);
    expect(updateNote).toHaveBeenCalledWith('n1', {
      decorations: [expect.objectContaining({ id: 'd1', xPct: 0.55 })],
    });
    // And the new note's decorations are loaded.
    expect(result.current.decorations).toHaveLength(0);
  });

  it('adds many decorations in a single commit, each with a distinct id and z', () => {
    const updateNote = vi.fn();
    const { result } = renderHook(() => useDecorations(note(), updateNote));
    act(() => {
      result.current.addMany([
        { assetId: 'arrow-01', xPct: 0.1, yPx: 10, widthPct: 0.2, rotation: 0 },
        { assetId: 'line-01', xPct: 0.3, yPx: 20, widthPct: 0.2, rotation: 0 },
      ]);
    });
    expect(result.current.decorations).toHaveLength(2);
    const ids = result.current.decorations.map((d) => d.id);
    expect(new Set(ids).size).toBe(2);
    const zs = result.current.decorations.map((d) => d.z);
    expect(new Set(zs).size).toBe(2);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(updateNote).toHaveBeenCalledTimes(1);
  });

  it('reset replaces the entire decoration list verbatim', () => {
    const updateNote = vi.fn();
    const initial = note(
      [{ id: 'd1', assetId: 'arrow-01', xPct: 0, yPx: 0, widthPct: 0.2, rotation: 0, z: 1 }],
      'n1',
    );
    const { result } = renderHook(() => useDecorations(initial, updateNote));
    act(() => {
      result.current.reset([]);
    });
    expect(result.current.decorations).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(updateNote).toHaveBeenCalledWith('n1', { decorations: [] });
  });
});
