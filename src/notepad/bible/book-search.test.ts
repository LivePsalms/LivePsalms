// src/notepad/bible/book-search.test.ts
import { describe, it, expect } from 'vitest';
import { searchBooks, bookMatches } from './book-search';
import { BIBLE_BOOKS } from './bible-books';

const names = (books: { name: string }[]) => books.map((b) => b.name);

describe('searchBooks — book-name filter', () => {
  it('returns every book for an empty / whitespace query', () => {
    expect(searchBooks('').books).toHaveLength(BIBLE_BOOKS.length);
    expect(searchBooks('   ').books).toHaveLength(BIBLE_BOOKS.length);
  });

  it('prefix-matches the start of a book name', () => {
    expect(names(searchBooks('Gen').books)).toEqual(['Genesis']);
  });

  it('matches every book whose name starts with the typed letter', () => {
    expect(names(searchBooks('G').books)).toEqual(['Genesis', 'Galatians']);
  });

  it('is case-insensitive', () => {
    expect(names(searchBooks('jo').books)).toEqual(names(searchBooks('JO').books));
  });

  it('surfaces numbered books by their word, without the leading number', () => {
    expect(names(searchBooks('Samuel').books)).toEqual(['1 Samuel', '2 Samuel']);
    expect(names(searchBooks('John').books)).toEqual(['John', '1 John', '2 John', '3 John']);
    expect(names(searchBooks('Corinthians').books)).toEqual(['1 Corinthians', '2 Corinthians']);
  });

  it('still matches numbered books by their leading number', () => {
    const result = names(searchBooks('1').books);
    expect(result).toContain('1 Samuel');
    expect(result).toContain('1 John');
    expect(result).not.toContain('2 John');
  });

  it('returns no books for a non-matching query', () => {
    expect(searchBooks('zzz').books).toEqual([]);
  });
});

describe('searchBooks — verse jump target', () => {
  it('has no jump for a bare book name', () => {
    expect(searchBooks('John').jump).toBeNull();
  });

  it('resolves "Book chapter" to a jump target', () => {
    const { jump } = searchBooks('John 3');
    expect(jump?.book.abbrev).toBe('jhn');
    expect(jump?.chapter).toBe(3);
    expect(jump?.verse).toBeNull();
  });

  it('resolves "Book chapter:verse" including the verse', () => {
    const { jump } = searchBooks('John 3:16');
    expect(jump?.book.abbrev).toBe('jhn');
    expect(jump?.chapter).toBe(3);
    expect(jump?.verse).toBe(16);
  });

  it('resolves numbered books inside references', () => {
    expect(searchBooks('1 John 4:8').jump?.book.abbrev).toBe('1jn');
  });

  it('accepts the common "Psalms" alias for "Psalm"', () => {
    expect(searchBooks('Psalms 23').jump?.book.abbrev).toBe('psa');
    expect(searchBooks('Psalm 23:1').jump?.book.abbrev).toBe('psa');
  });

  it('rejects an out-of-range chapter (John has 21)', () => {
    expect(searchBooks('John 99').jump).toBeNull();
  });

  it('keeps filtering books while a reference is typed', () => {
    expect(names(searchBooks('John 3').books)).toContain('John');
  });
});

describe('bookMatches', () => {
  it('matches on any leading word of a numbered book', () => {
    const samuel = BIBLE_BOOKS.find((b) => b.abbrev === '1sa')!;
    expect(bookMatches(samuel, 'sam')).toBe(true);
    expect(bookMatches(samuel, '1')).toBe(true);
    expect(bookMatches(samuel, 'king')).toBe(false);
  });
});
