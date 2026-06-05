# voyage-context-3 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Lamplight embeddings from `voyage-3-large @ 1024-dim` to `voyage-context-3 @ 512-dim` with paragraph-grain chunked storage for notes, single-chunk re-embed of the BSB corpus, server-side aggregation for the browser-callable neighbor RPC, and an active note-side reranker.

**Architecture:** Schema swap via TRUNCATE + ALTER TYPE on `lamplight_embeddings`, add `chunk_index` + `chunk_text` columns, rebuild HNSW + unique constraint at chunk grain. New `replace_note_embeddings` PL/pgSQL RPC handles atomic DELETE+INSERT per note. Match RPCs typed `vector(512)`. Edge Function chunks plaintext server-side and calls Voyage's `/v1/contextualizedembeddings` endpoint with `inputs: string[][]`. Retrieval layer fans out per source chunk and aggregates by max similarity per target note, then reranks. The browser-callable `match_my_note_neighbors` aggregates server-side via LATERAL to preserve its narrow security model.

**Tech Stack:** Supabase Postgres (pgvector 0.7+ with HNSW), Deno Edge Functions, Voyage AI `voyage-context-3` + `rerank-2.5`, TypeScript/Vitest, TipTap (note format).

**Spec:** `docs/superpowers/specs/2026-05-28-voyage-context-3-migration-design.md`

---

## File Structure

### New files
- `supabase/migrations/016_lamplight_voyage_context_3.sql` — schema + RPCs.
- `supabase/functions/_shared/chunker.ts` — paragraph-based chunker (pure function).
- `supabase/functions/_shared/chunker.test.ts` — chunker unit tests.

### Modified files
- `supabase/functions/_shared/voyage.ts` — switch to contextualized endpoint; model `voyage-context-3`; dim 512.
- `supabase/functions/_shared/voyage.test.ts` — update assertions to new endpoint + request shape.
- `supabase/functions/_shared/process-job.ts` — `DbOps` interface refactor; call chunker + `replace_note_embeddings`.
- `supabase/functions/_shared/process-job.test.ts` — multi-chunk happy path, chunk-count change.
- `supabase/functions/_shared/retrieval.ts` — rewrite `searchNeighbors`; project chunk cols in `searchBible`; flip note rerank on.
- `supabase/functions/_shared/retrieval.test.ts` — fan-out + max-aggregate + active rerank.
- `supabase/functions/embed-note/index.ts` — replace `upsertEmbedding` DbOp with `replaceNoteEmbeddings` factory.
- `scripts/ingest-bsb.ts` — wrap each row as a single-chunk doc; set `chunk_index = 0`, `chunk_text`.
- `scripts/ingest-bsb.test.ts` — add wrapping assertion via mocked Voyage call.
- `src/admin/lamplight-cost.ts` — add `'voyage-context-3'` entry.
- `src/admin/lamplight-cost.test.ts` — exercise the new model.

---

## Task 1: Migration 016 — schema swap + new RPCs

**Files:**
- Create: `supabase/migrations/016_lamplight_voyage_context_3.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/016_lamplight_voyage_context_3.sql` with this content:

```sql
-- 016_lamplight_voyage_context_3.sql
--
-- Migrate Lamplight embeddings from voyage-3-large @ 1024-dim to voyage-context-3
-- @ 512-dim with paragraph-grain chunking for notes. lamplight_embeddings holds
-- derived data only — vectors are recomputable from notes + BSB at any time.
-- This migration wipes the table; ingest-bsb.ts + backfill-note-embeddings.ts
-- repopulate it. Foundation tables (settings, jobs, usage, artifacts,
-- entitlements, suggestions, connections) are untouched.

-- ── 1. Drop dependents on the embedding column ───────────────────────────
drop index if exists public.lamplight_embeddings_embedding_hnsw;
alter table public.lamplight_embeddings
  drop constraint if exists lamplight_embeddings_source_uq;

-- ── 2. Drop the old match RPCs (their signatures reference vector(1024)) ─
drop function if exists public.match_user_note_embeddings(uuid, extensions.vector(1024), text, int);
drop function if exists public.match_bible_embeddings(extensions.vector(1024), int);
drop function if exists public.match_my_note_neighbors(uuid, int, float);

-- ── 3. Hard cutover ──────────────────────────────────────────────────────
truncate table public.lamplight_embeddings;
alter table public.lamplight_embeddings
  alter column embedding type extensions.vector(512);

-- ── 4. Add chunk columns; defaults let NOT NULL stick on the empty table ─
alter table public.lamplight_embeddings
  add column chunk_index int  not null default 0,
  add column chunk_text  text not null default '';

-- ── 5. Rebuild unique constraint at chunk grain ──────────────────────────
alter table public.lamplight_embeddings
  add constraint lamplight_embeddings_source_uq
  unique nulls not distinct (user_id, source_type, source_id, chunk_index);

-- ── 6. Rebuild HNSW on vector(512) ───────────────────────────────────────
create index lamplight_embeddings_embedding_hnsw
  on public.lamplight_embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ── 7. Service-role match RPCs (consumed by Edge Function retrieval) ─────
create or replace function public.match_user_note_embeddings(
  p_user_id           uuid,
  p_query_vector      extensions.vector(512),
  p_exclude_source_id text,
  p_limit             int default 50
) returns table (
  id          uuid,
  source_id   text,
  chunk_index int,
  chunk_text  text,
  similarity  float,
  metadata    jsonb
)
language sql stable security definer
set search_path = public, extensions
as $$
  select e.id, e.source_id, e.chunk_index, e.chunk_text,
         1 - (e.embedding <=> p_query_vector) as similarity,
         e.metadata
    from public.lamplight_embeddings e
   where e.user_id = p_user_id
     and e.source_type = 'note'
     and (p_exclude_source_id is null or e.source_id <> p_exclude_source_id)
   order by e.embedding <=> p_query_vector
   limit p_limit
$$;

revoke execute on function public.match_user_note_embeddings(uuid, extensions.vector(512), text, int)
  from public, authenticated;

create or replace function public.match_bible_embeddings(
  p_query_vector extensions.vector(512),
  p_limit        int default 50
) returns table (
  id          uuid,
  source_id   text,
  chunk_index int,
  chunk_text  text,
  similarity  float,
  metadata    jsonb
)
language sql stable security definer
set search_path = public, extensions
as $$
  select e.id, e.source_id, e.chunk_index, e.chunk_text,
         1 - (e.embedding <=> p_query_vector) as similarity,
         e.metadata
    from public.lamplight_embeddings e
   where e.user_id is null
     and e.source_type = 'bible_passage'
   order by e.embedding <=> p_query_vector
   limit p_limit
$$;

revoke execute on function public.match_bible_embeddings(extensions.vector(512), int)
  from public, authenticated;

-- ── 8. Authenticated browser-callable RPC with server-side aggregation ───
create or replace function public.match_my_note_neighbors(
  p_source_note_id uuid,
  p_k              int default 5,
  p_min_similarity float default 0.78
) returns table (
  related_note_id uuid,
  similarity      float
)
language plpgsql stable security definer
set search_path = public, extensions
set statement_timeout = '30s'
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  if not exists (
    select 1 from public.notes
     where id = p_source_note_id and user_id = v_user_id
  ) then
    raise exception 'not authorized';
  end if;

  return query
    with source_chunks as (
      select e.chunk_index, e.embedding
        from public.lamplight_embeddings e
       where e.user_id = v_user_id
         and e.source_type = 'note'
         and e.source_id = p_source_note_id::text
    ),
    candidate_hits as (
      select c.source_id as related_source_id,
             (1 - (c.embedding <=> sc.embedding))::float as sim
        from source_chunks sc
        cross join lateral (
          select e.source_id, e.embedding
            from public.lamplight_embeddings e
           where e.user_id = v_user_id
             and e.source_type = 'note'
             and e.source_id <> p_source_note_id::text
           order by e.embedding <=> sc.embedding
           limit greatest(p_k * 4, 20)
        ) c
    )
    select (related_source_id::uuid) as related_note_id,
           max(sim) as similarity
      from candidate_hits
     group by related_source_id
    having max(sim) >= p_min_similarity
     order by max(sim) desc
     limit p_k;
end;
$$;

grant execute on function public.match_my_note_neighbors(uuid, int, float) to authenticated;

-- ── 9. Edge-Function-only atomic DELETE+INSERT RPC ───────────────────────
create or replace function public.replace_note_embeddings(
  p_user_id      uuid,
  p_note_id      text,
  p_content_hash text,
  p_chunks       jsonb
) returns void
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  delete from public.lamplight_embeddings
   where user_id = p_user_id
     and source_type = 'note'
     and source_id = p_note_id;

  insert into public.lamplight_embeddings
    (user_id, source_type, source_id, chunk_index, chunk_text, content_hash, embedding, metadata)
  select p_user_id,
         'note',
         p_note_id,
         (c->>'chunk_index')::int,
         c->>'chunk_text',
         p_content_hash,
         (c->>'embedding')::extensions.vector(512),
         coalesce(c->'metadata', '{}'::jsonb)
    from jsonb_array_elements(p_chunks) c;
end;
$$;

revoke execute on function public.replace_note_embeddings(uuid, text, text, jsonb)
  from public, authenticated;
-- service-role only (no grant); Edge Function uses service-role JWT.
```

- [ ] **Step 2: Apply migration to local Supabase**

Run: `npx supabase db reset` (resets the local DB and applies all migrations 001–016 in order).

Expected: command completes without error. Console shows "Finished supabase db reset on branch <branch>."

If `supabase` CLI is not installed locally, follow the repo's existing convention. Otherwise: `supabase db push` against a development project. Do NOT apply to production at this stage.

- [ ] **Step 3: Verify schema state**

Run via `psql` against local DB (or Supabase Studio SQL editor):

```sql
-- Confirm embedding column is vector(512).
select format_type(atttypid, atttypmod)
  from pg_attribute
 where attrelid = 'public.lamplight_embeddings'::regclass
   and attname = 'embedding';
-- Expected: vector(512)

-- Confirm chunk columns exist.
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'lamplight_embeddings'
   and column_name in ('chunk_index', 'chunk_text');
-- Expected: two rows.

-- Confirm unique constraint includes chunk_index.
select indexdef from pg_indexes
 where schemaname = 'public' and indexname = 'lamplight_embeddings_source_uq';
-- Expected: contains (user_id, source_type, source_id, chunk_index)

-- Confirm HNSW index exists.
select indexdef from pg_indexes
 where schemaname = 'public' and indexname = 'lamplight_embeddings_embedding_hnsw';
-- Expected: USING hnsw (embedding extensions.vector_cosine_ops)

-- Confirm RPC signatures.
select proname, pg_get_function_arguments(oid)
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('match_user_note_embeddings', 'match_bible_embeddings',
                   'match_my_note_neighbors', 'replace_note_embeddings');
-- Expected: 4 rows; signatures reference vector(512).
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/016_lamplight_voyage_context_3.sql
git commit -m "feat(lamplight): migration 016 — voyage-context-3 schema + chunked embeddings"
```

---

## Task 2: Voyage client — failing tests first

**Files:**
- Modify: `supabase/functions/_shared/voyage.test.ts`

- [ ] **Step 1: Update the test file to assert the new endpoint and request shape**

Replace the contents of `supabase/functions/_shared/voyage.test.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest';
import { embedDocuments, embedQuery, rerank } from './voyage';

// Voyage's contextualized endpoint returns: { data: [{ embeddings: number[][] }, ...] }
// One outer entry per document; inner array is per-chunk vectors.
function mockFetchOk(payloads: Array<{ embeddingsPerDoc: number[][][]; total_tokens?: number }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const payload = payloads[i++];
    const body = {
      data: payload.embeddingsPerDoc.map(doc => ({ embeddings: doc })),
      usage: { total_tokens: payload.total_tokens ?? 42 },
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return { fn, calls };
}

describe('voyage embed (contextualized)', () => {
  it('posts to /v1/contextualizedembeddings with inputs: string[][] and model voyage-context-3', async () => {
    const { fn, calls } = mockFetchOk([{ embeddingsPerDoc: [[[0.1, 0.2], [0.3, 0.4]]], total_tokens: 7 }]);
    const out = await embedDocuments([['hello', 'world']], { apiKey: 'k', fetch: fn });
    expect(calls[0].url).toBe('https://api.voyageai.com/v1/contextualizedembeddings');
    expect(out.vectors).toEqual([[[0.1, 0.2], [0.3, 0.4]]]);
    expect(out.totalTokens).toBe(7);
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe('voyage-context-3');
    expect(body.inputs).toEqual([['hello', 'world']]);
    expect(body.input_type).toBe('document');
    expect(body.output_dimension).toBe(512);
    expect(body.output_dtype).toBe('float');
    expect(body.truncation).toBe(true);
    expect(calls[0].init.headers).toMatchObject({ Authorization: 'Bearer k' });
  });

  it('embedQuery wraps text as [[text]] with input_type query and returns one vector', async () => {
    const { fn, calls } = mockFetchOk([{ embeddingsPerDoc: [[[0.9, 0.8]]] }]);
    const out = await embedQuery('q', { apiKey: 'k', fetch: fn });
    expect(out).toEqual([0.9, 0.8]);
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.inputs).toEqual([['q']]);
    expect(body.input_type).toBe('query');
  });

  it('batches across the document-count cap', async () => {
    // 130 single-chunk docs; cap is 64 docs per request → 3 calls.
    const docs = Array.from({ length: 130 }, (_, i) => [`t${i}`]);
    const { fn, calls } = mockFetchOk([
      { embeddingsPerDoc: Array.from({ length: 64 }, () => [[1]]), total_tokens: 10 },
      { embeddingsPerDoc: Array.from({ length: 64 }, () => [[2]]), total_tokens: 10 },
      { embeddingsPerDoc: Array.from({ length: 2  }, () => [[3]]), total_tokens: 5  },
    ]);
    const out = await embedDocuments(docs, { apiKey: 'k', fetch: fn });
    expect(out.vectors.length).toBe(130);
    expect(out.totalTokens).toBe(25);
    expect(calls.length).toBe(3);
  });

  it('retries on 429 and succeeds', async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts === 1) return new Response('rate limited', { status: 429 });
      return new Response(JSON.stringify({
        data: [{ embeddings: [[1]] }],
        usage: { total_tokens: 3 },
      }), { status: 200 });
    });
    const out = await embedDocuments([['x']], { apiKey: 'k', fetch: fn, sleep: async () => {} });
    expect(out.vectors).toEqual([[[1]]]);
    expect(out.totalTokens).toBe(3);
    expect(attempts).toBe(2);
  });

  it('throws after 3 retries on 500', async () => {
    const fn = vi.fn(async () => new Response('boom', { status: 500 }));
    await expect(
      embedDocuments([['x']], { apiKey: 'k', fetch: fn, sleep: async () => {} })
    ).rejects.toThrow(/voyage 500/);
    expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  it('returns [] for empty input without calling fetch', async () => {
    const fn = vi.fn();
    const out = await embedDocuments([], { apiKey: 'k', fetch: fn });
    expect(out.vectors).toEqual([]);
    expect(out.totalTokens).toBe(0);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('voyage rerank (unchanged)', () => {
  function mockRerankOk(scores: Array<{ index: number; relevance_score: number }>) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fn = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ data: scores, usage: { total_tokens: 100 } }), { status: 200 });
    });
    return { fn, calls };
  }

  it('posts to /v1/rerank with rerank-2.5', async () => {
    const { fn, calls } = mockRerankOk([
      { index: 1, relevance_score: 0.9 },
      { index: 0, relevance_score: 0.3 },
    ]);
    const out = await rerank('q', ['a', 'b'], 2, { apiKey: 'k', fetch: fn });
    expect(calls[0].url).toBe('https://api.voyageai.com/v1/rerank');
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe('rerank-2.5');
    expect(out).toEqual([
      { index: 1, score: 0.9 },
      { index: 0, score: 0.3 },
    ]);
  });

  it('returns [] for empty documents without hitting the network', async () => {
    const fn = vi.fn();
    expect(await rerank('q', [], 5, { apiKey: 'k', fetch: fn })).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests and verify they FAIL**

Run: `npx vitest run supabase/functions/_shared/voyage.test.ts`

Expected: failures. Many tests fail because `voyage.ts` still uses the old endpoint, model name, dim, and response shape.

- [ ] **Step 3: Do not commit yet** — implementation lands in Task 3.

---

## Task 3: Voyage client — implementation

**Files:**
- Modify: `supabase/functions/_shared/voyage.ts`

- [ ] **Step 1: Replace voyage.ts implementation**

Replace the contents of `supabase/functions/_shared/voyage.ts` with:

```ts
// Pure Voyage AI HTTP wrapper. Imported by:
//   - supabase/functions/embed-note (Deno runtime; provides Deno-fetch)
//   - scripts/ingest-bsb.ts (Node runtime; provides global fetch)
//   - vitest tests (mocked fetch).
// No Deno or Node globals here — fetch and sleep are injected via deps.

export type InputType = 'document' | 'query';

const ENDPOINT = 'https://api.voyageai.com/v1/contextualizedembeddings';
export const MODEL = 'voyage-context-3';
export const DIM = 512;
const MAX_DOCS_PER_REQUEST = 64;
const MAX_RETRIES = 3;

export interface VoyageDeps {
  apiKey: string;
  fetch: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export interface EmbedDocumentsResult {
  // Outer index = document, inner index = chunk-within-document.
  vectors: number[][][];
  totalTokens: number;
}

export async function embedDocuments(
  chunksPerDoc: string[][],
  deps: VoyageDeps,
): Promise<EmbedDocumentsResult> {
  return embedBatched(chunksPerDoc, 'document', deps);
}

export async function embedQuery(text: string, deps: VoyageDeps): Promise<number[]> {
  const { vectors } = await embedBatched([[text]], 'query', deps);
  return vectors[0][0];
}

async function embedBatched(
  chunksPerDoc: string[][],
  inputType: InputType,
  deps: VoyageDeps,
): Promise<EmbedDocumentsResult> {
  if (chunksPerDoc.length === 0) return { vectors: [], totalTokens: 0 };
  const vectors: number[][][] = [];
  let totalTokens = 0;
  for (let i = 0; i < chunksPerDoc.length; i += MAX_DOCS_PER_REQUEST) {
    const batch = chunksPerDoc.slice(i, i + MAX_DOCS_PER_REQUEST);
    const result = await embedOnce(batch, inputType, deps, 0);
    vectors.push(...result.vectors);
    totalTokens += result.totalTokens;
  }
  return { vectors, totalTokens };
}

async function embedOnce(
  batch: string[][],
  inputType: InputType,
  deps: VoyageDeps,
  attempt: number,
): Promise<EmbedDocumentsResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const res = await deps.fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${deps.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      inputs: batch,
      input_type: inputType,
      output_dimension: DIM,
      output_dtype: 'float',
      truncation: true,
    }),
  });

  if (res.ok) {
    const json = await res.json() as {
      data: Array<{ embeddings: number[][] }>;
      usage?: { total_tokens?: number };
    };
    return {
      vectors: json.data.map(d => d.embeddings),
      totalTokens: json.usage?.total_tokens ?? 0,
    };
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

const RERANK_BASE = 'https://api.voyageai.com/v1/rerank';
const RERANK_MODEL = 'rerank-2.5';

export interface RerankResult {
  index: number;
  score: number;
}

export async function rerank(
  query: string,
  documents: string[],
  topK: number,
  deps: VoyageDeps,
): Promise<RerankResult[]> {
  if (documents.length === 0) return [];
  return rerankOnce(query, documents, topK, deps, 0);
}

async function rerankOnce(
  query: string,
  documents: string[],
  topK: number,
  deps: VoyageDeps,
  attempt: number,
): Promise<RerankResult[]> {
  const sleep = deps.sleep ?? defaultSleep;
  const res = await deps.fetch(RERANK_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${deps.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: RERANK_MODEL,
      query,
      documents,
      top_k: topK,
    }),
  });

  if (res.ok) {
    const json = await res.json() as { data: Array<{ index: number; relevance_score: number }> };
    return json.data.map(d => ({ index: d.index, score: d.relevance_score }));
  }

  const retryable = res.status === 429 || res.status >= 500;
  if (retryable && attempt < MAX_RETRIES) {
    const backoffMs = 500 * Math.pow(2, attempt) + Math.random() * 250;
    await sleep(backoffMs);
    return rerankOnce(query, documents, topK, deps, attempt + 1);
  }

  const detail = await res.text().catch(() => '');
  throw new Error(`voyage rerank ${res.status}: ${detail.slice(0, 500)}`);
}
```

- [ ] **Step 2: Run tests and verify they PASS**

Run: `npx vitest run supabase/functions/_shared/voyage.test.ts`

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/voyage.ts supabase/functions/_shared/voyage.test.ts
git commit -m "feat(lamplight): voyage client — contextualizedembeddings endpoint @ 512-dim"
```

---

## Task 4: Note chunker — failing tests

**Files:**
- Create: `supabase/functions/_shared/chunker.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `supabase/functions/_shared/chunker.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { chunkNotePlaintext, MIN_TOKENS, MAX_TOKENS } from './chunker';

// Helper: build a string of approximately N tokens (4 chars per token).
const t = (tokens: number): string => 'a'.repeat(tokens * 4);

describe('chunkNotePlaintext', () => {
  it('returns [] for empty string', () => {
    expect(chunkNotePlaintext('')).toEqual([]);
  });

  it('returns [] for whitespace-only string', () => {
    expect(chunkNotePlaintext('   \n\n  \n')).toEqual([]);
  });

  it('emits one chunk for a single short paragraph', () => {
    const chunks = chunkNotePlaintext('Hello world.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].text).toBe('Hello world.');
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('merges two short paragraphs into one chunk under MIN_TOKENS', () => {
    // Each ~10 tokens; combined ~20 tokens — still well under MIN_TOKENS.
    const plaintext = `${t(10)}\n\n${t(10)}`;
    const chunks = chunkNotePlaintext(plaintext);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain('\n\n');
    expect(chunks[0].tokenCount).toBeLessThan(MIN_TOKENS * 2);
  });

  it('does not merge when the buffer has reached MIN_TOKENS', () => {
    // First paragraph ≥ MIN_TOKENS → flushes; second starts a new chunk.
    const plaintext = `${t(MIN_TOKENS + 10)}\n\n${t(50)}`;
    const chunks = chunkNotePlaintext(plaintext);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].index).toBe(0);
    expect(chunks[1].index).toBe(1);
  });

  it('sentence-splits a paragraph that exceeds MAX_TOKENS', () => {
    // ~1000-token paragraph composed of multiple sentences.
    const sentence = `${t(150)}. `;
    const plaintext = sentence.repeat(7).trim(); // ~1050 tokens, 7 sentences
    const chunks = chunkNotePlaintext(plaintext);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.tokenCount).toBeLessThanOrEqual(MAX_TOKENS);
    }
  });

  it('emits an over-cap chunk when a single sentence exceeds MAX_TOKENS', () => {
    // One sentence, no boundary char inside, well over MAX_TOKENS.
    const plaintext = t(MAX_TOKENS + 200);
    const chunks = chunkNotePlaintext(plaintext);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].tokenCount).toBeGreaterThan(MAX_TOKENS);
    // Relies on Voyage truncation: true at the wire — chunker does not truncate.
  });

  it('emits dense 0-based indexes', () => {
    const plaintext = ['a', 'b', 'c'].map(s => t(MIN_TOKENS + 10) + ' ' + s).join('\n\n');
    const chunks = chunkNotePlaintext(plaintext);
    expect(chunks.map(c => c.index)).toEqual(chunks.map((_, i) => i));
  });
});
```

- [ ] **Step 2: Run tests and verify they FAIL with "module not found"**

Run: `npx vitest run supabase/functions/_shared/chunker.test.ts`

Expected: failure — `chunker.ts` does not exist.

---

## Task 5: Note chunker — implementation

**Files:**
- Create: `supabase/functions/_shared/chunker.ts`

- [ ] **Step 1: Implement the chunker**

Create `supabase/functions/_shared/chunker.ts`:

```ts
// Paragraph-grain chunker for note plaintext. Pure: no Deno/Node globals.
// Imported by the Edge Function and (potentially) test runners.

export const MIN_TOKENS = 100;
export const MAX_TOKENS = 600;
const CHARS_PER_TOKEN = 4; // crude but consistent across client and server

export interface NoteChunk {
  index: number;       // 0-based, dense within the chunk array
  text: string;        // exact text sent to Voyage; also stored as chunk_text
  tokenCount: number;  // estimated via ceil(len / CHARS_PER_TOKEN)
}

function approxTokens(s: string): number {
  return Math.ceil(s.length / CHARS_PER_TOKEN);
}

function sentenceSplit(text: string): string[] {
  // Split on sentence-final punctuation followed by whitespace.
  // Keeps the punctuation attached to the preceding sentence.
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.map(p => p.trim()).filter(p => p.length > 0);
}

// Greedily pack sentences into chunks of <= MAX_TOKENS. A sentence that itself
// exceeds MAX_TOKENS is emitted on its own (Voyage truncation: true handles
// the wire-level overflow).
function packSentences(sentences: string[]): string[] {
  const out: string[] = [];
  let buffer = '';
  let bufferTokens = 0;

  for (const s of sentences) {
    const sTokens = approxTokens(s);
    if (sTokens > MAX_TOKENS) {
      if (buffer) { out.push(buffer); buffer = ''; bufferTokens = 0; }
      out.push(s);
      continue;
    }
    if (bufferTokens + sTokens > MAX_TOKENS && buffer) {
      out.push(buffer);
      buffer = s;
      bufferTokens = sTokens;
    } else {
      buffer = buffer ? `${buffer} ${s}` : s;
      bufferTokens += sTokens;
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

export function chunkNotePlaintext(plaintext: string): NoteChunk[] {
  // 1. Split on \n\n+, trim, drop empties.
  const paragraphs = plaintext
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  if (paragraphs.length === 0) return [];

  // 2. Greedy merge + over-cap sentence split.
  const rawChunks: string[] = [];
  let buffer = '';
  let bufferTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = approxTokens(para);

    if (paraTokens > MAX_TOKENS) {
      // Flush buffer, then emit sentence-packed chunks for this paragraph.
      if (buffer) { rawChunks.push(buffer); buffer = ''; bufferTokens = 0; }
      for (const c of packSentences(sentenceSplit(para))) rawChunks.push(c);
      continue;
    }

    if (bufferTokens === 0) {
      buffer = para;
      bufferTokens = paraTokens;
      continue;
    }

    // Buffer non-empty.
    if (bufferTokens < MIN_TOKENS && bufferTokens + paraTokens <= MAX_TOKENS) {
      // Merge.
      buffer = `${buffer}\n\n${para}`;
      bufferTokens += paraTokens;
    } else {
      // Flush + start new.
      rawChunks.push(buffer);
      buffer = para;
      bufferTokens = paraTokens;
    }
  }
  if (buffer) rawChunks.push(buffer);

  return rawChunks.map((text, index) => ({
    index,
    text,
    tokenCount: approxTokens(text),
  }));
}
```

- [ ] **Step 2: Run tests and verify they PASS**

Run: `npx vitest run supabase/functions/_shared/chunker.test.ts`

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/chunker.ts supabase/functions/_shared/chunker.test.ts
git commit -m "feat(lamplight): paragraph-grain note chunker with greedy merge"
```

---

## Task 6: process-job — interface refactor (failing tests)

**Files:**
- Modify: `supabase/functions/_shared/process-job.test.ts`

The `DbOps` interface changes: `upsertEmbedding(row)` → `replaceNoteEmbeddings(args)`. The processJobs function now calls the chunker and produces N chunks per note. Tests assert the new shape.

- [ ] **Step 1: Replace process-job.test.ts**

Replace `supabase/functions/_shared/process-job.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run tests and verify they FAIL**

Run: `npx vitest run supabase/functions/_shared/process-job.test.ts`

Expected: failures — `ReplaceArgs` type and `replaceNoteEmbeddings` op don't exist yet; processJobs still does single-vector upsert with `voyage-3-large`.

- [ ] **Step 3: Do not commit yet** — implementation in Task 7.

---

## Task 7: process-job — implementation

**Files:**
- Modify: `supabase/functions/_shared/process-job.ts`

- [ ] **Step 1: Replace process-job.ts**

Replace `supabase/functions/_shared/process-job.ts` with:

```ts
// supabase/functions/_shared/process-job.ts
import { extractTextFromNoteContent } from './tiptap-text.ts';
import { chunkNotePlaintext } from './chunker.ts';

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

export interface ChunkPayload {
  chunk_index: number;
  chunk_text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface ReplaceArgs {
  userId: string;
  noteId: string;
  contentHash: string;
  chunks: ChunkPayload[];
}

export interface DbOps {
  loadNote(noteId: string): Promise<NoteRow | null>;
  loadExistingHash(userId: string, noteId: string): Promise<string | null>;
  replaceNoteEmbeddings(args: ReplaceArgs): Promise<void>;
  markDone(jobId: string): Promise<void>;
  markFailedOrRetry(job: Job, err: unknown, attempts: number): Promise<void>;
  recordUsage(row: {
    user_id: string;
    model: 'voyage-context-3';
    artifact_kind: 'embedding_refresh';
    tokens_in: number;
    tokens_out: number;
    status: 'ok' | 'error';
    error_code?: string | null;
  }): Promise<void>;
}

// EmbedFn signature: takes one or more documents (each a list of chunk strings)
// and returns one vector per chunk per document, plus a token count.
export type EmbedFn = (chunksPerDoc: string[][]) => Promise<{
  vectors: number[][][];
  totalTokens: number;
}>;
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

    const noteChunks = chunkNotePlaintext(plaintext);
    if (noteChunks.length === 0) { await ops.markDone(job.id); continue; }

    let chunkVectors: number[][];
    let tokensIn: number;
    try {
      const result = await embed([noteChunks.map(c => c.text)]);
      chunkVectors = result.vectors[0];
      tokensIn = result.totalTokens;
      await ops.replaceNoteEmbeddings({
        userId: note.user_id,
        noteId,
        contentHash: newHash,
        chunks: noteChunks.map((c, i) => ({
          chunk_index: c.index,
          chunk_text: c.text,
          embedding: chunkVectors[i],
        })),
      });
    } catch (err) {
      await ops.markFailedOrRetry(job, err, (job.attempts ?? 0) + 1);
      if ((job.attempts ?? 0) + 1 >= MAX_ATTEMPTS) {
        void ops.recordUsage({
          user_id: note.user_id,
          model: 'voyage-context-3',
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
      model: 'voyage-context-3',
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
```

- [ ] **Step 2: Run tests and verify they PASS**

Run: `npx vitest run supabase/functions/_shared/process-job.test.ts`

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/process-job.ts supabase/functions/_shared/process-job.test.ts
git commit -m "feat(lamplight): process-job — chunked DbOps + voyage-context-3 usage"
```

---

## Task 8: Edge Function — wire up `replaceNoteEmbeddings` factory

**Files:**
- Modify: `supabase/functions/embed-note/index.ts`

- [ ] **Step 1: Replace embed-note/index.ts buildOps + embed adapter**

Replace `supabase/functions/embed-note/index.ts` with:

```ts
// supabase/functions/embed-note/index.ts
//
// Two payload shapes:
//   { job_id: "<uuid>" }   — process exactly that job (client-triggered).
//   { sweep: true }        — claim up to 5 oldest queued jobs (pg_cron path).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { embedDocuments } from '../_shared/voyage.ts';
import { recordLamplightUsage } from '../_shared/usage.ts';
import {
  claimAndRun, processJobs,
  type Job, type DbOps, type ClaimFn, type EmbedFn, type ReplaceArgs,
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
        const backoffSec = 5 * Math.pow(2, attempts);
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
// Sending a number[] as JSON would arrive as a JSON array and pgvector would
// reject the cast inside replace_note_embeddings.
function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}
```

- [ ] **Step 2: Typecheck the file by running the whole suite**

Run: `npx vitest run`

Expected: all unit tests still pass (this change is wiring, no new test surface, but we want to catch type breakage).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/embed-note/index.ts
git commit -m "feat(lamplight): embed-note — wire replace_note_embeddings RPC"
```

---

## Task 9: Retrieval — failing tests for chunked fan-out

**Files:**
- Modify: `supabase/functions/_shared/retrieval.test.ts`

- [ ] **Step 1: Replace retrieval.test.ts**

Replace `supabase/functions/_shared/retrieval.test.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest';
import { searchNeighbors, searchBible } from './retrieval';

type RpcRow = {
  id: string;
  source_id: string;
  chunk_index: number;
  chunk_text: string;
  similarity: number;
  metadata: Record<string, unknown>;
};

// Build a chained supabase stub: from(...).select(...).eq(...).eq(...).eq(...).order(...) → { data, error }.
// Returns the rows configured for the (table, source_id) the caller queries.
function makeSupabaseStub(opts: {
  rpcRowsByCall?: Array<RpcRow[]>;          // FIFO per rpc(name) call
  bibleMatchRows?: RpcRow[];                 // for match_bible_embeddings
  sourceNoteChunks?: Array<{ chunk_index: number; chunk_text: string; embedding: number[] }>;
  biblePassageRowsById?: Record<string, string>;
}) {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let rpcCallIdx = 0;
  const rpcRowsByCall = opts.rpcRowsByCall ?? [];

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ name, args });
    if (name === 'match_bible_embeddings') return { data: opts.bibleMatchRows ?? [], error: null };
    if (name === 'match_user_note_embeddings') {
      const rows = rpcRowsByCall[rpcCallIdx] ?? [];
      rpcCallIdx++;
      return { data: rows, error: null };
    }
    return { data: [], error: null };
  });

  const from = vi.fn((table: string) => {
    if (table === 'lamplight_embeddings') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({ data: opts.sourceNoteChunks ?? [], error: null }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === 'bible_passages') {
      const map = opts.biblePassageRowsById ?? {};
      return {
        select: () => ({
          in: () => ({ data: Object.entries(map).map(([id, text]) => ({ id, text })), error: null }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return { supabase: { rpc, from } as unknown as Parameters<typeof searchBible>[0]['supabase'], rpc, from, rpcCalls };
}

const voyageDeps = { apiKey: 'k', fetch: vi.fn() };

describe('searchBible', () => {
  it('embeds the query when no precomputed vector is supplied (512-dim path)', async () => {
    const embedFetch = vi.fn(async () => new Response(
      JSON.stringify({ data: [{ embeddings: [new Array(512).fill(0.01)] }] }),
      { status: 200 },
    ));
    const { supabase, rpcCalls } = makeSupabaseStub({
      bibleMatchRows: [
        { id: 'e1', source_id: 'psa.23.4', chunk_index: 0, chunk_text: 'Even though…', similarity: 0.9, metadata: { book: 'Psalm' } },
      ],
      biblePassageRowsById: { 'psa.23.4': 'Even though I walk through the valley…' },
    });
    const out = await searchBible(
      { supabase, voyage: { apiKey: 'k', fetch: embedFetch }, rerankEnabled: false },
      { query: 'rest', k: 1 },
    );
    expect(embedFetch).toHaveBeenCalledTimes(1);
    expect(rpcCalls[0].name).toBe('match_bible_embeddings');
    expect(out).toHaveLength(1);
    expect(out[0].source_id).toBe('psa.23.4');
  });
});

describe('searchNeighbors (chunked)', () => {
  it('returns [] when the source note has no chunks', async () => {
    const { supabase } = makeSupabaseStub({ sourceNoteChunks: [] });
    const out = await searchNeighbors(
      { supabase, voyage: voyageDeps, rerankEnabled: false },
      { userId: 'u1', noteId: 'n1', k: 5 },
    );
    expect(out).toEqual([]);
  });

  it('fans out one rpc call per source chunk', async () => {
    const { supabase, rpcCalls } = makeSupabaseStub({
      sourceNoteChunks: [
        { chunk_index: 0, chunk_text: 'first', embedding: new Array(512).fill(0.1) },
        { chunk_index: 1, chunk_text: 'second', embedding: new Array(512).fill(0.2) },
        { chunk_index: 2, chunk_text: 'third', embedding: new Array(512).fill(0.3) },
      ],
      rpcRowsByCall: [
        [{ id: 'a', source_id: 'n2', chunk_index: 0, chunk_text: 'n2 chunk 0', similarity: 0.80, metadata: {} }],
        [{ id: 'b', source_id: 'n2', chunk_index: 1, chunk_text: 'n2 chunk 1', similarity: 0.92, metadata: {} }],
        [{ id: 'c', source_id: 'n3', chunk_index: 0, chunk_text: 'n3 chunk 0', similarity: 0.85, metadata: {} }],
      ],
    });
    const out = await searchNeighbors(
      { supabase, voyage: voyageDeps, rerankEnabled: false },
      { userId: 'u1', noteId: 'n1', k: 5 },
    );
    expect(rpcCalls.filter(c => c.name === 'match_user_note_embeddings')).toHaveLength(3);
    // n2 wins (max sim 0.92), n3 second (0.85).
    expect(out.map(r => r.source_id)).toEqual(['n2', 'n3']);
    expect(out[0].similarity).toBeCloseTo(0.92);
  });

  it('keeps the max similarity when the same target appears in multiple chunk queries', async () => {
    const { supabase } = makeSupabaseStub({
      sourceNoteChunks: [
        { chunk_index: 0, chunk_text: 'src0', embedding: new Array(512).fill(0.1) },
        { chunk_index: 1, chunk_text: 'src1', embedding: new Array(512).fill(0.2) },
      ],
      rpcRowsByCall: [
        [{ id: 'x1', source_id: 'n2', chunk_index: 0, chunk_text: 'tgt0', similarity: 0.81, metadata: {} }],
        [{ id: 'x2', source_id: 'n2', chunk_index: 1, chunk_text: 'tgt1', similarity: 0.85, metadata: {} }],
      ],
    });
    const out = await searchNeighbors(
      { supabase, voyage: voyageDeps, rerankEnabled: false },
      { userId: 'u1', noteId: 'n1', k: 5 },
    );
    expect(out).toHaveLength(1);
    expect(out[0].source_id).toBe('n2');
    expect(out[0].similarity).toBeCloseTo(0.85);
  });

  it('reranks the candidate pool when rerankEnabled is true', async () => {
    const rerankFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/v1/rerank')) {
        return new Response(JSON.stringify({
          data: [
            { index: 1, relevance_score: 0.99 },
            { index: 0, relevance_score: 0.40 },
          ],
        }), { status: 200 });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    const { supabase } = makeSupabaseStub({
      sourceNoteChunks: [
        { chunk_index: 0, chunk_text: 'src winner text', embedding: new Array(512).fill(0.1) },
      ],
      rpcRowsByCall: [
        [
          { id: 'a', source_id: 'n2', chunk_index: 0, chunk_text: 'tgt A',  similarity: 0.90, metadata: {} },
          { id: 'b', source_id: 'n3', chunk_index: 0, chunk_text: 'tgt B',  similarity: 0.80, metadata: {} },
        ],
      ],
    });
    const out = await searchNeighbors(
      { supabase, voyage: { apiKey: 'k', fetch: rerankFetch }, rerankEnabled: true },
      { userId: 'u1', noteId: 'n1', k: 2 },
    );
    // Reranker promoted n3 (relevance 0.99) above n2.
    expect(out.map(r => r.source_id)).toEqual(['n3', 'n2']);
    expect(out[0].rerank_score).toBeCloseTo(0.99);
  });
});
```

- [ ] **Step 2: Run tests and verify they FAIL**

Run: `npx vitest run supabase/functions/_shared/retrieval.test.ts`

Expected: failures — retrieval.ts still uses the old `embedding` column read + single-RPC path.

- [ ] **Step 3: Do not commit yet** — implementation in Task 10.

---

## Task 10: Retrieval — implementation

**Files:**
- Modify: `supabase/functions/_shared/retrieval.ts`

- [ ] **Step 1: Replace retrieval.ts**

Replace `supabase/functions/_shared/retrieval.ts` with:

```ts
// Retrieval helpers for the Reasoning Layer. Wraps the match_* RPCs and
// reranks via Voyage. Pure (modulo injected supabase + voyage deps).

import type { SupabaseClient } from '@supabase/supabase-js';
import { embedQuery, rerank, type VoyageDeps } from './voyage.ts';

export interface RetrievalDeps {
  supabase: SupabaseClient;
  voyage: VoyageDeps;
  rerankEnabled: boolean;
}

export interface RetrievedItem {
  id: string;
  source_id: string;
  chunk_index: number;
  chunk_text: string;
  similarity: number;
  rerank_score?: number;
  metadata: Record<string, unknown>;
}

interface MatchRow {
  id: string;
  source_id: string;
  chunk_index: number;
  chunk_text: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

interface SourceChunkRow {
  chunk_index: number;
  chunk_text: string;
  embedding: number[];
}

const POOL_SIZE = 50;

export async function searchBible(
  deps: RetrievalDeps,
  args: { query: string; k: number; queryEmbedding?: number[] },
): Promise<RetrievedItem[]> {
  const vector = args.queryEmbedding ?? await embedQuery(args.query, deps.voyage);
  const limit = deps.rerankEnabled ? POOL_SIZE : args.k;
  const { data, error } = await deps.supabase.rpc('match_bible_embeddings', {
    p_query_vector: vector,
    p_limit: limit,
  });
  if (error) throw error;
  const rows = (data ?? []) as MatchRow[];
  if (rows.length === 0) return [];

  if (!deps.rerankEnabled) {
    return rows.slice(0, args.k).map(toRetrievedItem);
  }
  return rerankBibleRows(deps, args.query, rows, args.k);
}

export async function searchNeighbors(
  deps: RetrievalDeps,
  args: { userId: string; noteId: string; k: number },
): Promise<RetrievedItem[]> {
  // 1. Fetch all chunks of the source note, ordered by chunk_index.
  const sourceChunks = await loadNoteChunks(deps.supabase, args.userId, args.noteId);
  if (sourceChunks.length === 0) return [];

  // 2. Per-chunk fan-out. Group results by target source_id; keep max-sim per target.
  type BestHit = MatchRow & { sourceChunkText: string };
  const best = new Map<string, BestHit>();

  for (const sc of sourceChunks) {
    const { data, error } = await deps.supabase.rpc('match_user_note_embeddings', {
      p_user_id: args.userId,
      p_query_vector: sc.embedding,
      p_exclude_source_id: args.noteId,
      p_limit: POOL_SIZE,
    });
    if (error) throw error;
    for (const r of (data ?? []) as MatchRow[]) {
      const prev = best.get(r.source_id);
      if (!prev || r.similarity > prev.similarity) {
        best.set(r.source_id, { ...r, sourceChunkText: sc.chunk_text });
      }
    }
  }

  // 3. Top candidates by max-chunk similarity.
  const topPool = [...best.values()].sort((a, b) => b.similarity - a.similarity);
  if (topPool.length === 0) return [];

  if (!deps.rerankEnabled) {
    return topPool.slice(0, args.k).map(toRetrievedItem);
  }

  // 4. Rerank. Query = source-chunk text that produced the top-1 candidate.
  //    Documents = each candidate's best-matching chunk text.
  const rerankPool = topPool.slice(0, POOL_SIZE);
  const query = rerankPool[0].sourceChunkText;
  const documents = rerankPool.map(c => c.chunk_text);
  const scored = await rerank(query, documents, args.k, deps.voyage);
  return scored.map(s => toRetrievedItem({
    ...rerankPool[s.index],
    rerank_score: s.score,
  } as MatchRow & { rerank_score: number }));
}

async function loadNoteChunks(
  supabase: SupabaseClient,
  userId: string,
  noteId: string,
): Promise<SourceChunkRow[]> {
  const { data, error } = await supabase
    .from('lamplight_embeddings')
    .select('chunk_index, chunk_text, embedding')
    .eq('user_id', userId)
    .eq('source_type', 'note')
    .eq('source_id', noteId)
    .order('chunk_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SourceChunkRow[];
}

async function rerankBibleRows(
  deps: RetrievalDeps,
  query: string,
  rows: MatchRow[],
  k: number,
): Promise<RetrievedItem[]> {
  const sourceIds = rows.map(r => r.source_id);
  const { data, error } = await deps.supabase
    .from('bible_passages')
    .select('id, text')
    .in('id', sourceIds);
  if (error) throw error;
  const textById = new Map<string, string>();
  for (const r of (data ?? []) as Array<{ id: string; text: string }>) textById.set(r.id, r.text);
  const documents = rows.map(r => textById.get(r.source_id) ?? '');
  const scored = await rerank(query, documents, k, deps.voyage);
  return scored.map(s => toRetrievedItem({
    ...rows[s.index],
    rerank_score: s.score,
  } as MatchRow & { rerank_score: number }));
}

function toRetrievedItem(r: MatchRow & { rerank_score?: number }): RetrievedItem {
  return {
    id: r.id,
    source_id: r.source_id,
    chunk_index: r.chunk_index,
    chunk_text: r.chunk_text,
    similarity: r.similarity,
    metadata: r.metadata,
    ...(r.rerank_score !== undefined ? { rerank_score: r.rerank_score } : {}),
  };
}
```

- [ ] **Step 2: Run tests and verify they PASS**

Run: `npx vitest run supabase/functions/_shared/retrieval.test.ts`

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/retrieval.ts supabase/functions/_shared/retrieval.test.ts
git commit -m "feat(lamplight): retrieval — chunked fan-out + max-aggregate + active note rerank"
```

---

## Task 11: BSB ingest — single-chunk wrapping

**Files:**
- Modify: `scripts/ingest-bsb.ts`

- [ ] **Step 1: Update the ingest call site**

Open `scripts/ingest-bsb.ts`. Find the loop at the bottom of `main()` that calls `embedDocuments`. Replace this block:

```ts
  const UPSERT_CHUNK = 8;
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
```

with:

```ts
  const UPSERT_CHUNK = 8;
  for (let i = 0; i < toEmbed.length; i += BATCH) {
    const batch = toEmbed.slice(i, i + BATCH);
    // Each row is a single-chunk document in voyage-context-3's input shape.
    const { vectors } = await embedDocuments(batch.map(p => [p.text]), { apiKey: voyageKey, fetch });
    const rows = batch.map((p, idx) => ({
      user_id: null,
      source_type: 'bible_passage',
      source_id: p.id,
      chunk_index: 0,
      chunk_text: p.text,
      content_hash: sha256(p.text),
      embedding: vectors[idx][0], // unwrap the single-chunk inner array
      metadata: {
        book: p.book, chapter: p.chapter,
        verse_start: p.verse_start, verse_end: p.verse_end,
        translation: p.translation, pericope_id: p.pericope_id,
      },
    }));
```

Also update the `onConflict` argument lower in the function:

```ts
  await upsertWithRetry(supabase, chunk);
```

inside `upsertWithRetry`, change:

```ts
  const { error } = await supabase.from('lamplight_embeddings').upsert(rows, {
    onConflict: 'user_id,source_type,source_id',
  });
```

to:

```ts
  const { error } = await supabase.from('lamplight_embeddings').upsert(rows, {
    onConflict: 'user_id,source_type,source_id,chunk_index',
  });
```

- [ ] **Step 2: Update the existing-rows lookup**

Find this block near step 2 ("Find rows missing an embedding"):

```ts
  const { data: existing, error: exErr } = await supabase
    .from('lamplight_embeddings').select('source_id, content_hash')
    .is('user_id', null).eq('source_type', 'bible_passage');
```

No change needed — the lookup still works at row grain (each row is one chunk for BSB, so `(source_id, content_hash)` is unique enough).

- [ ] **Step 3: Run the ingest unit tests**

Run: `npx vitest run scripts/ingest-bsb.test.ts`

Expected: the existing tests (parse-only) pass unchanged. They don't exercise the embedDocuments call.

- [ ] **Step 4: Commit**

```bash
git add scripts/ingest-bsb.ts
git commit -m "feat(lamplight): ingest-bsb — single-chunk wrapping for voyage-context-3"
```

---

## Task 12: Cost map — add voyage-context-3 entry

**Files:**
- Modify: `src/admin/lamplight-cost.ts`
- Modify: `src/admin/lamplight-cost.test.ts`

- [ ] **Step 1: Add the failing test**

Open `src/admin/lamplight-cost.test.ts`. Add this test inside the existing `describe('lamplight-cost', …)` block:

```ts
  it('voyage-context-3: 1M in tokens → 18 cents', () => {
    expect(estCostCents('voyage-context-3', 1_000_000, 0)).toBe(18);
  });
```

- [ ] **Step 2: Run and verify the new test FAILS**

Run: `npx vitest run src/admin/lamplight-cost.test.ts`

Expected: the new test fails — `voyage-context-3` falls through to the default 0-cents path.

- [ ] **Step 3: Add the entry**

Open `src/admin/lamplight-cost.ts`. Update the `PRICE_PER_M_TOKENS_CENTS` map to include `voyage-context-3`:

```ts
const PRICE_PER_M_TOKENS_CENTS: Record<string, { in: number; out: number }> = {
  'voyage-3-large':             { in: 18,   out: 0    },  // legacy; kept for existing usage rows
  'voyage-context-3':           { in: 18,   out: 0    },  // $0.18 / 1M — cross-check against voyageai.com/pricing at deploy
  'claude-haiku-4-5':           { in: 100,  out: 500  },
  'claude-haiku-4-5-20251001':  { in: 100,  out: 500  },
  'claude-sonnet-4-6':          { in: 300,  out: 1500 },
  'claude-sonnet-4-6-20251001': { in: 300,  out: 1500 },
};
```

- [ ] **Step 4: Run tests and verify all PASS**

Run: `npx vitest run src/admin/lamplight-cost.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/admin/lamplight-cost.ts src/admin/lamplight-cost.test.ts
git commit -m "feat(lamplight): admin cost map — voyage-context-3 entry"
```

---

## Task 13: Full test suite + typecheck + lint

**Files:** (verification only)

- [ ] **Step 1: Run all tests**

Run: `npm run test`

Expected: green. If any test fails, identify whether it's a real regression (fix it) or a stale assertion from before the migration (update it).

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`

Expected: no errors. Common breakage points to look for:
- Imports of removed types from `voyage.ts` or `process-job.ts`.
- Old `upsertEmbedding` references anywhere.
- Old `EmbeddingRow` exports referenced outside `process-job.ts`.

If `process-job.ts` still exports `EmbeddingRow` and no one consumes it, leave the export — harmless. If something tries to import an export that no longer exists, fix the importer rather than re-adding the export.

- [ ] **Step 3: Lint**

Run: `npm run lint`

Expected: no errors. Fix any lint complaints inline (don't suppress).

- [ ] **Step 4: Commit any fixups**

```bash
git add -A
git commit -m "chore(lamplight): fixups from full-suite verification"
```

(Skip the commit if there were no fixups.)

---

## Task 14: Local integration validation

**Files:** (no code changes; verification against local Supabase)

This task runs the full pipeline end-to-end against a local Supabase instance to verify the migration + Edge Function + scripts cohere.

- [ ] **Step 1: Reset local DB**

Run: `npx supabase db reset`

Expected: all migrations apply, including 016. Console shows the reset summary.

- [ ] **Step 2: Deploy the Edge Function locally**

Run: `npx supabase functions serve embed-note --no-verify-jwt`

(`--no-verify-jwt` is only for local validation; production deployment relies on JWT verification.)

Expected: the function starts and listens on a local port.

- [ ] **Step 3: Ingest a tiny BSB slice**

To avoid burning real Voyage credits during local validation, temporarily prepare `scripts/data/bsb.txt` with a 5-verse slice (manually trimmed) and run:

```bash
SUPABASE_URL=http://localhost:54321 \
SUPABASE_SERVICE_ROLE_KEY=<local service role from supabase status> \
VOYAGE_AI_KEY=<your voyage key> \
npx tsx scripts/ingest-bsb.ts
```

Expected: ~5 rows inserted into `lamplight_embeddings` with `chunk_index = 0`, `chunk_text` matching the verse text, and `embedding` filled with 512 floats.

Verify in `psql`:

```sql
select source_id, chunk_index, length(chunk_text), array_length(embedding::float4[], 1)
  from public.lamplight_embeddings
 where source_type = 'bible_passage'
 order by source_id;
```

Expected: 5 rows; `chunk_index = 0` everywhere; `array_length = 512`.

- [ ] **Step 4: Smoke-test a note save**

Create a test user via the local Supabase Studio + create a note via the app dev server (or directly via SQL insert into `notes`). Then either:

- Trigger the Edge Function with `{ job_id: <uuid> }` after manually inserting a `lamplight_jobs` row, OR
- Use the app dev server (`npm run dev`) to toggle Lamplight on for that user and save the note.

Expected after embedding:

```sql
select source_id, chunk_index, length(chunk_text)
  from public.lamplight_embeddings
 where source_type = 'note'
 order by source_id, chunk_index;
```

You should see N rows for the note, one per chunk, with `chunk_index` densely 0..N-1.

- [ ] **Step 5: Smoke-test `match_my_note_neighbors`**

With at least two notes for the same user, both embedded, run as the authenticated user (use Supabase Studio's SQL editor with `set role authenticated; set request.jwt.claim.sub = '<user_id>';` first):

```sql
select * from public.match_my_note_neighbors(
  p_source_note_id := '<note-1-uuid>',
  p_k := 5,
  p_min_similarity := 0.0  -- relaxed for smoke
);
```

Expected: returns 0–4 rows of `(related_note_id, similarity)` where `related_note_id` ≠ source. Similarity values are valid floats in [0, 1].

If the function returns 0 rows with realistic notes, drop `p_min_similarity` to 0 to verify the aggregation path itself works (it should never raise; only filter).

- [ ] **Step 6: Restore full BSB ingest**

Restore `scripts/data/bsb.txt` to its full BSB contents (if you cached a backup before step 3). Local pipeline validation is complete.

- [ ] **Step 7: Commit any incidental docs/notes**

If you produced any local-validation notes (timing, anomalies), commit them under a docs subdirectory only if useful to future implementers. Otherwise no commit.

---

## Task 15: Production deploy sequence (manual, gated on team approval)

**Files:** (no code changes)

This task is a runbook — not Claude-executable. Each step is a human-driven action against the production Supabase project.

- [ ] **Step 1: Verify `VOYAGE_AI_KEY` is set as a function secret**

Run: `supabase secrets list --project-ref <prod>`

Expected: `VOYAGE_AI_KEY` is listed. If not, `supabase secrets set VOYAGE_AI_KEY=...` first.

- [ ] **Step 2: Deploy the updated Edge Function**

Run: `supabase functions deploy embed-note --project-ref <prod>`

Expected: deploy completes. The just-deployed function expects the new schema. Existing user saves between this step and step 3 will fail; they'll be retried.

- [ ] **Step 3: Apply migration 016**

Run: `supabase db push --project-ref <prod>` (or use the migration UI).

Expected: migration applies cleanly. `lamplight_embeddings` is now empty (`truncate` ran).

- [ ] **Step 4: Run BSB ingest against prod**

```bash
SUPABASE_URL=<prod-url> \
SUPABASE_SERVICE_ROLE_KEY=<prod-service-role> \
VOYAGE_AI_KEY=<voyage-key> \
npx tsx scripts/ingest-bsb.ts
```

Expected: 5–10 minutes wall time; ~32K rows inserted; cost ~$0.30 (verify against Voyage dashboard).

- [ ] **Step 5: Run the existing-notes backfill**

```bash
SUPABASE_URL=<prod-url> \
SUPABASE_SERVICE_ROLE_KEY=<prod-service-role> \
npx tsx scripts/backfill-note-embeddings.ts
```

Expected: enqueues one job per opted-in user's note. Console reports the count.

- [ ] **Step 6: Watch the queue drain**

Run periodically:

```sql
select status, count(*)
  from public.lamplight_jobs
 where kind = 'embedding_refresh'
 group by status;
```

Expected: `queued` decreases (cron sweep drains at up to 5/minute = 300/hour). When `queued = 0` and `failed` is small (single digits), the migration is done. Use admin re-queue affordance for any failed jobs.

- [ ] **Step 7: Verify cost map renders on the admin page**

Open the admin Lamplight page in production. Confirm:
- The `Usage` section renders `voyage-context-3` rows.
- Cost estimate column populates (not `$0.00` for non-zero token rows).

- [ ] **Step 8: Mark sub-project 7 complete**

Update the parent brief `Lamplight_AI_details.md` to reflect Sub-Project 7 shipped. Commit:

```bash
git commit -m "docs(lamplight): mark sub-project 7 (voyage-context-3 migration) shipped"
```

---

## Acceptance verification (post-deploy)

Re-walk the spec's acceptance criteria against production:

- [ ] **Criterion 1:** `lamplight_embeddings.embedding` is `vector(512)`. `chunk_index`, `chunk_text` exist. Unique constraint includes `chunk_index`. HNSW index rebuilt. (Confirmed by Task 1 step 3 against prod schema.)
- [ ] **Criterion 2:** Service-role match RPCs typed `vector(512)`; `match_my_note_neighbors` keeps `(related_note_id, similarity)` shape with server-side aggregation; rejects unauthenticated callers and non-owners.
- [ ] **Criterion 3:** Voyage requests use `/v1/contextualizedembeddings`, `model: voyage-context-3`, `output_dimension: 512`, `inputs: string[][]`.
- [ ] **Criterion 4:** New note save produces N≥1 chunk rows with consistent `content_hash` and matching `chunk_text`.
- [ ] **Criterion 5:** Format-only edit produces no re-embed (RPC returns null, no job inserted).
- [ ] **Criterion 6:** Paragraph add/remove causes correct chunk-count change; no orphan rows.
- [ ] **Criterion 7:** BSB ingest produces ~31K verse + ~1.2K pericope rows with `chunk_index = 0`. Re-run no-ops. Cost < $1.
- [ ] **Criterion 8:** Backfill enqueues one job per opted-in user's note; idempotent.
- [ ] **Criterion 9:** `searchNeighbors` ranks by best-chunk similarity then reranks; single-chunk source → single fan-out query.
- [ ] **Criterion 10:** RLS isolation holds — user A cannot read user B's chunks; BSB rows hidden from both authenticated users.
- [ ] **Criterion 11:** `lamplight_usage` records `voyage-context-3` for refreshes; admin cost page renders the new model.
- [ ] **Criterion 12:** `npm run lint`, `tsc -b`, `vitest run` pass.
- [ ] **Criterion 13:** No regression in Foundation, Signal Layer, Today's Lamp, Connection Cards, Admin. Manual smoke: open note → type → chunks appear; open Connection Cards → candidates appear; admin counts page lists `voyage-context-3` rows.

---

## Notes for the implementer

- The chunker is the single source of truth for "what text gets embedded." If client and server ever disagree, every save re-embeds. Server-only ownership eliminates that risk in this design; if you ever move chunking client-side, port test fixtures wholesale and add a parity test.
- `replace_note_embeddings` is the only safe upsert path for notes. Do not call `lamplight_embeddings.upsert(...)` directly from new code — the chunk-count-change case (5 chunks → 3 chunks) silently leaves 2 orphan rows.
- The `chunk_text` column is the rerank input. Keep it byte-for-byte identical to what was sent to Voyage. Reconstructing it from the chunker post-hoc risks drift if `MIN_TOKENS`/`MAX_TOKENS` ever change.
- `voyage-context-3`'s response shape is `data: [{ embeddings: number[][] }]` per document — note the plural `embeddings` (per chunk). Do not confuse with the legacy `/v1/embeddings` singular shape.
- The `vectorLiteral()` helper in the Edge Function is needed because pgvector's JSON cast inside `replace_note_embeddings` only accepts string literals (`[v1,v2,...]`), not JSON arrays.
- Voyage's `voyage-context-3` pricing in the cost map (`18` cents/1M tokens) is taken from publicly listed pricing in May 2026. Verify against the current pricing page at deploy time; update both `lamplight-cost.ts` and the spec if it has changed.
- **Spec deviation (intentional):** spec acceptance criterion 12 lists `match-my-note-neighbors.test.ts` as a new vitest file. The repo has no pgTAP framework, and `match_my_note_neighbors` is a PL/pgSQL function — its server-side aggregation behavior cannot be meaningfully unit-tested via mocked supabase. The plan substitutes a manual psql smoke test in Task 14 step 5 (assertions: unauthenticated raises, non-owner raises, multi-chunk source produces aggregated results, `p_min_similarity` filters, `p_k` limits). If future test infrastructure adds pgTAP or a docker-based integration harness, port these assertions there.
