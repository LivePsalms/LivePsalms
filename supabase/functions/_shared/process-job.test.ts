// supabase/functions/_shared/process-job.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  processJobs, extractVoyageErrorCode,
  type EmbedFn, type DbOps, type Job, type ReplaceArgs,
} from './process-job';

function jsonNote(paragraphs: string[]): string {
  return JSON.stringify({
    type: 'doc',
    content: paragraphs.map(p => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }],
    })),
  });
}

function makeOps(initial: Partial<{
  note: { id: string; user_id: string; content: string } | null;
  existingHash: string | null;
}> = {}) {
  const replaceCalls: ReplaceArgs[] = [];
  const markedDone: string[] = [];
  const markedFailed: Array<{ id: string; err: string; status: string; attempts: number }> = [];
  const recordUsage = vi.fn(async () => {});

  const ops: DbOps = {
    async loadNote() { return initial.note ?? null; },
    async loadExistingHash() { return initial.existingHash ?? null; },
    async replaceNoteEmbeddings(args: ReplaceArgs) { replaceCalls.push(args); },
    async markDone(jobId: string) { markedDone.push(jobId); },
    async markFailedOrRetry(job: Job, err: unknown, attempts: number) {
      const status = attempts >= 3 ? 'failed' : 'queued';
      markedFailed.push({ id: job.id, err: String(err), status, attempts });
    },
    recordUsage,
  };
  return { ops, replaceCalls, markedDone, markedFailed, recordUsage };
}

describe('processJobs', () => {
  it('chunks the note, embeds chunks together, and replaces atomically', async () => {
    const { ops, replaceCalls, markedDone, recordUsage } = makeOps({
      note: { id: 'n1', user_id: 'u1', content: jsonNote(['paragraph one.', 'paragraph two.']) },
      existingHash: null,
    });
    const embed: EmbedFn = vi.fn(async (chunksPerDoc) => ({
      vectors: chunksPerDoc.map(doc => doc.map(() => new Array(512).fill(0))),
      totalTokens: 7,
    }));
    const jobs: Job[] = [{
      id: 'j1', user_id: 'u1', kind: 'embedding_refresh',
      payload: { note_id: 'n1', content_hash: 'newhash' }, attempts: 0,
    }];
    await processJobs(jobs, ops, embed);
    await Promise.resolve();
    expect(embed).toHaveBeenCalledOnce();
    expect(embed.mock.calls[0][0]).toEqual([['paragraph one.\n\nparagraph two.']]); // greedy-merge: small paragraphs combined
    expect(replaceCalls).toHaveLength(1);
    expect(replaceCalls[0]).toMatchObject({
      userId: 'u1',
      noteId: 'n1',
      contentHash: 'newhash',
    });
    expect(replaceCalls[0].chunks.length).toBeGreaterThanOrEqual(1);
    expect(replaceCalls[0].chunks[0]).toMatchObject({
      chunk_index: 0,
      chunk_text: expect.any(String),
      embedding: expect.any(Array),
    });
    expect(markedDone).toEqual(['j1']);
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u1', artifact_kind: 'embedding_refresh', status: 'ok',
      model: 'voyage-context-3', tokens_in: 7, tokens_out: 0,
    }));
  });

  it('skips Voyage when existing hash matches payload hash', async () => {
    const { ops, replaceCalls, markedDone } = makeOps({
      note: { id: 'n1', user_id: 'u1', content: '{}' },
      existingHash: 'samehash',
    });
    const embed: EmbedFn = vi.fn();
    await processJobs([{
      id: 'j2', user_id: 'u1', kind: 'embedding_refresh',
      payload: { note_id: 'n1', content_hash: 'samehash' }, attempts: 0,
    }], ops, embed);
    expect(embed).not.toHaveBeenCalled();
    expect(replaceCalls).toEqual([]);
    expect(markedDone).toEqual(['j2']);
  });

  it('marks job done when note was deleted', async () => {
    const { ops, replaceCalls, markedDone } = makeOps({ note: null });
    const embed: EmbedFn = vi.fn();
    await processJobs([{
      id: 'j3', user_id: 'u1', kind: 'embedding_refresh',
      payload: { note_id: 'gone', content_hash: 'h' }, attempts: 0,
    }], ops, embed);
    expect(embed).not.toHaveBeenCalled();
    expect(replaceCalls).toEqual([]);
    expect(markedDone).toEqual(['j3']);
  });

  it('skips when extracted plaintext is empty', async () => {
    const { ops, replaceCalls, markedDone } = makeOps({
      note: { id: 'n1', user_id: 'u1', content: '{"type":"doc","content":[]}' },
    });
    const embed: EmbedFn = vi.fn();
    await processJobs([{
      id: 'j6', user_id: 'u1', kind: 'embedding_refresh',
      payload: { note_id: 'n1', content_hash: 'h' }, attempts: 0,
    }], ops, embed);
    expect(embed).not.toHaveBeenCalled();
    expect(replaceCalls).toEqual([]);
    expect(markedDone).toEqual(['j6']);
  });

  it('produces multiple chunks for a long note', async () => {
    // Two paragraphs that won't merge (first hits MIN_TOKENS).
    const big = 'word '.repeat(120).trim(); // ~120 words, ~150 tokens
    const note = jsonNote([big, big]);
    const { ops, replaceCalls } = makeOps({
      note: { id: 'n1', user_id: 'u1', content: note },
    });
    const embed: EmbedFn = vi.fn(async (chunksPerDoc) => ({
      vectors: chunksPerDoc.map(doc => doc.map(() => new Array(512).fill(0))),
      totalTokens: 200,
    }));
    await processJobs([{
      id: 'j7', user_id: 'u1', kind: 'embedding_refresh',
      payload: { note_id: 'n1', content_hash: 'h' }, attempts: 0,
    }], ops, embed);
    expect(replaceCalls[0].chunks.length).toBe(2);
    expect(replaceCalls[0].chunks[0].chunk_index).toBe(0);
    expect(replaceCalls[0].chunks[1].chunk_index).toBe(1);
  });

  it('marks failed + retry when Voyage throws (attempt < 3)', async () => {
    const { ops, markedFailed, recordUsage } = makeOps({
      note: { id: 'n1', user_id: 'u1', content: jsonNote(['x']) },
    });
    const embed: EmbedFn = vi.fn(async () => { throw new Error('voyage 429'); });
    await processJobs([{
      id: 'j4', user_id: 'u1', kind: 'embedding_refresh',
      payload: { note_id: 'n1', content_hash: 'h' }, attempts: 1,
    }], ops, embed);
    expect(markedFailed[0]).toMatchObject({ id: 'j4', status: 'queued', attempts: 2 });
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it('marks failed permanently after 3 attempts and records error usage', async () => {
    const { ops, markedFailed, recordUsage } = makeOps({
      note: { id: 'n1', user_id: 'u1', content: jsonNote(['x']) },
    });
    const embed: EmbedFn = vi.fn(async () => { throw new Error('voyage 500'); });
    await processJobs([{
      id: 'j5', user_id: 'u1', kind: 'embedding_refresh',
      payload: { note_id: 'n1', content_hash: 'h' }, attempts: 2,
    }], ops, embed);
    await Promise.resolve();
    expect(markedFailed[0]).toMatchObject({ id: 'j5', status: 'failed', attempts: 3 });
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u1', artifact_kind: 'embedding_refresh', status: 'error',
      model: 'voyage-context-3',
    }));
  });

  it('marks unknown-kind jobs failed immediately (no retry)', async () => {
    const { ops, markedFailed } = makeOps();
    const embed: EmbedFn = vi.fn();
    await processJobs([{
      id: 'j7', user_id: 'u1', kind: 'bogus',
      payload: {}, attempts: 0,
    }], ops, embed);
    expect(embed).not.toHaveBeenCalled();
    expect(markedFailed[0]).toMatchObject({ id: 'j7', status: 'failed', attempts: 3 });
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
