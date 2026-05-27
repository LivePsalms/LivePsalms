import type { Note } from '../types';
import { extractTextFromNote } from './tiptap-text';

// Mirrors the inlined book list in supabase/functions/_shared/note-signals.ts.
// A cross-runtime parity test (in this file's test neighbor + the Deno
// note-signals.test.ts) asserts both sides produce identical refs on a
// shared fixture. If you update one list, update the other.
const BOOK_PATTERNS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
  '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalm', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations',
  'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah',
  'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
];

const BOOKS_ALT = BOOK_PATTERNS.map((b) => b.replace(/ /g, '\\s+')).join('|');
const VERSE_REGEX_SOURCE = `\\b(${BOOKS_ALT})\\s+(\\d+)(?::(\\d+)(?:[-–](\\d+))?)?`;
const VERSE_REGEX_FLAGS = 'gi';

function normalizeBook(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  for (const canonical of BOOK_PATTERNS) {
    if (canonical.toLowerCase() === collapsed.toLowerCase()) return canonical;
  }
  return collapsed;
}

function refKey(
  book: string,
  chapter: number,
  verseStart: number | null,
  verseEnd: number | null,
): string {
  const canonical = normalizeBook(book);
  if (verseStart === null) return `${canonical} ${chapter}`;
  if (verseEnd === null || verseEnd === verseStart) {
    return `${canonical} ${chapter}:${verseStart}`;
  }
  return `${canonical} ${chapter}:${verseStart}-${verseEnd}`;
}

export function extractVerseRefsFromNote(note: Note): string[] {
  const plaintext = extractTextFromNote(note);
  if (!plaintext) return [];
  const refs = new Set<string>();
  const re = new RegExp(VERSE_REGEX_SOURCE, VERSE_REGEX_FLAGS);
  for (const match of plaintext.matchAll(re)) {
    const book = match[1];
    const chapter = parseInt(match[2], 10);
    const verseStart = match[3] ? parseInt(match[3], 10) : null;
    const verseEnd = match[4] ? parseInt(match[4], 10) : null;
    if (Number.isNaN(chapter)) continue;
    refs.add(refKey(book, chapter, verseStart, verseEnd));
  }
  return [...refs];
}

export interface SharedSignals {
  sharedTags: string[];
  sharedVerseRefs: string[];
}

export function computeSharedSignals(active: Note, related: Note): SharedSignals {
  const activeTagLower = new Set(active.tags.map((t) => t.toLowerCase()));
  const seenTagLower = new Set<string>();
  const sharedTags: string[] = [];
  for (const t of related.tags) {
    const lower = t.toLowerCase();
    if (activeTagLower.has(lower) && !seenTagLower.has(lower)) {
      seenTagLower.add(lower);
      sharedTags.push(t);
    }
  }

  const activeRefs = new Set(extractVerseRefsFromNote(active));
  const relatedRefs = extractVerseRefsFromNote(related);
  const seenRef = new Set<string>();
  const sharedVerseRefs: string[] = [];
  for (const r of relatedRefs) {
    if (activeRefs.has(r) && !seenRef.has(r)) {
      seenRef.add(r);
      sharedVerseRefs.push(r);
    }
  }

  return { sharedTags, sharedVerseRefs };
}
