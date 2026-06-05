# Handwriting Note Transcription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a notepad user scan/upload a handwritten page (camera or file) and get an accurate, editable transcription that flags — never fabricates — Scripture, then becomes a real note through the existing import pipeline.

**Architecture:** A new capture → preprocess → transcribe → review front-half feeds the existing `buildNoteFromText → importNote → linkNotesByVerses` pipeline. A `transcribe-note` Supabase Edge Function calls Claude Sonnet vision (via the existing `_shared/anthropic.ts` adapter, extended for images), verifies detected verse references against `bible_passages`, and returns structured JSON. The client preprocesses images (canvas + lazy OpenCV deskew), uploads to a private `note-scans` bucket, and shows a side-by-side review with uncertain-word highlights and verse flags.

**Tech Stack:** React 19 + Vite + React Router 7, TypeScript, Supabase (Postgres + Storage + Edge Functions/Deno), Anthropic Claude (`claude-sonnet-4-6`), TipTap/ProseMirror, OpenCV.js/jscanify (lazy), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-02-handwriting-transcription-design.md`

**Test commands:** `npm test` runs `vitest run` (covers both `src/**/*.test.ts(x)` and `supabase/functions/**/*.test.ts`). Run a single file with `npx vitest run <path>`.

---

## File Structure

**Create:**
- `supabase/migrations/019_note_transcriptions.sql` — table + RLS + `note-scans` bucket + storage policies.
- `supabase/functions/_shared/verse-verify.ts` — Deno-side verse-ref → `bible_passages` verification (parity with client `BOOK_TO_OSIS`).
- `supabase/functions/_shared/verse-verify.test.ts` — unit + parity tests.
- `supabase/functions/transcribe-note/prompt.ts` — system prompt + forced-tool schema.
- `supabase/functions/transcribe-note/handler.ts` — pure, dependency-injected core (`handleTranscribe`).
- `supabase/functions/transcribe-note/handler.test.ts` — unit tests with fake deps.
- `supabase/functions/transcribe-note/index.ts` — Deno `serve` wrapper (CORS, wiring real deps).
- `src/notepad/scan/image-preprocess.ts` — pure pixel helpers + canvas orchestration.
- `src/notepad/scan/image-preprocess.test.ts` — unit tests for pure helpers.
- `src/notepad/scan/deskew.ts` — lazy OpenCV deskew (smoke-only, no unit test).
- `src/notepad/scan/transcription-client.ts` — upload + invoke + signed-URL + delete.
- `src/notepad/scan/transcription-client.test.ts` — unit tests for pure helpers.
- `src/notepad/scan/uncertain-decoration.ts` — span locator (pure) + ProseMirror plugin.
- `src/notepad/scan/uncertain-decoration.test.ts` — unit tests for the locator.
- `src/notepad/scan/build-note-from-transcription.ts` — maps edited transcript → `Note` via `buildNoteFromText`.
- `src/notepad/scan/build-note-from-transcription.test.ts` — unit tests.
- `src/notepad/scan/types.ts` — shared client types (`TranscriptionResult`, `VerseFlag`, `UncertainWord`).
- `src/notepad/components/ScanCapture.tsx` — camera + file capture UI.
- `src/notepad/components/TranscriptionReview.tsx` — side-by-side review + save/discard.

**Modify:**
- `supabase/functions/_shared/anthropic.ts` — widen message content to support image blocks.
- `supabase/functions/_shared/anthropic.test.ts` — add image-message shaping test.
- `src/notepad/graph/reference-parser.ts` — export `BOOK_TO_OSIS` (for the parity test).
- `src/notepad/components/UploadModal.tsx` — add a "Scan handwritten note" entry point.

---

## Task 1: Migration — `note_transcriptions` table, RLS, and `note-scans` bucket

**Files:**
- Create: `supabase/migrations/019_note_transcriptions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 019_note_transcriptions.sql
-- Handwriting transcription provenance + private scan image bucket.

create table if not exists note_transcriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  note_id uuid references notes(id) on delete set null,   -- set when saved to a note
  image_key text not null,            -- note-scans/{user_id}/{uuid}.jpg
  raw_transcription text not null,    -- model output, never mutated → eval set
  confidence numeric,
  uncertain_words jsonb not null default '[]'::jsonb,
  verse_flags jsonb not null default '[]'::jsonb,
  model text,
  status text not null default 'transcribed',  -- 'transcribed' | 'saved'  (discard deletes the row)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists note_transcriptions_user_idx on note_transcriptions(user_id);
create index if not exists note_transcriptions_note_idx on note_transcriptions(note_id);

alter table note_transcriptions enable row level security;

create policy "Users select own transcriptions"
  on note_transcriptions for select using (auth.uid() = user_id);
create policy "Users insert own transcriptions"
  on note_transcriptions for insert with check (auth.uid() = user_id);
create policy "Users update own transcriptions"
  on note_transcriptions for update using (auth.uid() = user_id);
create policy "Users delete own transcriptions"
  on note_transcriptions for delete using (auth.uid() = user_id);

-- Private bucket for original scanned pages (sensitive personal journal content).
insert into storage.buckets (id, name, public)
values ('note-scans', 'note-scans', false)
on conflict (id) do nothing;

create policy "Users upload own scans"
  on storage.objects for insert
  with check (
    bucket_id = 'note-scans' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users read own scans"
  on storage.objects for select
  using (
    bucket_id = 'note-scans' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users update own scans"
  on storage.objects for update
  using (
    bucket_id = 'note-scans' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users delete own scans"
  on storage.objects for delete
  using (
    bucket_id = 'note-scans' and (storage.foldername(name))[1] = auth.uid()::text
  );
```

- [ ] **Step 2: Apply locally and verify**

Run: `supabase db reset` (or `supabase migration up`)
Expected: completes without error. Verify with:
`supabase db execute "select count(*) from note_transcriptions; select id, public from storage.buckets where id='note-scans';"`
Expected: `0` rows in table; bucket row with `public = false`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/019_note_transcriptions.sql
git commit -m "feat(notepad): note_transcriptions table + private note-scans bucket"
```

---

## Task 2: Server-side verse verification (`_shared/verse-verify.ts`)

Ports the client's `BOOK_TO_OSIS` map and ref parsing to Deno (the established cross-runtime-parity pattern — see `note-signals.ts`), and verifies each detected ref against `bible_passages`.

**Files:**
- Modify: `src/notepad/graph/reference-parser.ts` (export `BOOK_TO_OSIS`)
- Create: `supabase/functions/_shared/verse-verify.ts`
- Test: `supabase/functions/_shared/verse-verify.test.ts`

- [ ] **Step 1: Export `BOOK_TO_OSIS` from the client parser**

In `src/notepad/graph/reference-parser.ts`, change the declaration:
```ts
// was: const BOOK_TO_OSIS: Record<string, string> = {
export const BOOK_TO_OSIS: Record<string, string> = {
```
(Only adds `export`; no behavior change.)

- [ ] **Step 2: Write the failing test**

```ts
// supabase/functions/_shared/verse-verify.test.ts
import { describe, it, expect } from 'vitest';
import { BOOK_TO_OSIS as CLIENT_OSIS } from '../../../src/notepad/graph/reference-parser';
import { OSIS_BOOK_MAP, parseRefToIds, verifyVerseRefs } from './verse-verify.ts';

describe('OSIS parity with client', () => {
  it('matches the client BOOK_TO_OSIS exactly', () => {
    expect(OSIS_BOOK_MAP).toEqual(CLIENT_OSIS);
  });
});

describe('parseRefToIds', () => {
  it('maps a single verse to one bible_passages id', () => {
    expect(parseRefToIds('Psalm 23:1')).toEqual(['psa.23.1']);
  });
  it('expands a range', () => {
    expect(parseRefToIds('John 3:16-17')).toEqual(['jhn.3.16', 'jhn.3.17']);
  });
  it('returns null on unknown book', () => {
    expect(parseRefToIds('Gandalf 1:1')).toBeNull();
  });
  it('returns null on unparseable ref', () => {
    expect(parseRefToIds('Psalm')).toBeNull();
  });
});

describe('verifyVerseRefs', () => {
  const fakeSupabase = (rowsById: Record<string, { id: string; verse_start: number; text: string }[]>) => ({
    from: (_t: string) => ({
      select: () => ({
        in: (_c: string, ids: string[]) => ({
          order: () => Promise.resolve({
            data: ids.flatMap((id) => rowsById[id] ?? []),
            error: null,
          }),
        }),
      }),
    }),
  });

  it('flags found refs with canonical text', async () => {
    const sb = fakeSupabase({ 'psa.23.1': [{ id: 'psa.23.1', verse_start: 1, text: 'The LORD is my shepherd' }] });
    const flags = await verifyVerseRefs(sb as never, ['Psalm 23:1']);
    expect(flags).toEqual([
      { ref: 'Psalm 23:1', status: 'found', canonicalText: 'The LORD is my shepherd' },
    ]);
  });

  it('flags refs with zero rows as not_found', async () => {
    const sb = fakeSupabase({});
    const flags = await verifyVerseRefs(sb as never, ['Psalm 151:1']);
    expect(flags).toEqual([{ ref: 'Psalm 151:1', status: 'not_found' }]);
  });

  it('skips unparseable refs (no flag)', async () => {
    const sb = fakeSupabase({});
    const flags = await verifyVerseRefs(sb as never, ['just a thought']);
    expect(flags).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/verse-verify.test.ts`
Expected: FAIL — cannot find module `./verse-verify.ts`.

- [ ] **Step 4: Implement `verse-verify.ts`**

```ts
// supabase/functions/_shared/verse-verify.ts
//
// Verify detected verse references against bible_passages. Cross-runtime mirror
// of the client's BOOK_TO_OSIS (src/notepad/graph/reference-parser.ts); a parity
// test asserts they stay identical. Verification is enhancement, never a hard
// dependency — callers treat a throw as "skipped".

export interface VerseFlag {
  ref: string;
  status: 'found' | 'not_found';
  canonicalText?: string;
}

// Keep identical to BOOK_TO_OSIS in src/notepad/graph/reference-parser.ts.
export const OSIS_BOOK_MAP: Record<string, string> = {
  'Genesis': 'gen', 'Exodus': 'exo', 'Leviticus': 'lev', 'Numbers': 'num',
  'Deuteronomy': 'deu', 'Joshua': 'jos', 'Judges': 'jdg', 'Ruth': 'rut',
  '1 Samuel': '1sa', '2 Samuel': '2sa', '1 Kings': '1ki', '2 Kings': '2ki',
  '1 Chronicles': '1ch', '2 Chronicles': '2ch', 'Ezra': 'ezr', 'Nehemiah': 'neh',
  'Esther': 'est', 'Job': 'job', 'Psalms': 'psa', 'Proverbs': 'pro',
  'Ecclesiastes': 'ecc', 'Song of Solomon': 'sng', 'Isaiah': 'isa', 'Jeremiah': 'jer',
  'Lamentations': 'lam', 'Ezekiel': 'ezk', 'Daniel': 'dan', 'Hosea': 'hos',
  'Joel': 'jol', 'Amos': 'amo', 'Obadiah': 'oba', 'Jonah': 'jon',
  'Micah': 'mic', 'Nahum': 'nam', 'Habakkuk': 'hab', 'Zephaniah': 'zep',
  'Haggai': 'hag', 'Zechariah': 'zec', 'Malachi': 'mal',
  'Matthew': 'mat', 'Mark': 'mrk', 'Luke': 'luk', 'John': 'jhn',
  'Acts': 'act', 'Romans': 'rom', '1 Corinthians': '1co', '2 Corinthians': '2co',
  'Galatians': 'gal', 'Ephesians': 'eph', 'Philippians': 'php', 'Colossians': 'col',
  '1 Thessalonians': '1th', '2 Thessalonians': '2th', '1 Timothy': '1ti', '2 Timothy': '2ti',
  'Titus': 'tit', 'Philemon': 'phm', 'Hebrews': 'heb', 'James': 'jas',
  '1 Peter': '1pe', '2 Peter': '2pe', '1 John': '1jn', '2 John': '2jn',
  '3 John': '3jn', 'Jude': 'jud', 'Revelation': 'rev',
};

// Accept "Psalm" (singular) as an alias of the canonical "Psalms".
const BOOK_ALIASES: Record<string, string> = { 'Psalm': 'Psalms' };

const REF_RE = /^(.+?)\s+(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/;

function canonicalBook(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  const aliased = BOOK_ALIASES[collapsed] ?? collapsed;
  // Case-insensitive match against the OSIS map keys.
  for (const key of Object.keys(OSIS_BOOK_MAP)) {
    if (key.toLowerCase() === aliased.toLowerCase()) return key;
  }
  return null;
}

/** Parse "Psalm 23:1" → ['psa.23.1']; ranges expand. Null if unparseable/unknown. */
export function parseRefToIds(ref: string): string[] | null {
  const m = ref.trim().match(REF_RE);
  if (!m) return null;
  const book = canonicalBook(m[1]);
  if (!book) return null;
  const osis = OSIS_BOOK_MAP[book];
  const chapter = parseInt(m[2], 10);
  const start = parseInt(m[3], 10);
  const end = m[4] ? parseInt(m[4], 10) : start;
  if (end < start) return null;
  const ids: string[] = [];
  for (let v = start; v <= end; v++) ids.push(`${osis}.${chapter}.${v}`);
  return ids;
}

interface MinimalSupabase {
  from(table: 'bible_passages'): {
    select(cols: string): {
      in(col: string, ids: string[]): {
        order(col: string, opts: { ascending: boolean }): Promise<{
          data: { id: string; verse_start: number; text: string }[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

/**
 * For each ref: 'found' (with joined canonical text) when bible_passages has the
 * rows, else 'not_found'. Unparseable/unknown-book refs are silently skipped
 * (no flag). Lookups run per-ref so one bad ref can't poison the others.
 */
export async function verifyVerseRefs(
  supabase: MinimalSupabase,
  refs: string[],
): Promise<VerseFlag[]> {
  const flags: VerseFlag[] = [];
  for (const ref of refs) {
    const ids = parseRefToIds(ref);
    if (!ids) continue; // not a real ref → skip silently
    const { data, error } = await supabase
      .from('bible_passages')
      .select('id, verse_start, text')
      .in('id', ids)
      .order('verse_start', { ascending: true });
    if (error || !data || data.length === 0) {
      flags.push({ ref, status: 'not_found' });
      continue;
    }
    const canonicalText = data.map((r) => r.text ?? '').join(' ').trim();
    flags.push({ ref, status: 'found', canonicalText });
  }
  return flags;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/verse-verify.test.ts`
Expected: PASS (all cases, incl. parity).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/verse-verify.ts supabase/functions/_shared/verse-verify.test.ts src/notepad/graph/reference-parser.ts
git commit -m "feat(notepad): server-side verse verification against bible_passages"
```

---

## Task 3: Extend the Anthropic adapter for image (multimodal) messages

**Files:**
- Modify: `supabase/functions/_shared/anthropic.ts`
- Test: `supabase/functions/_shared/anthropic.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `supabase/functions/_shared/anthropic.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createAnthropicAdapter } from './anthropic.ts';

describe('anthropic multimodal', () => {
  it('serializes image content blocks into the request body', async () => {
    let sentBody: any;
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      sentBody = JSON.parse(init.body as string);
      return new Response(JSON.stringify({
        content: [{ type: 'tool_use', name: 'record_transcription', input: { ok: true } }],
        model: 'claude-sonnet-4-6',
        usage: { input_tokens: 10, output_tokens: 5 },
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const adapter = createAnthropicAdapter({ apiKey: 'k', fetch: fakeFetch });
    const out = await adapter.generate<{ ok: boolean }>({
      model: 'sonnet',
      system: 'sys',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'read this' },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
        ],
      }],
      tool: { name: 'record_transcription', description: 'd', input_schema: { type: 'object' } },
    });

    expect(out.parsed).toEqual({ ok: true });
    expect(sentBody.messages[0].content).toEqual([
      { type: 'text', text: 'read this' },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/anthropic.test.ts`
Expected: FAIL — TypeScript rejects array `content`, or the assertion fails.

- [ ] **Step 3: Widen the content type**

In `supabase/functions/_shared/anthropic.ts`, add block types and update `GenerateInput`:
```ts
export type TextBlock = { type: 'text'; text: string };
export type ImageBlock = {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
};
export type ContentBlock = TextBlock | ImageBlock;

export interface GenerateInput {
  model: LLMModel;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string | ContentBlock[] }>;
  tool: ToolSchema;
  maxTokens?: number;
}
```
The body builder already does `messages: input.messages` verbatim, and the Anthropic API accepts both a string and a content-block array — so no change to the `fetch` body is required beyond the type widening.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/anthropic.test.ts`
Expected: PASS (new + all existing tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/anthropic.ts supabase/functions/_shared/anthropic.test.ts
git commit -m "feat(notepad): support image content blocks in anthropic adapter"
```

---

## Task 4: `transcribe-note` Edge Function (prompt, handler core, wrapper)

The pure core (`handleTranscribe`) takes injected deps so it's unit-testable without Deno/`serve`; `index.ts` wires the real adapter, storage, and supabase client.

**Files:**
- Create: `supabase/functions/transcribe-note/prompt.ts`
- Create: `supabase/functions/transcribe-note/handler.ts`
- Test: `supabase/functions/transcribe-note/handler.test.ts`
- Create: `supabase/functions/transcribe-note/index.ts`

- [ ] **Step 1: Write the prompt + tool schema**

```ts
// supabase/functions/transcribe-note/prompt.ts
import type { ToolSchema } from '../_shared/anthropic.ts';

export const TRANSCRIBE_SYSTEM = `You are transcribing a handwritten note from a Psalms / Bible-study devotional journal. The writer may reference verses ("Psalm 23:1"), psalm titles, prayers, and scriptural language — use this context to resolve messy handwriting.

Transcribe EXACTLY what is written, preserving line breaks and the writer's own spelling. Do NOT paraphrase, correct, complete, or add commentary. If a word is illegible, give your single best guess and add it to uncertainWords. Never invent text, and never insert Scripture the writer did not write.`;

export const TRANSCRIBE_TOOL: ToolSchema = {
  name: 'record_transcription',
  description: 'Record the exact transcription of the handwritten note.',
  input_schema: {
    type: 'object',
    properties: {
      transcription: { type: 'string', description: 'Exact transcription, line breaks preserved.' },
      confidence: { type: 'number', description: '0–1 overall legibility confidence.' },
      uncertainWords: {
        type: 'array',
        description: 'Words that were hard to read and may be wrong.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'The uncertain word as transcribed.' },
            context: { type: 'string', description: '~3 surrounding words to locate it.' },
          },
          required: ['text'],
        },
      },
    },
    required: ['transcription', 'confidence', 'uncertainWords'],
  },
};
```

- [ ] **Step 2: Write the failing handler test**

```ts
// supabase/functions/transcribe-note/handler.test.ts
import { describe, it, expect } from 'vitest';
import { handleTranscribe } from './handler.ts';

const goodLLM = {
  generate: async () => ({
    parsed: {
      transcription: 'Trusting in Psalm 23:1 today',
      confidence: 0.82,
      uncertainWords: [{ text: 'Trusting', context: 'Trusting in Psalm' }],
    },
    modelUsed: 'claude-sonnet-4-6',
    promptTokens: 100,
    completionTokens: 20,
  }),
};

function deps(over: Partial<Parameters<typeof handleTranscribe>[0]> = {}) {
  const inserted: any[] = [];
  return {
    inserted,
    d: {
      llm: goodLLM,
      downloadImage: async () => ({ base64: 'AAAA', mimeType: 'image/jpeg' }),
      verifyVerseRefs: async (_sb: unknown, refs: string[]) =>
        refs.map((ref) => ({ ref, status: 'found' as const, canonicalText: 'The LORD is my shepherd' })),
      extractVerseRefs: (t: string) => (t.includes('Psalm 23:1') ? ['Psalm 23:1'] : []),
      insertRow: async (row: any) => { inserted.push(row); return 'tx-1'; },
      recordUsage: async () => {},
      supabase: {},
      ...over,
    },
  };
}

describe('handleTranscribe', () => {
  it('rejects an image_key not under the caller folder', async () => {
    const { d } = deps();
    const res = await handleTranscribe(d as never, { user_id: 'u1', image_key: 'note-scans/u2/x.jpg' });
    expect(res.status).toBe(403);
  });

  it('rejects a bad payload', async () => {
    const { d } = deps();
    const res = await handleTranscribe(d as never, { user_id: 'u1' } as never);
    expect(res.status).toBe(400);
  });

  it('returns transcription + verse flags and inserts a row', async () => {
    const { d, inserted } = deps();
    const res = await handleTranscribe(d as never, { user_id: 'u1', image_key: 'note-scans/u1/x.jpg' });
    expect(res.status).toBe(200);
    expect(res.body.transcription).toBe('Trusting in Psalm 23:1 today');
    expect(res.body.confidence).toBe(0.82);
    expect(res.body.verseFlags).toEqual([
      { ref: 'Psalm 23:1', status: 'found', canonicalText: 'The LORD is my shepherd' },
    ]);
    expect(res.body.transcription_id).toBe('tx-1');
    expect(inserted[0]).toMatchObject({ user_id: 'u1', image_key: 'note-scans/u1/x.jpg', status: 'transcribed' });
  });

  it('degrades to empty verseFlags when verification throws', async () => {
    const { d } = deps({ verifyVerseRefs: async () => { throw new Error('db down'); } });
    const res = await handleTranscribe(d as never, { user_id: 'u1', image_key: 'note-scans/u1/x.jpg' });
    expect(res.status).toBe(200);
    expect(res.body.verseFlags).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run supabase/functions/transcribe-note/handler.test.ts`
Expected: FAIL — cannot find `./handler.ts`.

- [ ] **Step 4: Implement the handler**

```ts
// supabase/functions/transcribe-note/handler.ts
import type { LLMAdapter } from '../_shared/anthropic.ts';
import type { VerseFlag } from '../_shared/verse-verify.ts';
import { TRANSCRIBE_SYSTEM, TRANSCRIBE_TOOL } from './prompt.ts';

export interface UncertainWord { text: string; context?: string }

export interface TranscribeResult {
  transcription: string;
  confidence: number;
  uncertainWords: UncertainWord[];
  verseFlags: VerseFlag[];
  transcription_id: string;
}

export interface TranscribeDeps {
  llm: LLMAdapter;
  downloadImage: (key: string) => Promise<{ base64: string; mimeType: string }>;
  verifyVerseRefs: (supabase: unknown, refs: string[]) => Promise<VerseFlag[]>;
  extractVerseRefs: (text: string) => string[];
  insertRow: (row: Record<string, unknown>) => Promise<string>; // returns transcription id
  recordUsage: (row: {
    user_id: string; model: string; artifact_kind: string;
    tokens_in: number; tokens_out: number; status: 'ok' | 'error'; error_code?: string;
  }) => Promise<void>;
  supabase: unknown;
}

export interface TranscribeBody { user_id?: string; image_key?: string }
export interface HandlerResponse { status: number; body: Record<string, unknown> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleTranscribe(
  deps: TranscribeDeps,
  body: TranscribeBody,
): Promise<HandlerResponse> {
  if (typeof body.user_id !== 'string' || !UUID_RE.test(body.user_id)) {
    return { status: 400, body: { error: 'bad user_id' } };
  }
  if (typeof body.image_key !== 'string') {
    return { status: 400, body: { error: 'bad image_key' } };
  }
  // IDOR guard: the key MUST live under note-scans/{user_id}/.
  if (!body.image_key.startsWith(`note-scans/${body.user_id}/`)) {
    return { status: 403, body: { error: 'forbidden image_key' } };
  }

  const { base64, mimeType } = await deps.downloadImage(body.image_key);

  let parsed: { transcription: string; confidence: number; uncertainWords: UncertainWord[] };
  let modelUsed = 'claude-sonnet-4-6';
  let tokensIn = 0, tokensOut = 0;
  try {
    const out = await deps.llm.generate<typeof parsed>({
      model: 'sonnet',
      system: TRANSCRIBE_SYSTEM,
      maxTokens: 4096,
      tool: TRANSCRIBE_TOOL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe this handwritten note.' },
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        ],
      }],
    });
    parsed = out.parsed;
    modelUsed = out.modelUsed;
    tokensIn = out.promptTokens;
    tokensOut = out.completionTokens;
  } catch (err) {
    await deps.recordUsage({
      user_id: body.user_id, model: modelUsed, artifact_kind: 'note_transcription',
      tokens_in: 0, tokens_out: 0, status: 'error',
      error_code: err instanceof Error ? err.message.slice(0, 80) : 'llm_error',
    });
    return { status: 502, body: { error: 'transcription failed' } };
  }

  const transcription = parsed.transcription ?? '';
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
  const uncertainWords = Array.isArray(parsed.uncertainWords) ? parsed.uncertainWords : [];

  // Verse verification — enhancement only; a throw degrades to no flags.
  let verseFlags: VerseFlag[] = [];
  try {
    const refs = deps.extractVerseRefs(transcription);
    if (refs.length > 0) verseFlags = await deps.verifyVerseRefs(deps.supabase, refs);
  } catch {
    verseFlags = [];
  }

  const transcription_id = await deps.insertRow({
    user_id: body.user_id,
    image_key: body.image_key,
    raw_transcription: transcription,
    confidence,
    uncertain_words: uncertainWords,
    verse_flags: verseFlags,
    model: modelUsed,
    status: 'transcribed',
  });

  await deps.recordUsage({
    user_id: body.user_id, model: modelUsed, artifact_kind: 'note_transcription',
    tokens_in: tokensIn, tokens_out: tokensOut, status: 'ok',
  });

  return {
    status: 200,
    body: { transcription, confidence, uncertainWords, verseFlags, transcription_id },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/transcribe-note/handler.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 6: Write the Deno `serve` wrapper**

```ts
// supabase/functions/transcribe-note/index.ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { createAnthropicAdapter } from '../_shared/anthropic.ts';
import { verifyVerseRefs } from '../_shared/verse-verify.ts';
import { extractVerseRefsFromNoteContent } from '../_shared/note-signals.ts';
import { recordLamplightUsage } from '../_shared/usage.ts';
import { handleTranscribe } from './handler.ts';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const jsonResp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } });

// extractVerseRefsFromNoteContent expects TipTap JSON; wrap plain transcription
// text into a one-paragraph doc so we can reuse the canonical extractor.
function extractVerseRefsFromText(text: string): string[] {
  const doc = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
  return extractVerseRefsFromNoteContent(doc);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405);
  try {
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) return jsonResp({ error: 'ANTHROPIC_API_KEY missing' }, 500);

    let body: { user_id?: string; image_key?: string };
    try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }

    const supabase = serviceClient();
    const llm = createAnthropicAdapter({ apiKey: anthropicKey, fetch });

    const res = await handleTranscribe({
      llm,
      supabase,
      extractVerseRefs: extractVerseRefsFromText,
      verifyVerseRefs,
      downloadImage: async (key) => {
        const { data, error } = await supabase.storage.from('note-scans').download(key.replace(/^note-scans\//, ''));
        if (error || !data) throw new Error(`download failed: ${error?.message ?? 'no data'}`);
        const buf = new Uint8Array(await data.arrayBuffer());
        let binary = '';
        for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
        return { base64: btoa(binary), mimeType: data.type || 'image/jpeg' };
      },
      insertRow: async (row) => {
        const { data, error } = await supabase.from('note_transcriptions').insert(row).select('id').single();
        if (error) throw new Error(error.message);
        return data!.id as string;
      },
      recordUsage: (usageRow) => recordLamplightUsage(supabase, usageRow),
    }, body);

    return jsonResp(res.body, res.status);
  } catch (err) {
    return jsonResp({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
```

Note: `extractVerseRefsFromNoteContent` and `intersectTagsAndVerseRefs` are exported from `_shared/note-signals.ts` (confirm the export name; if it differs, use the matching exported extractor). The `.download()` call strips the `note-scans/` prefix because the Storage SDK's bucket handle is already scoped to that bucket.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/transcribe-note/
git commit -m "feat(notepad): transcribe-note edge function (Claude vision + verse verify)"
```

---

## Task 5: Client image preprocessing (`image-preprocess.ts`)

Pure pixel/dimension helpers are unit-tested; the canvas orchestration is smoke-only (jsdom canvas is not pixel-accurate).

**Files:**
- Create: `src/notepad/scan/image-preprocess.ts`
- Test: `src/notepad/scan/image-preprocess.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/notepad/scan/image-preprocess.test.ts
import { describe, it, expect } from 'vitest';
import { targetDimensions, grayscaleContrastInPlace } from './image-preprocess';

describe('targetDimensions', () => {
  it('downscales the long edge to the cap, preserving aspect', () => {
    expect(targetDimensions(3000, 2000, 1500)).toEqual({ width: 1500, height: 1000 });
  });
  it('downscales when height is the long edge', () => {
    expect(targetDimensions(2000, 3000, 1500)).toEqual({ width: 1000, height: 1500 });
  });
  it('leaves small images unchanged', () => {
    expect(targetDimensions(800, 600, 1500)).toEqual({ width: 800, height: 600 });
  });
});

describe('grayscaleContrastInPlace', () => {
  it('makes R=G=B (grayscale) for every pixel', () => {
    const data = new Uint8ClampedArray([10, 200, 90, 255, 60, 60, 60, 255]);
    grayscaleContrastInPlace(data);
    expect(data[0]).toBe(data[1]);
    expect(data[1]).toBe(data[2]);
    expect(data[4]).toBe(data[5]);
    expect(data[5]).toBe(data[6]);
  });
  it('preserves the alpha channel', () => {
    const data = new Uint8ClampedArray([10, 200, 90, 128]);
    grayscaleContrastInPlace(data);
    expect(data[3]).toBe(128);
  });
  it('stretches contrast so the darkest pixel→0 and brightest→255', () => {
    // two gray pixels at luminance ~80 and ~160 → stretched to 0 and 255
    const data = new Uint8ClampedArray([80, 80, 80, 255, 160, 160, 160, 255]);
    grayscaleContrastInPlace(data);
    expect(data[0]).toBe(0);
    expect(data[4]).toBe(255);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/scan/image-preprocess.test.ts`
Expected: FAIL — cannot find `./image-preprocess`.

- [ ] **Step 3: Implement**

```ts
// src/notepad/scan/image-preprocess.ts
//
// Cheap, dependency-free image cleanup before OCR upload. Pure helpers
// (targetDimensions, grayscaleContrastInPlace) are unit-tested; preprocessImage
// orchestrates them on a canvas and lazily runs the heavy deskew pass.

const LONG_EDGE_CAP = 1500;
const JPEG_QUALITY = 0.85;

export interface Dimensions { width: number; height: number }

/** Scale so the long edge ≤ cap, preserving aspect ratio. No upscaling. */
export function targetDimensions(w: number, h: number, cap = LONG_EDGE_CAP): Dimensions {
  const long = Math.max(w, h);
  if (long <= cap) return { width: w, height: h };
  const scale = cap / long;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/**
 * Convert RGBA pixel data to grayscale (luminance) and stretch contrast so the
 * darkest luminance maps to 0 and the brightest to 255. Mutates in place;
 * alpha is preserved. Two-pass: find min/max luminance, then map.
 */
export function grayscaleContrastInPlace(data: Uint8ClampedArray): void {
  let min = 255, max = 0;
  const lum = new Uint8ClampedArray(data.length / 4);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const y = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    lum[p] = y;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  const range = max - min || 1;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const stretched = Math.round(((lum[p] - min) / range) * 255);
    data[i] = data[i + 1] = data[i + 2] = stretched;
    // alpha (data[i+3]) untouched
  }
}

/**
 * Full pipeline: decode → downscale → grayscale+contrast → (lazy) deskew →
 * JPEG Blob. Smoke-tested via the capture UI (canvas + WASM, not unit-tested).
 */
export async function preprocessImage(input: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(input);
  const { width, height } = targetDimensions(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  grayscaleContrastInPlace(imgData.data);
  ctx.putImageData(imgData, 0, 0);

  // Heavy deskew is loaded only here, only when an image is actually processed.
  try {
    const { deskewCanvas } = await import('./deskew');
    await deskewCanvas(canvas);
  } catch {
    // no-op: if deskew fails or finds no page quad, keep the contrast-only image
  }

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b ?? input), 'image/jpeg', JPEG_QUALITY),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/notepad/scan/image-preprocess.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/scan/image-preprocess.ts src/notepad/scan/image-preprocess.test.ts
git commit -m "feat(notepad): client image preprocessing (downscale + grayscale + contrast)"
```

---

## Task 6: Lazy deskew module (`deskew.ts`)

Smoke-only (OpenCV.js WASM is DOM/WASM-coupled; same exemption as `parseFile`). It must **never throw fatally** and must no-op when no confident page quad is found.

**Files:**
- Create: `src/notepad/scan/deskew.ts`

- [ ] **Step 1: Add jscanify dependency**

Run: `npm install jscanify`
Expected: added to `package.json` dependencies. (jscanify wraps OpenCV.js for document edge detection.)

- [ ] **Step 2: Implement the lazy deskew**

```ts
// src/notepad/scan/deskew.ts
//
// Lazy document deskew / perspective-flatten via jscanify (OpenCV.js). Imported
// dynamically by image-preprocess.ts so the multi-MB WASM never enters the main
// bundle. Mutates the given canvas in place when a confident page quad is found;
// otherwise leaves it untouched. Never throws fatally — callers treat any
// failure as "skip deskew".

let scannerPromise: Promise<unknown> | null = null;

async function getScanner(): Promise<{ extractPaper: Function; getCornerPoints?: Function } | null> {
  if (!scannerPromise) {
    scannerPromise = (async () => {
      const mod: any = await import('jscanify');
      const JscanifyCtor = mod.default ?? mod;
      // jscanify expects a global `cv` (OpenCV.js). Load it once from CDN.
      if (!(globalThis as any).cv) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://docs.opencv.org/4.10.0/opencv.js';
          s.async = true;
          s.onload = () => {
            const cv = (globalThis as any).cv;
            if (cv && typeof cv.then === 'function') cv.then(() => resolve());
            else if (cv && cv.Mat) resolve();
            else { (globalThis as any).cv = cv; cv['onRuntimeInitialized'] = () => resolve(); }
          };
          s.onerror = () => reject(new Error('opencv load failed'));
          document.head.appendChild(s);
        });
      }
      return new JscanifyCtor();
    })();
  }
  try { return (await scannerPromise) as any; } catch { scannerPromise = null; return null; }
}

/**
 * Detect the page edges and flatten/crop the canvas to the page. Returns true if
 * a deskew was applied, false if skipped. On any failure or low-confidence
 * detection, the canvas is left unchanged and false is returned.
 */
export async function deskewCanvas(canvas: HTMLCanvasElement): Promise<boolean> {
  const scanner = await getScanner();
  if (!scanner || typeof scanner.extractPaper !== 'function') return false;
  try {
    const out: HTMLCanvasElement = scanner.extractPaper(canvas, canvas.width, canvas.height);
    if (!out || out.width === 0 || out.height === 0) return false;
    const ctx = canvas.getContext('2d')!;
    canvas.width = out.width;
    canvas.height = out.height;
    ctx.drawImage(out, 0, 0);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Verify it builds (no unit test)**

Run: `npx tsc --noEmit`
Expected: no type errors in `deskew.ts`. (Runtime behavior is smoke-tested in Task 9/10 via the capture UI.)

- [ ] **Step 4: Commit**

```bash
git add src/notepad/scan/deskew.ts package.json package-lock.json
git commit -m "feat(notepad): lazy OpenCV/jscanify document deskew"
```

---

## Task 7: Transcription client (`transcription-client.ts` + `types.ts`)

**Files:**
- Create: `src/notepad/scan/types.ts`
- Create: `src/notepad/scan/transcription-client.ts`
- Test: `src/notepad/scan/transcription-client.test.ts`

- [ ] **Step 1: Define shared client types**

```ts
// src/notepad/scan/types.ts
export interface UncertainWord { text: string; context?: string }
export interface VerseFlag { ref: string; status: 'found' | 'not_found'; canonicalText?: string }
export interface TranscriptionResult {
  transcription: string;
  confidence: number;
  uncertainWords: UncertainWord[];
  verseFlags: VerseFlag[];
  transcription_id: string;
  imageKey: string;
}
```

- [ ] **Step 2: Write the failing test (pure helper)**

```ts
// src/notepad/scan/transcription-client.test.ts
import { describe, it, expect } from 'vitest';
import { scanObjectKey, isAcceptedImage } from './transcription-client';

describe('scanObjectKey', () => {
  it('namespaces by user id under note-scans', () => {
    const key = scanObjectKey('user-123', 'abc-uuid');
    expect(key).toBe('note-scans/user-123/abc-uuid.jpg');
  });
});

describe('isAcceptedImage', () => {
  it('accepts jpeg/png/webp/heic', () => {
    expect(isAcceptedImage('image/jpeg')).toBe(true);
    expect(isAcceptedImage('image/png')).toBe(true);
    expect(isAcceptedImage('image/webp')).toBe(true);
    expect(isAcceptedImage('image/heic')).toBe(true);
  });
  it('rejects pdf and empty', () => {
    expect(isAcceptedImage('application/pdf')).toBe(false);
    expect(isAcceptedImage('')).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/notepad/scan/transcription-client.test.ts`
Expected: FAIL — cannot find `./transcription-client`.

- [ ] **Step 4: Implement**

```ts
// src/notepad/scan/transcription-client.ts
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../lib/supabase';
import type { TranscriptionResult } from './types';

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function scanObjectKey(userId: string, id = uuidv4()): string {
  return `note-scans/${userId}/${id}.jpg`;
}

export function isAcceptedImage(mimeType: string): boolean {
  return ACCEPTED.has(mimeType);
}

/** Upload the cleaned image to the private bucket; returns the full object key. */
export async function uploadScan(userId: string, blob: Blob): Promise<string> {
  if (!supabase) throw new Error('supabase not configured');
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('image too large');
  const key = scanObjectKey(userId);
  const path = key.replace(/^note-scans\//, '');
  const { error } = await supabase.storage.from('note-scans').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(`upload failed: ${error.message}`);
  return key;
}

/** Invoke the edge function; returns the structured result + the image key. */
export async function transcribe(userId: string, imageKey: string): Promise<TranscriptionResult> {
  if (!supabase) throw new Error('supabase not configured');
  const { data, error } = await supabase.functions.invoke('transcribe-note', {
    body: { user_id: userId, image_key: imageKey },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return { ...(data as Omit<TranscriptionResult, 'imageKey'>), imageKey };
}

/** Short-lived signed URL for displaying the original in the review pane. */
export async function signedScanUrl(imageKey: string, expiresInSec = 600): Promise<string | null> {
  if (!supabase) return null;
  const path = imageKey.replace(/^note-scans\//, '');
  const { data, error } = await supabase.storage.from('note-scans').createSignedUrl(path, expiresInSec);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Discard: delete the image object and the provenance row. */
export async function discardScan(imageKey: string, transcriptionId: string): Promise<void> {
  if (!supabase) return;
  const path = imageKey.replace(/^note-scans\//, '');
  await supabase.storage.from('note-scans').remove([path]);
  await supabase.from('note_transcriptions').delete().eq('id', transcriptionId);
}

/** On save: link the provenance row to the created note. */
export async function markTranscriptionSaved(transcriptionId: string, noteId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('note_transcriptions')
    .update({ note_id: noteId, status: 'saved', updated_at: new Date().toISOString() })
    .eq('id', transcriptionId);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/notepad/scan/transcription-client.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/notepad/scan/types.ts src/notepad/scan/transcription-client.ts src/notepad/scan/transcription-client.test.ts
git commit -m "feat(notepad): transcription client (upload, invoke, signed url, discard)"
```

---

## Task 8: Uncertain-word decoration (`uncertain-decoration.ts`)

The span locator is pure and unit-tested; the ProseMirror plugin wrapper is thin.

**Files:**
- Create: `src/notepad/scan/uncertain-decoration.ts`
- Test: `src/notepad/scan/uncertain-decoration.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/notepad/scan/uncertain-decoration.test.ts
import { describe, it, expect } from 'vitest';
import { locateUncertainSpans } from './uncertain-decoration';

describe('locateUncertainSpans', () => {
  it('locates a single word', () => {
    expect(locateUncertainSpans('trust in the Lord', [{ text: 'trust' }]))
      .toEqual([{ from: 0, to: 5 }]);
  });

  it('uses context to pick the right repeated occurrence', () => {
    const text = 'grace and grace abound';
    // context disambiguates the SECOND "grace"
    expect(locateUncertainSpans(text, [{ text: 'grace', context: 'and grace abound' }]))
      .toEqual([{ from: 10, to: 15 }]);
  });

  it('falls back to the first occurrence when context is absent', () => {
    expect(locateUncertainSpans('grace and grace', [{ text: 'grace' }]))
      .toEqual([{ from: 0, to: 5 }]);
  });

  it('drops words it cannot find', () => {
    expect(locateUncertainSpans('hello world', [{ text: 'zzz' }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/scan/uncertain-decoration.test.ts`
Expected: FAIL — cannot find `./uncertain-decoration`.

- [ ] **Step 3: Implement**

```ts
// src/notepad/scan/uncertain-decoration.ts
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { UncertainWord } from './types';

export interface Span { from: number; to: number }

/**
 * Locate each uncertain word in the plaintext. When `context` is given, prefer
 * the occurrence inside that context; otherwise use the first occurrence.
 * Offsets are plain-string indices into `text`.
 */
export function locateUncertainSpans(text: string, words: UncertainWord[]): Span[] {
  const spans: Span[] = [];
  for (const w of words) {
    if (!w.text) continue;
    let from = -1;
    if (w.context) {
      const ctxAt = text.indexOf(w.context);
      if (ctxAt >= 0) {
        const within = w.context.indexOf(w.text);
        if (within >= 0) from = ctxAt + within;
      }
    }
    if (from < 0) from = text.indexOf(w.text);
    if (from < 0) continue;
    spans.push({ from, to: from + w.text.length });
  }
  return spans;
}

export const uncertainPluginKey = new PluginKey('uncertain-words');

/**
 * ProseMirror plugin that paints a highlight decoration over uncertain spans.
 * Decorations (not marks) so they never persist into the saved note content and
 * naturally disappear as the document changes. `getPlainOffset` maps a
 * plain-string index to a ProseMirror doc position for the single top-level
 * paragraph-per-line document the review editor builds.
 */
export function uncertainDecorationPlugin(spans: Span[]) {
  return new Plugin({
    key: uncertainPluginKey,
    props: {
      decorations(state) {
        const decos: Decoration[] = [];
        for (const s of spans) {
          const from = mapPlainToDoc(state.doc, s.from);
          const to = mapPlainToDoc(state.doc, s.to);
          if (from != null && to != null && to > from) {
            decos.push(Decoration.inline(from, to, { class: 'uncertain-word' }));
          }
        }
        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}

// Map a plain-text offset (with '\n' between block nodes) to a doc position.
function mapPlainToDoc(doc: import('@tiptap/pm/model').Node, plainOffset: number): number | null {
  let remaining = plainOffset;
  let result: number | null = null;
  let firstBlock = true;
  doc.descendants((node, pos) => {
    if (result != null) return false;
    if (node.isTextblock) {
      if (!firstBlock) remaining -= 1; // the '\n' separator
      firstBlock = false;
      const textLen = node.textContent.length;
      if (remaining <= textLen) {
        result = pos + 1 + remaining; // +1 to enter the block
        return false;
      }
      remaining -= textLen;
    }
    return true;
  });
  return result;
}
```

Add the highlight style to the notepad editor CSS (find the editor's existing stylesheet, e.g. a `.ProseMirror` rules file under `src/notepad/editor/`):
```css
.ProseMirror .uncertain-word {
  background: rgba(224, 123, 167, 0.22);     /* soft pink, matches journal accent */
  border-bottom: 1px dashed rgba(224, 123, 167, 0.8);
  border-radius: 2px;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/notepad/scan/uncertain-decoration.test.ts`
Expected: PASS (locator cases). The plugin/`mapPlainToDoc` path is exercised in the review component smoke test (Task 10).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/scan/uncertain-decoration.ts src/notepad/scan/uncertain-decoration.test.ts
git commit -m "feat(notepad): uncertain-word span locator + ProseMirror decoration"
```

---

## Task 9: `ScanCapture` component (camera + file)

Component is smoke-tested (DOM/media APIs). Provides camera capture with a graceful file-input fallback, runs `preprocessImage`, uploads, transcribes, and calls `onResult`.

**Files:**
- Create: `src/notepad/components/ScanCapture.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// src/notepad/components/ScanCapture.tsx
import { useEffect, useRef, useState } from 'react';
import { preprocessImage } from '../scan/image-preprocess';
import { uploadScan, transcribe, isAcceptedImage, MAX_IMAGE_BYTES } from '../scan/transcription-client';
import type { TranscriptionResult } from '../scan/types';

type Phase = 'idle' | 'camera' | 'cleaning' | 'transcribing' | 'error';

interface Props {
  userId: string;
  onResult: (result: TranscriptionResult) => void;
  onCancel: () => void;
}

export function ScanCapture({ userId, onResult, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setPhase('camera');
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch {
      // permission denied / no camera → fall back to the file picker
      fileRef.current?.click();
    }
  }

  async function captureFromVideo() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    stopCamera();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
    if (blob) await process(blob);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isAcceptedImage(file.type)) { setPhase('error'); setError('Please choose a JPG, PNG, or HEIC image.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setPhase('error'); setError('Image is too large (max 10 MB).'); return; }
    await process(file);
  }

  async function process(blob: Blob) {
    try {
      setPhase('cleaning');
      const cleaned = await preprocessImage(blob);
      setPhase('transcribing');
      const key = await uploadScan(userId, cleaned);
      const result = await transcribe(userId, key);
      onResult(result);
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div className="scan-capture" role="dialog" aria-label="Scan handwritten note">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />

      {phase === 'idle' && (
        <div className="scan-capture__choices">
          <button onClick={startCamera}>Take photo</button>
          <button onClick={() => fileRef.current?.click()}>Choose photo</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      )}

      {phase === 'camera' && (
        <div className="scan-capture__camera">
          <video ref={videoRef} playsInline muted aria-label="Camera preview" />
          <div className="scan-capture__camera-actions">
            <button onClick={captureFromVideo}>Capture</button>
            <button onClick={() => { stopCamera(); setPhase('idle'); }}>Back</button>
          </div>
        </div>
      )}

      {(phase === 'cleaning' || phase === 'transcribing') && (
        <div className="scan-capture__busy" aria-live="polite">
          {phase === 'cleaning' ? 'Cleaning up image…' : 'Reading your handwriting…'}
        </div>
      )}

      {phase === 'error' && (
        <div className="scan-capture__error" role="alert">
          <p>{error}</p>
          <button onClick={() => { setError(null); setPhase('idle'); }}>Try again</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/notepad/components/ScanCapture.tsx
git commit -m "feat(notepad): ScanCapture component (camera + file capture)"
```

---

## Task 10: `TranscriptionReview` + save path

**Files:**
- Create: `src/notepad/scan/build-note-from-transcription.ts`
- Test: `src/notepad/scan/build-note-from-transcription.test.ts`
- Create: `src/notepad/components/TranscriptionReview.tsx`

- [ ] **Step 1: Write the failing test for the note builder**

```ts
// src/notepad/scan/build-note-from-transcription.test.ts
import { describe, it, expect } from 'vitest';
import { buildNoteFromTranscription } from './build-note-from-transcription';

describe('buildNoteFromTranscription', () => {
  it('splits paragraphs and sets the title + verse tags', () => {
    const note = buildNoteFromTranscription({
      title: 'My scan',
      text: 'Trusting in Psalm 23:1\n\nHe restores my soul',
      folderId: 'f1',
      autoDetectVerses: true,
    });
    expect(note.title).toBe('My scan');
    expect(note.folderId).toBe('f1');
    expect(note.tags).toContain('Psalm 23:1');
    const doc = JSON.parse(note.content);
    expect(doc.content).toHaveLength(2); // two paragraphs
    expect(note.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('omits tags when autoDetectVerses is false', () => {
    const note = buildNoteFromTranscription({
      title: 'x', text: 'Psalm 23:1', folderId: 'f1', autoDetectVerses: false,
    });
    expect(note.tags).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/scan/build-note-from-transcription.test.ts`
Expected: FAIL — cannot find `./build-note-from-transcription`.

- [ ] **Step 3: Implement (thin wrapper over the existing builder)**

```ts
// src/notepad/scan/build-note-from-transcription.ts
import { buildNoteFromText, type BuildNoteOpts } from '../import/document-importer';
import type { Note } from '../types';

/**
 * Map an edited transcript to a Note via the SAME builder the file-import path
 * uses, so verse-tagging / word-count / TipTap doc shape are identical. The
 * caller passes the user-edited transcript text; downstream importNote +
 * linkNotesByVerses are invoked by the review component exactly as in import.
 */
export function buildNoteFromTranscription(opts: BuildNoteOpts): Note {
  return buildNoteFromText(opts);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/notepad/scan/build-note-from-transcription.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the review component**

```tsx
// src/notepad/components/TranscriptionReview.tsx
import { useEffect, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { signedScanUrl, markTranscriptionSaved, discardScan } from '../scan/transcription-client';
import { buildNoteFromTranscription } from '../scan/build-note-from-transcription';
import { locateUncertainSpans, uncertainDecorationPlugin } from '../scan/uncertain-decoration';
import { linkNotesByVerses } from '../import/document-importer';
import type { TranscriptionResult } from '../scan/types';
import type { Note } from '../types';
import type { StorageAdapter } from '../storage/adapter';

interface Props {
  result: TranscriptionResult;
  folderId: string;
  adapter: StorageAdapter;
  onSaved: (note: Note) => void;
  onDiscarded: () => void;
}

export function TranscriptionReview({ result, folderId, adapter, onSaved, onDiscarded }: Props) {
  const [title, setTitle] = useState(`Scanned note · ${new Date().toLocaleDateString()}`);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const spans = useMemo(
    () => locateUncertainSpans(result.transcription, result.uncertainWords),
    [result.transcription, result.uncertainWords],
  );

  const editor = useEditor({
    extensions: [StarterKit],
    content: {
      type: 'doc',
      content: result.transcription.split(/\n\n+/).filter(Boolean).map((p) => ({
        type: 'paragraph', content: [{ type: 'text', text: p }],
      })),
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.registerPlugin(uncertainDecorationPlugin(spans));
  }, [editor, spans]);

  useEffect(() => {
    let active = true;
    signedScanUrl(result.imageKey).then((url) => { if (active) setImageUrl(url); });
    return () => { active = false; };
  }, [result.imageKey]);

  async function handleSave() {
    if (!editor) return;
    setSaving(true);
    try {
      const text = editor.getText();
      const note = buildNoteFromTranscription({ title, text, folderId, autoDetectVerses: true });
      const [linked] = linkNotesByVerses([note]); // single-note pass = no cross-links, keeps shape consistent
      const saved = await adapter.importNote(linked ?? note);
      await markTranscriptionSaved(result.transcription_id, saved.id);
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscard() {
    await discardScan(result.imageKey, result.transcription_id);
    onDiscarded();
  }

  return (
    <div className="transcription-review">
      <div className="transcription-review__panes">
        <figure className="transcription-review__image">
          {imageUrl
            ? <img src={imageUrl} alt="Your scanned note" />
            : <div aria-busy="true">Loading image…</div>}
        </figure>
        <div className="transcription-review__text">
          <input
            className="transcription-review__title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Note title"
          />
          {result.confidence < 0.6 && (
            <p className="transcription-review__low-conf" role="note">
              This handwriting was hard to read — please check it against the image.
            </p>
          )}
          <EditorContent editor={editor} />
          {result.verseFlags.length > 0 && (
            <ul className="transcription-review__verse-flags">
              {result.verseFlags.map((f) => (
                <li key={f.ref} className={f.status === 'found' ? 'is-found' : 'is-missing'}>
                  {f.status === 'found'
                    ? <span title={f.canonicalText}>{f.ref} ✓</span>
                    : <span>{f.ref} — couldn’t find this, check the photo</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="transcription-review__actions">
        <button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save note'}</button>
        <button onClick={handleDiscard} disabled={saving}>Discard</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify it builds**

Run: `npx tsc --noEmit`
Expected: no type errors. (Confirm `@tiptap/react` and `@tiptap/starter-kit` are already deps — they are, per the TipTap v3 editor in `src/notepad/editor/`. If the editor uses a custom extension set, import that instead of `StarterKit` to match the app's editor config.)

- [ ] **Step 7: Commit**

```bash
git add src/notepad/scan/build-note-from-transcription.ts src/notepad/scan/build-note-from-transcription.test.ts src/notepad/components/TranscriptionReview.tsx
git commit -m "feat(notepad): TranscriptionReview side-by-side + save/discard"
```

---

## Task 11: Wire the entry point into the upload flow

**Files:**
- Modify: `src/notepad/components/UploadModal.tsx`

- [ ] **Step 1: Add the scan flow to the upload modal**

Read `src/notepad/components/UploadModal.tsx` to confirm how it receives `folderId`, the storage `adapter`, and the authenticated `userId` (the adapter is constructed with `user.id` in `src/auth/session/auth-session.ts`). Add a three-state local flow inside the modal:

```tsx
// near the top of the component body
import { ScanCapture } from './ScanCapture';
import { TranscriptionReview } from './TranscriptionReview';
import type { TranscriptionResult } from '../scan/types';

type ScanStage = null | 'capture' | { review: TranscriptionResult };
const [scan, setScan] = useState<ScanStage>(null);
```

Add a button alongside the existing file drag-drop:
```tsx
<button type="button" onClick={() => setScan('capture')}>
  Scan handwritten note
</button>
```

Render the flow (assumes the modal already has `userId`, `folderId`, `adapter`, and an `onClose`/`onNoteCreated` in scope — wire to the existing prop names):
```tsx
{scan === 'capture' && (
  <ScanCapture
    userId={userId}
    onResult={(result) => setScan({ review: result })}
    onCancel={() => setScan(null)}
  />
)}
{scan && typeof scan === 'object' && (
  <TranscriptionReview
    result={scan.review}
    folderId={folderId}
    adapter={adapter}
    onSaved={(note) => { setScan(null); onNoteCreated?.(note); onClose(); }}
    onDiscarded={() => setScan(null)}
  />
)}
```

If `userId` is not currently passed to `UploadModal`, thread it from the parent that already holds the session (the same place the adapter is created). Keep the existing file-import path untouched.

- [ ] **Step 2: Verify build + full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass (new + existing).

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, open the notepad, click **Scan handwritten note**:
- Choose a photo of handwriting → see "Cleaning up…" then "Reading your handwriting…" → review screen with the image on one side and editable text on the other.
- Confirm uncertain words are highlighted and any verse references show a ✓ or "couldn't find" flag.
- Edit a word, **Save note** → it appears in the notes list with verse tags.
- Repeat and **Discard** → confirm no note is created.

(Requires the function deployed locally: `supabase functions serve transcribe-note`, with `ANTHROPIC_API_KEY` set via `supabase secrets set` / local env, and the migration applied.)

- [ ] **Step 4: Commit**

```bash
git add src/notepad/components/UploadModal.tsx
git commit -m "feat(notepad): add Scan handwritten note entry point to upload flow"
```

---

## Deferred (not in this plan)

- Multi-page batch scanning (the per-scan `note_transcriptions` row + bucket layout already support it).
- Async job-queue processing (Lamplight-style) for slow/batch cases.
- An automated accuracy eval harness over the captured `raw_transcription` vs. edited-note data set.
