// supabase/functions/embed-note/index.ts
//
// Two payload shapes:
//   { job_id: "<uuid>" }   — process exactly that job (client-triggered).
//   { sweep: true }        — claim up to 5 oldest queued jobs (pg_cron path).
//
// All real-DB / real-Voyage wiring is here; the orchestration loop lives in
// _shared/process-job.ts so it can be unit-tested without Deno or network.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { embedDocuments } from '../_shared/voyage.ts';
import {
  claimAndRun, processJobs,
  type Job, type DbOps, type ClaimFn, type EmbedFn,
} from '../_shared/process-job.ts';

const CLAIM_LIMIT = 5;

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const apiKey = Deno.env.get('VOYAGE_AI_KEY');
  if (!apiKey) return jsonResp({ error: 'VOYAGE_AI_KEY missing' }, 500);

  let body: { job_id?: string; sweep?: boolean };
  try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }

  const supabase = serviceClient();
  const ops = buildOps(supabase);
  const embed: EmbedFn = async (texts) => embedDocuments(texts, { apiKey, fetch });

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
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
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
        .maybeSingle();
      if (error) throw error;
      return data?.content_hash ?? null;
    },
    async upsertEmbedding(row) {
      const { error } = await supabase.from('lamplight_embeddings').upsert({
        user_id: row.user_id,
        source_type: row.source_type,
        source_id: row.source_id,
        content_hash: row.content_hash,
        embedding: row.vector,
      }, { onConflict: 'user_id,source_type,source_id' });
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
  };
}
