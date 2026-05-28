// supabase/functions/_shared/process-job.ts
import { extractTextFromNoteContent } from './tiptap-text.ts';

export interface Job {
  id: string;
  user_id: string;
  kind: string;
  payload: { note_id?: string; content_hash?: string };
  attempts: number;
}

export interface NoteRow {
  id: string;
  user_id: string;
  content: string;
}

export interface EmbeddingRow {
  user_id: string | null;
  source_type: 'note' | 'bible_passage';
  source_id: string;
  content_hash: string;
  vector: number[];
}

export interface DbOps {
  loadNote(noteId: string): Promise<NoteRow | null>;
  loadExistingHash(userId: string, noteId: string): Promise<string | null>;
  upsertEmbedding(row: EmbeddingRow): Promise<void>;
  markDone(jobId: string): Promise<void>;
  markFailedOrRetry(job: Job, err: unknown, attempts: number): Promise<void>;
  recordUsage(row: {
    user_id: string;
    model: 'voyage-3-large';
    artifact_kind: 'embedding_refresh';
    tokens_in: number;
    tokens_out: number;
    status: 'ok' | 'error';
    error_code?: string | null;
  }): Promise<void>;
}

export type EmbedFn = (texts: string[]) => Promise<{ vectors: number[][]; totalTokens: number }>;
export type ClaimFn = (limit: number) => Promise<Job[]>;

const MAX_ATTEMPTS = 3;
export { MAX_ATTEMPTS };

export async function processJobs(jobs: Job[], ops: DbOps, embed: EmbedFn): Promise<void> {
  for (const job of jobs) {
    // Validation — failures here are permanent (misconfiguration, not transient).
    if (job.kind !== 'embedding_refresh') {
      await ops.markFailedOrRetry(job, new Error(`unknown job kind: ${job.kind}`), MAX_ATTEMPTS);
      continue;
    }
    const noteId = job.payload.note_id;
    const newHash = job.payload.content_hash;
    if (!noteId || !newHash) {
      await ops.markFailedOrRetry(job, new Error('invalid payload'), MAX_ATTEMPTS);
      continue;
    }

    // Lookups — errors propagate; they're not "embedding errors" and shouldn't retry.
    const note = await ops.loadNote(noteId);
    if (!note) { await ops.markDone(job.id); continue; }

    const existing = await ops.loadExistingHash(note.user_id, noteId);
    if (existing === newHash) { await ops.markDone(job.id); continue; }

    const plaintext = extractTextFromNoteContent(note.content);
    if (!plaintext.trim()) { await ops.markDone(job.id); continue; }

    // The only retryable region — Voyage call + upsert. If markDone after this
    // throws, that error bubbles up rather than triggering a re-queue (which
    // would cause double-billing because the embedding was already written).
    const embeddingRow: EmbeddingRow = {
      user_id: note.user_id,
      source_type: 'note',
      source_id: noteId,
      content_hash: newHash,
      vector: [],
    };

    let vectors: number[][];
    let tokensIn: number;
    try {
      const result = await embed([plaintext]);
      vectors = result.vectors;
      tokensIn = result.totalTokens;
      await ops.upsertEmbedding({ ...embeddingRow, vector: vectors[0] });
    } catch (err) {
      await ops.markFailedOrRetry(job, err, (job.attempts ?? 0) + 1);
      if ((job.attempts ?? 0) + 1 >= MAX_ATTEMPTS) {
        void ops.recordUsage({
          user_id: note.user_id,
          model: 'voyage-3-large',
          artifact_kind: 'embedding_refresh',
          tokens_in: 0,
          tokens_out: 0,
          status: 'error',
          error_code: extractVoyageErrorCode(err),
        }).catch(() => {});
      }
      continue;
    }

    void ops.recordUsage({
      user_id: note.user_id,
      model: 'voyage-3-large',
      artifact_kind: 'embedding_refresh',
      tokens_in: tokensIn,
      tokens_out: 0,
      status: 'ok',
    }).catch(() => {});
    await ops.markDone(job.id);
  }
}

export async function claimAndRun(claim: ClaimFn, ops: DbOps, embed: EmbedFn, limit: number): Promise<number> {
  const jobs = await claim(limit);
  await processJobs(jobs, ops, embed);
  return jobs.length;
}

export function extractVoyageErrorCode(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err);
  const m = msg.match(/voyage_(\d+)/i) ?? msg.match(/\b(4\d\d|5\d\d)\b/);
  return m ? `voyage_${m[1]}` : 'voyage_unknown';
}
