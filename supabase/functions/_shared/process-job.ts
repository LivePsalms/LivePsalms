// supabase/functions/_shared/process-job.ts
import { extractTextFromNoteContent } from './tiptap-text';

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
}

export type EmbedFn = (texts: string[]) => Promise<number[][]>;
export type ClaimFn = (limit: number) => Promise<Job[]>;

const MAX_ATTEMPTS = 3;

export async function processJobs(jobs: Job[], ops: DbOps, embed: EmbedFn): Promise<void> {
  for (const job of jobs) {
    try {
      if (job.kind !== 'embedding_refresh') {
        throw new Error(`unknown job kind: ${job.kind}`);
      }
      const noteId = job.payload.note_id;
      const newHash = job.payload.content_hash;
      if (!noteId || !newHash) throw new Error('invalid payload');

      const note = await ops.loadNote(noteId);
      if (!note) { await ops.markDone(job.id); continue; }

      const existing = await ops.loadExistingHash(note.user_id, noteId);
      if (existing === newHash) { await ops.markDone(job.id); continue; }

      const plaintext = extractTextFromNoteContent(note.content);
      if (!plaintext.trim()) { await ops.markDone(job.id); continue; }

      const [vector] = await embed([plaintext]);
      await ops.upsertEmbedding({
        user_id: note.user_id,
        source_type: 'note',
        source_id: noteId,
        content_hash: newHash,
        vector,
      });
      await ops.markDone(job.id);
    } catch (err) {
      await ops.markFailedOrRetry(job, err, (job.attempts ?? 0) + 1);
    }
  }
}

export async function claimAndRun(claim: ClaimFn, ops: DbOps, embed: EmbedFn, limit: number): Promise<number> {
  const jobs = await claim(limit);
  await processJobs(jobs, ops, embed);
  return jobs.length;
}
