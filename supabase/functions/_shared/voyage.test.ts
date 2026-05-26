import { describe, it, expect, vi } from 'vitest';
import { embedDocuments, embedQuery } from './voyage';

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
