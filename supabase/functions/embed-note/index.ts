// supabase/functions/embed-note/index.ts
//
// Two payload shapes:
//   { job_id: "<uuid>" }   — process exactly that job (client-triggered).
//   { sweep: true }        — claim up to 5 oldest queued jobs (pg_cron path).
//
// All real-DB / real-Voyage wiring is here; the orchestration loop lives in
// _shared/process-job.ts so it can be unit-tested without Deno or network.
//
// Trust model: the function is deployed with JWT verification enabled at the
// platform level (default; do NOT pass --no-verify-jwt). Anyone calling this
// endpoint must hold a valid Supabase JWT. The handler itself does NOT inspect
// the JWT or verify the caller "owns" the supplied job_id — instead, the
// claim_lamplight_job_by_id RPC only succeeds when the job is still 'queued',
// so a malicious authenticated user can at worst observe `{ processed: 0 }`
// for arbitrary UUIDs. No embedding data is read or written by the function
// on behalf of the calling user; service-role inside the function does the
// actual reads/writes, gated by lamplight_jobs.status transitions.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { embedDocuments } from '../_shared/voyage.ts';
import { recordLamplightUsage } from '../_shared/usage.ts';
import {
  claimAndRun, processJobs,
  type Job, type DbOps, type ClaimFn, type EmbedFn, type ReplaceArgs,
} from '../_shared/process-job.ts';

// CLAIM_LIMIT is the max jobs drained per Edge Function invocation. With pg_cron
// firing the sweep every minute and a typical embed latency of 1-2s per job,
// 5 keeps each invocation under ~15s while preventing queue runaway.
const CLAIM_LIMIT = 5;

// Invoked from the browser by useLamplightEmbeddingTrigger after each save
// (per-job_id path) and also server-to-server by pg_cron (sweep path). The
// browser path requires CORS preflight + allow-origin echoed on every
// response; without it the browser silently drops the invocation and the
// queue only ever drains when pg_cron fires.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS_HEADERS });

  const apiKey = Deno.env.get('VOYAGE_AI_KEY');
  if (!apiKey) return jsonResp({ error: 'VOYAGE_AI_KEY missing' }, 500);

  let body: { job_id?: string; sweep?: boolean };
  try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }

  const supabase = serviceClient();
  const ops = buildOps(supabase);
  const embed: EmbedFn = async (chunksPerDoc) => embedDocuments(chunksPerDoc, { apiKey, fetch });

  if (body.sweep) {
    const claim: ClaimFn = async (limit) => claimQueued(supabase, limit);
    const processed = await claimAndRun(claim, ops, embed, CLAIM_LIMIT);
    return jsonResp({ processed });
  }

  if (typeof body.job_id === 'string') {
    const jobs = await claimOne(supabase, body.job_id);
    await processJobs(jobs, ops, embed);
    return jsonResp({ processed: jobs.length });
  }

  return jsonResp({ error: 'missing job_id or sweep flag' }, 400);
});

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

async function claimQueued(supabase: ReturnType<typeof serviceClient>, limit: number): Promise<Job[]> {
  const { data, error } = await supabase.rpc('claim_lamplight_jobs', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as Job[];
}

async function claimOne(supabase: ReturnType<typeof serviceClient>, jobId: string): Promise<Job[]> {
  const { data, error } = await supabase.rpc('claim_lamplight_job_by_id', { p_job_id: jobId });
  if (error) throw error;
  return (data ?? []) as Job[];
}

function buildOps(supabase: ReturnType<typeof serviceClient>): DbOps {
  return {
    async loadNote(noteId) {
      const { data, error } = await supabase
        .from('notes').select('id, user_id, content').eq('id', noteId).maybeSingle();
      if (error) throw error;
      return data;
    },
    async loadExistingHash(userId, noteId) {
      const { data, error } = await supabase
        .from('lamplight_embeddings')
        .select('content_hash')
        .eq('user_id', userId).eq('source_type', 'note').eq('source_id', noteId)
        .limit(1).maybeSingle();
      if (error) throw error;
      return data?.content_hash ?? null;
    },
    async replaceNoteEmbeddings(args: ReplaceArgs) {
      const { error } = await supabase.rpc('replace_note_embeddings', {
        p_user_id: args.userId,
        p_note_id: args.noteId,
        p_content_hash: args.contentHash,
        p_chunks: args.chunks.map(c => ({
          chunk_index: c.chunk_index,
          chunk_text: c.chunk_text,
          embedding: vectorLiteral(c.embedding),
          metadata: c.metadata ?? {},
        })),
      });
      if (error) throw error;
    },
    async markDone(jobId) {
      const { error } = await supabase.from('lamplight_jobs').update({
        status: 'done',
        finished_at: new Date().toISOString(),
      }).eq('id', jobId);
      if (error) throw error;
    },
    async markFailedOrRetry(job, err, attempts) {
      const errStr = String((err as { message?: string })?.message ?? err).slice(0, 2000);
      if (attempts >= 3) {
        await supabase.from('lamplight_jobs').update({
          status: 'failed', attempts, error: errStr,
          finished_at: new Date().toISOString(),
        }).eq('id', job.id);
      } else {
        const backoffSec = 5 * Math.pow(2, attempts); // 10s, 20s, 40s
        await supabase.from('lamplight_jobs').update({
          status: 'queued', attempts, error: errStr,
          scheduled_at: new Date(Date.now() + backoffSec * 1000).toISOString(),
        }).eq('id', job.id);
      }
    },
    async recordUsage(row) {
      await recordLamplightUsage(supabase, row);
    },
  };
}

// pgvector accepts vector literals as strings in the form "[v1,v2,v3]".
// The RPC casts via (c->>'embedding')::extensions.vector(512), which extracts
// the JSON field as text then lets pgvector parse its own bracketed literal.
// Sending a number[] as JSON would arrive as a native JSON array and pgvector
// would reject the cast — hence we serialize here to the text-literal format.
function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}
