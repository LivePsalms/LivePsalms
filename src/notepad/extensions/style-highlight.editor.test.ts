// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { StyleHighlight } from './style-highlight';

let editor: Editor | null = null;
afterEach(() => { editor?.destroy(); editor = null; });

describe('StyleHighlight storage', () => {
  it('records the last applied swatch id in storage', () => {
    editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, StyleHighlight],
      content: '<p>hello</p>',
    });
    editor.commands.selectAll();
    editor.commands.setStyleHighlight('highlight-03');
    expect(editor.storage.styleHighlight.lastSwatchId).toBe('highlight-03');
  });

  it('records the last swatch via toggleStyleHighlight too', () => {
    editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, StyleHighlight],
      content: '<p>hello</p>',
    });
    editor.commands.selectAll();
    editor.commands.toggleStyleHighlight('highlight-04');
    expect(editor.storage.styleHighlight.lastSwatchId).toBe('highlight-04');
  });

  it('does not change last swatch when unsetting', () => {
    editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, StyleHighlight],
      content: '<p>hello</p>',
    });
    editor.commands.selectAll();
    editor.commands.setStyleHighlight('highlight-02');
    editor.commands.unsetStyleHighlight();
    expect(editor.storage.styleHighlight.lastSwatchId).toBe('highlight-02');
  });
});
