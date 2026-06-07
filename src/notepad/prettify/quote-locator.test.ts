// src/notepad/prettify/quote-locator.test.ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { StyleHighlight } from '../extensions/style-highlight';
import { buildDocText, locateQuote } from './quote-locator';

function makeEditor(content: string) {
  return new Editor({ extensions: [StarterKit, StyleHighlight], content });
}

describe('quote-locator', () => {
  it('locates a quote and returns a range that marks exactly the quote text', () => {
    const editor = makeEditor('<p>The quick brown fox jumps.</p>');
    const loc = locateQuote(editor.state.doc, 'quick brown fox');
    expect(loc).not.toBeNull();
    expect(editor.state.doc.textBetween(loc!.from, loc!.to)).toBe('quick brown fox');
    editor.destroy();
  });

  it('matches across whitespace differences and block boundaries', () => {
    const editor = makeEditor('<p>alpha beta</p><p>gamma delta</p>');
    const { text } = buildDocText(editor.state.doc);
    expect(text).toContain('\n\n');
    const loc = locateQuote(editor.state.doc, 'beta gamma');
    expect(loc).not.toBeNull();
    expect(editor.state.doc.textBetween(loc!.from, loc!.to, ' ')).toBe('beta gamma');
    editor.destroy();
  });

  it('matches case-insensitively', () => {
    const editor = makeEditor('<p>Grace is sufficient.</p>');
    const loc = locateQuote(editor.state.doc, 'GRACE IS SUFFICIENT');
    expect(loc).not.toBeNull();
    expect(editor.state.doc.textBetween(loc!.from, loc!.to)).toBe('Grace is sufficient');
    editor.destroy();
  });

  it('honors a 1-based occurrence index', () => {
    const editor = makeEditor('<p>note note note</p>');
    const first = locateQuote(editor.state.doc, 'note', 1)!;
    const third = locateQuote(editor.state.doc, 'note', 3)!;
    expect(third.from).toBeGreaterThan(first.from);
    expect(editor.state.doc.textBetween(third.from, third.to)).toBe('note');
    editor.destroy();
  });

  it('returns null when the quote is absent', () => {
    const editor = makeEditor('<p>hello world</p>');
    expect(locateQuote(editor.state.doc, 'missing phrase')).toBeNull();
    editor.destroy();
  });
});
