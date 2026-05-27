// supabase/functions/lamplight-generate/index.ts
//
// Dispatches on body.kind:
//   - 'smoke_test'           → throwaway pipeline from sub-project 3 (kept for now)
//   - 'daily_devotion'       → real, persisted daily devotion (sub-project 4)
//   - 'connection_card_why'  → lazy Haiku "why" generation for Connection Cards (sub-project 5)
//
// JWT verification stays on at the platform level. The function additionally
// requires lamplight_settings.enabled=true for the supplied user_id.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from '../_shared/supabase.ts';
import { embedQuery, type VoyageDeps } from '../_shared/voyage.ts';
import { searchBible } from '../_shared/retrieval.ts';
import { createAnthropicAdapter } from '../_shared/anthropic.ts';
import { extractTextFromNoteContent } from '../_shared/tiptap-text.ts';
import {
  extractVerseRefsFromNoteContent,
  intersectTagsAndVerseRefs,
} from '../_shared/note-signals.ts';
import { runSmokeTestPipeline, type SmokeTestContext, type SmokeTestPassage } from './pipeline.ts';
import {
  runDailyDevotionPipeline,
  type DailyDevotionContext,
  type DailyDevotionPassage,
} from './daily-devotion-pipeline.ts';
import {
  runConnectionWhyPipeline,
  type ConnectionWhyContext,
} from './connection-why-pipeline.ts';

// Today's Lamp is invoked from the browser via supabase.functions.invoke, so
// the function must answer CORS preflights and echo the allow-origin header
// on every response. embed-note doesn't need this because it's only ever
// invoked server-to-server (pg_cron + queue RPC).
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405);

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const voyageKey = Deno.env.get('VOYAGE_AI_KEY');
  if (!anthropicKey) return jsonResp({ error: 'ANTHROPIC_API_KEY missing' }, 500);
  if (!voyageKey)    return jsonResp({ error: 'VOYAGE_AI_KEY missing' }, 500);

  let body: {
    kind?: string;
    user_id?: string;
    local_date?: string;
    source_note_id?: string;
    related_note_id?: string;
  };
  try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }
  if (typeof body.user_id !== 'string') return jsonResp({ error: 'bad payload' }, 400);

  const supabase = serviceClient();
  const { data: settings, error: sErr } = await supabase
    .from('lamplight_settings')
    .select('enabled, voice_preference, tradition_hint')
    .eq('user_id', body.user_id)
    .maybeSingle();
  if (sErr) return jsonResp({ error: sErr.message }, 500);
  if (!settings?.enabled) return jsonResp({ error: 'not opted in' }, 403);

  const voyageDeps: VoyageDeps = { apiKey: voyageKey, fetch };
  const rerankEnabled = Deno.env.get('RERANK_ENABLED') === 'true';
  const llm = createAnthropicAdapter({ apiKey: anthropicKey, fetch });
  const voicePreference = (settings.voice_preference as string) ?? 'Lord';
  const traditionHint = (settings.tradition_hint as string) ?? 'unspecified';

  if (body.kind === 'smoke_test') {
    const ctx = await buildSmokeTestContext(supabase, {
      userId: body.user_id, voicePreference, traditionHint, voyageDeps, rerankEnabled,
    });
    const result = await runSmokeTestPipeline({ llm, ctx });
    return jsonResp(result);
  }

  if (body.kind === 'daily_devotion') {
    if (typeof body.local_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.local_date)) {
      return jsonResp({ error: 'bad local_date' }, 400);
    }
    const localDate = body.local_date;
    const ctx = await buildDailyDevotionContext(supabase, {
      userId: body.user_id, localDate, voicePreference, traditionHint, voyageDeps, rerankEnabled,
    });
    const result = await runDailyDevotionPipeline({
      llm, supabase, ctx, userId: body.user_id, localDate,
    });
    return jsonResp(result);
  }

  if (body.kind === 'connection_card_why') {
    if (
      typeof body.source_note_id !== 'string' ||
      typeof body.related_note_id !== 'string' ||
      body.source_note_id === body.related_note_id
    ) {
      return jsonResp({ error: 'bad payload' }, 400);
    }
    const ctxResult = await buildConnectionWhyContext(supabase, {
      userId: body.user_id,
      sourceNoteId: body.source_note_id,
      relatedNoteId: body.related_note_id,
      voicePreference,
    });
    if (ctxResult.kind === 'no_embedding') {
      return jsonResp({ ok: false, reason: 'no_embedding', attempts: 0 });
    }
    if (ctxResult.kind === 'not_neighbor') {
      return jsonResp({ ok: false, reason: 'not_neighbor', attempts: 0 });
    }
    const result = await runConnectionWhyPipeline({
      llm,
      supabase,
      ctx: ctxResult.context,
    });
    return jsonResp(result);
  }

  return jsonResp({ error: 'unknown kind' }, 400);
});

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

// ── Smoke-test context builder (unchanged from sub-project 3) ────────────
async function buildSmokeTestContext(
  supabase: SupabaseClient,
  args: { userId: string; voicePreference: string; traditionHint: string; voyageDeps: VoyageDeps; rerankEnabled: boolean },
): Promise<SmokeTestContext | null> {
  const { data: noteRows, error: nErr } = await supabase
    .from('notes')
    .select('id, title, content, updated_at')
    .eq('user_id', args.userId)
    .order('updated_at', { ascending: false })
    .limit(5);
  if (nErr) throw nErr;

  const notes = (noteRows ?? [])
    .map(n => ({
      id: n.id as string,
      title: (n.title as string) ?? '(untitled)',
      plaintext: extractTextFromNoteContent(n.content as string).slice(0, 800),
    }))
    .filter(n => n.plaintext.trim().length > 0);
  if (notes.length === 0) return null;

  const themeQuery = [...notes].sort((a, b) => b.plaintext.length - a.plaintext.length)[0].plaintext;
  const queryEmbedding = await embedQuery(themeQuery, args.voyageDeps);
  const retrievedBible = await searchBible(
    { supabase, voyage: args.voyageDeps, rerankEnabled: args.rerankEnabled },
    { query: themeQuery, k: 3, queryEmbedding },
  );

  const sourceIds = retrievedBible.map(r => r.source_id);
  const { data: passageRows, error: pErr } = await supabase
    .from('bible_passages')
    .select('id, book, chapter, verse_start, verse_end, text')
    .in('id', sourceIds);
  if (pErr) throw pErr;
  const passageById = new Map<string, { book: string; chapter: number; verse_start: number; verse_end: number; text: string }>();
  for (const r of (passageRows ?? []) as Array<{ id: string; book: string; chapter: number; verse_start: number; verse_end: number; text: string }>) {
    passageById.set(r.id, { book: r.book, chapter: r.chapter, verse_start: r.verse_start, verse_end: r.verse_end, text: r.text });
  }
  const passages: SmokeTestPassage[] = retrievedBible
    .map(r => {
      const p = passageById.get(r.source_id);
      if (!p) return null;
      const refSuffix = p.verse_end !== p.verse_start ? `${p.verse_start}-${p.verse_end}` : `${p.verse_start}`;
      const ref = `${p.book} ${p.chapter}:${refSuffix}`;
      return {
        source_id: r.source_id, text: p.text, ref,
        metadata: { book: p.book, chapter: p.chapter, similarity: r.similarity, rerank_score: r.rerank_score },
      };
    })
    .filter((x): x is SmokeTestPassage => x !== null);

  return {
    notes, passages,
    voicePreference: args.voicePreference,
    traditionHint: args.traditionHint,
    allowedNoteIds: new Set(notes.map(n => n.id)),
    allowedVerseRefs: new Set(passages.map(p => p.ref)),
    rerankUsed: args.rerankEnabled && passages.length > 0,
  };
}

// ── Daily devotion context builder ───────────────────────────────────────
async function buildDailyDevotionContext(
  supabase: SupabaseClient,
  args: { userId: string; localDate: string; voicePreference: string; traditionHint: string; voyageDeps: VoyageDeps; rerankEnabled: boolean },
): Promise<DailyDevotionContext | null> {
  const { data: noteRows, error: nErr } = await supabase
    .from('notes')
    .select('id, title, content, updated_at')
    .eq('user_id', args.userId)
    .order('updated_at', { ascending: false })
    .limit(3);
  if (nErr) throw nErr;

  const notes = (noteRows ?? [])
    .map(n => ({
      id: n.id as string,
      title: ((n.title as string) ?? '').trim() || '(untitled)',
      plaintext: extractTextFromNoteContent(n.content as string).slice(0, 800),
    }))
    .filter(n => n.plaintext.trim().length > 0);
  if (notes.length === 0) return null;

  const themeQuery = notes
    .map(n => `${n.title}: ${n.plaintext.slice(0, 200)}`)
    .join('\n\n')
    .slice(0, 4000);
  const queryEmbedding = await embedQuery(themeQuery, args.voyageDeps);
  const retrievedBible = await searchBible(
    { supabase, voyage: args.voyageDeps, rerankEnabled: args.rerankEnabled },
    { query: themeQuery, k: 3, queryEmbedding },
  );

  const sourceIds = retrievedBible.map(r => r.source_id);
  const { data: passageRows, error: pErr } = await supabase
    .from('bible_passages')
    .select('id, book, chapter, verse_start, verse_end, text')
    .in('id', sourceIds);
  if (pErr) throw pErr;
  const passageById = new Map<string, { book: string; chapter: number; verse_start: number; verse_end: number; text: string }>();
  for (const r of (passageRows ?? []) as Array<{ id: string; book: string; chapter: number; verse_start: number; verse_end: number; text: string }>) {
    passageById.set(r.id, { book: r.book, chapter: r.chapter, verse_start: r.verse_start, verse_end: r.verse_end, text: r.text });
  }
  const passages: DailyDevotionPassage[] = retrievedBible
    .map(r => {
      const p = passageById.get(r.source_id);
      if (!p) return null;
      const refSuffix = p.verse_end !== p.verse_start ? `${p.verse_start}-${p.verse_end}` : `${p.verse_start}`;
      const ref = `${p.book} ${p.chapter}:${refSuffix}`;
      return {
        source_id: r.source_id, text: p.text, ref,
        metadata: { book: p.book, chapter: p.chapter, similarity: r.similarity, rerank_score: r.rerank_score },
      };
    })
    .filter((x): x is DailyDevotionPassage => x !== null);

  return {
    notes, passages,
    voicePreference: args.voicePreference,
    traditionHint: args.traditionHint,
    localDate: args.localDate,
    allowedNoteIds: new Set(notes.map(n => n.id)),
    allowedVerseRefs: new Set(passages.map(p => p.ref)),
    rerankUsed: args.rerankEnabled && passages.length > 0,
  };
}

// ── Connection-why context builder ───────────────────────────────────────
async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

type BuildConnectionWhyContextResult =
  | { kind: 'no_embedding' }
  | { kind: 'not_neighbor' }
  | { kind: 'ok'; context: ConnectionWhyContext };

async function buildConnectionWhyContext(
  supabase: SupabaseClient,
  args: {
    userId: string;
    sourceNoteId: string;
    relatedNoteId: string;
    voicePreference: string;
  },
): Promise<BuildConnectionWhyContextResult> {
  // 1. Load both notes (including tags for shared-signal intersection).
  const { data: noteRows, error: nErr } = await supabase
    .from('notes')
    .select('id, title, content, tags')
    .eq('user_id', args.userId)
    .in('id', [args.sourceNoteId, args.relatedNoteId]);
  if (nErr) throw nErr;
  if (!noteRows || noteRows.length < 2) {
    return { kind: 'not_neighbor' };
  }
  const sourceRow = noteRows.find((r) => r.id === args.sourceNoteId)!;
  const relatedRow = noteRows.find((r) => r.id === args.relatedNoteId)!;

  const sourcePlaintext = extractTextFromNoteContent(sourceRow.content as string);
  const relatedPlaintext = extractTextFromNoteContent(relatedRow.content as string);
  if (!sourcePlaintext.trim() || !relatedPlaintext.trim()) {
    return { kind: 'not_neighbor' };
  }

  // 2. Load source embedding.
  const { data: embRow, error: eErr } = await supabase
    .from('lamplight_embeddings')
    .select('embedding')
    .eq('user_id', args.userId)
    .eq('source_type', 'note')
    .eq('source_id', args.sourceNoteId)
    .maybeSingle();
  if (eErr) throw eErr;
  if (!embRow) return { kind: 'no_embedding' };
  const sourceEmbedding = embRow.embedding as number[];

  // 3. Re-verify neighbor relationship via service-role RPC (migration 012).
  const { data: neighbors, error: mErr } = await supabase.rpc(
    'match_user_note_embeddings',
    {
      p_user_id: args.userId,
      p_query_vector: sourceEmbedding,
      p_exclude_source_id: args.sourceNoteId,
      p_limit: 50,
    },
  );
  if (mErr) throw mErr;

  const currentNeighbor = ((neighbors ?? []) as Array<{
    source_id: string;
    similarity: number;
  }>)
    .filter((n) => n.similarity >= 0.78)
    .slice(0, 5)
    .find((n) => n.source_id === args.relatedNoteId);
  if (!currentNeighbor) {
    return { kind: 'not_neighbor' };
  }

  // 4. Composite hash for cache lookup. content_hash invalidates when either
  // note's plaintext changes.
  const sourceHash = await sha256Hex(sourcePlaintext);
  const relatedHash = await sha256Hex(relatedPlaintext);
  const compositeHash = await sha256Hex(`${sourceHash}:${relatedHash}`);

  // 5. Shared signals via canonical Deno helper (browser mirror has the same
  // logic — see _shared/note-signals.ts and src/notepad/utils/connection-signals.ts).
  const sourceRefs = extractVerseRefsFromNoteContent(sourceRow.content as string);
  const relatedRefs = extractVerseRefsFromNoteContent(relatedRow.content as string);
  const sourceTags = (sourceRow.tags as string[] | null) ?? [];
  const relatedTags = (relatedRow.tags as string[] | null) ?? [];
  const { sharedTags, sharedVerseRefs } = intersectTagsAndVerseRefs(
    { tags: sourceTags, verseRefs: sourceRefs },
    { tags: relatedTags, verseRefs: relatedRefs },
  );

  return {
    kind: 'ok',
    context: {
      userId: args.userId,
      source: {
        id: args.sourceNoteId,
        title: ((sourceRow.title as string) ?? '').trim() || '(untitled)',
        plaintext: sourcePlaintext,
      },
      related: {
        id: args.relatedNoteId,
        title: ((relatedRow.title as string) ?? '').trim() || '(untitled)',
        plaintext: relatedPlaintext,
      },
      similarity: currentNeighbor.similarity,
      voicePreference: args.voicePreference,
      compositeHash,
      sharedTags,
      sharedVerseRefs,
    },
  };
}
