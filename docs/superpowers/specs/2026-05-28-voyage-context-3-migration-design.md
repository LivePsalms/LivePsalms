# Lamplight — voyage-context-3 Migration (Sub-Project 7)

**Status:** Draft (2026-05-28)
**Owner:** Notepad — Lamplight AI companion
**Parent brief:** `Lamplight_AI_details.md` (root)
**Predecessors (shipped):** Foundation (sub-project 1), Signal Layer (sub-project 2), Reasoning Layer (sub-project 3), Today's Lamp (sub-project 4), Connection Cards (sub-project 5), Entitlements UI + Admin (sub-project 6).
**Deferred follow-up addressed:** Signal Layer's "Open follow-ups #5 — voyage-context-3 migration."

## Purpose

Signal Layer locked Lamplight to `voyage-3-large @ 1024-dim float` and one vector per note / per Bible passage. That model is fine for full-note semantic matching, but the Voyage team has since shipped `voyage-context-3`, a contextualized chunk embedding model designed for the exact retrieval shape Connection Cards needs: short, semantically-bounded chunks whose vectors are aware of their sibling chunks within the same document.

After this slice ships:

1. The embedding model is **`voyage-context-3` @ 512-dim float**.
2. Notes are stored as **N paragraph-grain chunks** in `lamplight_embeddings` (one row per chunk).
3. Every chunk has its `chunk_text` materialized in the row, so the reranker no longer re-runs the chunker.
4. Note-side retrieval fans out across the source note's chunks, aggregates by best-chunk similarity per target note, then reranks. The note-side reranker — a pass-through since Signal Layer — turns on.
5. The BSB corpus is re-embedded in the new space as **single-chunk documents** (each verse and each pericope is its own document with `chunk_index = 0`). Mechanical re-embed; no chunking gymnastics on the corpus side.
6. `lamplight_usage` records `model = 'voyage-context-3'`; the admin cost page accepts the new model in its cost map.

**Still zero new LLM calls.** This is purely an embedding/retrieval upgrade. Connection Cards, Today's Lamp, and Reasoning Layer continue to work unchanged at the call-site level — they just get better-quality candidates and an actual rerank on the note side.

Sized for ~1 week, one engineer.

## Decisions log

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Embedding model | **`voyage-context-3`** | Contextualized chunk embeddings. Per Voyage docs, dimensions 256/512/1024/2048 supported; 32K-token context per document. |
| 2 | Output dimension | **512** | Matryoshka — ~1–2% recall floor vs 1024 per Voyage's published numbers, ~2× storage of today's footprint *after* the chunking inflation (vs ~4× at 1024). |
| 3 | API endpoint | **`POST /v1/contextualizedembeddings`** | Different from `/v1/embeddings`. Request body shape: `inputs: string[][]` (list of documents, each a list of chunks). Voyage returns one vector per chunk, in nested order. |
| 4 | Note chunking | **Paragraph-based, greedy merge** | Walk TipTap plaintext; split on `\n\n+`. Merge adjacent paragraphs under 100 tokens. Sentence-split any paragraph over 600 tokens at `. !? ` boundaries. Token estimation: `ceil(len / 4)`. |
| 5 | BSB chunking | **None (mechanical re-embed)** | Each verse row and each pericope row is a single-chunk document. We pay the model swap cost on BSB but skip the contextualization win there. Design budget concentrated on notes. |
| 6 | Schema layout | **Extend `lamplight_embeddings`** | Add `chunk_index int NOT NULL`, `chunk_text text NOT NULL`. One table, one HNSW index. |
| 7 | Unique constraint | **`(user_id, source_type, source_id, chunk_index) NULLS NOT DISTINCT`** | Extends the existing constraint to chunk grain. NULLS-NOT-DISTINCT preserves Bible-row uniqueness behavior (Bible rows have `user_id IS NULL`). |
| 8 | Cutover strategy | **Hard cutover via TRUNCATE + column type swap** | Vector spaces don't mix; dim is changing. TRUNCATE clears all rows in one statement (cheaper than DROP+CREATE), then `ALTER TYPE` swaps `vector(1024)` → `vector(512)`. Backfill re-populates. |
| 9 | Note retrieval — Edge Function | **Per-chunk fan-out, max-aggregate client-side** | For each chunk of the source note, the Edge Function (`retrieval.ts`) queries `match_user_note_embeddings`. Union, group by `source_id`, keep best chunk-pair similarity. N round-trips where N = source note chunks (typically 3–5). |
| 9b | Note retrieval — browser | **Server-side aggregation in `match_my_note_neighbors`** | The Connection-Cards-facing RPC (migration 014) is auth-checked + browser-callable + returns only `(related_note_id, similarity)`. To preserve that security model with chunked data, aggregation moves *into* the RPC — it joins source chunks against candidate chunks via LATERAL and returns max-sim per target. Browser sees the same return shape; the chunk grain stays inside the SQL. |
| 10 | Note rerank | **On** | `retrieval.ts` note-side rerank flips from pass-through to active. Query = source note's best-matching chunk text (highest-similarity hit's source chunk). Documents = each candidate target's best-matching chunk text. |
| 11 | Chunker location | **Server-side only** | `supabase/functions/_shared/chunker.ts`. Client continues to enqueue jobs with `{ note_id, content_hash }`; chunking happens on job claim. No client-side TipTap walk for chunks. |
| 12 | Content hash | **`sha256(plaintext-of-whole-note)`** | Unchanged from Signal Layer. The hash is over the full note plaintext, not per-chunk — format-only edits still skip re-embedding. All N rows for a note share the same `content_hash`. |
| 13 | Upsert semantics | **Transaction: DELETE existing chunks + INSERT new chunks** | Chunk count varies across edits; ON CONFLICT upsert can't represent "this note now has fewer chunks." Wrapped in a single transaction so RLS observers never see partial state. |
| 14 | Cost map | **Add `'voyage-context-3'` entry** | `src/admin/lamplight-cost.ts` gets a new row. Per Voyage public pricing (cross-check at deploy time): currently ~$0.18 per 1M input tokens for this family. |
| 15 | Reranker | **Unchanged — `rerank-2.5`** | Operates on text + scores; model swap on the embedding side doesn't affect it. |
| 16 | Quantization | **Out of scope** | `output_dtype: 'float'` stays. int8/binary deferred to a later footprint-focused sub-project. |

## Scope

### In

- Migration `016_lamplight_voyage_context_3.sql`:
  - TRUNCATE `lamplight_embeddings` (state is reconstructable; foundation tables untouched).
  - Drop HNSW index + unique constraint (column type change requires it).
  - `ALTER COLUMN embedding TYPE vector(512)`.
  - Add `chunk_index int NOT NULL DEFAULT 0`, `chunk_text text NOT NULL DEFAULT ''`.
  - Rebuild unique constraint with `chunk_index` included.
  - Rebuild HNSW on `vector(512)`.
  - Drop + recreate `match_user_note_embeddings`, `match_bible_embeddings` (service-role RPCs from migration 012) with `vector(512)` signatures and `chunk_index`, `chunk_text` projections.
  - Drop + recreate `match_my_note_neighbors` (authenticated RPC from migration 014) with chunk-grain server-side aggregation; same `(related_note_id, similarity)` return shape; same auth check on `auth.uid()` and ownership of `p_source_note_id`.
  - Create `replace_note_embeddings(p_user_id uuid, p_note_id text, p_content_hash text, p_chunks jsonb)` — service-role `SECURITY DEFINER` RPC that DELETEs existing chunks and INSERTs the new ones in a single transaction. Edge Function call-site.
- Shared module updates:
  - `supabase/functions/_shared/voyage.ts` — switch to `/v1/contextualizedembeddings`. Public surface: `embedDocuments(string[][], deps)`, `embedQuery(string, deps)`. Model constant becomes `voyage-context-3`; dim constant becomes `512`.
  - `supabase/functions/_shared/chunker.ts` (new) — pure function `chunkNotePlaintext(plaintext: string): NoteChunk[]`.
  - `supabase/functions/_shared/process-job.ts` — chunker call + multi-chunk DELETE/INSERT transaction. Usage row model field becomes `'voyage-context-3'`.
  - `supabase/functions/_shared/retrieval.ts` — `searchNeighbors` rewritten for per-chunk fan-out + max-aggregate + active rerank. `searchBible` projection updated for new RPC return shape (functional behavior unchanged on the BSB side).
- Script updates:
  - `scripts/ingest-bsb.ts` — wrap each row as a single-chunk document (`[[text]]`); set `chunk_index = 0`, `chunk_text = passage.text`. Re-runs from empty (TRUNCATE wiped BSB rows).
  - `scripts/backfill-note-embeddings.ts` — no logic change; just runs again post-migration to repopulate the queue.
- Cost map:
  - `src/admin/lamplight-cost.ts` — add `'voyage-context-3'` entry (~$0.18 / 1M input tokens, $0 out). Confirm against Voyage pricing page at deploy time.
- Tests:
  - `chunker.test.ts` (new) — paragraph splits, greedy merge under threshold, sentence split over threshold, empty plaintext, single-paragraph note.
  - `voyage.test.ts` — extend to assert endpoint URL, request shape (`inputs: string[][]`), model name, `output_dimension: 512`.
  - `process-job.test.ts` — extend with multi-chunk path; chunk-count change (5 → 3) DELETEs orphans; transaction atomicity.
  - `retrieval.test.ts` — extend with per-chunk fan-out + max-aggregate + active rerank assertions.
  - `bsb-ingest.test.ts` — extend to assert single-chunk wrapping and `chunk_index = 0`.
  - `rls-isolation.test.ts` — extend to verify chunk-grain rows respect the same isolation invariants.

### Out

- Chunked BSB (option B from brainstorming Q5 — chapter-as-document, verses-as-chunks). Deferred until note-side recall data tells us whether further BSB recall gains are worth the schema reshape.
- Server-side aggregation RPC for per-chunk fan-out (option C from Q6). Client-side aggregation is good enough for ~3–5 round trips per query.
- Quantization (`int8`, `binary`). Defer until storage cost becomes a real constraint.
- Reranker swap. `rerank-2.5` continues to do the post-ANN reranking.
- New LLM calls. Anthropic surface area untouched.
- UI changes. Connection Cards, Today's Lamp, profile, admin — no visible changes.
- Online dual-write / zero-downtime cutover. The 30–60s gap between migration and Edge Function deploy is acceptable; failed saves get re-queued by the cron sweep.

### Untouched

- Foundation tables: `lamplight_settings`, `lamplight_entitlements`, `lamplight_jobs`, `lamplight_artifacts`, `lamplight_suggestions_log`, `lamplight_connections`, `lamplight_usage`. None of their columns change.
- `bible_passages` table. Verse + pericope rows stay; they remain the canonical text store. Only `lamplight_embeddings` rows are wiped and rebuilt.
- `notes`, `folders`, `profiles`. No touch.
- `useLamplightEmbeddingTrigger` client hook. Continues to enqueue `{ note_id, content_hash }` — the new chunker is server-side.
- Anthropic / `lamplight-generate` Edge Function. Embedding model is not its concern.
- Migrations 001–015.

## Database — migration `016_lamplight_voyage_context_3.sql`

### Step-by-step

```sql
-- 016: voyage-3-large @ 1024 → voyage-context-3 @ 512 + chunked storage.
--
-- TRUNCATE is intentional. lamplight_embeddings holds derived data only —
-- vectors are recomputable from notes + BSB at any time. The cutover wipes
-- everything; the backfill script + ingest-bsb.ts repopulate.

-- 1) Drop the HNSW index (column type change requires it).
drop index if exists public.lamplight_embeddings_embedding_hnsw;

-- 2) Drop the unique constraint (we extend it).
alter table public.lamplight_embeddings
  drop constraint if exists lamplight_embeddings_source_uq;

-- 3) Hard cutover: clear the rows.
truncate table public.lamplight_embeddings;

-- 4) Re-type the embedding column.
alter table public.lamplight_embeddings
  alter column embedding type extensions.vector(512);

-- 5) Add chunk columns. Defaults let us keep NOT NULL without backfill —
--    the table is empty post-truncate so the defaults never apply to data.
alter table public.lamplight_embeddings
  add column chunk_index int  not null default 0,
  add column chunk_text  text not null default '';

-- 6) Rebuild unique constraint at chunk grain.
alter table public.lamplight_embeddings
  add constraint lamplight_embeddings_source_uq
  unique nulls not distinct (user_id, source_type, source_id, chunk_index);

-- 7) Rebuild HNSW on the new vector(512) column.
create index lamplight_embeddings_embedding_hnsw
  on public.lamplight_embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);
```

### RPC rewrites

`match_user_note_embeddings` signature changes from `vector(1024)` to `vector(512)`, gains `chunk_index` and `chunk_text` columns in its `returns table` clause. Body unchanged except for the projection.

```sql
drop function if exists public.match_user_note_embeddings(uuid, extensions.vector(1024), text, int);

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
```

`match_bible_embeddings` gets the same treatment (drop old `vector(1024)` signature, recreate with `vector(512)` + projection). `chunk_index` is always 0 for BSB rows; we project it for API consistency.

### Server-side aggregated RPC — `match_my_note_neighbors`

Migration 014's existing `match_my_note_neighbors` is auth-checked + `authenticated`-grant + returns only `(related_note_id, similarity)`. The Connection Cards browser call sites depend on this shape and on skipping the Edge Function hop. Rewriting it as a chunk-aware aggregated query inside the same security model preserves both.

```sql
drop function if exists public.match_my_note_neighbors(uuid, int, float);

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
```

`greatest(p_k * 4, 20)` is the per-source-chunk candidate pool size. With typical N=3–5 source chunks and `p_k=5`, the LATERAL produces a 60–100-row intermediate set, max-aggregated to ~5 winners. HNSW serves each LATERAL probe in low-millisecond time; total query stays well under the 30-second statement timeout for typical user note counts. A user with thousands of notes might see this lengthen — revisit with profiling if it ever shows up in `pg_stat_statements`.

### Edge-Function-only RPC — `replace_note_embeddings`

```sql
create or replace function public.replace_note_embeddings(
  p_user_id      uuid,
  p_note_id      text,
  p_content_hash text,
  p_chunks       jsonb  -- [{ chunk_index, chunk_text, embedding, metadata }]
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

revoke execute on function public.replace_note_embeddings(uuid, text, text, jsonb) from public, authenticated;
-- service-role only (no grant); Edge Function uses service-role JWT.
```

PL/pgSQL function body is a single implicit transaction — DELETE and INSERT either both commit or both roll back. No partial-state observers.

### RLS, FK, CHECK constraint — all preserved

- The four existing RLS policies on `lamplight_embeddings` (`auth.uid() = user_id`) are unchanged. New rows respect them as-is.
- The `lamplight_embeddings_owner_check` CHECK constraint from migration 011 (note ↔ user_id NOT NULL; bible_passage ↔ user_id NULL) is unaffected by the column-type swap and the new columns.
- The FK `user_id references profiles(id) on delete cascade` is untouched.

## Voyage client refactor — `supabase/functions/_shared/voyage.ts`

The model and endpoint change. The public surface stays close to today's shape so callers don't see much churn.

```ts
const MODEL = 'voyage-context-3';
const DIM = 512;
const ENDPOINT = 'https://api.voyageai.com/v1/contextualizedembeddings';
const MAX_DOCS_PER_REQUEST  = 1000;
const MAX_CHUNKS_PER_REQUEST = 16_000;
const MAX_TOKENS_PER_REQUEST = 120_000;
const MAX_RETRIES = 3;

export type InputType = 'document' | 'query';

export interface VoyageDeps {
  apiKey: string;
  fetch: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

// Per-document chunk vectors. Outer index = document, inner = chunk-within-document.
// Preserves caller's input grouping; caller flattens only if it wants to.
export async function embedDocuments(
  chunksPerDoc: string[][],
  deps: VoyageDeps,
): Promise<{ vectors: number[][][]; totalTokens: number }>;

// Convenience for single-text queries.
export async function embedQuery(text: string, deps: VoyageDeps): Promise<number[]>;

// Unchanged — rerank-2.5 over text.
export async function rerank(query, documents, topK, deps): Promise<RerankResult[]>;
```

Internals:

- One `embedBatched(chunksPerDoc, inputType, deps)` private function. Slices into request-sized batches respecting all three caps (`MAX_DOCS_PER_REQUEST`, `MAX_CHUNKS_PER_REQUEST`, `MAX_TOKENS_PER_REQUEST`). Cheap token estimate per chunk: `ceil(len/4)`.
- `embedOnce(batchOfDocs, inputType, deps, attempt)` issues one HTTP POST to `ENDPOINT` with body `{ model, inputs, input_type, output_dimension: 512, output_dtype: 'float', truncation: true }`. Parses response — Voyage's response is `data: [{ embeddings: number[][] }]` per document, so the wrapper unwraps to `number[][][]` (one inner-array per document).
- Retry policy unchanged from Signal Layer: `429` and `5xx` → exponential backoff with jitter, max 3 attempts.

The single-vector callers (`embedQuery`, BSB ingest) wrap their text as `[[text]]` and unwrap the single returned vector. No reason to maintain two endpoints.

### `voyage.test.ts` extensions

Existing tests assert the old endpoint and request shape. They become:

- Endpoint URL matches `/v1/contextualizedembeddings`.
- Request body has `inputs: [['a', 'b'], ['c']]` shape, `model: 'voyage-context-3'`, `output_dimension: 512`.
- Response parsing returns `number[][][]` with correct outer/inner cardinality.
- Batching kicks in past any of the three caps (test with stub caps for tractable assertions).
- Retry on 429/5xx unchanged.

## Note chunker — `supabase/functions/_shared/chunker.ts`

Pure function. No Deno- or Node-specific globals. Same module imported from the Edge Function and (potentially) test runners.

```ts
export interface NoteChunk {
  index: number;       // 0-based, dense within the chunk array
  text: string;        // exact text sent to Voyage; also stored as chunk_text
  tokenCount: number;  // estimated via ceil(len/4)
}

export const MIN_TOKENS = 100;
export const MAX_TOKENS = 600;

export function chunkNotePlaintext(plaintext: string): NoteChunk[] {
  // 1. Split on \n\n+ → paragraphs.
  // 2. Trim each paragraph; drop empties.
  // 3. Estimate tokens (ceil(len/4)).
  // 4. Greedy merge:
  //      - Walk paragraphs left-to-right.
  //      - Maintain a running `buffer` (string + tokenCount).
  //      - If buffer.tokens < MIN_TOKENS and next paragraph would keep us
  //        ≤ MAX_TOKENS, concatenate (separator '\n\n') and continue.
  //      - Otherwise, flush buffer as a chunk; start a new buffer with the
  //        next paragraph.
  // 5. Any paragraph (or post-merge buffer) over MAX_TOKENS:
  //      - Split on /(?<=[.!?])\s+/, accumulate sentences into buffers
  //        of ≤ MAX_TOKENS; emit each.
  //      - If a single sentence itself exceeds MAX_TOKENS, emit it as-is
  //        with truncation: true on the Voyage side handling overflow.
  // 6. Re-index chunks 0..N-1 before returning.
  // 7. Empty plaintext → return [].
}
```

`MIN_TOKENS` and `MAX_TOKENS` are exported so the test file can assert thresholds directly without re-hardcoding them.

### `chunker.test.ts`

- Empty string → `[]`.
- Single short paragraph → one chunk containing the whole string, `index = 0`.
- Two short paragraphs (each < 100 tokens) → one merged chunk joined by `\n\n`.
- Two paragraphs, first 80 tokens / second 200 tokens → one merged chunk (280 tokens, ≤ MAX).
- Two paragraphs, first 80 tokens / second 700 tokens → first paragraph + sentence-split chunks of the second.
- A 1500-token paragraph → multiple chunks via sentence split, each ≤ MAX_TOKENS.
- A single sentence over MAX_TOKENS → emitted as one over-cap chunk; relies on Voyage `truncation: true`.
- Indexes are dense and 0-based.

## Edge Function — `embed-note` updates

`process-job.ts:processJobs` body:

1. Validate payload (unchanged — `note_id`, `content_hash` required).
2. Load note row (unchanged).
3. Load existing hash via `loadExistingHash(userId, noteId)`. Implementation reads any one of the note's chunk rows — the hash is identical across all rows. Bail to `done` if `existing === newHash`.
4. Re-derive plaintext via `extractTextFromNoteContent(content)`. Bail to `done` if empty after trim.
5. **New:** `const chunks = chunkNotePlaintext(plaintext);`. Bail to `done` if empty (`chunks.length === 0`).
6. **New:** Call `embedDocuments([chunks.map(c => c.text)], deps.voyage)` — one document with N chunks.
7. **New:** Call the `replace_note_embeddings` RPC (defined in migration 016) with `(p_user_id, p_note_id, p_content_hash, p_chunks jsonb)`. The PL/pgSQL body's implicit transaction handles atomicity: DELETE existing chunks + INSERT new chunks. One round trip from the Edge Function. Service-role only; no `auth.uid()` check needed (the Edge Function authenticates the user via the source `notes` row lookup in step 2).
8. Record usage: `model: 'voyage-context-3'`, `tokens_in: voyage.totalTokens`, `tokens_out: 0`, `status: 'ok'`.
9. Mark job done.

Failure handling (`markFailedOrRetry`) is unchanged. After 3 failed Voyage calls the job stays `failed` and the admin re-queue affordance from sub-project 6 surfaces it.

### `process-job.test.ts` extensions

- Happy path with N=3 chunks: DELETE finds zero rows on first run, INSERT writes 3 rows.
- Edit reducing chunk count (5 → 3): DELETE removes the old 5, INSERT writes the new 3.
- Edit increasing chunk count (3 → 5): DELETE removes the old 3, INSERT writes the new 5.
- Empty-plaintext note → no Voyage call, no DELETE, no INSERT, mark done.
- Voyage 500 → markFailedOrRetry; on attempt 3 records `status: 'error'` with extracted error code.
- Usage row records `model: 'voyage-context-3'`.

## Retrieval layer — `supabase/functions/_shared/retrieval.ts`

### `searchNeighbors` rewrite

```ts
export async function searchNeighbors(
  deps: RetrievalDeps,
  args: { userId: string; noteId: string; k: number },
): Promise<RetrievedItem[]> {
  // 1. Fetch all chunks of the source note. Returns [{ chunk_index, chunk_text, embedding }].
  const sourceChunks = await loadNoteChunks(deps.supabase, args.userId, args.noteId);
  if (sourceChunks.length === 0) return [];

  // 2. Per-chunk fan-out.
  const POOL_PER_CHUNK = 50;
  const candidatePool = new Map<string, BestChunk>();  // target source_id → best hit

  for (const sc of sourceChunks) {
    const { data, error } = await deps.supabase.rpc('match_user_note_embeddings', {
      p_user_id: args.userId,
      p_query_vector: sc.embedding,
      p_exclude_source_id: args.noteId,
      p_limit: POOL_PER_CHUNK,
    });
    if (error) throw error;
    for (const r of (data ?? []) as MatchRow[]) {
      const prev = candidatePool.get(r.source_id);
      if (!prev || r.similarity > prev.similarity) {
        candidatePool.set(r.source_id, { ...r, sourceChunkText: sc.chunk_text });
      }
    }
  }

  // 3. Top candidates by max-chunk similarity.
  const topPool = [...candidatePool.values()].sort((a, b) => b.similarity - a.similarity);

  if (!deps.rerankEnabled) {
    return topPool.slice(0, args.k).map(toRetrievedItem);
  }

  // 4. Rerank. Query = the source-chunk text of the top-1 candidate
  //    (strongest "what this note is about" signal among the matched chunks).
  //    Documents = each candidate target's best-matching chunk text.
  const rerankPool = topPool.slice(0, POOL_PER_CHUNK);
  const query = rerankPool[0]?.sourceChunkText ?? '';
  const documents = rerankPool.map(c => c.chunk_text);
  const scored = await rerank(query, documents, args.k, deps.voyage);
  return scored.map(s => toRetrievedItem({ ...rerankPool[s.index], rerank_score: s.score }));
}
```

`loadNoteChunks` is a thin select against `lamplight_embeddings` filtered by `(user_id, source_type='note', source_id)`, ordered by `chunk_index`. Returns the embedding + chunk_text per row.

### `searchBible` change

Functionally unchanged — BSB rows are single-chunk per row, so the new RPC return shape (`chunk_index`, `chunk_text` columns added) is a strict superset of what the function consumed before. The bible rerank already loads document text via `bible_passages` lookup; that path is unchanged. The chunk_text projection is ignored on this side.

### `retrieval.test.ts` extensions

- `searchNeighbors` with a source note having 1 chunk → 1 fan-out query.
- `searchNeighbors` with a source note having 3 chunks → 3 fan-out queries; aggregation keeps max similarity per target.
- Source chunk A wins for target X (sim 0.81); source chunk B wins for target X (sim 0.85) → target X's recorded sim = 0.85 and its sourceChunkText = B's text.
- Rerank fires when `rerankEnabled = true`; query is the top-1 candidate's source chunk text.
- Rerank skipped when `rerankEnabled = false`; client gets max-sim ranking.
- Empty source note (no chunks) → empty result, zero queries.

## BSB ingest — `scripts/ingest-bsb.ts`

Single call-site change:

```ts
// Before:
const vectors = await embedDocuments(batch.map(p => p.text), { apiKey, fetch });

// After:
const { vectors } = await embedDocuments(batch.map(p => [p.text]), { apiKey, fetch });
// vectors: number[][][]; each outer entry is a one-element inner array.
```

Per-row upsert payload:

```ts
{
  user_id: null,
  source_type: 'bible_passage',
  source_id: p.id,
  chunk_index: 0,
  chunk_text: p.text,
  content_hash: sha256(p.text),
  embedding: vectors[idx][0],         // unwrap the single-chunk inner array
  metadata: { book, chapter, verse_start, verse_end, translation, pericope_id },
}
```

Idempotency check (existing chunk-hash lookup) gains `and chunk_index = 0` to be explicit. Re-running is a no-op once the new rows land.

Wall time and cost estimates:
- 31,103 verses + ~1,189 pericopes ≈ 32,292 single-chunk documents.
- 32,292 / ~50 docs per request ≈ 645 Voyage calls.
- voyage-context-3 at ~$0.18 / 1M input tokens × ~30 tokens / passage avg ≈ ~$0.20–$0.30 total.
- Wall time: 5–10 minutes sequential.

## Backfill — `scripts/backfill-note-embeddings.ts`

No code changes. Existing behavior: select opted-in users' notes where `lamplight_embeddings` lacks a `(user_id, 'note', note_id)` row, bulk-insert `embedding_refresh` jobs.

Post-migration 016, every note row's chunks are gone (TRUNCATE), so the LEFT JOIN finds every note. Every note gets re-queued. The Edge Function drains via direct invoke (when users edit) + cron sweep (drains background queue at 1/min × `claim_limit`).

For a populated production set, expect drain time roughly `total_notes / 60 / claim_limit` minutes. The cron sweep claims up to 5 jobs per minute today; that's tunable in migration 011's cron schedule body if we want to spend faster.

## State diagram — chunked note embedding

```
User opts in (Foundation) ─────► lamplight_settings.enabled = true
                                       │
                                       ▼
User edits note ─► debounced save ─► hash(plaintext) ─► RPC enqueue
                                       │
                                       ▼
                              lamplight_jobs row (queued)
                                       │
                  ┌────────────────────┴────────────────────┐
                  ▼                                         ▼
       client invoke('embed-note')                  pg_cron sweep (60s)
                  │                                         │
                  └────────────────────┬────────────────────┘
                                       ▼
                       Edge Function claims (SKIP LOCKED)
                                       │
                                       ▼
                   extractTextFromNoteContent → chunkNotePlaintext
                                       │
                                       ▼
                     embedDocuments([[c1, c2, …, cN]], 'document')
                                       │
                                       ▼
                replace_note_embeddings(user_id, note_id, hash, chunks)
                  ─ DELETE existing chunks
                  ─ INSERT N new chunks (one per chunkNotePlaintext output)
                                       │
                                       ▼
                              lamplight_jobs → done
```

Retrieval (Connection Cards) shape:

```
Connection Cards query (note A)
            │
            ▼
loadNoteChunks(A)  ─►  [{chunk_index, chunk_text, embedding} × N_A]
            │
            ▼
For each source chunk: match_user_note_embeddings(...) → top 50 target chunks
            │
            ▼
Union → group by target source_id → keep max-sim chunk pair per target
            │
            ▼
Sort by max-sim → top POOL → rerank-2.5(query = top-1 source chunk text,
                                          docs = each candidate's chunk_text)
            │
            ▼
Top-K reranked candidates → Connection Cards UI
```

## Deploy sequence

The cutover involves a brief window where saves can fail; the queue catches them. No special staging required.

1. Merge PR → CI runs full test suite.
2. Deploy the Edge Function: `supabase functions deploy embed-note` (new code targets `vector(512)` + new RPC `replace_note_embeddings`).
3. Apply migration 016 to prod.
4. Run `scripts/ingest-bsb.ts` (5–10 min, ~$0.30).
5. Run `scripts/backfill-note-embeddings.ts` (queues every opted-in user's notes).
6. Watch `lamplight_jobs` drain — direct-invoke + cron sweep handle it.
7. Deploy frontend with updated `src/admin/lamplight-cost.ts` cost map entry.

Between step 3 and step 2 being effective in the same deployment, there's a ~30–60s window where a save could call the just-deployed Edge Function before the migration applies (or vice versa). Both directions fail loudly; the job is retried within 60s by the cron sweep. Acceptable.

The order above (function first, then migration) minimizes the window where saves hit the new function expecting the new schema: the function deploy is the long pole (~30s), so we ship it first, then the migration is near-instantaneous and the function picks up the new column type immediately. The brief gap where the old schema receives requests from the new function results in failed jobs that retry once the migration lands.

## Acceptance criteria

This slice is done when every item below holds.

1. Migration 016 applies clean against a fresh local Supabase project. `lamplight_embeddings.embedding` is `vector(512)`. `chunk_index` and `chunk_text` columns exist. Unique constraint includes `chunk_index`. HNSW index rebuilt.
2. Service-role match RPCs (`match_user_note_embeddings`, `match_bible_embeddings`) are typed `vector(512)` and return `chunk_index`, `chunk_text` in their projections. The authenticated RPC `match_my_note_neighbors` keeps its `(related_note_id, similarity)` return shape but aggregates server-side over source-note chunks, and rejects unauthenticated callers and non-owners.
3. `voyage.ts` calls `https://api.voyageai.com/v1/contextualizedembeddings` with `model: 'voyage-context-3'`, `inputs: string[][]`, `output_dimension: 512`. Test asserts URL, model, dim, request body shape.
4. Saving a new note (opted-in user, non-empty plaintext) produces N ≥ 1 rows in `lamplight_embeddings` with consistent `content_hash` across rows and per-chunk `chunk_text` matching `chunkNotePlaintext(plaintext)`.
5. Format-only edit (whitespace toggle, mark toggle) does NOT re-embed — RPC returns null, no job inserted, no Voyage call.
6. Edit that adds or removes a paragraph causes the chunk count to change correctly: old chunks DELETED, new chunks INSERTED in one transaction; no orphan rows survive.
7. `scripts/ingest-bsb.ts` produces 31,103 verse rows + ~1,189 pericope rows, all with `chunk_index = 0` and `chunk_text` matching the BSB text. Re-running is a no-op. Total Voyage cost < $1.
8. `scripts/backfill-note-embeddings.ts` enqueues exactly one job per opted-in user's note. Idempotent: re-running after the queue drains produces zero new jobs.
9. `searchNeighbors` returns target notes ranked by best-chunk similarity. With rerank enabled, the top-K is the rerank result. Source notes with a single chunk produce a single fan-out query; multi-chunk source notes fan out and aggregate by max similarity.
10. RLS isolation: user A cannot read user B's chunk rows. BSB rows (`user_id IS NULL`) remain invisible to authenticated users. Service role sees all rows.
11. `lamplight_usage` records new entries with `model = 'voyage-context-3'` for every embedding refresh. The admin cost page renders the new model in its cost map without throwing.
12. `npm run lint`, `tsc -b`, and `vitest run` pass. New/updated tests pass:
    - `chunker.test.ts` — paragraph splits, greedy merge, sentence split, empty, indexes dense.
    - `voyage.test.ts` — contextualized endpoint URL + request shape + 512 dim + batching.
    - `process-job.test.ts` — multi-chunk `replace_note_embeddings` call, chunk-count change (5→3 removes orphans), empty-note skip, error path.
    - `retrieval.test.ts` — per-chunk fan-out + max-aggregate + active rerank.
    - `bsb-ingest.test.ts` — single-chunk wrapping, `chunk_index = 0` on every row.
    - `rls-isolation.test.ts` — chunk-grain rows respect the same invariants.
    - `match-my-note-neighbors.test.ts` (new, extends existing connection-cards test scaffolding) — unauthenticated raises; non-owner raises; multi-chunk source aggregates by max-sim; `p_min_similarity` filters; `p_k` limits.
13. No regression in Foundation, Signal Layer, Today's Lamp, Connection Cards, or Admin. Manual smoke: open a note, type, see chunks appear; open Connection Cards, see candidate notes; check admin counts page lists `voyage-context-3` rows in usage.

## Files touched / created

### New files

- `supabase/migrations/016_lamplight_voyage_context_3.sql`
- `supabase/functions/_shared/chunker.ts`
- `supabase/functions/_shared/chunker.test.ts`

### Modified files

- `supabase/functions/_shared/voyage.ts` — endpoint, model, dim, request body shape.
- `supabase/functions/_shared/voyage.test.ts` — assert new endpoint + shape.
- `supabase/functions/_shared/process-job.ts` — call chunker, switch to `replace_note_embeddings` RPC, update model literal in usage records.
- `supabase/functions/_shared/process-job.test.ts` — multi-chunk happy path + chunk-count change + error paths.
- `supabase/functions/_shared/retrieval.ts` — `searchNeighbors` rewrite + `searchBible` projection update + flip note rerank from pass-through to active.
- `supabase/functions/_shared/retrieval.test.ts` — fan-out, aggregation, rerank wiring.
- `supabase/functions/embed-note/index.ts` — wire chunker + new RPC into the Edge Function entry.
- `scripts/ingest-bsb.ts` — wrap as single-chunk docs.
- `scripts/ingest-bsb.test.ts` — assert single-chunk wrapping + chunk_index 0.
- `src/admin/lamplight-cost.ts` — add `'voyage-context-3'` cost map entry.
- `src/admin/lamplight-cost.test.ts` — exercise new model in cost lookup.

### Untouched

- All Foundation + Signal Layer + Reasoning Layer + Today's Lamp + Connection Cards + Entitlements UI files at the React layer. No visible UX changes.
- `notes`, `folders`, `profiles`, `bible_passages` tables.
- Anthropic adapter, `lamplight-generate` Edge Function.
- `useLamplightEmbeddingTrigger` client hook.
- Migrations 001–015.

## Open follow-ups (later sub-projects)

These are deliberately deferred and called out so they don't get forgotten.

1. **Chunked BSB.** Chapter-as-document, verses-as-chunks. Expected to lift Bible recall by giving each verse a chapter-context-aware embedding. Revisit after this slice ships and we see whether note-side retrieval gains close the qualitative gap or if BSB is now the weakest link.
2. **Server-side aggregation RPC.** If per-chunk fan-out shows up as a hot path in profiling, collapse it into a single RPC that accepts an array of query vectors and returns max-aggregated targets.
3. **Quantization.** `output_dtype: 'int8'` (4× transfer reduction) or `'binary'` + rescore (32× transfer, ~3% recall hit). Worthwhile when storage cost becomes meaningful.
4. **Per-user cost cap.** Voyage `truncation: true` protects against runaway tokens; an abuse-grade cap is still YAGNI until we observe abuse.
5. **Drop Matryoshka dim further to 256.** If 512 measures fine, 256 buys another 50% storage cut. Wait for production data first.

## Notes for the implementer

- The chunker is the single source of truth for "what text gets embedded." If the client and server ever disagree on chunk boundaries, every save re-embeds. Server-only ownership eliminates that risk in this design — but if you ever move chunking client-side, port the test fixtures wholesale and add a parity test.
- `replace_note_embeddings` RPC must be transactional. A crashed Edge Function between DELETE and INSERT would leave a note without any embedding — that's recoverable (next save re-runs it), but it's invisible to retrieval in the meantime. Atomicity makes the failure mode "everything or nothing."
- The `chunk_text` column is the rerank input. Keep it byte-for-byte identical to the text sent to Voyage — *not* the post-chunker reconstructed text, but the exact element of the `inputs[i]` array. Otherwise rerank quality degrades silently.
- voyage-context-3's response has `data: [{ embeddings: number[][] }]` per document. Don't confuse `embeddings` (per chunk, plural) with the old `/v1/embeddings` response shape `data: [{ embedding: number[] }]` (per text, singular). The wrapper hides this, but inspect carefully on any future schema change.
- The `output_dimension: 512` constant has to match the column type. Drift between them (e.g., a future patch sets dim to 1024 in voyage.ts but the column is still vector(512)) produces a Postgres "dimension mismatch" error at INSERT. Add an integration test that asserts `voyage.DIM === expected_dim_from_migration`.
- Cost-map values come from the Voyage pricing page; cross-check at deploy. The estimate $0.18 / 1M input tokens is what we have on hand today (May 2026) for the `voyage-context-3` family.
