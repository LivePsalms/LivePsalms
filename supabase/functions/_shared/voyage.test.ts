import { describe, it, expect, vi } from 'vitest';
import { embedDocuments, embedQuery, rerank } from './voyage';

function mockFetchOk(payloads: Array<{ embeddings: number[][] }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const body = { data: payloads[i++].embeddings.map(e => ({ embedding: e })) };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return { fn, calls };
}

describe('voyage embed', () => {
  it('sends document input_type and returns vectors', async () => {
    const { fn, calls } = mockFetchOk([{ embeddings: [[0.1, 0.2]] }]);
    const out = await embedDocuments(['hello'], { apiKey: 'k', fetch: fn });
    expect(out).toEqual([[0.1, 0.2]]);
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.input_type).toBe('document');
    expect(body.model).toBe('voyage-3-large');
    expect(body.output_dimension).toBe(1024);
    expect(body.output_dtype).toBe('float');
    expect(body.truncation).toBe(true);
    expect(calls[0].init.headers).toMatchObject({ Authorization: 'Bearer k' });
  });

  it('sends query input_type for embedQuery', async () => {
    const { fn, calls } = mockFetchOk([{ embeddings: [[0.9]] }]);
    const out = await embedQuery('q', { apiKey: 'k', fetch: fn });
    expect(out).toEqual([0.9]);
    expect(JSON.parse(calls[0].init.body as string).input_type).toBe('query');
  });

  it('batches >64 inputs into multiple calls', async () => {
    const inputs = Array.from({ length: 130 }, (_, i) => `t${i}`);
    const { fn, calls } = mockFetchOk([
      { embeddings: Array.from({ length: 64 }, () => [1]) },
      { embeddings: Array.from({ length: 64 }, () => [2]) },
      { embeddings: Array.from({ length: 2  }, () => [3]) },
    ]);
    const out = await embedDocuments(inputs, { apiKey: 'k', fetch: fn });
    expect(out.length).toBe(130);
    expect(calls.length).toBe(3);
  });

  it('retries on 429 with backoff and succeeds', async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts === 1) return new Response('rate limited', { status: 429 });
      return new Response(JSON.stringify({ data: [{ embedding: [1] }] }), { status: 200 });
    });
    const out = await embedDocuments(['x'], { apiKey: 'k', fetch: fn, sleep: async () => {} });
    expect(out).toEqual([[1]]);
    expect(attempts).toBe(2);
  });

  it('throws after 3 failed attempts', async () => {
    const fn = vi.fn(async () => new Response('boom', { status: 500 }));
    await expect(
      embedDocuments(['x'], { apiKey: 'k', fetch: fn, sleep: async () => {} })
    ).rejects.toThrow(/voyage 500/);
    expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  it('returns [] for empty input', async () => {
    const fn = vi.fn();
    expect(await embedDocuments([], { apiKey: 'k', fetch: fn })).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('voyage rerank', () => {
  function mockRerankOk(scores: Array<{ index: number; relevance_score: number }>) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fn = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ data: scores, usage: { total_tokens: 100 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    return { fn, calls };
  }

  it('posts to the rerank endpoint with the correct body', async () => {
    const { fn, calls } = mockRerankOk([
      { index: 1, relevance_score: 0.9 },
      { index: 0, relevance_score: 0.3 },
    ]);
    const out = await rerank('q', ['a', 'b'], 2, { apiKey: 'k', fetch: fn });
    expect(calls[0].url).toBe('https://api.voyageai.com/v1/rerank');
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe('rerank-2.5');
    expect(body.query).toBe('q');
    expect(body.documents).toEqual(['a', 'b']);
    expect(body.top_k).toBe(2);
    expect(out).toEqual([
      { index: 1, score: 0.9 },
      { index: 0, score: 0.3 },
    ]);
  });

  it('retries on 429 with backoff and succeeds', async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts === 1) return new Response('rate limited', { status: 429 });
      return new Response(JSON.stringify({ data: [{ index: 0, relevance_score: 1 }] }), { status: 200 });
    });
    const out = await rerank('q', ['only'], 1, { apiKey: 'k', fetch: fn, sleep: async () => {} });
    expect(out).toEqual([{ index: 0, score: 1 }]);
    expect(attempts).toBe(2);
  });

  it('throws after 3 failed attempts', async () => {
    const fn = vi.fn(async () => new Response('boom', { status: 500 }));
    await expect(
      rerank('q', ['a'], 1, { apiKey: 'k', fetch: fn, sleep: async () => {} })
    ).rejects.toThrow(/voyage rerank 500/);
    expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  it('returns [] for empty documents without hitting the network', async () => {
    const fn = vi.fn();
    expect(await rerank('q', [], 5, { apiKey: 'k', fetch: fn })).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});
