// src/notepad/prettify/use-prettify.test.tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { StyleHighlight } from '../extensions/style-highlight';
import { usePrettify, type UsePrettifyDeps } from './use-prettify';
import type { PrettifyResult } from './prettify-types';
import type { NoteDecoration } from '../types';

function makeEditor(content: string) {
  return new Editor({ extensions: [StarterKit, StyleHighlight], content });
}

const okPlan: PrettifyResult = {
  ok: true,
  plan: {
    summary: 'Two ideas surfaced.',
    highlights: [{ quote: 'Grace is sufficient', role: 'key-point' }],
    decorations: [],
    connections: [],
  },
};

function deps(editor: Editor, over: Partial<UsePrettifyDeps> = {}): UsePrettifyDeps {
  return {
    editor,
    adapter: { generatePrettifyPlan: vi.fn().mockResolvedValue(okPlan) },
    userId: 'u1',
    noteId: 'n1',
    contentText: 'Grace is sufficient.',
    measure: () => ({ left: 0, top: 0, width: 10, height: 10 }),
    contentWidth: 1000,
    decorations: [],
    addMany: vi.fn(),
    reset: vi.fn(),
    ...over,
  };
}

describe('usePrettify', () => {
  it('runs the adapter, applies the plan, and reports done with counts', async () => {
    const editor = makeEditor('<p>Grace is sufficient. Press on.</p>');
    const d = deps(editor);
    const { result } = renderHook(() => usePrettify(d));
    await act(async () => { await result.current.run('balanced'); });
    expect(d.adapter!.generatePrettifyPlan).toHaveBeenCalledWith('u1', 'n1', 'Grace is sufficient.', 'balanced');
    expect(result.current.state.phase).toBe('done');
    expect(result.current.state.result?.highlights).toBe(1);
    expect(result.current.state.canUndo).toBe(true);
    expect(JSON.stringify(editor.getJSON())).toContain('highlight-01');
    editor.destroy();
  });

  it('reports the adapter failure reason and leaves the editor untouched', async () => {
    const editor = makeEditor('<p>Grace is sufficient.</p>');
    const before = JSON.stringify(editor.getJSON());
    const d = deps(editor, {
      adapter: { generatePrettifyPlan: vi.fn().mockResolvedValue({ ok: false, reason: 'quota' }) },
    });
    const { result } = renderHook(() => usePrettify(d));
    await act(async () => { await result.current.run('light'); });
    expect(result.current.state.phase).toBe('error');
    expect(result.current.state.reason).toBe('quota');
    expect(result.current.state.canUndo).toBe(false);
    expect(JSON.stringify(editor.getJSON())).toBe(before);
    editor.destroy();
  });

  it('undo restores the editor content and resets decorations to the snapshot', async () => {
    const editor = makeEditor('<p>Grace is sufficient.</p>');
    const before = JSON.stringify(editor.getJSON());
    const snapshotDecorations: NoteDecoration[] = [
      { id: 'old', assetId: 'arrow-01', xPct: 0.1, yPx: 10, widthPct: 0.2, rotation: 0, z: 1 },
    ];
    const reset = vi.fn();
    const d = deps(editor, { decorations: snapshotDecorations, reset });
    const { result } = renderHook(() => usePrettify(d));
    await act(async () => { await result.current.run('balanced'); });
    expect(JSON.stringify(editor.getJSON())).not.toBe(before);
    act(() => { result.current.undo(); });
    expect(JSON.stringify(editor.getJSON())).toBe(before);
    expect(reset).toHaveBeenCalledWith(snapshotDecorations);
    expect(result.current.state.phase).toBe('idle');
    editor.destroy();
  });

  it('is a no-op when editor, adapter, user, or note id is missing', async () => {
    const editor = makeEditor('<p>x</p>');
    const generatePrettifyPlan = vi.fn();
    const d = deps(editor, { adapter: { generatePrettifyPlan }, userId: null });
    const { result } = renderHook(() => usePrettify(d));
    await act(async () => { await result.current.run('balanced'); });
    expect(generatePrettifyPlan).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe('idle');
    editor.destroy();
  });
});
