// Retrieval helpers for the Reasoning Layer. Wraps the match_* RPCs and
// optionally reranks via Voyage. Pure (modulo injected supabase + voyage deps).

import type { SupabaseClient } from '@supabase/supabase-js';
import { embedQuery, rerank, type VoyageDeps } from './voyage.ts';

export interface RetrievalDeps {
  supabase: SupabaseClient;
  voyage: VoyageDeps;
  rerankEnabled: boolean;
}

export interface RetrievedItem {
  id: string;
  source_id: string;
  similarity: number;
  rerank_score?: number;
  metadata: Record<string, unknown>;
}

interface MatchRow {
  id: string;
  source_id: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

const POOL_SIZE = 50;

export async function searchBible(
  deps: RetrievalDeps,
  args: { query: string; k: number; queryEmbedding?: number[] },
): Promise<RetrievedItem[]> {
  const vector = args.queryEmbedding ?? await embedQuery(args.query, deps.voyage);
  const limit = deps.rerankEnabled ? POOL_SIZE : args.k;
  const { data, error } = await deps.supabase.rpc('match_bible_embeddings', {
    p_query_vector: vector,
    p_limit: limit,
  });
  if (error) throw error;
  const rows = (data ?? []) as MatchRow[];
  if (rows.length === 0) return [];

  if (!deps.rerankEnabled) {
    return rows.slice(0, args.k).map(r => ({ ...r }));
  }
  return rerankBibleRows(deps, args.query, rows, args.k);
}

export async function searchNeighbors(
  deps: RetrievalDeps,
  args: { userId: string; noteId: string; k: number },
): Promise<RetrievedItem[]> {
  const { data: row, error } = await deps.supabase
    .from('lamplight_embeddings')
    .select('embedding')
    .eq('user_id', args.userId)
    .eq('source_type', 'note')
    .eq('source_id', args.noteId)
    .maybeSingle();
  if (error) throw error;
  if (!row?.embedding) return [];

  const limit = deps.rerankEnabled ? POOL_SIZE : args.k;
  const { data, error: rpcErr } = await deps.supabase.rpc('match_user_note_embeddings', {
    p_user_id: args.userId,
    p_query_vector: row.embedding,
    p_exclude_source_id: args.noteId,
    p_limit: limit,
  });
  if (rpcErr) throw rpcErr;
  const rows = (data ?? []) as MatchRow[];
  if (rows.length === 0) return [];

  if (!deps.rerankEnabled) {
    return rows.slice(0, args.k).map(r => ({ ...r }));
  }
  return rerankNoteRows(deps, rows, args.k);
}

async function rerankBibleRows(
  deps: RetrievalDeps,
  query: string,
  rows: MatchRow[],
  k: number,
): Promise<RetrievedItem[]> {
  const sourceIds = rows.map(r => r.source_id);
  const { data, error } = await deps.supabase
    .from('bible_passages')
    .select('id, text')
    .in('id', sourceIds);
  if (error) throw error;
  const textById = new Map<string, string>();
  for (const r of (data ?? []) as Array<{ id: string; text: string }>) textById.set(r.id, r.text);
  const documents = rows.map(r => textById.get(r.source_id) ?? '');
  const scored = await rerank(query, documents, k, deps.voyage);
  return scored.map(s => ({
    ...rows[s.index],
    rerank_score: s.score,
  }));
}

async function rerankNoteRows(
  deps: RetrievalDeps,
  rows: MatchRow[],
  _k: number,
): Promise<RetrievedItem[]> {
  // Note-side rerank intentionally a pass-through pending sub-project 5
  // (Connection Cards), which has the call-site context to choose a
  // meaningful query string.
  return rows.slice(0, _k).map(r => ({ ...r }));
}
