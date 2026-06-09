// src/notepad/bible/book-search.ts
// Pure search logic for the Bible book navigator's search bar. Kept separate
// from BibleReader so the matching rules are unit-testable in isolation.
import { BIBLE_BOOKS, type BibleBook } from './bible-books';

export interface JumpTarget {
  book: BibleBook;
  chapter: number;
  verse: number | null;
}

export interface BookSearchResult {
  /** Books matching the (book-name part of the) query, in canonical order. */
  books: BibleBook[];
  /**
   * Present when the query names a valid book + chapter, e.g. "John 3" or
   * "Psalm 23:1". Drives the "Go to …" affordance.
   */
  jump: JumpTarget | null;
}

// Book-name part, then an optional " <chapter>" and an optional ":<verse>".
const QUERY_RE = /^(.+?)(?:\s+(\d{1,3})(?::(\d{1,3}))?)?\s*$/;

function norm(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * A book matches the query when its full name OR any whitespace-delimited word
 * within the name starts with the query. The per-word rule lets "samuel"
 * surface "1 Samuel" / "2 Samuel" without the leading number, while typing "1"
 * still surfaces every numbered book.
 */
export function bookMatches(book: BibleBook, query: string): boolean {
  const q = norm(query);
  if (!q) return true;
  const name = book.name.toLowerCase();
  if (name.startsWith(q)) return true;
  return name.split(/\s+/).some((word) => word.startsWith(q));
}

/** Best single book for a reference's book-name part (for the jump target). */
function resolveBook(bookText: string, books: readonly BibleBook[]): BibleBook | null {
  const q = norm(bookText);
  if (!q) return null;

  // Exact name wins so "John 3" never resolves to "1 John".
  const exact = books.find((b) => b.name.toLowerCase() === q);
  if (exact) return exact;

  // Lenient prefix in either direction: "gen" → "Genesis", "psalms" → "Psalm".
  const prefix = books.filter((b) => {
    const name = b.name.toLowerCase();
    return name.startsWith(q) || q.startsWith(name);
  });
  if (prefix.length > 0) {
    return prefix.reduce((best, b) => (b.name.length < best.name.length ? b : best));
  }

  // Fall back to the same per-word rule the grid filter uses.
  return books.find((b) => bookMatches(b, q)) ?? null;
}

export function searchBooks(
  query: string,
  books: readonly BibleBook[] = BIBLE_BOOKS,
): BookSearchResult {
  const raw = query.trim();
  if (!raw) return { books: [...books], jump: null };

  const match = QUERY_RE.exec(raw);
  const bookText = match ? match[1] : raw;
  const chapter = match && match[2] ? parseInt(match[2], 10) : null;
  const verse = match && match[3] ? parseInt(match[3], 10) : null;

  const filtered = books.filter((b) => bookMatches(b, bookText));

  let jump: JumpTarget | null = null;
  if (chapter != null) {
    const book = resolveBook(bookText, books);
    if (book && chapter >= 1 && chapter <= book.chapterCount) {
      jump = { book, chapter, verse: verse != null && verse >= 1 ? verse : null };
    }
  }

  return { books: filtered, jump };
}
