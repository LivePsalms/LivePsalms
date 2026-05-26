// scripts/ingest-bsb.ts
//
// One-shot BSB ingest into bible_passages + lamplight_embeddings.
// Idempotent: re-running skips rows already inserted with the same content_hash.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... VOYAGE_AI_KEY=... \
//     npx tsx scripts/ingest-bsb.ts
//
// Source: https://bereanbible.com/bsb.json (public domain). Cached locally at
// scripts/data/bsb.json so re-runs are offline.

import { createClient } from '@supabase/supabase-js';
import { sha256 } from 'js-sha256';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { embedDocuments } from '../supabase/functions/_shared/voyage';

const BSB_URL = 'https://bereanbible.com/bsb.json';
const CACHE_PATH = 'scripts/data/bsb.json';
const BATCH = 64;

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
  if (existsSync(CACHE_PATH)) {
    return JSON.parse(await readFile(CACHE_PATH, 'utf8'));
  }
  await mkdir('scripts/data', { recursive: true });
  const res = await fetch(BSB_URL);
  if (!res.ok) throw new Error(`fetch ${BSB_URL}: ${res.status}`);
  const text = await res.text();
  await writeFile(CACHE_PATH, text);
  return JSON.parse(text);
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

  // 3. Embed + upsert in batches.
  for (let i = 0; i < toEmbed.length; i += BATCH) {
    const batch = toEmbed.slice(i, i + BATCH);
    const vectors = await embedDocuments(batch.map(p => p.text), { apiKey: voyageKey, fetch });
    const rows = batch.map((p, idx) => ({
      user_id: null,
      source_type: 'bible_passage',
      source_id: p.id,
      content_hash: sha256(p.text),
      embedding: vectors[idx],
      metadata: {
        book: p.book, chapter: p.chapter,
        verse_start: p.verse_start, verse_end: p.verse_end,
        translation: p.translation, pericope_id: p.pericope_id,
      },
    }));
    const { error } = await supabase.from('lamplight_embeddings').upsert(rows, {
      onConflict: 'user_id,source_type,source_id',
    });
    if (error) throw error;
    if ((i / BATCH) % 10 === 0) console.log(`  embedded ${Math.min(i + BATCH, toEmbed.length)}/${toEmbed.length}`);
  }
  console.log('done');
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} required`);
  return v;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exit(1); });
}
