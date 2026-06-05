// scripts/backfill-note-embeddings.test.ts
import { describe, it, expect } from 'vitest';
import { buildBackfillJobs, type NoteForBackfill } from './backfill-note-embeddings';

const docOf = (txt: string) =>
  JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: txt }] }] });

describe('buildBackfillJobs', () => {
  it('returns one job per note with sha256 hash', () => {
    const notes: NoteForBackfill[] = [
      { id: 'n1', user_id: 'u1', content: docOf('hello') },
      { id: 'n2', user_id: 'u1', content: docOf('world') },
    ];
    const jobs = buildBackfillJobs(notes);
    expect(jobs).toEqual([
      { user_id: 'u1', kind: 'embedding_refresh', status: 'queued',
        payload: { note_id: 'n1', content_hash: expect.stringMatching(/^[0-9a-f]{64}$/) },
        scheduled_at: expect.any(String) },
      { user_id: 'u1', kind: 'embedding_refresh', status: 'queued',
        payload: { note_id: 'n2', content_hash: expect.stringMatching(/^[0-9a-f]{64}$/) },
        scheduled_at: expect.any(String) },
    ]);
  });

  it('skips empty notes', () => {
    const jobs = buildBackfillJobs([
      { id: 'n1', user_id: 'u1', content: '{"type":"doc","content":[]}' },
      { id: 'n2', user_id: 'u1', content: '' },
    ]);
    expect(jobs).toEqual([]);
  });
});
