import { describe, it, expect, vi } from 'vitest';
import { embedDocuments, embedQuery, rerank } from './voyage';

// Voyage's contextualized endpoint returns:
//   { data: [{ data: [{ embedding: number[], index }], index }, ...], usage }
// Outer data: one entry per document. Inner data: one entry per chunk.
function mockFetchOk(payloads: Array<{ embeddingsPerDoc: number[][][]; total_tokens?: number }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const payload = payloads[i++];
    const body = {
      object: 'list',
      data: payload.embeddingsPerDoc.map((doc, docIdx) => ({
        object: 'list',
        data: doc.map((chunk, chunkIdx) => ({
          object: 'embedding',
          embedding: chunk,
          index: chunkIdx,
        })),
        index: docIdx,
      })),
      usage: { total_tokens: payload.total_tokens ?? 42 },
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return { fn, calls };
}

describe('voyage embed (contextualized)', () => {
  it('posts to /v1/contextualizedembeddings with inputs: string[][] and model voyage-context-3', async () => {
    const { fn, calls } = mockFetchOk([{ embeddingsPerDoc: [[[0.1, 0.2], [0.3, 0.4]]], total_tokens: 7 }]);
    const out = await embedDocuments([['hello', 'world']], { apiKey: 'k', fetch: fn });
    expect(calls[0].url).toBe('https://api.voyageai.com/v1/contextualizedembeddings');
    expect(out.vectors).toEqual([[[0.1, 0.2], [0.3, 0.4]]]);
    expect(out.totalTokens).toBe(7);
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe('voyage-context-3');
    expect(body.inputs).toEqual([['hello', 'world']]);
    expect(body.input_type).toBe('document');
    expect(body.output_dimension).toBe(512);
    expect(body.output_dtype).toBe('float');
    expect(body.truncation).toBeUndefined();
    expect(calls[0].init.headers).toMatchObject({ Authorization: 'Bearer k' });
  });

  it('embedQuery wraps text as [[text]] with input_type query and returns one vector', async () => {
    const { fn, calls } = mockFetchOk([{ embeddingsPerDoc: [[[0.9, 0.8]]] }]);
    const out = await embedQuery('q', { apiKey: 'k', fetch: fn });
    expect(out).toEqual([0.9, 0.8]);
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.inputs).toEqual([['q']]);
    expect(body.input_type).toBe('query');
  });

  it('batches across the document-count cap', async () => {
    // 130 single-chunk docs; cap is 64 docs per request → 3 calls.
    const docs = Array.from({ length: 130 }, (_, i) => [`t${i}`]);
    const { fn, calls } = mockFetchOk([
      { embeddingsPerDoc: Array.from({ length: 64 }, () => [[1]]), total_tokens: 10 },
      { embeddingsPerDoc: Array.from({ length: 64 }, () => [[2]]), total_tokens: 10 },
      { embeddingsPerDoc: Array.from({ length: 2  }, () => [[3]]), total_tokens: 5  },
    ]);
    const out = await embedDocuments(docs, { apiKey: 'k', fetch: fn });
    expect(out.vectors.length).toBe(130);
    expect(out.totalTokens).toBe(25);
    expect(calls.length).toBe(3);
  });

  it('retries on 429 and succeeds', async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts === 1) return new Response('rate limited', { status: 429 });
      return new Response(JSON.stringify({
        object: 'list',
        data: [{
          object: 'list',
          data: [{ object: 'embedding', embedding: [1], index: 0 }],
          index: 0,
        }],
        usage: { total_tokens: 3 },
      }), { status: 200 });
    });
    const out = await embedDocuments([['x']], { apiKey: 'k', fetch: fn, sleep: async () => {} });
    expect(out.vectors).toEqual([[[1]]]);
    expect(out.totalTokens).toBe(3);
    expect(attempts).toBe(2);
  });

  it('throws after 3 retries on 500', async () => {
    const fn = vi.fn(async () => new Response('boom', { status: 500 }));
    await expect(
      embedDocuments([['x']], { apiKey: 'k', fetch: fn, sleep: async () => {} })
    ).rejects.toThrow(/voyage 500/);
    expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  it('returns [] for empty input without calling fetch', async () => {
    const fn = vi.fn();
    const out = await embedDocuments([], { apiKey: 'k', fetch: fn });
    expect(out.vectors).toEqual([]);
    expect(out.totalTokens).toBe(0);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('voyage rerank (unchanged)', () => {
  function mockRerankOk(scores: Array<{ index: number; relevance_score: number }>) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fn = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ data: scores, usage: { total_tokens: 100 } }), { status: 200 });
    });
    return { fn, calls };
  }

  it('posts to /v1/rerank with rerank-2.5', async () => {
    const { fn, calls } = mockRerankOk([
      { index: 1, relevance_score: 0.9 },
      { index: 0, relevance_score: 0.3 },
    ]);
    const out = await rerank('q', ['a', 'b'], 2, { apiKey: 'k', fetch: fn });
    expect(calls[0].url).toBe('https://api.voyageai.com/v1/rerank');
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe('rerank-2.5');
    expect(out).toEqual([
      { index: 1, score: 0.9 },
      { index: 0, score: 0.3 },
    ]);
  });

  it('returns [] for empty documents without hitting the network', async () => {
    const fn = vi.fn();
    expect(await rerank('q', [], 5, { apiKey: 'k', fetch: fn })).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});
