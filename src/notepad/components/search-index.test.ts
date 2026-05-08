import { describe, it, expect } from 'vitest';
import { buildSearchIndex } from './search-index';
import type { Note } from '../types';

const makeNote = (overrides: Partial<Note> & { id: string }): Note => ({
  title: 'Untitled',
  content: JSON.stringify({ type: 'doc', content: [] }),
  folderId: 'root',
  type: 'devotion',
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  wordCount: 0,
  ...overrides,
} as Note);

const docWithText = (text: string) =>
  JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });

describe('buildSearchIndex — empty input', () => {
  it('returns empty arrays for an empty notes list', () => {
    expect(buildSearchIndex([])).toEqual({ verses: [], tags: [] });
  });

  it('returns empty arrays for notes with no verses or tags', () => {
    const notes = [
      makeNote({ id: 'n1', title: 'Hello', content: docWithText('just plain text') }),
    ];
    expect(buildSearchIndex(notes)).toEqual({ verses: [], tags: [] });
  });
});

describe('buildSearchIndex — verses', () => {
  it('extracts verse refs from each note’s plain text', () => {
    const notes = [
      makeNote({
        id: 'n1',
        title: 'On Hope',
        content: docWithText('See Psalm 23:1 for context'),
      }),
    ];
    const result = buildSearchIndex(notes);
    expect(result.verses).toEqual([
      { ref: 'Psalm 23:1', noteId: 'n1', noteTitle: 'On Hope' },
    ]);
  });

  it('dedups by ref string, first-occurrence wins', () => {
    const notes = [
      makeNote({ id: 'n1', title: 'First', content: docWithText('Psalm 23:1 here') }),
      makeNote({
        id: 'n2',
        title: 'Second',
        content: docWithText('Psalm 23:1 again'),
      }),
    ];
    const result = buildSearchIndex(notes);
    expect(result.verses).toEqual([
      { ref: 'Psalm 23:1', noteId: 'n1', noteTitle: 'First' },
    ]);
  });

  it('preserves multiple distinct verses across notes', () => {
    const notes = [
      makeNote({ id: 'n1', title: 'A', content: docWithText('Psalm 23:1 first') }),
      makeNote({ id: 'n2', title: 'B', content: docWithText('John 3:16 second') }),
    ];
    const result = buildSearchIndex(notes);
    expect(result.verses).toHaveLength(2);
    expect(result.verses.map((v) => v.ref)).toEqual(['Psalm 23:1', 'John 3:16']);
  });

  it('falls back to raw note.content when JSON.parse fails (extractTextFromNote contract)', () => {
    const notes = [
      makeNote({ id: 'n1', title: 'Raw', content: 'plain text Psalm 23:1 still found' }),
    ];
    const result = buildSearchIndex(notes);
    expect(result.verses.map((v) => v.ref)).toEqual(['Psalm 23:1']);
  });
});

describe('buildSearchIndex — tags', () => {
  it('reads tags directly from note.tags (not from content)', () => {
    const notes = [
      makeNote({ id: 'n1', title: 'Tagged', tags: ['hope', 'faith'] }),
    ];
    const result = buildSearchIndex(notes);
    expect(result.tags).toEqual([
      { tag: 'hope', noteId: 'n1', noteTitle: 'Tagged' },
      { tag: 'faith', noteId: 'n1', noteTitle: 'Tagged' },
    ]);
  });

  it('dedups by tag string, first-occurrence wins', () => {
    const notes = [
      makeNote({ id: 'n1', title: 'First', tags: ['hope'] }),
      makeNote({ id: 'n2', title: 'Second', tags: ['hope'] }),
    ];
    const result = buildSearchIndex(notes);
    expect(result.tags).toEqual([
      { tag: 'hope', noteId: 'n1', noteTitle: 'First' },
    ]);
  });
});

describe('buildSearchIndex — verses and tags together', () => {
  it('produces both indexes from a mixed-content note set', () => {
    const notes = [
      makeNote({
        id: 'n1',
        title: 'Mixed',
        content: docWithText('See Psalm 23:1'),
        tags: ['scripture'],
      }),
      makeNote({
        id: 'n2',
        title: 'Other',
        content: docWithText('John 3:16'),
        tags: ['scripture', 'hope'],
      }),
    ];
    const result = buildSearchIndex(notes);
    expect(result.verses.map((v) => v.ref)).toEqual(['Psalm 23:1', 'John 3:16']);
    expect(result.tags.map((t) => t.tag)).toEqual(['scripture', 'hope']);
    expect(result.tags[0].noteId).toBe('n1');
  });
});
