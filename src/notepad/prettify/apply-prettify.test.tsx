// src/notepad/prettify/apply-prettify.test.tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { StyleHighlight } from '../extensions/style-highlight';
import { applyPrettify } from './apply-prettify';
import type { Rect } from './anchor-geometry';

function makeEditor(content: string) {
  return new Editor({ extensions: [StarterKit, StyleHighlight], content });
}
const fakeRect: Rect = { left: 100, top: 50, width: 200, height: 20 };

describe('applyPrettify', () => {
  it('applies highlights as styleHighlight marks with the role swatch', () => {
    const editor = makeEditor('<p>Grace is sufficient. Press on.</p>');
    const addMany = vi.fn();
    const res = applyPrettify(
      { summary: '', highlights: [{ quote: 'Grace is sufficient', role: 'key-point' }], decorations: [], connections: [] },
      { editor, measure: () => fakeRect, contentWidth: 1000, addMany },
    );
    const json = JSON.stringify(editor.getJSON());
    expect(json).toContain('styleHighlight');
    expect(json).toContain('highlight-01');
    expect(res.highlights).toBe(1);
    editor.destroy();
  });

  it('turns each decoration into an addMany init with kind asset and placement', () => {
    const editor = makeEditor('<p>Grace is sufficient. Press on.</p>');
    const addMany = vi.fn();
    applyPrettify(
      { summary: '', highlights: [], decorations: [{ quote: 'Press on', kind: 'underline' }], connections: [] },
      { editor, measure: () => fakeRect, contentWidth: 1000, addMany },
    );
    expect(addMany).toHaveBeenCalledTimes(1);
    const inits = addMany.mock.calls[0][0];
    expect(inits).toHaveLength(1);
    expect(inits[0].assetId).toBe('squiggle-01');
    expect(inits[0].xPct).toBeCloseTo(0.1, 5);
    expect(inits[0].yPx).toBe(72);
    editor.destroy();
  });

  it('adds a connector decoration spanning two quotes', () => {
    const editor = makeEditor('<p>alpha here. omega there.</p>');
    const addMany = vi.fn();
    const rects: Rect[] = [
      { left: 0, top: 0, width: 0, height: 0 },
      { left: 100, top: 0, width: 0, height: 0 },
    ];
    let i = 0;
    applyPrettify(
      { summary: '', highlights: [], decorations: [], connections: [{ from_quote: 'alpha', to_quote: 'omega' }] },
      { editor, measure: () => rects[i++], contentWidth: 1000, addMany },
    );
    const inits = addMany.mock.calls[0][0];
    expect(inits[0].assetId).toBe('line-01');
    expect(inits[0].widthPct).toBeCloseTo(0.1, 5);
    editor.destroy();
  });

  it('skips quotes that cannot be located and never calls addMany with an empty list', () => {
    const editor = makeEditor('<p>hello</p>');
    const addMany = vi.fn();
    const res = applyPrettify(
      { summary: '', highlights: [{ quote: 'absent', role: 'topic' }], decorations: [{ quote: 'absent', kind: 'bracket' }], connections: [] },
      { editor, measure: () => fakeRect, contentWidth: 1000, addMany },
    );
    expect(res.highlights).toBe(0);
    expect(res.decorations).toBe(0);
    expect(addMany).not.toHaveBeenCalled();
    editor.destroy();
  });
});
