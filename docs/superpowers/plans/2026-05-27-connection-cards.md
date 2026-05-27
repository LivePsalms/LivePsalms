# Connection Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Lamplight Sub-Project 5 — when an opted-in user opens a qualifying note in the Lamplight tab, render up to 3 connection cards backed by a pgvector neighbor lookup, with lazy Haiku "why" generation cached in `lamplight_connections`.

**Architecture:** A new authenticated-callable RPC `match_my_note_neighbors` returns top-K cosine neighbors directly to the browser (no Edge Function in the hot path). Shared signals (tags + verse refs) are intersected client-side using the existing reference-parser. A new `kind: 'connection_card_why'` dispatch on the existing `lamplight-generate` Edge Function does lazy Haiku generation on user expand, with composite-hash caching that invalidates whenever either note's plaintext changes. Cards' UI lives in the existing `LamplightTabPanel`, which now branches: qualifying active note → `ConnectionCardsSection`, else → `TodaysLampCard`.

**Tech Stack:** PostgreSQL + pgvector (HNSW), Supabase Edge Functions (Deno), Anthropic Messages API (Haiku 4.5), React 19, Vitest, Deno test, Playwright (existing).

**Spec:** `docs/superpowers/specs/2026-05-27-connection-cards-design.md`

---

## File Map

**New files:**
- `supabase/migrations/014_lamplight_connection_match_rpc.sql`
- `supabase/functions/_shared/note-signals.ts` + `.test.ts`
- `supabase/functions/lamplight-generate/prompts/connection-why.ts`
- `supabase/functions/lamplight-generate/connection-why-pipeline.ts` + `.test.ts`
- `src/notepad/utils/connection-signals.ts` + `.test.ts`
- `src/notepad/hooks/useConnectionCards.ts` + `.test.tsx`
- `src/notepad/components/lamplight/ConnectionCardsSection.tsx` + `.test.tsx`
- `src/notepad/components/lamplight/ConnectionCard.tsx` + `.test.tsx`
- `src/notepad/components/lamplight/ConnectionCardsLoading.tsx` + `.test.tsx`

**Modified files:**
- `supabase/functions/_shared/validators.ts` (+ `.test.ts`)
- `supabase/functions/lamplight-generate/index.ts`
- `src/notepad/storage/lamplight-adapter.ts`
- `src/notepad/storage/supabase-lamplight-adapter.ts` (+ `.test.ts`)
- `src/notepad/storage/fake-lamplight-adapter.ts` (+ `.test.ts`)
- `src/notepad/storage/lamplight-rls.test.ts`
- `src/notepad/components/lamplight/LamplightTabPanel.tsx` (+ `.test.tsx`)
- `src/components/sections/Notepad.tsx`

---

## Task 1: Migration 014 — `match_my_note_neighbors` RPC

**Files:**
- Create: `supabase/migrations/014_lamplight_connection_match_rpc.sql`

- [ ] **Step 1: Read sibling migration 012 for conventions**

Open `supabase/migrations/012_lamplight_match_rpcs.sql` and study:
- Type qualification (`extensions.vector(1024)` in signature)
- `set search_path = public, extensions`
- `language sql` vs `language plpgsql` (we'll use plpgsql here because we have a multi-statement body with control flow)

Open `013_lamplight_match_rpc_timeout.sql` to confirm the `set statement_timeout = '30s'` pattern.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/014_lamplight_connection_match_rpc.sql`:

```sql
-- 014_lamplight_connection_match_rpc.sql — authenticated-callable neighbor
-- lookup for Connection Cards (sub-project 5).
--
-- Unlike match_user_note_embeddings (from migration 012, service-role only,
-- accepts an arbitrary p_user_id), this RPC derives the user identity from
-- auth.uid() and ownership-checks the source note before returning anything.
-- Returns only (related_note_id, similarity) — no embeddings leak — so it
-- is safe to grant to `authenticated` and skip the Edge Function hop.
--
-- Type qualification matches migration 012's discipline: extensions.vector(1024)
-- in the signature (pgvector type lives in the extensions schema; set
-- search_path applies at runtime, not at parse time, so the signature must be
-- fully qualified). Statement timeout = 30s matches migration 013.

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

- [ ] **Step 3: Apply migration to local Supabase**

Run: `npx supabase db reset` (or whichever local-DB-rebuild command this project uses — check `package.json` scripts; typically `npm run db:reset` or similar).

Expected: applies migrations 001-014 cleanly. No errors. If the migration fails to parse with "type vector does not exist", recheck the `extensions.vector(1024)` qualification.

- [ ] **Step 4: Smoke-test the RPC in psql**

Run via the Supabase SQL editor or local psql:

```sql
-- As an authenticated user with a note that has an embedding:
select * from match_my_note_neighbors('00000000-0000-0000-0000-000000000001'::uuid, 5, 0.5);
```

Expected: returns 0+ rows (depending on seed data); no error.

```sql
-- As the same user, with a UUID that doesn't belong to them:
select * from match_my_note_neighbors('00000000-0000-0000-0000-999999999999'::uuid, 5, 0.5);
```

Expected: `ERROR:  not authorized`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/014_lamplight_connection_match_rpc.sql
git commit -m "feat(lamplight): migration 014 — match_my_note_neighbors RPC

Authenticated-callable wrapper around pgvector cosine search, returns
top-K neighbor (note_id, similarity) tuples for the caller's own notes
only. Used by Connection Cards (sub-project 5) to skip Edge Function
hop on the qualifying-note-open path. SECURITY DEFINER + auth.uid()
ownership check inside; no embeddings leak in the return shape."
```

---

## Task 2: Validators — `validateConnectionWhyShape` + `flattenConnectionWhyText`

**Files:**
- Modify: `supabase/functions/_shared/validators.ts`
- Modify: `supabase/functions/_shared/validators.test.ts`

- [ ] **Step 1: Read the existing validators module to understand conventions**

Open `supabase/functions/_shared/validators.ts`. Look at:
- `validateDailyDevotionCitations` — the sibling-validator pattern (lines ~167-203).
- `flattenDailyDevotionText` — the sibling-flatten pattern (lines ~204+).
- `ContentRuleViolation` interface — your new shape violations will be a different shape, NOT this one.

Open `supabase/functions/_shared/validators.test.ts` to understand the test fixture pattern.

- [ ] **Step 2: Write failing tests for `validateConnectionWhyShape`**

Append to `supabase/functions/_shared/validators.test.ts`:

```ts
import {
  validateConnectionWhyShape,
  flattenConnectionWhyText,
  type ConnectionWhyArtifact,
} from './validators.ts';

Deno.test('validateConnectionWhyShape accepts a 24-word string', () => {
  const artifact: ConnectionWhyArtifact = {
    why: 'word '.repeat(24).trim(),
  };
  const result = validateConnectionWhyShape(artifact);
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.violations)}`);
});

Deno.test('validateConnectionWhyShape rejects a 25-word string', () => {
  const artifact: ConnectionWhyArtifact = {
    why: 'word '.repeat(25).trim(),
  };
  const result = validateConnectionWhyShape(artifact);
  if (result.ok) throw new Error('expected violation');
  if (!result.violations.some((v) => v.rule === 'word_count_exceeded')) {
    throw new Error(`expected word_count_exceeded, got ${JSON.stringify(result.violations)}`);
  }
});

Deno.test('validateConnectionWhyShape rejects an empty string', () => {
  const artifact: ConnectionWhyArtifact = { why: '   ' };
  const result = validateConnectionWhyShape(artifact);
  if (result.ok) throw new Error('expected violation');
  if (!result.violations.some((v) => v.rule === 'empty')) {
    throw new Error(`expected empty rule, got ${JSON.stringify(result.violations)}`);
  }
});

Deno.test('validateConnectionWhyShape rejects non-string why', () => {
  const artifact = { why: 42 } as unknown as ConnectionWhyArtifact;
  const result = validateConnectionWhyShape(artifact);
  if (result.ok) throw new Error('expected violation');
  if (!result.violations.some((v) => v.rule === 'not_string')) {
    throw new Error(`expected not_string rule, got ${JSON.stringify(result.violations)}`);
  }
});

Deno.test('flattenConnectionWhyText returns the why string verbatim', () => {
  const artifact: ConnectionWhyArtifact = { why: 'hello world' };
  const flat = flattenConnectionWhyText(artifact);
  if (flat !== 'hello world') throw new Error(`expected verbatim, got "${flat}"`);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `deno test supabase/functions/_shared/validators.test.ts --allow-env --allow-net`

Expected: 5 failures, all citing missing exports `validateConnectionWhyShape` / `flattenConnectionWhyText` / `ConnectionWhyArtifact`.

- [ ] **Step 4: Implement the new functions in `validators.ts`**

Append to `supabase/functions/_shared/validators.ts`:

```ts
export interface ConnectionWhyArtifact {
  why: string;
}

export interface ConnectionShapeViolation {
  rule: 'word_count_exceeded' | 'empty' | 'not_string';
  detail: string;
}

export interface ConnectionShapeResult {
  ok: boolean;
  violations: ConnectionShapeViolation[];
}

export function validateConnectionWhyShape(
  artifact: ConnectionWhyArtifact,
): ConnectionShapeResult {
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
    violations.push({
      rule: 'word_count_exceeded',
      detail: `${wordCount} words > 24`,
    });
  }
  return { ok: violations.length === 0, violations };
}

export function flattenConnectionWhyText(artifact: ConnectionWhyArtifact): string {
  return artifact.why;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `deno test supabase/functions/_shared/validators.test.ts --allow-env --allow-net`

Expected: all tests pass, including the 5 new ones.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/validators.ts supabase/functions/_shared/validators.test.ts
git commit -m "feat(lamplight): validators — validateConnectionWhyShape + flatten helper

Sibling-validator pattern for the connection-why artifact shape.
Word count <=24, non-empty, string-type enforcement. Flatten helper
returns the why verbatim for downstream applyContentRules pass."
```

---

## Task 3: `_shared/note-signals.ts` — Deno helper

**Files:**
- Create: `supabase/functions/_shared/note-signals.ts`
- Create: `supabase/functions/_shared/note-signals.test.ts`

- [ ] **Step 1: Read the existing tiptap-text + reference-parser to understand the shape**

Open:
- `supabase/functions/_shared/tiptap-text.ts` — `extractTextFromNoteContent(content: string): string`.
- `src/notepad/graph/reference-parser.ts` — `VERSE_REGEX` (line ~89), `parseVerseRef(ref): { book, chapter, verseStart, verseEnd: number|null }` (line ~206), `normalizeVerseRef(ref)` (line ~95).

The browser-side parser is complex. For sub-project 5, we use the simpler-but-equivalent approach: extract plaintext via `extractTextFromNoteContent`, regex-match against the plaintext for verse refs, normalize using `parseVerseRef`.

- [ ] **Step 2: Write failing tests for `note-signals.ts`**

Create `supabase/functions/_shared/note-signals.test.ts`:

```ts
import {
  extractVerseRefsFromNoteContent,
  intersectTagsAndVerseRefs,
} from './note-signals.ts';

const tipTapWithRefs = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Reading Psalm 23 today, and also Romans 8:28-30.' },
      ],
    },
  ],
});

const tipTapNoRefs = JSON.stringify({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'just words no refs here' }] },
  ],
});

Deno.test('extractVerseRefsFromNoteContent picks up refs in canonical form', () => {
  const refs = extractVerseRefsFromNoteContent(tipTapWithRefs);
  if (!refs.includes('Psalm 23:1')) {
    // Psalm 23 without explicit verse defaults to verse 1 (or the parser may
    // produce 'Psalm 23' with no verse — the test must reflect what parseVerseRef
    // actually does. Run parseVerseRef('Psalm 23') in a scratch script to check.)
  }
  if (!refs.some((r) => r.startsWith('Romans 8:28'))) {
    throw new Error(`expected Romans 8:28-30 in ${JSON.stringify(refs)}`);
  }
});

Deno.test('extractVerseRefsFromNoteContent returns [] for empty', () => {
  const refs = extractVerseRefsFromNoteContent(tipTapNoRefs);
  if (refs.length !== 0) throw new Error(`expected [], got ${JSON.stringify(refs)}`);
});

Deno.test('extractVerseRefsFromNoteContent handles non-JSON gracefully', () => {
  const refs = extractVerseRefsFromNoteContent('plain text Psalm 23');
  if (!refs.length) throw new Error('expected at least Psalm 23 from plaintext');
});

Deno.test('intersectTagsAndVerseRefs is case-insensitive on tags', () => {
  const result = intersectTagsAndVerseRefs(
    { tags: ['Prayer', 'doubt'], verseRefs: ['Psalm 23:1'] },
    { tags: ['prayer', 'wisdom'], verseRefs: ['Psalm 23:1', 'Proverbs 3:5'] },
  );
  if (!result.sharedTags.some((t) => t.toLowerCase() === 'prayer')) {
    throw new Error(`expected 'prayer' in sharedTags, got ${JSON.stringify(result.sharedTags)}`);
  }
  if (!result.sharedVerseRefs.includes('Psalm 23:1')) {
    throw new Error(`expected 'Psalm 23:1' in sharedVerseRefs, got ${JSON.stringify(result.sharedVerseRefs)}`);
  }
});

Deno.test('intersectTagsAndVerseRefs returns empty arrays when nothing overlaps', () => {
  const result = intersectTagsAndVerseRefs(
    { tags: ['a'], verseRefs: ['Genesis 1:1'] },
    { tags: ['b'], verseRefs: ['Revelation 1:1'] },
  );
  if (result.sharedTags.length !== 0) throw new Error('sharedTags should be empty');
  if (result.sharedVerseRefs.length !== 0) throw new Error('sharedVerseRefs should be empty');
});

Deno.test('intersectTagsAndVerseRefs dedupes', () => {
  const result = intersectTagsAndVerseRefs(
    { tags: ['x', 'x'], verseRefs: ['Genesis 1:1', 'Genesis 1:1'] },
    { tags: ['x'], verseRefs: ['Genesis 1:1'] },
  );
  if (result.sharedTags.length !== 1) {
    throw new Error(`expected dedupe, got ${JSON.stringify(result.sharedTags)}`);
  }
  if (result.sharedVerseRefs.length !== 1) {
    throw new Error(`expected dedupe, got ${JSON.stringify(result.sharedVerseRefs)}`);
  }
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `deno test supabase/functions/_shared/note-signals.test.ts --allow-env --allow-net`

Expected: all tests fail (module not found).

- [ ] **Step 4: Implement `note-signals.ts`**

Create `supabase/functions/_shared/note-signals.ts`:

```ts
// Deno-side helper for Connection Cards (sub-project 5).
//
// Extracts verse refs from a note's TipTap-JSON content and intersects
// (tags, verseRefs) between two notes. The browser-side mirror lives at
// src/notepad/utils/connection-signals.ts; a parity test asserts both
// produce identical output on a shared fixture (see note-signals.test.ts
// and connection-signals.test.ts).
//
// Verse-ref extraction strategy: plaintext + regex. Note content goes
// through extractTextFromNoteContent first; we then match the canonical
// verse-pattern regex against the plaintext. This is intentionally simpler
// than walking the TipTap tree for marks — sub-project 5 just needs
// overlap signals, not perfect ref provenance.

import { extractTextFromNoteContent } from './tiptap-text.ts';

// Mirrors src/notepad/graph/reference-parser.ts BOOK_PATTERNS shape.
// Kept inlined here to avoid a cross-runtime import; parity test catches drift.
const BOOK_PATTERNS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
  '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalm', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations',
  'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah',
  'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
];

const BOOKS_ALT = BOOK_PATTERNS.map((b) => b.replace(/ /g, '\\s+')).join('|');
const VERSE_REGEX = new RegExp(
  `\\b(${BOOKS_ALT})\\s+(\\d+)(?::(\\d+)(?:[-–](\\d+))?)?`,
  'gi',
);

function normalizeBook(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  // case-insensitive lookup
  for (const canonical of BOOK_PATTERNS) {
    if (canonical.toLowerCase() === collapsed.toLowerCase()) return canonical;
  }
  return collapsed;
}

function refKey(book: string, chapter: number, verseStart: number | null, verseEnd: number | null): string {
  const canonical = normalizeBook(book);
  if (verseStart === null) return `${canonical} ${chapter}`;
  if (verseEnd === null || verseEnd === verseStart) return `${canonical} ${chapter}:${verseStart}`;
  return `${canonical} ${chapter}:${verseStart}-${verseEnd}`;
}

export function extractVerseRefsFromNoteContent(content: string): string[] {
  const plaintext = extractTextFromNoteContent(content);
  const refs = new Set<string>();
  for (const match of plaintext.matchAll(VERSE_REGEX)) {
    const book = match[1];
    const chapter = parseInt(match[2], 10);
    const verseStart = match[3] ? parseInt(match[3], 10) : null;
    const verseEnd = match[4] ? parseInt(match[4], 10) : null;
    if (Number.isNaN(chapter)) continue;
    refs.add(refKey(book, chapter, verseStart, verseEnd));
  }
  return [...refs];
}

export interface NoteSignals {
  tags: string[];
  verseRefs: string[];
}

export interface SharedSignals {
  sharedTags: string[];
  sharedVerseRefs: string[];
}

export function intersectTagsAndVerseRefs(
  source: NoteSignals,
  related: NoteSignals,
): SharedSignals {
  const sourceTagsLower = new Set(source.tags.map((t) => t.toLowerCase()));
  const sharedTagsRaw: string[] = [];
  const seenTagLower = new Set<string>();
  for (const t of related.tags) {
    const lower = t.toLowerCase();
    if (sourceTagsLower.has(lower) && !seenTagLower.has(lower)) {
      seenTagLower.add(lower);
      sharedTagsRaw.push(t);
    }
  }

  const sourceRefs = new Set(source.verseRefs);
  const seenRef = new Set<string>();
  const sharedRefs: string[] = [];
  for (const r of related.verseRefs) {
    if (sourceRefs.has(r) && !seenRef.has(r)) {
      seenRef.add(r);
      sharedRefs.push(r);
    }
  }

  return { sharedTags: sharedTagsRaw, sharedVerseRefs: sharedRefs };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `deno test supabase/functions/_shared/note-signals.test.ts --allow-env --allow-net`

Expected: all tests pass.

If the `Psalm 23` test fails because the regex produces `Psalm 23` (no verse) and the test expected `Psalm 23:1`, update the test's expectation to match the regex behavior — chapter-only refs are valid output.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/note-signals.ts supabase/functions/_shared/note-signals.test.ts
git commit -m "feat(lamplight): _shared/note-signals.ts (Deno helper)

Verse-ref extraction + (tags, refs) intersection for Connection
Cards. Plaintext + regex strategy; mirrors the browser-side
connection-signals.ts. Cross-runtime parity test lands in the
client task."
```

---

## Task 4: `connection-signals.ts` — browser helper + cross-runtime parity

**Files:**
- Create: `src/notepad/utils/connection-signals.ts`
- Create: `src/notepad/utils/connection-signals.test.ts`

- [ ] **Step 1: Write failing tests for the browser helper**

Create `src/notepad/utils/connection-signals.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  computeSharedSignals,
  extractVerseRefsFromNote,
} from './connection-signals';
import type { Note } from '../types';

function fakeNote(overrides: Partial<Note>): Note {
  return {
    id: 'note-1',
    title: 'Untitled',
    content: JSON.stringify({ type: 'doc', content: [] }),
    tags: [],
    folderId: null,
    type: 'general',
    createdAt: '2026-05-27T00:00:00.000Z',
    updatedAt: '2026-05-27T00:00:00.000Z',
    ...overrides,
  };
}

const refContent = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Reading Psalm 23 today, and Romans 8:28-30.' },
      ],
    },
  ],
});

describe('extractVerseRefsFromNote', () => {
  it('extracts canonical refs from TipTap content', () => {
    const refs = extractVerseRefsFromNote(fakeNote({ content: refContent }));
    expect(refs.some((r) => r.startsWith('Romans 8:28'))).toBe(true);
    expect(refs.some((r) => r.startsWith('Psalm 23'))).toBe(true);
  });

  it('returns [] for empty content', () => {
    expect(extractVerseRefsFromNote(fakeNote({ content: '' }))).toEqual([]);
  });
});

describe('computeSharedSignals', () => {
  it('intersects tags case-insensitively', () => {
    const a = fakeNote({ tags: ['Prayer', 'doubt'] });
    const b = fakeNote({ id: 'note-2', tags: ['prayer', 'wisdom'] });
    const result = computeSharedSignals(a, b);
    expect(result.sharedTags.map((t) => t.toLowerCase())).toEqual(['prayer']);
  });

  it('intersects verse refs', () => {
    const a = fakeNote({ content: refContent });
    const b = fakeNote({
      id: 'note-2',
      content: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Came back to Romans 8:28-30 again.' }],
          },
        ],
      }),
    });
    const result = computeSharedSignals(a, b);
    expect(result.sharedVerseRefs.some((r) => r.startsWith('Romans 8:28'))).toBe(true);
  });

  it('returns empty arrays when nothing overlaps', () => {
    const a = fakeNote({ tags: ['a'], content: refContent });
    const b = fakeNote({
      id: 'note-2',
      tags: ['b'],
      content: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'no refs' }] }],
      }),
    });
    const result = computeSharedSignals(a, b);
    expect(result.sharedTags).toEqual([]);
    expect(result.sharedVerseRefs).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/notepad/utils/connection-signals.test.ts`

Expected: all tests fail (module not found).

- [ ] **Step 3: Implement `connection-signals.ts`**

Create `src/notepad/utils/connection-signals.ts`:

```ts
// Browser-side helper for Connection Cards.
//
// The Deno mirror lives at supabase/functions/_shared/note-signals.ts.
// Both produce identical output on shared fixtures — the parity test in
// connection-signals.test.ts (this file's neighbor) and the Deno-side
// note-signals.test.ts ensure no drift.
//
// Implementation note: we reuse the existing browser reference-parser's
// VERSE_REGEX + parseVerseRef rather than re-inlining book patterns. The
// Deno side cannot import from src/, so it inlines its own copy; parity
// is enforced by tests.

import type { Note } from '../types';
import { extractTextFromNote } from './tiptap-text';
import { VERSE_REGEX, parseVerseRef } from '../graph/reference-parser';

function refKey(book: string, chapter: number, verseStart: number | null, verseEnd: number | null): string {
  if (verseStart === null) return `${book} ${chapter}`;
  if (verseEnd === null || verseEnd === verseStart) return `${book} ${chapter}:${verseStart}`;
  return `${book} ${chapter}:${verseStart}-${verseEnd}`;
}

export function extractVerseRefsFromNote(note: Note): string[] {
  const plaintext = extractTextFromNote(note);
  if (!plaintext) return [];
  const refs = new Set<string>();
  // VERSE_REGEX is /g; reset by using matchAll which is stateless.
  for (const match of plaintext.matchAll(new RegExp(VERSE_REGEX.source, VERSE_REGEX.flags))) {
    const raw = match[0];
    const parsed = parseVerseRef(raw);
    if (!parsed) continue;
    refs.add(refKey(parsed.book, parsed.chapter, parsed.verseStart ?? null, parsed.verseEnd ?? null));
  }
  return [...refs];
}

export interface SharedSignals {
  sharedTags: string[];
  sharedVerseRefs: string[];
}

export function computeSharedSignals(active: Note, related: Note): SharedSignals {
  const activeTagLower = new Set(active.tags.map((t) => t.toLowerCase()));
  const seenTagLower = new Set<string>();
  const sharedTags: string[] = [];
  for (const t of related.tags) {
    const lower = t.toLowerCase();
    if (activeTagLower.has(lower) && !seenTagLower.has(lower)) {
      seenTagLower.add(lower);
      sharedTags.push(t);
    }
  }

  const activeRefs = new Set(extractVerseRefsFromNote(active));
  const relatedRefs = extractVerseRefsFromNote(related);
  const seenRef = new Set<string>();
  const sharedVerseRefs: string[] = [];
  for (const r of relatedRefs) {
    if (activeRefs.has(r) && !seenRef.has(r)) {
      seenRef.add(r);
      sharedVerseRefs.push(r);
    }
  }

  return { sharedTags, sharedVerseRefs };
}
```

If `parseVerseRef` returns `{ verseStart: number; verseEnd: number | null }` (no chance of `verseStart === undefined`), simplify to `parsed.verseStart` directly. Inspect `src/notepad/graph/reference-parser.ts:206` for the exact shape.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/notepad/utils/connection-signals.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Add a cross-runtime parity test (Deno side)**

Append to `supabase/functions/_shared/note-signals.test.ts`:

```ts
Deno.test('parity: known fixture produces stable output across runtimes', () => {
  const fixture = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'In Psalm 23 the shepherd theme returns. Compare Romans 8:28-30.' },
        ],
      },
    ],
  });
  const refs = extractVerseRefsFromNoteContent(fixture);
  // This exact set is the canonical output; the browser-side test
  // (connection-signals.test.ts) hashes the same fixture and asserts the
  // identical array. If you change book normalization here, change there too.
  const expected = ['Psalm 23', 'Romans 8:28-30'];
  // Order-insensitive compare:
  const sortedRefs = [...refs].sort();
  const sortedExp = [...expected].sort();
  if (JSON.stringify(sortedRefs) !== JSON.stringify(sortedExp)) {
    throw new Error(`parity drift: got ${JSON.stringify(sortedRefs)}, expected ${JSON.stringify(sortedExp)}`);
  }
});
```

- [ ] **Step 6: Add the matching parity test on the browser side**

Append to `src/notepad/utils/connection-signals.test.ts`:

```ts
describe('parity with Deno note-signals', () => {
  it('extracts the same canonical refs from the shared fixture', () => {
    const fixture = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'In Psalm 23 the shepherd theme returns. Compare Romans 8:28-30.' },
          ],
        },
      ],
    });
    const refs = extractVerseRefsFromNote(fakeNote({ content: fixture }));
    expect([...refs].sort()).toEqual(['Psalm 23', 'Romans 8:28-30'].sort());
  });
});
```

- [ ] **Step 7: Run BOTH parity tests**

Run:
```
deno test supabase/functions/_shared/note-signals.test.ts --allow-env --allow-net
npx vitest run src/notepad/utils/connection-signals.test.ts
```

Expected: both green. If one side normalizes book names differently (e.g., one side returns `'Psalms 23'` and the other `'Psalm 23'`), fix the divergent side until output matches.

- [ ] **Step 8: Commit**

```bash
git add src/notepad/utils/connection-signals.ts src/notepad/utils/connection-signals.test.ts supabase/functions/_shared/note-signals.test.ts
git commit -m "feat(lamplight): connection-signals.ts (browser) + cross-runtime parity

Browser-side mirror of _shared/note-signals.ts. Parity tests on both
sides assert identical output on a shared fixture so client and server
intersect the same verse refs."
```

---

## Task 5: Adapter interface additions (types + signatures only)

**Files:**
- Modify: `src/notepad/storage/lamplight-adapter.ts`

- [ ] **Step 1: Read the current adapter interface**

Open `src/notepad/storage/lamplight-adapter.ts`. Confirm the current method list ends with `generateDailyDevotion`. You'll append three methods + two types.

- [ ] **Step 2: Append types + interface methods**

Add the following to `src/notepad/storage/lamplight-adapter.ts` (before `export interface LamplightAdapter` closure if it's open, or append after the existing interface):

```ts
export interface ConnectionNeighbor {
  relatedNoteId: string;
  similarity: number;
}

export type ConnectionWhyResult =
  | { ok: true; why: string; cached: boolean }
  | { ok: false; reason: 'no_embedding' | 'validators_failed' | 'not_neighbor' | 'network' };
```

Inside `export interface LamplightAdapter { ... }`, add:

```ts
  /**
   * Returns top-K cosine neighbors for the source note. Calls the
   * `match_my_note_neighbors` RPC, which is authenticated-callable and
   * enforces ownership internally. Returns [] when the source note has
   * no embedding OR no neighbors above the similarity threshold (the
   * RPC does not distinguish; use hasNoteEmbedding() if you need to.
   */
  getConnectionNeighbors(sourceNoteId: string, k?: number): Promise<ConnectionNeighbor[]>;

  /**
   * Returns true iff a row exists in lamplight_embeddings for
   * (auth.uid(), 'note', noteId). Used to disambiguate the
   * embedding-not-ready transient state from the no-neighbors-above-
   * threshold stable state.
   */
  hasNoteEmbedding(noteId: string): Promise<boolean>;

  /**
   * Invokes lamplight-generate Edge Function with kind='connection_card_why'.
   * Returns the persisted why string on success, or a typed reason on
   * failure. `network` reason covers any error thrown before the function
   * ran; `no_embedding`, `validators_failed`, and `not_neighbor` are
   * returned by the function itself.
   */
  generateConnectionWhy(
    sourceNoteId: string,
    relatedNoteId: string,
  ): Promise<ConnectionWhyResult>;
```

- [ ] **Step 3: Verify tsc still compiles**

Run: `npx tsc -b`

Expected: type errors in `supabase-lamplight-adapter.ts` and `fake-lamplight-adapter.ts` because they don't yet implement the new methods. That's expected — they're filled in next.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/storage/lamplight-adapter.ts
git commit -m "feat(lamplight): LamplightAdapter — Connection Cards interface

Adds getConnectionNeighbors, hasNoteEmbedding, generateConnectionWhy
types + signatures. Concrete impls land in supabase / fake adapter
tasks; tsc will fail on those files until then."
```

---

## Task 6: `FakeLamplightAdapter` impls + test helpers

**Files:**
- Modify: `src/notepad/storage/fake-lamplight-adapter.ts`
- Modify: `src/notepad/storage/fake-lamplight-adapter.test.ts`

- [ ] **Step 1: Read the existing fake adapter to learn the in-memory store pattern**

Open `src/notepad/storage/fake-lamplight-adapter.ts`. Note how `__seedDailyDevotion` and `__failNextGenerateDailyDevotion` work (or whatever the canonical helper-name pattern is — match it for the new methods).

- [ ] **Step 2: Write failing tests**

Append to `src/notepad/storage/fake-lamplight-adapter.test.ts`:

```ts
describe('FakeLamplightAdapter — Connection Cards', () => {
  it('getConnectionNeighbors returns seeded neighbors', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.91 },
      { relatedNoteId: 'note-3', similarity: 0.83 },
    ]);
    const result = await adapter.getConnectionNeighbors('note-1', 5);
    expect(result).toEqual([
      { relatedNoteId: 'note-2', similarity: 0.91 },
      { relatedNoteId: 'note-3', similarity: 0.83 },
    ]);
  });

  it('getConnectionNeighbors returns [] for an unseeded source', async () => {
    const adapter = new FakeLamplightAdapter();
    const result = await adapter.getConnectionNeighbors('note-unknown', 5);
    expect(result).toEqual([]);
  });

  it('hasNoteEmbedding returns true after seed, false otherwise', async () => {
    const adapter = new FakeLamplightAdapter();
    expect(await adapter.hasNoteEmbedding('note-1')).toBe(false);
    adapter.__seedNoteEmbedding('note-1');
    expect(await adapter.hasNoteEmbedding('note-1')).toBe(true);
  });

  it('generateConnectionWhy returns cached why when seeded', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedConnectionWhy('note-1', 'note-2', 'They share a shepherd image.');
    const result = await adapter.generateConnectionWhy('note-1', 'note-2');
    expect(result).toEqual({ ok: true, why: 'They share a shepherd image.', cached: true });
  });

  it('generateConnectionWhy returns generated why on default path', async () => {
    const adapter = new FakeLamplightAdapter();
    const result = await adapter.generateConnectionWhy('note-1', 'note-2');
    if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`);
    expect(typeof result.why).toBe('string');
    expect(result.cached).toBe(false);
  });

  it('generateConnectionWhy honors __failNextGenerateConnectionWhy', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__failNextGenerateConnectionWhy('validators_failed');
    const result = await adapter.generateConnectionWhy('note-1', 'note-2');
    expect(result).toEqual({ ok: false, reason: 'validators_failed' });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/notepad/storage/fake-lamplight-adapter.test.ts`

Expected: 6 failures (methods + helpers undefined).

- [ ] **Step 4: Implement on `FakeLamplightAdapter`**

In `src/notepad/storage/fake-lamplight-adapter.ts`:

1. Add private fields in the class body:

```ts
  private readonly connectionNeighbors = new Map<string, ConnectionNeighbor[]>();
  private readonly noteEmbeddingsPresent = new Set<string>();
  private readonly connectionWhyCache = new Map<string, string>(); // key: `${source}::${related}`
  private nextGenerateConnectionWhyFailure:
    | 'no_embedding'
    | 'validators_failed'
    | 'not_neighbor'
    | 'network'
    | null = null;
```

(Also import `ConnectionNeighbor` from `./lamplight-adapter` if not already imported.)

2. Add the public methods:

```ts
  async getConnectionNeighbors(sourceNoteId: string, _k = 5): Promise<ConnectionNeighbor[]> {
    return this.connectionNeighbors.get(sourceNoteId) ?? [];
  }

  async hasNoteEmbedding(noteId: string): Promise<boolean> {
    return this.noteEmbeddingsPresent.has(noteId);
  }

  async generateConnectionWhy(
    sourceNoteId: string,
    relatedNoteId: string,
  ): Promise<ConnectionWhyResult> {
    if (this.nextGenerateConnectionWhyFailure) {
      const reason = this.nextGenerateConnectionWhyFailure;
      this.nextGenerateConnectionWhyFailure = null;
      return { ok: false, reason };
    }
    const key = `${sourceNoteId}::${relatedNoteId}`;
    const cached = this.connectionWhyCache.get(key);
    if (cached) {
      return { ok: true, why: cached, cached: true };
    }
    const why = `Fake connection between ${sourceNoteId} and ${relatedNoteId}.`;
    this.connectionWhyCache.set(key, why);
    return { ok: true, why, cached: false };
  }
```

3. Add the test helpers:

```ts
  __seedConnectionNeighbors(sourceNoteId: string, neighbors: ConnectionNeighbor[]): void {
    this.connectionNeighbors.set(sourceNoteId, neighbors);
  }

  __seedNoteEmbedding(noteId: string): void {
    this.noteEmbeddingsPresent.add(noteId);
  }

  __seedConnectionWhy(sourceNoteId: string, relatedNoteId: string, why: string): void {
    this.connectionWhyCache.set(`${sourceNoteId}::${relatedNoteId}`, why);
  }

  __failNextGenerateConnectionWhy(reason: 'no_embedding' | 'validators_failed' | 'not_neighbor' | 'network'): void {
    this.nextGenerateConnectionWhyFailure = reason;
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/notepad/storage/fake-lamplight-adapter.test.ts`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/notepad/storage/fake-lamplight-adapter.ts src/notepad/storage/fake-lamplight-adapter.test.ts
git commit -m "feat(lamplight): FakeLamplightAdapter — Connection Cards impls

Adds getConnectionNeighbors, hasNoteEmbedding, generateConnectionWhy +
__seed/__fail test helpers following the established adapter-fake
pattern."
```

---

## Task 7: `SupabaseLamplightAdapter` impls

**Files:**
- Modify: `src/notepad/storage/supabase-lamplight-adapter.ts`
- Modify: `src/notepad/storage/supabase-lamplight-adapter.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/notepad/storage/supabase-lamplight-adapter.test.ts`. Use the existing mock-SupabaseClient pattern from prior tests in the same file. The shape below assumes a builder-pattern mock; adapt to whatever is already used.

```ts
describe('SupabaseLamplightAdapter — Connection Cards', () => {
  it('getConnectionNeighbors calls match_my_note_neighbors with k', async () => {
    const rpcFake = createRpcFake({
      match_my_note_neighbors: {
        data: [
          { related_note_id: 'note-2', similarity: 0.91 },
          { related_note_id: 'note-3', similarity: 0.83 },
        ],
        error: null,
      },
    });
    const client = createClientFake({ rpc: rpcFake });
    const adapter = new SupabaseLamplightAdapter(client);
    const result = await adapter.getConnectionNeighbors('note-1', 5);
    expect(result).toEqual([
      { relatedNoteId: 'note-2', similarity: 0.91 },
      { relatedNoteId: 'note-3', similarity: 0.83 },
    ]);
    expect(rpcFake.calls[0]).toEqual({
      name: 'match_my_note_neighbors',
      args: { p_source_note_id: 'note-1', p_k: 5 },
    });
  });

  it('getConnectionNeighbors throws on RPC error', async () => {
    const client = createClientFake({
      rpc: createRpcFake({
        match_my_note_neighbors: { data: null, error: new Error('not authorized') },
      }),
    });
    const adapter = new SupabaseLamplightAdapter(client);
    await expect(adapter.getConnectionNeighbors('note-1')).rejects.toThrow();
  });

  it('hasNoteEmbedding returns true when count > 0', async () => {
    const fromFake = createFromFake({
      lamplight_embeddings: { count: 1, error: null },
    });
    const client = createClientFake({ from: fromFake });
    const adapter = new SupabaseLamplightAdapter(client);
    expect(await adapter.hasNoteEmbedding('note-1')).toBe(true);
  });

  it('hasNoteEmbedding returns false when count = 0', async () => {
    const fromFake = createFromFake({
      lamplight_embeddings: { count: 0, error: null },
    });
    const client = createClientFake({ from: fromFake });
    const adapter = new SupabaseLamplightAdapter(client);
    expect(await adapter.hasNoteEmbedding('note-1')).toBe(false);
  });

  it('generateConnectionWhy returns ok on { ok: true, why } response', async () => {
    const invokeFake = createInvokeFake({
      'lamplight-generate': { data: { ok: true, why: 'They share a shepherd image.', cached: false }, error: null },
    });
    const client = createClientFake({ functions: { invoke: invokeFake } });
    const adapter = new SupabaseLamplightAdapter(client);
    const result = await adapter.generateConnectionWhy('note-1', 'note-2');
    expect(result).toEqual({ ok: true, why: 'They share a shepherd image.', cached: false });
  });

  it('generateConnectionWhy maps function-level no_embedding', async () => {
    const invokeFake = createInvokeFake({
      'lamplight-generate': { data: { ok: false, reason: 'no_embedding' }, error: null },
    });
    const client = createClientFake({ functions: { invoke: invokeFake } });
    const adapter = new SupabaseLamplightAdapter(client);
    const result = await adapter.generateConnectionWhy('note-1', 'note-2');
    expect(result).toEqual({ ok: false, reason: 'no_embedding' });
  });

  it('generateConnectionWhy maps transport error to network', async () => {
    const invokeFake = createInvokeFake({
      'lamplight-generate': { data: null, error: new Error('boom') },
    });
    const client = createClientFake({ functions: { invoke: invokeFake } });
    const adapter = new SupabaseLamplightAdapter(client);
    const result = await adapter.generateConnectionWhy('note-1', 'note-2');
    expect(result).toEqual({ ok: false, reason: 'network' });
  });
});
```

If the test file uses inline-defined Supabase client fakes instead of the `createXFake` helpers above, mirror the existing style — don't introduce a new mock helper if one already exists.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/notepad/storage/supabase-lamplight-adapter.test.ts`

Expected: 7 failures.

- [ ] **Step 3: Implement on `SupabaseLamplightAdapter`**

In `src/notepad/storage/supabase-lamplight-adapter.ts`, find the existing class and add:

```ts
  async getConnectionNeighbors(sourceNoteId: string, k = 5): Promise<ConnectionNeighbor[]> {
    const { data, error } = await this.client.rpc('match_my_note_neighbors', {
      p_source_note_id: sourceNoteId,
      p_k: k,
    });
    if (error) throw error;
    return ((data as Array<{ related_note_id: string; similarity: number }>) ?? []).map((row) => ({
      relatedNoteId: row.related_note_id,
      similarity: row.similarity,
    }));
  }

  async hasNoteEmbedding(noteId: string): Promise<boolean> {
    const { count, error } = await this.client
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
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) return { ok: false, reason: 'network' };
      const { data, error } = await this.client.functions.invoke('lamplight-generate', {
        body: {
          kind: 'connection_card_why',
          user_id: user.id,
          source_note_id: sourceNoteId,
          related_note_id: relatedNoteId,
        },
      });
      if (error) return { ok: false, reason: 'network' };
      if (!data || typeof data !== 'object') return { ok: false, reason: 'network' };
      const d = data as Record<string, unknown>;
      if (d.ok === true && typeof d.why === 'string') {
        return { ok: true, why: d.why, cached: !!d.cached };
      }
      if (
        d.ok === false &&
        (d.reason === 'no_embedding' || d.reason === 'validators_failed' || d.reason === 'not_neighbor')
      ) {
        return { ok: false, reason: d.reason as 'no_embedding' | 'validators_failed' | 'not_neighbor' };
      }
      return { ok: false, reason: 'network' };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }
```

Also import `ConnectionNeighbor` and `ConnectionWhyResult` at the top of the file.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/notepad/storage/supabase-lamplight-adapter.test.ts`

Expected: all tests pass.

Also run `npx tsc -b` — should now compile cleanly across both adapter implementations.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/storage/supabase-lamplight-adapter.ts src/notepad/storage/supabase-lamplight-adapter.test.ts
git commit -m "feat(lamplight): SupabaseLamplightAdapter — Connection Cards impls

getConnectionNeighbors calls match_my_note_neighbors RPC directly
(authenticated path, no Edge Function hop). hasNoteEmbedding does a
HEAD count against lamplight_embeddings. generateConnectionWhy invokes
the lamplight-generate function with kind='connection_card_why' and
maps the response into typed ConnectionWhyResult."
```

---

## Task 8: Prompt template — `connection-why.ts`

**Files:**
- Create: `supabase/functions/lamplight-generate/prompts/connection-why.ts`

- [ ] **Step 1: Read the sibling prompt for the pattern**

Open `supabase/functions/lamplight-generate/prompts/daily-devotion.ts` to confirm the `{ promptVersion, system, tool, buildMessages }` export shape.

- [ ] **Step 2: Create the prompt module**

Create `supabase/functions/lamplight-generate/prompts/connection-why.ts`:

```ts
import type { ConnectionWhyContext } from '../connection-why-pipeline.ts';

export const CONNECTION_WHY_PROMPT_VERSION = 'connection-why-2026-05-27-v1';

export const CONNECTION_WHY_PROMPT = {
  promptVersion: CONNECTION_WHY_PROMPT_VERSION,
  system: [
    "Two of the user's notes share signal. In ≤24 words, name what they share.",
    '',
    'How to write the line:',
    '- Concrete and observable. Name a recurring image, theme, or question that links them.',
    '- Describe — do not advise. No "you should…", no "consider…", no "remember…".',
    '- Quote nothing verbatim from either note. Reference is fine; transcription is not.',
    '- If the shared signal is a Scripture reference, name it gently.',
    '- Mirror the user\'s voice preference for divine names: use "{{voice_preference}}".',
    '',
    "You inherit the voice fragment's prohibitions — no prophetic claims, no streak language,",
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
    const sourceBlock =
      `Active note (id=${ctx.source.id}, title="${ctx.source.title}"):\n` +
      ctx.source.plaintext.slice(0, 1200);
    const relatedBlock =
      `Related note (id=${ctx.related.id}, title="${ctx.related.title}"):\n` +
      ctx.related.plaintext.slice(0, 1200);
    const tagsLine = ctx.sharedTags.length ? ctx.sharedTags.join(', ') : 'none';
    const refsLine = ctx.sharedVerseRefs.length ? ctx.sharedVerseRefs.join(', ') : 'none';
    return [{
      role: 'user',
      content:
        `${sourceBlock}\n\n${relatedBlock}\n\n` +
        `Shared signals — tags: [${tagsLine}]; verse refs: [${refsLine}]; ` +
        `cosine similarity: ${ctx.similarity.toFixed(3)}.\n\n` +
        `Write the connection in ≤24 words.`,
    }];
  },
} as const;
```

- [ ] **Step 3: Verify Deno can type-check the module (smoke-only — pipeline module doesn't exist yet)**

The file imports `ConnectionWhyContext` from a sibling module that doesn't exist yet — this is expected. The next task creates `connection-why-pipeline.ts`. Move on.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/lamplight-generate/prompts/connection-why.ts
git commit -m "feat(lamplight): connection-why prompt template

Inherits LAMPLIGHT_SYSTEM_FRAGMENT via composeSystem. Tool-use forced
output { why: string, 8-200 chars }. buildMessages composes the
source + related blocks with shared-signal context."
```

---

## Task 9: Pipeline — `connection-why-pipeline.ts`

**Files:**
- Create: `supabase/functions/lamplight-generate/connection-why-pipeline.ts`
- Create: `supabase/functions/lamplight-generate/connection-why-pipeline.test.ts`

- [ ] **Step 1: Read the sibling pipeline for shape**

Open `supabase/functions/lamplight-generate/daily-devotion-pipeline.ts`. Note:
- The shape of `formatStricterSuffix(violations)`.
- How `composeSystem` is called with `LAMPLIGHT_SYSTEM_FRAGMENT` + artifact stance + stricter suffix.
- The shape of the result type (discriminated union on `ok`).
- Persistence on success via `upsert`.

- [ ] **Step 2: Write failing tests**

Create `supabase/functions/lamplight-generate/connection-why-pipeline.test.ts`:

```ts
import {
  runConnectionWhyPipeline,
  type ConnectionWhyContext,
} from './connection-why-pipeline.ts';
import type { LLMAdapter } from '../_shared/anthropic.ts';

function makeCtx(over: Partial<ConnectionWhyContext> = {}): ConnectionWhyContext {
  return {
    userId: 'u1',
    source: { id: 'note-1', title: 'A', plaintext: 'wilderness fasting...' },
    related: { id: 'note-2', title: 'B', plaintext: 'wilderness exile...' },
    similarity: 0.91,
    voicePreference: 'Lord',
    compositeHash: 'abc123',
    sharedTags: ['wilderness'],
    sharedVerseRefs: [],
    ...over,
  };
}

function makeLLM(
  responses: Array<{ why: string }>,
  capturedSystem: string[] = [],
): LLMAdapter {
  let i = 0;
  return {
    async generate({ system }) {
      capturedSystem.push(system);
      const r = responses[i++];
      if (!r) throw new Error('no more LLM responses');
      return {
        parsed: r,
        modelUsed: 'claude-haiku-4-5-20251001',
        promptTokens: 100,
        completionTokens: 20,
      };
    },
  } as LLMAdapter;
}

function makeSupabaseFake(opts: {
  cachedRow?: { why: string; content_hash: string };
  upsertCalls?: Array<Record<string, unknown>>;
}) {
  const upsertCalls = opts.upsertCalls ?? [];
  return {
    from(table: string) {
      if (table === 'lamplight_connections') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle() {
            return Promise.resolve({
              data: opts.cachedRow ?? null,
              error: null,
            });
          },
          upsert(payload: Record<string, unknown>) {
            upsertCalls.push(payload);
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  } as unknown as Parameters<typeof runConnectionWhyPipeline>[0]['supabase'];
}

Deno.test('cache hit returns cached why without LLM call', async () => {
  const captured: string[] = [];
  const llm = makeLLM([], captured);
  const result = await runConnectionWhyPipeline({
    llm,
    supabase: makeSupabaseFake({ cachedRow: { why: 'cached!', content_hash: 'abc123' } }),
    ctx: makeCtx(),
  });
  if (!result.ok) throw new Error('expected ok');
  if (!result.cached) throw new Error('expected cached: true');
  if (result.why !== 'cached!') throw new Error(`got ${result.why}`);
  if (captured.length !== 0) throw new Error('LLM should not be called');
});

Deno.test('cache miss generates, validates, upserts', async () => {
  const upsertCalls: Array<Record<string, unknown>> = [];
  const llm = makeLLM([{ why: 'Both notes return to wilderness.' }]);
  const result = await runConnectionWhyPipeline({
    llm,
    supabase: makeSupabaseFake({ upsertCalls }),
    ctx: makeCtx(),
  });
  if (!result.ok) throw new Error('expected ok');
  if (result.cached) throw new Error('expected cached: false');
  if (upsertCalls.length !== 1) throw new Error(`expected 1 upsert, got ${upsertCalls.length}`);
  const row = upsertCalls[0];
  if (row.note_id !== 'note-1') throw new Error('bad source');
  if (row.related_note_id !== 'note-2') throw new Error('bad related');
  if (row.content_hash !== 'abc123') throw new Error('bad hash');
  if (row.why !== 'Both notes return to wilderness.') throw new Error('bad why');
});

Deno.test('validator-fail-then-retry succeeds on second attempt', async () => {
  const banned = 'God is telling you to wander into the wilderness.'; // present-tense prophetic
  const upsertCalls: Array<Record<string, unknown>> = [];
  const llm = makeLLM([{ why: banned }, { why: 'Wilderness shows up in both.' }]);
  const result = await runConnectionWhyPipeline({
    llm,
    supabase: makeSupabaseFake({ upsertCalls }),
    ctx: makeCtx(),
  });
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  if (result.attempts !== 2) throw new Error(`expected 2 attempts, got ${result.attempts}`);
  if (upsertCalls.length !== 1) throw new Error('expected 1 upsert');
});

Deno.test('hard fail: both attempts violate, no persistence', async () => {
  const banned = 'God is telling you to wander.';
  const upsertCalls: Array<Record<string, unknown>> = [];
  const llm = makeLLM([{ why: banned }, { why: banned }]);
  const result = await runConnectionWhyPipeline({
    llm,
    supabase: makeSupabaseFake({ upsertCalls }),
    ctx: makeCtx(),
  });
  if (result.ok) throw new Error('expected hard fail');
  if (result.reason !== 'validators_failed') throw new Error('wrong reason');
  if (result.attempts !== 2) throw new Error('expected 2 attempts');
  if (upsertCalls.length !== 0) throw new Error('should not persist on hard fail');
});

Deno.test('shape violation (>24 words) triggers retry', async () => {
  const longWhy = ('w '.repeat(30)).trim();
  const upsertCalls: Array<Record<string, unknown>> = [];
  const llm = makeLLM([{ why: longWhy }, { why: 'short and clean.' }]);
  const result = await runConnectionWhyPipeline({
    llm,
    supabase: makeSupabaseFake({ upsertCalls }),
    ctx: makeCtx(),
  });
  if (!result.ok) throw new Error('expected ok');
  if (result.attempts !== 2) throw new Error('expected retry');
});

Deno.test('voice fragment composed in system prompt', async () => {
  const captured: string[] = [];
  const llm = makeLLM([{ why: 'wilderness theme.' }], captured);
  await runConnectionWhyPipeline({
    llm,
    supabase: makeSupabaseFake({}),
    ctx: makeCtx({ voicePreference: 'Father' }),
  });
  const sys = captured[0];
  if (!sys.includes('Lamplight')) throw new Error('missing LAMPLIGHT_SYSTEM_FRAGMENT');
  if (!sys.includes('Father')) throw new Error('voice token not substituted');
  if (sys.includes('{{voice_preference}}')) throw new Error('token substitution leaked');
});
```

- [ ] **Step 3: Run tests — verify they fail**

Run: `deno test supabase/functions/lamplight-generate/connection-why-pipeline.test.ts --allow-env --allow-net`

Expected: all fail (module not found).

- [ ] **Step 4: Implement `connection-why-pipeline.ts`**

Create `supabase/functions/lamplight-generate/connection-why-pipeline.ts`:

```ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import type { LLMAdapter } from '../_shared/anthropic.ts';
import {
  applyContentRules,
  flattenConnectionWhyText,
  validateConnectionWhyShape,
  type ConnectionShapeViolation,
  type ConnectionWhyArtifact,
  type ContentRuleViolation,
} from '../_shared/validators.ts';
import {
  BANNED_PHRASES,
  CONTESTED_PASSAGES,
  GROWTH_BANNED_PHRASES,
  LAMPLIGHT_SYSTEM_FRAGMENT,
  composeSystem,
} from '../_shared/voice.ts';
import { CONNECTION_WHY_PROMPT } from './prompts/connection-why.ts';

export interface ConnectionWhyContext {
  userId: string;
  source: { id: string; title: string; plaintext: string };
  related: { id: string; title: string; plaintext: string };
  similarity: number;
  voicePreference: string;
  compositeHash: string;
  sharedTags: string[];
  sharedVerseRefs: string[];
}

export type ConnectionWhyPipelineResult =
  | {
      ok: true;
      why: string;
      cached: boolean;
      model_used?: string;
      prompt_version: string;
      attempts: number;
    }
  | {
      ok: false;
      reason: 'validators_failed';
      violations: {
        shape: ConnectionShapeViolation[];
        content: ContentRuleViolation[];
      };
      model_used?: string;
      prompt_version: string;
      attempts: number;
    };

function formatConnectionStricterSuffix(violations: {
  shape: ConnectionShapeViolation[];
  content: ContentRuleViolation[];
}): string {
  const parts: string[] = ['On retry: stay within 24 words; describe, do not advise.'];
  if (violations.shape.some((v) => v.rule === 'word_count_exceeded')) {
    parts.push('Your previous answer was too long — strict word budget is 24.');
  }
  if (violations.content.length > 0) {
    const rules = violations.content.map((v) => v.family).join(', ');
    parts.push(`Your previous answer violated: ${rules}. Stay descriptive; no prophetic, contested, or growth-effort phrasing.`);
  }
  return parts.join(' ');
}

export async function runConnectionWhyPipeline(args: {
  llm: LLMAdapter;
  supabase: SupabaseClient;
  ctx: ConnectionWhyContext;
}): Promise<ConnectionWhyPipelineResult> {
  const { ctx, supabase, llm } = args;
  const promptVersion = CONNECTION_WHY_PROMPT.promptVersion;

  // 1. Cache lookup.
  const { data: cached, error: cErr } = await supabase
    .from('lamplight_connections')
    .select('why, content_hash')
    .eq('note_id', ctx.source.id)
    .eq('related_note_id', ctx.related.id)
    .maybeSingle();
  if (cErr) throw cErr;
  if (cached && cached.content_hash === ctx.compositeHash) {
    return {
      ok: true,
      why: cached.why as string,
      cached: true,
      prompt_version: promptVersion,
      attempts: 0,
    };
  }

  // 2. Generate → validate → maybe-retry-once.
  let attempts = 0;
  let lastViolations:
    | { shape: ConnectionShapeViolation[]; content: ContentRuleViolation[] }
    | null = null;
  let lastModelUsed = 'claude-haiku-4-5-20251001';

  for (let attempt = 0; attempt < 2; attempt++) {
    attempts++;
    const stricter =
      attempt === 0 ? '' : formatConnectionStricterSuffix(lastViolations!);
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
      const upsertRes = await supabase
        .from('lamplight_connections')
        .upsert(
          {
            note_id: ctx.source.id,
            related_note_id: ctx.related.id,
            why: parsed.why,
            score: ctx.similarity,
            content_hash: ctx.compositeHash,
          },
          { onConflict: 'note_id,related_note_id' },
        );
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
    lastViolations = { shape: shape.violations, content: content.violations };
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

- [ ] **Step 5: Run tests to verify they pass**

Run: `deno test supabase/functions/lamplight-generate/connection-why-pipeline.test.ts --allow-env --allow-net`

Expected: all 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/lamplight-generate/connection-why-pipeline.ts supabase/functions/lamplight-generate/connection-why-pipeline.test.ts
git commit -m "feat(lamplight): connection-why pipeline

generate-validate-maybe-retry-once + cache-hit short-circuit. Persists
to lamplight_connections on success with the composite content_hash.
Inherits BANNED/CONTESTED/GROWTH from voice.ts. No persistence on hard
fail."
```

---

## Task 10: Edge Function dispatch — `index.ts` + `buildConnectionWhyContext`

**Files:**
- Modify: `supabase/functions/lamplight-generate/index.ts`

- [ ] **Step 1: Read the current dispatch shape**

Open `supabase/functions/lamplight-generate/index.ts`. Locate the `if (body.kind === 'smoke_test')` and `if (body.kind === 'daily_devotion')` branches. The new branch goes after these, before the `return jsonResp({ error: 'unknown kind' }, 400);` fall-through.

- [ ] **Step 2: Add the new dispatch + context builder**

Add this import near the top of `index.ts`:

```ts
import {
  runConnectionWhyPipeline,
  type ConnectionWhyContext,
} from './connection-why-pipeline.ts';
import {
  extractVerseRefsFromNoteContent,
  intersectTagsAndVerseRefs,
} from '../_shared/note-signals.ts';
import { extractTextFromNoteContent } from '../_shared/tiptap-text.ts';
```

Add a small SHA-256 helper near the top of the file (or in a private inline location). If `crypto.subtle` is available in Deno — and it is — use it:

```ts
async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

(If a hash helper already exists in `_shared/`, use that instead.)

Add the context builder above `serve(...)` (or wherever sibling builders live):

```ts
type BuildConnectionWhyContextResult =
  | { kind: 'no_embedding' }
  | { kind: 'not_neighbor' }
  | { kind: 'ok'; context: ConnectionWhyContext };

async function buildConnectionWhyContext(
  supabase: ReturnType<typeof serviceClient>,
  args: {
    userId: string;
    sourceNoteId: string;
    relatedNoteId: string;
    voicePreference: string;
  },
): Promise<BuildConnectionWhyContextResult> {
  // 1. Load both notes.
  const { data: noteRows, error: nErr } = await supabase
    .from('notes')
    .select('id, title, content, tags')
    .eq('user_id', args.userId)
    .in('id', [args.sourceNoteId, args.relatedNoteId]);
  if (nErr) throw nErr;
  if (!noteRows || noteRows.length < 2) {
    return { kind: 'not_neighbor' };
  }
  const sourceRow = noteRows.find((r) => r.id === args.sourceNoteId)!;
  const relatedRow = noteRows.find((r) => r.id === args.relatedNoteId)!;

  const sourcePlaintext = extractTextFromNoteContent(sourceRow.content as string);
  const relatedPlaintext = extractTextFromNoteContent(relatedRow.content as string);
  if (!sourcePlaintext.trim() || !relatedPlaintext.trim()) {
    return { kind: 'not_neighbor' };
  }

  // 2. Load source embedding.
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

  // 3. Re-verify neighbor relationship.
  const { data: neighbors, error: mErr } = await supabase.rpc(
    'match_user_note_embeddings',
    {
      p_user_id: args.userId,
      p_query_vector: sourceEmbedding,
      p_exclude_source_id: args.sourceNoteId,
      p_limit: 50,
    },
  );
  if (mErr) throw mErr;

  const currentNeighbor = ((neighbors ?? []) as Array<{
    source_id: string;
    similarity: number;
  }>)
    .filter((n) => n.similarity >= 0.78)
    .slice(0, 5)
    .find((n) => n.source_id === args.relatedNoteId);

  if (!currentNeighbor) {
    return { kind: 'not_neighbor' };
  }

  // 4. Composite hash.
  const sourceHash = await sha256Hex(sourcePlaintext);
  const relatedHash = await sha256Hex(relatedPlaintext);
  const compositeHash = await sha256Hex(`${sourceHash}:${relatedHash}`);

  // 5. Shared signals.
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

Add the dispatch branch inside `serve(...)`, after the existing `daily_devotion` branch and before the fall-through:

```ts
if (body.kind === 'connection_card_why') {
  if (
    typeof body.source_note_id !== 'string' ||
    typeof body.related_note_id !== 'string' ||
    body.source_note_id === body.related_note_id
  ) {
    return jsonResp({ error: 'bad payload' }, 400);
  }

  const ctxResult = await buildConnectionWhyContext(supabase, {
    userId: body.user_id,
    sourceNoteId: body.source_note_id,
    relatedNoteId: body.related_note_id,
    voicePreference: (settings.voice_preference as string) ?? 'Lord',
  });

  if (ctxResult.kind === 'no_embedding') {
    return jsonResp({ ok: false, reason: 'no_embedding', attempts: 0 });
  }
  if (ctxResult.kind === 'not_neighbor') {
    return jsonResp({ ok: false, reason: 'not_neighbor', attempts: 0 });
  }

  const result = await runConnectionWhyPipeline({
    llm,
    supabase,
    ctx: ctxResult.context,
  });
  return jsonResp(result);
}
```

(`llm`, `supabase`, `settings` should already be in scope from the existing branches. If not — same pattern as the `daily_devotion` branch above; lift the construction up.)

- [ ] **Step 3: Type-check the Edge Function**

Run: `deno check supabase/functions/lamplight-generate/index.ts`

Expected: clean. If unresolved imports, double-check the relative paths.

- [ ] **Step 4: Smoke-test via supabase CLI (manual)**

This step exercises the full path against your local Supabase. Skip if local Supabase isn't running; the unit tests cover the logic.

```bash
supabase functions serve lamplight-generate
# In another shell:
curl -s -X POST http://localhost:54321/functions/v1/lamplight-generate \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "connection_card_why",
    "user_id": "<your test user uuid>",
    "source_note_id": "<note A uuid>",
    "related_note_id": "<note B uuid>"
  }' | jq
```

Expected: 200 with either `{ ok: true, why, cached: false/true }` or `{ ok: false, reason: 'no_embedding' | 'not_neighbor' }` depending on the seed state.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/lamplight-generate/index.ts
git commit -m "feat(lamplight): edge function dispatch on connection_card_why

New buildConnectionWhyContext loads both notes, verifies neighbor
status server-side via match_user_note_embeddings, computes composite
content_hash and shared signals, then hands off to
runConnectionWhyPipeline. Sibling kinds (smoke_test, daily_devotion)
unchanged."
```

---

## Task 11: RLS regression test extensions

**Files:**
- Modify: `src/notepad/storage/lamplight-rls.test.ts`

- [ ] **Step 1: Read the existing RLS test for the pattern**

Open `src/notepad/storage/lamplight-rls.test.ts`. Identify how it sets up two authenticated clients (user A + user B) and asserts cross-user isolation.

- [ ] **Step 2: Add new test cases**

Append:

```ts
describe('Connection Cards RLS', () => {
  it('match_my_note_neighbors rejects calls on another user\'s note', async () => {
    // Setup: user A creates a note. User B's session calls the RPC with A's note id.
    const userA = await createTestUser();
    const userB = await createTestUser();
    const noteA = await createNoteFor(userA, 'A\'s note');

    const clientB = supabaseClientFor(userB);
    const { error } = await clientB.rpc('match_my_note_neighbors', {
      p_source_note_id: noteA.id,
      p_k: 5,
    });
    expect(error).toBeTruthy();
    expect(error!.message.toLowerCase()).toContain('not authorized');
  });

  it('match_my_note_neighbors works for own note', async () => {
    const userA = await createTestUser();
    const noteA = await createNoteFor(userA, 'A\'s note');
    // Seed an embedding for the note via service-role:
    await seedNoteEmbedding(noteA.id, userA.id);

    const clientA = supabaseClientFor(userA);
    const { data, error } = await clientA.rpc('match_my_note_neighbors', {
      p_source_note_id: noteA.id,
      p_k: 5,
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('user A cannot read user B\'s lamplight_connections rows', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const noteB1 = await createNoteFor(userB, 'B1');
    const noteB2 = await createNoteFor(userB, 'B2');
    // Service-role seeds a connection row for B:
    await seedConnectionRow(noteB1.id, noteB2.id, 'a private why', 0.9);

    const clientA = supabaseClientFor(userA);
    const { data } = await clientA
      .from('lamplight_connections')
      .select('*')
      .eq('note_id', noteB1.id);
    expect(data ?? []).toEqual([]);
  });
});
```

Adapt the helper names (`createTestUser`, `createNoteFor`, `seedNoteEmbedding`, `seedConnectionRow`, `supabaseClientFor`) to the actual helpers in the file. If `seedConnectionRow` doesn't exist, add it as a private helper inside this describe block — it's a thin service-role INSERT into `lamplight_connections`.

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/notepad/storage/lamplight-rls.test.ts`

Expected: all RLS tests (existing + new 3) pass.

If your RLS suite requires a live Supabase test project (not the local CLI), follow the same env-var pattern the existing tests use.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/storage/lamplight-rls.test.ts
git commit -m "test(lamplight): RLS isolation — Connection Cards

User A cannot call match_my_note_neighbors against user B's notes
(raises 'not authorized'). User A cannot read user B's
lamplight_connections rows. Service-role can seed rows for both."
```

---

## Task 12: `useConnectionCards` hook

**Files:**
- Create: `src/notepad/hooks/useConnectionCards.ts`
- Create: `src/notepad/hooks/useConnectionCards.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/notepad/hooks/useConnectionCards.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConnectionCards } from './useConnectionCards';
import { FakeLamplightAdapter } from '../storage/fake-lamplight-adapter';
import type { Note } from '../types';

function fakeNote(over: Partial<Note>): Note {
  return {
    id: 'note-1',
    title: 'Untitled',
    content: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'word '.repeat(150).trim() }],
        },
      ],
    }),
    tags: [],
    folderId: null,
    type: 'general',
    createdAt: '2026-05-27T00:00:00.000Z',
    updatedAt: '2026-05-27T00:00:00.000Z',
    ...over,
  };
}

describe('useConnectionCards', () => {
  it('returns inactive when activeNote is null', async () => {
    const adapter = new FakeLamplightAdapter();
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: null,
        totalNoteCount: 50,
        loadNeighborNotes: async () => [],
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('inactive'));
  });

  it('returns inactive when active note has <100 words', async () => {
    const adapter = new FakeLamplightAdapter();
    const shortNote = fakeNote({
      content: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'short' }] }],
      }),
    });
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: shortNote,
        totalNoteCount: 50,
        loadNeighborNotes: async () => [],
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('inactive'));
  });

  it('returns inactive when total note count <10', async () => {
    const adapter = new FakeLamplightAdapter();
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: fakeNote({}),
        totalNoteCount: 5,
        loadNeighborNotes: async () => [],
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('inactive'));
  });

  it('returns waiting_for_embedding when qualifying but no embedding yet', async () => {
    const adapter = new FakeLamplightAdapter();
    // adapter.__seedNoteEmbedding NOT called → hasNoteEmbedding returns false.
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: fakeNote({ id: 'note-1' }),
        totalNoteCount: 50,
        loadNeighborNotes: async () => [],
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('waiting_for_embedding'));
  });

  it('returns no_connections when neighbors list is empty', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    // No neighbors seeded.
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: fakeNote({ id: 'note-1' }),
        totalNoteCount: 50,
        loadNeighborNotes: async () => [],
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('no_connections'));
  });

  it('returns ready with up to 3 cards when neighbors exist', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
      { relatedNoteId: 'note-3', similarity: 0.88 },
      { relatedNoteId: 'note-4', similarity: 0.82 },
      { relatedNoteId: 'note-5', similarity: 0.80 },
      { relatedNoteId: 'note-6', similarity: 0.79 },
    ]);
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: fakeNote({ id: 'note-1' }),
        totalNoteCount: 50,
        loadNeighborNotes,
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    if (result.current.state.phase !== 'ready') throw new Error('phase');
    expect(result.current.state.cards.length).toBe(3); // capped
    expect(result.current.state.cards[0].relatedNoteId).toBe('note-2');
    expect(result.current.state.cards[0].why.phase).toBe('collapsed');
  });

  it('expandCard sets card why to loading then shown on success', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
    ]);
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: fakeNote({ id: 'note-1' }),
        totalNoteCount: 50,
        loadNeighborNotes,
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));

    await act(async () => {
      await result.current.expandCard('note-2');
    });

    if (result.current.state.phase !== 'ready') throw new Error('phase');
    expect(result.current.state.cards[0].why.phase).toBe('shown');
    if (result.current.state.cards[0].why.phase === 'shown') {
      expect(typeof result.current.state.cards[0].why.text).toBe('string');
    }
  });

  it('expandCard surfaces validators_failed reason', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
    ]);
    adapter.__failNextGenerateConnectionWhy('validators_failed');
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: fakeNote({ id: 'note-1' }),
        totalNoteCount: 50,
        loadNeighborNotes,
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));

    await act(async () => {
      await result.current.expandCard('note-2');
    });

    if (result.current.state.phase !== 'ready') throw new Error('phase');
    const card = result.current.state.cards[0];
    expect(card.why.phase).toBe('error');
    if (card.why.phase === 'error') expect(card.why.reason).toBe('validators_failed');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/notepad/hooks/useConnectionCards.test.tsx`

Expected: all fail (module not found).

- [ ] **Step 3: Implement the hook**

Create `src/notepad/hooks/useConnectionCards.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ConnectionNeighbor,
  ConnectionWhyResult,
  LamplightAdapter,
} from '../storage/lamplight-adapter';
import type { Note } from '../types';
import { extractTextFromNote } from '../utils/tiptap-text';
import { computeSharedSignals } from '../utils/connection-signals';

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
  qualifyingMinWords?: number;
  qualifyingMinVaultSize?: number;
  maxRenderedCards?: number;
}

export interface UseConnectionCardsResult {
  state: ConnectionCardsState;
  expandCard: (relatedNoteId: string) => Promise<void>;
  retryWhy: (relatedNoteId: string) => Promise<void>;
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function useConnectionCards(
  args: UseConnectionCardsArgs,
): UseConnectionCardsResult {
  const {
    adapter,
    activeNote,
    totalNoteCount,
    loadNeighborNotes,
    qualifyingMinWords = 100,
    qualifyingMinVaultSize = 10,
    maxRenderedCards = 3,
  } = args;

  const [state, setState] = useState<ConnectionCardsState>({ phase: 'inactive' });
  const cancelledRef = useRef(false);
  const generationRef = useRef(0);
  // Retained neighbor list (up to k=5) for potential future "see more" UX.
  const retainedNeighborsRef = useRef<ConnectionNeighbor[]>([]);
  // Loaded neighbor notes keyed by id for client-side signal recomputation.
  const neighborNotesRef = useRef<Map<string, Note>>(new Map());

  useEffect(() => {
    cancelledRef.current = false;
    const gen = ++generationRef.current;

    async function run() {
      if (!activeNote) {
        setState({ phase: 'inactive' });
        return;
      }
      const plaintext = extractTextFromNote(activeNote);
      if (countWords(plaintext) < qualifyingMinWords) {
        setState({ phase: 'inactive' });
        return;
      }
      if (totalNoteCount < qualifyingMinVaultSize) {
        setState({ phase: 'inactive' });
        return;
      }

      const hasEmbedding = await adapter.hasNoteEmbedding(activeNote.id);
      if (cancelledRef.current || gen !== generationRef.current) return;
      if (!hasEmbedding) {
        setState({ phase: 'waiting_for_embedding' });
        return;
      }

      let neighbors: ConnectionNeighbor[];
      try {
        neighbors = await adapter.getConnectionNeighbors(activeNote.id, 5);
      } catch {
        if (cancelledRef.current || gen !== generationRef.current) return;
        setState({ phase: 'error', reason: 'network' });
        return;
      }
      if (cancelledRef.current || gen !== generationRef.current) return;
      if (neighbors.length === 0) {
        setState({ phase: 'no_connections' });
        return;
      }
      retainedNeighborsRef.current = neighbors;

      let neighborNotes: Note[];
      try {
        neighborNotes = await loadNeighborNotes(neighbors.map((n) => n.relatedNoteId));
      } catch {
        if (cancelledRef.current || gen !== generationRef.current) return;
        setState({ phase: 'error', reason: 'network' });
        return;
      }
      if (cancelledRef.current || gen !== generationRef.current) return;
      neighborNotesRef.current = new Map(neighborNotes.map((n) => [n.id, n]));

      const cards: ConnectionCard[] = neighbors
        .slice(0, maxRenderedCards)
        .map((n) => {
          const neighborNote = neighborNotesRef.current.get(n.relatedNoteId);
          const signals = neighborNote
            ? computeSharedSignals(activeNote, neighborNote)
            : { sharedTags: [], sharedVerseRefs: [] };
          return {
            relatedNoteId: n.relatedNoteId,
            relatedNoteTitle: neighborNote?.title?.trim() || '(untitled)',
            similarity: n.similarity,
            sharedTags: signals.sharedTags.slice(0, 3),
            sharedVerseRefs: signals.sharedVerseRefs.slice(0, 3),
            why: { phase: 'collapsed' },
          };
        });

      setState({ phase: 'ready', cards });
    }

    run();
    return () => {
      cancelledRef.current = true;
    };
  }, [
    adapter,
    activeNote,
    totalNoteCount,
    loadNeighborNotes,
    qualifyingMinWords,
    qualifyingMinVaultSize,
    maxRenderedCards,
  ]);

  const updateCardWhy = useCallback(
    (relatedNoteId: string, next: ConnectionCardWhyState) => {
      setState((prev) => {
        if (prev.phase !== 'ready') return prev;
        return {
          phase: 'ready',
          cards: prev.cards.map((c) =>
            c.relatedNoteId === relatedNoteId ? { ...c, why: next } : c,
          ),
        };
      });
    },
    [],
  );

  const expandCard = useCallback(
    async (relatedNoteId: string) => {
      if (!activeNote) return;
      updateCardWhy(relatedNoteId, { phase: 'loading' });
      let result: ConnectionWhyResult;
      try {
        result = await adapter.generateConnectionWhy(activeNote.id, relatedNoteId);
      } catch {
        updateCardWhy(relatedNoteId, { phase: 'error', reason: 'network' });
        return;
      }
      if (result.ok) {
        updateCardWhy(relatedNoteId, {
          phase: 'shown',
          text: result.why,
          cached: result.cached,
        });
      } else {
        const reason =
          result.reason === 'validators_failed' ? 'validators_failed' : 'network';
        updateCardWhy(relatedNoteId, { phase: 'error', reason });
      }
    },
    [activeNote, adapter, updateCardWhy],
  );

  const retryWhy = useCallback(
    (relatedNoteId: string) => expandCard(relatedNoteId),
    [expandCard],
  );

  return { state, expandCard, retryWhy };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/notepad/hooks/useConnectionCards.test.tsx`

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/hooks/useConnectionCards.ts src/notepad/hooks/useConnectionCards.test.tsx
git commit -m "feat(lamplight): useConnectionCards hook

Fetch-or-empty orchestration with five terminal phases (inactive,
waiting_for_embedding, no_connections, ready, error). Per-card why
sub-state machine with collapsed/loading/shown/error. Capped at
maxRenderedCards=3 with k=5 retained for future see-more UX. Concurrency
safe via cancelledRef + generation counter."
```

---

## Task 13: `ConnectionCardsLoading.tsx`

**Files:**
- Create: `src/notepad/components/lamplight/ConnectionCardsLoading.tsx`
- Create: `src/notepad/components/lamplight/ConnectionCardsLoading.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/notepad/components/lamplight/ConnectionCardsLoading.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionCardsLoading } from './ConnectionCardsLoading';

describe('ConnectionCardsLoading', () => {
  it('renders the reading-this-note copy with status role', () => {
    render(<ConnectionCardsLoading />);
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/Lamplight is reading this note/i);
  });

  it('has motion-reduce class on the pulsing glyph', () => {
    const { container } = render(<ConnectionCardsLoading />);
    const glyph = container.querySelector('[aria-hidden]');
    expect(glyph?.className).toMatch(/motion-reduce:animate-none/);
  });
});
```

- [ ] **Step 2: Run — verify failure**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsLoading.test.tsx`

Expected: 2 failures, module missing.

- [ ] **Step 3: Implement**

Create `src/notepad/components/lamplight/ConnectionCardsLoading.tsx`:

```tsx
export function ConnectionCardsLoading() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[280px] px-6 text-center"
      style={{ background: 'var(--alabaster)' }}
    >
      <div
        className="text-2xl mb-3 animate-pulse motion-reduce:animate-none"
        aria-hidden
      >
        🕯
      </div>
      <p
        className="text-xs"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        role="status"
        aria-live="polite"
      >
        Lamplight is reading this note…
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsLoading.test.tsx`

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/ConnectionCardsLoading.tsx src/notepad/components/lamplight/ConnectionCardsLoading.test.tsx
git commit -m "feat(lamplight): ConnectionCardsLoading placeholder

Smaller min-h than TodaysLampLoading because connections are a
contextual sub-surface. motion-reduce safe."
```

---

## Task 14: `ConnectionCard.tsx`

**Files:**
- Create: `src/notepad/components/lamplight/ConnectionCard.tsx`
- Create: `src/notepad/components/lamplight/ConnectionCard.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/notepad/components/lamplight/ConnectionCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConnectionCard } from './ConnectionCard';
import type { ConnectionCard as ConnectionCardData } from '../../hooks/useConnectionCards';

function baseCard(over: Partial<ConnectionCardData> = {}): ConnectionCardData {
  return {
    relatedNoteId: 'note-2',
    relatedNoteTitle: 'On wilderness',
    similarity: 0.91,
    sharedTags: ['wilderness'],
    sharedVerseRefs: ['Psalm 23:4'],
    why: { phase: 'collapsed' },
    ...over,
  };
}

describe('ConnectionCard', () => {
  it('renders the title and signal pills when collapsed', () => {
    render(
      <ConnectionCard card={baseCard()} onExpand={() => {}} onRetry={() => {}} onOpenNote={() => {}} />,
    );
    expect(screen.getByText('On wilderness')).toBeInTheDocument();
    expect(screen.getByText(/wilderness/i)).toBeInTheDocument();
    expect(screen.getByText('Psalm 23:4')).toBeInTheDocument();
  });

  it('chevron click invokes onExpand', () => {
    const onExpand = vi.fn();
    render(
      <ConnectionCard card={baseCard()} onExpand={onExpand} onRetry={() => {}} onOpenNote={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand/i }));
    expect(onExpand).toHaveBeenCalledWith('note-2');
  });

  it('title click invokes onOpenNote and does NOT invoke onExpand', () => {
    const onExpand = vi.fn();
    const onOpenNote = vi.fn();
    render(
      <ConnectionCard card={baseCard()} onExpand={onExpand} onRetry={() => {}} onOpenNote={onOpenNote} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /open note: on wilderness/i }));
    expect(onOpenNote).toHaveBeenCalledWith('note-2');
    expect(onExpand).not.toHaveBeenCalled();
  });

  it('renders loading inside expanded area', () => {
    render(
      <ConnectionCard
        card={baseCard({ why: { phase: 'loading' } })}
        onExpand={() => {}}
        onRetry={() => {}}
        onOpenNote={() => {}}
      />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the why string when shown', () => {
    render(
      <ConnectionCard
        card={baseCard({ why: { phase: 'shown', text: 'They both return to wilderness.', cached: false } })}
        onExpand={() => {}}
        onRetry={() => {}}
        onOpenNote={() => {}}
      />,
    );
    expect(screen.getByText('They both return to wilderness.')).toBeInTheDocument();
  });

  it('renders retry on error and calls onRetry', () => {
    const onRetry = vi.fn();
    render(
      <ConnectionCard
        card={baseCard({ why: { phase: 'error', reason: 'validators_failed' } })}
        onExpand={() => {}}
        onRetry={onRetry}
        onOpenNote={() => {}}
      />,
    );
    fireEvent.click(screen.getByText(/Try again/i));
    expect(onRetry).toHaveBeenCalledWith('note-2');
  });

  it('aria-expanded reflects state', () => {
    const { rerender } = render(
      <ConnectionCard card={baseCard()} onExpand={() => {}} onRetry={() => {}} onOpenNote={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /expand/i }).getAttribute('aria-expanded')).toBe('false');
    rerender(
      <ConnectionCard
        card={baseCard({ why: { phase: 'shown', text: 'x', cached: true } })}
        onExpand={() => {}}
        onRetry={() => {}}
        onOpenNote={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /collapse/i }).getAttribute('aria-expanded')).toBe('true');
  });
});
```

- [ ] **Step 2: Run — verify failure**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCard.test.tsx`

Expected: all 7 fail.

- [ ] **Step 3: Implement**

Create `src/notepad/components/lamplight/ConnectionCard.tsx`:

```tsx
import type { ConnectionCard as ConnectionCardData } from '../../hooks/useConnectionCards';

export interface ConnectionCardProps {
  card: ConnectionCardData;
  onExpand: (relatedNoteId: string) => void;
  onRetry: (relatedNoteId: string) => void;
  onOpenNote: (relatedNoteId: string) => void;
}

export function ConnectionCard({ card, onExpand, onRetry, onOpenNote }: ConnectionCardProps) {
  const isExpanded =
    card.why.phase === 'loading' ||
    card.why.phase === 'shown' ||
    card.why.phase === 'error';

  return (
    <div
      className="border rounded mb-2"
      style={{ borderColor: 'var(--pale-stone)', background: 'var(--alabaster)' }}
    >
      <div className="flex items-center px-3 py-2 gap-2">
        <button
          aria-label={isExpanded ? 'Collapse card' : 'Expand card'}
          aria-expanded={isExpanded}
          onClick={() => onExpand(card.relatedNoteId)}
          className="text-sm cursor-pointer"
          style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
        >
          <span aria-hidden>{isExpanded ? '▾' : '▸'}</span>
        </button>
        <button
          aria-label={`Open note: ${card.relatedNoteTitle}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenNote(card.relatedNoteId);
          }}
          className="text-sm hover:underline cursor-pointer flex-1 text-left"
          style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
        >
          {card.relatedNoteTitle}
        </button>
      </div>
      {(card.sharedTags.length > 0 || card.sharedVerseRefs.length > 0) && (
        <div
          className="px-3 pb-2 text-xs flex flex-wrap gap-2"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          {card.sharedTags.map((t) => (
            <span key={`tag-${t}`}>#{t}</span>
          ))}
          {card.sharedVerseRefs.map((r) => (
            <span key={`ref-${r}`}>{r}</span>
          ))}
        </div>
      )}
      {isExpanded && (
        <div
          className="border-t px-3 py-2"
          style={{ borderColor: 'var(--pale-stone)' }}
        >
          {card.why.phase === 'loading' && (
            <p
              role="status"
              aria-live="polite"
              className="text-xs"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              Lighting…
            </p>
          )}
          {card.why.phase === 'shown' && (
            <p
              className="text-sm italic"
              style={{
                color: 'var(--deep-umber)',
                fontFamily: 'Cormorant Garamond, serif',
              }}
              data-cached={card.why.cached}
            >
              {card.why.text}
            </p>
          )}
          {card.why.phase === 'error' && (
            <div
              className="text-xs"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              <p className="mb-1">Couldn't read this connection.</p>
              <button
                onClick={() => onRetry(card.relatedNoteId)}
                className="underline cursor-pointer"
                style={{ color: 'var(--deep-umber)' }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCard.test.tsx`

Expected: all 7 pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/ConnectionCard.tsx src/notepad/components/lamplight/ConnectionCard.test.tsx
git commit -m "feat(lamplight): ConnectionCard component

Two-button card pattern — title navigates via onOpenNote, chevron toggles
expand via onExpand. Expanded area shows loading/shown/error why-state.
aria-expanded + role=status + role=button accessibility built in."
```

---

## Task 15: `ConnectionCardsSection.tsx`

**Files:**
- Create: `src/notepad/components/lamplight/ConnectionCardsSection.tsx`
- Create: `src/notepad/components/lamplight/ConnectionCardsSection.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/notepad/components/lamplight/ConnectionCardsSection.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionCardsSection } from './ConnectionCardsSection';
import type { ConnectionCard as ConnectionCardData } from '../../hooks/useConnectionCards';

function card(id: string): ConnectionCardData {
  return {
    relatedNoteId: id,
    relatedNoteTitle: `Note ${id}`,
    similarity: 0.9,
    sharedTags: [],
    sharedVerseRefs: [],
    why: { phase: 'collapsed' },
  };
}

describe('ConnectionCardsSection', () => {
  it('renders section header', () => {
    render(
      <ConnectionCardsSection cards={[card('a')]} onExpand={() => {}} onRetry={() => {}} onOpenNote={() => {}} />,
    );
    expect(screen.getByText(/Connections/i)).toBeInTheDocument();
  });

  it('renders 1 card', () => {
    render(
      <ConnectionCardsSection cards={[card('a')]} onExpand={() => {}} onRetry={() => {}} onOpenNote={() => {}} />,
    );
    expect(screen.getByText('Note a')).toBeInTheDocument();
  });

  it('renders 3 cards', () => {
    render(
      <ConnectionCardsSection cards={[card('a'), card('b'), card('c')]} onExpand={() => {}} onRetry={() => {}} onOpenNote={() => {}} />,
    );
    expect(screen.getByText('Note a')).toBeInTheDocument();
    expect(screen.getByText('Note b')).toBeInTheDocument();
    expect(screen.getByText('Note c')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify failure**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsSection.test.tsx`

Expected: 3 fail.

- [ ] **Step 3: Implement**

Create `src/notepad/components/lamplight/ConnectionCardsSection.tsx`:

```tsx
import { ConnectionCard } from './ConnectionCard';
import type { ConnectionCard as ConnectionCardData } from '../../hooks/useConnectionCards';

export interface ConnectionCardsSectionProps {
  cards: ConnectionCardData[];
  onExpand: (relatedNoteId: string) => void;
  onRetry: (relatedNoteId: string) => void;
  onOpenNote: (relatedNoteId: string) => void;
}

export function ConnectionCardsSection({
  cards,
  onExpand,
  onRetry,
  onOpenNote,
}: ConnectionCardsSectionProps) {
  return (
    <div
      className="px-4 py-4"
      style={{ background: 'var(--alabaster)' }}
    >
      <h3
        className="text-xs uppercase tracking-wide mb-3"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        Connections
      </h3>
      {cards.map((c) => (
        <ConnectionCard
          key={c.relatedNoteId}
          card={c}
          onExpand={onExpand}
          onRetry={onRetry}
          onOpenNote={onOpenNote}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsSection.test.tsx`

Expected: all 3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/ConnectionCardsSection.tsx src/notepad/components/lamplight/ConnectionCardsSection.test.tsx
git commit -m "feat(lamplight): ConnectionCardsSection component

Section header + a list of ConnectionCard children. Display-layer
container; takes pre-capped cards from useConnectionCards and renders."
```

---

## Task 16: `LamplightTabPanel` rewire

**Files:**
- Modify: `src/notepad/components/lamplight/LamplightTabPanel.tsx`
- Modify: `src/notepad/components/lamplight/LamplightTabPanel.test.tsx`

- [ ] **Step 1: Read the current LamplightTabPanel**

Open `src/notepad/components/lamplight/LamplightTabPanel.tsx`. Confirm the current opted-in-and-entitled branch renders `<TodaysLampCard ... />`.

- [ ] **Step 2: Write failing tests**

Open `src/notepad/components/lamplight/LamplightTabPanel.test.tsx`. Append:

```tsx
describe('LamplightTabPanel — Connection Cards branching', () => {
  it('shows TodaysLampCard when activeNote is null', async () => {
    // ... setup opted-in entitled user via existing helpers ...
    render(
      <LamplightTabPanel
        lamplightAdapter={adapter}
        activeNote={null}
        totalNoteCount={50}
        loadNeighborNotes={async () => []}
        onOpenNote={() => {}}
      />,
    );
    await waitFor(() => expect(screen.queryByText(/Today/i)).toBeInTheDocument());
  });

  it('shows TodaysLampCard when active note is below word threshold', async () => {
    const shortNote = makeNote({ content: makeContent('short') });
    render(
      <LamplightTabPanel
        lamplightAdapter={adapter}
        activeNote={shortNote}
        totalNoteCount={50}
        loadNeighborNotes={async () => []}
        onOpenNote={() => {}}
      />,
    );
    await waitFor(() => expect(screen.queryByText(/Today/i)).toBeInTheDocument());
  });

  it('shows ConnectionCardsLoading when qualifying note has no embedding', async () => {
    const longNote = makeNote({ id: 'note-1', content: makeContent('word '.repeat(150).trim()) });
    // adapter.__seedNoteEmbedding NOT called → hasNoteEmbedding returns false.
    render(
      <LamplightTabPanel
        lamplightAdapter={adapter}
        activeNote={longNote}
        totalNoteCount={50}
        loadNeighborNotes={async () => []}
        onOpenNote={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/reading this note/i));
  });

  it('shows ConnectionCardsSection when neighbors exist', async () => {
    const longNote = makeNote({ id: 'note-1', content: makeContent('word '.repeat(150).trim()) });
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.91 },
    ]);
    render(
      <LamplightTabPanel
        lamplightAdapter={adapter}
        activeNote={longNote}
        totalNoteCount={50}
        loadNeighborNotes={async (ids) => ids.map((id) => makeNote({ id, title: `T${id}` }))}
        onOpenNote={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByText(/Connections/i)).toBeInTheDocument());
    expect(screen.getByText('Tnote-2')).toBeInTheDocument();
  });

  it('falls back to TodaysLampCard when neighbors list empty', async () => {
    const longNote = makeNote({ id: 'note-1', content: makeContent('word '.repeat(150).trim()) });
    adapter.__seedNoteEmbedding('note-1');
    // no neighbors seeded
    render(
      <LamplightTabPanel
        lamplightAdapter={adapter}
        activeNote={longNote}
        totalNoteCount={50}
        loadNeighborNotes={async () => []}
        onOpenNote={() => {}}
      />,
    );
    await waitFor(() => expect(screen.queryByText(/Today/i)).toBeInTheDocument());
  });
});
```

Reuse whatever existing fixtures the file already defines (`makeNote`, `makeContent`, `adapter`). If those helpers don't exist, define them inline at the top of the new describe block following the patterns from `useConnectionCards.test.tsx`.

- [ ] **Step 3: Run — verify failure**

Run: `npx vitest run src/notepad/components/lamplight/LamplightTabPanel.test.tsx`

Expected: 5 new failures.

- [ ] **Step 4: Update `LamplightTabPanel.tsx`**

Modify imports:

```tsx
import { useConnectionCards } from '../../hooks/useConnectionCards';
import { ConnectionCardsSection } from './ConnectionCardsSection';
import { ConnectionCardsLoading } from './ConnectionCardsLoading';
import type { Note } from '../../types';
```

Modify the props interface and the function signature:

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
  // ... keep all existing branches up to the opted-in + entitled terminal block ...
```

Replace the terminal `return <TodaysLampCard ... />` block with:

```tsx
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

- [ ] **Step 5: Run — verify pass**

Run: `npx vitest run src/notepad/components/lamplight/LamplightTabPanel.test.tsx`

Expected: all tests (existing + 5 new) pass.

- [ ] **Step 6: Commit**

```bash
git add src/notepad/components/lamplight/LamplightTabPanel.tsx src/notepad/components/lamplight/LamplightTabPanel.test.tsx
git commit -m "feat(lamplight): LamplightTabPanel branches on Connection Cards

New activeNote / totalNoteCount / loadNeighborNotes / onOpenNote props.
Terminal opted-in+entitled branch now consults useConnectionCards and
selects between ConnectionCardsSection / ConnectionCardsLoading /
TodaysLampCard fallback."
```

---

## Task 17: Notepad page integration

**Files:**
- Modify: `src/components/sections/Notepad.tsx`

- [ ] **Step 1: Read the current Notepad page to find the existing tab-bar consumer**

Open `src/components/sections/Notepad.tsx`. Locate where `<LamplightTabPanel>` is rendered. Identify the surrounding state that holds:
- Active note (whatever drives Backlinks/Info tabs).
- Total note count (or notes array length).
- A note-loading function (likely the existing storage adapter).
- An "open note by id" handler (used by Backlinks click-through).

- [ ] **Step 2: Pass the four new props**

Modify the `<LamplightTabPanel>` invocation to pass:

```tsx
<LamplightTabPanel
  lamplightAdapter={lamplightAdapter}
  activeNote={activeNote ?? null}
  totalNoteCount={notes.length}
  loadNeighborNotes={async (ids) => {
    const results: Note[] = [];
    for (const id of ids) {
      const n = await storageAdapter.getNote(id);
      if (n) results.push(n);
    }
    return results;
  }}
  onOpenNote={(id) => openNote(id)}
/>
```

Adapt names (`activeNote`, `notes`, `storageAdapter`, `openNote`) to whatever the file uses. If the file uses a single notes list already in memory, prefer `notes.filter(n => ids.includes(n.id))` — it avoids the round-trip and is cheaper.

- [ ] **Step 3: Manually smoke the integration**

```bash
npm run dev
```

In the browser:
1. Sign in to a test account.
2. Opt into Lamplight via the consent flow.
3. Open a note with ≥100 words; ensure the user has ≥10 total notes.
4. Verify the Lamplight tab shows `ConnectionCardsLoading` if the embedding queue hasn't drained, else `ConnectionCardsSection` with up to 3 cards.
5. Click a card's chevron — verify "Lighting…" then the why string appears.
6. Click a card's title — verify navigation swaps the active note. The new active note's Connection Cards should re-fetch.
7. Open a short note (<100 words) — verify `TodaysLampCard` shows instead.

If anything breaks, fix and re-test before committing.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/Notepad.tsx
git commit -m "feat(lamplight): wire Notepad page into Connection Cards

Passes activeNote, totalNoteCount, loadNeighborNotes, onOpenNote into
LamplightTabPanel from existing page state. No new state created."
```

---

## Task 18: Full QA sweep

**Files:** none changed in this task (verification only).

- [ ] **Step 1: Run all linters + type-checkers + tests**

```bash
npm run lint
npx tsc -b
npx vitest run
deno test supabase/functions/_shared/*.test.ts supabase/functions/lamplight-generate/**/*.test.ts --allow-env --allow-net
```

Expected: all green.

- [ ] **Step 2: Deploy Edge Function to staging**

```bash
supabase functions deploy lamplight-generate
```

Expected: deploy succeeds. Verify in the Supabase dashboard.

- [ ] **Step 3: Apply migration to staging**

```bash
supabase db push
```

Or run migration 014 against the staging project DB via whatever method the team uses. Verify `match_my_note_neighbors` is callable from the staging SQL editor for an authenticated user.

- [ ] **Step 4: Manual end-to-end against staging**

Repeat the smoke checks from Task 17 Step 3 against the staging deploy. Verify:
- Cache hit on second expand of the same card (network tab shows no Edge Function invocation, or response includes `cached: true`).
- Editing the source note's plaintext invalidates the cache (next expand shows `cached: false`).
- Editing the related note's plaintext also invalidates.
- A user with <10 notes never sees connection cards (always Today's Lamp).

- [ ] **Step 5: Final commit (none needed)**

No code changes in this task — just verification. If QA reveals bugs, fix them on a per-task basis using the existing TDD pattern. Each fix gets its own commit referencing the relevant earlier task.

---

## Done When

- All 18 tasks completed and committed.
- All tests green (vitest + deno test + lint + tsc).
- Migration 014 applied to staging.
- Edge Function deployed to staging.
- Manual end-to-end matches the spec's acceptance criteria §17–22.
- No regression in Foundation, Signal, Reasoning, or Today's Lamp surfaces.
