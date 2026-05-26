// scripts/backfill-note-embeddings.ts
//
// One-shot backfill: enqueue an embedding_refresh job for every existing
// note belonging to an opted-in user that doesn't already have a current
// lamplight_embeddings row. Idempotent.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     npx tsx scripts/backfill-note-embeddings.ts

import { createClient } from '@supabase/supabase-js';
import { sha256 } from 'js-sha256';
import { extractTextFromNoteContent } from '../supabase/functions/_shared/tiptap-text';

export interface NoteForBackfill { id: string; user_id: string; content: string }
export interface BackfillJobRow {
  user_id: string;
  kind: 'embedding_refresh';
  status: 'queued';
  payload: { note_id: string; content_hash: string };
  scheduled_at: string;
}

export function buildBackfillJobs(notes: NoteForBackfill[]): BackfillJobRow[] {
  const now = new Date().toISOString();
  const out: BackfillJobRow[] = [];
  for (const n of notes) {
    const text = extractTextFromNoteContent(n.content);
    if (!text.trim()) continue;
    out.push({
      user_id: n.user_id,
      kind: 'embedding_refresh',
      status: 'queued',
      payload: { note_id: n.id, content_hash: sha256(text) },
      scheduled_at: now,
    });
  }
  return out;
}

async function main() {
  const url = required('SUPABASE_URL');
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Supabase JS v2 caps single-query responses around 1000 rows;
  // 500 keeps payload sizes predictable while not requiring many pages
  // for typical user-note counts.
  const PAGE = 500;
  let from = 0;
  let totalEnqueued = 0;

  while (true) {
    const { data, error } = await supabase
      .from('notes')
      .select('id, user_id, content')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    const userIds = [...new Set(data.map(n => n.user_id))];
    const { data: settings } = await supabase
      .from('lamplight_settings').select('user_id, enabled').in('user_id', userIds);
    const optedIn = new Set((settings ?? []).filter(s => s.enabled).map(s => s.user_id));

    const noteIds = data.filter(n => optedIn.has(n.user_id)).map(n => n.id);
    if (noteIds.length === 0) { from += PAGE; continue; }

    const { data: existing } = await supabase
      .from('lamplight_embeddings').select('source_id')
      .eq('source_type', 'note').in('source_id', noteIds);
    const haveEmbedding = new Set((existing ?? []).map(e => e.source_id));

    const eligible = data.filter(n => optedIn.has(n.user_id) && !haveEmbedding.has(n.id));
    const jobs = buildBackfillJobs(eligible);
    if (jobs.length > 0) {
      const { error: insErr } = await supabase.from('lamplight_jobs').insert(jobs);
      if (insErr) throw insErr;
      totalEnqueued += jobs.length;
    }
    console.log(`processed ${from + data.length} notes, enqueued ${totalEnqueued} so far`);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`backfill complete: ${totalEnqueued} jobs enqueued`);
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} required`);
  return v;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exit(1); });
}
