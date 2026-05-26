import { describe, it, expect, beforeEach } from 'vitest';
import { FakeLamplightAdapter } from './fake-lamplight-adapter';

describe('FakeLamplightAdapter.enqueueEmbedding', () => {
  let a: FakeLamplightAdapter;
  beforeEach(() => { a = new FakeLamplightAdapter(); });

  it('returns a job id on first enqueue', async () => {
    const id = await a.enqueueEmbedding('n1', 'h1');
    expect(id).toBe('job-n1-h1');
    expect(a.enqueueCalls).toEqual([{ noteId: 'n1', contentHash: 'h1' }]);
  });

  it('returns null when the same hash is enqueued twice', async () => {
    await a.enqueueEmbedding('n1', 'h1');
    const second = await a.enqueueEmbedding('n1', 'h1');
    expect(second).toBeNull();
    expect(a.enqueueCalls.length).toBe(2);
  });

  it('returns a new job id when hash changes', async () => {
    const a1 = await a.enqueueEmbedding('n1', 'h1');
    const a2 = await a.enqueueEmbedding('n1', 'h2');
    expect(a1).not.toBe(a2);
    expect(a2).toBe('job-n1-h2');
  });
});
