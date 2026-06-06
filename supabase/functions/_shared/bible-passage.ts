// Shared verse-reference formatting and bible_passages→passage join.
//
// formatVerseRef + buildPassages own the Reference-domain logic (per
// §Reference / §ScriptureNode) that the smoke-test and daily-devotion context
// builders in lamplight-generate/index.ts both held as byte-identical copies.

import type { RetrievedItem } from './retrieval.ts';

export interface BiblePassageRow {
  id: string;
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  text: string;
}

export interface BiblePassage {
  source_id: string;
  text: string;
  ref: string;
  metadata: Record<string, unknown>;
}

export function formatVerseRef(
  p: { book: string; chapter: number; verse_start: number; verse_end: number },
): string {
  const suffix = p.verse_end !== p.verse_start
    ? `${p.verse_start}-${p.verse_end}`
    : `${p.verse_start}`;
  return `${p.book} ${p.chapter}:${suffix}`;
}

export function buildPassages(
  passageRows: BiblePassageRow[],
  retrieved: RetrievedItem[],
): BiblePassage[] {
  const passageById = new Map<string, { book: string; chapter: number; verse_start: number; verse_end: number; text: string }>();
  for (const r of passageRows) {
    passageById.set(r.id, { book: r.book, chapter: r.chapter, verse_start: r.verse_start, verse_end: r.verse_end, text: r.text });
  }
  return retrieved
    .map(r => {
      const p = passageById.get(r.source_id);
      if (!p) return null;
      const ref = formatVerseRef(p);
      return {
        source_id: r.source_id, text: p.text, ref,
        metadata: { book: p.book, chapter: p.chapter, similarity: r.similarity, rerank_score: r.rerank_score },
      };
    })
    .filter((x): x is BiblePassage => x !== null);
}
