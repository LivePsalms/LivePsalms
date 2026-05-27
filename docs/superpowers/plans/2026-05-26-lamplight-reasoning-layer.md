# Lamplight Reasoning Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the invisible building blocks of Lamplight's Reasoning Layer — Anthropic-backed `LLMAdapter`, retrieval helpers, deterministic citation + content-rule validators, the shared voice fragment, and a hidden smoke-test prompt that exercises the full pipeline end-to-end. No user-visible surface this slice.

**Architecture:** Pure-`fetch` Deno modules under `supabase/functions/_shared/` (framework-free, dep-injected `fetch`/`sleep` — same pattern as the existing `voyage.ts`). A new Edge Function `lamplight-generate` wires them into a single `{ kind: 'smoke_test', user_id }` endpoint. Database adds two `SECURITY DEFINER` match RPCs that wrap pgvector cosine search server-side. All client-side code remains untouched.

**Tech Stack:** Anthropic Messages API (Sonnet 4.6 + Haiku 4.5) via direct `fetch` and tool-use structured outputs · Voyage `rerank-2.5` (optional, flag-gated) · pgvector HNSW (already in place from sub-project 2) · Deno Edge Functions on Supabase · Vitest (Node) for unit tests.

**Spec:** [docs/superpowers/specs/2026-05-26-lamplight-reasoning-layer-design.md](../specs/2026-05-26-lamplight-reasoning-layer-design.md)

---

## File Structure

**New files (in dependency order):**

| File | Responsibility |
|------|----------------|
| `supabase/migrations/012_lamplight_match_rpcs.sql` | Two `SECURITY DEFINER` RPCs (`match_user_note_embeddings`, `match_bible_embeddings`) wrapping pgvector cosine search. Revoked from `public, authenticated`. |
| `supabase/functions/_shared/voice.ts` | The shared Lamplight system-prompt fragment, the canonical banned-phrase / contested-passage / growth-phrase lists, and `composeSystem()`. |
| `supabase/functions/_shared/voice.test.ts` | Verifies fragment compiles, regex coverage of every banned-phrase rule across tense variants, `composeSystem` substitution behavior. |
| `supabase/functions/_shared/validators.ts` | Pure functions: `validateCitations`, `applyContentRules`, `flattenArtifactText`. Plus the artifact type definitions shared with prompts. |
| `supabase/functions/_shared/validators.test.ts` | Golden + negative artifact fixtures; rule-family coverage. |
| `supabase/functions/_shared/anthropic.ts` | `LLMAdapter` interface + `createAnthropicAdapter(deps)`. Direct `fetch` to Messages API; tool-use parsing; 429/5xx retries. |
| `supabase/functions/_shared/anthropic.test.ts` | Mocked-fetch tests for request shape, tool-use parsing, retry/backoff, error mapping. |
| `supabase/functions/_shared/retrieval.ts` | `searchNeighbors`, `searchBible`. Wraps the new match RPCs + optional Voyage rerank. |
| `supabase/functions/_shared/retrieval.test.ts` | Mocked Supabase + Voyage; per-user isolation; rerank-on vs rerank-off reorder. |
| `supabase/functions/lamplight-generate/deno.json` | Import map. Identical shape to `embed-note/deno.json`. |
| `supabase/functions/lamplight-generate/prompts/smoke-test.ts` | Throwaway prompt template (tool schema + system prompt + `buildMessages`). |
| `supabase/functions/lamplight-generate/pipeline.ts` | `buildSmokeTestContext` + `runSmokeTestPipeline` (generate → validate → maybe-retry → return). |
| `supabase/functions/lamplight-generate/pipeline.test.ts` | Happy path, retry path, hard-fail path, `no_notes` short-circuit. |
| `supabase/functions/lamplight-generate/index.ts` | HTTP shell: env-var checks, payload validation, opted-in check, calls pipeline. |

**Modified files:**

| File | Change |
|------|--------|
| `supabase/functions/_shared/voyage.ts` | Add exported `rerank(query, documents, topK, deps)` calling `https://api.voyageai.com/v1/rerank` with model `rerank-2.5`. Existing `embedDocuments`/`embedQuery` untouched. |
| `supabase/functions/_shared/voyage.test.ts` | Add `rerank` describe block. |
| `src/notepad/storage/lamplight-rls.test.ts` | Add tests that `match_user_note_embeddings` and `match_bible_embeddings` are NOT executable from an authenticated JWT (only service role). |
| `.env.local.example` | Add comment block: `ANTHROPIC_API_KEY` server-only via `supabase secrets set`, plus `RERANK_ENABLED` flag (default off). |

---

## Notes for executors

- **Anthropic API version header:** `anthropic-version: 2023-06-01`. If a 4xx response from Anthropic mentions a different required version, verify against current Anthropic docs via Context7 (`mcp__claude_ai_Context7__query-docs` with `library_id` for `anthropic`/`@anthropic-ai/sdk`) and update the constant in `anthropic.ts`.
- **Voyage rerank shape:** `POST /v1/rerank` body is `{ model, query, documents, top_k? }`; response is `{ data: [{ index, relevance_score }], usage: { total_tokens } }`. If this drifts, verify via Context7 against `voyageai-python` docs.
- **`process.env` in Node test files:** the existing pattern is `declare const process: { env: Record<string, string | undefined> };` at the top of the test file (see `lamplight-rls.test.ts`). Match it.
- **`Deno.env` in Edge Function code:** only allowed in `index.ts` files (HTTP shells). `_shared/*.ts` must not reference `Deno.env` — env values are injected via `deps`. Same discipline as `voyage.ts`.
- **`.ts` extensions on imports:** Edge Function code (`index.ts`, `pipeline.ts`, files importing from `_shared`) uses `.ts` extensions because Deno requires them. Test files (Vitest in Node) drop the extension because Vite resolves either way. Match existing files for whichever module you're in.
- **Commits:** one logical commit per task. Use `feat(lamplight): ...` for new behavior, `test(lamplight): ...` for test-only commits, `fix(lamplight): ...` for fixes. Co-author trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

---

## Task 1: Database migration — match RPCs

**Files:**
- Create: `supabase/migrations/012_lamplight_match_rpcs.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/012_lamplight_match_rpcs.sql`:

```sql
-- 012_lamplight_match_rpcs.sql — pgvector cosine match RPCs for Reasoning Layer.
--
-- Two SECURITY DEFINER functions that wrap the cosine ordering query against
-- lamplight_embeddings so the Edge Function never constructs SQL strings.
-- Both are revoked from public + authenticated; service-role only.
--
-- search_path is pinned to (public, extensions) so the pgvector `<=>` operator
-- resolves inside the function body. This mirrors how migration 011 had to
-- fully-qualify `extensions.vector_cosine_ops` in the HNSW index — operators
-- and operator classes need the extensions schema visible.

create or replace function public.match_user_note_embeddings(
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
set search_path = public, extensions
as $$
  select e.id,
         e.source_id,
         1 - (e.embedding <=> p_query_vector) as similarity,
         e.metadata
    from public.lamplight_embeddings e
   where e.user_id = p_user_id
     and e.source_type = 'note'
     and (p_exclude_source_id is null or e.source_id <> p_exclude_source_id)
   order by e.embedding <=> p_query_vector
   limit p_limit
$$;

create or replace function public.match_bible_embeddings(
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
set search_path = public, extensions
as $$
  select e.id,
         e.source_id,
         1 - (e.embedding <=> p_query_vector) as similarity,
         e.metadata
    from public.lamplight_embeddings e
   where e.user_id is null
     and e.source_type = 'bible_passage'
   order by e.embedding <=> p_query_vector
   limit p_limit
$$;

revoke execute on function public.match_user_note_embeddings(uuid, vector(1024), text, int) from public, authenticated;
revoke execute on function public.match_bible_embeddings(vector(1024), int) from public, authenticated;
```

Verification command in Step 4 also needs the unqualified `vector(1024)` cast.

- [ ] **Step 2: Apply the migration locally**

Run: `supabase db reset`
Expected: every migration applies cleanly through `012_lamplight_match_rpcs.sql` with no errors.

- [ ] **Step 3: Verify the RPCs exist and have the right ACL**

Run:
```bash
supabase db psql --command "\df+ public.match_user_note_embeddings"
supabase db psql --command "\df+ public.match_bible_embeddings"
```
Expected: both functions listed, both with `Volatility: stable` and `Security: definer`. The `Access privileges` column should show `postgres=X/postgres` and `service_role=X/postgres` (service-role inherits postgres) but NOT `authenticated`.

- [ ] **Step 4: Verify a service-role call returns rows**

Run:
```bash
supabase db psql --command "select count(*) from match_bible_embeddings(array_fill(0::real, ARRAY[1024])::vector(1024), 5);"
```
Expected: a number — `0` if BSB has not been ingested in your local env, ≥ 1 if it has. Either is fine; the goal is "function callable, no permission error."

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/012_lamplight_match_rpcs.sql
git commit -m "$(cat <<'EOF'
feat(lamplight): add match RPCs for reasoning-layer retrieval

Two SECURITY DEFINER functions wrapping pgvector cosine search against
lamplight_embeddings. Both revoked from public + authenticated;
service-role is the only legitimate caller (Edge Function).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Voice module (`voice.ts`)

**Files:**
- Create: `supabase/functions/_shared/voice.ts`
- Create: `supabase/functions/_shared/voice.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `supabase/functions/_shared/voice.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  LAMPLIGHT_SYSTEM_FRAGMENT,
  BANNED_PHRASES,
  CONTESTED_PASSAGES,
  GROWTH_BANNED_PHRASES,
  composeSystem,
} from './voice';

describe('LAMPLIGHT_SYSTEM_FRAGMENT', () => {
  it('contains the {{voice_preference}} substitution token', () => {
    expect(LAMPLIGHT_SYSTEM_FRAGMENT).toContain('{{voice_preference}}');
  });

  it('never contains a phrase that would trip its own banned-phrase regex', () => {
    for (const re of BANNED_PHRASES) {
      expect(LAMPLIGHT_SYSTEM_FRAGMENT).not.toMatch(re);
    }
  });

  it('positively names the stance (reveal Scripture, possibility not pronouncement)', () => {
    expect(LAMPLIGHT_SYSTEM_FRAGMENT).toMatch(/reveal what scripture/i);
    expect(LAMPLIGHT_SYSTEM_FRAGMENT).toMatch(/possibility, not pronouncement/i);
  });
});

describe('BANNED_PHRASES — prophetic/oracular coverage', () => {
  const cases: Array<{ name: string; text: string }> = [
    { name: 'present-tense "is telling you"',     text: 'God is telling you to rest.' },
    { name: 'past-tense "told you"',              text: 'The Lord told you to wait.' },
    { name: 'imperative "God wants you to"',      text: 'God wants you to forgive him.' },
    { name: '"the Lord is giving you a word"',    text: 'The Lord is giving you a word about patience.' },
    { name: '"God says to you"',                  text: 'God says to you: be still.' },
    { name: '"the Spirit is saying"',             text: 'The Spirit is saying to you that this season will pass.' },
    { name: '"I sense God is"',                   text: 'I sense God is calling you into deeper rest.' },
    { name: '"God revealed to you"',              text: 'God revealed to you that this is the path.' },
    { name: '"prophetic word over you"',          text: 'A prophetic word over you: a season of new beginnings.' },
    { name: '"your destiny is"',                  text: 'Your destiny is to lead this community.' },
  ];
  for (const c of cases) {
    it(`catches ${c.name}`, () => {
      const hit = BANNED_PHRASES.some(re => re.test(c.text));
      expect(hit, `no banned-phrase regex matched: ${c.text}`).toBe(true);
    });
  }

  it('does NOT match the positive stance language', () => {
    const goodSamples = [
      'Scripture suggests that rest is a gift, not an earning.',
      'This passage may speak to the weariness you have been describing.',
      'For someone walking through what you have described, Psalm 23 often lands as comfort.',
    ];
    for (const s of goodSamples) {
      for (const re of BANNED_PHRASES) {
        expect(re.test(s), `banned regex falsely matched a positive sample: ${s}`).toBe(false);
      }
    }
  });
});

describe('CONTESTED_PASSAGES', () => {
  it('includes the explicit ref list from the spec', () => {
    expect(CONTESTED_PASSAGES).toContain('Revelation 13');
    expect(CONTESTED_PASSAGES).toContain('Romans 9:11');
    expect(CONTESTED_PASSAGES).toContain('1 Timothy 2:12');
    expect(CONTESTED_PASSAGES).toContain('1 Corinthians 11:3');
    expect(CONTESTED_PASSAGES).toContain('Ephesians 1:5');
  });
});

describe('GROWTH_BANNED_PHRASES', () => {
  const cases = [
    '14-day streak',
    "Don't break your streak",
    'keep your streak alive',
    'You missed yesterday',
    'Get back on track',
    'daily streak',
  ];
  for (const c of cases) {
    it(`catches "${c}"`, () => {
      const hit = GROWTH_BANNED_PHRASES.some(re => re.test(c));
      expect(hit).toBe(true);
    });
  }
});

describe('composeSystem', () => {
  it('substitutes {{voice_preference}} with the supplied value', () => {
    const out = composeSystem({
      base: 'Use {{voice_preference}} for the divine name.',
      artifact: '',
      voicePreference: 'Abba',
    });
    expect(out).toContain('Use Abba for the divine name.');
    expect(out).not.toContain('{{voice_preference}}');
  });

  it('replaces every occurrence of the token', () => {
    const out = composeSystem({
      base: '{{voice_preference}} and {{voice_preference}}',
      artifact: '',
      voicePreference: 'Lord',
    });
    expect(out.startsWith('Lord and Lord')).toBe(true);
  });

  it('concatenates base + artifact + stricter with double newlines', () => {
    const out = composeSystem({
      base: 'BASE',
      artifact: 'ARTIFACT',
      voicePreference: 'Lord',
      stricter: 'STRICT',
    });
    expect(out).toBe('BASE\n\nARTIFACT\n\nSTRICT');
  });

  it('omits the stricter section when not supplied', () => {
    const out = composeSystem({
      base: 'BASE',
      artifact: 'ARTIFACT',
      voicePreference: 'Lord',
    });
    expect(out).toBe('BASE\n\nARTIFACT');
  });
});
```

- [ ] **Step 2: Run the tests; they should fail because the file does not exist**

Run: `npx vitest run supabase/functions/_shared/voice.test.ts`
Expected: import error / "cannot find module './voice'".

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/_shared/voice.ts`:

```ts
// Shared Lamplight voice fragment + canonical rule lists.
//
// Every Lamplight artifact's system prompt composes from LAMPLIGHT_SYSTEM_FRAGMENT
// before adding its own task-specific instructions. The banned-phrase, contested-
// passage, and growth-phrase lists are the single source of truth — the doctrinal
// review board (sub-project 6) edits these, not individual artifact prompts.
//
// Framework-free: no Deno or Node globals, no I/O. Importable from anywhere.

export const LAMPLIGHT_SYSTEM_FRAGMENT = `You are Lamplight, a scripture-grounded reflective companion inside a Christian journaling app. You read what the user has written and what Scripture says, and you bring the two into conversation.

How you speak:
- Reveal what Scripture itself says, anchored to the user's notes and recurring themes. Quote the passage when it helps; cite the reference always.
- Offer interpretation as possibility, not pronouncement. Use phrases like "this passage may speak to…", "Scripture suggests…", "for someone walking through what you have described, this verse often…".
- Mirror the user's voice for divine names — use "{{voice_preference}}".
- Be warm, brief, and concrete. Cite every claim.

What you never do:
- You never speak prophetically over the user. You do not claim God is speaking to them through you. You are not a prophet, oracle, or pastor.
- You never interpret contested passages beyond plain reading. When such a passage comes up, name it gently and point the reader to their pastor or study group.
- You never condemn the user's writing. If a note expresses doubt, struggle, or anger toward God, you respond with Scripture about how God meets that — never with rebuke.
- You never give pastoral, mental-health, financial, or medical counsel.
- You never produce streak language, "don't miss a day" prompts, or effort-shaming. Growth in this app is measured by Scripture, not consistency.`;

// Prophetic / oracular patterns. Case-insensitive; word-boundary-aware where useful.
// Tense variants covered: present ("is telling"), past ("told"), imperative/explicit
// ("wants you to", "says to you"). Sub-project 6 (doctrinal review) edits this list.
export const BANNED_PHRASES: RegExp[] = [
  /\b(god|jesus|the\s+lord|the\s+spirit|holy\s+spirit)\s+(is|was|has\s+been)\s+telling\s+you\b/i,
  /\b(god|jesus|the\s+lord)\s+(told|tells|wants?|wanted|is\s+wanting|has\s+wanted)\s+you\s+to\b/i,
  /\b(god|jesus|the\s+lord)\s+says?\s+to\s+you\b/i,
  /\b(god|jesus|the\s+lord|the\s+spirit|holy\s+spirit)\s+(is\s+saying|said|has\s+said)\s+to\s+you\b/i,
  /\b(the\s+lord|god|jesus)\s+is\s+giving\s+you\s+a\s+word\b/i,
  /\bi\s+sense\s+(god|jesus|the\s+lord|the\s+spirit)\s+(is|wants?|wanted|saying|telling)\b/i,
  /\b(god|jesus|the\s+lord|the\s+spirit)\s+(revealed|has\s+revealed|is\s+revealing)\s+to\s+you\b/i,
  /\b(prophesy|prophecy|prophetic\s+word)\s+(over|for)\s+you\b/i,
  /\b(your\s+destiny|your\s+calling)\s+(is|will\s+be)\b/i,
];

// Refs the system declines to interpret beyond plain reading. Substring matchers,
// case-insensitive — see applyContentRules. Sub-project 6 expands or contracts.
export const CONTESTED_PASSAGES: string[] = [
  'Revelation 13', 'Revelation 17', 'Daniel 9', 'Daniel 12',
  '1 Corinthians 11:2', '1 Corinthians 11:3', '1 Corinthians 11:4',
  '1 Corinthians 11:5', '1 Corinthians 11:6', '1 Corinthians 11:7',
  '1 Corinthians 14:34', '1 Corinthians 14:35',
  '1 Timothy 2:11', '1 Timothy 2:12', '1 Timothy 2:13', '1 Timothy 2:14', '1 Timothy 2:15',
  'Romans 9:11', 'Romans 9:12', 'Romans 9:13', 'Romans 9:14', 'Romans 9:15',
  'Romans 9:16', 'Romans 9:17', 'Romans 9:18', 'Romans 9:19', 'Romans 9:20',
  'Romans 9:21', 'Romans 9:22', 'Romans 9:23',
  'Ephesians 1:4', 'Ephesians 1:5',
  'Matthew 24', 'Mark 13', '2 Thessalonians 2',
];

// Streak / effort-shaming language. Growth in this app is Scripture-measured, not consistency-measured.
export const GROWTH_BANNED_PHRASES: RegExp[] = [
  /\b\d+[-\s]?day\s+streak\b/i,
  /\bdon'?t\s+break\s+(your\s+)?streak\b/i,
  /\bkeep\s+(your\s+)?streak\s+(alive|going)\b/i,
  /\byou\s+missed\s+yesterday\b/i,
  /\bget\s+back\s+on\s+track\b/i,
  /\bdaily\s+streak\b/i,
];

export interface ComposeSystemInput {
  base: string;
  artifact: string;
  voicePreference: string;
  stricter?: string;
}

export function composeSystem(input: ComposeSystemInput): string {
  const base = input.base.replace(/\{\{voice_preference\}\}/g, input.voicePreference);
  const parts = [base, input.artifact];
  if (input.stricter && input.stricter.trim().length > 0) parts.push(input.stricter);
  return parts.join('\n\n');
}
```

- [ ] **Step 4: Run the tests; they should pass**

Run: `npx vitest run supabase/functions/_shared/voice.test.ts`
Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/voice.ts supabase/functions/_shared/voice.test.ts
git commit -m "$(cat <<'EOF'
feat(lamplight): voice fragment + canonical rule lists

LAMPLIGHT_SYSTEM_FRAGMENT, BANNED_PHRASES (prophetic/oracular),
CONTESTED_PASSAGES (refs the system won't interpret beyond plain
reading), GROWTH_BANNED_PHRASES (streak/effort-shaming), and
composeSystem() for prompt assembly. Single source of truth — every
Lamplight artifact prompt composes from these.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Validators module (`validators.ts`)

**Files:**
- Create: `supabase/functions/_shared/validators.ts`
- Create: `supabase/functions/_shared/validators.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `supabase/functions/_shared/validators.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  validateCitations,
  applyContentRules,
  flattenArtifactText,
  type ArtifactSection,
} from './validators';
import { BANNED_PHRASES, CONTESTED_PASSAGES, GROWTH_BANNED_PHRASES } from './voice';

function makeArtifact(overrides: Partial<{ opening: string; sections: ArtifactSection[] }> = {}) {
  return {
    opening: 'A short opening grounded in the user\'s notes.',
    sections: [
      {
        heading: 'Anchor',
        body: 'Psalm 23 may speak to the weariness you have described.',
        citations: [{ type: 'verse', ref: 'Psalm 23:4' } as const],
      },
    ],
    ...overrides,
  };
}

describe('flattenArtifactText', () => {
  it('concatenates opening + every section heading + body with double newlines', () => {
    const art = makeArtifact({
      sections: [
        { heading: 'H1', body: 'B1', citations: [{ type: 'verse', ref: 'Ps 1:1' }] },
        { heading: 'H2', body: 'B2', citations: [{ type: 'verse', ref: 'Ps 2:1' }] },
      ],
    });
    expect(flattenArtifactText(art)).toContain('H1');
    expect(flattenArtifactText(art)).toContain('B1');
    expect(flattenArtifactText(art)).toContain('H2');
    expect(flattenArtifactText(art)).toContain('B2');
    expect(flattenArtifactText(art).split('\n\n').length).toBeGreaterThanOrEqual(4); // opening + 2*(heading+body) at least
  });
});

describe('validateCitations', () => {
  const allowedNoteIds = new Set(['note-1', 'note-2']);
  const allowedVerseRefs = new Set(['Psalm 23:4', 'Romans 8:28']);

  it('passes when every section has at least one resolvable citation', () => {
    const art = makeArtifact();
    const r = validateCitations(art, { allowedNoteIds, allowedVerseRefs });
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('flags a section with zero citations', () => {
    const art = makeArtifact({
      sections: [{ heading: 'H', body: 'B', citations: [] }],
    });
    const r = validateCitations(art, { allowedNoteIds, allowedVerseRefs });
    expect(r.ok).toBe(false);
    expect(r.violations[0]).toMatchObject({ section_index: 0, reason: 'no_citations' });
  });

  it('flags a verse citation not in the allowed set', () => {
    const art = makeArtifact({
      sections: [{
        heading: 'H', body: 'B',
        citations: [{ type: 'verse', ref: 'Habakkuk 3:17' }],
      }],
    });
    const r = validateCitations(art, { allowedNoteIds, allowedVerseRefs });
    expect(r.ok).toBe(false);
    expect(r.violations[0]).toMatchObject({ section_index: 0, reason: 'unknown_verse' });
  });

  it('flags a note citation not in the allowed set', () => {
    const art = makeArtifact({
      sections: [{
        heading: 'H', body: 'B',
        citations: [{ type: 'note', ref: 'note-99' }],
      }],
    });
    const r = validateCitations(art, { allowedNoteIds, allowedVerseRefs });
    expect(r.ok).toBe(false);
    expect(r.violations[0]).toMatchObject({ section_index: 0, reason: 'unknown_note' });
  });

  it('does case-normalized matching on verse refs', () => {
    const art = makeArtifact({
      sections: [{
        heading: 'H', body: 'B',
        citations: [{ type: 'verse', ref: 'psalm 23:4' }],
      }],
    });
    const r = validateCitations(art, { allowedNoteIds, allowedVerseRefs });
    expect(r.ok).toBe(true);
  });
});

describe('applyContentRules', () => {
  const baseRules = {
    banned: BANNED_PHRASES,
    contested: CONTESTED_PASSAGES,
    growth: GROWTH_BANNED_PHRASES,
  };

  it('passes a clean reflective text', async () => {
    const r = await applyContentRules(
      'Scripture suggests that rest is a gift. Psalm 23 may speak to your weariness.',
      baseRules,
    );
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('flags banned prophetic language', async () => {
    const r = await applyContentRules('God is telling you to forgive him.', baseRules);
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.family === 'banned')).toBe(true);
  });

  it('flags every BANNED_PHRASES rule when its canonical sample is present', async () => {
    const samples = [
      'God is telling you to rest.',
      'The Lord told you to wait.',
      'The Lord is giving you a word.',
      'God says to you: be still.',
      'The Spirit is saying to you.',
      'I sense God is calling you.',
      'God revealed to you the next step.',
      'A prophetic word over you.',
      'Your destiny is greater than this.',
    ];
    for (const s of samples) {
      const r = await applyContentRules(s, baseRules);
      expect(r.ok, `expected banned-phrase to be caught: "${s}"`).toBe(false);
      expect(r.violations.some(v => v.family === 'banned')).toBe(true);
    }
  });

  it('flags contested passages mentioned by ref', async () => {
    const r = await applyContentRules(
      'On Romans 9:11 specifically, Paul argues that election rests on God\'s purpose.',
      baseRules,
    );
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.family === 'contested')).toBe(true);
  });

  it('flags growth/streak language', async () => {
    const samples = [
      '14-day streak achieved.',
      "Don't break your streak.",
      'You missed yesterday — get back on track.',
    ];
    for (const s of samples) {
      const r = await applyContentRules(s, baseRules);
      expect(r.ok, `growth phrase missed: "${s}"`).toBe(false);
      expect(r.violations.some(v => v.family === 'growth')).toBe(true);
    }
  });

  it('returns an 80-char snippet around each violation', async () => {
    const text = 'Here is a long preamble before the bad part. God is telling you to give. And then more text follows after the violation, which should also appear in the snippet for context.';
    const r = await applyContentRules(text, baseRules);
    expect(r.ok).toBe(false);
    expect(r.violations[0].snippet.length).toBeLessThanOrEqual(120); // 80 + match length
    expect(r.violations[0].snippet).toContain('God is telling you');
  });

  it('invokes the optional classifier slot when supplied', async () => {
    const r = await applyContentRules('clean text', {
      ...baseRules,
      classifier: async () => [{ family: 'banned', rule: 'classifier-rule', snippet: 'x' }],
    });
    expect(r.ok).toBe(false);
    expect(r.violations[0].rule).toBe('classifier-rule');
  });
});
```

- [ ] **Step 2: Run the tests; they should fail**

Run: `npx vitest run supabase/functions/_shared/validators.test.ts`
Expected: import error.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/_shared/validators.ts`:

```ts
// Deterministic validators for Lamplight artifacts. Pure functions; no I/O.
// validateCitations + applyContentRules + flattenArtifactText are all reusable
// across future artifact types (Today's Lamp, Weekly Insight, etc.).

export interface Citation {
  type: 'note' | 'verse';
  ref: string;
}

export interface ArtifactSection {
  heading: string;
  body: string;
  citations: Citation[];
}

export interface ArtifactLike {
  opening?: string;
  sections: ArtifactSection[];
}

export interface CitationViolation {
  section_index: number;
  reason: 'no_citations' | 'unknown_note' | 'unknown_verse';
  detail: string;
}

export interface CitationCheckResult {
  ok: boolean;
  violations: CitationViolation[];
}

export function validateCitations<T extends ArtifactLike>(
  artifact: T,
  allowed: { allowedNoteIds: Set<string>; allowedVerseRefs: Set<string> },
): CitationCheckResult {
  const violations: CitationViolation[] = [];
  const verseRefsLower = new Set<string>();
  for (const r of allowed.allowedVerseRefs) verseRefsLower.add(r.toLowerCase());

  artifact.sections.forEach((section, idx) => {
    if (!section.citations || section.citations.length === 0) {
      violations.push({
        section_index: idx,
        reason: 'no_citations',
        detail: `section "${section.heading}" has no citations`,
      });
      return;
    }
    for (const cite of section.citations) {
      if (cite.type === 'note' && !allowed.allowedNoteIds.has(cite.ref)) {
        violations.push({
          section_index: idx,
          reason: 'unknown_note',
          detail: `cited note "${cite.ref}" is not in the user's context`,
        });
      } else if (cite.type === 'verse' && !verseRefsLower.has(cite.ref.toLowerCase())) {
        violations.push({
          section_index: idx,
          reason: 'unknown_verse',
          detail: `cited verse "${cite.ref}" is not in the retrieved passages`,
        });
      }
    }
  });

  return { ok: violations.length === 0, violations };
}

export interface ContentRuleViolation {
  family: 'banned' | 'contested' | 'growth';
  rule: string;
  snippet: string;
}

export interface ContentRules {
  banned: RegExp[];
  contested: string[];
  growth: RegExp[];
  classifier?: (text: string) => Promise<ContentRuleViolation[]>;
}

export interface ContentRuleResult {
  ok: boolean;
  violations: ContentRuleViolation[];
}

const SNIPPET_RADIUS = 40; // chars before + after the match

function snippetAround(text: string, start: number, end: number): string {
  const lo = Math.max(0, start - SNIPPET_RADIUS);
  const hi = Math.min(text.length, end + SNIPPET_RADIUS);
  return text.slice(lo, hi);
}

export async function applyContentRules(
  text: string,
  rules: ContentRules,
): Promise<ContentRuleResult> {
  const violations: ContentRuleViolation[] = [];

  for (const re of rules.banned) {
    // Re-create a global-flagged copy so we can find all matches.
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = global.exec(text)) !== null) {
      violations.push({
        family: 'banned',
        rule: re.source,
        snippet: snippetAround(text, m.index, m.index + m[0].length),
      });
      if (m[0].length === 0) global.lastIndex++;
    }
  }

  const textLower = text.toLowerCase();
  for (const ref of rules.contested) {
    const refLower = ref.toLowerCase();
    let i = textLower.indexOf(refLower);
    while (i !== -1) {
      violations.push({
        family: 'contested',
        rule: ref,
        snippet: snippetAround(text, i, i + refLower.length),
      });
      i = textLower.indexOf(refLower, i + refLower.length);
    }
  }

  for (const re of rules.growth) {
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = global.exec(text)) !== null) {
      violations.push({
        family: 'growth',
        rule: re.source,
        snippet: snippetAround(text, m.index, m.index + m[0].length),
      });
      if (m[0].length === 0) global.lastIndex++;
    }
  }

  if (rules.classifier) {
    const extra = await rules.classifier(text);
    violations.push(...extra);
  }

  return { ok: violations.length === 0, violations };
}

export function flattenArtifactText(artifact: ArtifactLike): string {
  const parts: string[] = [];
  if (artifact.opening) parts.push(artifact.opening);
  for (const s of artifact.sections) {
    parts.push(s.heading);
    parts.push(s.body);
  }
  return parts.join('\n\n');
}
```

- [ ] **Step 4: Run the tests; they should pass**

Run: `npx vitest run supabase/functions/_shared/validators.test.ts`
Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/validators.ts supabase/functions/_shared/validators.test.ts
git commit -m "$(cat <<'EOF'
feat(lamplight): citation + content-rule validators

Three pure functions: validateCitations (every section has a
resolvable citation; case-normalized matching on verse refs),
applyContentRules (banned / contested / growth rule families + an
optional async classifier slot for Layer C), flattenArtifactText
(opening + sections → single string for content checking).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Voyage rerank extension

**Files:**
- Modify: `supabase/functions/_shared/voyage.ts`
- Modify: `supabase/functions/_shared/voyage.test.ts`

- [ ] **Step 1: Add the failing rerank tests**

Append to `supabase/functions/_shared/voyage.test.ts` (after the existing `describe('voyage embed', …)` block, still inside the same file):

```ts
import { rerank } from './voyage';

describe('voyage rerank', () => {
  function mockRerankOk(scores: Array<{ index: number; relevance_score: number }>) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fn = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ data: scores, usage: { total_tokens: 100 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    return { fn, calls };
  }

  it('posts to the rerank endpoint with the correct body', async () => {
    const { fn, calls } = mockRerankOk([
      { index: 1, relevance_score: 0.9 },
      { index: 0, relevance_score: 0.3 },
    ]);
    const out = await rerank('q', ['a', 'b'], 2, { apiKey: 'k', fetch: fn });
    expect(calls[0].url).toBe('https://api.voyageai.com/v1/rerank');
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe('rerank-2.5');
    expect(body.query).toBe('q');
    expect(body.documents).toEqual(['a', 'b']);
    expect(body.top_k).toBe(2);
    expect(out).toEqual([
      { index: 1, score: 0.9 },
      { index: 0, score: 0.3 },
    ]);
  });

  it('retries on 429 with backoff and succeeds', async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts === 1) return new Response('rate limited', { status: 429 });
      return new Response(JSON.stringify({ data: [{ index: 0, relevance_score: 1 }] }), { status: 200 });
    });
    const out = await rerank('q', ['only'], 1, { apiKey: 'k', fetch: fn, sleep: async () => {} });
    expect(out).toEqual([{ index: 0, score: 1 }]);
    expect(attempts).toBe(2);
  });

  it('throws after 3 failed attempts', async () => {
    const fn = vi.fn(async () => new Response('boom', { status: 500 }));
    await expect(
      rerank('q', ['a'], 1, { apiKey: 'k', fetch: fn, sleep: async () => {} })
    ).rejects.toThrow(/voyage rerank 500/);
    expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  it('returns [] for empty documents without hitting the network', async () => {
    const fn = vi.fn();
    expect(await rerank('q', [], 5, { apiKey: 'k', fetch: fn })).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests; they should fail**

Run: `npx vitest run supabase/functions/_shared/voyage.test.ts`
Expected: existing embed tests still pass, new rerank tests fail with "rerank is not a function" or similar import error.

- [ ] **Step 3: Add the rerank implementation to voyage.ts**

Append to `supabase/functions/_shared/voyage.ts` (after `embedOnce`):

```ts
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

- [ ] **Step 4: Run the tests; they should all pass**

Run: `npx vitest run supabase/functions/_shared/voyage.test.ts`
Expected: all embed + all rerank tests green.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/voyage.ts supabase/functions/_shared/voyage.test.ts
git commit -m "$(cat <<'EOF'
feat(lamplight): voyage rerank-2.5 wrapper

Adds rerank(query, documents, topK, deps) calling
https://api.voyageai.com/v1/rerank. Same retry policy and deps shape as
embed*. Used by retrieval.ts when RERANK_ENABLED=true.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Anthropic LLMAdapter (`anthropic.ts`)

**Files:**
- Create: `supabase/functions/_shared/anthropic.ts`
- Create: `supabase/functions/_shared/anthropic.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `supabase/functions/_shared/anthropic.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createAnthropicAdapter } from './anthropic';

const toolSchema = {
  name: 'emit_artifact',
  description: 'Return the artifact JSON.',
  input_schema: {
    type: 'object',
    properties: { headline: { type: 'string' } },
    required: ['headline'],
  },
};

function mockResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function toolUseResponse(input: unknown, opts: Partial<{ inputTokens: number; outputTokens: number; model: string }> = {}) {
  return mockResponse({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: opts.model ?? 'claude-sonnet-4-6',
    content: [
      { type: 'tool_use', id: 'tu_1', name: 'emit_artifact', input },
    ],
    stop_reason: 'tool_use',
    usage: { input_tokens: opts.inputTokens ?? 12, output_tokens: opts.outputTokens ?? 34 },
  });
}

describe('createAnthropicAdapter.generate', () => {
  it('sends the documented request shape', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return toolUseResponse({ headline: 'ok' });
    });
    const adapter = createAnthropicAdapter({ apiKey: 'sk-test', fetch: fetchMock });
    const out = await adapter.generate<{ headline: string }>({
      model: 'sonnet',
      system: 'system prompt',
      messages: [{ role: 'user', content: 'hi' }],
      tool: toolSchema,
      maxTokens: 1024,
    });

    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['content-type']).toBe('application/json');

    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe('claude-sonnet-4-6');
    expect(body.max_tokens).toBe(1024);
    expect(body.system).toBe('system prompt');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.tools).toEqual([toolSchema]);
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'emit_artifact' });

    expect(out.parsed).toEqual({ headline: 'ok' });
    expect(out.modelUsed).toBe('claude-sonnet-4-6');
    expect(out.promptTokens).toBe(12);
    expect(out.completionTokens).toBe(34);
  });

  it('resolves model="haiku" to claude-haiku-4-5-20251001', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return toolUseResponse({ headline: 'h' }, { model: 'claude-haiku-4-5-20251001' });
    });
    const adapter = createAnthropicAdapter({ apiKey: 'k', fetch: fetchMock });
    await adapter.generate({
      model: 'haiku',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
      tool: toolSchema,
    });
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe('claude-haiku-4-5-20251001');
  });

  it('defaults max_tokens to 2048 when not provided', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      calls.push({ url: _url, init });
      return toolUseResponse({ headline: 'ok' });
    });
    const adapter = createAnthropicAdapter({ apiKey: 'k', fetch: fetchMock });
    await adapter.generate({
      model: 'sonnet',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
      tool: toolSchema,
    });
    expect(JSON.parse(calls[0].init.body as string).max_tokens).toBe(2048);
  });

  it('retries on 429 with backoff and succeeds', async () => {
    let attempts = 0;
    const fetchMock = vi.fn(async () => {
      attempts++;
      if (attempts === 1) return mockResponse({ error: 'rate' }, 429);
      return toolUseResponse({ headline: 'ok' });
    });
    const adapter = createAnthropicAdapter({ apiKey: 'k', fetch: fetchMock, sleep: async () => {} });
    const out = await adapter.generate({
      model: 'sonnet',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
      tool: toolSchema,
    });
    expect(out.parsed).toEqual({ headline: 'ok' });
    expect(attempts).toBe(2);
  });

  it('throws after 3 retries on persistent 5xx', async () => {
    const fetchMock = vi.fn(async () => mockResponse({ error: 'boom' }, 500));
    const adapter = createAnthropicAdapter({ apiKey: 'k', fetch: fetchMock, sleep: async () => {} });
    await expect(
      adapter.generate({
        model: 'sonnet',
        system: 's',
        messages: [{ role: 'user', content: 'hi' }],
        tool: toolSchema,
      })
    ).rejects.toThrow(/anthropic 500/);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('hard-fails on 2xx without a matching tool_use block', async () => {
    const fetchMock = vi.fn(async () => mockResponse({
      content: [{ type: 'text', text: 'I refuse to use the tool.' }],
      model: 'claude-sonnet-4-6',
      stop_reason: 'end_turn',
      usage: { input_tokens: 5, output_tokens: 6 },
    }));
    const adapter = createAnthropicAdapter({ apiKey: 'k', fetch: fetchMock });
    await expect(
      adapter.generate({
        model: 'sonnet',
        system: 's',
        messages: [{ role: 'user', content: 'hi' }],
        tool: toolSchema,
      })
    ).rejects.toThrow(/no tool_use block/i);
  });

  it('hard-fails on 4xx (non-429) without retry', async () => {
    let attempts = 0;
    const fetchMock = vi.fn(async () => {
      attempts++;
      return mockResponse({ error: 'bad request' }, 400);
    });
    const adapter = createAnthropicAdapter({ apiKey: 'k', fetch: fetchMock, sleep: async () => {} });
    await expect(
      adapter.generate({
        model: 'sonnet',
        system: 's',
        messages: [{ role: 'user', content: 'hi' }],
        tool: toolSchema,
      })
    ).rejects.toThrow(/anthropic 400/);
    expect(attempts).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests; they should fail**

Run: `npx vitest run supabase/functions/_shared/anthropic.test.ts`
Expected: import error.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/_shared/anthropic.ts`:

```ts
// Anthropic Messages API adapter — direct fetch, tool-use only.
//
// Imported by:
//   - supabase/functions/lamplight-generate (Deno runtime; injected global fetch)
//   - vitest tests (mocked fetch)
//
// No Deno or Node globals. Same pattern as voyage.ts.
//
// Anthropic API: POST https://api.anthropic.com/v1/messages with tool_choice
// forcing the model into one specific tool. Response contains a content[]
// array; we locate the tool_use block whose name matches the requested tool
// and return its `input` as the parsed object.

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_RETRIES = 3;
const DEFAULT_MAX_TOKENS = 2048;

const MODEL_IDS: Record<LLMModel, string> = {
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
};

const defaultSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export type LLMModel = 'sonnet' | 'haiku';

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface GenerateInput {
  model: LLMModel;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  tool: ToolSchema;
  maxTokens?: number;
}

export interface GenerateOutput<T> {
  parsed: T;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
}

export interface LLMAdapter {
  generate<T>(input: GenerateInput): Promise<GenerateOutput<T>>;
}

export interface AnthropicDeps {
  apiKey: string;
  fetch: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export function createAnthropicAdapter(deps: AnthropicDeps): LLMAdapter {
  return {
    async generate<T>(input: GenerateInput): Promise<GenerateOutput<T>> {
      return generateOnce<T>(input, deps, 0);
    },
  };
}

interface AnthropicContentBlock {
  type: string;
  name?: string;
  input?: unknown;
  text?: string;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

async function generateOnce<T>(
  input: GenerateInput,
  deps: AnthropicDeps,
  attempt: number,
): Promise<GenerateOutput<T>> {
  const sleep = deps.sleep ?? defaultSleep;
  const res = await deps.fetch(ANTHROPIC_BASE, {
    method: 'POST',
    headers: {
      'x-api-key': deps.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL_IDS[input.model],
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: input.system,
      messages: input.messages,
      tools: [input.tool],
      tool_choice: { type: 'tool', name: input.tool.name },
    }),
  });

  if (res.ok) {
    const json = await res.json() as AnthropicResponse;
    const block = json.content.find(b => b.type === 'tool_use' && b.name === input.tool.name);
    if (!block || block.input === undefined) {
      throw new Error(`anthropic: no tool_use block matching name="${input.tool.name}" in response`);
    }
    return {
      parsed: block.input as T,
      modelUsed: json.model,
      promptTokens: json.usage?.input_tokens ?? 0,
      completionTokens: json.usage?.output_tokens ?? 0,
    };
  }

  const retryable = res.status === 429 || res.status >= 500;
  if (retryable && attempt < MAX_RETRIES) {
    const backoffMs = 500 * Math.pow(2, attempt) + Math.random() * 250;
    await sleep(backoffMs);
    return generateOnce(input, deps, attempt + 1);
  }

  const detail = await res.text().catch(() => '');
  throw new Error(`anthropic ${res.status}: ${detail.slice(0, 500)}`);
}
```

- [ ] **Step 4: Run the tests; they should all pass**

Run: `npx vitest run supabase/functions/_shared/anthropic.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/anthropic.ts supabase/functions/_shared/anthropic.test.ts
git commit -m "$(cat <<'EOF'
feat(lamplight): anthropic LLMAdapter (sonnet 4.6 + haiku 4.5)

Direct-fetch Messages API client with tool-use forced structured
outputs. Wraps Sonnet 4.6 + Haiku 4.5 behind LLMAdapter so future
model swaps are one-constant changes. Retries on 429/5xx with
jittered exponential backoff; hard-fails when the response lacks a
matching tool_use block.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Retrieval helpers (`retrieval.ts`)

**Files:**
- Create: `supabase/functions/_shared/retrieval.ts`
- Create: `supabase/functions/_shared/retrieval.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `supabase/functions/_shared/retrieval.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { searchNeighbors, searchBible } from './retrieval';

type RpcRow = { id: string; source_id: string; similarity: number; metadata: Record<string, unknown> };

function makeSupabaseStub(rpcRows: Record<string, RpcRow[]>, embeddingRowForNote?: { embedding: number[] }) {
  const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => {
    return { data: rpcRows[name] ?? [], error: null };
  });
  const from = vi.fn((table: string) => {
    if (table === 'lamplight_embeddings') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: embeddingRowForNote ?? null, error: null }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === 'notes') {
      return {
        select: () => ({
          in: () => ({ data: [{ id: 'n1', content: '{"type":"doc","content":[]}' }, { id: 'n2', content: '{"type":"doc","content":[]}' }], error: null }),
        }),
      };
    }
    if (table === 'bible_passages') {
      return {
        select: () => ({
          in: () => ({ data: [{ id: 'psa.23.4', text: 'Even though I walk through the valley…' }], error: null }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
  // We cast to any here — the helper only uses .rpc and .from.
  return { supabase: { rpc, from } as unknown as Parameters<typeof searchBible>[0]['supabase'], rpc, from };
}

const voyageDeps = { apiKey: 'k', fetch: vi.fn() };

describe('searchBible', () => {
  it('embeds the query when no precomputed vector is supplied', async () => {
    const embedFetch = vi.fn(async () => new Response(
      JSON.stringify({ data: [{ embedding: new Array(1024).fill(0.01) }] }),
      { status: 200 },
    ));
    const { supabase, rpc } = makeSupabaseStub({
      match_bible_embeddings: [
        { id: 'e1', source_id: 'psa.23.4', similarity: 0.9, metadata: { book: 'Psalm' } },
      ],
    });
    const out = await searchBible(
      { supabase, voyage: { apiKey: 'k', fetch: embedFetch }, rerankEnabled: false },
      { query: 'rest', k: 1 },
    );
    expect(embedFetch).toHaveBeenCalledTimes(1); // one embedQuery call
    expect(rpc).toHaveBeenCalledWith('match_bible_embeddings', expect.objectContaining({ p_limit: 1 }));
    expect(out).toHaveLength(1);
    expect(out[0].source_id).toBe('psa.23.4');
  });

  it('skips embedding when queryEmbedding is supplied', async () => {
    const { supabase } = makeSupabaseStub({
      match_bible_embeddings: [
        { id: 'e1', source_id: 'psa.23.4', similarity: 0.9, metadata: {} },
      ],
    });
    const out = await searchBible(
      { supabase, voyage: voyageDeps, rerankEnabled: false },
      { query: 'rest', k: 1, queryEmbedding: new Array(1024).fill(0.5) },
    );
    expect(voyageDeps.fetch).not.toHaveBeenCalled();
    expect(out[0].source_id).toBe('psa.23.4');
  });

  it('with rerank ON reorders the candidates', async () => {
    // Candidate order from pgvector: a, b, c (similarities 0.9, 0.8, 0.7)
    // Rerank should report scores that push c to the top.
    const rerankFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/v1/rerank')) {
        return new Response(JSON.stringify({
          data: [
            { index: 2, relevance_score: 0.99 },
            { index: 0, relevance_score: 0.5 },
            { index: 1, relevance_score: 0.4 },
          ],
        }), { status: 200 });
      }
      // embedQuery call
      return new Response(JSON.stringify({ data: [{ embedding: new Array(1024).fill(0.01) }] }), { status: 200 });
    });
    const { supabase } = makeSupabaseStub({
      match_bible_embeddings: [
        { id: 'a', source_id: 'psa.1.1', similarity: 0.9, metadata: {} },
        { id: 'b', source_id: 'psa.1.2', similarity: 0.8, metadata: {} },
        { id: 'c', source_id: 'psa.1.3', similarity: 0.7, metadata: {} },
      ],
    });
    // bible_passages.in() returns text for all three so rerank has documents.
    const out = await searchBible(
      { supabase, voyage: { apiKey: 'k', fetch: rerankFetch }, rerankEnabled: true },
      { query: 'q', k: 3 },
    );
    expect(out[0].source_id).toBe('psa.1.3');   // reranked to top
    expect(out[0].rerank_score).toBe(0.99);
    expect(out[1].source_id).toBe('psa.1.1');
  });

  it('limits results to k', async () => {
    const { supabase } = makeSupabaseStub({
      match_bible_embeddings: Array.from({ length: 50 }, (_, i) => ({
        id: `e${i}`, source_id: `psa.${i}.1`, similarity: 1 - i * 0.01, metadata: {},
      })),
    });
    const out = await searchBible(
      { supabase, voyage: voyageDeps, rerankEnabled: false },
      { query: 'q', k: 5, queryEmbedding: new Array(1024).fill(0) },
    );
    expect(out).toHaveLength(5);
  });
});

describe('searchNeighbors', () => {
  it('returns [] when the note has no embedding row yet', async () => {
    const { supabase } = makeSupabaseStub({}, undefined);
    const out = await searchNeighbors(
      { supabase, voyage: voyageDeps, rerankEnabled: false },
      { userId: 'u1', noteId: 'n1', k: 5 },
    );
    expect(out).toEqual([]);
  });

  it('uses the note\'s stored embedding as the query vector', async () => {
    const { supabase, rpc } = makeSupabaseStub({
      match_user_note_embeddings: [
        { id: 'e2', source_id: 'n2', similarity: 0.95, metadata: {} },
      ],
    }, { embedding: new Array(1024).fill(0.42) });
    const out = await searchNeighbors(
      { supabase, voyage: voyageDeps, rerankEnabled: false },
      { userId: 'u1', noteId: 'n1', k: 5 },
    );
    expect(rpc).toHaveBeenCalledWith(
      'match_user_note_embeddings',
      expect.objectContaining({ p_user_id: 'u1', p_exclude_source_id: 'n1', p_limit: 5 }),
    );
    expect(out[0].source_id).toBe('n2');
  });
});
```

- [ ] **Step 2: Run the tests; they should fail**

Run: `npx vitest run supabase/functions/_shared/retrieval.test.ts`
Expected: import error.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/_shared/retrieval.ts`:

```ts
// Retrieval helpers for the Reasoning Layer. Wraps the match_* RPCs and
// optionally reranks via Voyage. Pure (modulo injected supabase + voyage deps).

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
  similarity: number;
  rerank_score?: number;
  metadata: Record<string, unknown>;
}

interface MatchRow {
  id: string;
  source_id: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

const POOL_SIZE = 50; // candidates pulled from pgvector before rerank

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
    return rows.slice(0, args.k).map(r => ({ ...r }));
  }
  return rerankBibleRows(deps, args.query, rows, args.k);
}

export async function searchNeighbors(
  deps: RetrievalDeps,
  args: { userId: string; noteId: string; k: number },
): Promise<RetrievedItem[]> {
  // Load the note's existing embedding vector. If absent, the note has not been
  // embedded yet — return [] without error.
  const { data: row, error } = await deps.supabase
    .from('lamplight_embeddings')
    .select('embedding')
    .eq('user_id', args.userId)
    .eq('source_type', 'note')
    .eq('source_id', args.noteId)
    .maybeSingle();
  if (error) throw error;
  if (!row?.embedding) return [];

  const limit = deps.rerankEnabled ? POOL_SIZE : args.k;
  const { data, error: rpcErr } = await deps.supabase.rpc('match_user_note_embeddings', {
    p_user_id: args.userId,
    p_query_vector: row.embedding,
    p_exclude_source_id: args.noteId,
    p_limit: limit,
  });
  if (rpcErr) throw rpcErr;
  const rows = (data ?? []) as MatchRow[];
  if (rows.length === 0) return [];

  if (!deps.rerankEnabled) {
    return rows.slice(0, args.k).map(r => ({ ...r }));
  }
  return rerankNoteRows(deps, rows, args.k);
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
  return scored.map(s => ({
    ...rows[s.index],
    rerank_score: s.score,
  }));
}

async function rerankNoteRows(
  deps: RetrievalDeps,
  rows: MatchRow[],
  k: number,
): Promise<RetrievedItem[]> {
  // We don't have a great "query text" for note-neighbors rerank; use the
  // first row's metadata.preview if present, else fall back to no-op rerank.
  // Note-neighbor rerank lands properly in sub-project 5 (Connection Cards)
  // when the call site has more context. For now, return pgvector order.
  return rows.slice(0, k).map(r => ({ ...r }));
}
```

(The note-neighbors rerank is intentionally a pass-through pending sub-project 5; the spec calls this out — `searchNeighbors` is exported now so its interface is stable, but the rerank path on the note side is wired by Connection Cards. Bible rerank is the primary one for sub-project 3's smoke-test path.)

- [ ] **Step 4: Run the tests**

Run: `npx vitest run supabase/functions/_shared/retrieval.test.ts`
Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/retrieval.ts supabase/functions/_shared/retrieval.test.ts
git commit -m "$(cat <<'EOF'
feat(lamplight): retrieval helpers (searchNeighbors, searchBible)

Wraps the match_* RPCs and optionally reranks Bible candidates via
Voyage rerank-2.5. searchNeighbors returns [] when the note has no
stored embedding yet (queue backlog / opted-out / fresh note).
Note-side rerank is a pass-through pending sub-project 5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Smoke-test prompt + pipeline

**Files:**
- Create: `supabase/functions/lamplight-generate/prompts/smoke-test.ts`
- Create: `supabase/functions/lamplight-generate/pipeline.ts`
- Create: `supabase/functions/lamplight-generate/pipeline.test.ts`

- [ ] **Step 1: Write the failing tests for the pipeline**

Create `supabase/functions/lamplight-generate/pipeline.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { runSmokeTestPipeline, type SmokeTestContext } from './pipeline';
import type { LLMAdapter, GenerateOutput } from '../_shared/anthropic';

function makeCtx(overrides: Partial<SmokeTestContext> = {}): SmokeTestContext {
  return {
    notes: [{ id: 'note-1', title: 'On rest', plaintext: 'I have been weary lately and resting feels hard.' }],
    passages: [{
      source_id: 'psa.23.4', text: 'Even though I walk through the valley of the shadow of death…',
      ref: 'Psalm 23:4', metadata: { book: 'Psalm', chapter: 23 },
    }],
    voicePreference: 'Lord',
    traditionHint: 'unspecified',
    allowedNoteIds: new Set(['note-1']),
    allowedVerseRefs: new Set(['Psalm 23:4']),
    rerankUsed: false,
    ...overrides,
  };
}

function adapterThatReturns<T>(responses: T[]): { llm: LLMAdapter } {
  let i = 0;
  const llm: LLMAdapter = {
    async generate<U>(): Promise<GenerateOutput<U>> {
      const parsed = responses[Math.min(i, responses.length - 1)] as unknown as U;
      i++;
      return { parsed, modelUsed: 'claude-sonnet-4-6', promptTokens: 10, completionTokens: 20 };
    },
  };
  return { llm };
}

const cleanArtifact = {
  opening: 'A short opening.',
  sections: [{
    heading: 'Anchor',
    body: 'Psalm 23 may speak to the weariness you described.',
    citations: [{ type: 'verse' as const, ref: 'Psalm 23:4' }],
  }],
};

describe('runSmokeTestPipeline', () => {
  it('happy path: validators pass on first attempt', async () => {
    const { llm } = adapterThatReturns([cleanArtifact]);
    const result = await runSmokeTestPipeline({ llm, ctx: makeCtx() });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attempts).toBe(1);
      expect(result.artifact.sections).toHaveLength(1);
    }
  });

  it('retry path: uncited section on attempt 1, clean on attempt 2', async () => {
    const dirty = {
      opening: 'preamble',
      sections: [{ heading: 'H', body: 'B', citations: [] }],
    };
    const { llm } = adapterThatReturns([dirty, cleanArtifact]);
    const result = await runSmokeTestPipeline({ llm, ctx: makeCtx() });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.attempts).toBe(2);
  });

  it('hard fail: both attempts violate', async () => {
    const banned = {
      opening: 'God is telling you to forgive him.',
      sections: [{
        heading: 'H', body: 'B',
        citations: [{ type: 'verse' as const, ref: 'Psalm 23:4' }],
      }],
    };
    const { llm } = adapterThatReturns([banned, banned]);
    const result = await runSmokeTestPipeline({ llm, ctx: makeCtx() });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.attempts).toBe(2);
      expect(result.violations.content.some(v => v.family === 'banned')).toBe(true);
    }
  });

  it('no_notes short-circuit: returns reason no_notes with attempts=0, no LLM call', async () => {
    const calls = { count: 0 };
    const llm: LLMAdapter = {
      async generate() { calls.count++; throw new Error('should not be called'); },
    };
    const result = await runSmokeTestPipeline({ llm, ctx: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('no_notes');
      expect(result.attempts).toBe(0);
    }
    expect(calls.count).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests; they should fail (no implementation yet)**

Run: `npx vitest run supabase/functions/lamplight-generate/pipeline.test.ts`
Expected: import error.

- [ ] **Step 3: Write the smoke-test prompt template**

Create `supabase/functions/lamplight-generate/prompts/smoke-test.ts`:

```ts
// Throwaway prompt for sub-project 3 — exercises every pipeline stage end-to-end.
// NOT a draft of Today's Lamp. Sub-project 4 writes the real, doctrinal-reviewed
// template; this one is deliberately generic and unimpressive.

import type { SmokeTestContext } from '../pipeline.ts';

export const SMOKE_TEST_PROMPT = {
  promptVersion: 'smoke-test-2026-05-26-v1',

  system: `Produce a brief reflection (≤ 200 words total) that surfaces what Scripture says in light of the user's recent notes. Use the supplied passages only; do not invent references. Cite at least one passage in every section.`,

  tool: {
    name: 'emit_smoke_artifact',
    description: 'Return the smoke-test artifact JSON.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['opening', 'sections'],
      properties: {
        opening: { type: 'string', minLength: 1, maxLength: 400 },
        sections: {
          type: 'array',
          minItems: 1,
          maxItems: 2,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['heading', 'body', 'citations'],
            properties: {
              heading: { type: 'string', minLength: 1, maxLength: 120 },
              body: { type: 'string', minLength: 1, maxLength: 800 },
              citations: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['type', 'ref'],
                  properties: {
                    type: { type: 'string', enum: ['note', 'verse'] },
                    ref: {
                      type: 'string',
                      description: 'For verses, use the exact human-readable form supplied in the user prompt (e.g. "Psalm 23:4", "Romans 8:28-30"). For notes, use the note id.',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  buildMessages(ctx: SmokeTestContext): Array<{ role: 'user'; content: string }> {
    const notesBlock = ctx.notes.map(n => `[note id=${n.id}] ${n.title}\n${n.plaintext}`).join('\n\n');
    const passagesBlock = ctx.passages.map(p => `[${p.ref}] ${p.text}`).join('\n\n');
    return [{
      role: 'user',
      content: `User recent notes:\n${notesBlock}\n\nRetrieved passages:\n${passagesBlock}\n\nUser settings: voice="${ctx.voicePreference}", tradition_hint="${ctx.traditionHint}".\n\nReflect briefly. Cite passages using these exact refs: ${[...ctx.allowedVerseRefs].join(', ')}.`,
    }];
  },
} as const;
```

- [ ] **Step 4: Write the pipeline implementation**

Create `supabase/functions/lamplight-generate/pipeline.ts`:

```ts
// Smoke-test pipeline. Pure function of (LLMAdapter, ctx) — no I/O of its
// own. The HTTP shell (index.ts) builds ctx via buildSmokeTestContext and
// hands it here. Unit-testable by injecting a fake adapter + handcrafted ctx.

import type { LLMAdapter } from '../_shared/anthropic.ts';
import {
  LAMPLIGHT_SYSTEM_FRAGMENT,
  BANNED_PHRASES,
  CONTESTED_PASSAGES,
  GROWTH_BANNED_PHRASES,
  composeSystem,
} from '../_shared/voice.ts';
import {
  validateCitations,
  applyContentRules,
  flattenArtifactText,
  type ArtifactSection,
  type CitationViolation,
  type ContentRuleViolation,
} from '../_shared/validators.ts';
import { SMOKE_TEST_PROMPT } from './prompts/smoke-test.ts';

export interface SmokeTestNote {
  id: string;
  title: string;
  plaintext: string;
}

export interface SmokeTestPassage {
  source_id: string;
  text: string;
  ref: string;            // human-readable, e.g. "Psalm 23:4"
  metadata: Record<string, unknown>;
}

export interface SmokeTestContext {
  notes: SmokeTestNote[];
  passages: SmokeTestPassage[];
  voicePreference: string;
  traditionHint: string;
  allowedNoteIds: Set<string>;
  allowedVerseRefs: Set<string>;
  rerankUsed: boolean;
}

export interface SmokeTestArtifact {
  opening: string;
  sections: ArtifactSection[];
}

export type PipelineResult =
  | {
      ok: true;
      artifact: SmokeTestArtifact;
      model_used: string;
      prompt_version: string;
      attempts: number;
      retrieval: { note_neighbors: number; bible_passages: number; reranked: boolean };
    }
  | {
      ok: false;
      reason: 'no_notes' | 'validators_failed';
      violations?: { citation: CitationViolation[]; content: ContentRuleViolation[] };
      model_used?: string;
      prompt_version: string;
      attempts: number;
    };

const MAX_ATTEMPTS = 2;

export async function runSmokeTestPipeline(args: {
  llm: LLMAdapter;
  ctx: SmokeTestContext | null;
}): Promise<PipelineResult> {
  const promptVersion = SMOKE_TEST_PROMPT.promptVersion;

  if (!args.ctx) {
    return { ok: false, reason: 'no_notes', prompt_version: promptVersion, attempts: 0 };
  }
  const ctx = args.ctx;

  let attempts = 0;
  let lastViolations: { citation: CitationViolation[]; content: ContentRuleViolation[] } | null = null;
  let lastModelUsed = 'claude-sonnet-4-6';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    attempts++;
    const stricter = attempt === 0 ? '' : formatStricterSuffix(lastViolations!);
    const system = composeSystem({
      base: LAMPLIGHT_SYSTEM_FRAGMENT,
      artifact: SMOKE_TEST_PROMPT.system,
      voicePreference: ctx.voicePreference,
      stricter,
    });

    const { parsed, modelUsed } = await args.llm.generate<SmokeTestArtifact>({
      model: 'sonnet',
      system,
      messages: SMOKE_TEST_PROMPT.buildMessages(ctx),
      tool: SMOKE_TEST_PROMPT.tool,
      maxTokens: 2048,
    });
    lastModelUsed = modelUsed;

    const citation = validateCitations(parsed, {
      allowedNoteIds: ctx.allowedNoteIds,
      allowedVerseRefs: ctx.allowedVerseRefs,
    });
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
}

function formatStricterSuffix(violations: {
  citation: CitationViolation[];
  content: ContentRuleViolation[];
}): string {
  const parts: string[] = [];
  if (violations.citation.length > 0) {
    parts.push(
      'On retry: every section MUST include at least one entry in citations[], and every cited verse ref MUST match exactly one of the refs supplied in the user prompt.',
    );
  }
  if (violations.content.length > 0) {
    const families = [...new Set(violations.content.map(v => v.family))];
    if (families.includes('banned')) {
      parts.push(
        'On retry: do not produce prophetic, oracular, or "God is telling you" style language. Speak of Scripture in possibility, not pronouncement.',
      );
    }
    if (families.includes('contested')) {
      parts.push(
        'On retry: avoid interpreting the contested passages mentioned. Name them gently and defer.',
      );
    }
    if (families.includes('growth')) {
      parts.push(
        'On retry: do not use streak / "missed yesterday" / "get back on track" / effort-shaming language.',
      );
    }
  }
  return parts.join(' ');
}
```

- [ ] **Step 5: Run the tests; they should pass**

Run: `npx vitest run supabase/functions/lamplight-generate/pipeline.test.ts`
Expected: all 4 tests green.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/lamplight-generate/prompts/smoke-test.ts \
        supabase/functions/lamplight-generate/pipeline.ts \
        supabase/functions/lamplight-generate/pipeline.test.ts
git commit -m "$(cat <<'EOF'
feat(lamplight): smoke-test prompt + reasoning pipeline

Throwaway smoke-test prompt template (intentionally generic, NOT a
draft of Today's Lamp) plus the runSmokeTestPipeline function that
threads context → LLM → validators → retry-once → final result.

formatStricterSuffix turns validator violations into a short
instructional addendum for the retry attempt.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Edge Function HTTP shell

**Files:**
- Create: `supabase/functions/lamplight-generate/deno.json`
- Create: `supabase/functions/lamplight-generate/index.ts`

- [ ] **Step 1: Create the import map**

Create `supabase/functions/lamplight-generate/deno.json`:

```json
{
  "imports": {
    "@supabase/supabase-js": "jsr:@supabase/supabase-js@2"
  }
}
```

- [ ] **Step 2: Write the HTTP shell**

Create `supabase/functions/lamplight-generate/index.ts`:

```ts
// supabase/functions/lamplight-generate/index.ts
//
// Single payload shape:
//   { kind: "smoke_test", user_id: "<uuid>" }
//
// Verifies the user is opted into Lamplight, builds the smoke-test context
// (5 most recent notes + Bible-search results), and runs the smoke-test
// pipeline. Returns the structured artifact + validator report.
//
// JWT verification stays on at the platform level (do NOT deploy with
// --no-verify-jwt). The function additionally requires lamplight_settings
// for the supplied user_id to have enabled=true.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { embedQuery, type VoyageDeps } from '../_shared/voyage.ts';
import { searchBible } from '../_shared/retrieval.ts';
import { createAnthropicAdapter } from '../_shared/anthropic.ts';
import { extractTextFromNoteContent } from '../_shared/tiptap-text.ts';
import { runSmokeTestPipeline, type SmokeTestContext, type SmokeTestPassage } from './pipeline.ts';

serve(async (req) => {
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405);

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const voyageKey = Deno.env.get('VOYAGE_AI_KEY');
  if (!anthropicKey) return jsonResp({ error: 'ANTHROPIC_API_KEY missing' }, 500);
  if (!voyageKey)    return jsonResp({ error: 'VOYAGE_AI_KEY missing' }, 500);

  let body: { kind?: string; user_id?: string };
  try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }
  if (body.kind !== 'smoke_test' || typeof body.user_id !== 'string') {
    return jsonResp({ error: 'bad payload' }, 400);
  }

  const supabase = serviceClient();

  // Opted-in check
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

  const ctx = await buildSmokeTestContext(supabase, {
    userId: body.user_id,
    voicePreference: (settings.voice_preference as string) ?? 'Lord',
    traditionHint: (settings.tradition_hint as string) ?? 'unspecified',
    voyageDeps,
    rerankEnabled,
  });

  const result = await runSmokeTestPipeline({ llm, ctx });
  return jsonResp(result);
});

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function buildSmokeTestContext(
  supabase: ReturnType<typeof serviceClient>,
  args: {
    userId: string;
    voicePreference: string;
    traditionHint: string;
    voyageDeps: VoyageDeps;
    rerankEnabled: boolean;
  },
): Promise<SmokeTestContext | null> {
  // Load up to 5 most-recently-updated notes for this user.
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

  // Theme query = the longest plaintext (rough proxy for "most signal").
  const themeQuery = [...notes].sort((a, b) => b.plaintext.length - a.plaintext.length)[0].plaintext;
  const queryEmbedding = await embedQuery(themeQuery, args.voyageDeps);

  const retrievedBible = await searchBible(
    { supabase, voyage: args.voyageDeps, rerankEnabled: args.rerankEnabled },
    { query: themeQuery, k: 3, queryEmbedding },
  );

  // Fetch the full bible_passages rows so we have text + structured ref components.
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
        source_id: r.source_id,
        text: p.text,
        ref,
        metadata: { book: p.book, chapter: p.chapter, similarity: r.similarity, rerank_score: r.rerank_score },
      };
    })
    .filter((x): x is SmokeTestPassage => x !== null);

  return {
    notes,
    passages,
    voicePreference: args.voicePreference,
    traditionHint: args.traditionHint,
    allowedNoteIds: new Set(notes.map(n => n.id)),
    allowedVerseRefs: new Set(passages.map(p => p.ref)),
    rerankUsed: args.rerankEnabled && passages.length > 0,
  };
}
```

- [ ] **Step 3: Verify Deno can parse the function**

Run: `deno check supabase/functions/lamplight-generate/index.ts`
Expected: no errors. (If `deno` is not installed locally, this step can be skipped — the Supabase CLI runs Deno during `functions deploy` and will surface any parse errors there.)

- [ ] **Step 4: Run all `_shared` + pipeline tests once more to confirm no cross-file regressions**

Run: `npx vitest run supabase/functions/`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/lamplight-generate/deno.json supabase/functions/lamplight-generate/index.ts
git commit -m "$(cat <<'EOF'
feat(lamplight): lamplight-generate edge function HTTP shell

POST { kind:"smoke_test", user_id } endpoint. Verifies env, validates
payload, checks lamplight_settings.enabled (403 if off), builds the
smoke-test context (5 recent notes + 3 Bible passages with
human-readable refs), and runs the reasoning pipeline. JWT
verification stays on at the platform level — do NOT deploy with
--no-verify-jwt.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: RLS isolation test — match RPC access

**Files:**
- Modify: `src/notepad/storage/lamplight-rls.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/notepad/storage/lamplight-rls.test.ts` (inside the `maybeDescribe('Lamplight RLS isolation (integration)', …)` block, after the last existing test):

```ts
  it("authenticated users cannot execute match_user_note_embeddings", async () => {
    const zeroVec = new Array(1024).fill(0);
    const { error } = await userB.client.rpc('match_user_note_embeddings', {
      p_user_id: userA.userId,
      p_query_vector: zeroVec,
      p_exclude_source_id: null,
      p_limit: 5,
    });
    expect(error).not.toBeNull(); // permission denied / function not in schema cache
  });

  it("authenticated users cannot execute match_bible_embeddings", async () => {
    const zeroVec = new Array(1024).fill(0);
    const { error } = await userB.client.rpc('match_bible_embeddings', {
      p_query_vector: zeroVec,
      p_limit: 5,
    });
    expect(error).not.toBeNull();
  });
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/notepad/storage/lamplight-rls.test.ts`
Expected: if the integration env vars (`SUPABASE_TEST_URL` etc.) are not set, the whole describe block skips — that's fine for CI without secrets. If they are set, the two new tests pass (the migration revoked execute from authenticated, so the RPC call returns a `permission denied` error).

- [ ] **Step 3: Commit**

```bash
git add src/notepad/storage/lamplight-rls.test.ts
git commit -m "$(cat <<'EOF'
test(lamplight): RLS isolation for match RPCs

Verifies match_user_note_embeddings and match_bible_embeddings are
not executable from an authenticated JWT — only via service role
(Edge Function). Migration 012 revoked execute from public,
authenticated; this test catches accidental future re-grants.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Env example update + final acceptance pass

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: Update the env example**

Open `.env.local.example` and add a new section near the existing Voyage-related comments (or at the end if no related section exists):

```
# === Lamplight Reasoning Layer (sub-project 3) ===
#
# ANTHROPIC_API_KEY is server-side only. The Edge Function reads it via
# Deno.env. Set it via:
#   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# Do NOT put it in .env.local — the browser must never see this key.
#
# RERANK_ENABLED toggles Voyage rerank-2.5 inside searchBible /
# searchNeighbors. Defaults to off (pgvector cosine ordering is final).
# To enable on the Edge Function:
#   supabase secrets set RERANK_ENABLED=true
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: every test green. Specifically:
- `src/**/*.test.ts(x)` — existing Foundation + Signal Layer tests still pass
- `supabase/functions/_shared/voice.test.ts` — new
- `supabase/functions/_shared/validators.test.ts` — new
- `supabase/functions/_shared/voyage.test.ts` — embed (existing) + rerank (new)
- `supabase/functions/_shared/anthropic.test.ts` — new
- `supabase/functions/_shared/retrieval.test.ts` — new
- `supabase/functions/lamplight-generate/pipeline.test.ts` — new
- `scripts/**/*.test.ts` — existing BSB / backfill tests still pass

- [ ] **Step 3: Run the typecheck**

Run: `npx tsc -b`
Expected: clean exit.

- [ ] **Step 4: Run the linter**

Run: `npm run lint`
Expected: no errors. (Warnings unrelated to this slice may exist; only fail on errors.)

- [ ] **Step 5: Run the production build**

Run: `npm run build`
Expected: succeeds. Bundle size should be essentially identical to before this slice (no client-side code was added or modified).

- [ ] **Step 6: Manual smoke deploy (optional but recommended)**

Only run if the project has a deployable Supabase environment with `ANTHROPIC_API_KEY` set as a function secret:

```bash
supabase functions deploy lamplight-generate
supabase functions invoke lamplight-generate \
  --no-verify-jwt=false \
  --body '{"kind":"smoke_test","user_id":"<a real test user uuid with lamplight_settings.enabled=true and ≥1 note>"}'
```

Expected: HTTP 200 with `{ ok: true, artifact: { opening: "...", sections: [...] }, model_used: "claude-sonnet-4-6", attempts: 1, ... }` in <10 seconds.

If the response is `{ ok: false, reason: "no_notes" }`, the test user needs at least one note with non-empty plaintext. If it's `{ ok: false, reason: "validators_failed" }`, the model produced an artifact that violated a rule on both attempts — inspect `violations` and decide whether the rule is too strict for the smoke-test prompt or the prompt needs a small tightening (the prompt is throwaway, so loosening it is OK; the rule lists are NOT).

- [ ] **Step 7: Commit**

```bash
git add .env.local.example
git commit -m "$(cat <<'EOF'
docs(lamplight): env example notes for ANTHROPIC_API_KEY + RERANK_ENABLED

Both are server-side only (Edge Function via Deno.env). Sub-project 3
acceptance pass: all unit tests green; tsc clean; npm run build
unchanged bundle size; lamplight-generate deploys and returns
{ ok:true } against a seeded test user.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Spec coverage check

Spec acceptance criteria mapped to tasks:

| Spec AC | Task |
|---|---|
| 1. Migration 012 runs clean | Task 1 |
| 2. lamplight-generate deploys | Task 8, manual smoke in Task 10 |
| 3. ANTHROPIC_API_KEY missing → 500 | Task 8 (impl), tested via manual smoke; could be added as unit test against the HTTP shell if needed (kept out of unit tests to avoid Deno-runtime dependence in Vitest) |
| 4. LLMAdapter.generate parses tool_use | Task 5 |
| 5. voyage.rerank() | Task 4 |
| 6. searchNeighbors / searchBible per-user filter + k limit | Task 6 |
| 7. Rerank reorders | Task 6 (`with rerank ON reorders the candidates` test) |
| 8. validateCitations passes / fails per fixture | Task 3 |
| 9. applyContentRules catches every list entry | Task 2 (regex coverage) + Task 3 (rule-family coverage) |
| 10. End-to-end smoke ≤10s | Task 10 (manual) |
| 11. Validator-fail-then-retry path | Task 7 |
| 12. Hard-fail path | Task 7 |
| 13. Opted-out user → 403 | Task 8 (impl); could be added as a thin test using a mocked supabase client wrapped around the handler — currently exercised by manual smoke in Task 10 |
| 13a. no_notes short-circuit | Task 7 |
| 14. Lint / tsc / vitest / deno test pass | Task 10 |
| 15. RLS isolation for match RPCs | Task 9 |
| 16. No regression in Foundation / Signal | Task 10 (full vitest run) |
| 17. Bundle diff zero | Task 10 (`npm run build`) |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-26-lamplight-reasoning-layer.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
