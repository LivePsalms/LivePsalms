# Lamplight Signal Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Light up the Lamplight embedding pipeline — every saved note (for opted-in users) is converted to a 1024-dim Voyage AI vector and stored in `lamplight_embeddings`; the BSB Bible corpus is ingested + embedded; a Supabase Edge Function processes the queue with retry, idempotency, and failure handling.

**Architecture:** Client computes `sha256(plaintext)` after debounced autosave → calls `enqueue_lamplight_embedding` RPC → RPC inserts a `lamplight_jobs` row only if hash differs → client fires `supabase.functions.invoke('embed-note', { job_id })` for sub-second latency → Edge Function claims the job (`FOR UPDATE SKIP LOCKED`), embeds via Voyage, upserts `lamplight_embeddings`. `pg_cron` sweeps the queue every minute as a safety net. BSB ingest bypasses the queue (one-shot, no per-user state). Backfill script enqueues existing notes once at deploy.

**Tech Stack:** TypeScript, React 19, Vite, Supabase (Postgres + Edge Functions Deno runtime + pg_cron + pg_net), pgvector (HNSW), Voyage AI `voyage-3-large` (1024-dim float, `input_type` discipline), vitest 4.

**Spec:** [docs/superpowers/specs/2026-05-26-lamplight-signal-layer-design.md](../specs/2026-05-26-lamplight-signal-layer-design.md)

---

## File Structure

**New files:**
- `supabase/migrations/011_lamplight_signal_layer.sql`
- `supabase/functions/embed-note/index.ts`
- `supabase/functions/embed-note/deno.json`
- `supabase/functions/_shared/voyage.ts`
- `supabase/functions/_shared/tiptap-text.ts`
- `supabase/functions/_shared/supabase.ts`
- `supabase/functions/_shared/process-job.ts` (pure orchestration logic, importable from vitest)
- `scripts/ingest-bsb.ts`
- `scripts/backfill-note-embeddings.ts`
- `scripts/data/.gitignore`
- `src/notepad/hooks/useLamplightEmbeddingTrigger.ts`
- `src/notepad/utils/lamplight-content-hash.ts`
- Tests: `voyage.test.ts`, `process-job.test.ts`, `tiptap-text.iso.test.ts`, `lamplight-content-hash.test.ts`, `useLamplightEmbeddingTrigger.test.tsx`, `enqueue-embedding-rpc.test.ts` (integration), `bsb-ingest.test.ts`, `backfill-note-embeddings.test.ts`.

**Modified files:**
- `src/notepad/storage/lamplight-adapter.ts` — add `enqueueEmbedding` to the interface.
- `src/notepad/storage/supabase-lamplight-adapter.ts` — implement `enqueueEmbedding`.
- `src/notepad/storage/fake-lamplight-adapter.ts` — implement `enqueueEmbedding`.
- `src/notepad/editor/use-note-editor.ts` — fire embedding trigger after save.
- `src/notepad/components/Editor.tsx` *(only if needed)* — pass adapter+userId through.
- `src/components/sections/Notepad.tsx` — pass adapter+userId to `useNoteEditor` consumer.
- `src/__tests__/rls-isolation.test.ts` — extend with embeddings + Bible-row visibility checks.
- `package.json` — add `js-sha256`.
- `.env.local.example` — add comment about Edge Function secret.

**Untouched:** All Foundation UI components (`LamplightTabPanel`, `ConsentCard`, etc.). `notes` / `folders` / `profiles` tables. Migrations 001–010.

---

## Task 1: Isomorphic content-hash module

**Files:**
- Modify: `package.json`
- Create: `src/notepad/utils/lamplight-content-hash.ts`
- Test: `src/notepad/utils/lamplight-content-hash.test.ts`

- [ ] **Step 1.1: Add `js-sha256` dependency**

Run: `npm install --save js-sha256@^0.11.0`
Expected: `package.json` gains `"js-sha256": "^0.11.0"` under `dependencies`.

- [ ] **Step 1.2: Write the failing test**

```ts
// src/notepad/utils/lamplight-content-hash.test.ts
import { describe, it, expect } from 'vitest';
import { lamplightContentHash } from './lamplight-content-hash';

describe('lamplightContentHash', () => {
  it('returns a 64-char hex sha256', () => {
    const h = lamplightContentHash('hello world');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });

  it('is deterministic across calls', () => {
    expect(lamplightContentHash('abc')).toBe(lamplightContentHash('abc'));
  });

  it('differs for differing inputs', () => {
    expect(lamplightContentHash('a')).not.toBe(lamplightContentHash('b'));
  });

  it('handles empty string', () => {
    expect(lamplightContentHash('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });
});
```

- [ ] **Step 1.3: Run test to verify it fails**

Run: `npx vitest run src/notepad/utils/lamplight-content-hash.test.ts`
Expected: FAIL — `Cannot find module './lamplight-content-hash'`.

- [ ] **Step 1.4: Implement**

```ts
// src/notepad/utils/lamplight-content-hash.ts
import { sha256 } from 'js-sha256';

// Deterministic content hash used to decide whether a note needs re-embedding.
// MUST stay byte-identical to what the Edge Function computes server-side,
// otherwise we re-embed on every save. The Edge Function uses the Deno
// `crypto.subtle` SHA-256 implementation in `_shared/sha256.ts`.
export function lamplightContentHash(plaintext: string): string {
  return sha256(plaintext);
}
```

- [ ] **Step 1.5: Run test to verify it passes**

Run: `npx vitest run src/notepad/utils/lamplight-content-hash.test.ts`
Expected: PASS — 4 tests passing.

- [ ] **Step 1.6: Commit**

```bash
git add package.json package-lock.json src/notepad/utils/lamplight-content-hash.ts src/notepad/utils/lamplight-content-hash.test.ts
git commit -m "feat(lamplight): isomorphic sha256 content hash for embedding invalidation"
```

---

## Task 2: Migration 011 — schema changes (nullable owner + HNSW + uniqueness)

**Files:**
- Create: `supabase/migrations/011_lamplight_signal_layer.sql`

- [ ] **Step 2.1: Write the schema half of migration 011**

```sql
-- supabase/migrations/011_lamplight_signal_layer.sql
--
-- Signal Layer (sub-project 2). Three discrete changes:
--   1. Enable pg_cron + pg_net (for the embedding sweep).
--   2. Allow lamplight_embeddings.user_id to be NULL so Bible passages
--      (no per-user owner) can share the table. RLS continues to work via
--      `auth.uid() = user_id` evaluating to NULL → false for Bible rows.
--   3. Swap ivfflat → HNSW (better recall on our corpus size; table is empty
--      today so the swap is a single DROP+CREATE) and add a unique
--      constraint that lets the Edge Function upsert cleanly.
-- The RPC, sweep, and post-deploy settings live in subsequent migration steps.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── 1. Owner nullability + source-type CHECK ─────────────────────────────
alter table public.lamplight_embeddings
  alter column user_id drop not null;

alter table public.lamplight_embeddings
  add constraint lamplight_embeddings_owner_check
  check (
    (source_type = 'note'          and user_id is not null) or
    (source_type = 'bible_passage' and user_id is null)
  );

-- ── 2. Replace ivfflat with HNSW; replace non-unique btree with unique ───
drop index if exists public.lamplight_embeddings_ivfflat;
drop index if exists public.lamplight_embeddings_user_source;

create index lamplight_embeddings_embedding_hnsw
  on public.lamplight_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

alter table public.lamplight_embeddings
  add constraint lamplight_embeddings_source_uq
  unique nulls not distinct (user_id, source_type, source_id);
```

- [ ] **Step 2.2: Apply the migration locally and verify**

Run (assumes `supabase` CLI is configured and a local DB is running):
```bash
supabase db reset
```
Expected: migrations 001–011 apply cleanly. No errors.

Then probe the schema:
```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" <<'SQL'
\d+ public.lamplight_embeddings
SQL
```
Expected output includes:
- `user_id` column with `nullable: yes`.
- Index `lamplight_embeddings_embedding_hnsw` (hnsw).
- Constraint `lamplight_embeddings_owner_check`.
- Unique constraint `lamplight_embeddings_source_uq` with `NULLS NOT DISTINCT`.
- Extensions `pg_cron` and `pg_net` enabled (`\dx` should list both).

- [ ] **Step 2.3: Commit**

```bash
git add supabase/migrations/011_lamplight_signal_layer.sql
git commit -m "feat(lamplight): migration 011 — nullable owner + HNSW + unique constraint"
```

---

## Task 3: Migration 011 — `enqueue_lamplight_embedding` RPC

**Files:**
- Modify: `supabase/migrations/011_lamplight_signal_layer.sql`
- Test: `src/__tests__/enqueue-embedding-rpc.test.ts` (env-gated integration test)

- [ ] **Step 3.1: Write a failing integration test (env-gated)**

This test mirrors the existing `rls-isolation.test.ts` pattern: it auto-skips when Supabase test credentials aren't configured.

```ts
// src/__tests__/enqueue-embedding-rpc.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const URL  = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY;
const skip = !URL || !ANON || !SERVICE;

describe.skipIf(skip)('enqueue_lamplight_embedding RPC', () => {
  let service: SupabaseClient;
  let userA: { id: string; client: SupabaseClient };
  let noteA: string;

  beforeAll(async () => {
    service = createClient(URL!, SERVICE!);
    const email = `enq-${Date.now()}@test.invalid`;
    const { data, error } = await service.auth.admin.createUser({
      email, password: 'p4ssword!', email_confirm: true,
    });
    if (error) throw error;
    const uid = data.user!.id;
    const userClient = createClient(URL!, ANON!);
    await userClient.auth.signInWithPassword({ email, password: 'p4ssword!' });
    userA = { id: uid, client: userClient };
    // Opt the user in.
    await userClient.from('lamplight_settings').upsert({ user_id: uid, enabled: true });
    // Create a note.
    const { data: noteRow } = await userClient
      .from('notes').insert({ user_id: uid, content: '{"type":"doc"}' }).select('id').single();
    noteA = noteRow!.id;
  });

  it('inserts a queued job when opted in and hash is new', async () => {
    const { data: jobId, error } = await userA.client.rpc('enqueue_lamplight_embedding', {
      p_note_id: noteA, p_content_hash: 'h1',
    });
    expect(error).toBeNull();
    expect(jobId).toBeTruthy();

    const { data: job } = await service
      .from('lamplight_jobs').select('*').eq('id', jobId).single();
    expect(job.kind).toBe('embedding_refresh');
    expect(job.status).toBe('queued');
    expect(job.payload).toMatchObject({ note_id: noteA, content_hash: 'h1' });
  });

  it('returns null when hash matches existing embedding', async () => {
    await service.from('lamplight_embeddings').insert({
      user_id: userA.id, source_type: 'note', source_id: noteA,
      content_hash: 'h2', embedding: new Array(1024).fill(0),
    });
    const { data, error } = await userA.client.rpc('enqueue_lamplight_embedding', {
      p_note_id: noteA, p_content_hash: 'h2',
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('coalesces duplicate enqueue calls into one queued row', async () => {
    // Clear prior jobs.
    await service.from('lamplight_jobs').delete().eq('user_id', userA.id);
    await service.from('lamplight_embeddings').delete().eq('user_id', userA.id);

    const r1 = await userA.client.rpc('enqueue_lamplight_embedding', {
      p_note_id: noteA, p_content_hash: 'h3',
    });
    const r2 = await userA.client.rpc('enqueue_lamplight_embedding', {
      p_note_id: noteA, p_content_hash: 'h3',
    });
    expect(r1.data).toBe(r2.data); // same job id

    const { count } = await service
      .from('lamplight_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userA.id).eq('status', 'queued');
    expect(count).toBe(1);
  });

  it('returns null when opted out', async () => {
    await userA.client.from('lamplight_settings').upsert({ user_id: userA.id, enabled: false });
    const { data, error } = await userA.client.rpc('enqueue_lamplight_embedding', {
      p_note_id: noteA, p_content_hash: 'h4',
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
    // Re-opt in for any later tests.
    await userA.client.from('lamplight_settings').upsert({ user_id: userA.id, enabled: true });
  });

  it('raises when caller does not own the note', async () => {
    // Create user B and a note belonging to B.
    const email = `enq-b-${Date.now()}@test.invalid`;
    const { data: bData } = await service.auth.admin.createUser({
      email, password: 'p4ssword!', email_confirm: true,
    });
    const bUid = bData.user!.id;
    const { data: bNoteRow } = await service
      .from('notes').insert({ user_id: bUid, content: '{"type":"doc"}' }).select('id').single();
    const bNoteId = bNoteRow!.id;

    const { error } = await userA.client.rpc('enqueue_lamplight_embedding', {
      p_note_id: bNoteId, p_content_hash: 'h5',
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? '')).toMatch(/not authorized|authorized|permission/i);
  });
});
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/enqueue-embedding-rpc.test.ts`
Expected: FAIL — `function public.enqueue_lamplight_embedding(uuid, text) does not exist`. (If creds aren't set, the entire file is skipped — that's the expected dev-without-creds outcome; the agent should set the env vars from `.env.local.test` before running.)

- [ ] **Step 3.3: Append the RPC to migration 011**

Add to the end of `supabase/migrations/011_lamplight_signal_layer.sql`:

```sql
-- ── 3. enqueue_lamplight_embedding ───────────────────────────────────────
-- SECURITY DEFINER: every branch must check auth.uid() before touching tables.
-- A definer function that forgets the check is an RLS bypass. Do not optimize
-- away the explicit checks below.
create or replace function public.enqueue_lamplight_embedding(
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

grant execute on function public.enqueue_lamplight_embedding(uuid, text) to authenticated;
```

- [ ] **Step 3.4: Re-apply migration**

Run: `supabase db reset`
Expected: clean apply through 011.

- [ ] **Step 3.5: Run integration test to verify it passes**

Run: `npx vitest run src/__tests__/enqueue-embedding-rpc.test.ts`
Expected: PASS — 5 tests passing.

- [ ] **Step 3.6: Commit**

```bash
git add supabase/migrations/011_lamplight_signal_layer.sql src/__tests__/enqueue-embedding-rpc.test.ts
git commit -m "feat(lamplight): enqueue_lamplight_embedding RPC + integration tests"
```

---

## Task 4: Migration 011 — `pg_cron` sweep schedule + post-deploy settings doc

**Files:**
- Modify: `supabase/migrations/011_lamplight_signal_layer.sql`
- Create: `docs/lamplight/post-deploy-signal-layer.md`

- [ ] **Step 4.1: Append the sweep schedule to migration 011**

```sql
-- ── 4. pg_cron sweep — drains orphaned queued jobs every minute ──────────
-- The two settings (`app.settings.embed_fn_url`, `app.settings.service_role_key`)
-- are provisioned out-of-band — see docs/lamplight/post-deploy-signal-layer.md.
-- The `current_setting(..., true)` form returns NULL on a fresh DB without the
-- secrets, so the cron call no-ops gracefully in local dev.
select cron.schedule(
  'lamplight_embed_sweep',
  '* * * * *',
  $cron$
  select net.http_post(
    url := current_setting('app.settings.embed_fn_url', true),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{"sweep": true}'::jsonb
  )
  where current_setting('app.settings.embed_fn_url', true) is not null;
  $cron$
);
```

- [ ] **Step 4.2: Write the post-deploy doc**

```markdown
<!-- docs/lamplight/post-deploy-signal-layer.md -->
# Signal Layer — Post-Deploy Steps

After applying migration 011 in a fresh environment, run these once.

## 1. Set Edge Function secrets

```bash
supabase secrets set VOYAGE_AI_KEY=<your-voyage-key>
```

## 2. Deploy the Edge Function

```bash
supabase functions deploy embed-note --no-verify-jwt=false
```

Capture the deployed URL — it has the form
`https://<project-ref>.functions.supabase.co/embed-note`.

## 3. Provision pg_cron settings

Open the SQL editor for the production database (NOT a migration file —
the service role key must not be committed) and run:

```sql
alter database postgres
  set app.settings.embed_fn_url = 'https://<project-ref>.functions.supabase.co/embed-note';

alter database postgres
  set app.settings.service_role_key = '<service-role-jwt>';
```

These are read by `cron.schedule('lamplight_embed_sweep', …)` registered in
migration 011. Until they are set, the sweep is a no-op.

## 4. Run BSB ingest

```bash
SUPABASE_URL=<...> SUPABASE_SERVICE_ROLE_KEY=<...> VOYAGE_AI_KEY=<...> \
  npx tsx scripts/ingest-bsb.ts
```

Expected: ~32K rows in `bible_passages` + matching rows in `lamplight_embeddings`.
Re-running is a no-op.

## 5. Run note backfill

```bash
SUPABASE_URL=<...> SUPABASE_SERVICE_ROLE_KEY=<...> \
  npx tsx scripts/backfill-note-embeddings.ts
```

The script enqueues `embedding_refresh` jobs; `pg_cron` drains them at 1/min,
or invoke the function directly with `{"sweep":true}` to drain immediately.
```

- [ ] **Step 4.3: Re-apply migration and verify cron is registered**

Run: `supabase db reset`
Then probe:
```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" -c "select jobname, schedule from cron.job where jobname='lamplight_embed_sweep';"
```
Expected: one row with `* * * * *`.

- [ ] **Step 4.4: Commit**

```bash
git add supabase/migrations/011_lamplight_signal_layer.sql docs/lamplight/post-deploy-signal-layer.md
git commit -m "feat(lamplight): pg_cron sweep + post-deploy doc"
```

---

## Task 5: Voyage AI client wrapper

**Files:**
- Create: `supabase/functions/_shared/voyage.ts`
- Test: `supabase/functions/_shared/voyage.test.ts`

The wrapper is pure (`fetch` injected as a parameter so vitest can mock without touching globals). Both the Edge Function and the ingest script import it.

- [ ] **Step 5.1: Write the failing test**

```ts
// supabase/functions/_shared/voyage.test.ts
import { describe, it, expect, vi } from 'vitest';
import { embedDocuments, embedQuery } from './voyage';

function mockFetchOk(payloads: Array<{ embeddings: number[][] }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const body = { data: payloads[i++].embeddings.map(e => ({ embedding: e })) };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return { fn, calls };
}

describe('voyage embed', () => {
  it('sends document input_type and returns vectors', async () => {
    const { fn, calls } = mockFetchOk([{ embeddings: [[0.1, 0.2]] }]);
    const out = await embedDocuments(['hello'], { apiKey: 'k', fetch: fn });
    expect(out).toEqual([[0.1, 0.2]]);
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.input_type).toBe('document');
    expect(body.model).toBe('voyage-3-large');
    expect(body.output_dimension).toBe(1024);
    expect(body.output_dtype).toBe('float');
    expect(body.truncation).toBe(true);
    expect(calls[0].init.headers).toMatchObject({ Authorization: 'Bearer k' });
  });

  it('sends query input_type for embedQuery', async () => {
    const { fn, calls } = mockFetchOk([{ embeddings: [[0.9]] }]);
    const out = await embedQuery('q', { apiKey: 'k', fetch: fn });
    expect(out).toEqual([0.9]);
    expect(JSON.parse(calls[0].init.body as string).input_type).toBe('query');
  });

  it('batches >64 inputs into multiple calls', async () => {
    const inputs = Array.from({ length: 130 }, (_, i) => `t${i}`);
    const { fn, calls } = mockFetchOk([
      { embeddings: Array.from({ length: 64 }, () => [1]) },
      { embeddings: Array.from({ length: 64 }, () => [2]) },
      { embeddings: Array.from({ length: 2  }, () => [3]) },
    ]);
    const out = await embedDocuments(inputs, { apiKey: 'k', fetch: fn });
    expect(out.length).toBe(130);
    expect(calls.length).toBe(3);
  });

  it('retries on 429 with backoff and succeeds', async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts === 1) return new Response('rate limited', { status: 429 });
      return new Response(JSON.stringify({ data: [{ embedding: [1] }] }), { status: 200 });
    });
    const out = await embedDocuments(['x'], { apiKey: 'k', fetch: fn, sleep: async () => {} });
    expect(out).toEqual([[1]]);
    expect(attempts).toBe(2);
  });

  it('throws after 3 failed attempts', async () => {
    const fn = vi.fn(async () => new Response('boom', { status: 500 }));
    await expect(
      embedDocuments(['x'], { apiKey: 'k', fetch: fn, sleep: async () => {} })
    ).rejects.toThrow(/voyage 500/);
    expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  it('returns [] for empty input', async () => {
    const fn = vi.fn();
    expect(await embedDocuments([], { apiKey: 'k', fetch: fn })).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5.2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/voyage.test.ts`
Expected: FAIL — `Cannot find module './voyage'`.

- [ ] **Step 5.3: Implement**

```ts
// supabase/functions/_shared/voyage.ts
//
// Pure Voyage AI HTTP wrapper. Imported by:
//   - supabase/functions/embed-note (Deno runtime; provides Deno-fetch)
//   - scripts/ingest-bsb.ts (Node runtime; provides global fetch)
//   - vitest tests (mocked fetch).
// No Deno or Node globals here — fetch and sleep are injected via deps.

export type InputType = 'document' | 'query';

const VOYAGE_BASE = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-3-large';
const DIM = 1024;
const BATCH_MAX = 64;
const MAX_RETRIES = 3;

export interface VoyageDeps {
  apiKey: string;
  fetch: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function embedDocuments(texts: string[], deps: VoyageDeps): Promise<number[][]> {
  return embedBatched(texts, 'document', deps);
}

export async function embedQuery(text: string, deps: VoyageDeps): Promise<number[]> {
  const [v] = await embedBatched([text], 'query', deps);
  return v;
}

async function embedBatched(
  texts: string[],
  inputType: InputType,
  deps: VoyageDeps,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_MAX) {
    const batch = texts.slice(i, i + BATCH_MAX);
    const vectors = await embedOnce(batch, inputType, deps);
    out.push(...vectors);
  }
  return out;
}

async function embedOnce(
  batch: string[],
  inputType: InputType,
  deps: VoyageDeps,
  attempt = 0,
): Promise<number[][]> {
  const sleep = deps.sleep ?? defaultSleep;
  const res = await deps.fetch(VOYAGE_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${deps.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: batch,
      input_type: inputType,
      output_dimension: DIM,
      output_dtype: 'float',
      truncation: true,
    }),
  });

  if (res.ok) {
    const json = await res.json() as { data: Array<{ embedding: number[] }> };
    return json.data.map(d => d.embedding);
  }

  const retryable = res.status === 429 || res.status >= 500;
  if (retryable && attempt < MAX_RETRIES) {
    const backoffMs = 500 * Math.pow(2, attempt) + Math.random() * 250;
    await sleep(backoffMs);
    return embedOnce(batch, inputType, deps, attempt + 1);
  }

  const detail = await res.text().catch(() => '');
  throw new Error(`voyage ${res.status}: ${detail.slice(0, 500)}`);
}
```

- [ ] **Step 5.4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/voyage.test.ts`
Expected: PASS — 6 tests passing.

- [ ] **Step 5.5: Commit**

```bash
git add supabase/functions/_shared/voyage.ts supabase/functions/_shared/voyage.test.ts
git commit -m "feat(lamplight): Voyage AI embedding client (pure, fetch-injected)"
```

---

## Task 6: Shared TipTap plaintext extractor (Edge Function port)

**Files:**
- Create: `supabase/functions/_shared/tiptap-text.ts`
- Test: `src/__tests__/tiptap-text.iso.test.ts`

The Edge Function needs the same plaintext extraction logic as the client. Foundation has the helper at [src/notepad/utils/tiptap-text.ts](../../src/notepad/utils/tiptap-text.ts). Duplicating it is acceptable as long as a test guarantees byte-identical output — otherwise client and server hashes diverge and we re-embed every save forever.

- [ ] **Step 6.1: Copy the helper, structured for Deno-or-Node**

```ts
// supabase/functions/_shared/tiptap-text.ts
//
// MUST stay byte-identical to src/notepad/utils/tiptap-text.ts. Enforced by
// src/__tests__/tiptap-text.iso.test.ts which imports both and asserts every
// fixture produces the same string from both implementations.

export function extractPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Record<string, unknown>;
  if (n.type === 'text' && typeof n.text === 'string') {
    return n.text;
  }
  if (Array.isArray(n.content)) {
    return (n.content as unknown[]).map(extractPlainText).join(' ');
  }
  return '';
}

export function extractTextFromNoteContent(contentJsonOrText: string): string {
  try {
    const doc = JSON.parse(contentJsonOrText);
    return extractPlainText(doc);
  } catch {
    return contentJsonOrText;
  }
}
```

- [ ] **Step 6.2: Write the isomorphism test**

```ts
// src/__tests__/tiptap-text.iso.test.ts
import { describe, it, expect } from 'vitest';
import {
  extractPlainText as clientExtract,
  extractTextFromNote as clientFromNote,
} from '@/notepad/utils/tiptap-text';
import {
  extractPlainText as serverExtract,
  extractTextFromNoteContent as serverFromContent,
} from '../../supabase/functions/_shared/tiptap-text';

const FIXTURES: Array<{ name: string; doc: unknown }> = [
  { name: 'empty doc', doc: { type: 'doc', content: [] } },
  {
    name: 'simple paragraph',
    doc: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
    },
  },
  {
    name: 'multiple paragraphs',
    doc: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Line one.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Line two.' }] },
      ],
    },
  },
  {
    name: 'bible verse mark',
    doc: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [
          { type: 'text', text: 'See ', marks: [] },
          { type: 'text', text: 'John 3:16', marks: [{ type: 'bibleVerse' }] },
          { type: 'text', text: '.', marks: [] },
        ]},
      ],
    },
  },
];

describe('tiptap-text isomorphism (client ↔ Edge Function)', () => {
  for (const { name, doc } of FIXTURES) {
    it(`agrees on "${name}"`, () => {
      const c = clientExtract(doc);
      const s = serverExtract(doc);
      expect(s).toBe(c);
    });
    it(`agrees on "${name}" via stringified content`, () => {
      const json = JSON.stringify(doc);
      const c = clientFromNote({ content: json } as never);
      const s = serverFromContent(json);
      expect(s).toBe(c);
    });
  }
});
```

- [ ] **Step 6.3: Run test to verify pass**

Run: `npx vitest run src/__tests__/tiptap-text.iso.test.ts`
Expected: PASS — 8 tests passing.

- [ ] **Step 6.4: Commit**

```bash
git add supabase/functions/_shared/tiptap-text.ts src/__tests__/tiptap-text.iso.test.ts
git commit -m "feat(lamplight): Deno-port of tiptap-text + isomorphism test"
```

---

## Task 7: Edge Function — pure orchestration module (`process-job.ts`)

All of the Edge Function's business logic lives here so it's testable under vitest with a mocked Supabase client and mocked Voyage client. `index.ts` (next task) is a thin Deno `serve(...)` wrapper.

**Files:**
- Create: `supabase/functions/_shared/process-job.ts`
- Test: `supabase/functions/_shared/process-job.test.ts`

- [ ] **Step 7.1: Write the failing test**

```ts
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
```

- [ ] **Step 7.2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/process-job.test.ts`
Expected: FAIL — `Cannot find module './process-job'`.

- [ ] **Step 7.3: Implement**

```ts
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
```

- [ ] **Step 7.4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/process-job.test.ts`
Expected: PASS — 6 tests passing.

- [ ] **Step 7.5: Commit**

```bash
git add supabase/functions/_shared/process-job.ts supabase/functions/_shared/process-job.test.ts
git commit -m "feat(lamplight): pure job-processing logic for Edge Function"
```

---

## Task 8: Edge Function entrypoint (`embed-note/index.ts`)

Thin Deno `serve(...)` wrapper. Wires real Supabase + Voyage clients to the pure module from Task 7. Not directly unit-tested — covered by integration smoke (Task 14) and by `process-job.test.ts` via the shared module.

**Files:**
- Create: `supabase/functions/embed-note/index.ts`
- Create: `supabase/functions/embed-note/deno.json`
- Create: `supabase/functions/_shared/supabase.ts`

- [ ] **Step 8.1: Write the shared service-role client helper**

```ts
// supabase/functions/_shared/supabase.ts
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 8.2: Write the function deno.json**

```json
{
  "imports": {
    "@supabase/supabase-js": "jsr:@supabase/supabase-js@2"
  }
}
```

- [ ] **Step 8.3: Write `index.ts`**

```ts
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
  // Use a SQL function for atomic claim with FOR UPDATE SKIP LOCKED.
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
```

- [ ] **Step 8.4: Add the two claim RPCs to migration 011**

The Edge Function calls `claim_lamplight_jobs(p_limit)` and `claim_lamplight_job_by_id(p_job_id)`. Append to `supabase/migrations/011_lamplight_signal_layer.sql`:

```sql
-- ── 5. Claim RPCs — atomic FOR UPDATE SKIP LOCKED dequeue ────────────────
create or replace function public.claim_lamplight_jobs(p_limit int)
returns setof public.lamplight_jobs
language sql
security definer
set search_path = public
as $$
  update lamplight_jobs
     set status = 'running', started_at = now()
   where id in (
     select id from lamplight_jobs
      where status = 'queued'
        and scheduled_at <= now()
        and kind = 'embedding_refresh'
      order by scheduled_at
      limit p_limit
      for update skip locked
   )
   returning *;
$$;

create or replace function public.claim_lamplight_job_by_id(p_job_id uuid)
returns setof public.lamplight_jobs
language sql
security definer
set search_path = public
as $$
  update lamplight_jobs
     set status = 'running', started_at = now()
   where id = p_job_id
     and status = 'queued'
   returning *;
$$;

revoke execute on function public.claim_lamplight_jobs(int)      from public, anon, authenticated;
revoke execute on function public.claim_lamplight_job_by_id(uuid) from public, anon, authenticated;
-- service_role bypasses the revoke; only it (and supabase_admin) can call these.
```

- [ ] **Step 8.5: Re-apply migration**

Run: `supabase db reset`
Expected: clean apply.

- [ ] **Step 8.6: Deploy the function locally and exercise it**

Run:
```bash
supabase functions serve embed-note --env-file ./supabase/functions/.env
```

In a second shell:
```bash
curl -X POST http://localhost:54321/functions/v1/embed-note \
  -H "Authorization: Bearer $SUPABASE_TEST_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sweep": true}'
```

Expected: `{"processed":0}` (empty queue). If `VOYAGE_AI_KEY` is missing, expect `{"error":"VOYAGE_AI_KEY missing"}`.

- [ ] **Step 8.7: Commit**

```bash
git add supabase/functions/embed-note supabase/functions/_shared/supabase.ts supabase/migrations/011_lamplight_signal_layer.sql
git commit -m "feat(lamplight): embed-note Edge Function + claim RPCs"
```

---

## Task 9: `enqueueEmbedding` adapter method

**Files:**
- Modify: `src/notepad/storage/lamplight-adapter.ts`
- Modify: `src/notepad/storage/supabase-lamplight-adapter.ts`
- Modify: `src/notepad/storage/fake-lamplight-adapter.ts`
- Test: `src/notepad/storage/fake-lamplight-adapter.test.ts` (extends or creates)

- [ ] **Step 9.1: Extend the interface**

Add to `src/notepad/storage/lamplight-adapter.ts` inside the `LamplightAdapter` interface:

```ts
export interface LamplightAdapter {
  // … existing Foundation methods …
  /**
   * Enqueue an embedding refresh for the given note. Calls the
   * `enqueue_lamplight_embedding` RPC, which is a no-op (returns null) when:
   *   - the user is opted out (`lamplight_settings.enabled = false`)
   *   - the supplied `contentHash` matches the existing embedding's hash
   *   - a queued job for the same note already exists (returns its id)
   * Returns the job id, or null when the RPC was a no-op.
   */
  enqueueEmbedding(noteId: string, contentHash: string): Promise<string | null>;
}
```

- [ ] **Step 9.2: Implement on the Supabase adapter**

Add to `src/notepad/storage/supabase-lamplight-adapter.ts`:

```ts
async enqueueEmbedding(noteId: string, contentHash: string): Promise<string | null> {
  const { data, error } = await this.#client.rpc('enqueue_lamplight_embedding', {
    p_note_id: noteId,
    p_content_hash: contentHash,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}
```

- [ ] **Step 9.3: Implement on the Fake adapter (for unit tests)**

Add to `src/notepad/storage/fake-lamplight-adapter.ts`:

```ts
// Track every enqueueEmbedding call for assertions.
public enqueueCalls: Array<{ noteId: string; contentHash: string }> = [];
// Map note_id → last accepted hash (returns null on duplicate).
private enqueuedHash = new Map<string, string>();

async enqueueEmbedding(noteId: string, contentHash: string): Promise<string | null> {
  this.enqueueCalls.push({ noteId, contentHash });
  if (this.enqueuedHash.get(noteId) === contentHash) return null;
  this.enqueuedHash.set(noteId, contentHash);
  return `job-${noteId}-${contentHash.slice(0, 8)}`;
}
```

- [ ] **Step 9.4: Write the failing fake-adapter test**

```ts
// src/notepad/storage/fake-lamplight-adapter.test.ts (new file)
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeLamplightAdapter } from './fake-lamplight-adapter';

describe('FakeLamplightAdapter.enqueueEmbedding', () => {
  let a: FakeLamplightAdapter;
  beforeEach(() => { a = new FakeLamplightAdapter(); });

  it('returns a job id on first enqueue', async () => {
    const id = await a.enqueueEmbedding('n1', 'h1');
    expect(id).toBe('job-n1-h1');
    expect(a.enqueueCalls).toEqual([{ noteId: 'n1', contentHash: 'h1' }]);
  });

  it('returns null when the same hash is enqueued twice', async () => {
    await a.enqueueEmbedding('n1', 'h1');
    const second = await a.enqueueEmbedding('n1', 'h1');
    expect(second).toBeNull();
    expect(a.enqueueCalls.length).toBe(2);
  });

  it('returns a new job id when hash changes', async () => {
    const a1 = await a.enqueueEmbedding('n1', 'h1');
    const a2 = await a.enqueueEmbedding('n1', 'h2');
    expect(a1).not.toBe(a2);
    expect(a2).toBe('job-n1-h2');
  });
});
```

(The `job-n1-h1` ids are because `contentHash.slice(0, 8)` of `'h1'` is `'h1'`. Use longer fixture hashes if you find that confusing.)

- [ ] **Step 9.5: Run tests to verify they pass**

Run: `npx vitest run src/notepad/storage/fake-lamplight-adapter.test.ts`
Expected: PASS — 3 tests passing.

- [ ] **Step 9.6: Typecheck + lint**

Run: `npm run lint && npx tsc -b`
Expected: clean.

- [ ] **Step 9.7: Commit**

```bash
git add src/notepad/storage/lamplight-adapter.ts src/notepad/storage/supabase-lamplight-adapter.ts src/notepad/storage/fake-lamplight-adapter.ts src/notepad/storage/fake-lamplight-adapter.test.ts
git commit -m "feat(lamplight): enqueueEmbedding adapter method (interface + supabase + fake)"
```

---

## Task 10: `useLamplightEmbeddingTrigger` hook

**Files:**
- Create: `src/notepad/hooks/useLamplightEmbeddingTrigger.ts`
- Test: `src/notepad/hooks/useLamplightEmbeddingTrigger.test.tsx`

- [ ] **Step 10.1: Write the failing test**

```tsx
// src/notepad/hooks/useLamplightEmbeddingTrigger.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useLamplightEmbeddingTrigger } from './useLamplightEmbeddingTrigger';
import { FakeLamplightAdapter } from '../storage/fake-lamplight-adapter';
import type { Note } from '../types';

function note(id: string, content: string): Note {
  return { id, content, title: 't', folderId: null, tags: [], type: 'devotion', createdAt: '', updatedAt: '', wordCount: 0 } as never;
}

const docWithText = (txt: string) =>
  JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: txt }] }] });

describe('useLamplightEmbeddingTrigger', () => {
  let adapter: FakeLamplightAdapter;
  let invokeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new FakeLamplightAdapter();
    invokeMock = vi.fn(async () => ({ data: null, error: null }));
  });

  it('does nothing when settings.enabled is false', async () => {
    const { result } = renderHook(() => useLamplightEmbeddingTrigger({
      adapter, enabled: false, userId: 'u1', invoke: invokeMock,
    }));
    await result.current(note('n1', docWithText('hi')));
    expect(adapter.enqueueCalls).toEqual([]);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('does nothing when userId is null', async () => {
    const { result } = renderHook(() => useLamplightEmbeddingTrigger({
      adapter, enabled: true, userId: null, invoke: invokeMock,
    }));
    await result.current(note('n1', docWithText('hi')));
    expect(adapter.enqueueCalls).toEqual([]);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('skips notes whose plaintext is empty', async () => {
    const { result } = renderHook(() => useLamplightEmbeddingTrigger({
      adapter, enabled: true, userId: 'u1', invoke: invokeMock,
    }));
    await result.current(note('n1', JSON.stringify({ type: 'doc', content: [] })));
    expect(adapter.enqueueCalls).toEqual([]);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('enqueues + invokes when text is present and adapter returns a job id', async () => {
    const { result } = renderHook(() => useLamplightEmbeddingTrigger({
      adapter, enabled: true, userId: 'u1', invoke: invokeMock,
    }));
    await result.current(note('n1', docWithText('hello world')));
    expect(adapter.enqueueCalls.length).toBe(1);
    expect(adapter.enqueueCalls[0].noteId).toBe('n1');
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });
    expect(invokeMock.mock.calls[0][0]).toBe('embed-note');
    expect(invokeMock.mock.calls[0][1]).toMatchObject({ body: { job_id: expect.stringMatching(/^job-n1-/) } });
  });

  it('does not invoke when RPC returns null (no-op enqueue)', async () => {
    const { result } = renderHook(() => useLamplightEmbeddingTrigger({
      adapter, enabled: true, userId: 'u1', invoke: invokeMock,
    }));
    await result.current(note('n1', docWithText('hello')));
    await result.current(note('n1', docWithText('hello'))); // same hash → RPC returns null
    expect(adapter.enqueueCalls.length).toBe(2);
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
  });

  it('swallows invoke errors (cron will pick up the job)', async () => {
    const erroringInvoke = vi.fn(async () => { throw new Error('network'); });
    const { result } = renderHook(() => useLamplightEmbeddingTrigger({
      adapter, enabled: true, userId: 'u1', invoke: erroringInvoke,
    }));
    await expect(result.current(note('n1', docWithText('x')))).resolves.not.toThrow();
  });

  it('swallows adapter.enqueueEmbedding errors', async () => {
    const errAdapter = new FakeLamplightAdapter();
    errAdapter.enqueueEmbedding = vi.fn(async () => { throw new Error('rpc fail'); }) as never;
    const { result } = renderHook(() => useLamplightEmbeddingTrigger({
      adapter: errAdapter, enabled: true, userId: 'u1', invoke: invokeMock,
    }));
    await expect(result.current(note('n1', docWithText('x')))).resolves.not.toThrow();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 10.2: Run test to verify it fails**

Run: `npx vitest run src/notepad/hooks/useLamplightEmbeddingTrigger.test.tsx`
Expected: FAIL — `Cannot find module './useLamplightEmbeddingTrigger'`.

- [ ] **Step 10.3: Implement**

```ts
// src/notepad/hooks/useLamplightEmbeddingTrigger.ts
import { useCallback } from 'react';
import type { Note } from '../types';
import type { LamplightAdapter } from '../storage/lamplight-adapter';
import { extractTextFromNote } from '../utils/tiptap-text';
import { lamplightContentHash } from '../utils/lamplight-content-hash';

export interface InvokeFn {
  (functionName: 'embed-note', options: { body: Record<string, unknown> }): Promise<unknown>;
}

export interface UseLamplightEmbeddingTriggerArgs {
  adapter: LamplightAdapter;
  enabled: boolean;
  userId: string | null;
  invoke: InvokeFn;
}

export function useLamplightEmbeddingTrigger({
  adapter, enabled, userId, invoke,
}: UseLamplightEmbeddingTriggerArgs) {
  return useCallback(async (note: Note) => {
    if (!enabled || !userId) return;
    const plaintext = extractTextFromNote(note);
    if (plaintext.trim().length === 0) return;
    const hash = lamplightContentHash(plaintext);
    let jobId: string | null = null;
    try {
      jobId = await adapter.enqueueEmbedding(note.id, hash);
    } catch (err) {
      console.error('[lamplight] enqueueEmbedding failed', err);
      return;
    }
    if (!jobId) return;
    invoke('embed-note', { body: { job_id: jobId } })
      .catch((err) => console.warn('[lamplight] embed-note invoke failed (sweep will retry)', err));
  }, [adapter, enabled, userId, invoke]);
}
```

- [ ] **Step 10.4: Run tests to verify they pass**

Run: `npx vitest run src/notepad/hooks/useLamplightEmbeddingTrigger.test.tsx`
Expected: PASS — 7 tests passing.

- [ ] **Step 10.5: Commit**

```bash
git add src/notepad/hooks/useLamplightEmbeddingTrigger.ts src/notepad/hooks/useLamplightEmbeddingTrigger.test.tsx
git commit -m "feat(lamplight): useLamplightEmbeddingTrigger hook"
```

---

## Task 11: Wire the trigger into the editor save flow

The trigger callback needs to fire after every debounced save inside [src/notepad/editor/use-note-editor.ts](../../src/notepad/editor/use-note-editor.ts). The hook builds the callback from `(adapter, settings.enabled, userId, supabase.functions.invoke)` and passes it to `useNoteEditor` as a new optional prop.

**Files:**
- Modify: `src/notepad/editor/use-note-editor.ts`
- Modify: `src/notepad/components/Editor.tsx`
- Modify: `src/components/sections/Notepad.tsx`

- [ ] **Step 11.1: Extend `useNoteEditor` props**

Find the props interface in `src/notepad/editor/use-note-editor.ts` (around the top of the file) and add:

```ts
export interface UseNoteEditorArgs {
  activeNote: Note | null;
  updateNote: (id: string, patch: Partial<Note>) => void | Promise<void>;
  saveDebounceMs?: number;
  // NEW: callback invoked once per debounced save with the just-saved note state.
  // Used by Lamplight Signal Layer to enqueue embedding refresh. Errors are
  // swallowed inside the callback; this prop never rejects.
  onAfterSave?: (note: Note) => void;
}
```

- [ ] **Step 11.2: Call `onAfterSave` inside the debounced save**

Inside the `onUpdate({ editor: ed })` handler, the debounced timeout currently calls `updateNote(id, { content: json, tags })`. Wrap so the trigger fires after:

```ts
saveTimerRef.current = setTimeout(async () => {
  const patch = { content: json, tags };
  await updateNote(id, patch);
  if (onAfterSave) {
    // Reconstruct the just-saved note shape from activeNote + patch.
    onAfterSave({ ...activeNote, ...patch });
  }
}, saveDebounceMs);
```

If `updateNote` returns void (not a Promise) in your code, `await` is still safe (it resolves immediately).

- [ ] **Step 11.3: Build the callback inside the notepad section and thread it**

In `src/components/sections/Notepad.tsx`, the lamplight adapter is already built via `useMemo`. Add:

```tsx
// Inside the component, near the existing lamplightAdapter useMemo:
const { settings: lamplightSettings } = useLamplightSettings({
  adapter: lamplightAdapter as never, userId: user?.id ?? null,
});

const onAfterSave = useLamplightEmbeddingTrigger({
  adapter: lamplightAdapter as never,
  enabled: !!lamplightSettings?.enabled,
  userId: user?.id ?? null,
  invoke: (name, options) => supabase.functions.invoke(name, options),
});
```

Then pass `onAfterSave={onAfterSave}` down to wherever `<NotepadEditor />` consumes `useNoteEditor`. Adjust the prop signature of `<NotepadEditor />` to accept and forward this prop.

(If the simplest wiring requires lifting `useNoteEditor` to live one level higher, do so — the goal is one trigger callback per active editor instance.)

- [ ] **Step 11.4: Add a smoke test that the trigger fires after a save**

```tsx
// src/notepad/editor/use-note-editor.test.ts (extend existing file)
// — verify that providing onAfterSave causes the callback to fire once
//   per debounced save with the latest content.
//
// If the existing file already tests TipTap mocks, mirror that style.
// Otherwise the most pragmatic check is the unit test on the hook in Task 10
// plus a manual run-through in step 11.5. Skip this step if the existing
// editor test infra is too heavy to bolt onto.
```

- [ ] **Step 11.5: Manual smoke run**

```bash
npm run dev
```

In the browser:
1. Sign in.
2. Opt in via the Lamplight profile section.
3. Open `/notepad/notes`, create or open a note, type a sentence.
4. After ~500ms the autosave fires.
5. Network tab: a `POST /rest/v1/rpc/enqueue_lamplight_embedding` and a `POST /functions/v1/embed-note` should fire within ~3s.
6. In Supabase SQL editor:
   ```sql
   select source_id, length(embedding::text) > 100 as has_vector, content_hash, created_at
   from lamplight_embeddings where user_id = auth.uid() order by created_at desc limit 5;
   ```
   Expect at least one row matching the edited note.

- [ ] **Step 11.6: Typecheck + lint + run all tests**

Run: `npm run lint && npx tsc -b && npx vitest run`
Expected: clean.

- [ ] **Step 11.7: Commit**

```bash
git add src/notepad/editor/use-note-editor.ts src/notepad/components/Editor.tsx src/components/sections/Notepad.tsx
git commit -m "feat(lamplight): fire embedding trigger after notepad autosave"
```

---

## Task 12: BSB ingest script

**Files:**
- Create: `scripts/ingest-bsb.ts`
- Create: `scripts/data/.gitignore`
- Test: `scripts/ingest-bsb.test.ts`

- [ ] **Step 12.1: Add gitignore**

```
# scripts/data/.gitignore
bsb.json
*.cache.json
```

- [ ] **Step 12.2: Write the failing parse test**

```ts
// scripts/ingest-bsb.test.ts
import { describe, it, expect } from 'vitest';
import { parseBsbToRows } from './ingest-bsb';

const FIXTURE = {
  // Tiny BSB fragment — Psalm 23:1-2 and Psalm 24:1.
  // Shape matches bereanbible.com's JSON release.
  books: [
    { name: 'Psalms', abbrev: 'psa', chapters: [
      { number: 23, verses: [
        { number: 1, text: 'The LORD is my shepherd; I shall not want.' },
        { number: 2, text: 'He makes me lie down in green pastures.' },
      ]},
      { number: 24, verses: [
        { number: 1, text: 'The earth is the LORD’s, and the fullness thereof.' },
      ]},
    ]},
  ],
};

describe('parseBsbToRows', () => {
  it('emits one verse row per verse', () => {
    const { verses } = parseBsbToRows(FIXTURE as never);
    expect(verses).toEqual([
      { id: 'psa.23.1', book: 'psa', chapter: 23, verse_start: 1, verse_end: 1, translation: 'BSB',
        text: 'The LORD is my shepherd; I shall not want.', pericope_id: 'psa.23' },
      { id: 'psa.23.2', book: 'psa', chapter: 23, verse_start: 2, verse_end: 2, translation: 'BSB',
        text: 'He makes me lie down in green pastures.', pericope_id: 'psa.23' },
      { id: 'psa.24.1', book: 'psa', chapter: 24, verse_start: 1, verse_end: 1, translation: 'BSB',
        text: 'The earth is the LORD’s, and the fullness thereof.', pericope_id: 'psa.24' },
    ]);
  });

  it('emits one pericope row per chapter, joining verses with newlines', () => {
    const { pericopes } = parseBsbToRows(FIXTURE as never);
    expect(pericopes).toEqual([
      { id: 'psa.23', book: 'psa', chapter: 23, verse_start: 1, verse_end: 2, translation: 'BSB',
        text: 'The LORD is my shepherd; I shall not want.\nHe makes me lie down in green pastures.', pericope_id: 'psa.23' },
      { id: 'psa.24', book: 'psa', chapter: 24, verse_start: 1, verse_end: 1, translation: 'BSB',
        text: 'The earth is the LORD’s, and the fullness thereof.', pericope_id: 'psa.24' },
    ]);
  });
});
```

- [ ] **Step 12.3: Run test to verify it fails**

Run: `npx vitest run scripts/ingest-bsb.test.ts`
Expected: FAIL — `Cannot find module './ingest-bsb'` or `parseBsbToRows not defined`.

- [ ] **Step 12.4: Implement the script**

```ts
// scripts/ingest-bsb.ts
//
// One-shot BSB ingest into bible_passages + lamplight_embeddings.
// Idempotent: re-running skips rows already inserted with the same content_hash.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... VOYAGE_AI_KEY=... \
//     npx tsx scripts/ingest-bsb.ts
//
// Source: https://bereanbible.com/bsb.json (public domain). Cached locally at
// scripts/data/bsb.json so re-runs are offline.

import { createClient } from '@supabase/supabase-js';
import { sha256 } from 'js-sha256';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { embedDocuments } from '../supabase/functions/_shared/voyage';

const BSB_URL = 'https://bereanbible.com/bsb.json';
const CACHE_PATH = 'scripts/data/bsb.json';
const BATCH = 64;

export interface BsbVerse { number: number; text: string }
export interface BsbChapter { number: number; verses: BsbVerse[] }
export interface BsbBook { name: string; abbrev: string; chapters: BsbChapter[] }
export interface BsbCorpus { books: BsbBook[] }

export interface PassageRow {
  id: string;
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  translation: 'BSB';
  text: string;
  pericope_id: string;
}

export function parseBsbToRows(corpus: BsbCorpus): { verses: PassageRow[]; pericopes: PassageRow[] } {
  const verses: PassageRow[] = [];
  const pericopes: PassageRow[] = [];
  for (const book of corpus.books) {
    for (const ch of book.chapters) {
      const pericopeId = `${book.abbrev}.${ch.number}`;
      const verseTexts: string[] = [];
      for (const v of ch.verses) {
        verses.push({
          id: `${book.abbrev}.${ch.number}.${v.number}`,
          book: book.abbrev,
          chapter: ch.number,
          verse_start: v.number,
          verse_end: v.number,
          translation: 'BSB',
          text: v.text,
          pericope_id: pericopeId,
        });
        verseTexts.push(v.text);
      }
      pericopes.push({
        id: pericopeId,
        book: book.abbrev,
        chapter: ch.number,
        verse_start: ch.verses[0]?.number ?? 1,
        verse_end: ch.verses[ch.verses.length - 1]?.number ?? 1,
        translation: 'BSB',
        text: verseTexts.join('\n'),
        pericope_id: pericopeId,
      });
    }
  }
  return { verses, pericopes };
}

async function loadCorpus(): Promise<BsbCorpus> {
  if (existsSync(CACHE_PATH)) {
    return JSON.parse(await readFile(CACHE_PATH, 'utf8'));
  }
  await mkdir('scripts/data', { recursive: true });
  const res = await fetch(BSB_URL);
  if (!res.ok) throw new Error(`fetch ${BSB_URL}: ${res.status}`);
  const text = await res.text();
  await writeFile(CACHE_PATH, text);
  return JSON.parse(text);
}

async function main() {
  const url = required('SUPABASE_URL');
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  const voyageKey = required('VOYAGE_AI_KEY');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log('loading BSB corpus…');
  const corpus = await loadCorpus();
  const { verses, pericopes } = parseBsbToRows(corpus);
  const all = [...verses, ...pericopes];
  console.log(`parsed ${verses.length} verses + ${pericopes.length} pericopes = ${all.length} rows`);

  // 1. Upsert bible_passages.
  for (let i = 0; i < all.length; i += 500) {
    const batch = all.slice(i, i + 500);
    const { error } = await supabase.from('bible_passages').upsert(batch, { onConflict: 'id' });
    if (error) throw error;
  }
  console.log('bible_passages upserted');

  // 2. Find rows missing an embedding.
  const { data: existing, error: exErr } = await supabase
    .from('lamplight_embeddings').select('source_id, content_hash')
    .is('user_id', null).eq('source_type', 'bible_passage');
  if (exErr) throw exErr;
  const existingMap = new Map((existing ?? []).map(r => [r.source_id, r.content_hash]));

  const toEmbed = all.filter(p => existingMap.get(p.id) !== sha256(p.text));
  console.log(`${toEmbed.length} rows need (re-)embedding`);

  // 3. Embed + upsert in batches.
  for (let i = 0; i < toEmbed.length; i += BATCH) {
    const batch = toEmbed.slice(i, i + BATCH);
    const vectors = await embedDocuments(batch.map(p => p.text), { apiKey: voyageKey, fetch });
    const rows = batch.map((p, idx) => ({
      user_id: null,
      source_type: 'bible_passage',
      source_id: p.id,
      content_hash: sha256(p.text),
      embedding: vectors[idx],
      metadata: {
        book: p.book, chapter: p.chapter,
        verse_start: p.verse_start, verse_end: p.verse_end,
        translation: p.translation, pericope_id: p.pericope_id,
      },
    }));
    const { error } = await supabase.from('lamplight_embeddings').upsert(rows, {
      onConflict: 'user_id,source_type,source_id',
    });
    if (error) throw error;
    if ((i / BATCH) % 10 === 0) console.log(`  embedded ${Math.min(i + BATCH, toEmbed.length)}/${toEmbed.length}`);
  }
  console.log('done');
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} required`);
  return v;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 12.5: Run parse test to verify pass**

Run: `npx vitest run scripts/ingest-bsb.test.ts`
Expected: PASS — 2 tests passing.

- [ ] **Step 12.6: Dry-run against a fresh local DB (optional but recommended)**

With `supabase start` running and `VOYAGE_AI_KEY` exported:

```bash
SUPABASE_URL="$(supabase status -o env | grep API_URL | cut -d= -f2-)" \
SUPABASE_SERVICE_ROLE_KEY="$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2-)" \
VOYAGE_AI_KEY="$VOYAGE_AI_KEY" \
  npx tsx scripts/ingest-bsb.ts
```

Expected: ~32K rows, < $2 in Voyage credits, completes in 5–10 minutes. Re-running prints `0 rows need (re-)embedding`.

- [ ] **Step 12.7: Commit**

```bash
git add scripts/ingest-bsb.ts scripts/ingest-bsb.test.ts scripts/data/.gitignore
git commit -m "feat(lamplight): BSB corpus ingest script (verses + pericopes)"
```

---

## Task 13: Existing-note backfill script

**Files:**
- Create: `scripts/backfill-note-embeddings.ts`
- Test: `scripts/backfill-note-embeddings.test.ts`

The script's testable surface is the row-shaping function `buildBackfillJobs`. The DB I/O is exercised via Task 14 (integration extension).

- [ ] **Step 13.1: Write the failing unit test**

```ts
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
```

- [ ] **Step 13.2: Run test to verify it fails**

Run: `npx vitest run scripts/backfill-note-embeddings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 13.3: Implement**

```ts
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

  // Select candidates: opted-in users, notes that have no embedding row yet.
  // We do this in batches by paging through notes.
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

    // Filter to opted-in users + missing embeddings.
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
```

- [ ] **Step 13.4: Run test to verify it passes**

Run: `npx vitest run scripts/backfill-note-embeddings.test.ts`
Expected: PASS — 2 tests passing.

- [ ] **Step 13.5: Commit**

```bash
git add scripts/backfill-note-embeddings.ts scripts/backfill-note-embeddings.test.ts
git commit -m "feat(lamplight): one-shot backfill script for existing notes"
```

---

## Task 14: Extend RLS isolation test with embeddings + Bible-row visibility

**Files:**
- Modify: `src/__tests__/rls-isolation.test.ts` (or wherever Foundation placed it)

The Foundation test already verifies isolation across `lamplight_settings`, `lamplight_entitlements`, `lamplight_artifacts`, `lamplight_jobs`, `lamplight_suggestions_log`, `lamplight_connections`. Sub-project 2 needs to add:
1. User A cannot read user B's `lamplight_embeddings`.
2. Bible rows (`user_id IS NULL`) are invisible to authenticated users.

- [ ] **Step 14.1: Locate the existing test and add the embeddings block**

Find the existing `describe.skipIf(skip)('RLS isolation', …)` (likely `src/__tests__/rls-isolation.test.ts`). Add inside it:

```ts
it('user A cannot read user B lamplight_embeddings', async () => {
  // userA / userB / service are set up by the existing beforeAll.
  await service.from('lamplight_embeddings').insert({
    user_id: userB.id, source_type: 'note', source_id: 'rls-test-1',
    content_hash: 'h', embedding: new Array(1024).fill(0),
  });
  const { data, error } = await userA.client
    .from('lamplight_embeddings').select('*').eq('source_id', 'rls-test-1');
  expect(error).toBeNull();
  expect(data).toEqual([]);
});

it('Bible rows (user_id IS NULL) are invisible to authenticated users', async () => {
  await service.from('lamplight_embeddings').insert({
    user_id: null, source_type: 'bible_passage', source_id: 'rls-test-bsb',
    content_hash: 'h', embedding: new Array(1024).fill(0),
  });
  const { data, error } = await userA.client
    .from('lamplight_embeddings').select('*').eq('source_id', 'rls-test-bsb');
  expect(error).toBeNull();
  expect(data).toEqual([]);
  // Service role can still see it.
  const { data: svc } = await service
    .from('lamplight_embeddings').select('*').eq('source_id', 'rls-test-bsb');
  expect(svc).toHaveLength(1);
});
```

- [ ] **Step 14.2: Run the integration test**

Run: `npx vitest run src/__tests__/rls-isolation.test.ts`
Expected: PASS (or auto-skip without creds).

- [ ] **Step 14.3: Commit**

```bash
git add src/__tests__/rls-isolation.test.ts
git commit -m "test(lamplight): RLS isolation extension for embeddings + Bible rows"
```

---

## Task 15: Acceptance walkthrough + deploy

A non-coding task. Walk through the spec's 13 acceptance criteria one by one against the live preview build. Document any failures in a follow-up issue or fix-in-place.

- [ ] **Step 15.1: Verify migration**

```bash
supabase db reset
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" <<'SQL'
\dx
\d+ public.lamplight_embeddings
select proname from pg_proc where proname in
  ('enqueue_lamplight_embedding','claim_lamplight_jobs','claim_lamplight_job_by_id');
select jobname, schedule from cron.job where jobname='lamplight_embed_sweep';
SQL
```
Confirm: pg_cron + pg_net listed; HNSW index + unique constraint + CHECK present; all three functions exist; cron job scheduled.

- [ ] **Step 15.2: Deploy Edge Function + set secret**

```bash
supabase secrets set VOYAGE_AI_KEY="$VOYAGE_AI_KEY"
supabase functions deploy embed-note
```
Confirm: secret set, function deployed, URL captured into `docs/lamplight/post-deploy-signal-layer.md`.

- [ ] **Step 15.3: Provision cron settings (production only)**

In the production SQL editor, run:
```sql
alter database postgres
  set app.settings.embed_fn_url = 'https://<project-ref>.functions.supabase.co/embed-note';
alter database postgres
  set app.settings.service_role_key = '<service-role-jwt>';
```

- [ ] **Step 15.4: Run BSB ingest against production**

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... VOYAGE_AI_KEY=... \
  npx tsx scripts/ingest-bsb.ts
```
Confirm: ~32K rows + matching embeddings; cost < $2.

- [ ] **Step 15.5: Run note backfill against production**

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx tsx scripts/backfill-note-embeddings.ts
```
Confirm: jobs enqueued; queue drains within minutes.

- [ ] **Step 15.6: Smoke test happy path live**

Sign in as a real opted-in user → open a note → type a sentence → wait 3s → confirm a fresh `lamplight_embeddings` row appears.

- [ ] **Step 15.7: Walk each acceptance criterion**

For each numbered item (1–13) in the spec's "Acceptance criteria" section, mark verified or file a fix-it issue.

- [ ] **Step 15.8: Final commit (if any test/doc tweaks)**

```bash
git status
# expect: clean, or only doc tweaks captured already.
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Every spec section maps to a task:
  - Migration 011 — Tasks 2, 3, 4, 8 (schema, RPC, cron, claim RPCs)
  - Voyage client — Task 5
  - Deno port + isomorphism — Task 6
  - Edge Function — Tasks 7, 8
  - Adapter additions — Task 9
  - Client hook — Task 10
  - Editor wiring — Task 11
  - BSB ingest — Task 12
  - Backfill — Task 13
  - RLS isolation extension — Task 14
  - Acceptance criteria walkthrough — Task 15
- [x] **Placeholder scan:** No "TBD"/"TODO" markers in tasks. The optional smoke test in Step 11.4 is explicitly optional with a stated escape hatch.
- [x] **Type consistency:**
  - `LamplightAdapter.enqueueEmbedding(noteId: string, contentHash: string) => Promise<string | null>` — consistent across Task 9 (interface/supabase/fake), Task 10 (hook), Task 13 (backfill imports only the SQL shape, not this interface).
  - `process-job.ts` types (`Job`, `DbOps`, `EmbedFn`) are defined in Task 7 and consumed in Task 8.
  - `voyage.ts` exports `embedDocuments` and `embedQuery` — used by Task 8 (Edge Function), Task 12 (ingest script), Task 5 (its own tests).
- [x] **No magic UUIDs:** Bible rows use `user_id = null` everywhere (matches spec decision #8).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-26-lamplight-signal-layer.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
