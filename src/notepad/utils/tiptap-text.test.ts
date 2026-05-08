import { describe, it, expect } from 'vitest';
import {
  extractPlainText,
  extractTextFromNote,
  countWordsFromTipTapJSON,
} from './tiptap-text';
import type { Note } from '../types';

const makeNote = (overrides: Partial<Note> & { id: string; content: string }): Note => ({
  title: 'Untitled',
  folderId: 'root',
  type: 'devotion',
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  wordCount: 0,
  ...overrides,
} as Note);

describe('extractPlainText', () => {
  it('returns the text of a single text leaf', () => {
    expect(extractPlainText({ type: 'text', text: 'hello' })).toBe('hello');
  });

  it('joins children of a paragraph on a single space', () => {
    const doc = {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'hello' },
        { type: 'text', text: 'world' },
      ],
    };
    expect(extractPlainText(doc)).toBe('hello world');
  });

  it('recurses through doc → paragraph → text', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'first paragraph' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'second paragraph' }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe('first paragraph second paragraph');
  });

  it('returns empty string for non-objects', () => {
    expect(extractPlainText(null)).toBe('');
    expect(extractPlainText(undefined)).toBe('');
    expect(extractPlainText('hello')).toBe('');
    expect(extractPlainText(42)).toBe('');
  });

  it('returns empty string for an object with no text and no content', () => {
    expect(extractPlainText({ type: 'horizontalRule' })).toBe('');
  });

  it('ignores a `text` field on a node whose type is not "text" (gates on type === "text")', () => {
    const doc = {
      type: 'paragraph',
      text: 'IGNORED',
      content: [{ type: 'text', text: 'real content' }],
    };
    expect(extractPlainText(doc)).toBe('real content');
  });

  it('ignores a node with type === "text" but a non-string `text` field', () => {
    expect(extractPlainText({ type: 'text', text: 42 })).toBe('');
  });
});

describe('extractTextFromNote', () => {
  it('parses note.content as TipTap JSON and returns the joined text', () => {
    const note = makeNote({
      id: 'n1',
      content: JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'hello world' }] },
        ],
      }),
    });
    expect(extractTextFromNote(note)).toBe('hello world');
  });

  it('falls back to note.content as raw text when JSON.parse throws', () => {
    const note = makeNote({ id: 'n1', content: 'not json {{{' });
    expect(extractTextFromNote(note)).toBe('not json {{{');
  });

  it('returns empty string for an empty TipTap doc', () => {
    const note = makeNote({
      id: 'n1',
      content: JSON.stringify({ type: 'doc', content: [] }),
    });
    expect(extractTextFromNote(note)).toBe('');
  });
});

describe('countWordsFromTipTapJSON', () => {
  it('returns 0 for empty input', () => {
    expect(countWordsFromTipTapJSON('')).toBe(0);
  });

  it('counts words in a parsed TipTap JSON document', () => {
    const json = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'one two three' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'four five' }] },
      ],
    });
    expect(countWordsFromTipTapJSON(json)).toBe(5);
  });

  it('treats non-JSON input as plain text and counts words', () => {
    expect(countWordsFromTipTapJSON('plain text content here')).toBe(4);
  });

  it('returns 0 for a TipTap doc that contains only whitespace', () => {
    const json = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '   ' }] }],
    });
    expect(countWordsFromTipTapJSON(json)).toBe(0);
  });
});
