# Lamplight — Signal Layer (Sub-Project 2)

**Status:** Draft (2026-05-26)
**Owner:** Notepad — AI companion feature
**Parent brief:** `Lamplight_AI_details.md` (root)
**Predecessor:** Sub-Project 1 — Foundation (`2026-05-25-lamplight-foundation-design.md`, shipped)
**Companion sub-projects (future):** Reasoning Layer · Today's Lamp · Connection Cards · Entitlements UI · Doctrinal Review

## Purpose

Foundation laid down the Lamplight schema, the four-state tab panel, the consent flow, the profile section, and the forget-data action — but produced **zero embeddings and zero LLM calls**. Signal Layer is the next slice: it lights up the embedding pipeline that every downstream Lamplight function depends on.

After this slice ships:

1. Every saved user note (for opted-in users) is converted to a 1024-dim vector and stored in `lamplight_embeddings`.
2. The Berean Standard Bible (BSB) corpus — ~31K verses + ~1.2K pericopes — is ingested into `bible_passages` and embedded into `lamplight_embeddings`.
3. A reusable Edge Function processes the embedding queue with retry, idempotency, and graceful failure.
4. A one-shot backfill seeds embeddings for notes written before Signal Layer existed.

**Still zero LLM calls.** Generation (Today's Lamp, Connection Cards, etc.) lands in sub-projects 3–5 on top of the vectors we produce here.

The slice is sized for ~1 week, one engineer.

## Decisions log

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Embedding model | **`voyage-3-large`, 1024-dim float** | Stable GA. Matches Foundation's locked `vector(1024)`. State-of-the-art general-purpose English. Matryoshka-capable; we use the default 1024 dimension. |
| 2 | `input_type` discipline | **Always set** | `'document'` for indexing, `'query'` for retrieval (retrieval lands in sub-project 3). Omitting silently degrades recall. |
| 3 | Index type | **HNSW (upgrade from Foundation's `ivfflat`)** | Better recall on small-medium corpora; no training step; predictable. Table is empty today so the swap is a single DROP+CREATE. |
| 4 | Enqueue trigger | **Client-side debounced RPC** | Browser computes `content_hash` after debounced save, calls `enqueue_lamplight_embedding` RPC. Server-side DB triggers fire too eagerly on no-op updates and waste credits. |
| 5 | Worker runtime | **Supabase Edge Function (Deno)** | Same vendor as DB. Service-role key access. Direct `fetch` to Voyage rather than the npm SDK (Node-shaped deps). |
| 6 | Worker invocation modes | **Direct invoke + `pg_cron` sweep** | Client `supabase.functions.invoke('embed-note', { job_id })` for sub-second latency. `pg_cron` `* * * * *` calls the same function with `{ sweep: true }` to drain orphans. |
| 7 | Bible corpus source | **BSB public-domain JSON** | From `bereanbible.com`. Per-verse + per-pericope granularity (the brief's choice). One-time ingest cost < $1. |
| 8 | Bible storage owner | **`user_id = NULL`** | Reuses `lamplight_embeddings` with a NULL owner so the existing RLS policies (`auth.uid() = user_id` → NULL → false) naturally hide system rows from authenticated users. Postgres FK MATCH SIMPLE allows NULL columns to skip FK enforcement, so the existing `references profiles(id) on delete cascade` stays intact for note rows. A CHECK constraint enforces `source_type='bible_passage' ↔ user_id IS NULL`. |
| 9 | Invalidation strategy | **Deterministic `content_hash`** | `sha256(plaintext)`. The "20% diff" heuristic from the brief is dropped in favor of a hash that's either equal or not. |
| 10 | Existing-note backfill | **One-shot SQL insert + queue drain** | Runs once at deploy. Enqueues `embedding_refresh` for every opted-in user's notes that lack a current embedding. |

## Scope

### In

- Migration `011_lamplight_signal_layer.sql`:
  - DROP+CREATE `lamplight_embeddings` index from `ivfflat` to HNSW.
  - Unique constraint on `(user_id, source_type, source_id)` for clean upserts.
  - `enqueue_lamplight_embedding(p_note_id uuid, p_content_hash text)` RPC (SECURITY DEFINER, auth-checked).
  - `pg_cron` schedule for the sweep tick.
- Supabase Edge Function `embed-note` handling two payloads:
  - `{ job_id }` — direct invoke from the client after enqueue.
  - `{ sweep: true }` — cron path, claims up to 5 oldest queued jobs.
- Shared Deno modules under `supabase/functions/_shared/`:
  - `voyage.ts` — typed wrapper around `POST /v1/embeddings` with retry + batching.
  - `tiptap-text.ts` — Deno-friendly port of `src/notepad/utils/tiptap-text.ts`.
- Browser hook `useLamplightEmbeddingTrigger()` — wired into the existing debounced save path. Computes `sha256(plaintext)`, calls the RPC, then fires `supabase.functions.invoke('embed-note', { job_id })` (fire-and-forget; failure is non-fatal because the sweep will catch it).
- Scripts:
  - `scripts/ingest-bsb.ts` — one-time BSB ingest + embedding (verses + pericopes). Idempotent.
  - `scripts/backfill-note-embeddings.ts` — one-shot enqueue of existing notes for opted-in users.
- Tests:
  - Voyage client (mocked transport): batching, retry, error mapping.
  - `enqueue_lamplight_embedding` RPC: auth check, opt-in check, hash-skip, queued-job coalescing.
  - Edge Function: happy path, retry path, failure path, both invocation modes (Voyage mocked).
  - Extension to `rls-isolation.test.ts`: user A cannot read user B's embeddings; Bible rows (`user_id IS NULL`) hidden from both.
  - Backfill SQL: idempotency, opted-out-user exclusion.

### Out

- Any LLM call. Anthropic SDK still not installed (sub-project 3).
- Today's Lamp, Connection Cards, Weekly Insight generation (sub-projects 4–5).
- Reranking via `rerank-2.5` (sub-project 3+).
- ESV / NIV API integration (V1; BSB only for now).
- voyage-context-3 contextualized embeddings (revisit when it leaves preview).
- Chunked note embeddings — current design stores one vector per whole note. Revisit if avg note length crosses ~4K tokens.
- Per-user Voyage cost cap / rate limit. Voyage's `truncation: true` flag protects against runaway-token notes; abuse-grade rate limiting is YAGNI'd until we observe abuse.
- UI changes. Signal Layer is invisible to users — no surface in the tab, no indicator, no progress bar. `<OptedInPlaceholder />` continues to render the Foundation copy.
- Edge Function authorization beyond service-role token. The function is invoked only by authenticated clients and `pg_cron`; both carry an `Authorization` header the function verifies.

## Database — migration `011_lamplight_signal_layer.sql`

### Nullable owner + source-type CHECK

Bible passages are owned by no user. The cleanest expression is `user_id IS NULL`.

```sql
alter table public.lamplight_embeddings
  alter column user_id drop not null;

alter table public.lamplight_embeddings
  add constraint lamplight_embeddings_owner_check
  check (
    (source_type = 'note'          and user_id is not null) or
    (source_type = 'bible_passage' and user_id is null)
  );
```

Postgres FK MATCH SIMPLE (the default) silently passes when any FK column is NULL, so `user_id references profiles(id) on delete cascade` from migration 008 continues to enforce note rows only. The four existing RLS policies on `lamplight_embeddings` (`auth.uid() = user_id`) evaluate to NULL → false for Bible rows, hiding them from authenticated clients without any policy change.

### Index swap (`ivfflat` → HNSW) + uniqueness

Migration 008 created two indexes on `lamplight_embeddings`:

- `lamplight_embeddings_ivfflat` — the ANN index.
- `lamplight_embeddings_user_source` — a *non-unique* btree on `(user_id, source_type, source_id)`.

We drop both and replace them with:

```sql
drop index if exists public.lamplight_embeddings_ivfflat;
drop index if exists public.lamplight_embeddings_user_source;

-- Better-recall ANN index for our small-medium corpus.
create index lamplight_embeddings_embedding_hnsw
  on public.lamplight_embeddings using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Unique constraint doubles as the lookup index; NULLS NOT DISTINCT
-- makes Bible rows (user_id = NULL) unique on source_id alone.
alter table public.lamplight_embeddings
  add constraint lamplight_embeddings_source_uq
  unique nulls not distinct (user_id, source_type, source_id);
```

`m=16, ef_construction=64` are pgvector's documented sensible defaults. We can tune `ef_search` per-query later once retrieval lands.

The unique constraint lets the Edge Function `INSERT … ON CONFLICT (user_id, source_type, source_id) DO UPDATE` without read-modify-write. `NULLS NOT DISTINCT` (Postgres 15+) is required so two Bible rows with the same `source_id` and `user_id IS NULL` are recognized as a conflict rather than two distinct rows.

### RPC `enqueue_lamplight_embedding`

```sql
create or replace function enqueue_lamplight_embedding(
  p_note_id uuid,
  p_content_hash text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_hash text;
  v_job_id uuid;
begin
  if not exists (
    select 1 from notes where id = p_note_id and user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1 from lamplight_settings
    where user_id = auth.uid() and enabled = true
  ) then
    return null;
  end if;

  select content_hash into v_existing_hash
  from lamplight_embeddings
  where user_id = auth.uid()
    and source_type = 'note'
    and source_id = p_note_id::text;

  if v_existing_hash = p_content_hash then
    return null;
  end if;

  select id into v_job_id
  from lamplight_jobs
  where user_id = auth.uid()
    and kind = 'embedding_refresh'
    and status = 'queued'
    and payload->>'note_id' = p_note_id::text;

  if v_job_id is not null then
    return v_job_id;
  end if;

  insert into lamplight_jobs (user_id, kind, status, payload, scheduled_at)
  values (
    auth.uid(),
    'embedding_refresh',
    'queued',
    jsonb_build_object('note_id', p_note_id, 'content_hash', p_content_hash),
    now()
  )
  returning id into v_job_id;

  return v_job_id;
end;
$$;

grant execute on function enqueue_lamplight_embedding(uuid, text) to authenticated;
```

`SECURITY DEFINER` lets the function read `notes` and `lamplight_settings` without depending on per-table RLS — but every branch explicitly checks `auth.uid()`. No bypass.

### `pg_cron` sweep

Requires the `pg_cron` and `pg_net` extensions (both available on Supabase). The migration enables them up-front:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

Then schedule the sweep:

```sql
select cron.schedule(
  'lamplight_embed_sweep',
  '* * * * *',  -- every minute
  $$
  select net.http_post(
    url := current_setting('app.settings.embed_fn_url', true),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{"sweep": true}'::jsonb
  );
  $$
);
```

The two settings are provisioned out-of-band with:

```sql
alter database postgres set app.settings.embed_fn_url        = 'https://<project>.functions.supabase.co/embed-note';
alter database postgres set app.settings.service_role_key    = '<service-role-jwt>';
```

These run in a separate post-deploy step (the service role key should not be committed to a migration file). The migration's `current_setting(... , true)` form returns NULL if the setting is missing, so the cron call no-ops gracefully on a fresh local DB without the secrets.

## Adapter additions

### `src/notepad/storage/lamplight-adapter.ts` (extend Foundation)

Add one method:

```ts
export interface LamplightAdapter {
  // … existing Foundation methods …
  enqueueEmbedding(noteId: string, contentHash: string): Promise<string | null>;
}
```

### `src/notepad/storage/supabase-lamplight-adapter.ts`

```ts
async enqueueEmbedding(noteId: string, contentHash: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('enqueue_lamplight_embedding', {
    p_note_id: noteId,
    p_content_hash: contentHash,
  });
  if (error) throw error;
  return data; // job id or null
}
```

### `src/notepad/hooks/useLamplightEmbeddingTrigger.ts` (new)

```ts
export function useLamplightEmbeddingTrigger() {
  const adapter = useLamplightAdapter();
  const { settings } = useLamplightSettings();
  return useCallback(async (note: Note) => {
    if (!settings?.enabled) return;
    const plaintext = extractTextFromNote(note);
    if (plaintext.trim().length === 0) return;
    const hash = sha256(plaintext);
    const jobId = await adapter.enqueueEmbedding(note.id, hash).catch(() => null);
    if (!jobId) return; // RPC said no-op (hash unchanged or opted out)
    // Fire-and-forget. If invoke fails, the cron sweep picks it up within 60s.
    supabase.functions.invoke('embed-note', { body: { job_id: jobId } }).catch(() => {});
  }, [adapter, settings?.enabled]);
}
```

`sha256` comes from `js-sha256` (3 KB, no native deps). The hook is called from the notepad's existing debounced autosave flow — one new line at the call site.

## Edge Function — `supabase/functions/embed-note/index.ts`

Single Deno function. Accepts two payload shapes.

```ts
// Pseudocode shape — full implementation in the plan.
serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const body = await req.json();

  let jobs;
  if (body.sweep) {
    jobs = await claimQueuedJobs(supabase, 5);
  } else if (typeof body.job_id === 'string') {
    jobs = await claimOneJob(supabase, body.job_id);
  } else {
    return json({ error: 'bad payload' }, 400);
  }

  for (const job of jobs) {
    try {
      if (job.kind === 'embedding_refresh') {
        await processNoteEmbedding(supabase, job);
      } else {
        throw new Error(`unknown job kind: ${job.kind}`);
      }
      await markDone(supabase, job.id);
    } catch (err) {
      await markFailedOrRetry(supabase, job, err);
    }
  }
  return json({ processed: jobs.length });
});
```

### Claim semantics

```sql
update lamplight_jobs
   set status = 'running', started_at = now()
 where id in (
   select id from lamplight_jobs
    where status = 'queued'
      and scheduled_at <= now()
      and kind = 'embedding_refresh'
    order by scheduled_at
    limit $1
    for update skip locked
 )
returning *;
```

`FOR UPDATE SKIP LOCKED` is the canonical Postgres queue pattern — concurrent function invocations never double-claim.

### `processNoteEmbedding(supabase, job)`

1. Load note: `select content, user_id from notes where id = payload.note_id`.
2. If the note no longer exists (deleted), mark `done` and return.
3. Re-derive plaintext via the shared `extractTextFromNote` helper.
4. Re-check `content_hash` against any existing `lamplight_embeddings` row — bail to `done` if already current (a faster invoke beat the cron sweep, etc).
5. `embed([plaintext], 'document')` via the Voyage wrapper.
6. Upsert `lamplight_embeddings`:
   ```sql
   insert into lamplight_embeddings (id, user_id, source_type, source_id, content_hash, embedding, metadata)
   values ($1, $2, 'note', $3, $4, $5, $6)
   on conflict (user_id, source_type, source_id) do update
     set content_hash = excluded.content_hash,
         embedding = excluded.embedding,
         metadata = excluded.metadata;
   ```
7. Update `lamplight_jobs` → `done`.

### Bible ingest does NOT go through the queue

`lamplight_jobs.user_id` is `NOT NULL` per migration 008 (FK to `profiles`), and Bible rows have no owner. Rather than relax that constraint or fabricate a system profile, the BSB ingest script bypasses the queue entirely: it calls Voyage directly from the script process and upserts `lamplight_embeddings` rows with `user_id = null`. The Edge Function exists solely to process **`embedding_refresh`** jobs. Bible ingest is a one-shot operation; the queue is for ongoing user work.

### Failure & retry

```ts
async function markFailedOrRetry(supabase, job, err) {
  const attempts = (job.attempts ?? 0) + 1;
  if (attempts >= 3) {
    await supabase.from('lamplight_jobs').update({
      status: 'failed',
      attempts,
      error: String(err).slice(0, 2000),
      finished_at: new Date().toISOString(),
    }).eq('id', job.id);
    return;
  }
  const backoffSec = 5 * Math.pow(2, attempts); // 10s, 20s, 40s
  await supabase.from('lamplight_jobs').update({
    status: 'queued',
    attempts,
    error: String(err).slice(0, 2000),
    scheduled_at: new Date(Date.now() + backoffSec * 1000).toISOString(),
  }).eq('id', job.id);
}
```

After 3 failed attempts the job stays `failed` until a human re-queues. Sub-project 6 (Entitlements UI) will surface a re-queue affordance to support.

## Voyage client — `supabase/functions/_shared/voyage.ts`

Direct `fetch` to `https://api.voyageai.com/v1/embeddings`. Model, dimension, batch size, retry policy are constants. Importantly:

- `input_type` is **required** by every callsite. The wrapper enforces it at the type level (`'document' | 'query'`).
- `output_dimension: 1024` matches the schema.
- `output_dtype: 'float'` keeps full precision; quantization is a later optimization once we know our retrieval quality budget.
- `truncation: true` protects against the rare >32K-token note.
- Retries on `429` and `5xx` with exponential backoff (3 tries, jittered).
- Batches at 64 per call. Smaller than Voyage's 120K-token-per-request limit; predictable cost.

## Bible ingest — `scripts/ingest-bsb.ts`

One-time, runnable locally with service-role creds.

Steps:
1. Download BSB JSON from `https://bereanbible.com/bsb.json` (or cached copy at `scripts/data/bsb.json`). The release is public-domain; no attribution required but we display "Berean Standard Bible" in any UI that quotes it (sub-project 4).
2. Parse into:
   - **Verse rows**: `id = '{book}.{chapter}.{verse}'` (e.g. `psa.23.4`), `verse_start = verse_end = N`.
   - **Pericope rows**: `id = '{book}.{chapter}'` (e.g. `psa.23`), `verse_start = 1`, `verse_end = max_verse`, `text` = concatenated verses with single newlines, `pericope_id` = same id. MVP-simple: one pericope per chapter. A future migration can introduce finer pericope boundaries without re-embedding (since pericope rows have stable ids only when their text changes — content_hash protects us).
3. Upsert `bible_passages` rows on PK `id` where `text` differs.
4. Find rows missing an embedding (`left join lamplight_embeddings` on `source_type='bible_passage'`).
5. For each batch of 64, call Voyage directly from the script with `input_type='document'` and upsert all returned vectors into `lamplight_embeddings` (one transaction per batch) with `user_id = null`, `source_type = 'bible_passage'`, `source_id = passage.id`, and `metadata = { book, chapter, verse_start, verse_end, translation: 'BSB', pericope_id? }`.
6. Print progress + total Voyage cost (token count × public price).

Numbers:
- BSB: 31,103 verses + ~1,189 pericopes (one per chapter) ≈ 32,292 rows.
- 32,292 / 64 ≈ 505 Voyage calls.
- voyage-3-large at ~$0.18/1M input tokens × ~30 tokens/passage avg ≈ < $1 total.
- Wall time: 5–10 minutes sequential.

Re-running is a no-op (`left join` finds nothing missing; SQL upserts only touch rows where text differs).

## Existing-note backfill — `scripts/backfill-note-embeddings.ts`

Runs once immediately after migration 011 deploys. Implemented in Node, not pure SQL, because `notes.content` is stringified TipTap JSON held in a `text` column — extracting plaintext from JSON inside Postgres would require porting the TipTap traversal to PL/pgSQL, which is more code (and more divergence risk) than just doing it in Node where the canonical helper already lives.

Algorithm:

1. With the service-role client, select candidate notes:
   ```sql
   select n.id, n.user_id, n.content
   from notes n
   join lamplight_settings s
     on s.user_id = n.user_id and s.enabled = true
   left join lamplight_embeddings e
     on e.user_id = n.user_id
    and e.source_type = 'note'
    and e.source_id = n.id::text
   where e.id is null
   ```
2. For each row, parse `content` as JSON (or accept HTML/text fallback if the schema later evolves), run the shared `extractTextFromNote(parsed)` helper, skip if the result is empty/whitespace.
3. Compute `content_hash = sha256(plaintext)`.
4. Bulk-insert `lamplight_jobs` rows in batches of 500: `{ user_id, kind: 'embedding_refresh', status: 'queued', payload: { note_id, content_hash }, scheduled_at: now() }`.
5. Optionally poll the Edge Function's sweep endpoint until `select count(*) from lamplight_jobs where status='queued'` returns 0. Otherwise `pg_cron` drains the queue at 1/min.

The script is idempotent: re-running finds zero candidate notes (the LEFT JOIN excludes notes already embedded).

## State diagram — a single note's embedding lifecycle

```
User opts in (Foundation) ───────► lamplight_settings.enabled = true
                                          │
                                          ▼
User edits note ─► debounced save ─► hash(plaintext) ─► RPC enqueue
                                          │
                                          ▼
                                  lamplight_jobs row (queued)
                                          │
                       ┌──────────────────┴──────────────────┐
                       ▼                                     ▼
              client invoke('embed-note')             pg_cron sweep (60s)
                       │                                     │
                       └──────────────────┬──────────────────┘
                                          ▼
                                Edge Function claims (SKIP LOCKED)
                                          │
                                          ▼
                            extractTextFromNote → embed(doc)
                                          │
                                          ▼
                          lamplight_embeddings upsert (user_id, 'note', note_id)
                                          │
                                          ▼
                                  lamplight_jobs → done
```

Failure paths re-queue with backoff; user opt-out makes the RPC a no-op; "Forget my history" (Foundation) deletes the embedding rows.

## Acceptance criteria

Signal Layer is done when every item below holds.

1. Migration `011_lamplight_signal_layer.sql` runs clean against a fresh Supabase project. `lamplight_embeddings_embedding_hnsw` exists. `lamplight_embeddings_source_uq` exists. `enqueue_lamplight_embedding` RPC is callable by `authenticated`. `lamplight_embed_sweep` cron job is registered.
2. Edge Function `embed-note` deploys via `supabase functions deploy embed-note` and accepts both `{ job_id }` and `{ sweep: true }` payloads.
3. `VOYAGE_AI_KEY` is set as a function secret via `supabase secrets set VOYAGE_AI_KEY=...`. The function returns 500 + a clear error if the secret is missing.
4. An opted-in user saves a note (>= 1 word). Within ~3 seconds of typing stopping, a row appears in `lamplight_embeddings` for `(user_id, 'note', note_id)` with a 1024-dim vector and the expected `content_hash`.
5. Editing the same note re-embeds it (new content_hash). Since `content_hash = sha256(extractTextFromNote(content))`, format-only changes that leave plaintext identical (whitespace tweaks, bold-vs-italic, mark toggles) do NOT trigger an embedding — RPC returns null, no job inserted, no Voyage call.
6. Opting OUT (master toggle in profile) makes the RPC return null on subsequent saves. Existing embeddings stay until "Forget my history" is invoked.
7. Anonymous users have no Lamplight surface; the RPC requires `auth.uid()` and raises if unauthenticated.
8. `scripts/ingest-bsb.ts` writes 31,103 verse rows + ~1,189 pericope rows into `bible_passages`, and the corresponding `lamplight_embeddings` rows. Re-running is a no-op. Total Voyage cost < $2.
9. `scripts/backfill-note-embeddings.ts` enqueues exactly one job per existing note belonging to an opted-in user. Idempotent: re-running with no new notes produces zero new jobs.
10. Voyage `429` and `5xx` responses retry with exponential backoff. After 3 attempts the job is `status='failed'` with the error captured. Successful re-queue (manual UPDATE to `queued`) processes the job correctly.
11. RLS isolation test extension: user A cannot read or write user B's `lamplight_embeddings`. Bible rows (`user_id IS NULL`) are invisible to both A and B via the authenticated role (i.e. `select count(*) from lamplight_embeddings` as A returns only A's rows). Service role sees all rows.
12. `npm run lint`, `tsc -b`, and `vitest run` pass. New tests:
    - `voyage.test.ts` — batching, retry, error mapping (mocked transport).
    - `enqueue-rpc.test.ts` — auth check, opt-in check, hash-skip, coalescing of duplicate queued jobs.
    - `embed-note.test.ts` — happy path, retry path, deleted-note skip, both invocation modes (Voyage mocked).
    - `bsb-ingest.test.ts` — parse correctness on a 3-chapter fixture; idempotency.
    - `backfill.test.ts` — enqueues only for opted-in users with non-empty notes.
    - Extension to `rls-isolation.test.ts`.
13. No regression in Foundation: the four-state branching, profile section toggle, voice/tradition preferences, and `deleteAllUserData` continue to work.

## Files touched / created

### New files

- `supabase/migrations/011_lamplight_signal_layer.sql`
- `supabase/functions/embed-note/index.ts`
- `supabase/functions/embed-note/deno.json`
- `supabase/functions/_shared/voyage.ts`
- `supabase/functions/_shared/tiptap-text.ts` (Deno-port of `src/notepad/utils/tiptap-text.ts`)
- `supabase/functions/_shared/supabase.ts` (service-role client helper)
- `scripts/ingest-bsb.ts`
- `scripts/backfill-note-embeddings.ts`
- `scripts/data/.gitignore` (excludes cached `bsb.json`)
- `src/notepad/hooks/useLamplightEmbeddingTrigger.ts`
- `src/notepad/utils/lamplight-content-hash.ts` (thin sha256 wrapper; isomorphic so the Edge Function and the client compute identical hashes)
- Test files: `voyage.test.ts`, `enqueue-rpc.test.ts`, `embed-note.test.ts`, `bsb-ingest.test.ts`, `backfill.test.ts`. Extension to existing `rls-isolation.test.ts`.

### Modified files

- `src/notepad/storage/lamplight-adapter.ts` — add `enqueueEmbedding`.
- `src/notepad/storage/supabase-lamplight-adapter.ts` — implement `enqueueEmbedding` via RPC.
- `src/notepad/components/Editor.tsx` (or wherever debounced save lives) — call `useLamplightEmbeddingTrigger()` after a successful save. Single hook + single call.
- `package.json` — add `js-sha256` (~3 KB, no native deps).
- `.env.local.example` — comment that `VOYAGE_AI_KEY` is also configured via `supabase secrets set` for Edge Function access.

### Untouched

- All Foundation files. Signal Layer layers in; no surfaces change. `<OptedInPlaceholder />` continues to render Foundation's "Lamplight will appear here when ready." copy.
- `notes`, `folders`, `profiles` tables.
- Migrations 001–010.

## Open follow-ups (later sub-projects)

These are deliberately deferred and called out so they don't get forgotten.

1. **Sub-project 3 (Reasoning Layer):** `LLMAdapter` over Anthropic. Retrieval helpers (`searchNeighbors(noteId, k)` and `searchBible(query, k)`) that use the embeddings produced here. Reranker (`rerank-2.5`) for top-K precision. Citation validator + doctrinal guardrail + growth-only filter.
2. **Sub-project 4 (Today's Lamp):** On-demand generation from the Lamplight tab; replaces `<OptedInPlaceholder />` with real content. Consumes the note + Bible embedding indexes.
3. **Sub-project 5 (Connection Cards):** pgvector neighbor lookup on note embeddings + lazy Haiku "why" generation.
4. **Sub-project 6 (Entitlements UI):** Real paywall card. Admin tooling to re-queue failed embedding jobs.
5. **voyage-context-3 migration:** Contextualized chunk embeddings, expected +5–6% recall on shorter chunks. Wait for GA; the model output dimension already matches our schema.
6. **Quantization:** If storage cost becomes meaningful, swap `output_dtype: 'float'` to `'int8'` (4× smaller transfer) or `'binary'` (32× smaller, small quality hit, then rescore top-N with float). Schema change is tiny (`vector` → `bit varying` for binary).
7. **Premium translations (ESV / NIV):** Per-the-brief, API-only at read-time; never store the text. Embeddings only on BSB.

## Notes for the implementer

- Keep `voyage.ts` framework-free — it's pure `fetch`. The same module is imported from the Edge Function and (potentially) from a Node test runner. Don't add Deno- or Node-specific globals to it.
- `enqueue_lamplight_embedding` is `SECURITY DEFINER`. Every branch inside it must check `auth.uid()` before touching tables — a `definer` function that forgets the check is an RLS bypass. The spec form above is the contract; do not optimize away those checks.
- The Edge Function should be **idempotent on every claim**. A claimed job re-checks `content_hash` against the current `lamplight_embeddings` row before calling Voyage. A faster invoke can race the cron sweep; only one of them should pay for the embedding.
- Bible rows have `user_id = NULL`, not a magic UUID. The CHECK constraint enforces `source_type='bible_passage' ↔ user_id IS NULL`. Don't pass a placeholder UUID from the ingest script; pass null.
- `tiptap-text.ts` is duplicated between `src/` and `supabase/functions/_shared/`. Keep them byte-identical or extract to a published-from-the-monorepo package later. A unit test should embed a known TipTap doc through both paths and assert identical output strings; otherwise client and server hashes diverge and we re-embed every save forever.
- BSB is public-domain but attribution ("Berean Standard Bible") shows on any UI that quotes it. Surface this in sub-project 4 when devotional copy ships; it is not required for Foundation or Signal Layer because nothing user-visible quotes the corpus yet.
- The HNSW index swap is safe today because the table is empty. If we ever ship Signal Layer to an environment where embeddings already exist on the old `ivfflat` index, drop the index first, populate, then create HNSW (or use `CONCURRENTLY` if downtime matters).
