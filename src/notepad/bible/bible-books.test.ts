// src/notepad/bible/bible-books.test.ts
import { describe, it, expect } from 'vitest';
import { BIBLE_BOOKS, bookByAbbrev, OLD_TESTAMENT, NEW_TESTAMENT } from './bible-books';

describe('bible-books', () => {
  it('has all 66 canonical books in order', () => {
    expect(BIBLE_BOOKS).toHaveLength(66);
    expect(BIBLE_BOOKS[0].name).toBe('Genesis');
    expect(BIBLE_BOOKS[65].name).toBe('Revelation');
  });

  it('splits 39 OT / 27 NT', () => {
    expect(OLD_TESTAMENT).toHaveLength(39);
    expect(NEW_TESTAMENT).toHaveLength(27);
  });

  it('uses unique lowercase 3-letter abbrevs matching the ingest', () => {
    const abbrevs = BIBLE_BOOKS.map((b) => b.abbrev);
    expect(new Set(abbrevs).size).toBe(66);
    for (const a of abbrevs) expect(a).toMatch(/^[0-9a-z]{3}$/);
    expect(bookByAbbrev('jhn')?.name).toBe('John');
    expect(bookByAbbrev('psa')?.name).toBe('Psalm'); // singular, per ingest BOOK_ABBREV
  });

  it('has positive chapter counts with known anchors', () => {
    for (const b of BIBLE_BOOKS) expect(b.chapterCount).toBeGreaterThan(0);
    expect(bookByAbbrev('psa')?.chapterCount).toBe(150);
    expect(bookByAbbrev('jhn')?.chapterCount).toBe(21);
    expect(bookByAbbrev('gen')?.chapterCount).toBe(50);
    expect(bookByAbbrev('oba')?.chapterCount).toBe(1);
  });

  it('returns undefined for an unknown abbrev', () => {
    expect(bookByAbbrev('zzz')).toBeUndefined();
  });
});
