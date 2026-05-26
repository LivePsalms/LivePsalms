// supabase/functions/_shared/process-job.test.ts
import { describe, it, expect, vi } from 'vitest';
import { processJobs, claimAndRun, type ClaimFn, type EmbedFn, type DbOps } from './process-job';

function makeOps(initial: Partial<{
  note: { id: string; user_id: string; content: string } | null;
  existingHash: string | null;
}> = {}): DbOps & {
  upserts: Array<{ user_id: string | null; source_type: string; source_id: string; content_hash: string; vector: number[] }>;
  markedDone: string[];
  markedFailed: Array<{ id: string; err: string; status: string; attempts: number }>;
} {
  const upserts: any[] = [];
  const markedDone: string[] = [];
  const markedFailed: any[] = [];
  return {
    upserts, markedDone, markedFailed,
    async loadNote(noteId) { return initial.note ?? null; },
    async loadExistingHash(userId, noteId) { return initial.existingHash ?? null; },
    async upsertEmbedding(row) { upserts.push(row); },
    async markDone(jobId) { markedDone.push(jobId); },
    async markFailedOrRetry(job, err, attempts) {
      const status = attempts >= 3 ? 'failed' : 'queued';
      markedFailed.push({ id: job.id, err: String(err), status, attempts });
    },
  } as any;
}

describe('processJobs', () => {
  it('embeds a fresh note and marks job done', async () => {
    const ops = makeOps({
      note: { id: 'n1', user_id: 'u1', content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }] }) },
      existingHash: null,
    });
    const embed: EmbedFn = vi.fn(async (texts) => texts.map(() => new Array(1024).fill(0.5)));
    const jobs = [{
      id: 'j1', user_id: 'u1', kind: 'embedding_refresh',
      payload: { note_id: 'n1', content_hash: 'newhash' }, attempts: 0,
    }];
    await processJobs(jobs, ops, embed);
    expect(embed).toHaveBeenCalledOnce();
    expect(ops.upserts).toEqual([{
      user_id: 'u1', source_type: 'note', source_id: 'n1',
      content_hash: 'newhash', vector: expect.any(Array),
    }]);
    expect(ops.markedDone).toEqual(['j1']);
    expect(ops.markedFailed).toEqual([]);
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
    expect(ops.markedFailed[0]).toMatchObject({ id: 'j5', status: 'failed', attempts: 3 });
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
});
