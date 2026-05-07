import { describe, it, expect } from 'vitest';
import { filterNotesForLinkPopup } from './use-note-link-popup';
import type { Note } from '../types';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n',
    title: 'Untitled',
    content: '',
    folderId: 'root',
    type: 'devotion',
    tags: [],
    wordCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('filterNotesForLinkPopup', () => {
  it('returns [] when notes is empty', () => {
    expect(filterNotesForLinkPopup([], '', null, 10)).toEqual([]);
  });

  it('returns all notes (capped) when search is empty', () => {
    const notes = [
      makeNote({ id: 'a', title: 'Alpha' }),
      makeNote({ id: 'b', title: 'Beta' }),
    ];
    const result = filterNotesForLinkPopup(notes, '', null, 10);
    expect(result.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('excludes the active note', () => {
    const notes = [
      makeNote({ id: 'a', title: 'Alpha' }),
      makeNote({ id: 'b', title: 'Beta' }),
    ];
    const result = filterNotesForLinkPopup(notes, '', 'a', 10);
    expect(result.map((n) => n.id)).toEqual(['b']);
  });

  it('matches case-insensitively against title', () => {
    const notes = [
      makeNote({ id: 'a', title: 'Forgiveness' }),
      makeNote({ id: 'b', title: 'Patience' }),
    ];
    expect(filterNotesForLinkPopup(notes, 'FOR', null, 10).map((n) => n.id)).toEqual(['a']);
    expect(filterNotesForLinkPopup(notes, 'pat', null, 10).map((n) => n.id)).toEqual(['b']);
  });

  it('matches a substring anywhere in the title (not just prefix)', () => {
    const notes = [makeNote({ id: 'a', title: 'A note about hope' })];
    expect(filterNotesForLinkPopup(notes, 'hope', null, 10).map((n) => n.id)).toEqual(['a']);
  });

  it('caps results at maxResults preserving input order', () => {
    const notes = Array.from({ length: 15 }, (_, i) =>
      makeNote({ id: `n${i}`, title: `Note ${i}` }),
    );
    const result = filterNotesForLinkPopup(notes, '', null, 5);
    expect(result).toHaveLength(5);
    expect(result.map((n) => n.id)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4']);
  });

  it('returns [] when search has no matches', () => {
    const notes = [makeNote({ id: 'a', title: 'Alpha' })];
    expect(filterNotesForLinkPopup(notes, 'zeta', null, 10)).toEqual([]);
  });

  it('does not include the active note even if it matches the search', () => {
    const notes = [
      makeNote({ id: 'a', title: 'Alpha matchable' }),
      makeNote({ id: 'b', title: 'Beta matchable' }),
    ];
    const result = filterNotesForLinkPopup(notes, 'match', 'a', 10);
    expect(result.map((n) => n.id)).toEqual(['b']);
  });
});
