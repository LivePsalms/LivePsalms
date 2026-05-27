# Lamplight — Today's Lamp (Sub-Project 4)

**Status:** Draft (2026-05-27)
**Owner:** Notepad — AI companion feature
**Parent brief:** `Lamplight_AI_details.md` (root)
**Predecessors:** Sub-Project 1 — Foundation (shipped) · Sub-Project 2 — Signal Layer (shipped) · Sub-Project 3 — Reasoning Layer (shipped)
**Companion sub-projects (future):** Connection Cards · Entitlements UI · Doctrinal Review · Weekly Insight · Reflections Recap · Tier Celebration

## Purpose

Reasoning Layer stood up the deterministic citation-first generation pipeline behind a throwaway `kind: 'smoke_test'` payload that returns an artifact but does not persist it. **Today's Lamp is the first user-visible Lamplight artifact.** It adds:

1. A real `daily_devotion` prompt template, structured for doctrinal review and composed on top of `LAMPLIGHT_SYSTEM_FRAGMENT` from `voice.ts`.
2. A new pipeline that runs the same retrieval → generate → validate → maybe-regenerate-once loop, then **persists the artifact to `lamplight_artifacts`** with `unique (user_id, 'daily_devotion', period_key)` enforcing one-per-day idempotency.
3. A new `kind: 'daily_devotion'` dispatch inside the existing `lamplight-generate` Edge Function — alongside the now-deprecated `smoke_test` path, which stays in place for this slice and gets removed in a follow-up cleanup once Today's Lamp is stable.
4. The first user-visible card in the Lamplight tab: `TodaysLampCard` replaces `OptedInPlaceholder`. It auto-generates on first open per local-day, persists, and re-renders the same artifact on subsequent opens that day without another LLM call.
5. Adapter additions on the client (`getDailyDevotion`, `generateDailyDevotion`) plus a fetch-or-generate orchestration hook (`useTodaysLamp`) that drives the card's three states (`loading` / `ready` / `error`).

After this slice ships, an opted-in entitled user who opens the Lamplight tab sees a short, condensed daily devotion — opening, anchor scripture, brief reflection, one open prompt, 1-3 citations to their own notes — generated against their last 3 notes. Read time ~45 seconds. Latency budget ~5-8s with a 3-step progressive loader.

**Still no cron.** Generation is purely client-driven: the React app calls the Edge Function when the card mounts and finds no existing artifact for today's local-date. The cron-based first-open-of-day trigger from `Lamplight_AI_details.md` §8.1 is deferred — sub-project 4 ships the on-demand-from-the-tab MVP the parent brief's locked scope (§"Locked MVP scope") actually calls for.

The slice is sized for ~1 week, one engineer.

## Decisions log

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Trigger | **Auto-generate on first Lamplight tab open per local-day; no manual regenerate on success** | The product feeling is "a quiet companion that's just there when you open the tab" — a button breaks that. Failure UX gets a manual retry. Cross-session "first open of the day" cron is deferred to a later slice. |
| 2 | Local-day source of truth | **Client sends `local_date: 'YYYY-MM-DD'`; server uses verbatim as `period_key`** | Edge Function runs in UTC; we don't store user timezones. Client already knows its own date. Spoofing past dates is harmless: `unique (user_id, type, period_key)` + `on conflict do nothing` means a spoofed past date returns the already-existing artifact, never overwrites. |
| 3 | Hard validator failure | **Return error; no persistence; quiet "Try again" button on the card** | The Stillwater fallback library from the parent brief is its own un-scoped sub-project (curated copy + theme tagger). Failing honestly in MVP gathers real-world failure-rate signal that should inform Stillwater's eventual design. |
| 4 | Artifact shape | **`{ opening, scripture{ref,text}, reflection, prompt, note_citations[] }`** | One anchor scripture passage; 1-3 note citations (graceful floor when the user has fewer matched notes); optional inline verse refs in the reflection body are allowed and validated the same way. |
| 5 | Retrieval scope | **3 most-recent notes by `updated_at desc`; one theme-query embed; `searchBible(theme, k=3)`** | Today's Lamp is the **condensed** in-tab artifact, not the longer weekly version. The parent brief's "last 30 days of notes" sketch is for the future weekly-email artifact. One Voyage call, one Anthropic call (plus retry path). |
| 6 | Word budgets | **opening 20-40 · reflection 80-140 · prompt ≤30 · note_citations.reason ≤15 each** | Total artifact body ≈ 120-200 words. Reads in ~45s. Glanceable. Smaller than the parent brief's daily sketch (40-80 / 180-260) because the brief was written before the "condensed in-app vs. richer weekly email" split. |
| 7 | Persistence | **`lamplight_artifacts` INSERT on success with `on conflict do nothing returning *`; on conflict SELECT existing** | Handles the race where two browser tabs open simultaneously. No client-side optimistic write; the persisted row is the source of truth and is what the function returns. |
| 8 | Smoke-test removal | **Deferred to a cleanup PR after Today's Lamp is stable in production** | The `smoke_test` payload + prompt + pipeline + test file stay in place this slice. Removing them in the same PR couples Today's Lamp's risk to a cleanup that doesn't need to ship together. |
| 9 | Side affordances on the card | **None this slice** | No "Save as Devotion note" (schema supports it via `saved_to_notes`, but the CTA + write path is its own surface). No "How was this written?" panel. No "This wasn't helpful" feedback. All deferred. |
| 10 | Anthropic model | **`sonnet` (claude-sonnet-4-6) via the existing `LLMAdapter`** | Same as the Reasoning Layer's locked choice. Daily devotion is quality-over-latency; Sonnet is correct. |
| 11 | Prompt versioning | **`daily-devotion-2026-05-27-v1`** | Stored on `lamplight_artifacts.prompt_version` per row. Convention from the Reasoning Layer (§Decision 12) carries through. |
| 12 | Progressive loader | **Client-side timed 3-step copy on a 2.5s interval, capped at the last step** | No SSE. The Edge Function returns one HTTP response; the React side cycles the loading copy purely for perceived-latency UX. Steps: "Reading your recent notes…" → "Searching Scripture…" → "Bringing them into conversation…" |
| 13 | OptedInPlaceholder fate | **Deleted** | `TodaysLampCard` replaces it. Voice/tradition preference + "edit preferences" link move to a small footer line on the card. |
| 14 | Doctrinal review board sign-off | **Not blocking this slice** | The prompt template + composed system prompt are produced in a form the board will be able to review in sub-project 6. This slice ships behind the entitlement gate; public launch (and therefore board sign-off) is gated separately. |
| 15 | Edge Function dispatch | **Switch on `body.kind`: `'smoke_test'` → existing pipeline; `'daily_devotion'` → new pipeline** | Both paths share retrieval helpers (`searchBible`), `_shared/voice.ts`, `_shared/validators.ts`, `_shared/anthropic.ts`. Only the prompt + pipeline orchestration + persistence step differ. |

## Scope

### In

- **Prompt template `supabase/functions/lamplight-generate/prompts/daily-devotion.ts`** — exports `DAILY_DEVOTION_PROMPT = { promptVersion, system, tool, buildMessages(ctx) }`. The artifact-specific system prompt; composes under `LAMPLIGHT_SYSTEM_FRAGMENT` via the existing `composeSystem` helper. Tool schema enforces the `DailyDevotion` JSON shape (see §"Artifact shape").
- **Pipeline module `supabase/functions/lamplight-generate/daily-devotion-pipeline.ts`** — exports `runDailyDevotionPipeline({ llm, supabase, ctx })`. Mirrors `runSmokeTestPipeline`'s shape (generate → validate → maybe-regenerate-once → return), with two additions: (a) an **idempotency pre-check** that returns an already-persisted artifact before calling the LLM, and (b) a **persistence step** that INSERTs the validated artifact into `lamplight_artifacts` on success.
- **Edge Function dispatch change in `supabase/functions/lamplight-generate/index.ts`** — switch on `body.kind`:
  - `smoke_test` → existing `runSmokeTestPipeline` (unchanged)
  - `daily_devotion` → new `buildDailyDevotionContext` + `runDailyDevotionPipeline` path
  - any other value → 400.
- **Daily devotion context builder** `buildDailyDevotionContext(supabase, args)` inside `index.ts` (kept colocated with `buildSmokeTestContext` for the same reason: same I/O surface area; service-role data loading; not unit-tested separately since it's a thin Supabase query wrapper).
- **Adapter interface additions** in `src/notepad/storage/lamplight-adapter.ts`:
  - `getDailyDevotion(userId, periodKey): Promise<DailyDevotion | null>`
  - `generateDailyDevotion(userId, localDate): Promise<DailyDevotionResult>`
  - A shared `DailyDevotion` TypeScript type matching the Edge Function's artifact shape (single canonical definition imported by both client and server-side TS where possible — see §"Type sharing" below).
- **`SupabaseLamplightAdapter` implementations** — `.from('lamplight_artifacts')…maybeSingle()` for read; `supabase.functions.invoke('lamplight-generate', { body })` for generate.
- **`FakeLamplightAdapter` implementations** + a tiny in-memory artifact store for tests.
- **Hook `src/notepad/hooks/useTodaysLamp.ts`** — fetch-or-generate orchestration; manages `state`, `loadingStep`, `artifact`, `errorReason`, `retry`. Uses an injected `now()` / `localDate()` for testability.
- **UI components** in `src/notepad/components/lamplight/`:
  - `TodaysLampCard.tsx` — the main artifact card.
  - `TodaysLampLoading.tsx` — centered glyph + cycling copy.
  - `TodaysLampError.tsx` — error message + retry button.
- **Tab panel rewire** in `src/notepad/components/lamplight/LamplightTabPanel.tsx` — replace `OptedInPlaceholder` with `TodaysLampCard`. Pass through `voicePreference` / `traditionHint` for the footer line.
- **Delete `OptedInPlaceholder.tsx`** and its test file. The "edit preferences" link + voice/tradition echo move to `TodaysLampCard`'s footer.
- **Tests**:
  - `daily-devotion-pipeline.test.ts` — happy path (mocked LLM returns valid artifact, persisted), idempotency (second call same `(userId, local_date)` short-circuits to the persisted row, no LLM call), validator-fail-then-retry, hard-fail (no persistence, ok:false returned), `no_notes` short-circuit.
  - `useTodaysLamp.test.tsx` — fetch-existing path, generate-then-render, error → retry, loading-step progression on fake timers, mount/unmount race safety.
  - `TodaysLampCard.test.tsx` — renders all sections including footer (voice/tradition + edit-preferences link), error state, loading state.
  - `TodaysLampLoading.test.tsx` — copy cycles on advancing `loadingStep` prop.
  - `TodaysLampError.test.tsx` — renders both `no_notes` and `validators_failed` / `network` copy variants; retry button is hidden on `no_notes`.
  - Extension of `supabase-lamplight-adapter.test.ts` — round-trip `getDailyDevotion` (existing row + missing row), `generateDailyDevotion` mocked at the `functions.invoke` boundary.
  - Extension of `fake-lamplight-adapter.test.ts` — round-trip both new methods.
  - Extension of `lamplight-rls.test.ts` — user A reading `lamplight_artifacts` cannot see user B's daily devotions (Foundation already enforces this; we add a smoke check with a seeded `daily_devotion` row to confirm the new code-path doesn't accidentally use service-role from the browser).

### Out

- **`pg_cron` scheduled trigger.** No tick function for daily. The card auto-generates only when the user opens the Lamplight tab; cross-session "first open of the day" without the user visiting is deferred to a later slice.
- **"Save as Devotion note" CTA.** The `saved_to_notes` column on `lamplight_artifacts` already exists. Wiring a write-path that turns the artifact into a note in the user's vault is a separate small surface — defer.
- **"How was this written?" panel.** The artifact's `source_note_ids` + `source_verses` + `model_used` are persisted (so future panels can render from them) but no UI in this slice.
- **"This wasn't helpful" feedback button.** No `lamplight_artifact_feedback` table, no negative-signal path. Defer.
- **Stillwater fallback library.** No `lamplight_stillwater` table, no theme-classifier, no hand-curated devotions. Hard-fail returns an error to the client.
- **Removal of the `smoke_test` payload.** Stays in place this slice; cleanup PR after Today's Lamp is stable.
- **Doctrinal review board sign-off.** That's sub-project 6 / pre-launch artifact. The prompt template shipped here is the *input* the board will review.
- **Changes to `_shared/anthropic.ts`, `_shared/voice.ts`, `_shared/validators.ts`, `_shared/retrieval.ts`, `_shared/voyage.ts`.** All inherited verbatim from the Reasoning Layer.
- **New migrations.** `lamplight_artifacts` already has the right schema (Foundation, migration 008). No DB changes.
- **Streaming generation (`generateStream`).** Reasoning Layer noted this lands when inline suggestions ship; same here.
- **Quiet Mode plumbing.** `lamplight_settings.quiet_mode` exists but Today's Lamp ignores it. Quiet Mode primarily gates inline suggestions per the parent brief §7.6; daily devotion is meant to still generate so it's "waiting" when the user comes back.

## Artifact shape

### TypeScript type — single source of truth

A new file `supabase/functions/_shared/artifacts.ts` exports the canonical type so both the pipeline (Deno) and the client adapter (Node/browser via `tsc`) can reference the same definition without duplication:

```ts
// supabase/functions/_shared/artifacts.ts
export interface DailyDevotion {
  opening: string;
  scripture: {
    ref: string;            // e.g. "Psalm 27:13-14"
    text: string;           // full passage text, verbatim from the supplied context
  };
  reflection: string;
  prompt: string;
  note_citations: Array<{
    note_id: string;
    reason: string;         // ≤15-word explanation of why this note shaped the devotion
  }>;
}
```

The client side imports from this file via a TS path alias (or a small re-export shim if path-alias-from-supabase-into-src isn't already wired — see §"Type sharing" notes). The type is intentionally framework-free: no Date objects, no Set, just primitives + arrays + records, so JSON round-tripping is lossless.

### Tool schema (`DAILY_DEVOTION_PROMPT.tool.input_schema`)

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["opening", "scripture", "reflection", "prompt", "note_citations"],
  "properties": {
    "opening": { "type": "string", "minLength": 80, "maxLength": 280 },
    "scripture": {
      "type": "object",
      "additionalProperties": false,
      "required": ["ref", "text"],
      "properties": {
        "ref": {
          "type": "string",
          "description": "Use one of the exact human-readable refs supplied in the user prompt (e.g. \"Psalm 23:4\", \"Romans 8:28-30\"). Do not invent or paraphrase."
        },
        "text": {
          "type": "string",
          "description": "The full passage text. Use the text supplied in the user prompt verbatim."
        }
      }
    },
    "reflection": { "type": "string", "minLength": 400, "maxLength": 900 },
    "prompt": { "type": "string", "minLength": 1, "maxLength": 200 },
    "note_citations": {
      "type": "array",
      "minItems": 1,
      "maxItems": 3,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["note_id", "reason"],
        "properties": {
          "note_id": { "type": "string", "description": "One of the note ids supplied in the user prompt." },
          "reason": { "type": "string", "minLength": 1, "maxLength": 100 }
        }
      }
    }
  }
}
```

Length bounds use byte/character ranges rather than word counts because JSON Schema doesn't have a word-count primitive. The character ranges above translate to roughly the agreed word budgets (20-40 / 80-140 / ≤30 / ≤15) at typical English word length; the system prompt restates the word budgets in human form for the model.

### Validator hookup

`validateCitations` already walks `artifact.sections[]` — the daily devotion shape does not have `sections[]`. Two clean options:

**A. Extend `validateCitations` to handle both shapes.** Add an overload that walks a `DailyDevotion`'s `scripture.ref` + `note_citations[]` + any inline verse refs extracted from `reflection`. Pure, deterministic, no breaking changes to the smoke-test path.

**B. Add a sibling `validateDailyDevotionCitations` in `_shared/validators.ts`.** Same return shape (`{ ok, violations[] }`), same allowed-sets contract. Smoke-test path keeps calling the old function; daily-devotion path calls the new one.

**Choice: B.** Reasons: (1) the smoke-test artifact and daily-devotion artifact are genuinely different shapes; an overload that internally branches becomes type-gymnastics. (2) Sibling functions read cleaner and are easier to evolve independently when sub-project 5 adds Connection Cards with yet another shape. (3) The shared violation type + allowed-sets contract is the actual reuse — keep that; don't conflate the shape walker.

The new function:

```ts
// supabase/functions/_shared/validators.ts (addition)
export function validateDailyDevotionCitations(
  artifact: DailyDevotion,
  allowed: { allowedNoteIds: Set<string>; allowedVerseRefs: Set<string> },
): { ok: boolean; violations: CitationViolation[] };
```

Rules enforced:
- `artifact.scripture.ref` must be in `allowedVerseRefs` (case-normalized exact match).
- Every `note_citations[i].note_id` must be in `allowedNoteIds`.
- `note_citations.length >= 1` (validator floor; the JSON schema's `minItems: 1` is the first line of defense, the validator is a belt-and-suspenders check).
- Any verse ref appearing inline in `reflection` text (matched by the existing reference parser, if applied — see implementation note) must be in `allowedVerseRefs`. **Optional rule:** keep this off in MVP and document it in the open follow-ups. The model is told to use only supplied refs; if it slips in `"In Psalm 23 the shepherd…"` inline that isn't in the supplied set, that's a soft violation we can decide to harden later. **Choice for MVP: do NOT extract inline refs from `reflection`. Validate only `scripture.ref` + `note_citations[].note_id`.** This is consistent with the smoke-test approach (which only validates the structured `citations[]` field, not inline mentions).

`flattenArtifactText` gets a sibling `flattenDailyDevotionText(artifact)` that concatenates `opening + '\n\n' + scripture.text + '\n\n' + reflection + '\n\n' + prompt` for `applyContentRules`. Note: `scripture.text` IS included in the flattened text passed to content rules. This is deliberate — if a banned phrase ends up in the scripture quote field somehow (model fabrication of a passage with prophetic-style language), we want the content-rule pass to catch it. The Bible passages in `bible_passages` will not actually contain `BANNED_PHRASES` matches, so this only fires on model fabrication.

## Prompt template — `daily-devotion.ts`

### Module shape

```ts
// supabase/functions/lamplight-generate/prompts/daily-devotion.ts
import type { DailyDevotionContext } from '../daily-devotion-pipeline.ts';

export const DAILY_DEVOTION_PROMPT = {
  promptVersion: 'daily-devotion-2026-05-27-v1',
  system: /* see §"System prompt" below */,
  tool: {
    name: 'emit_daily_devotion',
    description: 'Return the daily devotion artifact JSON.',
    input_schema: /* see §"Tool schema" above */,
  },
  buildMessages(ctx: DailyDevotionContext): Array<{ role: 'user'; content: string }> {
    /* concatenates notes + passages + voice/tradition/local_date */
  },
} as const;
```

### System prompt (composed under `LAMPLIGHT_SYSTEM_FRAGMENT`)

```
Write a brief daily devotion for someone who has been journaling. The user has
shared 3 recent notes (or fewer, if their vault is small). You have 3 candidate
Scripture passages. Write something glanceable — they will read this in under a
minute.

Structure:
- opening (20-40 words): a quiet greeting that names one thread from the user's
  notes obliquely. Do not summarise their notes; do not quote them verbatim. The
  opening orients them — it does not narrate them back to themselves.
- scripture: pick ONE anchor passage from the candidates supplied. Use the exact
  ref string from the user prompt. Use the exact passage text from the user
  prompt — do not paraphrase, do not abbreviate, do not invent.
- reflection (80-140 words): bring the passage into conversation with what the
  user has written. Offer interpretation as possibility, not pronouncement.
  Phrases like "this passage may speak to…", "Scripture suggests…", "for someone
  walking through what you have described, this verse often…" are the register.
- prompt: one open question to sit with, ≤30 words. Not advice. Not a directive.
  An invitation.
- note_citations: 1 to 3 entries, each naming a specific note id from the user
  prompt and a ≤15-word reason explaining what recurrence or theme drew you to
  it. Cite the notes that actually shaped your reflection.

Hard rules (these compound the rules in your system fragment):
- Cite every Scripture reference using the exact form supplied in the user
  prompt. Do not invent refs.
- Quote no more than 25 words verbatim from any note.
- If you cannot ground a sentence in the supplied notes or supplied passages, do
  not write it.
- Today is {{local_date}}. Do not refer to other dates.
```

### `buildMessages(ctx)`

```ts
buildMessages(ctx) {
  const notesBlock = ctx.notes
    .map(n => `[note id=${n.id}] ${n.title}\n${n.plaintext}`)
    .join('\n\n');
  const passagesBlock = ctx.passages
    .map(p => `[${p.ref}]\n${p.text}`)
    .join('\n\n');
  const refsList = [...ctx.allowedVerseRefs].join(', ');
  const noteIdsList = [...ctx.allowedNoteIds].join(', ');
  return [{
    role: 'user',
    content:
      `Today is ${ctx.localDate}. User voice preference: "${ctx.voicePreference}". ` +
      `User tradition hint: "${ctx.traditionHint}".\n\n` +
      `User's recent notes:\n${notesBlock}\n\n` +
      `Candidate Scripture passages:\n${passagesBlock}\n\n` +
      `Cite Scripture using exactly one of: ${refsList}. ` +
      `Cite notes using exactly one of: ${noteIdsList}.\n\n` +
      `Write the devotion now.`,
  }];
}
```

`{{local_date}}` substitution in the system string is handled by `composeSystem`'s `voicePreference` mechanism extended to also substitute `localDate` — or, simpler, the system string includes the literal `{{local_date}}` token and the artifact-specific layer in `composeSystem` does the substitution. **Choice: extend `composeSystem` to take an optional `tokens: Record<string, string>` parameter and replace all `{{key}}` tokens before concatenation.** This keeps the substitution mechanism in one place (`voice.ts`) and avoids per-artifact substitution code drift. Backward compatible: smoke-test path keeps passing just `voicePreference` (which becomes `tokens: { voice_preference: voicePreference }` under the hood).

### `composeSystem` extension

```ts
// supabase/functions/_shared/voice.ts (modification)
export function composeSystem(args: {
  base: string;
  artifact: string;
  voicePreference: string;
  stricter?: string;
  tokens?: Record<string, string>;  // NEW: extra {{key}} replacements applied to base + artifact
}): string;
```

`{{voice_preference}}` continues to be substituted from `voicePreference` for backward compatibility. New tokens (`{{local_date}}`, future `{{tradition_hint}}` if needed) flow through `tokens`. The substitution loop is the single place tokens are resolved.

## Pipeline — `daily-devotion-pipeline.ts`

### Context type

```ts
export interface DailyDevotionContext {
  notes: Array<{ id: string; title: string; plaintext: string }>;
  passages: Array<{ source_id: string; text: string; ref: string; metadata: Record<string, unknown> }>;
  voicePreference: string;
  traditionHint: string;
  localDate: string;            // YYYY-MM-DD, from the request payload
  allowedNoteIds: Set<string>;
  allowedVerseRefs: Set<string>;
  rerankUsed: boolean;
}
```

### Result type

```ts
export type DailyDevotionPipelineResult =
  | {
      ok: true;
      artifact: DailyDevotion;
      artifact_id: string;        // lamplight_artifacts.id (after persist)
      model_used: string;
      prompt_version: string;
      attempts: number;
      cached: boolean;            // true when idempotency pre-check hit
      retrieval?: { note_neighbors: number; bible_passages: number; reranked: boolean };
    }
  | {
      ok: false;
      reason: 'no_notes' | 'validators_failed';
      violations?: { citation: CitationViolation[]; content: ContentRuleViolation[] };
      model_used?: string;
      prompt_version: string;
      attempts: number;
    };
```

`cached: true` cases omit `retrieval` (no retrieval was done — we short-circuited at the idempotency pre-check). Clients should treat `cached: true | false` as transparent — the artifact is the artifact either way.

### Pipeline function

```ts
export async function runDailyDevotionPipeline(args: {
  llm: LLMAdapter;
  supabase: SupabaseClient;
  ctx: DailyDevotionContext | null;
  userId: string;
  localDate: string;
}): Promise<DailyDevotionPipelineResult> {
  const promptVersion = DAILY_DEVOTION_PROMPT.promptVersion;

  // 1. Idempotency pre-check — before retrieval, before LLM.
  const existing = await args.supabase
    .from('lamplight_artifacts')
    .select('id, body, model_used, prompt_version')
    .eq('user_id', args.userId)
    .eq('type', 'daily_devotion')
    .eq('period_key', args.localDate)
    .maybeSingle();
  if (existing.data) {
    return {
      ok: true,
      artifact: existing.data.body as DailyDevotion,
      artifact_id: existing.data.id,
      model_used: existing.data.model_used,
      prompt_version: existing.data.prompt_version,
      attempts: 0,
      cached: true,
    };
  }

  // 2. no_notes short-circuit.
  if (!args.ctx) {
    return { ok: false, reason: 'no_notes', prompt_version: promptVersion, attempts: 0 };
  }
  const ctx = args.ctx;

  // 3. Generate → validate → maybe-regenerate-once. Same shape as smoke-test pipeline.
  let attempts = 0;
  let lastViolations: { citation: CitationViolation[]; content: ContentRuleViolation[] } | null = null;
  let lastModelUsed = 'claude-sonnet-4-6';

  for (let attempt = 0; attempt < 2; attempt++) {
    attempts++;
    const stricter = attempt === 0 ? '' : formatStricterSuffix(lastViolations!);
    const system = composeSystem({
      base: LAMPLIGHT_SYSTEM_FRAGMENT,
      artifact: DAILY_DEVOTION_PROMPT.system,
      voicePreference: ctx.voicePreference,
      stricter,
      tokens: { local_date: ctx.localDate },
    });

    const { parsed, modelUsed } = await args.llm.generate<DailyDevotion>({
      model: 'sonnet',
      system,
      messages: DAILY_DEVOTION_PROMPT.buildMessages(ctx),
      tool: DAILY_DEVOTION_PROMPT.tool,
      maxTokens: 2048,
    });
    lastModelUsed = modelUsed;

    const citation = validateDailyDevotionCitations(parsed, {
      allowedNoteIds: ctx.allowedNoteIds,
      allowedVerseRefs: ctx.allowedVerseRefs,
    });
    const flat = flattenDailyDevotionText(parsed);
    const content = await applyContentRules(flat, {
      banned: BANNED_PHRASES,
      contested: CONTESTED_PASSAGES,
      growth: GROWTH_BANNED_PHRASES,
    });

    if (citation.ok && content.ok) {
      // 4. Persist.
      const sourceNoteIds = parsed.note_citations.map(c => c.note_id);
      const sourceVerses = [parsed.scripture.ref];
      const insertRes = await args.supabase
        .from('lamplight_artifacts')
        .insert({
          user_id: args.userId,
          type: 'daily_devotion',
          period_key: args.localDate,
          title: '',                  // unused for daily; reserved for future weekly insight titles
          body: parsed,
          source_note_ids: sourceNoteIds,
          source_verses: sourceVerses,
          model_used: modelUsed,
          prompt_version: promptVersion,
        })
        .select('id')
        .single();

      if (insertRes.error) {
        // Race: another request inserted between our pre-check and now. Re-read and return it.
        const refetch = await args.supabase
          .from('lamplight_artifacts')
          .select('id, body, model_used, prompt_version')
          .eq('user_id', args.userId)
          .eq('type', 'daily_devotion')
          .eq('period_key', args.localDate)
          .single();
        if (refetch.error) throw refetch.error;
        return {
          ok: true,
          artifact: refetch.data.body as DailyDevotion,
          artifact_id: refetch.data.id,
          model_used: refetch.data.model_used,
          prompt_version: refetch.data.prompt_version,
          attempts,
          cached: true,
        };
      }

      return {
        ok: true,
        artifact: parsed,
        artifact_id: insertRes.data.id,
        model_used: modelUsed,
        prompt_version: promptVersion,
        attempts,
        cached: false,
        retrieval: {
          note_neighbors: ctx.notes.length,
          bible_passages: ctx.passages.length,
          reranked: ctx.rerankUsed,
        },
      };
    }
    lastViolations = { citation: citation.violations, content: content.violations };
  }

  // 5. Hard fail — no persistence, no Stillwater fallback.
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

`formatStricterSuffix` is identical to the smoke-test pipeline's helper; it can be promoted to `_shared/pipeline-helpers.ts` for reuse, OR each pipeline can keep a local copy. **Choice: keep a local copy for now.** Single function, 30 lines, no semantic difference between the two pipelines yet. Promote to `_shared` only if a third caller needs it.

`flattenDailyDevotionText` lives in `_shared/validators.ts` alongside `flattenArtifactText` (used by smoke-test).

## Edge Function dispatch

### `index.ts` modifications

```ts
serve(async (req) => {
  // ... existing env + body parsing ...

  if (!body.kind || typeof body.user_id !== 'string') {
    return jsonResp({ error: 'bad payload' }, 400);
  }

  const supabase = serviceClient();
  // ... existing opted-in check (unchanged) ...

  if (body.kind === 'smoke_test') {
    // ... existing smoke-test path, untouched ...
  }

  if (body.kind === 'daily_devotion') {
    if (typeof body.local_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.local_date)) {
      return jsonResp({ error: 'bad local_date' }, 400);
    }
    const ctx = await buildDailyDevotionContext(supabase, {
      userId: body.user_id,
      localDate: body.local_date,
      voicePreference: (settings.voice_preference as string) ?? 'Lord',
      traditionHint: (settings.tradition_hint as string) ?? 'unspecified',
      voyageDeps,
      rerankEnabled,
    });
    const result = await runDailyDevotionPipeline({
      llm,
      supabase,
      ctx,
      userId: body.user_id,
      localDate: body.local_date,
    });
    return jsonResp(result);
  }

  return jsonResp({ error: 'unknown kind' }, 400);
});
```

### `buildDailyDevotionContext`

```ts
async function buildDailyDevotionContext(
  supabase: SupabaseClient,
  args: { userId: string; localDate: string; voicePreference: string; traditionHint: string; voyageDeps: VoyageDeps; rerankEnabled: boolean },
): Promise<DailyDevotionContext | null> {
  // 1. Load 3 most-recent notes.
  const { data: noteRows, error: nErr } = await supabase
    .from('notes')
    .select('id, title, content, updated_at')
    .eq('user_id', args.userId)
    .order('updated_at', { ascending: false })
    .limit(3);
  if (nErr) throw nErr;

  // 2. Extract plaintext; drop empties.
  const notes = (noteRows ?? [])
    .map(n => ({
      id: n.id as string,
      title: ((n.title as string) ?? '').trim() || '(untitled)',
      plaintext: extractTextFromNoteContent(n.content as string).slice(0, 800),
    }))
    .filter(n => n.plaintext.trim().length > 0);
  if (notes.length === 0) return null;

  // 3. Theme query: titles + 200-char snippets, capped at 4000 chars to keep one embed budget.
  const themeQuery = notes
    .map(n => `${n.title}: ${n.plaintext.slice(0, 200)}`)
    .join('\n\n')
    .slice(0, 4000);
  const queryEmbedding = await embedQuery(themeQuery, args.voyageDeps);

  // 4. searchBible(theme, k=3).
  const retrievedBible = await searchBible(
    { supabase, voyage: args.voyageDeps, rerankEnabled: args.rerankEnabled },
    { query: themeQuery, k: 3, queryEmbedding },
  );

  // 5. Hydrate passage text + build refs (same code path as smoke-test).
  const sourceIds = retrievedBible.map(r => r.source_id);
  const { data: passageRows, error: pErr } = await supabase
    .from('bible_passages')
    .select('id, book, chapter, verse_start, verse_end, text')
    .in('id', sourceIds);
  if (pErr) throw pErr;
  const passageById = new Map<string, { book: string; chapter: number; verse_start: number; verse_end: number; text: string }>();
  for (const row of (passageRows ?? [])) {
    passageById.set(row.id as string, {
      book: row.book as string,
      chapter: row.chapter as number,
      verse_start: row.verse_start as number,
      verse_end: row.verse_end as number,
      text: row.text as string,
    });
  }
  const passages = retrievedBible
    .map(r => {
      const p = passageById.get(r.source_id);
      if (!p) return null;
      const refSuffix = p.verse_end !== p.verse_start ? `${p.verse_start}-${p.verse_end}` : `${p.verse_start}`;
      const ref = `${p.book} ${p.chapter}:${refSuffix}`;
      return {
        source_id: r.source_id,
        text: p.text,
        ref,
        metadata: { book: p.book, chapter: p.chapter, similarity: r.similarity, rerank_score: r.rerank_score },
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    notes,
    passages,
    voicePreference: args.voicePreference,
    traditionHint: args.traditionHint,
    localDate: args.localDate,
    allowedNoteIds: new Set(notes.map(n => n.id)),
    allowedVerseRefs: new Set(passages.map(p => p.ref)),
    rerankUsed: args.rerankEnabled && passages.length > 0,
  };
}
```

The passage-hydration block is structurally identical to `buildSmokeTestContext`'s. **Refactor opportunity — out of slice:** extract `hydrateBiblePassages(supabase, retrievedBible)` into `_shared/retrieval.ts` so both context builders share one implementation. Deferred to a follow-up cleanup PR; not blocking Today's Lamp.

## Adapter additions

### Type sharing — server ↔ client

`supabase/functions/_shared/artifacts.ts` defines `DailyDevotion`. The Edge Function imports it directly. The client side has two options:

**A. TypeScript path alias** in `tsconfig.json` (e.g. `"@artifacts/*": ["supabase/functions/_shared/artifacts.ts"]`) so the React code can `import type { DailyDevotion } from '@artifacts/artifacts'`. Risk: bundler must not pull anything else from the supabase tree.

**B. Re-export shim** at `src/notepad/storage/lamplight-artifacts.ts` that imports the type from the supabase file and re-exports it. Lower-risk; the supabase file stays the canonical source.

**Choice: B.** Lower-risk, no tsconfig surgery, no bundler-config drama. The shim is one line: `export type { DailyDevotion } from '../../../supabase/functions/_shared/artifacts.ts';`. Type-only import; no runtime dependency added to the client bundle. If the relative path is awkward, a Vite path alias is a one-line config change; the shim remains.

### Interface

```ts
// src/notepad/storage/lamplight-adapter.ts (additions)
import type { DailyDevotion } from './lamplight-artifacts';

export type DailyDevotionGenerateResult =
  | { ok: true; artifact: DailyDevotion; cached: boolean }
  | { ok: false; reason: 'no_notes' | 'validators_failed' | 'network' };

export interface LamplightAdapter {
  // ... existing methods unchanged ...

  /** Returns the persisted daily devotion for (userId, periodKey) if it exists, else null.
   *  periodKey is the client-supplied YYYY-MM-DD local date string. */
  getDailyDevotion(userId: string, periodKey: string): Promise<DailyDevotion | null>;

  /** Invokes lamplight-generate Edge Function with kind='daily_devotion'.
   *  Returns the persisted artifact on success, or a typed reason on failure.
   *  `network` reason covers any error thrown by functions.invoke before the
   *  function ran (timeout, transport, 5xx). `no_notes` and `validators_failed`
   *  are returned by the function itself as { ok: false }. */
  generateDailyDevotion(userId: string, localDate: string): Promise<DailyDevotionGenerateResult>;
}
```

### `SupabaseLamplightAdapter` impl

```ts
async getDailyDevotion(userId: string, periodKey: string): Promise<DailyDevotion | null> {
  const { data, error } = await this.#client
    .from('lamplight_artifacts')
    .select('body')
    .eq('user_id', userId)
    .eq('type', 'daily_devotion')
    .eq('period_key', periodKey)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.body as DailyDevotion) : null;
}

async generateDailyDevotion(userId: string, localDate: string): Promise<DailyDevotionGenerateResult> {
  try {
    const { data, error } = await this.#client.functions.invoke('lamplight-generate', {
      body: { kind: 'daily_devotion', user_id: userId, local_date: localDate },
    });
    if (error) return { ok: false, reason: 'network' };
    if (!data || typeof data !== 'object') return { ok: false, reason: 'network' };
    if (data.ok === true && data.artifact) {
      return { ok: true, artifact: data.artifact as DailyDevotion, cached: !!data.cached };
    }
    if (data.ok === false && (data.reason === 'no_notes' || data.reason === 'validators_failed')) {
      return { ok: false, reason: data.reason };
    }
    return { ok: false, reason: 'network' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}
```

The map from "function returned `ok: false` with a known reason" → typed reason at the adapter layer means the React hook never has to know the wire format; it just inspects `result.ok` + `result.reason`.

### `FakeLamplightAdapter` impl

The fake adapter gains an in-memory `Map<string, DailyDevotion>` keyed on `${userId}:${periodKey}`, plus an optional `__seedDailyDevotion(userId, periodKey, artifact)` test helper and an optional `__failNextGenerate(reason)` toggle so tests can drive each branch. Same testing-affordance pattern Foundation already established.

## Hook — `useTodaysLamp.ts`

### Contract

```ts
export type TodaysLampState =
  | { phase: 'loading'; loadingStep: 0 | 1 | 2 }
  | { phase: 'ready'; artifact: DailyDevotion }
  | { phase: 'error'; reason: 'no_notes' | 'validators_failed' | 'network' };

export interface UseTodaysLampArgs {
  adapter: LamplightAdapter;
  userId: string;
  localDate: string;             // YYYY-MM-DD, injected for testability
  loadingStepIntervalMs?: number; // default 2500
}

export interface UseTodaysLampResult {
  state: TodaysLampState;
  retry: () => void;             // re-runs the fetch-or-generate flow
}

export function useTodaysLamp(args: UseTodaysLampArgs): UseTodaysLampResult;
```

### Flow

1. On mount (or `retry`), set `state = { phase: 'loading', loadingStep: 0 }`.
2. Start a setInterval that advances `loadingStep` from 0 → 1 → 2 every `loadingStepIntervalMs`, capped at 2.
3. Call `adapter.getDailyDevotion(userId, localDate)`:
   - If returns an artifact → clear interval; `state = { phase: 'ready', artifact }`. Done.
   - If returns null → call `adapter.generateDailyDevotion(userId, localDate)`:
     - `{ ok: true, artifact }` → clear interval; `state = { phase: 'ready', artifact }`.
     - `{ ok: false, reason }` → clear interval; `state = { phase: 'error', reason }`.
4. `retry` re-runs step 1.

### Concurrency safety

- A `cancelledRef` flips on unmount; any pending promise resolution checks it before `setState`.
- `retry` cancels any in-flight request (by re-incrementing a generation counter; only the latest counter's resolutions write to state).
- The `localDate` arg changes only on date rollover (caller's responsibility) — when it does, `useEffect` re-runs the flow.

### Why a date is injected, not derived

Pure testability. Tests pass `'2026-05-27'` directly; production callsites pass `new Date().toLocaleDateString('en-CA')` (which yields `YYYY-MM-DD` reliably in browser environments and respects the user's local clock). The hook itself has no date logic.

## UI — `TodaysLampCard`

### Visual structure

```
┌────────────────────────────────────────────────────┐
│ 🕯  Today · May 27                                 │ ← top row (Outfit, small, --silica)
│                                                    │
│ {opening paragraph}                                │ ← Outfit 14px, --deep-umber
│                                                    │
│ ─── {ref e.g. Psalm 27:13-14} ────────────────     │ ← divider with ref label (Outfit, small)
│ {scripture.text}                                   │ ← Cormorant Garamond 18px serif, italic
│                                                    │
│ {reflection paragraph}                             │ ← Outfit 14px
│                                                    │
│ {prompt}                                           │ ← Outfit 14px italic, indented
│                                                    │
│ ─────────────────────────────────────────────────  │
│ Drawing from your notes about:                     │ ← Outfit 11px --silica
│ • {note_citations[0].reason}                       │
│ • {note_citations[1].reason}                       │
│ • {note_citations[2].reason}                       │
│                                                    │
│ Voice: Lord · Tradition: unspecified · Edit prefs →│ ← Outfit 11px footer
└────────────────────────────────────────────────────┘
```

Color tokens: `--alabaster` (card bg, matches Foundation), `--deep-umber` (primary text), `--silica` (secondary text), `--pale-stone` (divider). Fonts: Cormorant Garamond for scripture, Outfit for everything else. Matches the existing Foundation cards (Consent, OptedOut) exactly — no new tokens, no new fonts.

### Component tree

```
TodaysLampCard
├── Header (timestamp + glyph)
├── Opening (paragraph)
├── ScriptureBlock (ref label + serif passage)
├── Reflection (paragraph)
├── Prompt (italic indented)
├── CitationsBlock (heading + bulleted reasons)
└── Footer (voice/tradition + edit-prefs link)
```

All sub-elements are inline in the same file — no new files per sub-block. The card is the unit; splitting further is premature.

### `TodaysLampLoading.tsx`

Single component, three copy lines cycled by the `loadingStep` prop:

```tsx
const LOADING_COPY = [
  'Reading your recent notes…',
  'Searching Scripture…',
  'Bringing them into conversation…',
];

export function TodaysLampLoading({ step }: { step: 0 | 1 | 2 }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] px-6 text-center"
         style={{ background: 'var(--alabaster)' }}>
      <div className="text-3xl mb-3 animate-pulse" aria-hidden>🕯</div>
      <p className="text-xs"
         style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
         role="status" aria-live="polite">
        {LOADING_COPY[step]}
      </p>
    </div>
  );
}
```

`animate-pulse` is the only animation; matches the Foundation loading state's tonal restraint.

### `TodaysLampError.tsx`

```tsx
export function TodaysLampError({
  reason,
  onRetry,
}: {
  reason: 'no_notes' | 'validators_failed' | 'network';
  onRetry: () => void;
}) {
  const copy = ERROR_COPY[reason];
  const showRetry = reason !== 'no_notes';
  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] px-6 text-center"
         style={{ background: 'var(--alabaster)' }}>
      <div className="text-3xl mb-3" aria-hidden>🕯</div>
      <h3 className="text-base mb-2"
          style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}>
        {copy.heading}
      </h3>
      <p className="text-xs mb-4 max-w-[320px]"
         style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
        {copy.body}
      </p>
      {showRetry && (
        <button onClick={onRetry}
                className="text-[11px] underline cursor-pointer"
                style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
          Try again
        </button>
      )}
    </div>
  );
}

const ERROR_COPY = {
  no_notes: {
    heading: 'Lamplight needs your notes to begin.',
    body: 'Write a few entries in the notepad and come back. Today\'s lamp draws from what you\'ve been writing.',
  },
  validators_failed: {
    heading: 'Lamplight had trouble lighting today.',
    body: 'Something didn\'t come together this time. Try again in a moment.',
  },
  network: {
    heading: 'Couldn\'t reach Lamplight just now.',
    body: 'Check your connection and try again.',
  },
} as const;
```

Three reasons, three copy variants, one shared visual shell. The `no_notes` variant hides the retry button (retrying won't help — the user needs to write notes first).

### `LamplightTabPanel.tsx` rewire

```tsx
// in the opted-in + entitled branch:
const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the user's timezone

return (
  <TodaysLampCard
    adapter={lamplightAdapter}
    userId={user.id}
    localDate={today}
    voicePreference={settingsState.settings.voicePreference}
    traditionHint={settingsState.settings.traditionHint}
  />
);
```

`OptedInPlaceholder` import is removed. `TodaysLampCard` internally uses `useTodaysLamp` and renders one of `TodaysLampLoading` / `TodaysLampError` / the artifact view based on state.

## State diagram — opening the Lamplight tab

```
                      User opens Lamplight tab
                                │
                                ▼
            <LamplightTabPanel> resolves to opted-in + entitled
                                │
                                ▼
                <TodaysLampCard> mounts, useTodaysLamp fires
                                │
                                ▼
                   getDailyDevotion(userId, today)
                                │
                ┌───────────────┴────────────────┐
                │                                │
        existing row found              null returned
                │                                │
                ▼                                ▼
        state: ready                  generateDailyDevotion(userId, today)
        render artifact                          │
                                                 ▼
                                     Edge Function dispatch on kind
                                                 │
                                                 ▼
                                  buildDailyDevotionContext
                                                 │
                                ┌────────────────┴────────────────┐
                                │                                 │
                          notes present                       0 notes
                                │                                 │
                                ▼                                 ▼
                runDailyDevotionPipeline                    return no_notes
                                │                                 │
                                ▼                                 ▼
                  pre-check lamplight_artifacts         state: error (no_notes)
                                │                       no retry button
                  ┌─────────────┴─────────────┐
                  │                           │
                  cached row                  none
                  │                           │
                  ▼                           ▼
            return cached         compose + generate + validate
                                              │
                                  ┌───────────┴───────────┐
                                  │                       │
                              ok                     violations
                                  │                       │
                                  ▼                       ▼
                            INSERT row              regenerate once
                            return artifact               │
                                            ┌─────────────┴─────────────┐
                                            │                           │
                                          ok                       still failing
                                            │                           │
                                            ▼                           ▼
                                    INSERT row              return validators_failed
                                    return artifact               │
                                                                  ▼
                                                state: error (validators_failed)
                                                retry button visible
```

## Acceptance criteria

Today's Lamp is done when every item below holds.

1. The `lamplight-generate` Edge Function dispatches on `body.kind`. `smoke_test` continues to work unchanged (existing tests pass). `daily_devotion` runs the new pipeline. Unknown values return 400.
2. The function validates `body.local_date` matches `YYYY-MM-DD`. Other shapes return 400.
3. Opted-out user (`lamplight_settings.enabled = false`) gets 403 on either `kind`. No retrieval, no LLM call, no embedding.
4. **Happy path:** an opted-in user with ≥1 recent note opens the Lamplight tab. Within ~5-8 seconds the card renders a daily devotion with: an opening, an anchor scripture passage whose `ref` exists in `bible_passages`, a reflection, a prompt, and 1-3 note citations whose `note_id` values exist in `notes` and belong to the same user.
5. **Idempotency:** opening the tab a second time the same local-day reads from `lamplight_artifacts` directly. No LLM call is made. The same artifact renders. The Edge Function returns `cached: true`.
6. **Race:** if two requests arrive concurrently for the same `(user_id, local_date)`, exactly one INSERT succeeds; the other receives the existing row via the re-read fallback. Both callers see `ok: true` with the same `artifact_id`.
7. **`no_notes`:** an opted-in user with zero notes (or only empty-plaintext notes) sees the `no_notes` error card. No retry button. No LLM call was made. Nothing persisted.
8. **Validator-fail-then-retry:** when the first Anthropic response (forced via mock) returns an artifact with an unknown verse ref OR a `note_id` outside `allowedNoteIds`, the pipeline composes the stricter system suffix and retries once. Second pass succeeds; artifact persists.
9. **Hard fail:** when both attempts violate, the function returns `{ ok: false, reason: 'validators_failed', attempts: 2 }`. No `lamplight_artifacts` row is written. The card renders the `validators_failed` error with a retry button. Clicking retry re-invokes the function.
10. **No regenerate on success:** the card never re-invokes the Edge Function once the artifact is rendered (within the same session/local-day). Verified by counting `functions.invoke` calls in a test that mounts the card, lets it render, then re-renders the panel.
11. **Voice fragment composed correctly:** the system prompt sent to Anthropic begins with `LAMPLIGHT_SYSTEM_FRAGMENT`, followed by the daily-devotion artifact stance, followed by the stricter suffix on the retry attempt only. The `{{voice_preference}}` token is substituted with the user's setting; `{{local_date}}` is substituted with the request's `local_date`. Tested by capturing the `system` arg passed to a mocked `LLMAdapter.generate`.
12. **Content rules inherited verbatim:** `BANNED_PHRASES`, `CONTESTED_PASSAGES`, `GROWTH_BANNED_PHRASES` from `voice.ts` are applied to the flattened artifact text (`opening + scripture.text + reflection + prompt`). A test injects a sentinel banned phrase into a mocked artifact and asserts the validator catches it.
13. **`OptedInPlaceholder` is deleted.** Its test file is deleted. The Lamplight tab, when opted-in + entitled, renders `TodaysLampCard`.
14. **`TodaysLampCard`'s footer** renders the voice preference, tradition hint, and an "Edit preferences →" link to `/profile`. Behaviour parity with the old `OptedInPlaceholder` for those affordances.
15. **Loading state cycles** through 3 lines of copy on a 2.5s interval (capped at the last line). Verified with fake timers.
16. **`lamplight_artifacts` row provenance** is populated correctly: `source_note_ids` matches the `note_citations[].note_id` values; `source_verses` contains the anchor `scripture.ref`; `model_used` matches what the Anthropic response returned; `prompt_version` matches `DAILY_DEVOTION_PROMPT.promptVersion`.
17. **RLS regression:** user A's session cannot read user B's `daily_devotion` row via `getDailyDevotion`. Service-role is the only writer (the Edge Function); no client-side INSERT path exists for `lamplight_artifacts`.
18. **No regression in Foundation, Signal, or Reasoning:** the 4-state tab, profile section toggles, consent flow, `deleteAllUserData` (now also deletes daily devotion rows via the existing `lamplight_artifacts` table sweep — covered by Foundation tests), embedding queue + `embed-note` sweep, smoke-test pipeline + tests — all continue to work.
19. **`npm run lint`, `tsc -b`, `vitest run`, and `deno test supabase/functions/_shared/*.test.ts supabase/functions/lamplight-generate/**/*.test.ts` all pass.** New tests:
    - `supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`
    - `src/notepad/hooks/useTodaysLamp.test.tsx`
    - `src/notepad/components/lamplight/TodaysLampCard.test.tsx`
    - `src/notepad/components/lamplight/TodaysLampLoading.test.tsx`
    - `src/notepad/components/lamplight/TodaysLampError.test.tsx`
    - Extensions to `supabase-lamplight-adapter.test.ts`, `fake-lamplight-adapter.test.ts`, `lamplight-rls.test.ts`, `validators.test.ts` (new function + flatten helper), `voice.test.ts` (token substitution).
20. **No new env vars.** `ANTHROPIC_API_KEY`, `VOYAGE_AI_KEY`, `RERANK_ENABLED` are inherited from the Reasoning Layer.

## Files touched / created

### New files

- `supabase/functions/_shared/artifacts.ts` (canonical `DailyDevotion` type)
- `supabase/functions/lamplight-generate/prompts/daily-devotion.ts`
- `supabase/functions/lamplight-generate/daily-devotion-pipeline.ts`
- `supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`
- `src/notepad/storage/lamplight-artifacts.ts` (type re-export shim)
- `src/notepad/hooks/useTodaysLamp.ts`
- `src/notepad/hooks/useTodaysLamp.test.tsx`
- `src/notepad/components/lamplight/TodaysLampCard.tsx`
- `src/notepad/components/lamplight/TodaysLampCard.test.tsx`
- `src/notepad/components/lamplight/TodaysLampLoading.tsx`
- `src/notepad/components/lamplight/TodaysLampLoading.test.tsx`
- `src/notepad/components/lamplight/TodaysLampError.tsx`
- `src/notepad/components/lamplight/TodaysLampError.test.tsx`

### Modified files

- `supabase/functions/lamplight-generate/index.ts` — dispatch on `kind`; new `buildDailyDevotionContext`.
- `supabase/functions/_shared/voice.ts` — `composeSystem` gains optional `tokens` param.
- `supabase/functions/_shared/voice.test.ts` — coverage for token substitution.
- `supabase/functions/_shared/validators.ts` — `validateDailyDevotionCitations` + `flattenDailyDevotionText`.
- `supabase/functions/_shared/validators.test.ts` — coverage for the new function + new flatten helper.
- `src/notepad/storage/lamplight-adapter.ts` — interface additions.
- `src/notepad/storage/supabase-lamplight-adapter.ts` — `getDailyDevotion`, `generateDailyDevotion` impls.
- `src/notepad/storage/supabase-lamplight-adapter.test.ts` — coverage.
- `src/notepad/storage/fake-lamplight-adapter.ts` — same.
- `src/notepad/storage/fake-lamplight-adapter.test.ts` — same.
- `src/notepad/storage/lamplight-rls.test.ts` — extend with `lamplight_artifacts` daily-devotion cross-user read check.
- `src/notepad/components/lamplight/LamplightTabPanel.tsx` — drop `OptedInPlaceholder`, render `TodaysLampCard`.
- `src/notepad/components/lamplight/LamplightTabPanel.test.tsx` — update expectations for the opted-in + entitled branch.

### Deleted files

- `src/notepad/components/lamplight/OptedInPlaceholder.tsx`
- `src/notepad/components/lamplight/OptedInPlaceholder.test.tsx`

### Untouched

- All Foundation files outside the tab panel + adapter. All Signal Layer files. All `_shared` modules except `voice.ts` (single helper extension) and `validators.ts` (new sibling function).
- `lamplight-generate/pipeline.ts` (smoke-test pipeline). `lamplight-generate/prompts/smoke-test.ts`. Both stay; cleanup PR later.
- `_shared/anthropic.ts`, `_shared/retrieval.ts`, `_shared/voyage.ts`. No changes.
- Migrations 008-012. No DB churn.

## Open follow-ups (later sub-projects + small cleanups)

1. **`smoke_test` payload removal.** Once Today's Lamp has been stable in production for a week, remove the `smoke_test` dispatch, the `pipeline.ts` smoke-test file, the `prompts/smoke-test.ts` file, and the corresponding tests. Single small cleanup PR.
2. **`hydrateBiblePassages` extraction.** Both `buildSmokeTestContext` and `buildDailyDevotionContext` share a ~20-line passage-hydration block. Extract to `_shared/retrieval.ts`. Deferred refactor; no behaviour change.
3. **"Save as Devotion note" CTA.** `lamplight_artifacts.saved_to_notes` exists. Wire a button on `TodaysLampCard` that creates a new note in the user's vault containing the devotion content + a backlink to the artifact id. Update `saved_to_notes = true` to prevent the "Save" button from showing twice. Small slice.
4. **"How was this written?" panel.** The artifact's `source_note_ids` + `source_verses` + `model_used` + `prompt_version` are persisted. A side panel can render them as a transparency disclosure. Small slice.
5. **"This wasn't helpful" feedback.** New table `lamplight_artifact_feedback (artifact_id, user_id, outcome, created_at)`. The card gets a tiny "Wasn't helpful" link. Feeds into future negative-signal aggregation. Small slice.
6. **Stillwater fallback library.** Curated copy + theme classifier. Sub-project on its own scale; brief it separately once we have real-world `validators_failed` rate data from Today's Lamp's first weeks.
7. **`pg_cron` first-open-of-day trigger.** Optional optimization once Today's Lamp's manual-trigger path is proven. Runs every 30 min globally; for each opted-in user whose local time is in their wake window AND who has no `daily_devotion` for today, enqueues generation. Requires storing a wake-window per user (or sane defaults). Bigger slice than it sounds.
8. **Inline verse refs in `reflection`.** Currently un-validated to avoid false positives. If real-world model output shows the model citing un-supplied verses in prose, harden by running `reference-parser` against `reflection` and flagging unknown refs.
9. **Optional `validateDailyDevotionCitations` strict mode** that requires `note_citations.length >= 3` regardless of vault size. Currently the floor is 1 for graceful degradation. A future preference could flip this for power users.
10. **Doctrinal review board sign-off.** Sub-project 6 / pre-launch artifact. Reviewers will examine: `LAMPLIGHT_SYSTEM_FRAGMENT`, `DAILY_DEVOTION_PROMPT.system`, the composed system string under representative inputs, the `BANNED_PHRASES` / `CONTESTED_PASSAGES` / `GROWTH_BANNED_PHRASES` lists, and ~30 sample generated devotions. Until they sign, public launch is gated behind the entitlement promo flag (already in place).

## Notes for the implementer

- **Resist polishing the smoke-test pipeline while you're in the neighborhood.** The cleanup PR is its own slice. Single-purpose PRs review better.
- **`composeSystem`'s new `tokens` param must be additive.** Existing callers (smoke-test pipeline) must keep working without passing `tokens`. The `{{voice_preference}}` substitution from the original `voicePreference` arg must continue to function; `tokens` is purely *additional* substitutions on top.
- **The pipeline's idempotency pre-check is critical.** Skipping it means every tab open re-runs retrieval + LLM, burning Anthropic + Voyage credits + latency. Verify the test for "second call same local_date = no LLM call" passes before considering the slice done.
- **`local_date` is a string, not a Date.** No timezone arithmetic in the Edge Function. The client's `Date#toLocaleDateString('en-CA')` is the canonical producer; the server is just a string-keyed cache.
- **`note_citations.length` validator floor is 1, not 3.** The brief's "3-5" is the model's target; the validator is the safety net. A user with only 2 notes shouldn't be denied a devotion because the strict floor wasn't met.
- **`scripture.text` flows through `applyContentRules`.** This is intentional — if a model fabricates a passage with prophetic language it still gets caught. Real `bible_passages` text will not match any `BANNED_PHRASES` entry; the rule only fires on model hallucination.
- **`functions.invoke` error handling at the adapter.** Map every error path to `{ ok: false, reason: 'network' }` and let the hook decide what to render. Don't let raw Supabase errors bubble into the UI.
- **The progressive loader is a UX illusion, not a real telemetry feed.** The Edge Function returns one HTTP response after the full pipeline runs. The 3-step copy is purely client-side timing. If a future slice adds SSE-streamed generation, that's a different pattern and the loader will need rework.
- **Type sharing via the relative-path re-export shim is intentionally low-tech.** It avoids tsconfig / bundler surgery and keeps the canonical type in the Edge Function tree where the JSON Schema validation happens. If a third client of `DailyDevotion` shows up (e.g. an admin tool), revisit with a proper `@artifacts` path alias.
- **`TodaysLampCard` is the only opted-in surface for now.** Don't add navigation, tabs, or routing inside it. Sub-project 5 (Connection Cards) will add a second card surface; sub-project 6 (Weekly Insight) will add a third. They'll compose later — design the card as a self-contained block.
