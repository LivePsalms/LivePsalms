# Lamplight — Reasoning Layer (Sub-Project 3)

**Status:** Draft (2026-05-26)
**Owner:** Notepad — AI companion feature
**Parent brief:** `Lamplight_AI_details.md` (root)
**Predecessors:** Sub-Project 1 — Foundation (shipped) · Sub-Project 2 — Signal Layer (shipped)
**Companion sub-projects (future):** Today's Lamp · Connection Cards · Entitlements UI · Doctrinal Review · Weekly Insight · Reflections Recap

## Purpose

Signal Layer produced embeddings (notes + Bible passages) and stood up the queue + Voyage client. Reasoning Layer is the next slice: it lights up the **deterministic, citation-first generation pipeline** every downstream Lamplight artifact will sit on top of.

After this slice ships:

1. An `LLMAdapter` interface wraps Anthropic Messages (Sonnet 4.6 + Haiku 4.5). All Claude calls flow through it; no other module talks to `api.anthropic.com` directly.
2. Retrieval helpers (`searchNeighbors`, `searchBible`) wrap pgvector + (optional) Voyage `rerank-2.5` reranking behind a single function each.
3. A `validators` module exposes two pure functions: `validateCitations()` (every claim is grounded) and `applyContentRules()` (banned-phrase + contested-passage + growth-only filter — all regex/substring, deterministic, inspectable by the doctrinal review board).
4. A shared `voice.ts` module exports the positive stance fragment that every Lamplight artifact's system prompt will inherit, plus the canonical banned-phrase and contested-passage lists.
5. A Supabase Edge Function `lamplight-generate` accepts `{ kind: 'smoke_test', user_id }`, runs the whole pipeline against a real user's signals, and returns a structured artifact + validator report. The smoke-test prompt is throwaway — it proves the pipeline works without committing to Today's Lamp wording (which needs doctrinal review).

**Still zero user-visible surface.** `<OptedInPlaceholder />` continues to render Foundation's "Lamplight will appear here when ready." copy. The Edge Function is invoked only by tests and by `supabase functions invoke` from the CLI. Sub-project 4 (Today's Lamp) wires the first real artifact + UI on top of these blocks.

The slice is sized for ~1 week, one engineer.

## Decisions log

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Slice rhythm | **Invisible building-blocks slice** | Mirrors Signal Layer's cadence. No UI changes, no Lamplight tab content shift, no client-side fetch added. Sub-project 4 owns the first user-visible artifact. |
| 2 | Smoke-test prompt | **Generic, deliberately throwaway prompt; behind `LAMPLIGHT_SMOKE_TEST=true`** | Exists only to exercise every pipeline stage (retrieval → LLM → validators) end-to-end. Not a draft of Today's Lamp. Doctrinal review board does not sign off on this prompt; they sign off on the real templates in later slices. |
| 3 | Reranker | **Voyage `rerank-2.5` wired in `voyage.ts`; off by default via `RERANK_ENABLED` env flag** | The infrastructure (one extra `fetch` against `https://api.voyageai.com/v1/rerank`) is ready; the toggle is invisible to callers of `searchNeighbors` / `searchBible`. Sub-project 4 A/Bs quality with the flag on. |
| 4 | Doctrinal guardrail | **Code-only deterministic (regex banned-phrase + contested-passage substring matcher)** | Inspectable, reviewable, no mystery LLM behavior. An LLM-classifier second pass ("Layer C") is deferred; the interface leaves a slot for it inside `applyContentRules`. |
| 5 | Voice principle (banned-phrase list) | **Prophetic/oracular patterns banned at the regex layer** | `God is telling you`, `the Lord is giving you a word`, `God wants you to`, `God says to you`, `the Spirit is saying`, `I sense God is`, plus tense variants (`told you`, `is telling`, `wanted you to`, etc.). See §"Voice fragment" for the canonical list. |
| 6 | Voice principle (positive stance) | **Reveal Scripture against user context; offer interpretation as possibility, never pronouncement** | Encoded as the `LAMPLIGHT_SYSTEM_FRAGMENT` constant in `voice.ts`. Every Lamplight artifact's system prompt — now and in future slices — composes from this fragment. |
| 7 | Growth-only filter | **Code-only regex; runs in the same pass as the doctrinal guardrail** | Catches streak / "don't miss yesterday" / "get back on track" language. Bundled into `applyContentRules` as the third rule family. |
| 8 | LLM models | **Sonnet 4.6 (`claude-sonnet-4-6`) for mid-tier; Haiku 4.5 (`claude-haiku-4-5-20251001`) for fast tier** | Current GA models. The brief's "Sonnet 4.7 + Haiku 4" labels predate these releases; the locked spec wraps both behind `LLMAdapter` specifically so this swap is one constant. |
| 9 | Structured outputs | **Anthropic tool-use with `input_schema`, forced via `tool_choice`** | The documented reliable pattern for JSON. The model is asked to call a single tool whose arguments are the artifact JSON; the adapter extracts `tool_use.input`. No prompt-engineered JSON fishing. |
| 10 | Streaming | **Non-streaming `generate()` only** | Validators cannot run mid-stream (can't doctrinal-guard partial text). `generateStream()` lands when inline suggestions ship in a later slice. Today's Lamp's "progressive UI" copy can be staged client-side. |
| 11 | Where it runs | **Supabase Edge Function (Deno), service-role secrets only** | Anthropic API key never touches the browser. Same trust-model rationale as `embed-note`. |
| 12 | Prompt versioning | **`prompt_version` const exported from each prompt template module** | Nothing reads it yet; sub-project 4 will persist it on `lamplight_artifacts.prompt_version`. Convention now so it isn't retrofitted later. |
| 13 | Adapter transport | **Direct `fetch` to `https://api.anthropic.com/v1/messages`** | Matches `voyage.ts` discipline. Avoids the Node-shaped `@anthropic-ai/sdk` inside Deno. Verifies request/response shape against current Anthropic docs via Context7 at implementation time. |
| 14 | Persistence | **None this slice** | `lamplight-generate` returns the artifact to the caller. `lamplight_artifacts` writes land in sub-project 4 along with the Today's Lamp template. |
| 15 | Per-user cost cap | **YAGNI** | Anthropic's `max_tokens` cap per request is enforced inside the adapter; abuse-grade rate limiting is deferred until observed. |

## Scope

### In

- **Module `supabase/functions/_shared/anthropic.ts`** — `LLMAdapter` interface + `createAnthropicAdapter(deps)` impl. Pure `fetch`. Retries on 429/5xx with jittered exponential backoff (3 tries). Parses `tool_use` blocks. Exposes `generate({ system, messages, tool, model, maxTokens })`. Verified against Anthropic Messages API current docs via Context7 at implementation time.
- **Voyage `rerank-2.5` extension** in `supabase/functions/_shared/voyage.ts` — new exported function `rerank(query, documents, topK, deps)` calling `https://api.voyageai.com/v1/rerank`. Retries match `embedOnce`'s policy.
- **Module `supabase/functions/_shared/retrieval.ts`** — two helpers:
  - `searchNeighbors(supabase, { userId, noteId, k, rerank? })` — pulls the note's own embedding, queries pgvector for top-50 neighbors **filtered by `user_id = $userId AND source_type = 'note' AND source_id <> $noteId::text`**, optionally reranks via Voyage, returns top-k with `{ id, source_id, score, metadata }`.
  - `searchBible(supabase, { query, k, rerank?, queryEmbedding? })` — embeds the query (or accepts a precomputed vector), queries pgvector for top-50 Bible rows (`user_id IS NULL AND source_type = 'bible_passage'`), optionally reranks against the raw passage text, returns top-k.
  - Both helpers are pure functions of injected `supabase` + `voyage` clients. Service-role caller hits the new RPCs `match_user_note_embeddings` and `match_bible_embeddings` (see §"Database"), which do the pgvector cosine ordering server-side.
- **Module `supabase/functions/_shared/validators.ts`** — two pure functions:
  - `validateCitations(artifact, { allowedNoteIds, allowedVerseRefs })` — walks the structured artifact's `sections[]`; every section must list at least one citation; every cited `verse_ref` must be in `allowedVerseRefs`; every cited `note_id` must be in `allowedNoteIds`. Returns `{ ok, violations: [{section_index, reason}] }`.
  - `applyContentRules(text, rules)` — concatenated text of the artifact (sections + opening + prompt) runs through three rule families: `banned` (prophetic-style regex), `contested` (substring matchers against the contested-passage list), `growth` (streak/missed-day language). Returns `{ ok, violations: [{rule, family, snippet}] }`.
  - `flattenArtifactText(artifact): string` — small helper that concatenates `opening` + every `section.heading` + every `section.body` with `\n\n`, producing the single string `applyContentRules` operates on. Pure; exported for reuse by later artifacts.
  - Both functions deterministic, no external calls, vitest-runnable in Node.
- **Module `supabase/functions/_shared/voice.ts`** — shared system-prompt fragment + canonical rule lists + composition helper. Exports:
  - `LAMPLIGHT_SYSTEM_FRAGMENT: string` — the positive stance. Composed by every artifact's system prompt.
  - `BANNED_PHRASES: RegExp[]` — prophetic/oracular patterns.
  - `CONTESTED_PASSAGES: string[]` — verse refs the system refuses to interpret beyond plain reading (e.g. `Rev 13`, `1 Cor 11:2-16`, `Rom 9` for election; full list in §"Voice fragment").
  - `GROWTH_BANNED_PHRASES: RegExp[]` — streak/effort language.
  - `composeSystem({ base, artifact, voicePreference, stricter }): string` — substitutes `{{voice_preference}}` inside `base`, then joins `base` + `artifact` + (optional) `stricter` with `\n\n`.
- **Edge Function `supabase/functions/lamplight-generate/index.ts`** — single function, single payload shape: `{ kind: 'smoke_test', user_id: string }`. Wires `serviceClient()` + the `_shared` modules. Returns `{ ok, artifact?, violations?, attempts, model_used, prompt_version }`. JWT verification stays on at the platform level (same as `embed-note`); the function additionally requires `user_id` to match a row in `lamplight_settings` with `enabled = true` (else returns 403). The function is not invoked from the React app in this slice — only `supabase functions invoke` from the CLI and from tests.
- **Prompt template `supabase/functions/lamplight-generate/prompts/smoke-test.ts`** — exports `SMOKE_TEST_PROMPT = { promptVersion, system, tool, buildMessages(ctx) }`. The tool schema describes a tiny artifact (`{ opening: string; sections: Array<{ heading: string; body: string; citations: Array<{ type: 'note'|'verse'; ref: string }> }> }` with `minItems: 1` on sections + citations). The system prompt is intentionally generic: "Given the user's recent notes and the retrieved passages, produce a short reflection that surfaces what Scripture says in light of what they have been writing about." It composes `LAMPLIGHT_SYSTEM_FRAGMENT` first.
- **Database migration `012_lamplight_match_rpcs.sql`** — two `STABLE SECURITY DEFINER` RPCs that wrap the pgvector cosine query so the Edge Function isn't constructing SQL strings:
  - `match_user_note_embeddings(p_user_id uuid, p_query_vector vector(1024), p_exclude_source_id text, p_limit int)`
  - `match_bible_embeddings(p_query_vector vector(1024), p_limit int)`
  - Both return `{ id, source_id, similarity, metadata }`. Service-role only; the migration `revoke execute on function … from public, authenticated;`.
- **Tests**:
  - `anthropic.test.ts` — request shape (headers, body, model, system, tool, `tool_choice: { type: 'tool', name }`), tool-use parsing, 429+5xx retry with backoff, hard-fail mapping, malformed-response handling.
  - Extension to `voyage.test.ts` — `rerank()` request shape, response parsing, retry, error mapping.
  - `retrieval.test.ts` — pgvector ordering with rerank off, reranked ordering with rerank on, per-user filter (user A query never returns user B's `source_id`), Bible-search returns only `user_id IS NULL` rows.
  - `validators.test.ts` — every entry in `BANNED_PHRASES` catches a positive sample in present/past/imperative tense; every contested-passage ref triggers; growth-language regex catches "X day streak", "Don't break your streak", "You missed yesterday", "Get back on track"; citation validator passes a golden artifact and fails artifacts with: (a) uncited section, (b) cited verse outside `allowedVerseRefs`, (c) cited note outside `allowedNoteIds`.
  - `voice.test.ts` — the positive stance fragment compiles into a single composable system string; the banned-phrase list and the positive stance never contradict (no banned phrase appears in the positive stance fragment itself).
  - `lamplight-generate/pipeline.test.ts` — happy path (mocked Anthropic returns clean structured output, validators pass, pipeline returns `{ ok: true, artifact }`), validator-fail-then-retry path (first response has uncited section, retry with stricter system suffix, second response passes), hard-fail path (both attempts fail, returns `{ ok: false, violations }`), `no_notes` short-circuit (no Anthropic call), opted-out user precondition (the index.ts handler tests this; pipeline-level tests cover the happy/retry/fail paths against an injected `LLMAdapter` and `ctx`).

### Out

- Any user-facing UI. Lamplight tab continues to render Foundation's placeholder.
- Today's Lamp / Weekly Insight / Connection Cards / Reflections prompt templates and tab content. Later sub-projects.
- Writes to `lamplight_artifacts`. The smoke-test response is returned to the caller, not persisted.
- `LLMAdapter.generateStream()`. Added when inline suggestions ship.
- LLM-classifier doctrinal pass (Layer C). The `applyContentRules` interface leaves a slot (`opts.classifier?: (text: string) => Promise<Violation[]>`) but no implementation lands here.
- Anthropic cost / per-user rate limiting. `max_tokens` is the only cap in this slice.
- Browser code changes. No client-side fetch added; no new hook; no new adapter method on `LamplightAdapter`. The React app does not learn `lamplight-generate` exists in this slice.
- Promotion of the smoke-test prompt to a real artifact. The prompt is throwaway; replacing it is sub-project 4's job.
- Doctrinal review board sign-off. That's sub-project 6 / a separate review artifact (`docs/lamplight/doctrinal-review.md`). The rule lists shipped here are the *input* the board reviews; they are not pre-blessed by this spec.

## Voice fragment — `voice.ts`

### Positive stance — `LAMPLIGHT_SYSTEM_FRAGMENT`

A single string, composed first in every Lamplight system prompt. Verbatim contents:

```
You are Lamplight, a scripture-grounded reflective companion inside a Christian
journaling app. You read what the user has written and what Scripture says, and
you bring the two into conversation.

How you speak:
- Reveal what Scripture itself says, anchored to the user's notes and recurring
  themes. Quote the passage when it helps; cite the reference always.
- Offer interpretation as possibility, not pronouncement. Use phrases like
  "this passage may speak to…", "Scripture suggests…", "for someone walking
  through what you have described, this verse often…".
- Mirror the user's voice for divine names — use "{{voice_preference}}".
- Be warm, brief, and concrete. Cite every claim.

What you never do:
- You never speak prophetically over the user. You do not say "God is telling
  you…", "the Lord is giving you a word…", "God wants you to…", "the Spirit
  is saying…", or any variant. You are not a prophet, oracle, or pastor.
- You never interpret contested passages beyond plain reading. When such a
  passage comes up, name it gently and point them to their pastor or study
  group.
- You never condemn the user's writing. If a note expresses doubt, sin-struggle,
  or anger at God, you respond with Scripture about how God meets that — never
  with rebuke.
- You never give pastoral, mental-health, financial, or medical counsel.
- You never produce streak language, "don't miss a day" prompts, or
  effort-shaming. Growth in this app is measured by Scripture, not consistency.
```

`{{voice_preference}}` is substituted by `buildMessages(ctx)` per artifact.

### `BANNED_PHRASES` (regex list, case-insensitive, word-boundary-aware)

Each entry below is the canonical sample; the actual regex covers tense variants. Tested against present, past, and imperative forms in `validators.test.ts`.

```
/\b(god|jesus|the\s+lord|the\s+spirit|holy\s+spirit)\s+(is|was|has\s+been)\s+telling\s+you\b/i
/\b(god|jesus|the\s+lord)\s+(told|tells|wants?|wanted|is\s+wanting|has\s+wanted)\s+you\s+to\b/i
/\b(god|jesus|the\s+lord)\s+says?\s+to\s+you\b/i
/\b(god|jesus|the\s+lord|the\s+spirit|holy\s+spirit)\s+(is\s+saying|said|has\s+said)\s+to\s+you\b/i
/\b(the\s+lord|god|jesus)\s+is\s+giving\s+you\s+a\s+word\b/i
/\bi\s+sense\s+(god|jesus|the\s+lord|the\s+spirit)\s+(is|wants?|wanted|saying|telling)\b/i
/\b(god|jesus|the\s+lord|the\s+spirit)\s+revealed\s+to\s+you\b/i
/\b(prophesy|prophecy|prophetic\s+word)\s+(over|for)\s+you\b/i
/\b(your\s+destiny|your\s+calling)\s+(is|will\s+be)\b/i   // future-pronouncement guard
```

The list is canonical to `voice.ts`; doctrinal review board can amend it without touching prompts. Sub-project 4 inherits this list verbatim; later slices may extend it.

### `CONTESTED_PASSAGES` (substring matchers, case-insensitive)

Refs the system declines to interpret beyond plain reading. When the artifact text mentions one of these, the validator flags it and the regenerate-once path engages with a stricter suffix instructing the model to name the passage gently and defer.

```
'Revelation 13', 'Revelation 17', 'Daniel 9', 'Daniel 12',
'1 Corinthians 11:2', '1 Corinthians 11:3', '1 Corinthians 11:4',
'1 Corinthians 11:5', '1 Corinthians 11:6', '1 Corinthians 11:7',
'1 Corinthians 14:34', '1 Corinthians 14:35',
'1 Timothy 2:11', '1 Timothy 2:12', '1 Timothy 2:13', '1 Timothy 2:14', '1 Timothy 2:15',
'Romans 9:11', 'Romans 9:12', 'Romans 9:13', 'Romans 9:14', 'Romans 9:15',
'Romans 9:16', 'Romans 9:17', 'Romans 9:18', 'Romans 9:19', 'Romans 9:20',
'Romans 9:21', 'Romans 9:22', 'Romans 9:23',
'Ephesians 1:4', 'Ephesians 1:5',
'Matthew 24', 'Mark 13', '2 Thessalonians 2'
```

The list is small and explicit on purpose; the doctrinal review board will expand or contract it in sub-project 6.

### `GROWTH_BANNED_PHRASES` (regex list, case-insensitive)

```
/\b\d+[-\s]?day\s+streak\b/i
/\bdon'?t\s+break\s+(your\s+)?streak\b/i
/\bkeep\s+(your\s+)?streak\s+(alive|going)\b/i
/\byou\s+missed\s+yesterday\b/i
/\bget\s+back\s+on\s+track\b/i
/\bdaily\s+streak\b/i
```

## `LLMAdapter` — `anthropic.ts`

### Interface

```ts
export type LLMModel = 'sonnet' | 'haiku';

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>; // JSON schema object
}

export interface GenerateInput {
  model: LLMModel;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  tool: ToolSchema;
  maxTokens?: number; // default 2048
}

export interface GenerateOutput<T> {
  parsed: T;                // tool_use.input, typed by the caller
  modelUsed: string;        // e.g. 'claude-sonnet-4-6'
  promptTokens: number;
  completionTokens: number;
}

export interface LLMAdapter {
  generate<T>(input: GenerateInput): Promise<GenerateOutput<T>>;
}
```

### Construction

```ts
export interface AnthropicDeps {
  apiKey: string;
  fetch: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export function createAnthropicAdapter(deps: AnthropicDeps): LLMAdapter;
```

### Request shape (verified at impl time via Context7)

`POST https://api.anthropic.com/v1/messages`

Headers:
- `x-api-key: <apiKey>`
- `anthropic-version: 2023-06-01` (locked at impl time against Context7)
- `content-type: application/json`

Body:
```json
{
  "model": "claude-sonnet-4-6",          // resolved from LLMModel
  "max_tokens": 2048,
  "system": "<composed system string>",
  "messages": [{ "role": "user", "content": "..." }],
  "tools": [{ "name": "...", "description": "...", "input_schema": {...} }],
  "tool_choice": { "type": "tool", "name": "<tool.name>" }
}
```

Response handling:
- 200: locate the `content[]` block with `type: 'tool_use'` matching `name === tool.name`. `parsed = block.input`. If absent → throw (counts as a retryable error inside the adapter only for `5xx`; tool-use absence on `2xx` is a hard fail).
- 429 / 5xx: retry up to 3 times with `500 * 2^attempt + jitter` ms backoff.
- 4xx (not 429): hard fail with status + body slice.

The adapter does not interpret the parsed object — typing is the caller's responsibility via the generic parameter.

### Why direct `fetch` instead of `@anthropic-ai/sdk`

Same reasons `voyage.ts` uses direct `fetch`: the SDK pulls Node-shaped deps that don't import cleanly into Deno. Edge Function runtime is Deno. Tests run in Node with `fetch` injected. One module, three runtimes — keep it framework-free.

## Retrieval helpers — `retrieval.ts`

### Database — migration `012_lamplight_match_rpcs.sql`

Two `STABLE SECURITY DEFINER` RPCs. Service-role only; the migration revokes execute from `public, authenticated`.

```sql
create or replace function match_user_note_embeddings(
  p_user_id uuid,
  p_query_vector vector(1024),
  p_exclude_source_id text,
  p_limit int default 50
)
returns table (
  id uuid,
  source_id text,
  similarity float,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id,
         e.source_id,
         1 - (e.embedding <=> p_query_vector) as similarity,
         e.metadata
    from lamplight_embeddings e
   where e.user_id = p_user_id
     and e.source_type = 'note'
     and (p_exclude_source_id is null or e.source_id <> p_exclude_source_id)
   order by e.embedding <=> p_query_vector
   limit p_limit
$$;

create or replace function match_bible_embeddings(
  p_query_vector vector(1024),
  p_limit int default 50
)
returns table (
  id uuid,
  source_id text,
  similarity float,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id,
         e.source_id,
         1 - (e.embedding <=> p_query_vector) as similarity,
         e.metadata
    from lamplight_embeddings e
   where e.user_id is null
     and e.source_type = 'bible_passage'
   order by e.embedding <=> p_query_vector
   limit p_limit
$$;

revoke execute on function match_user_note_embeddings(uuid, vector(1024), text, int) from public, authenticated;
revoke execute on function match_bible_embeddings(vector(1024), int) from public, authenticated;
```

Cosine similarity uses `1 - (embedding <=> query)` because `<=>` is cosine *distance* in pgvector.

### Helper shapes

```ts
export interface RetrievalDeps {
  supabase: SupabaseClient;
  voyage: VoyageDeps;             // for query embedding + optional rerank
  rerankEnabled: boolean;
}

export interface RetrievedItem {
  id: string;
  source_id: string;
  similarity: number;             // pgvector cosine similarity
  rerank_score?: number;          // present if reranked
  metadata: Record<string, unknown>;
}

export async function searchNeighbors(deps: RetrievalDeps, args: {
  userId: string;
  noteId: string;
  k: number;
}): Promise<RetrievedItem[]>;

export async function searchBible(deps: RetrievalDeps, args: {
  query: string;
  k: number;
  queryEmbedding?: number[];      // optional precomputed; otherwise embedQuery
}): Promise<RetrievedItem[]>;
```

Both helpers:
1. Resolve a query vector:
   - `searchNeighbors`: read the note's existing embedding from `lamplight_embeddings` where `(user_id, source_type='note', source_id=noteId)`. If no row exists (the note hasn't been embedded yet — opted out, fresh note, or queue backlog), return `[]` without error. The caller (sub-project 5 / Connection Cards) is responsible for deciding whether to wait or warm the queue.
   - `searchBible`: call `voyage.embedQuery(query)` unless a precomputed `queryEmbedding` is passed.
2. Call the matching RPC with `limit = rerankEnabled ? 50 : k`.
3. If `rerankEnabled`, fetch the passage text for each candidate (notes via `notes.content` run through `extractTextFromNote`, Bible via `bible_passages.text`), call `voyage.rerank()`, and reorder by `rerank_score` descending.
4. Return top-`k`.

When `rerankEnabled = false`, no rerank fetch, no extra Voyage call — pgvector cosine ordering is final.

### Voyage rerank — `voyage.ts` extension

```ts
const RERANK_BASE = 'https://api.voyageai.com/v1/rerank';
const RERANK_MODEL = 'rerank-2.5';

export interface RerankResult {
  index: number;        // position in the input `documents` array
  score: number;
}

export async function rerank(
  query: string,
  documents: string[],
  topK: number,
  deps: VoyageDeps,
): Promise<RerankResult[]>;
```

Same retry policy (`500 * 2^attempt + jitter`, 3 tries, 429/5xx retryable). Same `deps`-injected `fetch` / `sleep`.

## Validators — `validators.ts`

```ts
export interface ArtifactSection {
  heading: string;
  body: string;
  citations: Array<{ type: 'note' | 'verse'; ref: string }>;
}

export interface SmokeTestArtifact {
  opening: string;
  sections: ArtifactSection[];
}

export interface CitationViolation {
  section_index: number;
  reason: 'no_citations' | 'unknown_note' | 'unknown_verse';
  detail: string;
}

export function validateCitations<T extends { sections: ArtifactSection[] }>(
  artifact: T,
  allowed: { allowedNoteIds: Set<string>; allowedVerseRefs: Set<string> },
): { ok: boolean; violations: CitationViolation[] };

export interface ContentRuleViolation {
  family: 'banned' | 'contested' | 'growth';
  rule: string;          // human-readable rule name (e.g. "prophetic-2pp")
  snippet: string;       // 80-char context around the match
}

export function applyContentRules(text: string, rules: {
  banned: RegExp[];
  contested: string[];
  growth: RegExp[];
  classifier?: (text: string) => Promise<ContentRuleViolation[]>; // Layer C slot, not used yet
}): Promise<{ ok: boolean; violations: ContentRuleViolation[] }>;
```

Both functions are deterministic (modulo the classifier slot, which is unused here). `applyContentRules` is async only to keep the signature stable for when the classifier lands; the synchronous path returns immediately.

## Edge Function — `lamplight-generate/index.ts`

### Payload + response

Request:
```json
{ "kind": "smoke_test", "user_id": "<uuid>" }
```

Response (200):
```json
{
  "ok": true,
  "artifact": { /* SmokeTestArtifact */ },
  "model_used": "claude-sonnet-4-6",
  "prompt_version": "smoke-test-2026-05-26-v1",
  "attempts": 1,
  "retrieval": {
    "note_neighbors": 3,
    "bible_passages": 3,
    "reranked": false
  }
}
```

Response on validator hard-fail (200, `ok: false`):
```json
{
  "ok": false,
  "violations": { "citation": [...], "content": [...] },
  "model_used": "claude-sonnet-4-6",
  "prompt_version": "smoke-test-2026-05-26-v1",
  "attempts": 2
}
```

Response on degenerate input — user is opted in but has no notes with extractable plaintext (200):
```json
{
  "ok": false,
  "reason": "no_notes",
  "prompt_version": "smoke-test-2026-05-26-v1",
  "attempts": 0
}
```

No Anthropic call, no Voyage call, no retry.

Errors:
- 400 — bad payload (missing/invalid `kind` or `user_id`).
- 403 — `lamplight_settings.enabled` is false for that user, or no settings row.
- 500 — `ANTHROPIC_API_KEY` missing, `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` missing, or unhandled exception.

### Pipeline

```ts
serve(async (req) => {
  if (req.method !== 'POST') return jsonResp({ error: 'method' }, 405);
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const voyageKey = Deno.env.get('VOYAGE_AI_KEY');
  if (!anthropicKey) return jsonResp({ error: 'ANTHROPIC_API_KEY missing' }, 500);
  if (!voyageKey)    return jsonResp({ error: 'VOYAGE_AI_KEY missing' }, 500);

  const body = await req.json();
  if (body?.kind !== 'smoke_test' || typeof body.user_id !== 'string') {
    return jsonResp({ error: 'bad payload' }, 400);
  }

  const supabase = serviceClient();
  const optedIn = await isOptedIn(supabase, body.user_id);
  if (!optedIn) return jsonResp({ error: 'not opted in' }, 403);

  const voyageDeps: VoyageDeps = { apiKey: voyageKey, fetch };
  const rerankEnabled = Deno.env.get('RERANK_ENABLED') === 'true';
  const llm = createAnthropicAdapter({ apiKey: anthropicKey, fetch });

  const ctx = await buildSmokeTestContext(supabase, {
    userId: body.user_id,
    voyageDeps,
    rerankEnabled,
  });

  const result = await runSmokeTestPipeline({ llm, ctx });
  return jsonResp(result);
});
```

`runSmokeTestPipeline` wraps the *generate → validate → maybe-regenerate-once → return* sequence; lives in `lamplight-generate/pipeline.ts` so it's unit-testable without the HTTP shell (same pattern as `process-job.ts`).

### `buildSmokeTestContext`

1. Load the user's 5 most-recently-updated notes (via service-role `select`; the function is gated by the opted-in check above).
2. For each note, derive a short string `extractTextFromNote(content).slice(0, 800)`.
3. Pick a "theme query" = the longest plaintext of those (proxy for "most signal"). If no notes (or all notes have empty plaintext after extraction), `buildSmokeTestContext` returns `null` and `runSmokeTestPipeline` short-circuits with the `no_notes` response shape (see §"Edge Function" — Response on degenerate input).
4. `searchBible({ query: themeQuery, k: 3, rerank: rerankEnabled })`.
5. Load `lamplight_settings.voice_preference` (default `'Lord'`) and `tradition_hint` (default `'unspecified'`).
6. Construct `allowedNoteIds = new Set(notes.map(n => n.id))`.
7. Construct `allowedVerseRefs` by joining `bible_passages.book / chapter / verse_start[-verse_end]` for each retrieved passage into the human-readable form the model is instructed to cite — e.g. `'Psalm 23:4'`, `'Romans 8:28-30'`. The smoke-test prompt's tool schema includes a `description` on the `citations[].ref` field telling the model to use exactly this form. The validator does a case-normalized exact match against the set.
8. Return `{ notes: [{id,title,plaintext}], passages: [{source_id, text, ref, metadata}], voicePreference, traditionHint, allowedNoteIds, allowedVerseRefs, rerankUsed }`.

### `runSmokeTestPipeline`

```ts
async function runSmokeTestPipeline({ llm, ctx }: { llm: LLMAdapter; ctx: SmokeTestContext }) {
  const promptVersion = SMOKE_TEST_PROMPT.promptVersion;
  let attempts = 0;
  let lastViolations: { citation: CitationViolation[]; content: ContentRuleViolation[] } | null = null;
  let lastModelUsed = 'claude-sonnet-4-6'; // updated from each response

  for (let attempt = 0; attempt < 2; attempt++) {
    attempts++;
    const system = composeSystem({
      base: LAMPLIGHT_SYSTEM_FRAGMENT,
      artifact: SMOKE_TEST_PROMPT.system,
      voicePreference: ctx.voicePreference,
      stricter: attempt === 1 ? formatStricterSuffix(lastViolations!) : '',
    });
    const { parsed, modelUsed } = await llm.generate<SmokeTestArtifact>({
      model: 'sonnet',
      system,
      messages: SMOKE_TEST_PROMPT.buildMessages(ctx),
      tool: SMOKE_TEST_PROMPT.tool,
      maxTokens: 2048,
    });
    lastModelUsed = modelUsed;

    const citation = validateCitations(parsed, ctx);
    const flat = flattenArtifactText(parsed);
    const content = await applyContentRules(flat, {
      banned: BANNED_PHRASES,
      contested: CONTESTED_PASSAGES,
      growth: GROWTH_BANNED_PHRASES,
    });

    if (citation.ok && content.ok) {
      return {
        ok: true,
        artifact: parsed,
        model_used: modelUsed,
        prompt_version: promptVersion,
        attempts,
        retrieval: { note_neighbors: ctx.notes.length, bible_passages: ctx.passages.length, reranked: ctx.rerankUsed },
      };
    }
    lastViolations = { citation: citation.violations, content: content.violations };
  }

  return {
    ok: false,
    violations: lastViolations,
    model_used: lastModelUsed,   // captured from the last actual response
    prompt_version: promptVersion,
    attempts,
  };
}
```

`formatStricterSuffix(violations)` is a small pure helper that turns the violation list into a short addendum appended to the system prompt — e.g. for an uncited section: *"On retry: every section MUST include at least one entry in citations[]."*

`composeSystem({ base, artifact, voicePreference, stricter })` substitutes the `{{voice_preference}}` token inside `base` with the user's setting, then concatenates `base` + `artifact` + `stricter` with double newlines. The substitution is the single place the token is resolved; no other module touches it. Tested in `voice.test.ts` (token absent → no-op; token present → exact replacement; multiple occurrences all replaced).

## State diagram — a single smoke-test call

```
CLI / test  ──►  supabase functions invoke lamplight-generate { kind:'smoke_test', user_id }
                                       │
                                       ▼
                          opted-in check (lamplight_settings.enabled)
                                       │
                                       ▼
                    buildSmokeTestContext:  load 5 recent notes
                                            embed theme query
                                            searchBible (pgvector [+rerank?])
                                       │
                                       ▼
                       composeSystem (voice fragment + artifact stance)
                                       │
                                       ▼
                          llm.generate (tool-use, Sonnet 4.6)
                                       │
                                       ▼
                       validateCitations  +  applyContentRules
                                       │
                       ┌───────────────┴───────────────┐
                       │                               │
                  both ok                       any violation
                       │                               │
                       ▼                               ▼
                  return ok                  compose stricter suffix
                                                       │
                                                       ▼
                                               retry generate (once)
                                                       │
                                                       ▼
                                              re-run validators
                                                       │
                                       ┌───────────────┴───────────────┐
                                       │                               │
                                  both ok                       still failing
                                       │                               │
                                       ▼                               ▼
                                  return ok                 return { ok:false, violations }
```

## Acceptance criteria

Reasoning Layer is done when every item below holds.

1. Migration `012_lamplight_match_rpcs.sql` runs clean against a fresh Supabase project. Both RPCs callable by service role; revoked from `public, authenticated`.
2. Edge Function `lamplight-generate` deploys via `supabase functions deploy lamplight-generate` and is reachable with a valid service-role JWT. JWT verification stays on (not deployed with `--no-verify-jwt`).
3. Function secrets configured: `supabase secrets set ANTHROPIC_API_KEY=...` and `RERANK_ENABLED=false` (default). Function returns 500 with a clear message if either of `ANTHROPIC_API_KEY` or `VOYAGE_AI_KEY` is missing.
4. `LLMAdapter.generate()` returns the parsed `tool_use.input` for a Sonnet 4.6 call; retries on 429+5xx with jittered exponential backoff; hard-fails on `tool_use` absence; returns `modelUsed`, `promptTokens`, `completionTokens` from the API response.
5. `voyage.rerank()` returns top-K with scores; retries 429+5xx; respects `topK` parameter.
6. `searchNeighbors({ userId: A, noteId, k: 5 })` never returns a row where `user_id ≠ A`. `searchBible(...)` only returns rows where `user_id IS NULL`. Both honor `k` exactly when results are available.
7. With `RERANK_ENABLED=true`, the top-k order from `searchNeighbors` / `searchBible` differs from the pure-pgvector order in at least one of the test fixtures (proving rerank is actually wired and called).
8. `validateCitations` passes a golden artifact with all citations resolvable, and fails the three negative golden artifacts (uncited section / unknown note / unknown verse) with the expected violation shape.
9. `applyContentRules` catches:
   - Every entry in `BANNED_PHRASES` against present, past, and imperative tense fixtures (the voice principle is the load-bearing rule family).
   - Every entry in `CONTESTED_PASSAGES` against an artifact mentioning that ref.
   - Every entry in `GROWTH_BANNED_PHRASES` against streak / "missed yesterday" / "get back on track" fixtures.
10. End-to-end smoke test against a seeded test user (≥3 notes opted in) returns `{ ok: true, artifact, attempts: 1 }` in ≤10s with default settings. The returned artifact has at least 1 section, every section has at least 1 citation, citations resolve to either a note ID in the user's vault or a Bible ref present in `bible_passages`.
11. Validator-fail-then-retry path: when the first Anthropic response is forced (via mock) to return an artifact with an uncited section, the pipeline composes the stricter system suffix and retries once; on second pass it succeeds.
12. Hard-fail path: when both attempts violate, the function returns `{ ok: false, violations }` with both citation and content arrays populated. No exception bubbles up.
13. Opted-out user gets a 403, no Anthropic call made, no Voyage call made, `lamplight_jobs` and `lamplight_embeddings` untouched.
13a. Opted-in user with zero notes (or only empty-plaintext notes) gets a 200 with `{ ok: false, reason: 'no_notes', attempts: 0 }`. No Anthropic call, no Voyage call.
14. `npm run lint`, `tsc -b`, `vitest run`, and `deno test supabase/functions/_shared/*.test.ts supabase/functions/lamplight-generate/**/*.test.ts` all pass. New tests:
    - `_shared/anthropic.test.ts`
    - `_shared/voyage.test.ts` extended with `rerank` cases
    - `_shared/retrieval.test.ts`
    - `_shared/validators.test.ts`
    - `_shared/voice.test.ts`
    - `lamplight-generate/pipeline.test.ts`
15. RLS isolation: extending `rls-isolation.test.ts`, calling `match_user_note_embeddings` as user A's JWT (i.e. without service role) fails with a permission error. The RPC is reachable only via service role.
16. No regression in Foundation or Signal Layer: the four-state tab, profile section toggles, voice/tradition preferences, `deleteAllUserData`, embedding queue / `embed-note` sweep, BSB ingest idempotency — all continue to work. The Lamplight tab continues to render `<OptedInPlaceholder />`.
17. No new client-side code is shipped to the browser. `npm run build` bundle size diff is zero (or rounding-noise).

## Files touched / created

### New files

- `supabase/migrations/012_lamplight_match_rpcs.sql`
- `supabase/functions/lamplight-generate/index.ts`
- `supabase/functions/lamplight-generate/pipeline.ts`
- `supabase/functions/lamplight-generate/pipeline.test.ts`
- `supabase/functions/lamplight-generate/deno.json`
- `supabase/functions/lamplight-generate/prompts/smoke-test.ts`
- `supabase/functions/_shared/anthropic.ts`
- `supabase/functions/_shared/anthropic.test.ts`
- `supabase/functions/_shared/retrieval.ts`
- `supabase/functions/_shared/retrieval.test.ts`
- `supabase/functions/_shared/validators.ts`
- `supabase/functions/_shared/validators.test.ts`
- `supabase/functions/_shared/voice.ts`
- `supabase/functions/_shared/voice.test.ts`

### Modified files

- `supabase/functions/_shared/voyage.ts` — add `rerank()` (no changes to `embedDocuments` / `embedQuery`).
- `supabase/functions/_shared/voyage.test.ts` — add rerank cases.
- `tests/rls-isolation.test.ts` — extend with `match_user_note_embeddings` access checks.
- `.env.local.example` — comment that `ANTHROPIC_API_KEY` is also configured via `supabase secrets set` for Edge Function access; note `RERANK_ENABLED` flag (defaults off).

### Untouched

- All Foundation files. Signal Layer files (`embed-note/`, `process-job.ts`, `tiptap-text.ts`). Migrations 001–011.
- All `src/notepad/**` code. No client-side adapter additions in this slice.
- `lamplight_artifacts` table — exists from Foundation but receives no writes here.

## Open follow-ups (later sub-projects)

1. **Sub-project 4 — Today's Lamp:** Real prompt template (doctrinal-reviewed), real Lamplight tab card, `lamplight_artifacts` persistence on `(user_id, type, period_key)`, the orchestration trigger (button + first-open-of-day cron), the structured-output JSON schema for daily devotions, fallback to Stillwater library on hard validator failure. Sub-project 4 will compose system prompts with `LAMPLIGHT_SYSTEM_FRAGMENT` and inherit the banned/contested/growth lists verbatim.
2. **Layer C — LLM doctrinal classifier:** Implement `applyContentRules`'s `classifier` slot. Haiku 4.5 second-pass that reads the artifact and the rule lists and returns extra violations. Wires in as `await opts.classifier?.(text)` after the regex checks; same violation shape; no API change at callsites.
3. **`generateStream()` adapter extension:** For inline suggestions. Returns `AsyncIterable<{ type: 'text_delta' | 'tool_use_delta' | 'done', ... }>`. Validators won't run mid-stream; they run after `done` against the assembled text.
4. **Cost / rate-limit telemetry:** Per-user counters in a new `lamplight_usage` table — tokens in, tokens out, model, artifact_kind, timestamp. Drives both observability and the eventual paywall (sub-project 6).
5. **Doctrinal review board sign-off** (`docs/lamplight/doctrinal-review.md`): Sub-project 6 / pre-launch artifact. The board reviews `BANNED_PHRASES`, `CONTESTED_PASSAGES`, `LAMPLIGHT_SYSTEM_FRAGMENT`, and the per-artifact prompt templates that will exist by then. Signs in writing.
6. **Reranker A/B:** Sub-project 4 will run with `RERANK_ENABLED=false` initially; once Today's Lamp artifacts are landing, eyeball-A/B the citation quality with rerank on against five real users and decide whether to flip the default.

## Notes for the implementer

- The Anthropic Messages API + tool-use shape (header version, `tool_choice` shape, response `content[]` block types) **must be verified against current Anthropic docs via Context7** at implementation time. The shapes shown above are accurate as of the brief but the SDK and API evolve — Context7 is canonical.
- The Voyage `rerank-2.5` endpoint shape (`POST /v1/rerank`, body `{ query, documents, model, top_k }`) also gets a Context7 verification pass.
- `LAMPLIGHT_SYSTEM_FRAGMENT` is the single source of truth for Lamplight's voice. Every future artifact prompt **composes** from this fragment — never duplicates or rewrites it. If a future artifact needs a stance change, change the fragment, not the artifact prompt.
- The banned-phrase regex list is **load-bearing for product safety**. Every test in `validators.test.ts` for the prophetic-pattern rule MUST exercise present, past, and imperative tense — these are the patterns LLMs default to under loose prompting. If a future regex change drops tense coverage, the corresponding test must fail.
- `applyContentRules` is async even though the current implementation never awaits anything. This is deliberate — the Layer C classifier slot needs an async signature, and stabilizing it now means later callers don't need to update.
- The two new RPCs use `SECURITY DEFINER` and are revoked from `authenticated`. Do not grant execute back to `authenticated` to "make tests easier" — service-role from the Edge Function is the only legitimate caller. RLS isolation depends on this.
- The smoke-test prompt is deliberately unimpressive. Resist the urge to polish it into a Today's Lamp draft; that prompt has to go through doctrinal review in sub-project 4 and shouldn't be pre-empted.
- The Edge Function does **not** persist anything. If you find yourself wanting to write to `lamplight_artifacts`, that's sub-project 4's job.
- `searchNeighbors` excluding `source_id = noteId` is important — without it, the top neighbor is always the note itself (cosine similarity 1.0) and the K=5 neighbors collapse to K=4 useful ones.
- All `_shared/*.ts` modules stay framework-free: no `Deno.env`, no Node-only imports. Edge Function callsites inject env values and `fetch`. Tests inject mocks. The voyage.ts pattern is the canonical one to follow.
