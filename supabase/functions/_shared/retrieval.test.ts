import { describe, it, expect, vi } from 'vitest';
import { searchNeighbors, searchBible } from './retrieval';

type RpcRow = {
  id: string;
  source_id: string;
  chunk_index: number;
  chunk_text: string;
  similarity: number;
  metadata: Record<string, unknown>;
};

// Build a chained supabase stub: from(...).select(...).eq(...).eq(...).eq(...).order(...) → { data, error }.
// Returns the rows configured for the (table, source_id) the caller queries.
function makeSupabaseStub(opts: {
  rpcRowsByCall?: Array<RpcRow[]>;          // FIFO per rpc(name) call
  bibleMatchRows?: RpcRow[];                 // for match_bible_embeddings
  sourceNoteChunks?: Array<{ chunk_index: number; chunk_text: string; embedding: number[] }>;
  biblePassageRowsById?: Record<string, string>;
}) {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let rpcCallIdx = 0;
  const rpcRowsByCall = opts.rpcRowsByCall ?? [];

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ name, args });
    if (name === 'match_bible_embeddings') return { data: opts.bibleMatchRows ?? [], error: null };
    if (name === 'match_user_note_embeddings') {
      const rows = rpcRowsByCall[rpcCallIdx] ?? [];
      rpcCallIdx++;
      return { data: rows, error: null };
    }
    return { data: [], error: null };
  });

  const from = vi.fn((table: string) => {
    if (table === 'lamplight_embeddings') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({ data: opts.sourceNoteChunks ?? [], error: null }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === 'bible_passages') {
      const map = opts.biblePassageRowsById ?? {};
      return {
        select: () => ({
          in: () => ({ data: Object.entries(map).map(([id, text]) => ({ id, text })), error: null }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return { supabase: { rpc, from } as unknown as Parameters<typeof searchBible>[0]['supabase'], rpc, from, rpcCalls };
}

const voyageDeps = { apiKey: 'k', fetch: vi.fn() };

describe('searchBible', () => {
  it('embeds the query when no precomputed vector is supplied (512-dim path)', async () => {
    const embedFetch = vi.fn(async () => new Response(
      JSON.stringify({
        object: 'list',
        data: [{
          object: 'list',
          data: [{ object: 'embedding', embedding: new Array(512).fill(0.01), index: 0 }],
          index: 0,
        }],
      }),
      { status: 200 },
    ));
    const { supabase, rpcCalls } = makeSupabaseStub({
      bibleMatchRows: [
        { id: 'e1', source_id: 'psa.23.4', chunk_index: 0, chunk_text: 'Even though…', similarity: 0.9, metadata: { book: 'Psalm' } },
      ],
      biblePassageRowsById: { 'psa.23.4': 'Even though I walk through the valley…' },
    });
    const out = await searchBible(
      { supabase, voyage: { apiKey: 'k', fetch: embedFetch }, rerankEnabled: false },
      { query: 'rest', k: 1 },
    );
    expect(embedFetch).toHaveBeenCalledTimes(1);
    expect(rpcCalls[0].name).toBe('match_bible_embeddings');
    expect(out).toHaveLength(1);
    expect(out[0].source_id).toBe('psa.23.4');
  });
});

describe('searchNeighbors (chunked)', () => {
  it('returns [] when the source note has no chunks', async () => {
    const { supabase } = makeSupabaseStub({ sourceNoteChunks: [] });
    const out = await searchNeighbors(
      { supabase, voyage: voyageDeps, rerankEnabled: false },
      { userId: 'u1', noteId: 'n1', k: 5 },
    );
    expect(out).toEqual([]);
  });

  it('fans out one rpc call per source chunk', async () => {
    const { supabase, rpcCalls } = makeSupabaseStub({
      sourceNoteChunks: [
        { chunk_index: 0, chunk_text: 'first', embedding: new Array(512).fill(0.1) },
        { chunk_index: 1, chunk_text: 'second', embedding: new Array(512).fill(0.2) },
        { chunk_index: 2, chunk_text: 'third', embedding: new Array(512).fill(0.3) },
      ],
      rpcRowsByCall: [
        [{ id: 'a', source_id: 'n2', chunk_index: 0, chunk_text: 'n2 chunk 0', similarity: 0.80, metadata: {} }],
        [{ id: 'b', source_id: 'n2', chunk_index: 1, chunk_text: 'n2 chunk 1', similarity: 0.92, metadata: {} }],
        [{ id: 'c', source_id: 'n3', chunk_index: 0, chunk_text: 'n3 chunk 0', similarity: 0.85, metadata: {} }],
      ],
    });
    const out = await searchNeighbors(
      { supabase, voyage: voyageDeps, rerankEnabled: false },
      { userId: 'u1', noteId: 'n1', k: 5 },
    );
    expect(rpcCalls.filter(c => c.name === 'match_user_note_embeddings')).toHaveLength(3);
    // n2 wins (max sim 0.92), n3 second (0.85).
    expect(out.map(r => r.source_id)).toEqual(['n2', 'n3']);
    expect(out[0].similarity).toBeCloseTo(0.92);
  });

  it('keeps the max similarity when the same target appears in multiple chunk queries', async () => {
    const { supabase } = makeSupabaseStub({
      sourceNoteChunks: [
        { chunk_index: 0, chunk_text: 'src0', embedding: new Array(512).fill(0.1) },
        { chunk_index: 1, chunk_text: 'src1', embedding: new Array(512).fill(0.2) },
      ],
      rpcRowsByCall: [
        [{ id: 'x1', source_id: 'n2', chunk_index: 0, chunk_text: 'tgt0', similarity: 0.81, metadata: {} }],
        [{ id: 'x2', source_id: 'n2', chunk_index: 1, chunk_text: 'tgt1', similarity: 0.85, metadata: {} }],
      ],
    });
    const out = await searchNeighbors(
      { supabase, voyage: voyageDeps, rerankEnabled: false },
      { userId: 'u1', noteId: 'n1', k: 5 },
    );
    expect(out).toHaveLength(1);
    expect(out[0].source_id).toBe('n2');
    expect(out[0].similarity).toBeCloseTo(0.85);
  });

  it('reranks the candidate pool when rerankEnabled is true', async () => {
    const rerankFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/v1/rerank')) {
        return new Response(JSON.stringify({
          data: [
            { index: 1, relevance_score: 0.99 },
            { index: 0, relevance_score: 0.40 },
          ],
        }), { status: 200 });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    const { supabase } = makeSupabaseStub({
      sourceNoteChunks: [
        { chunk_index: 0, chunk_text: 'src winner text', embedding: new Array(512).fill(0.1) },
      ],
      rpcRowsByCall: [
        [
          { id: 'a', source_id: 'n2', chunk_index: 0, chunk_text: 'tgt A',  similarity: 0.90, metadata: {} },
          { id: 'b', source_id: 'n3', chunk_index: 0, chunk_text: 'tgt B',  similarity: 0.80, metadata: {} },
        ],
      ],
    });
    const out = await searchNeighbors(
      { supabase, voyage: { apiKey: 'k', fetch: rerankFetch }, rerankEnabled: true },
      { userId: 'u1', noteId: 'n1', k: 2 },
    );
    // Reranker promoted n3 (relevance 0.99) above n2.
    expect(out.map(r => r.source_id)).toEqual(['n3', 'n2']);
    expect(out[0].rerank_score).toBeCloseTo(0.99);
  });
});
