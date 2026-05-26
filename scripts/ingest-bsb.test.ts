import { describe, it, expect } from 'vitest';
import { parseBsbToRows } from './ingest-bsb';

const FIXTURE = {
  // Tiny BSB fragment — Psalm 23:1-2 and Psalm 24:1.
  // Shape matches bereanbible.com's JSON release.
  books: [
    { name: 'Psalms', abbrev: 'psa', chapters: [
      { number: 23, verses: [
        { number: 1, text: 'The LORD is my shepherd; I shall not want.' },
        { number: 2, text: 'He makes me lie down in green pastures.' },
      ]},
      { number: 24, verses: [
        { number: 1, text: 'The earth is the LORD’s, and the fullness thereof.' },
      ]},
    ]},
  ],
};

describe('parseBsbToRows', () => {
  it('emits one verse row per verse', () => {
    const { verses } = parseBsbToRows(FIXTURE as never);
    expect(verses).toEqual([
      { id: 'psa.23.1', book: 'psa', chapter: 23, verse_start: 1, verse_end: 1, translation: 'BSB',
        text: 'The LORD is my shepherd; I shall not want.', pericope_id: 'psa.23' },
      { id: 'psa.23.2', book: 'psa', chapter: 23, verse_start: 2, verse_end: 2, translation: 'BSB',
        text: 'He makes me lie down in green pastures.', pericope_id: 'psa.23' },
      { id: 'psa.24.1', book: 'psa', chapter: 24, verse_start: 1, verse_end: 1, translation: 'BSB',
        text: 'The earth is the LORD’s, and the fullness thereof.', pericope_id: 'psa.24' },
    ]);
  });

  it('emits one pericope row per chapter, joining verses with newlines', () => {
    const { pericopes } = parseBsbToRows(FIXTURE as never);
    expect(pericopes).toEqual([
      { id: 'psa.23', book: 'psa', chapter: 23, verse_start: 1, verse_end: 2, translation: 'BSB',
        text: 'The LORD is my shepherd; I shall not want.\nHe makes me lie down in green pastures.', pericope_id: 'psa.23' },
      { id: 'psa.24', book: 'psa', chapter: 24, verse_start: 1, verse_end: 1, translation: 'BSB',
        text: 'The earth is the LORD’s, and the fullness thereof.', pericope_id: 'psa.24' },
    ]);
  });
});
