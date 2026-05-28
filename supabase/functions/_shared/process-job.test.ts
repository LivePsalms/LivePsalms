// supabase/functions/_shared/process-job.test.ts
import { describe, it, expect, vi } from 'vitest';
import { processJobs, extractVoyageErrorCode, type EmbedFn, type DbOps, type EmbeddingRow, type Job } from './process-job';

function makeOps(initial: Partial<{
  note: { id: string; user_id: string; content: string } | null;
  existingHash: string | null;
}> = {}): DbOps & {
  upserts: Array<{ user_id: string | null; source_type: string; source_id: string; content_hash: string; vector: number[] }>;
  markedDone: string[];
  markedFailed: Array<{ id: string; err: string; status: string; attempts: number }>;
  recordUsage: ReturnType<typeof vi.fn>;
} {
  const upserts: EmbeddingRow[] = [];
  const markedDone: string[] = [];
  const markedFailed: Array<{ id: string; err: string; status: string; attempts: number }> = [];
  return {
    upserts, markedDone, markedFailed,
    async loadNote() { return initial.note ?? null; },
    async loadExistingHash() { return initial.existingHash ?? null; },
    async upsertEmbedding(row: EmbeddingRow) { upserts.push(row); },
    async markDone(jobId: string) { markedDone.push(jobId); },
    async markFailedOrRetry(job: Job, err: unknown, attempts: number) {
      const status = attempts >= 3 ? 'failed' : 'queued';
      markedFailed.push({ id: job.id, err: String(err), status, attempts });
    },
    recordUsage: vi.fn(async () => {}),
  } as unknown as DbOps & {
    upserts: EmbeddingRow[];
    markedDone: string[];
    markedFailed: Array<{ id: string; err: string; status: string; attempts: number }>;
    recordUsage: ReturnType<typeof vi.fn>;
  };
}

describe('processJobs', () => {
  it('embeds a fresh note and marks job done', async () => {
    const ops = makeOps({
      note: { id: 'n1', user_id: 'u1', content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }] }) },
      existingHash: null,
    });
    const embed: EmbedFn = vi.fn(async (texts) => ({
      vectors: texts.map(() => new Array(1024).fill(0)),
      totalTokens: 7,
    }));
    const jobs = [{
      id: 'j1', user_id: 'u1', kind: 'embedding_refresh',
      payload: { note_id: 'n1', content_hash: 'newhash' }, attempts: 0,
    }];
    await processJobs(jobs, ops, embed);
    await Promise.resolve(); // drain microtask queue for fire-and-forget recordUsage
    expect(embed).toHaveBeenCalledOnce();
    expect(ops.upserts).toEqual([{
      user_id: 'u1', source_type: 'note', source_id: 'n1',
      content_hash: 'newhash', vector: expect.any(Array),
    }]);
    expect(ops.markedDone).toEqual(['j1']);
    expect(ops.markedFailed).toEqual([]);
    expect(ops.recordUsage).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u1', artifact_kind: 'embedding_refresh', status: 'ok',
      model: 'voyage-3-large', tokens_in: 7, tokens_out: 0,
    }));
  });

  it('skips Voyage when existing hash matches payload hash', async () => {
    const ops = makeOps({
      note: { id: 'n1', user_id: 'u1', content: '{}' },
      existingHash: 'samehash',
    });
    const embed: EmbedFn = vi.fn();
    await processJobs([{
      id: 'j2', user_id: 'u1', kind: 'embedding_refresh',
      payload: { note_id: 'n1', content_hash: 'samehash' }, attempts: 0,
    }], ops, embed);
    expect(embed).not.toHaveBeenCalled();
    expect(ops.upserts).toEqual([]);
    expect(ops.markedDone).toEqual(['j2']);
  });

  it('marks job done when note was deleted', async () => {
    const ops = makeOps({ note: null });
    const embed: EmbedFn = vi.fn();
    await processJobs([{
      id: 'j3', user_id: 'u1', kind: 'embedding_refresh',
      payload: { note_id: 'gone', content_hash: 'h' }, attempts: 0,
    }], ops, embed);
    expect(embed).not.toHaveBeenCalled();
    expect(ops.markedDone).toEqual(['j3']);
  });

  it('marks failed + retry when Voyage throws (attempt < 3)', async () => {
    const ops = makeOps({
      note: { id: 'n1', user_id: 'u1', content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}' },
    });
    const embed: EmbedFn = vi.fn(async () => { throw new Error('voyage 429'); });
    await processJobs([{
      id: 'j4', user_id: 'u1', kind: 'embedding_refresh',
      payload: { note_id: 'n1', content_hash: 'h' }, attempts: 1,
    }], ops, embed);
    expect(ops.markedFailed[0]).toMatchObject({ id: 'j4', status: 'queued', attempts: 2 });
    expect(ops.recordUsage).not.toHaveBeenCalled();
  });

  it('marks failed permanently after 3 attempts', async () => {
    const ops = makeOps({
      note: { id: 'n1', user_id: 'u1', content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}' },
    });
    const embed: EmbedFn = vi.fn(async () => { throw new Error('voyage 500'); });
    await processJobs([{
      id: 'j5', user_id: 'u1', kind: 'embedding_refresh',
      payload: { note_id: 'n1', content_hash: 'h' }, attempts: 2,
    }], ops, embed);
    await Promise.resolve(); // drain microtask queue for fire-and-forget recordUsage
    expect(ops.markedFailed[0]).toMatchObject({ id: 'j5', status: 'failed', attempts: 3 });
    expect(ops.recordUsage).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u1', artifact_kind: 'embedding_refresh', status: 'error',
      model: 'voyage-3-large',
    }));
  });

  it('skips when extracted plaintext is empty', async () => {
    const ops = makeOps({ note: { id: 'n1', user_id: 'u1', content: '{"type":"doc","content":[]}' } });
    const embed: EmbedFn = vi.fn();
    await processJobs([{
      id: 'j6', user_id: 'u1', kind: 'embedding_refresh',
      payload: { note_id: 'n1', content_hash: 'h' }, attempts: 0,
    }], ops, embed);
    expect(embed).not.toHaveBeenCalled();
    expect(ops.markedDone).toEqual(['j6']);
  });

  it('marks unknown-kind jobs failed immediately (no retry)', async () => {
    const ops = makeOps();
    const embed: EmbedFn = vi.fn();
    await processJobs([{
      id: 'j7', user_id: 'u1', kind: 'bogus',
      payload: {}, attempts: 0,
    }], ops, embed);
    expect(embed).not.toHaveBeenCalled();
    expect(ops.markedFailed[0]).toMatchObject({ id: 'j7', status: 'failed', attempts: 3 });
  });
});

describe('extractVoyageErrorCode', () => {
  it('extracts code from "voyage_429"', () => {
    expect(extractVoyageErrorCode(new Error('voyage_429: rate limit'))).toBe('voyage_429');
  });

  it('extracts HTTP status from generic error message', () => {
    expect(extractVoyageErrorCode(new Error('HTTP 503: server error'))).toBe('voyage_503');
  });

  it('falls back to voyage_unknown when no code is present', () => {
    expect(extractVoyageErrorCode(new Error('network failure'))).toBe('voyage_unknown');
  });
});
