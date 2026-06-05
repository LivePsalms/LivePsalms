// supabase/functions/_shared/note-signals.ts
//
// Deno-side helper for Connection Cards (sub-project 5).
//
// Extracts verse refs from a note's TipTap-JSON content and intersects
// (tags, verseRefs) between two notes. The browser-side mirror lives at
// src/notepad/utils/connection-signals.ts; a parity test asserts both
// produce identical output on a shared fixture (Task 4 adds the parity
// test on both sides).
//
// Verse-ref extraction strategy: plaintext + regex. Note content goes
// through extractTextFromNoteContent first; we then match the canonical
// verse-pattern regex against the plaintext. This is intentionally simpler
// than walking the TipTap tree for marks — sub-project 5 just needs
// overlap signals, not perfect ref provenance.

import { extractTextFromNoteContent } from './tiptap-text.ts';

// Inlined book list parallels src/notepad/graph/reference-parser.ts BOOK_PATTERNS.
// Kept inline to avoid a cross-runtime import; parity test catches drift.
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
const VERSE_REGEX = new RegExp(
  `\\b(${BOOKS_ALT})\\s+(\\d+)(?::(\\d+)(?:\\s*[-–]\\s*(\\d+))?)?`,
  'gi',
);

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
  if (verseEnd === null || verseEnd === verseStart) return `${canonical} ${chapter}:${verseStart}`;
  return `${canonical} ${chapter}:${verseStart}-${verseEnd}`;
}

export function extractVerseRefsFromNoteContent(content: string): string[] {
  const plaintext = extractTextFromNoteContent(content);
  const refs = new Set<string>();
  for (const match of plaintext.matchAll(VERSE_REGEX)) {
    const book = match[1];
    const chapter = parseInt(match[2], 10);
    const verseStart = match[3] ? parseInt(match[3], 10) : null;
    const verseEnd = match[4] ? parseInt(match[4], 10) : null;
    if (Number.isNaN(chapter)) continue;
    refs.add(refKey(book, chapter, verseStart, verseEnd));
  }
  return [...refs];
}

export interface NoteSignals {
  tags: string[];
  verseRefs: string[];
}

export interface SharedSignals {
  sharedTags: string[];
  sharedVerseRefs: string[];
}

export function intersectTagsAndVerseRefs(
  source: NoteSignals,
  related: NoteSignals,
): SharedSignals {
  const sourceTagsLower = new Set(source.tags.map((t) => t.toLowerCase()));
  const sharedTagsRaw: string[] = [];
  const seenTagLower = new Set<string>();
  for (const t of related.tags) {
    const lower = t.toLowerCase();
    if (sourceTagsLower.has(lower) && !seenTagLower.has(lower)) {
      seenTagLower.add(lower);
      sharedTagsRaw.push(t);
    }
  }

  const sourceRefs = new Set(source.verseRefs);
  const seenRef = new Set<string>();
  const sharedRefs: string[] = [];
  for (const r of related.verseRefs) {
    if (sourceRefs.has(r) && !seenRef.has(r)) {
      seenRef.add(r);
      sharedRefs.push(r);
    }
  }

  return { sharedTags: sharedTagsRaw, sharedVerseRefs: sharedRefs };
}
