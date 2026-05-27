import { describe, it, expect, vi } from 'vitest';
import { searchNeighbors, searchBible } from './retrieval';

type RpcRow = { id: string; source_id: string; similarity: number; metadata: Record<string, unknown> };

function makeSupabaseStub(rpcRows: Record<string, RpcRow[]>, embeddingRowForNote?: { embedding: number[] }) {
  const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => {
    return { data: rpcRows[name] ?? [], error: null };
  });
  const from = vi.fn((table: string) => {
    if (table === 'lamplight_embeddings') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: embeddingRowForNote ?? null, error: null }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === 'notes') {
      return {
        select: () => ({
          in: () => ({ data: [{ id: 'n1', content: '{"type":"doc","content":[]}' }, { id: 'n2', content: '{"type":"doc","content":[]}' }], error: null }),
        }),
      };
    }
    if (table === 'bible_passages') {
      return {
        select: () => ({
          in: () => ({ data: [{ id: 'psa.23.4', text: 'Even though I walk through the valley…' }], error: null }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
  return { supabase: { rpc, from } as unknown as Parameters<typeof searchBible>[0]['supabase'], rpc, from };
}

const voyageDeps = { apiKey: 'k', fetch: vi.fn() };

describe('searchBible', () => {
  it('embeds the query when no precomputed vector is supplied', async () => {
    const embedFetch = vi.fn(async () => new Response(
      JSON.stringify({ data: [{ embedding: new Array(1024).fill(0.01) }] }),
      { status: 200 },
    ));
    const { supabase, rpc } = makeSupabaseStub({
      match_bible_embeddings: [
        { id: 'e1', source_id: 'psa.23.4', similarity: 0.9, metadata: { book: 'Psalm' } },
      ],
    });
    const out = await searchBible(
      { supabase, voyage: { apiKey: 'k', fetch: embedFetch }, rerankEnabled: false },
      { query: 'rest', k: 1 },
    );
    expect(embedFetch).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('match_bible_embeddings', expect.objectContaining({ p_limit: 1 }));
    expect(out).toHaveLength(1);
    expect(out[0].source_id).toBe('psa.23.4');
  });

  it('skips embedding when queryEmbedding is supplied', async () => {
    const { supabase } = makeSupabaseStub({
      match_bible_embeddings: [
        { id: 'e1', source_id: 'psa.23.4', similarity: 0.9, metadata: {} },
      ],
    });
    const out = await searchBible(
      { supabase, voyage: voyageDeps, rerankEnabled: false },
      { query: 'rest', k: 1, queryEmbedding: new Array(1024).fill(0.5) },
    );
    expect(voyageDeps.fetch).not.toHaveBeenCalled();
    expect(out[0].source_id).toBe('psa.23.4');
  });

  it('with rerank ON reorders the candidates', async () => {
    const rerankFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/v1/rerank')) {
        return new Response(JSON.stringify({
          data: [
            { index: 2, relevance_score: 0.99 },
            { index: 0, relevance_score: 0.5 },
            { index: 1, relevance_score: 0.4 },
          ],
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [{ embedding: new Array(1024).fill(0.01) }] }), { status: 200 });
    });
    const { supabase } = makeSupabaseStub({
      match_bible_embeddings: [
        { id: 'a', source_id: 'psa.1.1', similarity: 0.9, metadata: {} },
        { id: 'b', source_id: 'psa.1.2', similarity: 0.8, metadata: {} },
        { id: 'c', source_id: 'psa.1.3', similarity: 0.7, metadata: {} },
      ],
    });
    const out = await searchBible(
      { supabase, voyage: { apiKey: 'k', fetch: rerankFetch }, rerankEnabled: true },
      { query: 'q', k: 3 },
    );
    expect(out[0].source_id).toBe('psa.1.3');
    expect(out[0].rerank_score).toBe(0.99);
    expect(out[1].source_id).toBe('psa.1.1');
  });

  it('limits results to k', async () => {
    const { supabase } = makeSupabaseStub({
      match_bible_embeddings: Array.from({ length: 50 }, (_, i) => ({
        id: `e${i}`, source_id: `psa.${i}.1`, similarity: 1 - i * 0.01, metadata: {},
      })),
    });
    const out = await searchBible(
      { supabase, voyage: voyageDeps, rerankEnabled: false },
      { query: 'q', k: 5, queryEmbedding: new Array(1024).fill(0) },
    );
    expect(out).toHaveLength(5);
  });
});

describe('searchNeighbors', () => {
  it('returns [] when the note has no embedding row yet', async () => {
    const { supabase } = makeSupabaseStub({}, undefined);
    const out = await searchNeighbors(
      { supabase, voyage: voyageDeps, rerankEnabled: false },
      { userId: 'u1', noteId: 'n1', k: 5 },
    );
    expect(out).toEqual([]);
  });

  it('uses the note\'s stored embedding as the query vector', async () => {
    const { supabase, rpc } = makeSupabaseStub({
      match_user_note_embeddings: [
        { id: 'e2', source_id: 'n2', similarity: 0.95, metadata: {} },
      ],
    }, { embedding: new Array(1024).fill(0.42) });
    const out = await searchNeighbors(
      { supabase, voyage: voyageDeps, rerankEnabled: false },
      { userId: 'u1', noteId: 'n1', k: 5 },
    );
    expect(rpc).toHaveBeenCalledWith(
      'match_user_note_embeddings',
      expect.objectContaining({ p_user_id: 'u1', p_exclude_source_id: 'n1', p_limit: 5 }),
    );
    expect(out[0].source_id).toBe('n2');
  });
});
