// scripts/ingest-bsb.ts
//
// One-shot BSB ingest into bible_passages + lamplight_embeddings.
// Idempotent: re-running skips rows already inserted with the same content_hash.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... VOYAGE_AI_KEY=... \
//     npx tsx scripts/ingest-bsb.ts
//
// Source: https://bereanbible.com/bsb.txt (public domain TSV — one verse per
// line as `<Book> <Chapter>:<Verse>\t<Text>`, preceded by a 3-line preamble).
// Cached locally at scripts/data/bsb.txt so re-runs are offline.

import { createClient } from '@supabase/supabase-js';
import { sha256 } from 'js-sha256';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { embedDocuments } from '../supabase/functions/_shared/voyage';

const BSB_URL = 'https://bereanbible.com/bsb.txt';
const CACHE_PATH = 'scripts/data/bsb.txt';
const BATCH = 64;

// Full book name → OSIS-style 3-letter abbreviation. 66 canonical books.
// The BSB TSV uses "Psalm" (singular) and "Song of Solomon" (not "Song of Songs").
const BOOK_ABBREV: Record<string, string> = {
  // Old Testament
  'Genesis': 'gen', 'Exodus': 'exo', 'Leviticus': 'lev', 'Numbers': 'num',
  'Deuteronomy': 'deu', 'Joshua': 'jos', 'Judges': 'jdg', 'Ruth': 'rut',
  '1 Samuel': '1sa', '2 Samuel': '2sa', '1 Kings': '1ki', '2 Kings': '2ki',
  '1 Chronicles': '1ch', '2 Chronicles': '2ch', 'Ezra': 'ezr', 'Nehemiah': 'neh',
  'Esther': 'est', 'Job': 'job', 'Psalm': 'psa', 'Proverbs': 'pro',
  'Ecclesiastes': 'ecc', 'Song of Solomon': 'sng', 'Isaiah': 'isa', 'Jeremiah': 'jer',
  'Lamentations': 'lam', 'Ezekiel': 'ezk', 'Daniel': 'dan', 'Hosea': 'hos',
  'Joel': 'jol', 'Amos': 'amo', 'Obadiah': 'oba', 'Jonah': 'jon',
  'Micah': 'mic', 'Nahum': 'nam', 'Habakkuk': 'hab', 'Zephaniah': 'zep',
  'Haggai': 'hag', 'Zechariah': 'zec', 'Malachi': 'mal',
  // New Testament
  'Matthew': 'mat', 'Mark': 'mrk', 'Luke': 'luk', 'John': 'jhn',
  'Acts': 'act', 'Romans': 'rom', '1 Corinthians': '1co', '2 Corinthians': '2co',
  'Galatians': 'gal', 'Ephesians': 'eph', 'Philippians': 'php', 'Colossians': 'col',
  '1 Thessalonians': '1th', '2 Thessalonians': '2th', '1 Timothy': '1ti', '2 Timothy': '2ti',
  'Titus': 'tit', 'Philemon': 'phm', 'Hebrews': 'heb', 'James': 'jas',
  '1 Peter': '1pe', '2 Peter': '2pe', '1 John': '1jn', '2 John': '2jn',
  '3 John': '3jn', 'Jude': 'jud', 'Revelation': 'rev',
};

// Captures: book name (may include leading digit + space), chapter, verse.
// Examples: "Genesis 1:1", "1 Samuel 5:3", "Song of Solomon 8:14".
const REF_RE = /^(.+) (\d+):(\d+)$/;

export interface BsbVerse { number: number; text: string }
export interface BsbChapter { number: number; verses: BsbVerse[] }
export interface BsbBook { name: string; abbrev: string; chapters: BsbChapter[] }
export interface BsbCorpus { books: BsbBook[] }

export interface PassageRow {
  id: string;
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  translation: 'BSB';
  text: string;
  pericope_id: string;
}

export function parseBsbToRows(corpus: BsbCorpus): { verses: PassageRow[]; pericopes: PassageRow[] } {
  const verses: PassageRow[] = [];
  const pericopes: PassageRow[] = [];
  for (const book of corpus.books) {
    for (const ch of book.chapters) {
      const pericopeId = `${book.abbrev}.${ch.number}`;
      const verseTexts: string[] = [];
      for (const v of ch.verses) {
        verses.push({
          id: `${book.abbrev}.${ch.number}.${v.number}`,
          book: book.abbrev,
          chapter: ch.number,
          verse_start: v.number,
          verse_end: v.number,
          translation: 'BSB',
          text: v.text,
          pericope_id: pericopeId,
        });
        verseTexts.push(v.text);
      }
      pericopes.push({
        id: pericopeId,
        book: book.abbrev,
        chapter: ch.number,
        verse_start: ch.verses[0]?.number ?? 1,
        verse_end: ch.verses[ch.verses.length - 1]?.number ?? 1,
        translation: 'BSB',
        text: verseTexts.join('\n'),
        pericope_id: pericopeId,
      });
    }
  }
  return { verses, pericopes };
}

async function loadCorpus(): Promise<BsbCorpus> {
  let text: string;
  if (existsSync(CACHE_PATH)) {
    text = await readFile(CACHE_PATH, 'utf8');
  } else {
    await mkdir('scripts/data', { recursive: true });
    const res = await fetch(BSB_URL);
    if (!res.ok) throw new Error(`fetch ${BSB_URL}: ${res.status}`);
    text = await res.text();
    await writeFile(CACHE_PATH, text);
  }
  return parseBsbText(text);
}

// Parse the BSB TSV ("<Book> <Chapter>:<Verse>\t<Text>" lines) into the
// in-memory BsbCorpus structure that parseBsbToRows expects. Preserves the
// canonical book order encountered in the file. Skips preamble lines and
// the column header. Exported for testability.
export function parseBsbText(raw: string): BsbCorpus {
  // Strip BOM if present.
  const text = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/);

  const books: BsbBook[] = [];
  const bookIndex = new Map<string, number>();
  const chapterIndex = new Map<string, number>(); // key: `${bookIdx}.${chapterNumber}`

  for (const line of lines) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;                          // preamble row
    const ref = line.slice(0, tab).trim();
    const verseText = line.slice(tab + 1).trim();
    if (ref === 'Verse' || !verseText) continue;    // header / blank

    const m = REF_RE.exec(ref);
    if (!m) continue;                                // unexpected shape — skip silently
    const [, bookName, chapterStr, verseStr] = m;
    const abbrev = BOOK_ABBREV[bookName];
    if (!abbrev) {
      throw new Error(`unknown BSB book name: "${bookName}"`);
    }
    const chapter = Number(chapterStr);
    const verseNum = Number(verseStr);

    let bIdx = bookIndex.get(abbrev);
    if (bIdx === undefined) {
      bIdx = books.length;
      bookIndex.set(abbrev, bIdx);
      books.push({ name: bookName, abbrev, chapters: [] });
    }

    const chKey = `${bIdx}.${chapter}`;
    let cIdx = chapterIndex.get(chKey);
    if (cIdx === undefined) {
      cIdx = books[bIdx].chapters.length;
      chapterIndex.set(chKey, cIdx);
      books[bIdx].chapters.push({ number: chapter, verses: [] });
    }

    books[bIdx].chapters[cIdx].verses.push({ number: verseNum, text: verseText });
  }

  return { books };
}

async function main() {
  const url = required('SUPABASE_URL');
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  const voyageKey = required('VOYAGE_AI_KEY');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log('loading BSB corpus…');
  const corpus = await loadCorpus();
  const { verses, pericopes } = parseBsbToRows(corpus);
  const all = [...verses, ...pericopes];
  console.log(`parsed ${verses.length} verses + ${pericopes.length} pericopes = ${all.length} rows`);

  // 1. Upsert bible_passages.
  for (let i = 0; i < all.length; i += 500) {
    const batch = all.slice(i, i + 500);
    const { error } = await supabase.from('bible_passages').upsert(batch, { onConflict: 'id' });
    if (error) throw error;
  }
  console.log('bible_passages upserted');

  // 2. Find rows missing an embedding.
  const { data: existing, error: exErr } = await supabase
    .from('lamplight_embeddings').select('source_id, content_hash')
    .is('user_id', null).eq('source_type', 'bible_passage');
  if (exErr) throw exErr;
  const existingMap = new Map((existing ?? []).map(r => [r.source_id, r.content_hash]));

  const toEmbed = all.filter(p => existingMap.get(p.id) !== sha256(p.text));
  console.log(`${toEmbed.length} rows need (re-)embedding`);

  // 3. Embed + upsert in batches. We Voyage-batch at BATCH (64) but write to
  // lamplight_embeddings in smaller UPSERT_CHUNK slices, because HNSW index
  // maintenance is O(M·log N) per row and a 64-row upsert can blow past
  // Supabase's per-statement timeout (~8s on most plans) once the index has
  // tens of thousands of nodes. Smaller chunks + retry-on-timeout keep us
  // under the limit and resumable.
  const UPSERT_CHUNK = 8;
  for (let i = 0; i < toEmbed.length; i += BATCH) {
    const batch = toEmbed.slice(i, i + BATCH);
    // Each row is a single-chunk document in voyage-context-3's input shape.
    const { vectors } = await embedDocuments(batch.map(p => [p.text]), { apiKey: voyageKey, fetch });
    const rows = batch.map((p, idx) => ({
      user_id: null,
      source_type: 'bible_passage',
      source_id: p.id,
      chunk_index: 0,
      chunk_text: p.text,
      content_hash: sha256(p.text),
      embedding: vectors[idx][0], // unwrap the single-chunk inner array
      metadata: {
        book: p.book, chapter: p.chapter,
        verse_start: p.verse_start, verse_end: p.verse_end,
        translation: p.translation, pericope_id: p.pericope_id,
      },
    }));
    for (let j = 0; j < rows.length; j += UPSERT_CHUNK) {
      const chunk = rows.slice(j, j + UPSERT_CHUNK);
      await upsertWithRetry(supabase, chunk);
    }
    if ((i / BATCH) % 10 === 0) console.log(`  embedded ${Math.min(i + BATCH, toEmbed.length)}/${toEmbed.length}`);
  }
  console.log('done');
}

// Retries an upsert on Postgres statement timeout (SQLSTATE 57014) by
// halving the chunk until it fits. Idempotent on conflict, so partial-write
// retries are safe — they just no-op the rows that already landed.
async function upsertWithRetry(
  supabase: ReturnType<typeof createClient>,
  rows: Array<Record<string, unknown>>,
  attempt = 0,
): Promise<void> {
  const { error } = await supabase.from('lamplight_embeddings').upsert(rows, {
    onConflict: 'user_id,source_type,source_id,chunk_index',
  });
  if (!error) return;
  const isTimeout = (error as { code?: string }).code === '57014';
  if (isTimeout && rows.length > 1 && attempt < 4) {
    const mid = Math.ceil(rows.length / 2);
    await upsertWithRetry(supabase, rows.slice(0, mid), attempt + 1);
    await upsertWithRetry(supabase, rows.slice(mid), attempt + 1);
    return;
  }
  if (isTimeout && rows.length === 1 && attempt < 4) {
    // Single-row timeout — back off and retry once.
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    return upsertWithRetry(supabase, rows, attempt + 1);
  }
  throw error;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} required`);
  return v;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exit(1); });
}
