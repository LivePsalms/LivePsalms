# Today's Lamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first user-visible Lamplight artifact (`daily_devotion`) on top of the Reasoning Layer. Auto-generates on first Lamplight tab open per local-day, persists to `lamplight_artifacts`, renders in a new `TodaysLampCard` that replaces the opt-in placeholder.

**Architecture:** New prompt template (`daily-devotion.ts`) + new persistence-capable pipeline (`daily-devotion-pipeline.ts`) + new `kind: 'daily_devotion'` dispatch in the existing `lamplight-generate` Edge Function. Client side gets two new adapter methods, a fetch-or-generate hook (`useTodaysLamp`), and three UI components (Loading / Error / Card). All shared modules (`voice.ts`, `validators.ts`, `anthropic.ts`, `retrieval.ts`) get tiny additive extensions; nothing breaks for the existing smoke-test path.

**Tech Stack:** TypeScript · Supabase Edge Functions (Deno) · React 19 + Vite · Vitest · Tailwind · Anthropic Messages API (Sonnet 4.6) · Voyage AI (rerank-2.5, off by default).

**Spec:** `docs/superpowers/specs/2026-05-27-todays-lamp-design.md`

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `supabase/functions/_shared/artifacts.ts` | Canonical `DailyDevotion` TS type — single source of truth. |
| `src/notepad/storage/lamplight-artifacts.ts` | Type re-export shim — lets the React client import `DailyDevotion` from the supabase tree without bundler surgery. |
| `supabase/functions/lamplight-generate/prompts/daily-devotion.ts` | `DAILY_DEVOTION_PROMPT`: promptVersion + system + tool schema + buildMessages. |
| `supabase/functions/lamplight-generate/daily-devotion-pipeline.ts` | `runDailyDevotionPipeline`: idempotency pre-check → generate → validate → retry-once → persist → return. |
| `supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts` | Pipeline tests: happy / idempotency / no_notes / retry / hard-fail / race. |
| `src/notepad/hooks/useTodaysLamp.ts` | Fetch-or-generate orchestration; manages state machine for the card. |
| `src/notepad/hooks/useTodaysLamp.test.tsx` | Hook tests across all branches. |
| `src/notepad/components/lamplight/TodaysLampLoading.tsx` | 3-step progressive loader. |
| `src/notepad/components/lamplight/TodaysLampLoading.test.tsx` | Loading-step copy cycling. |
| `src/notepad/components/lamplight/TodaysLampError.tsx` | Error states + retry button (hidden on `no_notes`). |
| `src/notepad/components/lamplight/TodaysLampError.test.tsx` | All three error variants. |
| `src/notepad/components/lamplight/TodaysLampCard.tsx` | The artifact card. |
| `src/notepad/components/lamplight/TodaysLampCard.test.tsx` | Renders all sections + footer. |

### Modified files

| File | Change |
|---|---|
| `supabase/functions/_shared/voice.ts` | `composeSystem` gains optional `tokens?: Record<string, string>` for `{{key}}` substitution. |
| `supabase/functions/_shared/voice.test.ts` | Token-substitution coverage. |
| `supabase/functions/_shared/validators.ts` | New: `validateDailyDevotionCitations` + `flattenDailyDevotionText`. |
| `supabase/functions/_shared/validators.test.ts` | Coverage for both new functions. |
| `supabase/functions/lamplight-generate/index.ts` | Dispatch on `body.kind`; add `buildDailyDevotionContext`. |
| `src/notepad/storage/lamplight-adapter.ts` | Add `getDailyDevotion` + `generateDailyDevotion` to the interface. |
| `src/notepad/storage/supabase-lamplight-adapter.ts` | Implement both new methods. |
| `src/notepad/storage/supabase-lamplight-adapter.test.ts` | Coverage. |
| `src/notepad/storage/fake-lamplight-adapter.ts` | Implement both new methods. |
| `src/notepad/storage/fake-lamplight-adapter.test.ts` | Coverage. |
| `src/notepad/storage/lamplight-rls.test.ts` | Cross-user `lamplight_artifacts` read isolation for `daily_devotion` rows. |
| `src/notepad/components/lamplight/LamplightTabPanel.tsx` | Drop `OptedInPlaceholder`, render `TodaysLampCard`. |
| `src/notepad/components/lamplight/LamplightTabPanel.test.tsx` | Update expectations. |

### Deleted files

| File | Reason |
|---|---|
| `src/notepad/components/lamplight/OptedInPlaceholder.tsx` | `TodaysLampCard` replaces it. |
| `src/notepad/components/lamplight/OptedInPlaceholder.test.tsx` | Component is gone. |

---

## Task 1: Add `DailyDevotion` canonical type + client shim

**Files:**
- Create: `supabase/functions/_shared/artifacts.ts`
- Create: `src/notepad/storage/lamplight-artifacts.ts`

- [ ] **Step 1: Create the canonical type file**

Write `supabase/functions/_shared/artifacts.ts`:

```ts
// Canonical artifact types shared between the Edge Function (Deno) and the
// React client (Node/browser via tsc). Framework-free: no I/O, no Deno or
// Node globals.

export interface DailyDevotion {
  opening: string;
  scripture: {
    ref: string;
    text: string;
  };
  reflection: string;
  prompt: string;
  note_citations: Array<{
    note_id: string;
    reason: string;
  }>;
}
```

- [ ] **Step 2: Create the client-side re-export shim**

Write `src/notepad/storage/lamplight-artifacts.ts`:

```ts
// Type-only re-export from the canonical artifact definition in the supabase
// functions tree. The relative path keeps the type single-sourced without
// requiring a tsconfig path alias.

export type { DailyDevotion } from '../../../supabase/functions/_shared/artifacts';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc -b`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/artifacts.ts src/notepad/storage/lamplight-artifacts.ts
git commit -m "feat(lamplight): canonical DailyDevotion type + client shim"
```

---

## Task 2: Extend `composeSystem` with `tokens` parameter

**Files:**
- Modify: `supabase/functions/_shared/voice.ts`
- Modify: `supabase/functions/_shared/voice.test.ts`

- [ ] **Step 1: Write the failing test**

Locate `supabase/functions/_shared/voice.test.ts` and add inside the existing `describe('composeSystem', ...)` block (or add a new describe if no such block exists):

```ts
  it('substitutes additional {{tokens}} in base and artifact', () => {
    const out = composeSystem({
      base: 'Voice: {{voice_preference}}. Today: {{local_date}}.',
      artifact: 'Date again: {{local_date}}.',
      voicePreference: 'Lord',
      tokens: { local_date: '2026-05-27' },
    });
    expect(out).toContain('Voice: Lord');
    expect(out).toContain('Today: 2026-05-27');
    expect(out).toContain('Date again: 2026-05-27');
  });

  it('is backward compatible: omitting tokens leaves {{...}} placeholders unsubstituted (except voice_preference)', () => {
    const out = composeSystem({
      base: 'Voice: {{voice_preference}}. Today: {{local_date}}.',
      artifact: 'artifact',
      voicePreference: 'Father',
    });
    expect(out).toContain('Voice: Father');
    expect(out).toContain('Today: {{local_date}}');
  });
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run supabase/functions/_shared/voice.test.ts`
Expected: FAIL — `tokens` parameter not recognized by current signature.

- [ ] **Step 3: Extend `composeSystem` in `supabase/functions/_shared/voice.ts`**

Replace the existing `ComposeSystemInput` + `composeSystem` exports with:

```ts
export interface ComposeSystemInput {
  base: string;
  artifact: string;
  voicePreference: string;
  stricter?: string;
  tokens?: Record<string, string>;
}

export function composeSystem(input: ComposeSystemInput): string {
  const allTokens: Record<string, string> = {
    voice_preference: input.voicePreference,
    ...(input.tokens ?? {}),
  };
  const substitute = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_m, key) => (key in allTokens ? allTokens[key] : `{{${key}}}`));
  const parts = [substitute(input.base), substitute(input.artifact)];
  if (input.stricter && input.stricter.trim().length > 0) parts.push(input.stricter);
  return parts.join('\n\n');
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run supabase/functions/_shared/voice.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/voice.ts supabase/functions/_shared/voice.test.ts
git commit -m "feat(lamplight): composeSystem supports arbitrary {{token}} substitution"
```

---

## Task 3: Add `validateDailyDevotionCitations` + `flattenDailyDevotionText`

**Files:**
- Modify: `supabase/functions/_shared/validators.ts`
- Modify: `supabase/functions/_shared/validators.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `supabase/functions/_shared/validators.test.ts`:

```ts
import { validateDailyDevotionCitations, flattenDailyDevotionText } from './validators';
import type { DailyDevotion } from './artifacts';

function makeDevotion(overrides: Partial<DailyDevotion> = {}): DailyDevotion {
  return {
    opening: 'A quiet greeting.',
    scripture: { ref: 'Psalm 23:4', text: 'Even though I walk through the valley…' },
    reflection: 'This passage may speak to weariness.',
    prompt: 'What part of this verse reaches you today?',
    note_citations: [{ note_id: 'note-1', reason: 'recurrence of rest' }],
    ...overrides,
  };
}

describe('validateDailyDevotionCitations', () => {
  const allowed = {
    allowedNoteIds: new Set(['note-1', 'note-2']),
    allowedVerseRefs: new Set(['Psalm 23:4']),
  };

  it('passes a clean devotion', () => {
    const result = validateDailyDevotionCitations(makeDevotion(), allowed);
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('fails when scripture.ref is unknown', () => {
    const result = validateDailyDevotionCitations(
      makeDevotion({ scripture: { ref: 'Made Up 1:1', text: 'fake' } }),
      allowed,
    );
    expect(result.ok).toBe(false);
    expect(result.violations[0].reason).toBe('unknown_verse');
  });

  it('fails when a note_id is outside allowedNoteIds', () => {
    const result = validateDailyDevotionCitations(
      makeDevotion({ note_citations: [{ note_id: 'note-X', reason: 'stranger' }] }),
      allowed,
    );
    expect(result.ok).toBe(false);
    expect(result.violations[0].reason).toBe('unknown_note');
  });

  it('fails when note_citations is empty', () => {
    const result = validateDailyDevotionCitations(
      makeDevotion({ note_citations: [] }),
      allowed,
    );
    expect(result.ok).toBe(false);
    expect(result.violations[0].reason).toBe('no_citations');
  });

  it('is case-insensitive for verse refs', () => {
    const result = validateDailyDevotionCitations(
      makeDevotion({ scripture: { ref: 'psalm 23:4', text: 't' } }),
      allowed,
    );
    expect(result.ok).toBe(true);
  });
});

describe('flattenDailyDevotionText', () => {
  it('concatenates opening + scripture.text + reflection + prompt with double newlines', () => {
    const out = flattenDailyDevotionText(makeDevotion());
    expect(out).toContain('A quiet greeting.');
    expect(out).toContain('Even though I walk');
    expect(out).toContain('This passage may speak');
    expect(out).toContain('What part of this verse');
    expect(out.split('\n\n')).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run supabase/functions/_shared/validators.test.ts`
Expected: FAIL — `validateDailyDevotionCitations` / `flattenDailyDevotionText` not exported.

- [ ] **Step 3: Implement the new functions**

Append to `supabase/functions/_shared/validators.ts`:

```ts
import type { DailyDevotion } from './artifacts';

export function validateDailyDevotionCitations(
  artifact: DailyDevotion,
  allowed: { allowedNoteIds: Set<string>; allowedVerseRefs: Set<string> },
): CitationCheckResult {
  const violations: CitationViolation[] = [];
  const verseRefsLower = new Set<string>();
  for (const r of allowed.allowedVerseRefs) verseRefsLower.add(r.toLowerCase());

  if (!verseRefsLower.has(artifact.scripture.ref.toLowerCase())) {
    violations.push({
      section_index: 0,
      reason: 'unknown_verse',
      detail: `anchor verse "${artifact.scripture.ref}" is not in the retrieved passages`,
    });
  }

  if (!artifact.note_citations || artifact.note_citations.length === 0) {
    violations.push({
      section_index: 0,
      reason: 'no_citations',
      detail: 'daily devotion has zero note_citations',
    });
  } else {
    artifact.note_citations.forEach((cite, idx) => {
      if (!allowed.allowedNoteIds.has(cite.note_id)) {
        violations.push({
          section_index: idx,
          reason: 'unknown_note',
          detail: `cited note "${cite.note_id}" is not in the user's context`,
        });
      }
    });
  }

  return { ok: violations.length === 0, violations };
}

export function flattenDailyDevotionText(artifact: DailyDevotion): string {
  return [
    artifact.opening,
    artifact.scripture.text,
    artifact.reflection,
    artifact.prompt,
  ].join('\n\n');
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run supabase/functions/_shared/validators.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/validators.ts supabase/functions/_shared/validators.test.ts
git commit -m "feat(lamplight): daily-devotion citation validator + flatten helper"
```

---

## Task 4: Add `DAILY_DEVOTION_PROMPT` template module

**Files:**
- Create: `supabase/functions/lamplight-generate/prompts/daily-devotion.ts`

- [ ] **Step 1: Write the prompt template module**

Create `supabase/functions/lamplight-generate/prompts/daily-devotion.ts`:

```ts
// Today's Lamp prompt template. Composes under LAMPLIGHT_SYSTEM_FRAGMENT via
// composeSystem; banned/contested/growth lists from voice.ts are inherited.
// promptVersion is persisted on lamplight_artifacts.prompt_version.

import type { DailyDevotionContext } from '../daily-devotion-pipeline';

export const DAILY_DEVOTION_PROMPT = {
  promptVersion: 'daily-devotion-2026-05-27-v1',

  system: `Write a brief daily devotion for someone who has been journaling. The user has shared up to 3 recent notes (or fewer, if their vault is small). You have 3 candidate Scripture passages. Write something glanceable — they will read this in under a minute.

Structure:
- opening (20-40 words): a quiet greeting that names one thread from the user's notes obliquely. Do not summarise their notes; do not quote them verbatim.
- scripture: pick ONE anchor passage from the candidates. Use the exact ref string and the exact passage text from the user prompt — do not paraphrase, do not abbreviate, do not invent.
- reflection (80-140 words): bring the passage into conversation with what the user has written. Offer interpretation as possibility, not pronouncement.
- prompt: one open question to sit with, ≤30 words. Not advice. An invitation.
- note_citations: 1 to 3 entries; each names a specific note id from the user prompt and a ≤15-word reason for the recurrence or theme that drew you to it.

Hard rules (these compound the rules in your system fragment):
- Cite every Scripture reference using the exact form supplied. Do not invent refs.
- Quote no more than 25 words verbatim from any note.
- If you cannot ground a sentence in the supplied notes or passages, do not write it.
- Today is {{local_date}}. Do not refer to other dates.`,

  tool: {
    name: 'emit_daily_devotion',
    description: 'Return the daily devotion artifact JSON.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['opening', 'scripture', 'reflection', 'prompt', 'note_citations'],
      properties: {
        opening: { type: 'string', minLength: 80, maxLength: 280 },
        scripture: {
          type: 'object',
          additionalProperties: false,
          required: ['ref', 'text'],
          properties: {
            ref: {
              type: 'string',
              description: 'Use one of the exact human-readable refs supplied in the user prompt (e.g. "Psalm 23:4", "Romans 8:28-30"). Do not invent or paraphrase.',
            },
            text: {
              type: 'string',
              description: 'The full passage text. Use the text supplied in the user prompt verbatim.',
            },
          },
        },
        reflection: { type: 'string', minLength: 400, maxLength: 900 },
        prompt: { type: 'string', minLength: 1, maxLength: 200 },
        note_citations: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['note_id', 'reason'],
            properties: {
              note_id: { type: 'string', description: 'One of the note ids supplied in the user prompt.' },
              reason: { type: 'string', minLength: 1, maxLength: 100 },
            },
          },
        },
      },
    },
  },

  buildMessages(ctx: DailyDevotionContext): Array<{ role: 'user'; content: string }> {
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
  },
} as const;
```

Note: the `import type { DailyDevotionContext }` from `'../daily-devotion-pipeline'` is a forward reference. The pipeline file is created in Task 5; the type-only import resolves once it exists. TypeScript will report an error until Task 5 lands — that's expected.

- [ ] **Step 2: Verify TypeScript reports the expected unresolved type**

Run: `npx tsc -b`
Expected: FAIL with one error pointing to the `DailyDevotionContext` import. Other code unaffected.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/lamplight-generate/prompts/daily-devotion.ts
git commit -m "feat(lamplight): daily devotion prompt template (system + tool schema)"
```

---

## Task 5: Pipeline — happy path

**Files:**
- Create: `supabase/functions/lamplight-generate/daily-devotion-pipeline.ts`
- Create: `supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { runDailyDevotionPipeline, type DailyDevotionContext } from './daily-devotion-pipeline';
import type { LLMAdapter, GenerateOutput } from '../_shared/anthropic';
import type { DailyDevotion } from '../_shared/artifacts';

function makeCtx(overrides: Partial<DailyDevotionContext> = {}): DailyDevotionContext {
  return {
    notes: [{ id: 'note-1', title: 'On rest', plaintext: 'I have been weary lately.' }],
    passages: [{
      source_id: 'psa.23.4',
      text: 'Even though I walk through the valley of the shadow of death…',
      ref: 'Psalm 23:4',
      metadata: { book: 'Psalm', chapter: 23 },
    }],
    voicePreference: 'Lord',
    traditionHint: 'unspecified',
    localDate: '2026-05-27',
    allowedNoteIds: new Set(['note-1']),
    allowedVerseRefs: new Set(['Psalm 23:4']),
    rerankUsed: false,
    ...overrides,
  };
}

function makeAdapter<T>(responses: T[]): LLMAdapter {
  let i = 0;
  return {
    async generate<U>(): Promise<GenerateOutput<U>> {
      const parsed = responses[Math.min(i, responses.length - 1)] as unknown as U;
      i++;
      return { parsed, modelUsed: 'claude-sonnet-4-6', promptTokens: 10, completionTokens: 20 };
    },
  };
}

const cleanArtifact: DailyDevotion = {
  opening: 'A quiet greeting. Welcome back; the lamp is lit and the day is yours.',
  scripture: { ref: 'Psalm 23:4', text: 'Even though I walk through the valley of the shadow of death…' },
  reflection: 'This passage may speak to weariness. The shepherd does not pull the weary forward but walks beside them through the valley. Scripture suggests that fear, in this verse, is not banished but accompanied. For someone walking through what you have described, this verse often becomes less a promise to be fearless than an invitation to be unalone. The rod and the staff are not weapons against your weariness — they are signs that you have not been left.',
  prompt: 'What part of being accompanied through the valley reaches you today?',
  note_citations: [{ note_id: 'note-1', reason: 'recurring weariness across recent notes' }],
};

function makeSupabaseMock(opts: {
  existing?: DailyDevotion | null;
  insertedId?: string;
  insertError?: { code?: string; message: string } | null;
} = {}) {
  const existing = opts.existing ?? null;
  const insertedId = opts.insertedId ?? 'artifact-1';
  const insertError = opts.insertError ?? null;
  const inserts: Array<Record<string, unknown>> = [];
  const supabase = {
    from(_table: string) {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                async maybeSingle() {
                  if (existing) {
                    return { data: { id: 'cached-id', body: existing, model_used: 'claude-sonnet-4-6', prompt_version: 'daily-devotion-2026-05-27-v1' }, error: null };
                  }
                  return { data: null, error: null };
                },
                async single() {
                  if (existing) {
                    return { data: { id: 'cached-id', body: existing, model_used: 'claude-sonnet-4-6', prompt_version: 'daily-devotion-2026-05-27-v1' }, error: null };
                  }
                  return { data: null, error: { message: 'no row' } };
                },
              }),
            }),
          }),
        }),
        insert: (row: Record<string, unknown>) => {
          inserts.push(row);
          return {
            select: () => ({
              async single() {
                if (insertError) return { data: null, error: insertError };
                return { data: { id: insertedId }, error: null };
              },
            }),
          };
        },
      };
    },
  };
  return { supabase: supabase as unknown as Parameters<typeof runDailyDevotionPipeline>[0]['supabase'], inserts };
}

describe('runDailyDevotionPipeline', () => {
  it('happy path: generates, validates, persists, returns ok with artifact_id', async () => {
    const { supabase, inserts } = makeSupabaseMock();
    const result = await runDailyDevotionPipeline({
      llm: makeAdapter([cleanArtifact]),
      supabase,
      ctx: makeCtx(),
      userId: 'user-1',
      localDate: '2026-05-27',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.artifact_id).toBe('artifact-1');
      expect(result.attempts).toBe(1);
      expect(result.cached).toBe(false);
      expect(result.artifact.scripture.ref).toBe('Psalm 23:4');
    }
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      user_id: 'user-1',
      type: 'daily_devotion',
      period_key: '2026-05-27',
      source_note_ids: ['note-1'],
      source_verses: ['Psalm 23:4'],
      prompt_version: 'daily-devotion-2026-05-27-v1',
    });
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`
Expected: FAIL — `runDailyDevotionPipeline` not exported.

- [ ] **Step 3: Implement the pipeline (happy path only)**

Create `supabase/functions/lamplight-generate/daily-devotion-pipeline.ts`:

```ts
// Today's Lamp pipeline. Persists to lamplight_artifacts on success;
// idempotent on (user_id, 'daily_devotion', local_date). The retry, no_notes,
// race-handling branches are added in subsequent tasks.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMAdapter } from '../_shared/anthropic';
import type { DailyDevotion } from '../_shared/artifacts';
import {
  LAMPLIGHT_SYSTEM_FRAGMENT,
  BANNED_PHRASES,
  CONTESTED_PASSAGES,
  GROWTH_BANNED_PHRASES,
  composeSystem,
} from '../_shared/voice';
import {
  validateDailyDevotionCitations,
  applyContentRules,
  flattenDailyDevotionText,
  type CitationViolation,
  type ContentRuleViolation,
} from '../_shared/validators';
import { DAILY_DEVOTION_PROMPT } from './prompts/daily-devotion';

export interface DailyDevotionPassage {
  source_id: string;
  text: string;
  ref: string;
  metadata: Record<string, unknown>;
}

export interface DailyDevotionContext {
  notes: Array<{ id: string; title: string; plaintext: string }>;
  passages: DailyDevotionPassage[];
  voicePreference: string;
  traditionHint: string;
  localDate: string;
  allowedNoteIds: Set<string>;
  allowedVerseRefs: Set<string>;
  rerankUsed: boolean;
}

export type DailyDevotionPipelineResult =
  | {
      ok: true;
      artifact: DailyDevotion;
      artifact_id: string;
      model_used: string;
      prompt_version: string;
      attempts: number;
      cached: boolean;
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

export async function runDailyDevotionPipeline(args: {
  llm: LLMAdapter;
  supabase: SupabaseClient;
  ctx: DailyDevotionContext | null;
  userId: string;
  localDate: string;
}): Promise<DailyDevotionPipelineResult> {
  const promptVersion = DAILY_DEVOTION_PROMPT.promptVersion;

  if (!args.ctx) {
    return { ok: false, reason: 'no_notes', prompt_version: promptVersion, attempts: 0 };
  }
  const ctx = args.ctx;

  const system = composeSystem({
    base: LAMPLIGHT_SYSTEM_FRAGMENT,
    artifact: DAILY_DEVOTION_PROMPT.system,
    voicePreference: ctx.voicePreference,
    tokens: { local_date: ctx.localDate },
  });

  const { parsed, modelUsed } = await args.llm.generate<DailyDevotion>({
    model: 'sonnet',
    system,
    messages: DAILY_DEVOTION_PROMPT.buildMessages(ctx),
    tool: DAILY_DEVOTION_PROMPT.tool as unknown as Parameters<LLMAdapter['generate']>[0]['tool'],
    maxTokens: 2048,
  });

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

  if (!citation.ok || !content.ok) {
    return {
      ok: false,
      reason: 'validators_failed',
      violations: { citation: citation.violations, content: content.violations },
      model_used: modelUsed,
      prompt_version: promptVersion,
      attempts: 1,
    };
  }

  const sourceNoteIds = parsed.note_citations.map(c => c.note_id);
  const sourceVerses = [parsed.scripture.ref];
  const insertRes = await args.supabase
    .from('lamplight_artifacts')
    .insert({
      user_id: args.userId,
      type: 'daily_devotion',
      period_key: args.localDate,
      title: '',
      body: parsed,
      source_note_ids: sourceNoteIds,
      source_verses: sourceVerses,
      model_used: modelUsed,
      prompt_version: promptVersion,
    })
    .select('id')
    .single();

  if (insertRes.error || !insertRes.data) {
    throw insertRes.error ?? new Error('insert returned no data');
  }

  return {
    ok: true,
    artifact: parsed,
    artifact_id: insertRes.data.id as string,
    model_used: modelUsed,
    prompt_version: promptVersion,
    attempts: 1,
    cached: false,
    retrieval: {
      note_neighbors: ctx.notes.length,
      bible_passages: ctx.passages.length,
      reranked: ctx.rerankUsed,
    },
  };
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`
Expected: PASS — the happy-path test passes. (Existing smoke-test pipeline tests are unaffected.)

- [ ] **Step 5: Run TypeScript build to confirm the forward-reference from Task 4 now resolves**

Run: `npx tsc -b`
Expected: PASS (no errors).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/lamplight-generate/daily-devotion-pipeline.ts supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts
git commit -m "feat(lamplight): daily devotion pipeline — happy path"
```

---

## Task 6: Pipeline — idempotency pre-check

**Files:**
- Modify: `supabase/functions/lamplight-generate/daily-devotion-pipeline.ts`
- Modify: `supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`

- [ ] **Step 1: Add the failing test**

Inside the `describe('runDailyDevotionPipeline', …)` block in `daily-devotion-pipeline.test.ts`, append:

```ts
  it('idempotency: returns cached artifact when one already exists for (user, local_date), no LLM call', async () => {
    const { supabase, inserts } = makeSupabaseMock({ existing: cleanArtifact });
    let llmCalls = 0;
    const llm: LLMAdapter = {
      async generate<U>(): Promise<GenerateOutput<U>> {
        llmCalls++;
        return { parsed: cleanArtifact as unknown as U, modelUsed: 'm', promptTokens: 0, completionTokens: 0 };
      },
    };
    const result = await runDailyDevotionPipeline({
      llm,
      supabase,
      ctx: makeCtx(),
      userId: 'user-1',
      localDate: '2026-05-27',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cached).toBe(true);
      expect(result.attempts).toBe(0);
      expect(result.artifact_id).toBe('cached-id');
    }
    expect(llmCalls).toBe(0);
    expect(inserts).toHaveLength(0);
  });
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts -t idempotency`
Expected: FAIL — no pre-check; LLM is still called and `cached` is false.

- [ ] **Step 3: Add the idempotency pre-check at the top of `runDailyDevotionPipeline`**

In `daily-devotion-pipeline.ts`, between the `promptVersion = …` line and the `if (!args.ctx)` block, insert:

```ts
  // Idempotency: short-circuit if (user, type, period_key) already exists.
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
      artifact_id: existing.data.id as string,
      model_used: (existing.data.model_used as string) ?? 'claude-sonnet-4-6',
      prompt_version: (existing.data.prompt_version as string) ?? promptVersion,
      attempts: 0,
      cached: true,
    };
  }
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/lamplight-generate/daily-devotion-pipeline.ts supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts
git commit -m "feat(lamplight): daily devotion pipeline — idempotency pre-check"
```

---

## Task 7: Pipeline — `no_notes` short-circuit

**Files:**
- Modify: `supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`

The implementation already handles `ctx === null` from Task 5. This task just verifies it with a test.

- [ ] **Step 1: Add the test**

Append to the `describe('runDailyDevotionPipeline', …)` block:

```ts
  it('no_notes: when ctx is null, returns ok:false reason:no_notes with attempts:0, no LLM call', async () => {
    const { supabase, inserts } = makeSupabaseMock();
    let llmCalls = 0;
    const llm: LLMAdapter = {
      async generate<U>(): Promise<GenerateOutput<U>> {
        llmCalls++;
        return { parsed: cleanArtifact as unknown as U, modelUsed: 'm', promptTokens: 0, completionTokens: 0 };
      },
    };
    const result = await runDailyDevotionPipeline({
      llm,
      supabase,
      ctx: null,
      userId: 'user-1',
      localDate: '2026-05-27',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('no_notes');
      expect(result.attempts).toBe(0);
    }
    expect(llmCalls).toBe(0);
    expect(inserts).toHaveLength(0);
  });
```

- [ ] **Step 2: Run the test, confirm it passes immediately (impl already exists)**

Run: `npx vitest run supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts -t no_notes`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts
git commit -m "test(lamplight): cover no_notes short-circuit in daily devotion pipeline"
```

---

## Task 8: Pipeline — retry-on-validator-fail with stricter suffix

**Files:**
- Modify: `supabase/functions/lamplight-generate/daily-devotion-pipeline.ts`
- Modify: `supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`

- [ ] **Step 1: Add the failing test**

Append to the describe block:

```ts
  it('validator-fail-then-retry: first attempt has unknown verse ref, second is clean, ok:true attempts:2', async () => {
    const dirty: DailyDevotion = {
      ...cleanArtifact,
      scripture: { ref: 'Made Up 1:1', text: 'fake passage' },
    };
    const { supabase, inserts } = makeSupabaseMock();
    const result = await runDailyDevotionPipeline({
      llm: makeAdapter([dirty, cleanArtifact]),
      supabase,
      ctx: makeCtx(),
      userId: 'user-1',
      localDate: '2026-05-27',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attempts).toBe(2);
      expect(result.cached).toBe(false);
    }
    expect(inserts).toHaveLength(1); // only the successful attempt persists
  });
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts -t validator-fail-then-retry`
Expected: FAIL — only one attempt currently runs; the dirty first attempt returns `ok:false`.

- [ ] **Step 3: Refactor `runDailyDevotionPipeline` to a 2-attempt retry loop**

Replace the post-idempotency portion of `runDailyDevotionPipeline` (from the `const system = composeSystem(...)` line through the final `return ok:true` block) with:

```ts
  const MAX_ATTEMPTS = 2;
  let attempts = 0;
  let lastViolations: { citation: CitationViolation[]; content: ContentRuleViolation[] } | null = null;
  let lastModelUsed = 'claude-sonnet-4-6';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
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
      tool: DAILY_DEVOTION_PROMPT.tool as unknown as Parameters<LLMAdapter['generate']>[0]['tool'],
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
      const sourceNoteIds = parsed.note_citations.map(c => c.note_id);
      const sourceVerses = [parsed.scripture.ref];
      const insertRes = await args.supabase
        .from('lamplight_artifacts')
        .insert({
          user_id: args.userId,
          type: 'daily_devotion',
          period_key: args.localDate,
          title: '',
          body: parsed,
          source_note_ids: sourceNoteIds,
          source_verses: sourceVerses,
          model_used: modelUsed,
          prompt_version: promptVersion,
        })
        .select('id')
        .single();

      if (insertRes.error || !insertRes.data) {
        throw insertRes.error ?? new Error('insert returned no data');
      }

      return {
        ok: true,
        artifact: parsed,
        artifact_id: insertRes.data.id as string,
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

  return {
    ok: false,
    reason: 'validators_failed',
    violations: lastViolations!,
    model_used: lastModelUsed,
    prompt_version: promptVersion,
    attempts,
  };
```

Then add the `formatStricterSuffix` helper at the bottom of the file:

```ts
function formatStricterSuffix(violations: {
  citation: CitationViolation[];
  content: ContentRuleViolation[];
}): string {
  const parts: string[] = [];
  if (violations.citation.length > 0) {
    parts.push(
      'On retry: every section MUST cite only refs supplied in the user prompt; note_citations MUST reference only the supplied note ids.',
    );
  }
  if (violations.content.length > 0) {
    const families = new Set(violations.content.map(v => v.family));
    if (families.has('banned')) {
      parts.push(
        'On retry: do not produce prophetic, oracular, or "God is telling you" style language. Speak of Scripture in possibility, not pronouncement.',
      );
    }
    if (families.has('contested')) {
      parts.push(
        'On retry: avoid interpreting the contested passages mentioned. Name them gently and defer.',
      );
    }
    if (families.has('growth')) {
      parts.push(
        'On retry: do not use streak / "missed yesterday" / "get back on track" / effort-shaming language.',
      );
    }
  }
  return parts.join(' ');
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`
Expected: PASS (all four tests so far).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/lamplight-generate/daily-devotion-pipeline.ts supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts
git commit -m "feat(lamplight): daily devotion pipeline — retry once on validator fail"
```

---

## Task 9: Pipeline — hard-fail, no persistence

**Files:**
- Modify: `supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`

The implementation from Task 8 already returns `ok:false reason:'validators_failed'` after MAX_ATTEMPTS. This task verifies no persistence happens.

- [ ] **Step 1: Add the test**

Append:

```ts
  it('hard-fail: both attempts violate → ok:false validators_failed, no row inserted', async () => {
    const banned: DailyDevotion = {
      ...cleanArtifact,
      reflection: 'God is telling you to forgive him. ' + cleanArtifact.reflection,
    };
    const { supabase, inserts } = makeSupabaseMock();
    const result = await runDailyDevotionPipeline({
      llm: makeAdapter([banned, banned]),
      supabase,
      ctx: makeCtx(),
      userId: 'user-1',
      localDate: '2026-05-27',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('validators_failed');
      expect(result.attempts).toBe(2);
      expect(result.violations?.content.some(v => v.family === 'banned')).toBe(true);
    }
    expect(inserts).toHaveLength(0);
  });
```

- [ ] **Step 2: Run the test, confirm it passes immediately**

Run: `npx vitest run supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts -t hard-fail`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts
git commit -m "test(lamplight): cover hard-fail no-persistence in daily devotion pipeline"
```

---

## Task 10: Pipeline — INSERT-conflict race handling

**Files:**
- Modify: `supabase/functions/lamplight-generate/daily-devotion-pipeline.ts`
- Modify: `supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`

- [ ] **Step 1: Add the failing test**

Append:

```ts
  it('race: INSERT conflict triggers re-read; returns cached:true with the existing row', async () => {
    // Two-stage mock: pre-check returns null (no existing) on call 1; INSERT
    // returns a unique-violation error; the post-INSERT re-read returns the
    // row that the other request inserted.
    let preCheckCalls = 0;
    const inserts: Array<Record<string, unknown>> = [];
    const supabase = {
      from(_table: string) {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  async maybeSingle() {
                    preCheckCalls++;
                    return { data: null, error: null }; // pre-check: not yet
                  },
                  async single() {
                    // post-INSERT re-read: now exists (race winner inserted it)
                    return {
                      data: {
                        id: 'race-id',
                        body: cleanArtifact,
                        model_used: 'claude-sonnet-4-6',
                        prompt_version: 'daily-devotion-2026-05-27-v1',
                      },
                      error: null,
                    };
                  },
                }),
              }),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            inserts.push(row);
            return {
              select: () => ({
                async single() {
                  return { data: null, error: { code: '23505', message: 'unique violation' } };
                },
              }),
            };
          },
        };
      },
    } as unknown as Parameters<typeof runDailyDevotionPipeline>[0]['supabase'];

    const result = await runDailyDevotionPipeline({
      llm: makeAdapter([cleanArtifact]),
      supabase,
      ctx: makeCtx(),
      userId: 'user-1',
      localDate: '2026-05-27',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cached).toBe(true);
      expect(result.artifact_id).toBe('race-id');
    }
    expect(inserts).toHaveLength(1);
  });
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts -t race`
Expected: FAIL — the current impl throws on INSERT error.

- [ ] **Step 3: Replace the INSERT-error branch with re-read fallback**

In `runDailyDevotionPipeline`, replace this block:

```ts
      if (insertRes.error || !insertRes.data) {
        throw insertRes.error ?? new Error('insert returned no data');
      }
```

with:

```ts
      if (insertRes.error || !insertRes.data) {
        // Race: another request inserted between our pre-check and this INSERT.
        // Re-read the persisted row and return it as cached.
        const refetch = await args.supabase
          .from('lamplight_artifacts')
          .select('id, body, model_used, prompt_version')
          .eq('user_id', args.userId)
          .eq('type', 'daily_devotion')
          .eq('period_key', args.localDate)
          .single();
        if (refetch.error || !refetch.data) {
          throw insertRes.error ?? refetch.error ?? new Error('insert + re-read both failed');
        }
        return {
          ok: true,
          artifact: refetch.data.body as DailyDevotion,
          artifact_id: refetch.data.id as string,
          model_used: (refetch.data.model_used as string) ?? modelUsed,
          prompt_version: (refetch.data.prompt_version as string) ?? promptVersion,
          attempts,
          cached: true,
        };
      }
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`
Expected: PASS (all five tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/lamplight-generate/daily-devotion-pipeline.ts supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts
git commit -m "feat(lamplight): daily devotion pipeline — INSERT-race re-read fallback"
```

---

## Task 11: Edge Function dispatch + `buildDailyDevotionContext`

**Files:**
- Modify: `supabase/functions/lamplight-generate/index.ts`

This task wires the HTTP shell. There's no dedicated unit test for the HTTP layer (the existing `smoke_test` path is similarly tested only via its pipeline); the new branch is exercised end-to-end via integration testing in Task 21.

- [ ] **Step 1: Replace the body of `serve(...)` with a `kind` dispatch**

Open `supabase/functions/lamplight-generate/index.ts` and replace its full contents with:

```ts
// supabase/functions/lamplight-generate/index.ts
//
// Dispatches on body.kind:
//   - 'smoke_test'     → throwaway pipeline from sub-project 3 (kept for now)
//   - 'daily_devotion' → real, persisted daily devotion (sub-project 4)
//
// JWT verification stays on at the platform level. The function additionally
// requires lamplight_settings.enabled=true for the supplied user_id.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from '../_shared/supabase.ts';
import { embedQuery, type VoyageDeps } from '../_shared/voyage.ts';
import { searchBible } from '../_shared/retrieval.ts';
import { createAnthropicAdapter } from '../_shared/anthropic.ts';
import { extractTextFromNoteContent } from '../_shared/tiptap-text.ts';
import { runSmokeTestPipeline, type SmokeTestContext, type SmokeTestPassage } from './pipeline.ts';
import {
  runDailyDevotionPipeline,
  type DailyDevotionContext,
  type DailyDevotionPassage,
} from './daily-devotion-pipeline.ts';

serve(async (req) => {
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405);

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const voyageKey = Deno.env.get('VOYAGE_AI_KEY');
  if (!anthropicKey) return jsonResp({ error: 'ANTHROPIC_API_KEY missing' }, 500);
  if (!voyageKey)    return jsonResp({ error: 'VOYAGE_AI_KEY missing' }, 500);

  let body: { kind?: string; user_id?: string; local_date?: string };
  try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }
  if (typeof body.user_id !== 'string') return jsonResp({ error: 'bad payload' }, 400);

  const supabase = serviceClient();
  const { data: settings, error: sErr } = await supabase
    .from('lamplight_settings')
    .select('enabled, voice_preference, tradition_hint')
    .eq('user_id', body.user_id)
    .maybeSingle();
  if (sErr) return jsonResp({ error: sErr.message }, 500);
  if (!settings?.enabled) return jsonResp({ error: 'not opted in' }, 403);

  const voyageDeps: VoyageDeps = { apiKey: voyageKey, fetch };
  const rerankEnabled = Deno.env.get('RERANK_ENABLED') === 'true';
  const llm = createAnthropicAdapter({ apiKey: anthropicKey, fetch });
  const voicePreference = (settings.voice_preference as string) ?? 'Lord';
  const traditionHint = (settings.tradition_hint as string) ?? 'unspecified';

  if (body.kind === 'smoke_test') {
    const ctx = await buildSmokeTestContext(supabase, {
      userId: body.user_id, voicePreference, traditionHint, voyageDeps, rerankEnabled,
    });
    const result = await runSmokeTestPipeline({ llm, ctx });
    return jsonResp(result);
  }

  if (body.kind === 'daily_devotion') {
    if (typeof body.local_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.local_date)) {
      return jsonResp({ error: 'bad local_date' }, 400);
    }
    const localDate = body.local_date;
    const ctx = await buildDailyDevotionContext(supabase, {
      userId: body.user_id, localDate, voicePreference, traditionHint, voyageDeps, rerankEnabled,
    });
    const result = await runDailyDevotionPipeline({
      llm, supabase, ctx, userId: body.user_id, localDate,
    });
    return jsonResp(result);
  }

  return jsonResp({ error: 'unknown kind' }, 400);
});

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// ── Smoke-test context builder (unchanged from sub-project 3) ────────────
async function buildSmokeTestContext(
  supabase: SupabaseClient,
  args: { userId: string; voicePreference: string; traditionHint: string; voyageDeps: VoyageDeps; rerankEnabled: boolean },
): Promise<SmokeTestContext | null> {
  const { data: noteRows, error: nErr } = await supabase
    .from('notes')
    .select('id, title, content, updated_at')
    .eq('user_id', args.userId)
    .order('updated_at', { ascending: false })
    .limit(5);
  if (nErr) throw nErr;

  const notes = (noteRows ?? [])
    .map(n => ({
      id: n.id as string,
      title: (n.title as string) ?? '(untitled)',
      plaintext: extractTextFromNoteContent(n.content as string).slice(0, 800),
    }))
    .filter(n => n.plaintext.trim().length > 0);
  if (notes.length === 0) return null;

  const themeQuery = [...notes].sort((a, b) => b.plaintext.length - a.plaintext.length)[0].plaintext;
  const queryEmbedding = await embedQuery(themeQuery, args.voyageDeps);
  const retrievedBible = await searchBible(
    { supabase, voyage: args.voyageDeps, rerankEnabled: args.rerankEnabled },
    { query: themeQuery, k: 3, queryEmbedding },
  );

  const sourceIds = retrievedBible.map(r => r.source_id);
  const { data: passageRows, error: pErr } = await supabase
    .from('bible_passages')
    .select('id, book, chapter, verse_start, verse_end, text')
    .in('id', sourceIds);
  if (pErr) throw pErr;
  const passageById = new Map<string, { book: string; chapter: number; verse_start: number; verse_end: number; text: string }>();
  for (const r of (passageRows ?? []) as Array<{ id: string; book: string; chapter: number; verse_start: number; verse_end: number; text: string }>) {
    passageById.set(r.id, { book: r.book, chapter: r.chapter, verse_start: r.verse_start, verse_end: r.verse_end, text: r.text });
  }
  const passages: SmokeTestPassage[] = retrievedBible
    .map(r => {
      const p = passageById.get(r.source_id);
      if (!p) return null;
      const refSuffix = p.verse_end !== p.verse_start ? `${p.verse_start}-${p.verse_end}` : `${p.verse_start}`;
      const ref = `${p.book} ${p.chapter}:${refSuffix}`;
      return {
        source_id: r.source_id, text: p.text, ref,
        metadata: { book: p.book, chapter: p.chapter, similarity: r.similarity, rerank_score: r.rerank_score },
      };
    })
    .filter((x): x is SmokeTestPassage => x !== null);

  return {
    notes, passages,
    voicePreference: args.voicePreference,
    traditionHint: args.traditionHint,
    allowedNoteIds: new Set(notes.map(n => n.id)),
    allowedVerseRefs: new Set(passages.map(p => p.ref)),
    rerankUsed: args.rerankEnabled && passages.length > 0,
  };
}

// ── Daily devotion context builder ───────────────────────────────────────
async function buildDailyDevotionContext(
  supabase: SupabaseClient,
  args: { userId: string; localDate: string; voicePreference: string; traditionHint: string; voyageDeps: VoyageDeps; rerankEnabled: boolean },
): Promise<DailyDevotionContext | null> {
  const { data: noteRows, error: nErr } = await supabase
    .from('notes')
    .select('id, title, content, updated_at')
    .eq('user_id', args.userId)
    .order('updated_at', { ascending: false })
    .limit(3);
  if (nErr) throw nErr;

  const notes = (noteRows ?? [])
    .map(n => ({
      id: n.id as string,
      title: ((n.title as string) ?? '').trim() || '(untitled)',
      plaintext: extractTextFromNoteContent(n.content as string).slice(0, 800),
    }))
    .filter(n => n.plaintext.trim().length > 0);
  if (notes.length === 0) return null;

  const themeQuery = notes
    .map(n => `${n.title}: ${n.plaintext.slice(0, 200)}`)
    .join('\n\n')
    .slice(0, 4000);
  const queryEmbedding = await embedQuery(themeQuery, args.voyageDeps);
  const retrievedBible = await searchBible(
    { supabase, voyage: args.voyageDeps, rerankEnabled: args.rerankEnabled },
    { query: themeQuery, k: 3, queryEmbedding },
  );

  const sourceIds = retrievedBible.map(r => r.source_id);
  const { data: passageRows, error: pErr } = await supabase
    .from('bible_passages')
    .select('id, book, chapter, verse_start, verse_end, text')
    .in('id', sourceIds);
  if (pErr) throw pErr;
  const passageById = new Map<string, { book: string; chapter: number; verse_start: number; verse_end: number; text: string }>();
  for (const r of (passageRows ?? []) as Array<{ id: string; book: string; chapter: number; verse_start: number; verse_end: number; text: string }>) {
    passageById.set(r.id, { book: r.book, chapter: r.chapter, verse_start: r.verse_start, verse_end: r.verse_end, text: r.text });
  }
  const passages: DailyDevotionPassage[] = retrievedBible
    .map(r => {
      const p = passageById.get(r.source_id);
      if (!p) return null;
      const refSuffix = p.verse_end !== p.verse_start ? `${p.verse_start}-${p.verse_end}` : `${p.verse_start}`;
      const ref = `${p.book} ${p.chapter}:${refSuffix}`;
      return {
        source_id: r.source_id, text: p.text, ref,
        metadata: { book: p.book, chapter: p.chapter, similarity: r.similarity, rerank_score: r.rerank_score },
      };
    })
    .filter((x): x is DailyDevotionPassage => x !== null);

  return {
    notes, passages,
    voicePreference: args.voicePreference,
    traditionHint: args.traditionHint,
    localDate: args.localDate,
    allowedNoteIds: new Set(notes.map(n => n.id)),
    allowedVerseRefs: new Set(passages.map(p => p.ref)),
    rerankUsed: args.rerankEnabled && passages.length > 0,
  };
}
```

- [ ] **Step 2: Confirm TypeScript compiles**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Run all existing tests to confirm no regression**

Run: `npx vitest run`
Expected: PASS — all existing tests continue to work; daily-devotion-pipeline tests pass.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/lamplight-generate/index.ts
git commit -m "feat(lamplight): edge function dispatches on kind (smoke_test | daily_devotion)"
```

---

## Task 12: Extend `LamplightAdapter` interface

**Files:**
- Modify: `src/notepad/storage/lamplight-adapter.ts`

- [ ] **Step 1: Add the new methods + result type to the interface**

Open `src/notepad/storage/lamplight-adapter.ts` and append after the existing `LamplightAdapter` interface (or modify it inline):

```ts
import type { DailyDevotion } from './lamplight-artifacts';

export type DailyDevotionGenerateResult =
  | { ok: true; artifact: DailyDevotion; cached: boolean }
  | { ok: false; reason: 'no_notes' | 'validators_failed' | 'network' };
```

Then add these two method signatures inside the existing `LamplightAdapter` interface (before the closing `}`):

```ts
  /** Returns the persisted daily devotion for (userId, periodKey) if it exists, else null. */
  getDailyDevotion(userId: string, periodKey: string): Promise<DailyDevotion | null>;

  /** Invokes lamplight-generate Edge Function with kind='daily_devotion'. */
  generateDailyDevotion(userId: string, localDate: string): Promise<DailyDevotionGenerateResult>;
```

- [ ] **Step 2: Confirm TypeScript reports failures on the missing implementations**

Run: `npx tsc -b`
Expected: FAIL — both `SupabaseLamplightAdapter` and `FakeLamplightAdapter` are missing the new methods. (We'll fix in Tasks 13–14.)

- [ ] **Step 3: Commit the interface change alone**

This is intentionally committed before the implementations so the diff in Tasks 13–14 is focused on the impls only.

```bash
git add src/notepad/storage/lamplight-adapter.ts
git commit -m "feat(lamplight): add getDailyDevotion + generateDailyDevotion to adapter interface"
```

---

## Task 13: Implement `getDailyDevotion` on Supabase + Fake adapters

**Files:**
- Modify: `src/notepad/storage/supabase-lamplight-adapter.ts`
- Modify: `src/notepad/storage/supabase-lamplight-adapter.test.ts`
- Modify: `src/notepad/storage/fake-lamplight-adapter.ts`
- Modify: `src/notepad/storage/fake-lamplight-adapter.test.ts`

- [ ] **Step 1: Write failing tests for both adapters**

Append to `src/notepad/storage/fake-lamplight-adapter.test.ts`:

```ts
import type { DailyDevotion } from './lamplight-artifacts';

describe('FakeLamplightAdapter.getDailyDevotion', () => {
  it('returns null when nothing is seeded', async () => {
    const fake = new FakeLamplightAdapter();
    expect(await fake.getDailyDevotion('user-1', '2026-05-27')).toBeNull();
  });

  it('returns the seeded artifact for matching (userId, periodKey)', async () => {
    const fake = new FakeLamplightAdapter();
    const devotion: DailyDevotion = {
      opening: 'opening',
      scripture: { ref: 'Psalm 23:4', text: 't' },
      reflection: 'r',
      prompt: 'p',
      note_citations: [{ note_id: 'n1', reason: 'rest' }],
    };
    fake.__seedDailyDevotion('user-1', '2026-05-27', devotion);
    expect(await fake.getDailyDevotion('user-1', '2026-05-27')).toEqual(devotion);
    expect(await fake.getDailyDevotion('user-2', '2026-05-27')).toBeNull();
    expect(await fake.getDailyDevotion('user-1', '2026-05-28')).toBeNull();
  });
});
```

Append to `src/notepad/storage/supabase-lamplight-adapter.test.ts`:

```ts
import type { DailyDevotion } from './lamplight-artifacts';

describe('SupabaseLamplightAdapter.getDailyDevotion', () => {
  it('returns the body field from the matching row', async () => {
    const devotion: DailyDevotion = {
      opening: 'opening', scripture: { ref: 'Psalm 23:4', text: 't' },
      reflection: 'r', prompt: 'p',
      note_citations: [{ note_id: 'n1', reason: 'rest' }],
    };
    const client = {
      from(table: string) {
        expect(table).toBe('lamplight_artifacts');
        return {
          select: (cols: string) => {
            expect(cols).toBe('body');
            return {
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    async maybeSingle() {
                      return { data: { body: devotion }, error: null };
                    },
                  }),
                }),
              }),
            };
          },
        };
      },
    };
    const adapter = new SupabaseLamplightAdapter(client as unknown as SupabaseClient);
    expect(await adapter.getDailyDevotion('user-1', '2026-05-27')).toEqual(devotion);
  });

  it('returns null when no row exists', async () => {
    const client = {
      from() {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ eq: () => ({ async maybeSingle() { return { data: null, error: null }; } }) }) }),
          }),
        };
      },
    };
    const adapter = new SupabaseLamplightAdapter(client as unknown as SupabaseClient);
    expect(await adapter.getDailyDevotion('user-1', '2026-05-27')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npx vitest run src/notepad/storage/fake-lamplight-adapter.test.ts src/notepad/storage/supabase-lamplight-adapter.test.ts`
Expected: FAIL — `getDailyDevotion` not implemented on either adapter.

- [ ] **Step 3: Implement on `FakeLamplightAdapter`**

In `src/notepad/storage/fake-lamplight-adapter.ts`:

a) Add a top-level import:

```ts
import type { DailyDevotion } from './lamplight-artifacts';
```

b) Inside the class body, add a backing store + a seed helper + the method:

```ts
  dailyDevotions = new Map<string, DailyDevotion>(); // key: `${userId}:${periodKey}`

  __seedDailyDevotion(userId: string, periodKey: string, artifact: DailyDevotion): void {
    this.dailyDevotions.set(`${userId}:${periodKey}`, artifact);
  }

  async getDailyDevotion(userId: string, periodKey: string): Promise<DailyDevotion | null> {
    return this.dailyDevotions.get(`${userId}:${periodKey}`) ?? null;
  }
```

c) Update `deleteAllUserData` to also clear daily devotions for the user:

```ts
  async deleteAllUserData(userId: string): Promise<void> {
    this.deleteAllUserDataCalls.push(userId);
    this.settings.delete(userId);
    this.entitlements.delete(userId);
    for (const key of [...this.dailyDevotions.keys()]) {
      if (key.startsWith(`${userId}:`)) this.dailyDevotions.delete(key);
    }
  }
```

- [ ] **Step 4: Implement on `SupabaseLamplightAdapter`**

In `src/notepad/storage/supabase-lamplight-adapter.ts`:

a) Add a top-level import:

```ts
import type { DailyDevotion } from './lamplight-artifacts';
```

b) Add the method inside the class body:

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
```

- [ ] **Step 5: Run the tests, confirm they pass**

Run: `npx vitest run src/notepad/storage/fake-lamplight-adapter.test.ts src/notepad/storage/supabase-lamplight-adapter.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/notepad/storage/supabase-lamplight-adapter.ts src/notepad/storage/supabase-lamplight-adapter.test.ts src/notepad/storage/fake-lamplight-adapter.ts src/notepad/storage/fake-lamplight-adapter.test.ts
git commit -m "feat(lamplight): adapters — getDailyDevotion read path"
```

---

## Task 14: Implement `generateDailyDevotion` on Supabase + Fake adapters

**Files:**
- Modify: `src/notepad/storage/supabase-lamplight-adapter.ts`
- Modify: `src/notepad/storage/supabase-lamplight-adapter.test.ts`
- Modify: `src/notepad/storage/fake-lamplight-adapter.ts`
- Modify: `src/notepad/storage/fake-lamplight-adapter.test.ts`

- [ ] **Step 1: Write failing tests for both**

Append to `src/notepad/storage/fake-lamplight-adapter.test.ts`:

```ts
describe('FakeLamplightAdapter.generateDailyDevotion', () => {
  const devotion: DailyDevotion = {
    opening: 'op', scripture: { ref: 'Psalm 23:4', text: 't' },
    reflection: 'r', prompt: 'p',
    note_citations: [{ note_id: 'n1', reason: 'rest' }],
  };

  it('returns the next queued result and persists artifact to the read store on success', async () => {
    const fake = new FakeLamplightAdapter();
    fake.__queueGenerateResult({ ok: true, artifact: devotion, cached: false });
    const result = await fake.generateDailyDevotion('user-1', '2026-05-27');
    expect(result).toEqual({ ok: true, artifact: devotion, cached: false });
    expect(await fake.getDailyDevotion('user-1', '2026-05-27')).toEqual(devotion);
  });

  it('returns the queued failure result without persisting', async () => {
    const fake = new FakeLamplightAdapter();
    fake.__queueGenerateResult({ ok: false, reason: 'no_notes' });
    const result = await fake.generateDailyDevotion('user-1', '2026-05-27');
    expect(result).toEqual({ ok: false, reason: 'no_notes' });
    expect(await fake.getDailyDevotion('user-1', '2026-05-27')).toBeNull();
  });

  it('defaults to network failure when no result is queued', async () => {
    const fake = new FakeLamplightAdapter();
    const result = await fake.generateDailyDevotion('user-1', '2026-05-27');
    expect(result).toEqual({ ok: false, reason: 'network' });
  });
});
```

Append to `src/notepad/storage/supabase-lamplight-adapter.test.ts`:

```ts
describe('SupabaseLamplightAdapter.generateDailyDevotion', () => {
  const devotion: DailyDevotion = {
    opening: 'op', scripture: { ref: 'Psalm 23:4', text: 't' },
    reflection: 'r', prompt: 'p',
    note_citations: [{ note_id: 'n1', reason: 'rest' }],
  };

  it('returns ok:true with artifact and cached flag from the function response', async () => {
    const client = {
      functions: {
        async invoke(name: string, opts: { body: unknown }) {
          expect(name).toBe('lamplight-generate');
          expect(opts.body).toEqual({ kind: 'daily_devotion', user_id: 'user-1', local_date: '2026-05-27' });
          return { data: { ok: true, artifact: devotion, cached: false }, error: null };
        },
      },
    };
    const adapter = new SupabaseLamplightAdapter(client as unknown as SupabaseClient);
    const result = await adapter.generateDailyDevotion('user-1', '2026-05-27');
    expect(result).toEqual({ ok: true, artifact: devotion, cached: false });
  });

  it('maps ok:false reasons through unchanged', async () => {
    for (const reason of ['no_notes', 'validators_failed'] as const) {
      const client = {
        functions: {
          async invoke() { return { data: { ok: false, reason }, error: null }; },
        },
      };
      const adapter = new SupabaseLamplightAdapter(client as unknown as SupabaseClient);
      expect(await adapter.generateDailyDevotion('user-1', '2026-05-27')).toEqual({ ok: false, reason });
    }
  });

  it('returns network reason on functions.invoke error', async () => {
    const client = {
      functions: {
        async invoke() { return { data: null, error: { message: 'transport' } }; },
      },
    };
    const adapter = new SupabaseLamplightAdapter(client as unknown as SupabaseClient);
    expect(await adapter.generateDailyDevotion('user-1', '2026-05-27')).toEqual({ ok: false, reason: 'network' });
  });

  it('returns network reason on thrown error', async () => {
    const client = {
      functions: {
        async invoke() { throw new Error('boom'); },
      },
    };
    const adapter = new SupabaseLamplightAdapter(client as unknown as SupabaseClient);
    expect(await adapter.generateDailyDevotion('user-1', '2026-05-27')).toEqual({ ok: false, reason: 'network' });
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npx vitest run src/notepad/storage/fake-lamplight-adapter.test.ts src/notepad/storage/supabase-lamplight-adapter.test.ts`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement on `FakeLamplightAdapter`**

Add to the class:

```ts
  private queuedGenerateResults: DailyDevotionGenerateResult[] = [];

  __queueGenerateResult(result: DailyDevotionGenerateResult): void {
    this.queuedGenerateResults.push(result);
  }

  async generateDailyDevotion(userId: string, localDate: string): Promise<DailyDevotionGenerateResult> {
    const next = this.queuedGenerateResults.shift();
    if (!next) return { ok: false, reason: 'network' };
    if (next.ok) {
      this.dailyDevotions.set(`${userId}:${localDate}`, next.artifact);
    }
    return next;
  }
```

Add the import at the top:

```ts
import type { LamplightAdapter, /* existing imports */ DailyDevotionGenerateResult } from './lamplight-adapter';
```

(Merge with the existing `import type` statement.)

- [ ] **Step 4: Implement on `SupabaseLamplightAdapter`**

Add to the class:

```ts
  async generateDailyDevotion(userId: string, localDate: string): Promise<DailyDevotionGenerateResult> {
    try {
      const { data, error } = await this.#client.functions.invoke('lamplight-generate', {
        body: { kind: 'daily_devotion', user_id: userId, local_date: localDate },
      });
      if (error) return { ok: false, reason: 'network' };
      if (!data || typeof data !== 'object') return { ok: false, reason: 'network' };
      const d = data as { ok?: boolean; artifact?: DailyDevotion; cached?: boolean; reason?: string };
      if (d.ok === true && d.artifact) {
        return { ok: true, artifact: d.artifact, cached: !!d.cached };
      }
      if (d.ok === false && (d.reason === 'no_notes' || d.reason === 'validators_failed')) {
        return { ok: false, reason: d.reason };
      }
      return { ok: false, reason: 'network' };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }
```

Add the import at the top:

```ts
import type { /* existing */ DailyDevotionGenerateResult } from './lamplight-adapter';
```

- [ ] **Step 5: Run all adapter tests, confirm they pass**

Run: `npx vitest run src/notepad/storage/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/notepad/storage/supabase-lamplight-adapter.ts src/notepad/storage/supabase-lamplight-adapter.test.ts src/notepad/storage/fake-lamplight-adapter.ts src/notepad/storage/fake-lamplight-adapter.test.ts
git commit -m "feat(lamplight): adapters — generateDailyDevotion via functions.invoke"
```

---

## Task 15: RLS isolation test for `daily_devotion` rows

**Files:**
- Modify: `src/notepad/storage/lamplight-rls.test.ts`

The existing file uses `userA: { client: SupabaseClient; userId: string }` and `userB` of the same shape inside a `maybeDescribe` block gated by env vars. Each user's own client does inserts and reads; there's no separate service-role client. The `lamplight_artifacts` table allows user inserts via the `auth.uid() = user_id` RLS policy, so user B can seed their own artifact.

- [ ] **Step 1: Add the test inside the existing `maybeDescribe('Lamplight RLS isolation (integration)', …)` block**

Append to `src/notepad/storage/lamplight-rls.test.ts`:

```ts
  it("user A cannot read user B's daily_devotion artifact via the adapter", async () => {
    const periodKey = `rls-${Date.now()}`;
    // userB inserts their own daily_devotion row.
    const { error: insErr } = await userB.client.from('lamplight_artifacts').insert({
      user_id: userB.userId,
      type: 'daily_devotion',
      period_key: periodKey,
      title: '',
      body: {
        opening: 'op',
        scripture: { ref: 'Psalm 23:4', text: 't' },
        reflection: 'r',
        prompt: 'p',
        note_citations: [{ note_id: 'n', reason: 'r' }],
      },
      source_note_ids: [],
      source_verses: ['Psalm 23:4'],
      model_used: 'claude-sonnet-4-6',
      prompt_version: 'daily-devotion-2026-05-27-v1',
    });
    expect(insErr).toBeNull();

    // userA cannot see it via the adapter.
    const adapterA = new SupabaseLamplightAdapter(userA.client);
    expect(await adapterA.getDailyDevotion(userB.userId, periodKey)).toBeNull();

    // Cleanup — userB deletes their own row.
    await userB.client.from('lamplight_artifacts').delete().eq('period_key', periodKey);
  });
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/notepad/storage/lamplight-rls.test.ts`
Expected: PASS if the `SUPABASE_TEST_*` env vars are configured; otherwise the entire suite is `describe.skip`-ped, which is the existing pattern. Skipping is not a failure — validate by inspection that the test code matches the established `userA` / `userB` shape.

- [ ] **Step 3: Commit**

```bash
git add src/notepad/storage/lamplight-rls.test.ts
git commit -m "test(lamplight): RLS isolation for daily_devotion artifact rows"
```

---

## Task 16: Build `useTodaysLamp` hook

**Files:**
- Create: `src/notepad/hooks/useTodaysLamp.ts`
- Create: `src/notepad/hooks/useTodaysLamp.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/notepad/hooks/useTodaysLamp.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTodaysLamp } from './useTodaysLamp';
import { FakeLamplightAdapter } from '../storage/fake-lamplight-adapter';
import type { DailyDevotion } from '../storage/lamplight-artifacts';

const devotion: DailyDevotion = {
  opening: 'op',
  scripture: { ref: 'Psalm 23:4', text: 't' },
  reflection: 'r',
  prompt: 'p',
  note_citations: [{ note_id: 'n1', reason: 'rest' }],
};

describe('useTodaysLamp', () => {
  it('renders existing artifact without invoking generate', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedDailyDevotion('user-1', '2026-05-27', devotion);
    const generateSpy = vi.spyOn(adapter, 'generateDailyDevotion');
    const { result } = renderHook(() =>
      useTodaysLamp({ adapter, userId: 'user-1', localDate: '2026-05-27' }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    if (result.current.state.phase === 'ready') {
      expect(result.current.state.artifact).toEqual(devotion);
    }
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it('generates when no existing artifact, transitions through loading to ready', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__queueGenerateResult({ ok: true, artifact: devotion, cached: false });
    const { result } = renderHook(() =>
      useTodaysLamp({ adapter, userId: 'user-1', localDate: '2026-05-27', loadingStepIntervalMs: 10 }),
    );
    expect(result.current.state.phase).toBe('loading');
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    if (result.current.state.phase === 'ready') {
      expect(result.current.state.artifact).toEqual(devotion);
    }
  });

  it('advances loadingStep on the configured interval', async () => {
    vi.useFakeTimers();
    const adapter = new FakeLamplightAdapter();
    // Never resolve the generate call so loading state persists.
    adapter.generateDailyDevotion = (() => new Promise(() => {})) as typeof adapter.generateDailyDevotion;
    const { result } = renderHook(() =>
      useTodaysLamp({ adapter, userId: 'user-1', localDate: '2026-05-27', loadingStepIntervalMs: 1000 }),
    );
    if (result.current.state.phase !== 'loading') throw new Error('expected loading');
    expect(result.current.state.loadingStep).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    if (result.current.state.phase !== 'loading') throw new Error('expected loading');
    expect(result.current.state.loadingStep).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    if (result.current.state.phase !== 'loading') throw new Error('expected loading');
    expect(result.current.state.loadingStep).toBe(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    if (result.current.state.phase !== 'loading') throw new Error('expected loading');
    expect(result.current.state.loadingStep).toBe(2); // capped at 2
    vi.useRealTimers();
  });

  it('transitions to error state with reason on failure', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__queueGenerateResult({ ok: false, reason: 'validators_failed' });
    const { result } = renderHook(() =>
      useTodaysLamp({ adapter, userId: 'user-1', localDate: '2026-05-27', loadingStepIntervalMs: 10 }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    if (result.current.state.phase === 'error') {
      expect(result.current.state.reason).toBe('validators_failed');
    }
  });

  it('retry re-runs the fetch-or-generate flow', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__queueGenerateResult({ ok: false, reason: 'network' });
    adapter.__queueGenerateResult({ ok: true, artifact: devotion, cached: false });
    const { result } = renderHook(() =>
      useTodaysLamp({ adapter, userId: 'user-1', localDate: '2026-05-27', loadingStepIntervalMs: 10 }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    act(() => { result.current.retry(); });
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npx vitest run src/notepad/hooks/useTodaysLamp.test.tsx`
Expected: FAIL — `useTodaysLamp` not exported.

- [ ] **Step 3: Implement `useTodaysLamp`**

Create `src/notepad/hooks/useTodaysLamp.ts`:

```ts
import { useEffect, useRef, useState, useCallback } from 'react';
import type { LamplightAdapter } from '../storage/lamplight-adapter';
import type { DailyDevotion } from '../storage/lamplight-artifacts';

export type TodaysLampState =
  | { phase: 'loading'; loadingStep: 0 | 1 | 2 }
  | { phase: 'ready'; artifact: DailyDevotion }
  | { phase: 'error'; reason: 'no_notes' | 'validators_failed' | 'network' };

export interface UseTodaysLampArgs {
  adapter: LamplightAdapter;
  userId: string;
  localDate: string;
  loadingStepIntervalMs?: number;
}

export interface UseTodaysLampResult {
  state: TodaysLampState;
  retry: () => void;
}

export function useTodaysLamp(args: UseTodaysLampArgs): UseTodaysLampResult {
  const { adapter, userId, localDate, loadingStepIntervalMs = 2500 } = args;
  const [state, setState] = useState<TodaysLampState>({ phase: 'loading', loadingStep: 0 });
  const [generation, setGeneration] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    const myGen = generation;
    let step: 0 | 1 | 2 = 0;
    setState({ phase: 'loading', loadingStep: 0 });

    const interval = setInterval(() => {
      if (cancelledRef.current) return;
      step = (Math.min(step + 1, 2) as 0 | 1 | 2);
      setState(prev => prev.phase === 'loading' ? { phase: 'loading', loadingStep: step } : prev);
    }, loadingStepIntervalMs);

    (async () => {
      try {
        const existing = await adapter.getDailyDevotion(userId, localDate);
        if (cancelledRef.current || myGen !== generation) return;
        if (existing) {
          clearInterval(interval);
          setState({ phase: 'ready', artifact: existing });
          return;
        }
        const result = await adapter.generateDailyDevotion(userId, localDate);
        if (cancelledRef.current || myGen !== generation) return;
        clearInterval(interval);
        if (result.ok) {
          setState({ phase: 'ready', artifact: result.artifact });
        } else {
          setState({ phase: 'error', reason: result.reason });
        }
      } catch {
        if (cancelledRef.current || myGen !== generation) return;
        clearInterval(interval);
        setState({ phase: 'error', reason: 'network' });
      }
    })();

    return () => { clearInterval(interval); };
  }, [adapter, userId, localDate, loadingStepIntervalMs, generation]);

  const retry = useCallback(() => {
    setGeneration(g => g + 1);
  }, []);

  return { state, retry };
}
```

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npx vitest run src/notepad/hooks/useTodaysLamp.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/hooks/useTodaysLamp.ts src/notepad/hooks/useTodaysLamp.test.tsx
git commit -m "feat(lamplight): useTodaysLamp hook — fetch-or-generate orchestration"
```

---

## Task 17: Build `TodaysLampLoading` component

**Files:**
- Create: `src/notepad/components/lamplight/TodaysLampLoading.tsx`
- Create: `src/notepad/components/lamplight/TodaysLampLoading.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/notepad/components/lamplight/TodaysLampLoading.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TodaysLampLoading } from './TodaysLampLoading';

describe('TodaysLampLoading', () => {
  it('renders step 0 copy', () => {
    render(<TodaysLampLoading step={0} />);
    expect(screen.getByText(/Reading your recent notes/i)).toBeInTheDocument();
  });

  it('renders step 1 copy', () => {
    render(<TodaysLampLoading step={1} />);
    expect(screen.getByText(/Searching Scripture/i)).toBeInTheDocument();
  });

  it('renders step 2 copy', () => {
    render(<TodaysLampLoading step={2} />);
    expect(screen.getByText(/Bringing them into conversation/i)).toBeInTheDocument();
  });

  it('sets aria-live=polite on the status text', () => {
    render(<TodaysLampLoading step={0} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/notepad/components/lamplight/TodaysLampLoading.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the component**

Create `src/notepad/components/lamplight/TodaysLampLoading.tsx`:

```tsx
const LOADING_COPY = [
  'Reading your recent notes…',
  'Searching Scripture…',
  'Bringing them into conversation…',
] as const;

export interface TodaysLampLoadingProps {
  step: 0 | 1 | 2;
}

export function TodaysLampLoading({ step }: TodaysLampLoadingProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[420px] px-6 text-center"
      style={{ background: 'var(--alabaster)' }}
    >
      <div className="text-3xl mb-3 animate-pulse" aria-hidden>🕯</div>
      <p
        className="text-xs"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        role="status"
        aria-live="polite"
      >
        {LOADING_COPY[step]}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npx vitest run src/notepad/components/lamplight/TodaysLampLoading.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/TodaysLampLoading.tsx src/notepad/components/lamplight/TodaysLampLoading.test.tsx
git commit -m "feat(lamplight): TodaysLampLoading — 3-step progressive loader"
```

---

## Task 18: Build `TodaysLampError` component

**Files:**
- Create: `src/notepad/components/lamplight/TodaysLampError.tsx`
- Create: `src/notepad/components/lamplight/TodaysLampError.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/notepad/components/lamplight/TodaysLampError.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TodaysLampError } from './TodaysLampError';

describe('TodaysLampError', () => {
  it('renders validators_failed copy with retry button', () => {
    const onRetry = vi.fn();
    render(<TodaysLampError reason="validators_failed" onRetry={onRetry} />);
    expect(screen.getByText(/Lamplight had trouble/i)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /Try again/i });
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders network copy with retry button', () => {
    render(<TodaysLampError reason="network" onRetry={() => {}} />);
    expect(screen.getByText(/Couldn’t reach Lamplight|Couldn't reach Lamplight/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
  });

  it('renders no_notes copy without retry button', () => {
    render(<TodaysLampError reason="no_notes" onRetry={() => {}} />);
    expect(screen.getByText(/needs your notes/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Try again/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npx vitest run src/notepad/components/lamplight/TodaysLampError.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

Create `src/notepad/components/lamplight/TodaysLampError.tsx`:

```tsx
export type TodaysLampErrorReason = 'no_notes' | 'validators_failed' | 'network';

export interface TodaysLampErrorProps {
  reason: TodaysLampErrorReason;
  onRetry: () => void;
}

const ERROR_COPY: Record<TodaysLampErrorReason, { heading: string; body: string }> = {
  no_notes: {
    heading: 'Lamplight needs your notes to begin.',
    body: 'Write a few entries in the notepad and come back. Today’s lamp draws from what you’ve been writing.',
  },
  validators_failed: {
    heading: 'Lamplight had trouble lighting today.',
    body: 'Something didn’t come together this time. Try again in a moment.',
  },
  network: {
    heading: 'Couldn’t reach Lamplight just now.',
    body: 'Check your connection and try again.',
  },
};

export function TodaysLampError({ reason, onRetry }: TodaysLampErrorProps) {
  const copy = ERROR_COPY[reason];
  const showRetry = reason !== 'no_notes';
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[420px] px-6 text-center"
      style={{ background: 'var(--alabaster)' }}
    >
      <div className="text-3xl mb-3" aria-hidden>🕯</div>
      <h3
        className="text-base mb-2"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
      >
        {copy.heading}
      </h3>
      <p
        className="text-xs mb-4 max-w-[320px]"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        {copy.body}
      </p>
      {showRetry && (
        <button
          onClick={onRetry}
          className="text-[11px] underline cursor-pointer"
          style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npx vitest run src/notepad/components/lamplight/TodaysLampError.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/TodaysLampError.tsx src/notepad/components/lamplight/TodaysLampError.test.tsx
git commit -m "feat(lamplight): TodaysLampError — three error states + retry"
```

---

## Task 19: Build `TodaysLampCard` component

**Files:**
- Create: `src/notepad/components/lamplight/TodaysLampCard.tsx`
- Create: `src/notepad/components/lamplight/TodaysLampCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/notepad/components/lamplight/TodaysLampCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TodaysLampCard } from './TodaysLampCard';
import { FakeLamplightAdapter } from '../../storage/fake-lamplight-adapter';
import type { DailyDevotion } from '../../storage/lamplight-artifacts';

function renderCard(adapter: FakeLamplightAdapter) {
  return render(
    <MemoryRouter>
      <TodaysLampCard
        adapter={adapter}
        userId="user-1"
        localDate="2026-05-27"
        voicePreference="Lord"
        traditionHint="unspecified"
      />
    </MemoryRouter>
  );
}

const devotion: DailyDevotion = {
  opening: 'A quiet greeting, friend.',
  scripture: { ref: 'Psalm 23:4', text: 'Even though I walk through the valley…' },
  reflection: 'This passage may speak to weariness.',
  prompt: 'What part of this verse reaches you today?',
  note_citations: [
    { note_id: 'n1', reason: 'recurring rest' },
    { note_id: 'n2', reason: 'evening anxiety' },
  ],
};

describe('TodaysLampCard', () => {
  it('renders all sections when an artifact exists', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedDailyDevotion('user-1', '2026-05-27', devotion);
    renderCard(adapter);
    await waitFor(() => expect(screen.getByText(/A quiet greeting/)).toBeInTheDocument());
    expect(screen.getByText(/Psalm 23:4/)).toBeInTheDocument();
    expect(screen.getByText(/Even though I walk/)).toBeInTheDocument();
    expect(screen.getByText(/This passage may speak/)).toBeInTheDocument();
    expect(screen.getByText(/What part of this verse/)).toBeInTheDocument();
    expect(screen.getByText(/recurring rest/)).toBeInTheDocument();
    expect(screen.getByText(/evening anxiety/)).toBeInTheDocument();
  });

  it('renders the voice/tradition footer + edit-prefs link', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedDailyDevotion('user-1', '2026-05-27', devotion);
    renderCard(adapter);
    await waitFor(() => expect(screen.getByText(/A quiet greeting/)).toBeInTheDocument());
    expect(screen.getByText(/Voice: Lord/)).toBeInTheDocument();
    expect(screen.getByText(/Tradition: unspecified/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit preferences/i })).toHaveAttribute('href', '/profile');
  });

  it('shows the error state with retry when generation fails', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__queueGenerateResult({ ok: false, reason: 'validators_failed' });
    renderCard(adapter);
    await waitFor(() => expect(screen.getByText(/Lamplight had trouble/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npx vitest run src/notepad/components/lamplight/TodaysLampCard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

Create `src/notepad/components/lamplight/TodaysLampCard.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { useTodaysLamp } from '../../hooks/useTodaysLamp';
import type { LamplightAdapter, LamplightVoice, LamplightTradition } from '../../storage/lamplight-adapter';
import type { DailyDevotion } from '../../storage/lamplight-artifacts';
import { TodaysLampLoading } from './TodaysLampLoading';
import { TodaysLampError } from './TodaysLampError';

export interface TodaysLampCardProps {
  adapter: LamplightAdapter;
  userId: string;
  localDate: string;
  voicePreference: LamplightVoice;
  traditionHint: LamplightTradition;
}

export function TodaysLampCard({
  adapter, userId, localDate, voicePreference, traditionHint,
}: TodaysLampCardProps) {
  const { state, retry } = useTodaysLamp({ adapter, userId, localDate });

  if (state.phase === 'loading') return <TodaysLampLoading step={state.loadingStep} />;
  if (state.phase === 'error')   return <TodaysLampError reason={state.reason} onRetry={retry} />;

  return (
    <Devotion
      artifact={state.artifact}
      localDate={localDate}
      voicePreference={voicePreference}
      traditionHint={traditionHint}
    />
  );
}

function Devotion(props: {
  artifact: DailyDevotion;
  localDate: string;
  voicePreference: LamplightVoice;
  traditionHint: LamplightTradition;
}) {
  const { artifact, localDate, voicePreference, traditionHint } = props;
  return (
    <div
      className="px-6 py-6 max-w-[640px] mx-auto"
      style={{ background: 'var(--alabaster)' }}
    >
      <div
        className="flex items-center gap-2 mb-5 text-[11px]"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        <span aria-hidden>🕯</span>
        <span>Today · {formatLocalDate(localDate)}</span>
      </div>

      <p
        className="mb-6 text-sm leading-relaxed"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        {artifact.opening}
      </p>

      <div
        className="border-t border-b py-4 mb-6"
        style={{ borderColor: 'var(--pale-stone)' }}
      >
        <div
          className="text-[11px] mb-2 uppercase tracking-wider"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          {artifact.scripture.ref}
        </div>
        <p
          className="text-lg italic leading-relaxed"
          style={{ color: 'var(--deep-umber)', fontFamily: 'Cormorant Garamond, serif' }}
        >
          {artifact.scripture.text}
        </p>
      </div>

      <p
        className="mb-6 text-sm leading-relaxed"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        {artifact.reflection}
      </p>

      <p
        className="mb-6 text-sm italic pl-4 border-l-2 leading-relaxed"
        style={{
          color: 'var(--deep-umber)',
          fontFamily: 'Outfit, sans-serif',
          borderColor: 'var(--pale-stone)',
        }}
      >
        {artifact.prompt}
      </p>

      <div
        className="border-t pt-4 mb-4 text-[11px]"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif', borderColor: 'var(--pale-stone)' }}
      >
        <div className="mb-1">Drawing from your notes about:</div>
        <ul className="list-disc list-inside space-y-0.5">
          {artifact.note_citations.map((c, i) => (
            <li key={`${c.note_id}-${i}`}>{c.reason}</li>
          ))}
        </ul>
      </div>

      <div
        className="flex items-center gap-3 text-[11px]"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif', opacity: 0.7 }}
      >
        <span>Voice: {voicePreference}</span>
        <span aria-hidden>·</span>
        <span>Tradition: {traditionHint}</span>
        <span aria-hidden>·</span>
        <Link to="/profile" className="underline" style={{ color: 'var(--deep-umber)' }}>
          Edit preferences →
        </Link>
      </div>
    </div>
  );
}

function formatLocalDate(localDate: string): string {
  // 2026-05-27 → "May 27"
  const [y, m, d] = localDate.split('-').map(s => Number.parseInt(s, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}
```

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npx vitest run src/notepad/components/lamplight/TodaysLampCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/TodaysLampCard.tsx src/notepad/components/lamplight/TodaysLampCard.test.tsx
git commit -m "feat(lamplight): TodaysLampCard — the artifact card"
```

---

## Task 20: Wire into `LamplightTabPanel` + delete `OptedInPlaceholder`

**Files:**
- Modify: `src/notepad/components/lamplight/LamplightTabPanel.tsx`
- Modify: `src/notepad/components/lamplight/LamplightTabPanel.test.tsx`
- Delete: `src/notepad/components/lamplight/OptedInPlaceholder.tsx`
- Delete: `src/notepad/components/lamplight/OptedInPlaceholder.test.tsx`

- [ ] **Step 1: Update the failing tests**

Open `src/notepad/components/lamplight/LamplightTabPanel.test.tsx`. Find any assertion that expects the placeholder copy (`"You're set up."` / `"Lamplight will appear here when ready."`) in the opted-in + entitled branch and change them to expect the `TodaysLampCard` rendering instead. Replace those assertions with something like:

```tsx
import type { DailyDevotion } from '../../storage/lamplight-artifacts';

const devotion: DailyDevotion = {
  opening: 'A quiet greeting test.',
  scripture: { ref: 'Psalm 23:4', text: 't' },
  reflection: 'r', prompt: 'p',
  note_citations: [{ note_id: 'n1', reason: 'rest' }],
};

// In the test that renders the opted-in entitled state:
adapter.__seedDailyDevotion(userId, expectedLocalDateString, devotion);
await waitFor(() => expect(screen.getByText(/A quiet greeting test/)).toBeInTheDocument());
```

The `expectedLocalDateString` must equal whatever `new Date().toLocaleDateString('en-CA')` returns at test time. To make this deterministic, the test can stub `Date` or pass an injected `localDate` if the component accepts one — but `LamplightTabPanel` doesn't accept a date prop. To keep the test stable, freeze `Date.now()` with `vi.setSystemTime` at the start of the test:

```ts
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-27T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});
```

Then `new Date().toLocaleDateString('en-CA')` returns a deterministic value derived from the system timezone — locally this is fine; in CI it should also be deterministic if the runner timezone is consistent. (If the test proves flaky across timezones, refactor to accept the `localDate` as a prop on `LamplightTabPanel` and inject it; out of scope here unless required.)

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/notepad/components/lamplight/LamplightTabPanel.test.tsx`
Expected: FAIL — old assertions on placeholder text no longer match because the component still renders `OptedInPlaceholder`.

- [ ] **Step 3: Update `LamplightTabPanel.tsx`**

In `src/notepad/components/lamplight/LamplightTabPanel.tsx`:

a) Replace the import:

```ts
// REMOVE
import { OptedInPlaceholder } from './OptedInPlaceholder';
// ADD
import { TodaysLampCard } from './TodaysLampCard';
```

b) Replace the final return in the opted-in + entitled branch:

```tsx
  // REMOVE:
  return (
    <OptedInPlaceholder
      voicePreference={settingsState.settings.voicePreference}
      traditionHint={settingsState.settings.traditionHint}
    />
  );

  // ADD:
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
```

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npx vitest run src/notepad/components/lamplight/LamplightTabPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Delete `OptedInPlaceholder.tsx` and its test**

```bash
rm src/notepad/components/lamplight/OptedInPlaceholder.tsx
rm src/notepad/components/lamplight/OptedInPlaceholder.test.tsx
```

- [ ] **Step 6: Verify nothing else imports `OptedInPlaceholder`**

Run: `grep -rn "OptedInPlaceholder" src/ supabase/`
Expected: NO output. (If anything remains, fix those callsites.)

- [ ] **Step 7: Commit**

```bash
git add src/notepad/components/lamplight/LamplightTabPanel.tsx src/notepad/components/lamplight/LamplightTabPanel.test.tsx
git add -u src/notepad/components/lamplight/OptedInPlaceholder.tsx src/notepad/components/lamplight/OptedInPlaceholder.test.tsx
git commit -m "feat(lamplight): TodaysLampCard replaces OptedInPlaceholder in tab"
```

---

## Task 21: Final QA — lint + typecheck + full test run

**Files:**
- (Verify only — no edits unless something fails.)

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: PASS. If errors are reported, fix them inline (do not disable rules to make them go away).

- [ ] **Step 2: Run TypeScript build**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Run the full vitest suite**

Run: `npm test`
Expected: PASS. Every test in the repo green.

- [ ] **Step 4: Run a targeted check for the spec's acceptance criteria**

Manually verify each acceptance criterion from `docs/superpowers/specs/2026-05-27-todays-lamp-design.md` against the test files:

| AC | Where verified |
|---|---|
| 1: Edge fn dispatches on `kind` | smoke-test tests still pass + daily-devotion-pipeline tests pass; index.ts inspected. |
| 2: Validates `local_date` | index.ts inspection (regex `^\d{4}-\d{2}-\d{2}$`). |
| 3: Opted-out → 403 | index.ts inspection (unchanged from sub-project 3). |
| 4: Happy path | `runDailyDevotionPipeline > happy path` test. |
| 5: Idempotency | `runDailyDevotionPipeline > idempotency` test. |
| 6: Race | `runDailyDevotionPipeline > race` test. |
| 7: no_notes | `runDailyDevotionPipeline > no_notes` test. |
| 8: Retry-then-pass | `runDailyDevotionPipeline > validator-fail-then-retry` test. |
| 9: Hard fail | `runDailyDevotionPipeline > hard-fail` test. |
| 10: No regenerate on success | Hook test: existing artifact branch does not call `generateDailyDevotion`. |
| 11: Voice fragment composed correctly | Inspection of `composeSystem` call in pipeline; voice.test covers token substitution. |
| 12: Content rules inherited | Pipeline test: banned phrase in reflection triggers hard-fail. |
| 13: `OptedInPlaceholder` deleted | `grep -rn OptedInPlaceholder src/` returns nothing. |
| 14: Footer renders prefs + edit link | `TodaysLampCard > footer` test. |
| 15: Loading copy cycles | `useTodaysLamp > advances loadingStep` test. |
| 16: Provenance fields | `runDailyDevotionPipeline > happy path` test asserts `source_note_ids`, `source_verses`, `prompt_version`. |
| 17: RLS isolation | `lamplight-rls.test.ts` daily_devotion case (Task 15). |
| 18: No regression | Full `npm test` green. |
| 19: All tests pass | Step 3 above. |
| 20: No new env vars | Inspection of `.env.local.example`. |

- [ ] **Step 5: Verify the git log shows discrete commits**

Run: `git log --oneline -30`
Expected: a clean chain of ~20 commits, each with a clear `feat(lamplight): …` or `test(lamplight): …` prefix.

- [ ] **Step 6: (Optional) Push branch to remote for review**

If running on a feature branch:

```bash
git push -u origin HEAD
```

Otherwise, the sub-project is ready for review on `main`.

---

## Notes for the implementer

- **Run only the changed test file while iterating.** `npx vitest run <path>` is faster than the full suite. Save the full `npm test` for the final QA task and after any cross-cutting change (like Task 11's `index.ts` rewrite).
- **Forward type reference between Task 4 and Task 5 is intentional.** Task 4's `daily-devotion.ts` imports `DailyDevotionContext` from the pipeline file that doesn't exist yet. TypeScript will report one error after Task 4 and zero errors after Task 5. Don't be tempted to circular-define the type or duplicate it in both files.
- **`as unknown as` cast in the pipeline's `llm.generate({ tool: ... })` call** is the price of the `tool.input_schema: Record<string, unknown>` typing in `anthropic.ts`. The schema is `as const` in `daily-devotion.ts` for design-time safety; the cast at the boundary is acceptable.
- **Race-handling test uses a single `from(...)` mock that returns whichever shape (`maybeSingle` vs `single`) the pipeline asks for.** This intentionally collapses two distinct query paths into one mock to keep the test compact; production behavior is unaffected.
- **The hook's progressive loader interval is purely a perceived-latency UX device.** It is not synced to the server response. If a step transition lands the same millisecond as the response, the user sees the final state — that's correct.
- **`new Date().toLocaleDateString('en-CA')` is the canonical client-side local-date producer.** It yields `YYYY-MM-DD` reliably in browsers and respects the user's system timezone. Do not substitute `toISOString().slice(0, 10)` — that's UTC and breaks the "local day" guarantee.
- **The smoke-test path is deliberately preserved.** Its removal is a separate cleanup PR (Open follow-up #1 in the spec). Resist the urge to delete it in this slice.
