# Lamplight — Connection Cards (Sub-Project 5)

**Status:** Draft (2026-05-27)
**Owner:** Notepad — AI companion feature
**Parent brief:** `Lamplight_AI_details.md` (root)
**Predecessors:** Sub-Project 1 — Foundation (shipped) · Sub-Project 2 — Signal Layer (shipped) · Sub-Project 3 — Reasoning Layer (shipped) · Sub-Project 4 — Today's Lamp (shipped)
**Companion sub-projects (future):** Entitlements UI · Doctrinal Review · Weekly Insight · Reflections Recap · Tier Celebration · Inline Suggestions

## Purpose

Today's Lamp gave the user a daily devotion in the Lamplight tab. **Connection Cards is the first contextual artifact** — it lights up when the user has an active note open. After this slice ships:

1. When an opted-in user opens a note that has ≥100 words AND they have ≥10 notes total, the Lamplight tab swaps `TodaysLampCard` for a `ConnectionCardsSection` showing up to 3 semantically-related notes from their own vault.
2. Each card shows: related note title, shared signals (tags + verse refs intersected with the active note), and a click-to-expand "why" string.
3. The neighbor list is pure pgvector — **no LLM call** to render the cards. Haiku is invoked lazily, only when the user expands a card.
4. Generated "why" strings cache in the existing `lamplight_connections` table (Foundation, migration 008), keyed on `(note_id, related_note_id)` with a composite content hash that invalidates whenever **either** note's plaintext changes.
5. A new `kind: 'connection_card_why'` dispatch on the existing `lamplight-generate` Edge Function handles the lazy generation path. Cards rendered without expansion cost zero Anthropic credits.

Sub-project 5 is the cheapest LLM artifact in the Lamplight system: most cards will never be expanded, and even when they are, the result is cached against both notes' content hashes.

The slice is sized for ~1 week, one engineer.

## Decisions log

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Tab content shift | **Replace `TodaysLampCard` with `ConnectionCardsSection` when active note qualifies** | Matches the parent brief §7.1 ("Active note open → Connection cards specific to this note"). User must close/blur the note to see today's devotion. Single-surface-per-moment — no stacking. |
| 2 | "Expand" UX | **Click-to-reveal accordion. Title click navigates; chevron click expands.** | Honors the brief's lazy-generation principle (no Haiku cost until user shows intent). Two-target card affords both navigation and "tell me more." Loading + error states render inline in the expanded area. |
| 3 | Cache invalidation | **Live pgvector on every render + lazy "why" cache with composite hash on `lamplight_connections.content_hash`** | `content_hash = sha256(source_text_hash + ':' + related_text_hash)`. Always-current neighbor list (pgvector is cheap with HNSW). Why-cache invalidates when *either* note's plaintext changes. No schema migration needed for the existing `content_hash` column — new semantic, same column. |
| 4 | Where shared signals computed | **Client-side, using the existing `reference-parser.ts` and `notes.tags` array** | Zero new Edge Function invocations per note open. Reuses already-tested parser. Reuses notes already loaded by the Backlinks tab path. |
| 5 | Neighbor lookup transport | **New RPC `match_my_note_neighbors` granted to `authenticated`** | No Edge Function in the qualifying-note-open path. RPC enforces `auth.uid()` ownership internally. Returns only `(related_note_id, similarity)` — no embeddings leak. |
| 6 | K + similarity threshold | **K=5, similarity ≥ 0.78** | Per parent brief §6.1. Brief is canonical here; values are inlined into the RPC default args so they're tunable from a single migration without code redeploy. |
| 7 | Cards rendered | **Up to 3 (per brief) — top 3 by similarity from the K=5 returned** | The remaining 2 are retained in hook state for potential future "see more" UX but not rendered. |
| 8 | Anthropic model | **`haiku` (claude-haiku-4-5-20251001)** | Per parent brief §6.6 model assignment for "Connection 'why'". Fast, cheap, one-line generation. Wired through the existing `LLMAdapter` interface; no adapter changes. |
| 9 | Validators on the why | **`applyContentRules` only (banned + contested + growth). Citation validator skipped.** | The why is a free-text rationale with no structured citations. We don't extract inline refs (consistent with Today's Lamp's MVP decision §"Validator hookup"). Word-count ≤ 24 enforced post-parse via a small new `validateConnectionWhyShape` helper. |
| 10 | Hard-fail UX | **Inline retry inside the expanded card; cards list stays intact** | A validator failure on one expansion doesn't tear down the whole section. Other cards remain expandable. Mirrors Today's Lamp's quiet "Try again" but scoped to the single card. |
| 11 | "Not a neighbor" check on why generation | **Server-side re-verify** before any LLM call | Prevents clients from generating "why" strings for arbitrary `(noteA, noteB)` pairs that aren't actually neighbors. The Edge Function re-runs `match_my_note_neighbors` server-side and confirms `related_note_id` is in the top-K above threshold. |
| 12 | Embedding-not-ready UX | **Inline "Lamplight is reading this note…" placeholder; not a fallback to Today's Lamp** | Transient state (≤60s for the queue sweep). Falling back to Today's Lamp here would feel disconnected from what the user just opened. Stable not-qualifying states (note <100 words, vault <10 notes) DO fall back to Today's Lamp. |
| 13 | No-neighbors-above-threshold UX | **Fall back to `TodaysLampCard`** | Stable state — the user qualifies but pgvector found nothing strong. Falling back preserves the tab's "always shows something" contract. Inline empty-state cards (e.g., "no connections yet") felt naggy in design review. |
| 14 | Prompt versioning | **`connection-why-2026-05-27-v1`** | Persisted on `lamplight_connections` rows is *not* added in this slice — the table has no `prompt_version` column and adding one is out of scope. The version is logged in Edge Function response and surfaced for telemetry only. |
| 15 | "Reflect on this further" button | **Out of scope** | Parent brief §7.1 mentions this affordance. It needs its own prompt template + UI surface; deferred to a future small slice. |
| 16 | Streaming why generation | **Out of scope** | Same rationale as Today's Lamp's deferral. The why string is ≤24 words and renders in <2s p95 against Haiku — streaming gains negligible perceived-latency benefit. |
| 17 | "Reflect on what this connects to" deep-link | **Title click navigates via existing notepad open-by-id handler** | Reuses the same mechanism the Backlinks tab uses to swap the active note. No new routing. |

## Scope

### In

- **Migration `014_lamplight_connection_match_rpc.sql`** — adds `match_my_note_neighbors(p_source_note_id uuid, p_k int default 5, p_min_similarity float default 0.78)` RPC. `SECURITY DEFINER`, granted to `authenticated`. Statement timeout 30s (matches migration 013 convention). Enforces `auth.uid()` ownership; returns only `(related_note_id, similarity)`.
- **Edge Function dispatch addition** in `supabase/functions/lamplight-generate/index.ts`:
  - New `connection_card_why` branch alongside existing `smoke_test` + `daily_devotion`.
  - Validates payload shape `{ kind: 'connection_card_why', user_id: string, source_note_id: string, related_note_id: string }`.
  - Same opted-in precondition as existing branches.
- **Pipeline module** `supabase/functions/lamplight-generate/connection-why-pipeline.ts` exporting `runConnectionWhyPipeline({ llm, supabase, ctx })`. Five phases: authz check → cache lookup → neighbor re-verify → generate-validate-maybe-retry → upsert. Mirrors `daily-devotion-pipeline.ts`'s shape; no shared abstraction yet (third caller may justify extraction later).
- **Context builder** `buildConnectionWhyContext(supabase, args)` inside `index.ts`. Loads source + related notes, extracts plaintext, computes content hashes server-side, runs the neighbor re-verify, returns `ConnectionWhyContext` or a typed early-return sentinel for `not_neighbor` / `no_embedding`.
- **Prompt template** `supabase/functions/lamplight-generate/prompts/connection-why.ts` exporting `CONNECTION_WHY_PROMPT = { promptVersion, system, tool, buildMessages(ctx) }`. Composes under `LAMPLIGHT_SYSTEM_FRAGMENT` via existing `composeSystem`. Tool schema enforces `{ why: string, minLength: 8, maxLength: 200 }`.
- **Validators additions** in `supabase/functions/_shared/validators.ts`:
  - `validateConnectionWhyShape(artifact)` — word-count ≤ 24, non-empty, string type.
  - `flattenConnectionWhyText(artifact)` — returns `artifact.why` for `applyContentRules`.
- **Adapter interface additions** in `src/notepad/storage/lamplight-adapter.ts`:
  - `ConnectionNeighbor` type — `{ relatedNoteId: string; similarity: number }`.
  - `ConnectionWhyResult` type — `{ ok: true; why: string; cached: boolean } | { ok: false; reason: 'no_embedding' | 'validators_failed' | 'not_neighbor' | 'network' }`.
  - `getConnectionNeighbors(sourceNoteId: string, k?: number): Promise<ConnectionNeighbor[]>` — calls the new RPC. Returns `[]` when no embedding exists OR no neighbors above threshold; the hook differentiates via a separate `hasEmbedding` check.
  - `hasNoteEmbedding(noteId: string): Promise<boolean>` — thin SELECT against `lamplight_embeddings` to detect the embedding-not-ready transient state. RLS already permits the read.
  - `generateConnectionWhy(sourceNoteId: string, relatedNoteId: string): Promise<ConnectionWhyResult>` — invokes Edge Function with the new kind.
- **`SupabaseLamplightAdapter` impls** — three new methods, all thin wrappers over `supabase.rpc(...)`, `supabase.from('lamplight_embeddings').select('id')`, and `supabase.functions.invoke(...)` respectively.
- **`FakeLamplightAdapter` impls** — in-memory store keyed on `(sourceNoteId, relatedNoteId)`. Test helpers: `__seedConnectionNeighbor(sourceNoteId, neighbor)`, `__seedConnectionWhy(sourceNoteId, relatedNoteId, why)`, `__failNextGenerateConnectionWhy(reason)`.
- **Hook** `src/notepad/hooks/useConnectionCards.ts` — fetch-or-empty orchestration. State machine: `inactive` / `waiting_for_embedding` / `no_connections` / `ready` / `error`. Exposes `expandCard(relatedNoteId)` that drives a per-card `why` sub-state machine.
- **Helper** `src/notepad/utils/connection-signals.ts` — `computeSharedSignals(sourceNote, neighborNote)` returning `{ sharedTags: string[]; sharedVerseRefs: string[] }`. Pure; reuses `extractAllReferences` from the existing `reference-parser.ts`.
- **UI components** in `src/notepad/components/lamplight/`:
  - `ConnectionCardsSection.tsx` — section header + up to 3 `<ConnectionCard>` children.
  - `ConnectionCard.tsx` — collapsed/expanded card with chevron, title (clickable), signal pills, and expanded why area with its own loading/error/text states.
  - `ConnectionCardsLoading.tsx` — embedding-not-ready placeholder.
- **Tab panel rewire** in `LamplightTabPanel.tsx` — new prop `activeNote?: Note | null`, new prop `totalNoteCount: number`, new prop `loadNeighborNotes: (ids: string[]) => Promise<Note[]>`, new prop `onOpenNote: (noteId: string) => void`. New branching logic that switches between `ConnectionCardsSection` / `ConnectionCardsLoading` / `TodaysLampCard`.
- **Notepad-side wiring** in the existing tab-bar consumer (`src/components/sections/Notepad.tsx`) — pass active note, total count, neighbor loader, and open-note handler into `<LamplightTabPanel>`.
- **Tests**:
  - `connection-why-pipeline.test.ts` — cache-hit (no LLM call), neighbor-re-verify-fails (no LLM call, returns `not_neighbor`), no-embedding short-circuit, happy path (generate → validate → upsert), validator-fail-then-retry, hard-fail (no persistence, ok:false).
  - `useConnectionCards.test.tsx` — every state transition (`inactive → waiting_for_embedding → ready`, `inactive → no_connections`, `ready → expand → why shown`, `ready → expand → why error → retry`), mount/unmount race safety on active-note swap.
  - `ConnectionCard.test.tsx` — collapsed shows title + pills; chevron click expands; title click invokes `onOpenNote`; expanded loading state; expanded error state with retry; expanded success.
  - `ConnectionCardsSection.test.tsx` — renders 1, 2, 3 cards; never renders > 3 even when 5 neighbors passed in.
  - `ConnectionCardsLoading.test.tsx` — copy + reduced-motion safe.
  - `connection-signals.test.ts` — verifies set intersection with empty/overlapping/disjoint inputs; caps at 3 entries; case-insensitive tag match per existing `notes.tags` convention; verse-ref normalization via the existing parser.
  - Extension of `supabase-lamplight-adapter.test.ts` — round-trip `getConnectionNeighbors`, `hasNoteEmbedding`, `generateConnectionWhy` mocked at the `functions.invoke` + `rpc` + `select` boundaries.
  - Extension of `fake-lamplight-adapter.test.ts` — round-trip three new methods + each fake-failure toggle.
  - Extension of `lamplight-rls.test.ts` — user A's session calling `match_my_note_neighbors` on user B's note rejected (`not authorized`); user A cannot read user B's `lamplight_connections` rows; service-role can read all.
  - Extension of `validators.test.ts` — `validateConnectionWhyShape` accepts 8-200-char strings with ≤24 words; rejects empty / >24-word / non-string artifacts. `flattenConnectionWhyText` returns the why verbatim.
  - Extension of `voice.test.ts` — composed system prompt for connection-why begins with `LAMPLIGHT_SYSTEM_FRAGMENT`; voice token substituted.

### Out

- **Cron sweep / pre-warming of connection caches.** All "why" generation stays lazy on user expand. Background pre-generation is a follow-up if engagement data shows it's worth the Anthropic cost.
- **"Reflect on this further" button** (parent brief §7.1). Separate small slice — needs its own prompt template + a new artifact type or in-place note insertion path. Out of scope here.
- **"See more" UX for the 4th/5th neighbor.** Hook retains them in state; rendering is capped at 3 per the brief. A follow-up can add a disclosure affordance.
- **Streaming why generation.** Same deferral as Today's Lamp.
- **Inline verse refs in the why string.** The Haiku prompt is instructed to describe, not quote — but we don't validate inline refs (consistent with Today's Lamp's MVP choice). If real-world output shows the model citing un-supplied verses in prose, harden in a follow-up by running the reference-parser against the why and flagging unknowns.
- **`prompt_version` column on `lamplight_connections`.** The version travels via the Edge Function response only; not persisted. If audit-by-prompt-version becomes important, add the column in a follow-up migration alongside other artifact tables.
- **New tokens or fonts.** Cards reuse existing `--alabaster` / `--deep-umber` / `--silica` / `--pale-stone` and Outfit + Cormorant Garamond.
- **Doctrinal review board sign-off.** Still gated behind the entitlement promo flag. The connection-why prompt is the *input* the board reviews; this slice does not pre-empt their sign-off.
- **Quiet Mode handling.** `lamplight_settings.quiet_mode` exists but Connection Cards ignore it. Per parent brief §7.6 Quiet Mode primarily gates inline suggestions; the contextual tab shift on active-note open is not a "suggestion" and is meant to remain available.
- **Embedding model A/B with reranker** (`RERANK_ENABLED`). Connection Cards use raw pgvector ordering; reranking adds latency to a path the user is expecting to be instant. If retrieval quality is poor after launch, revisit.

## Database — migration `014_lamplight_connection_match_rpc.sql`

### New RPC `match_my_note_neighbors`

```sql
create or replace function public.match_my_note_neighbors(
  p_source_note_id uuid,
  p_k int default 5,
  p_min_similarity float default 0.78
)
returns table (
  related_note_id uuid,
  similarity float
)
language plpgsql
stable
security definer
set search_path = public, extensions
set statement_timeout = '30s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_embedding extensions.vector(1024);
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  if not exists (
    select 1 from public.notes
     where id = p_source_note_id
       and user_id = v_user_id
  ) then
    raise exception 'not authorized';
  end if;

  select e.embedding
    into v_source_embedding
    from public.lamplight_embeddings e
   where e.user_id = v_user_id
     and e.source_type = 'note'
     and e.source_id = p_source_note_id::text
   limit 1;

  if v_source_embedding is null then
    return;
  end if;

  return query
    select (e.source_id::uuid) as related_note_id,
           (1 - (e.embedding <=> v_source_embedding))::float as similarity
      from public.lamplight_embeddings e
     where e.user_id = v_user_id
       and e.source_type = 'note'
       and e.source_id <> p_source_note_id::text
       and (1 - (e.embedding <=> v_source_embedding)) >= p_min_similarity
     order by e.embedding <=> v_source_embedding
     limit p_k;
end;
$$;

grant execute on function public.match_my_note_neighbors(uuid, int, float) to authenticated;
```

Type-qualification matches migration 012's discipline: `extensions.vector(1024)` (not `public.vector(...)`) — the pgvector type lives in the `extensions` schema, and `set search_path` applies at runtime, not at parse time, so the signature must be fully qualified. `set search_path = public, extensions` makes the `<=>` cosine-distance operator resolve at runtime.

### Why authenticated and not service-role

Unlike `match_user_note_embeddings` (which accepts an arbitrary `user_id` parameter and is REVOKEd from public/authenticated to prevent cross-user reads), `match_my_note_neighbors` derives the user identity from `auth.uid()` and ownership-checks the source note before returning anything. The function returns only `(related_note_id, similarity)` — no embeddings leak — so granting `authenticated` is safe and avoids an Edge Function in the hot path.

### RLS hook into `lamplight_connections`

No changes. The existing Foundation policies (insert/select/delete gated by `notes.user_id = auth.uid()`) cover both directions:
- The Edge Function (service role) writes rows on successful why generation.
- The user's session reads rows only via the Edge Function (which returns `{ ok, why, cached }`), not directly — but the RLS policy stays in place for defense-in-depth.

### Index considerations

The existing `lamplight_embeddings_embedding_hnsw` index (created in migration 011) is the canonical ANN index. `match_my_note_neighbors` uses the same `<=>` operator and benefits from the same index. No new indexes.

## Edge Function — `lamplight-generate` dispatch addition

### Payload + response

Request:
```json
{
  "kind": "connection_card_why",
  "user_id": "<uuid>",
  "source_note_id": "<uuid>",
  "related_note_id": "<uuid>"
}
```

Response (200, success):
```json
{
  "ok": true,
  "why": "Both notes return to the wilderness motif — fasting in one, exile in the other.",
  "cached": false,
  "model_used": "claude-haiku-4-5-20251001",
  "prompt_version": "connection-why-2026-05-27-v1",
  "attempts": 1
}
```

Response (200, cached):
```json
{
  "ok": true,
  "why": "<previously cached string>",
  "cached": true,
  "prompt_version": "connection-why-2026-05-27-v1",
  "attempts": 0
}
```

Response (200, no embedding for source note):
```json
{ "ok": false, "reason": "no_embedding", "attempts": 0 }
```

Response (200, related note not currently a neighbor of source):
```json
{ "ok": false, "reason": "not_neighbor", "attempts": 0 }
```

Response (200, validators failed twice):
```json
{
  "ok": false,
  "reason": "validators_failed",
  "violations": { "content": [...] },
  "model_used": "claude-haiku-4-5-20251001",
  "prompt_version": "connection-why-2026-05-27-v1",
  "attempts": 2
}
```

Errors:
- 400 — bad payload (missing fields, non-UUID strings, source_note_id == related_note_id).
- 403 — opted-out user.
- 500 — `ANTHROPIC_API_KEY` missing or unhandled exception.

### Dispatch wiring (`index.ts`)

```ts
// inside serve():
if (body.kind === 'connection_card_why') {
  if (
    typeof body.source_note_id !== 'string' ||
    typeof body.related_note_id !== 'string' ||
    body.source_note_id === body.related_note_id
  ) {
    return jsonResp({ error: 'bad payload' }, 400);
  }

  const ctx = await buildConnectionWhyContext(supabase, {
    userId: body.user_id,
    sourceNoteId: body.source_note_id,
    relatedNoteId: body.related_note_id,
    voicePreference: (settings.voice_preference as string) ?? 'Lord',
  });

  if (ctx.kind === 'no_embedding') {
    return jsonResp({ ok: false, reason: 'no_embedding', attempts: 0 });
  }
  if (ctx.kind === 'not_neighbor') {
    return jsonResp({ ok: false, reason: 'not_neighbor', attempts: 0 });
  }

  const result = await runConnectionWhyPipeline({ llm, supabase, ctx: ctx.context });
  return jsonResp(result);
}
```

### `buildConnectionWhyContext`

```ts
type BuildConnectionWhyContextResult =
  | { kind: 'no_embedding' }
  | { kind: 'not_neighbor' }
  | { kind: 'ok'; context: ConnectionWhyContext };

async function buildConnectionWhyContext(
  supabase: SupabaseClient,
  args: { userId: string; sourceNoteId: string; relatedNoteId: string; voicePreference: string },
): Promise<BuildConnectionWhyContextResult> {
  // 1. Load both notes (including tags for shared-signal intersection below).
  const { data: noteRows, error: nErr } = await supabase
    .from('notes')
    .select('id, title, content, tags')
    .eq('user_id', args.userId)
    .in('id', [args.sourceNoteId, args.relatedNoteId]);
  if (nErr) throw nErr;
  if (!noteRows || noteRows.length < 2) {
    return { kind: 'not_neighbor' }; // a deleted / cross-user note request
  }
  const sourceRow = noteRows.find(r => r.id === args.sourceNoteId)!;
  const relatedRow = noteRows.find(r => r.id === args.relatedNoteId)!;

  const sourcePlaintext = extractTextFromNoteContent(sourceRow.content as string);
  const relatedPlaintext = extractTextFromNoteContent(relatedRow.content as string);
  if (sourcePlaintext.trim().length === 0 || relatedPlaintext.trim().length === 0) {
    return { kind: 'not_neighbor' };
  }

  // 2. Load the source note's existing embedding vector. This is a prereq for
  //    the match_user_note_embeddings RPC (which takes a vector input). If the
  //    source has no embedding yet, short-circuit with no_embedding.
  const { data: embRow, error: eErr } = await supabase
    .from('lamplight_embeddings')
    .select('embedding')
    .eq('user_id', args.userId)
    .eq('source_type', 'note')
    .eq('source_id', args.sourceNoteId)
    .maybeSingle();
  if (eErr) throw eErr;
  if (!embRow) return { kind: 'no_embedding' };
  const sourceEmbedding = embRow.embedding as number[];

  // 3. Re-verify neighbor relationship server-side using the service-role RPC
  //    from migration 012. Top 5 above threshold 0.78; if related_note_id is not
  //    in the returned set, the requested pair is no longer a neighbor.
  const { data: neighbors, error: mErr } = await supabase
    .rpc('match_user_note_embeddings', {
      p_user_id: args.userId,
      p_query_vector: sourceEmbedding,
      p_exclude_source_id: args.sourceNoteId,
      p_limit: 50,
    });
  if (mErr) throw mErr;

  const currentNeighbor = (neighbors ?? [])
    .filter((n: { source_id: string; similarity: number }) => n.similarity >= 0.78)
    .slice(0, 5)
    .find((n: { source_id: string; similarity: number }) => n.source_id === args.relatedNoteId);

  if (!currentNeighbor) {
    return { kind: 'not_neighbor' };
  }

  // 4. Composite hash for cache lookup.
  const sourceHash = await sha256Hex(sourcePlaintext);
  const relatedHash = await sha256Hex(relatedPlaintext);
  const compositeHash = await sha256Hex(`${sourceHash}:${relatedHash}`);

  // 5. Shared-signal intersection via _shared/note-signals.ts (canonical
  //    server-side implementation; client mirrors via connection-signals.ts).
  const sourceRefs = extractVerseRefsFromNoteContent(sourceRow.content as string);
  const relatedRefs = extractVerseRefsFromNoteContent(relatedRow.content as string);
  const sourceTags = (sourceRow.tags as string[] | null) ?? [];
  const relatedTags = (relatedRow.tags as string[] | null) ?? [];
  const { sharedTags, sharedVerseRefs } = intersectTagsAndVerseRefs(
    { tags: sourceTags, verseRefs: sourceRefs },
    { tags: relatedTags, verseRefs: relatedRefs },
  );

  return {
    kind: 'ok',
    context: {
      userId: args.userId,
      source: {
        id: args.sourceNoteId,
        title: ((sourceRow.title as string) ?? '').trim() || '(untitled)',
        plaintext: sourcePlaintext,
      },
      related: {
        id: args.relatedNoteId,
        title: ((relatedRow.title as string) ?? '').trim() || '(untitled)',
        plaintext: relatedPlaintext,
      },
      similarity: currentNeighbor.similarity,
      voicePreference: args.voicePreference,
      compositeHash,
      sharedTags,
      sharedVerseRefs,
    },
  };
}
```

**Why shared signals are computed BOTH client- and server-side.** Client computes them for UI display (the signal pills shown on the collapsed card). Server recomputes them as the canonical input to the Haiku prompt — describing the shared signals is the why string's whole purpose, and we don't trust client-supplied signal lists. Both paths share a Deno-port-of-TS code module:

`_shared/note-signals.ts` (Deno) exports:
```ts
export function extractVerseRefsFromNoteContent(content: string): string[];
export function intersectTagsAndVerseRefs(
  source: { tags: string[]; verseRefs: string[] },
  related: { tags: string[]; verseRefs: string[] },
): { sharedTags: string[]; sharedVerseRefs: string[] };
```

`src/notepad/utils/connection-signals.ts` (browser) exports the same shape, backed by the existing `reference-parser.ts`. A cross-runtime parity test (`note-signals.test.ts`) feeds a shared fixture through both and asserts identical output strings — same discipline as `tiptap-text.ts` from the Signal Layer.

Tag intersection is case-insensitive (matches the existing `notes.tags` convention). Verse-ref intersection uses the canonical normalized form produced by the parser (e.g., `"Psalm 23:4"`). Both intersections are unbounded at this layer; the UI display layer caps at 3 entries per signal type for density.

### `runConnectionWhyPipeline`

```ts
export async function runConnectionWhyPipeline(args: {
  llm: LLMAdapter;
  supabase: SupabaseClient;
  ctx: ConnectionWhyContext;
}): Promise<ConnectionWhyPipelineResult> {
  const { ctx, supabase, llm } = args;
  const promptVersion = CONNECTION_WHY_PROMPT.promptVersion;

  // 1. Cache lookup.
  const { data: cached } = await supabase
    .from('lamplight_connections')
    .select('why, content_hash')
    .eq('note_id', ctx.source.id)
    .eq('related_note_id', ctx.related.id)
    .maybeSingle();

  if (cached && cached.content_hash === ctx.compositeHash) {
    return {
      ok: true,
      why: cached.why as string,
      cached: true,
      prompt_version: promptVersion,
      attempts: 0,
    };
  }

  // 2. Generate-validate-maybe-retry.
  let attempts = 0;
  let lastViolations: { content: ContentRuleViolation[]; shape: ConnectionShapeViolation[] } | null = null;
  let lastModelUsed = 'claude-haiku-4-5-20251001';

  for (let attempt = 0; attempt < 2; attempt++) {
    attempts++;
    const stricter = attempt === 0 ? '' : formatConnectionStricterSuffix(lastViolations!);
    const system = composeSystem({
      base: LAMPLIGHT_SYSTEM_FRAGMENT,
      artifact: CONNECTION_WHY_PROMPT.system,
      voicePreference: ctx.voicePreference,
      stricter,
    });

    const { parsed, modelUsed } = await llm.generate<ConnectionWhyArtifact>({
      model: 'haiku',
      system,
      messages: CONNECTION_WHY_PROMPT.buildMessages(ctx),
      tool: CONNECTION_WHY_PROMPT.tool,
      maxTokens: 256,
    });
    lastModelUsed = modelUsed;

    const shape = validateConnectionWhyShape(parsed);
    const flat = flattenConnectionWhyText(parsed);
    const content = await applyContentRules(flat, {
      banned: BANNED_PHRASES,
      contested: CONTESTED_PASSAGES,
      growth: GROWTH_BANNED_PHRASES,
    });

    if (shape.ok && content.ok) {
      // 3. Persist.
      const upsertRes = await supabase
        .from('lamplight_connections')
        .upsert({
          note_id: ctx.source.id,
          related_note_id: ctx.related.id,
          why: parsed.why,
          score: ctx.similarity,
          content_hash: ctx.compositeHash,
        }, { onConflict: 'note_id,related_note_id' });
      if (upsertRes.error) throw upsertRes.error;

      return {
        ok: true,
        why: parsed.why,
        cached: false,
        model_used: modelUsed,
        prompt_version: promptVersion,
        attempts,
      };
    }
    lastViolations = { content: content.violations, shape: shape.violations };
  }

  return {
    ok: false,
    reason: 'validators_failed',
    violations: lastViolations!,
    model_used: lastModelUsed,
    prompt_version: promptVersion,
    attempts,
  };
}
```

`formatConnectionStricterSuffix` is a local helper (kept local; not promoted to `_shared` yet — same reasoning as Today's Lamp's choice for `formatStricterSuffix`).

## Prompt — `connection-why.ts`

```ts
export const CONNECTION_WHY_PROMPT = {
  promptVersion: 'connection-why-2026-05-27-v1',
  system: [
    'Two of the user\'s notes share signal. In ≤24 words, name what they share.',
    '',
    'How to write the line:',
    '- Concrete and observable. Name a recurring image, theme, or question that links them.',
    '- Describe — do not advise. No "you should…", no "consider…", no "remember…".',
    '- Quote nothing verbatim from either note. Reference is fine; transcription is not.',
    '- If the shared signal is a Scripture reference, name it gently.',
    '- Mirror the user\'s voice preference for divine names: use "{{voice_preference}}".',
    '',
    'You inherit the voice fragment\'s prohibitions — no prophetic claims, no streak language,',
    'no interpretation of contested passages beyond plain reading.',
  ].join('\n'),
  tool: {
    name: 'emit_connection_why',
    description: 'Return the one-line connection rationale.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['why'],
      properties: {
        why: { type: 'string', minLength: 8, maxLength: 200 },
      },
    },
  },
  buildMessages(ctx: ConnectionWhyContext): Array<{ role: 'user'; content: string }> {
    const sourceBlock = `Active note (id=${ctx.source.id}, title="${ctx.source.title}"):\n${ctx.source.plaintext.slice(0, 1200)}`;
    const relatedBlock = `Related note (id=${ctx.related.id}, title="${ctx.related.title}"):\n${ctx.related.plaintext.slice(0, 1200)}`;
    const tagsLine = ctx.sharedTags.length ? ctx.sharedTags.join(', ') : 'none';
    const refsLine = ctx.sharedVerseRefs.length ? ctx.sharedVerseRefs.join(', ') : 'none';
    return [{
      role: 'user',
      content:
        `${sourceBlock}\n\n${relatedBlock}\n\n` +
        `Shared signals — tags: [${tagsLine}]; verse refs: [${refsLine}]; cosine similarity: ${ctx.similarity.toFixed(3)}.\n\n` +
        `Write the connection in ≤24 words.`,
    }];
  },
} as const;
```

## Validators — `validators.ts` additions

```ts
export interface ConnectionWhyArtifact {
  why: string;
}

export interface ConnectionShapeViolation {
  rule: 'word_count_exceeded' | 'empty' | 'not_string';
  detail: string;
}

export function validateConnectionWhyShape(
  artifact: ConnectionWhyArtifact,
): { ok: boolean; violations: ConnectionShapeViolation[] } {
  const violations: ConnectionShapeViolation[] = [];
  if (typeof artifact?.why !== 'string') {
    violations.push({ rule: 'not_string', detail: 'why is not a string' });
    return { ok: false, violations };
  }
  const trimmed = artifact.why.trim();
  if (trimmed.length === 0) {
    violations.push({ rule: 'empty', detail: 'why is empty after trim' });
  }
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount > 24) {
    violations.push({ rule: 'word_count_exceeded', detail: `${wordCount} words > 24` });
  }
  return { ok: violations.length === 0, violations };
}

export function flattenConnectionWhyText(artifact: ConnectionWhyArtifact): string {
  return artifact.why;
}
```

`applyContentRules` runs against `flattenConnectionWhyText(artifact)`. No citation validator (no structured citations in the shape).

## Client-side — `lamplight-adapter.ts` additions

```ts
export interface ConnectionNeighbor {
  relatedNoteId: string;
  similarity: number;
}

export type ConnectionWhyResult =
  | { ok: true; why: string; cached: boolean }
  | { ok: false; reason: 'no_embedding' | 'validators_failed' | 'not_neighbor' | 'network' };

export interface LamplightAdapter {
  // ... existing methods unchanged ...
  getConnectionNeighbors(sourceNoteId: string, k?: number): Promise<ConnectionNeighbor[]>;
  hasNoteEmbedding(noteId: string): Promise<boolean>;
  generateConnectionWhy(sourceNoteId: string, relatedNoteId: string): Promise<ConnectionWhyResult>;
}
```

### Supabase impl sketch

```ts
async getConnectionNeighbors(sourceNoteId: string, k = 5): Promise<ConnectionNeighbor[]> {
  const { data, error } = await this.#client.rpc('match_my_note_neighbors', {
    p_source_note_id: sourceNoteId,
    p_k: k,
  });
  if (error) throw error;
  return (data ?? []).map((row: { related_note_id: string; similarity: number }) => ({
    relatedNoteId: row.related_note_id,
    similarity: row.similarity,
  }));
}

async hasNoteEmbedding(noteId: string): Promise<boolean> {
  const { count, error } = await this.#client
    .from('lamplight_embeddings')
    .select('id', { count: 'exact', head: true })
    .eq('source_type', 'note')
    .eq('source_id', noteId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async generateConnectionWhy(
  sourceNoteId: string,
  relatedNoteId: string,
): Promise<ConnectionWhyResult> {
  try {
    const { data, error } = await this.#client.functions.invoke('lamplight-generate', {
      body: {
        kind: 'connection_card_why',
        user_id: (await this.#getUserId()),
        source_note_id: sourceNoteId,
        related_note_id: relatedNoteId,
      },
    });
    if (error) return { ok: false, reason: 'network' };
    if (!data || typeof data !== 'object') return { ok: false, reason: 'network' };
    if (data.ok === true && typeof data.why === 'string') {
      return { ok: true, why: data.why, cached: !!data.cached };
    }
    if (data.ok === false && (
      data.reason === 'no_embedding' ||
      data.reason === 'validators_failed' ||
      data.reason === 'not_neighbor'
    )) {
      return { ok: false, reason: data.reason };
    }
    return { ok: false, reason: 'network' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}
```

## Hook — `useConnectionCards.ts`

### Contract

```ts
export interface ConnectionCardWhyState {
  phase: 'collapsed' | 'loading' | 'shown' | 'error';
  text?: string;
  cached?: boolean;
  reason?: 'validators_failed' | 'network';
}

export interface ConnectionCard {
  relatedNoteId: string;
  relatedNoteTitle: string;
  similarity: number;
  sharedTags: string[];
  sharedVerseRefs: string[];
  why: ConnectionCardWhyState;
}

export type ConnectionCardsState =
  | { phase: 'inactive' }
  | { phase: 'waiting_for_embedding' }
  | { phase: 'no_connections' }
  | { phase: 'ready'; cards: ConnectionCard[] }
  | { phase: 'error'; reason: 'network' };

export interface UseConnectionCardsArgs {
  adapter: LamplightAdapter;
  userId: string;
  activeNote: Note | null;
  totalNoteCount: number;
  loadNeighborNotes: (ids: string[]) => Promise<Note[]>;
  qualifyingMinWords?: number;        // default 100
  qualifyingMinVaultSize?: number;    // default 10
  maxRenderedCards?: number;          // default 3
}

export interface UseConnectionCardsResult {
  state: ConnectionCardsState;
  expandCard: (relatedNoteId: string) => Promise<void>;
  retryWhy: (relatedNoteId: string) => Promise<void>;
}
```

### Flow

1. On `activeNote` or `totalNoteCount` change: compute qualification.
   - `activeNote == null` → `state = { phase: 'inactive' }`. Done.
   - active note plaintext word count < `qualifyingMinWords` → `inactive`.
   - `totalNoteCount < qualifyingMinVaultSize` → `inactive`.
2. Qualified: `adapter.hasNoteEmbedding(activeNote.id)`:
   - `false` → `state = { phase: 'waiting_for_embedding' }`. (Hook does NOT poll — it's the user's next save/open that re-runs this. A future enhancement could retry on a short interval; out of scope.)
   - `true` → continue.
3. `adapter.getConnectionNeighbors(activeNote.id)`:
   - `[]` → `state = { phase: 'no_connections' }`.
   - `[...]` → `loadNeighborNotes(ids)` to get titles/content/tags. Compute shared signals client-side via `computeSharedSignals`. Build cards. Cap rendered at `maxRenderedCards`. `state = { phase: 'ready', cards }`.
4. `expandCard(relatedNoteId)`:
   - Find the card; set its `why.phase = 'loading'`.
   - Call `adapter.generateConnectionWhy(activeNote.id, relatedNoteId)`.
   - On `ok: true` → card's `why = { phase: 'shown', text, cached }`.
   - On `ok: false` → card's `why = { phase: 'error', reason: 'validators_failed' | 'network' }`. `not_neighbor` and `no_embedding` are coerced into `network` for UI simplicity since they shouldn't happen post-qualification (and indicate a stale neighbor list — `retryWhy` re-runs the same call; the hook can re-query the neighbor list in a future enhancement).
5. `retryWhy(relatedNoteId)` — same as `expandCard` but only valid when current `why.phase === 'error'`.

### Concurrency safety

- A `generationRef` increments on every `activeNote` change; promise resolutions check it before `setState`.
- Per-card `expandCard` calls maintain a per-card sequence; only the latest expansion's resolution writes to the card's `why` state. Tap-spamming the chevron is safe.
- Unmount sets `cancelledRef` and short-circuits any in-flight `setState`.

### Why client-side qualification rather than RPC

The qualification (≥100 words, ≥10 notes) is checked against data the client already has — the active note's plaintext (already loaded into the editor) and the total note count (already loaded into the sidebar / available via the existing notes adapter). A server-side check would add a round trip with no security benefit. The RPC still enforces ownership; the qualification is a UX filter, not a privilege boundary.

## UI — `ConnectionCardsSection` + `ConnectionCard`

### Visual structure (section)

```
┌────────────────────────────────────────────────────┐
│ Connections                                        │ ← header (Outfit, 12px, --silica, uppercase)
│                                                    │
│ ┌──────────────────────────────────────────────┐   │
│ │ ▸  {related note title}                      │   │ ← Card 1 (collapsed)
│ │     #prayer  ·  Psalm 23:4                   │   │ ← signal pills
│ └──────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────┐   │
│ │ ▾  {related note title}                      │   │ ← Card 2 (expanded)
│ │     #doubt  ·  Romans 8                      │   │
│ │ ┌──────────────────────────────────────────┐ │   │
│ │ │ {why string — Cormorant Garamond 14px}   │ │   │ ← revealed why
│ │ └──────────────────────────────────────────┘ │   │
│ └──────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────┐   │
│ │ ▸  {related note title}                      │   │ ← Card 3
│ │     #scripture-memory  ·  Lamentations 3     │   │
│ └──────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

Header is small + restrained — connections aren't a hero block, they're contextual. No "see more" affordance in MVP.

### `ConnectionCard.tsx` interaction model

- **Card chrome** is a `button` element (accessible) with `aria-expanded` reflecting state. Pressing it toggles expansion.
- **Title** is a separate `button` inside the card with its own click handler — `onOpenNote(relatedNoteId)`. Stops propagation so it doesn't also toggle expand. Underlined on hover.
- **Chevron** ▸/▾ is purely decorative (the card-chrome button handles toggle); rendered with `aria-hidden`.
- Inside the expanded area:
  - `loading` → small "Lighting…" copy + pulsed dot. Reduced-motion-safe (no animation when `prefers-reduced-motion: reduce`).
  - `shown` → the why string in Cormorant Garamond italic. A tiny `cached` indicator (debug-only via `data-cached` attribute; not visible to users).
  - `error` → "Couldn't read this connection." + a "Try again" link that calls `retryWhy`.

### `ConnectionCardsLoading.tsx`

```tsx
export function ConnectionCardsLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[280px] px-6 text-center"
         style={{ background: 'var(--alabaster)' }}>
      <div className="text-2xl mb-3 animate-pulse motion-reduce:animate-none" aria-hidden>🕯</div>
      <p className="text-xs"
         style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
         role="status" aria-live="polite">
        Lamplight is reading this note…
      </p>
    </div>
  );
}
```

Smaller `min-h` than `TodaysLampLoading` because connections are a contextual / secondary surface, not the full tab. `motion-reduce:` class disables the animation under `prefers-reduced-motion`.

### Tab panel rewire — `LamplightTabPanel.tsx`

```tsx
export interface LamplightTabPanelProps {
  lamplightAdapter: LamplightAdapter;
  activeNote?: Note | null;
  totalNoteCount?: number;
  loadNeighborNotes?: (ids: string[]) => Promise<Note[]>;
  onOpenNote?: (noteId: string) => void;
}

export function LamplightTabPanel({
  lamplightAdapter,
  activeNote = null,
  totalNoteCount = 0,
  loadNeighborNotes,
  onOpenNote,
}: LamplightTabPanelProps) {
  // ... existing user/settings/entitlement branches unchanged ...

  // Below the entitlement gate, before falling through to TodaysLampCard:
  const connections = useConnectionCards({
    adapter: lamplightAdapter,
    userId: user.id,
    activeNote,
    totalNoteCount,
    loadNeighborNotes: loadNeighborNotes ?? (async () => []),
  });

  if (connections.state.phase === 'waiting_for_embedding') {
    return <ConnectionCardsLoading />;
  }
  if (connections.state.phase === 'ready') {
    return (
      <ConnectionCardsSection
        cards={connections.state.cards}
        onExpand={connections.expandCard}
        onRetry={connections.retryWhy}
        onOpenNote={onOpenNote ?? (() => {})}
      />
    );
  }
  // 'inactive', 'no_connections', 'error' → Today's Lamp fallback.

  const localDate = new Date().toLocaleDateString('en-CA');
  return (
    <TodaysLampCard
      adapter={lamplightAdapter}
      userId={user.id}
      localDate={localDate}
      voicePreference={settingsState.settings.voicePreference}
      traditionHint={settingsState.settings.traditionHint}
    />
  );
}
```

All new props are optional with sensible defaults so callers that haven't been updated (tests, isolated renders) keep working. The notepad page itself passes the real values from its existing state.

### Notepad integration (`src/components/sections/Notepad.tsx`)

Adds four props to the existing `<LamplightTabPanel>` mount: `activeNote`, `totalNoteCount`, `loadNeighborNotes`, `onOpenNote`. All derive from data the surrounding component already holds — the active note from the editor's selection, the total count from the notes list, the neighbor loader from the storage adapter's `getNotes({ ids })` (existing method used by Backlinks), and `onOpenNote` from the existing tab-swap handler used by Backlinks links.

## State diagram — opening a qualifying note

```
User opens note → Notepad page sets activeNote
                                │
                                ▼
            LamplightTabPanel re-renders with new activeNote
                                │
                                ▼
              useConnectionCards runs qualification gate
                                │
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
     <100 words OR        active note has        embedding present
     vault <10 notes      no embedding yet
            │                   │                   │
            ▼                   ▼                   ▼
       inactive          waiting_for_embedding   getConnectionNeighbors
       (Today's Lamp)    (Loading placeholder)         │
                                                 ┌────┴────┐
                                                 ▼         ▼
                                             []          [n1..n5]
                                             │             │
                                             ▼             ▼
                                       no_connections   loadNeighborNotes
                                       (Today's Lamp)        │
                                                              ▼
                                                computeSharedSignals
                                                              │
                                                              ▼
                                                ready (top 3 cards rendered)
                                                              │
                                                ┌─────────────┴─────────────┐
                                                ▼                           ▼
                                          chevron click                 title click
                                                │                           │
                                                ▼                           ▼
                                          expandCard                   onOpenNote
                                                │                       (navigation)
                                  ┌─────────────┼─────────────┐
                                  ▼             ▼             ▼
                            cache hit      Haiku call     not_neighbor /
                            (no LLM)        + validate    no_embedding
                                  │             │             │
                                  ▼             ▼             ▼
                            why: shown    ok → upsert     why: error
                                          fail → retry    (rare)
                                              │
                                              ▼
                                       second pass
                                              │
                                  ┌───────────┴───────────┐
                                  ▼                       ▼
                                ok                    hard fail
                                  │                       │
                                  ▼                       ▼
                            why: shown            why: error (Try again)
```

## Acceptance criteria

Connection Cards is done when every item below holds.

1. **Migration 014** runs clean against a fresh Supabase project. `match_my_note_neighbors` is callable by `authenticated`. Calling it for a note owned by a different user raises `not authorized`. Calling it without a session raises `unauthenticated`.
2. **RPC behavior:** for a user with one note that has an embedding and 5 other notes with embeddings, `match_my_note_neighbors(p_source_note_id, 5, 0.5)` returns up to 5 rows ordered by similarity desc, all with `related_note_id <> p_source_note_id`, all belonging to the calling user.
3. **Edge Function dispatch** routes `kind: 'connection_card_why'` to the new pipeline. `smoke_test` and `daily_devotion` continue to work unchanged.
4. **Payload validation:** missing or non-string `source_note_id` / `related_note_id`, or `source_note_id === related_note_id`, returns 400.
5. **Opted-out user** gets 403 on `connection_card_why`. No Anthropic call, no Voyage call.
6. **Cache hit:** for `(source, related)` where `lamplight_connections.content_hash` equals the freshly-computed composite hash, the function returns `{ ok: true, cached: true, attempts: 0 }` with the stored `why`. No Anthropic call.
7. **Cache miss:** with a new note pair (no row yet), the function generates via Haiku, validates, upserts the row with `content_hash = composite`, and returns `{ ok: true, cached: false, attempts: 1 }`.
8. **Cache invalidation by source edit:** editing the source note's plaintext (new content_hash) causes the next `connection_card_why` call to miss cache and regenerate. Old row's `content_hash` was based on old source_hash; new composite doesn't match.
9. **Cache invalidation by related edit:** editing the related note's plaintext also invalidates. The composite hash includes the related note's hash.
10. **`not_neighbor`:** calling with a `related_note_id` that is NOT currently in `match_my_note_neighbors`'s top-5-above-threshold for the source returns `{ ok: false, reason: 'not_neighbor' }`. No Anthropic call.
11. **`no_embedding`:** calling when the source note has no row in `lamplight_embeddings` returns `{ ok: false, reason: 'no_embedding' }`. No Anthropic call.
12. **Validator-fail-then-retry:** when the first Haiku response (mocked) returns a why with a banned phrase OR >24 words, the pipeline composes a stricter suffix and retries once; on second pass it succeeds and persists.
13. **Hard fail:** when both attempts violate, the function returns `{ ok: false, reason: 'validators_failed', attempts: 2 }`. No row is written to `lamplight_connections`. The card UI renders the "Try again" inline.
14. **Voice fragment composed correctly:** the system prompt sent to Anthropic begins with `LAMPLIGHT_SYSTEM_FRAGMENT`, followed by the connection-why artifact stance, followed by the stricter suffix on the retry attempt only. `{{voice_preference}}` is substituted from `lamplight_settings.voice_preference`. Tested by capturing the `system` arg passed to the mocked `LLMAdapter.generate`.
15. **Content rules inherited verbatim:** `BANNED_PHRASES`, `CONTESTED_PASSAGES`, `GROWTH_BANNED_PHRASES` from `voice.ts` are applied to `artifact.why`. A test injects a sentinel banned phrase and asserts the validator catches it.
16. **Word count enforced:** `validateConnectionWhyShape` rejects a why with 25+ words; accepts ≤24.
17. **Lamplight tab branching:** with an opted-in entitled user, the tab renders:
    - `TodaysLampCard` when no active note.
    - `TodaysLampCard` when active note is <100 words.
    - `TodaysLampCard` when total note count <10.
    - `TodaysLampCard` when no neighbors above threshold for a qualifying note.
    - `ConnectionCardsLoading` placeholder when qualifying note has no embedding yet.
    - `ConnectionCardsSection` (1-3 cards) when qualifying note has an embedding and neighbors.
18. **`ConnectionCard` UX:**
    - Chevron click toggles expand. `aria-expanded` reflects state.
    - Title click invokes `onOpenNote(relatedNoteId)`, does NOT toggle expand.
    - First expand on a card triggers `generateConnectionWhy`. Subsequent expand-collapse-expand on the same card does NOT re-call the function (cached in the hook's state for the session). The Edge Function's own cache is the persistence layer; the hook's cache is the session layer.
    - Loading state has `role="status"` and `aria-live="polite"`.
    - Error state shows "Try again" link that retries on click.
19. **Cards rendered cap = 3.** If the RPC returns 5 neighbors, exactly 3 cards render. The hook retains 5 internally.
20. **Shared signals computed correctly:**
    - `sharedTags` is the case-insensitive set intersection of `notes.tags` between source and related.
    - `sharedVerseRefs` is the set intersection of verse refs extracted by `reference-parser` from both notes.
    - Each capped at 3 entries for display.
    - The Edge Function's Deno-ported `note-signals.ts` produces the same result on a shared fixture as the browser-side `connection-signals.ts`. Cross-runtime test asserts identical output.
21. **RLS regression** (extension of `lamplight-rls.test.ts`):
    - User A's session cannot read user B's `lamplight_connections` rows.
    - User A's session calling `match_my_note_neighbors(p_source_note_id = <B's note id>)` raises `not authorized`.
    - Service-role can read all rows.
22. **No regression in Foundation, Signal, Reasoning, or Today's Lamp:** the 4-state tab, profile section toggles, consent flow, `deleteAllUserData` (also covers `lamplight_connections` per Foundation's existing cascade), embedding queue + `embed-note` sweep, smoke-test pipeline, daily-devotion pipeline + card — all continue to work.
23. **`npm run lint`, `tsc -b`, `vitest run`, and `deno test supabase/functions/_shared/*.test.ts supabase/functions/lamplight-generate/**/*.test.ts` all pass.** New test files:
    - `supabase/functions/lamplight-generate/connection-why-pipeline.test.ts`
    - `supabase/functions/_shared/note-signals.test.ts` (cross-runtime parity fixture)
    - `src/notepad/hooks/useConnectionCards.test.tsx`
    - `src/notepad/utils/connection-signals.test.ts`
    - `src/notepad/components/lamplight/ConnectionCardsSection.test.tsx`
    - `src/notepad/components/lamplight/ConnectionCard.test.tsx`
    - `src/notepad/components/lamplight/ConnectionCardsLoading.test.tsx`
    - Extensions to `supabase-lamplight-adapter.test.ts`, `fake-lamplight-adapter.test.ts`, `lamplight-rls.test.ts`, `validators.test.ts`, `voice.test.ts`.
24. **No new env vars.** `ANTHROPIC_API_KEY`, `VOYAGE_AI_KEY`, `RERANK_ENABLED` are inherited unchanged.
25. **Bundle size:** `npm run build` size diff is bounded — new client code is the hook + three components + the signals helper; no new heavy dependencies.

## Files touched / created

### New files

- `supabase/migrations/014_lamplight_connection_match_rpc.sql`
- `supabase/functions/lamplight-generate/prompts/connection-why.ts`
- `supabase/functions/lamplight-generate/connection-why-pipeline.ts`
- `supabase/functions/lamplight-generate/connection-why-pipeline.test.ts`
- `supabase/functions/_shared/note-signals.ts` (Deno port of relevant reference-parser logic)
- `supabase/functions/_shared/note-signals.test.ts`
- `src/notepad/hooks/useConnectionCards.ts`
- `src/notepad/hooks/useConnectionCards.test.tsx`
- `src/notepad/utils/connection-signals.ts`
- `src/notepad/utils/connection-signals.test.ts`
- `src/notepad/components/lamplight/ConnectionCardsSection.tsx`
- `src/notepad/components/lamplight/ConnectionCardsSection.test.tsx`
- `src/notepad/components/lamplight/ConnectionCard.tsx`
- `src/notepad/components/lamplight/ConnectionCard.test.tsx`
- `src/notepad/components/lamplight/ConnectionCardsLoading.tsx`
- `src/notepad/components/lamplight/ConnectionCardsLoading.test.tsx`

### Modified files

- `supabase/functions/lamplight-generate/index.ts` — dispatch on `connection_card_why`; new `buildConnectionWhyContext`.
- `supabase/functions/_shared/validators.ts` — `validateConnectionWhyShape`, `flattenConnectionWhyText`.
- `supabase/functions/_shared/validators.test.ts` — coverage.
- `src/notepad/storage/lamplight-adapter.ts` — interface additions.
- `src/notepad/storage/supabase-lamplight-adapter.ts` — three new impls.
- `src/notepad/storage/supabase-lamplight-adapter.test.ts` — coverage.
- `src/notepad/storage/fake-lamplight-adapter.ts` — three new impls + test helpers.
- `src/notepad/storage/fake-lamplight-adapter.test.ts` — coverage.
- `src/notepad/storage/lamplight-rls.test.ts` — `match_my_note_neighbors` cross-user check + `lamplight_connections` cross-user read check.
- `src/notepad/components/lamplight/LamplightTabPanel.tsx` — new props + branching.
- `src/notepad/components/lamplight/LamplightTabPanel.test.tsx` — coverage for new branches.
- `src/components/sections/Notepad.tsx` — pass new props into `<LamplightTabPanel>`.

### Untouched

- All Foundation, Signal Layer, Reasoning Layer, and Today's Lamp files except where listed above.
- `_shared/anthropic.ts`, `_shared/retrieval.ts`, `_shared/voyage.ts`, `_shared/voice.ts`, `_shared/artifacts.ts`. No changes.
- Migrations 001-013. No DB churn besides the new migration.
- The `daily-devotion-pipeline.ts` and `smoke-test` pipeline. No changes.

## Open follow-ups (later sub-projects + small cleanups)

1. **"Reflect on this further" button.** Parent brief §7.1 — when a card is expanded, an action that drafts a follow-up prompt for the user. Needs a new artifact type or in-place note insertion. Small slice.
2. **Background pre-warming of why strings.** If telemetry shows users frequently expand cards (high cache-miss rate), pre-warm: generate the why for the top-3 neighbors immediately on `ready` rather than on expand. Tradeoff: triples Haiku cost. Defer until data justifies.
3. **"See more" disclosure for 4th + 5th neighbors.** Hook already retains them; UI affordance is a small follow-up.
4. **Inline verse refs validation on the why.** Currently the why prompt is told to "describe, not quote" but inline refs aren't validated. If real-world output drifts, harden by running the reference-parser against `artifact.why` and flagging refs not present in either note. Mirror Today's Lamp's deferral here.
5. **`prompt_version` column on `lamplight_connections`.** Small migration if audit-by-prompt becomes important.
6. **Embedding-not-ready polling.** Currently the hook does not poll when in `waiting_for_embedding`. A short interval (5s × 12 = 60s) could auto-transition the user into `ready` when their note's embedding lands. Minor UX gain.
7. **Doctrinal review board sign-off.** Pre-launch artifact. Reviewers examine `CONNECTION_WHY_PROMPT.system`, the composed system string under representative inputs, ~20 sample generated whys against synthetic note pairs. Until they sign, public launch stays behind the entitlement promo flag.
8. **Reranker A/B for neighbor list.** Currently raw pgvector ordering. If retrieval quality is poor (cards consistently feel unrelated), wire `voyage.rerank()` into a server-side variant of `match_my_note_neighbors` and A/B against the unranked path.

## Notes for the implementer

- **The composite hash is the source of truth.** `content_hash = sha256(source_text_hash + ':' + related_text_hash)` — both halves are derived from `extractTextFromNoteContent(content)`, NOT from raw TipTap JSON, so format-only edits (bold toggles, whitespace tweaks) do not invalidate the cache. Same discipline as the existing embedding `content_hash`.
- **The neighbor re-verify is non-optional.** Without it, any authenticated user could ask the Edge Function to generate a "why" for arbitrary note pairs they own, burning Anthropic credits on irrelevant pairings. The check costs one pgvector query per call but is cheap (HNSW + already-warm index).
- **`note-signals.ts` is duplicated between `src/` and `supabase/functions/_shared/`.** Same discipline as `tiptap-text.ts`. Keep them functionally equivalent on the shared fixture; the cross-runtime test asserts identical output strings. Diverging silently re-embeds-or-fails-to-cache forever.
- **Cards' session-level "expanded-once-shown-forever" cache lives in the hook**, not in the component. Collapsing and re-expanding does not re-invoke `generateConnectionWhy` — the hook stores the resolved why in card state. If the user changes active note, the hook reinitializes; the new note's cards start collapsed.
- **`maxRenderedCards = 3` is the design contract.** Do not render 4+; the brief is explicit on this. If a future "see more" affordance lands, it's a separate UX, not a bigger initial render.
- **`hasNoteEmbedding` returns a boolean, not the content hash.** The Edge Function recomputes both notes' hashes from scratch on every call. We don't trust client-supplied hashes; we don't expose them either.
- **The qualification thresholds (`≥100 words`, `≥10 notes`) are inlined as defaults on the hook**, not loaded from app_config. If a future feature flag wants to tune them per-user or per-experiment, surface them through the existing `lamplight_settings` + adapter pattern. YAGNI in MVP.
- **Reduced-motion safety.** The "🕯 Lamplight is reading…" placeholder pulses with `animate-pulse`; the `motion-reduce:animate-none` Tailwind utility disables it under `prefers-reduced-motion`. Matches the discipline already established for `TodaysLampLoading`.
- **No `prompt_version` on the persisted row.** If you find yourself wanting to add this column, write a separate small migration in a follow-up PR; do not bundle it with the slice. Audit-by-prompt is a feature, not a side-effect of caching.
- **Title-click vs. chevron-click separation is intentional.** Users will swap to related notes constantly while reading connections; making the whole card a navigation target hides the "tell me more" affordance behind a deliberate gesture. The two-target pattern is what the brief implies ("click-through to the related note" + "lazy on expand").
