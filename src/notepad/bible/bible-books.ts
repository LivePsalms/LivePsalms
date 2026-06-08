// src/notepad/bible/bible-books.ts
// Canonical 66-book metadata for the Bible reader navigator. abbrev values are
// the lowercase OSIS-style codes used as the `book` column + id prefix in
// bible_passages (see scripts/ingest-bsb.ts BOOK_ABBREV). Chapter counts are the
// Berean Standard Bible (BSB) canon.

export type Testament = 'OT' | 'NT';

export interface BibleBook {
  name: string;
  abbrev: string;
  testament: Testament;
  chapterCount: number;
}

export const BIBLE_BOOKS: readonly BibleBook[] = [
  { name: 'Genesis', abbrev: 'gen', testament: 'OT', chapterCount: 50 },
  { name: 'Exodus', abbrev: 'exo', testament: 'OT', chapterCount: 40 },
  { name: 'Leviticus', abbrev: 'lev', testament: 'OT', chapterCount: 27 },
  { name: 'Numbers', abbrev: 'num', testament: 'OT', chapterCount: 36 },
  { name: 'Deuteronomy', abbrev: 'deu', testament: 'OT', chapterCount: 34 },
  { name: 'Joshua', abbrev: 'jos', testament: 'OT', chapterCount: 24 },
  { name: 'Judges', abbrev: 'jdg', testament: 'OT', chapterCount: 21 },
  { name: 'Ruth', abbrev: 'rut', testament: 'OT', chapterCount: 4 },
  { name: '1 Samuel', abbrev: '1sa', testament: 'OT', chapterCount: 31 },
  { name: '2 Samuel', abbrev: '2sa', testament: 'OT', chapterCount: 24 },
  { name: '1 Kings', abbrev: '1ki', testament: 'OT', chapterCount: 22 },
  { name: '2 Kings', abbrev: '2ki', testament: 'OT', chapterCount: 25 },
  { name: '1 Chronicles', abbrev: '1ch', testament: 'OT', chapterCount: 29 },
  { name: '2 Chronicles', abbrev: '2ch', testament: 'OT', chapterCount: 36 },
  { name: 'Ezra', abbrev: 'ezr', testament: 'OT', chapterCount: 10 },
  { name: 'Nehemiah', abbrev: 'neh', testament: 'OT', chapterCount: 13 },
  { name: 'Esther', abbrev: 'est', testament: 'OT', chapterCount: 10 },
  { name: 'Job', abbrev: 'job', testament: 'OT', chapterCount: 42 },
  { name: 'Psalm', abbrev: 'psa', testament: 'OT', chapterCount: 150 },
  { name: 'Proverbs', abbrev: 'pro', testament: 'OT', chapterCount: 31 },
  { name: 'Ecclesiastes', abbrev: 'ecc', testament: 'OT', chapterCount: 12 },
  { name: 'Song of Solomon', abbrev: 'sng', testament: 'OT', chapterCount: 8 },
  { name: 'Isaiah', abbrev: 'isa', testament: 'OT', chapterCount: 66 },
  { name: 'Jeremiah', abbrev: 'jer', testament: 'OT', chapterCount: 52 },
  { name: 'Lamentations', abbrev: 'lam', testament: 'OT', chapterCount: 5 },
  { name: 'Ezekiel', abbrev: 'ezk', testament: 'OT', chapterCount: 48 },
  { name: 'Daniel', abbrev: 'dan', testament: 'OT', chapterCount: 12 },
  { name: 'Hosea', abbrev: 'hos', testament: 'OT', chapterCount: 14 },
  { name: 'Joel', abbrev: 'jol', testament: 'OT', chapterCount: 3 },
  { name: 'Amos', abbrev: 'amo', testament: 'OT', chapterCount: 9 },
  { name: 'Obadiah', abbrev: 'oba', testament: 'OT', chapterCount: 1 },
  { name: 'Jonah', abbrev: 'jon', testament: 'OT', chapterCount: 4 },
  { name: 'Micah', abbrev: 'mic', testament: 'OT', chapterCount: 7 },
  { name: 'Nahum', abbrev: 'nam', testament: 'OT', chapterCount: 3 },
  { name: 'Habakkuk', abbrev: 'hab', testament: 'OT', chapterCount: 3 },
  { name: 'Zephaniah', abbrev: 'zep', testament: 'OT', chapterCount: 3 },
  { name: 'Haggai', abbrev: 'hag', testament: 'OT', chapterCount: 2 },
  { name: 'Zechariah', abbrev: 'zec', testament: 'OT', chapterCount: 14 },
  { name: 'Malachi', abbrev: 'mal', testament: 'OT', chapterCount: 4 },
  { name: 'Matthew', abbrev: 'mat', testament: 'NT', chapterCount: 28 },
  { name: 'Mark', abbrev: 'mrk', testament: 'NT', chapterCount: 16 },
  { name: 'Luke', abbrev: 'luk', testament: 'NT', chapterCount: 24 },
  { name: 'John', abbrev: 'jhn', testament: 'NT', chapterCount: 21 },
  { name: 'Acts', abbrev: 'act', testament: 'NT', chapterCount: 28 },
  { name: 'Romans', abbrev: 'rom', testament: 'NT', chapterCount: 16 },
  { name: '1 Corinthians', abbrev: '1co', testament: 'NT', chapterCount: 16 },
  { name: '2 Corinthians', abbrev: '2co', testament: 'NT', chapterCount: 13 },
  { name: 'Galatians', abbrev: 'gal', testament: 'NT', chapterCount: 6 },
  { name: 'Ephesians', abbrev: 'eph', testament: 'NT', chapterCount: 6 },
  { name: 'Philippians', abbrev: 'php', testament: 'NT', chapterCount: 4 },
  { name: 'Colossians', abbrev: 'col', testament: 'NT', chapterCount: 4 },
  { name: '1 Thessalonians', abbrev: '1th', testament: 'NT', chapterCount: 5 },
  { name: '2 Thessalonians', abbrev: '2th', testament: 'NT', chapterCount: 3 },
  { name: '1 Timothy', abbrev: '1ti', testament: 'NT', chapterCount: 6 },
  { name: '2 Timothy', abbrev: '2ti', testament: 'NT', chapterCount: 4 },
  { name: 'Titus', abbrev: 'tit', testament: 'NT', chapterCount: 3 },
  { name: 'Philemon', abbrev: 'phm', testament: 'NT', chapterCount: 1 },
  { name: 'Hebrews', abbrev: 'heb', testament: 'NT', chapterCount: 13 },
  { name: 'James', abbrev: 'jas', testament: 'NT', chapterCount: 5 },
  { name: '1 Peter', abbrev: '1pe', testament: 'NT', chapterCount: 5 },
  { name: '2 Peter', abbrev: '2pe', testament: 'NT', chapterCount: 3 },
  { name: '1 John', abbrev: '1jn', testament: 'NT', chapterCount: 5 },
  { name: '2 John', abbrev: '2jn', testament: 'NT', chapterCount: 1 },
  { name: '3 John', abbrev: '3jn', testament: 'NT', chapterCount: 1 },
  { name: 'Jude', abbrev: 'jud', testament: 'NT', chapterCount: 1 },
  { name: 'Revelation', abbrev: 'rev', testament: 'NT', chapterCount: 22 },
];

const BY_ABBREV = new Map(BIBLE_BOOKS.map((b) => [b.abbrev, b]));

export function bookByAbbrev(abbrev: string): BibleBook | undefined {
  return BY_ABBREV.get(abbrev);
}

export const OLD_TESTAMENT = BIBLE_BOOKS.filter((b) => b.testament === 'OT');
export const NEW_TESTAMENT = BIBLE_BOOKS.filter((b) => b.testament === 'NT');
