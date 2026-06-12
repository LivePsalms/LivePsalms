# Apple Notes Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users import their Apple Notes into the Psalms notepad via an Apple Shortcut that POSTs each note to a new edge function, authenticated by a personal access token.

**Architecture:** An Apple Shortcut loops a chosen Apple Notes folder and POSTs each note's plain text to a new `import-apple-note` edge function. The function authenticates a personal access token (PAT) — SHA-256 hash → `consume_pat` Postgres RPC that enforces revocation + an hourly rate limit and returns the user — then converts text to TipTap JSON and upserts a note keyed on a stable `external_id` hash. Tokens are generated and revoked entirely client-side under RLS (the browser hashes the raw token and stores only the hash). Pure logic (text conversion, hashing, the upsert decision) lives in dependency-injected modules tested under vitest; `index.ts` does only Deno wiring.

**Tech Stack:** Supabase (Postgres + RLS + plpgsql RPC, Deno edge functions), TypeScript, React, vitest, Web Crypto (`crypto.subtle`, available in both Deno and Node 18+), Apple Shortcuts.

---

## File Structure

**Create:**
- `supabase/migrations/028_apple_notes_import.sql` — PAT table + RLS + `consume_pat` RPC + `notes` columns/index
- `supabase/functions/_shared/pat-hash.ts` — `hashToken` (SHA-256 hex)
- `supabase/functions/_shared/pat-hash.test.ts`
- `supabase/functions/_shared/apple-notes.ts` — `textToTipTap`, `countWords`, `computeExternalId`
- `supabase/functions/_shared/apple-notes.test.ts`
- `supabase/functions/import-apple-note/handler.ts` — pure request handler (auth/validate/upsert decision)
- `supabase/functions/import-apple-note/handler.test.ts`
- `supabase/functions/import-apple-note/index.ts` — Deno wiring (not unit-tested)
- `src/auth/personal-tokens.ts` — client-side token generate/hash/create/list/revoke
- `src/auth/personal-tokens.test.ts`
- `src/auth/components/ApplePersonalTokensSection.tsx` — Settings UI panel
- `src/auth/components/ApplePersonalTokensSection.test.tsx`
- `docs/runbooks/apple-notes-import.md` — Shortcut recipe + deploy/verify runbook

**Modify:**
- `supabase/config.toml` — add `[functions.import-apple-note] verify_jwt = false`
- The parent that renders `LamplightSettingsSection` (discovered in Task 8) — render the new panel

**Test command:** single file → `npx vitest run <path>`; whole suite → `npm test`.

---

### Task 1: Migration — PAT table, rate-limit RPC, notes provenance columns

**Files:**
- Create: `supabase/migrations/028_apple_notes_import.sql`

There is no automated SQL test harness in this repo (migrations apply manually), so this task is write → apply-to-local → verify with a query → commit.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/028_apple_notes_import.sql`:

```sql
-- supabase/migrations/028_apple_notes_import.sql
-- Personal access tokens (long-lived, revocable) for non-browser clients like
-- the Apple Notes import Shortcut, plus the columns/identity the
-- import-apple-note edge function needs to dedup and stamp imported notes.

-- ── Personal access tokens ───────────────────────────────────────────────
create table if not exists public.personal_access_tokens (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  token_hash         text not null unique,            -- SHA-256 hex; raw token never stored
  name               text not null default 'Apple Notes Shortcut',
  last_used_at       timestamptz,
  usage_window_start timestamptz not null default now(),
  usage_count        integer not null default 0,
  created_at         timestamptz not null default now(),
  revoked_at         timestamptz
);

create index if not exists personal_access_tokens_user_idx
  on public.personal_access_tokens (user_id);

alter table public.personal_access_tokens enable row level security;

-- The browser (authenticated session) manages its own tokens. The edge function
-- reads/updates via the service-role client, which bypasses RLS.
create policy "Users can view own tokens"
  on public.personal_access_tokens for select using (auth.uid() = user_id);
create policy "Users can insert own tokens"
  on public.personal_access_tokens for insert with check (auth.uid() = user_id);
create policy "Users can update own tokens"
  on public.personal_access_tokens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own tokens"
  on public.personal_access_tokens for delete using (auth.uid() = user_id);

-- Atomically resolve a token to its user while enforcing revocation and a
-- rolling hourly rate limit. SECURITY DEFINER so the edge function can call it;
-- it only ever reads the hash it is given. Returns no row for unknown/revoked
-- tokens; rate_limited = true (with the real user_id) when the cap is hit.
create or replace function public.consume_pat(p_token_hash text, p_max_per_hour integer)
returns table (user_id uuid, rate_limited boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_user   uuid;
  v_window timestamptz;
  v_count  integer;
begin
  select pat.id, pat.user_id, pat.usage_window_start, pat.usage_count
    into v_id, v_user, v_window, v_count
    from public.personal_access_tokens pat
    where pat.token_hash = p_token_hash and pat.revoked_at is null
    for update;
  if not found then
    return;  -- no row → caller treats as unauthorized
  end if;

  -- Reset the window if it has rolled over.
  if now() - v_window > interval '1 hour' then
    v_window := now();
    v_count := 0;
  end if;

  if v_count >= p_max_per_hour then
    update public.personal_access_tokens
      set usage_window_start = v_window, usage_count = v_count
      where id = v_id;
    user_id := v_user; rate_limited := true; return next; return;
  end if;

  update public.personal_access_tokens
    set usage_window_start = v_window,
        usage_count = v_count + 1,
        last_used_at = now()
    where id = v_id;

  user_id := v_user; rate_limited := false; return next;
end;
$$;

-- ── Imported-note provenance + dedup on notes ────────────────────────────
alter table public.notes
  add column if not exists source text not null default 'app',
  add column if not exists external_id text,
  add column if not exists apple_modified_at timestamptz;

-- One row per (user, Apple note); app-created notes (null external_id) unconstrained.
create unique index if not exists notes_user_external_id_idx
  on public.notes (user_id, external_id) where external_id is not null;
```

- [ ] **Step 2: Apply to the local Supabase database**

Run: `supabase db push --local` (or, if running the local stack, `supabase migration up`).
Expected: applies `028_apple_notes_import.sql` with no error.

If a local Supabase instance is not available, skip to Step 4 and instead note in the commit body that the migration was verified by SQL review only; flag it for manual apply in Task 10.

- [ ] **Step 3: Verify the objects exist**

Run:
```bash
supabase db execute --local "select to_regclass('public.personal_access_tokens') as tbl, (select count(*) from pg_proc where proname='consume_pat') as fn, (select count(*) from information_schema.columns where table_name='notes' and column_name in ('source','external_id','apple_modified_at')) as cols;"
```
Expected: `tbl = public.personal_access_tokens`, `fn = 1`, `cols = 3`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/028_apple_notes_import.sql
git commit -m "feat(apple-notes): migration for PAT table, consume_pat RPC, notes dedup columns"
```

---

### Task 2: `pat-hash` shared helper

**Files:**
- Create: `supabase/functions/_shared/pat-hash.ts`
- Test: `supabase/functions/_shared/pat-hash.test.ts`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/_shared/pat-hash.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hashToken } from './pat-hash';

describe('hashToken', () => {
  it('produces the known SHA-256 hex (parity vector)', async () => {
    expect(await hashToken('psalms-pat-known-answer'))
      .toBe('68aa6ef08e25170d27d3c4eb88e5184308cb467ab708be62bdb503ad89c9d359');
  });

  it('is deterministic and differs by input', async () => {
    expect(await hashToken('a')).toBe(await hashToken('a'));
    expect(await hashToken('a')).not.toBe(await hashToken('b'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/pat-hash.test.ts`
Expected: FAIL — cannot resolve `./pat-hash`.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/_shared/pat-hash.ts`:

```ts
// supabase/functions/_shared/pat-hash.ts
// SHA-256 hex of a personal access token's raw string. The raw token is shown
// to the user once; only this hash is ever stored or compared. The browser
// (src/auth/personal-tokens.ts) MUST use an identical algorithm so issued
// tokens validate here — the same known-answer vector is asserted in both trees.
export async function hashToken(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/_shared/pat-hash.test.ts`
Expected: PASS (3 assertions).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/pat-hash.ts supabase/functions/_shared/pat-hash.test.ts
git commit -m "feat(apple-notes): pat-hash shared helper with parity vector"
```

---

### Task 3: `apple-notes` shared transforms

**Files:**
- Create: `supabase/functions/_shared/apple-notes.ts`
- Test: `supabase/functions/_shared/apple-notes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/_shared/apple-notes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { textToTipTap, countWords, computeExternalId } from './apple-notes';

describe('textToTipTap', () => {
  it('wraps a single line in one paragraph', () => {
    expect(textToTipTap('hello')).toBe(
      JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }] }),
    );
  });

  it('preserves blank lines as empty paragraphs', () => {
    const out = JSON.parse(textToTipTap('a\n\nb'));
    expect(out.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
      { type: 'paragraph' },
      { type: 'paragraph', content: [{ type: 'text', text: 'b' }] },
    ]);
  });

  it('returns a single empty paragraph for empty input', () => {
    expect(textToTipTap('')).toBe(JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }));
  });
});

describe('countWords', () => {
  it('counts whitespace-separated words', () => {
    expect(countWords('the Lord is my shepherd')).toBe(5);
  });
  it('returns 0 for blank text', () => {
    expect(countWords('   \n  ')).toBe(0);
  });
});

describe('computeExternalId', () => {
  it('matches the known parity vector', async () => {
    expect(await computeExternalId('2026-05-01T12:00:00Z', 'Psalm 23'))
      .toBe('6de20b52e8be3ca03f11b0189b2969a337609b28699d9a23187abbe0982b688c');
  });
  it('changes when the title changes', async () => {
    const a = await computeExternalId('2026-05-01T12:00:00Z', 'Psalm 23');
    const b = await computeExternalId('2026-05-01T12:00:00Z', 'Psalm 24');
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/apple-notes.test.ts`
Expected: FAIL — cannot resolve `./apple-notes`.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/_shared/apple-notes.ts`:

```ts
// supabase/functions/_shared/apple-notes.ts
// Pure transforms for the Apple Notes import endpoint. The only platform API
// used is Web Crypto (crypto.subtle is global in both Deno and Node 18+), so
// this is unit-testable under vitest.

// Plain text → stringified TipTap doc. Each line becomes a paragraph; blank
// lines become empty paragraphs so spacing survives the round trip.
export function textToTipTap(text: string): string {
  const lines = (text ?? '').split('\n');
  const content: Array<Record<string, unknown>> = lines.map((line) =>
    line.length > 0
      ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
      : { type: 'paragraph' },
  );
  if (content.length === 0) content.push({ type: 'paragraph' });
  return JSON.stringify({ type: 'doc', content });
}

// Word count straight from the source plain text (equivalent to counting the
// TipTap body, but simpler since we own the text).
export function countWords(text: string): number {
  const t = (text ?? '').trim();
  return t ? t.split(/\s+/).length : 0;
}

// Stable dedup key for an Apple note. Shortcuts does not reliably expose a
// native note UUID, so we hash creation-date + title. Renaming a note in Apple
// Notes yields a new id (accepted limitation).
export async function computeExternalId(createdAt: string, title: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${createdAt}|${title}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/_shared/apple-notes.test.ts`
Expected: PASS (7 assertions).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/apple-notes.ts supabase/functions/_shared/apple-notes.test.ts
git commit -m "feat(apple-notes): textToTipTap, countWords, computeExternalId transforms"
```

---

### Task 4: `import-apple-note` handler (pure)

**Files:**
- Create: `supabase/functions/import-apple-note/handler.ts`
- Test: `supabase/functions/import-apple-note/handler.test.ts`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/import-apple-note/handler.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { handleImport, type ImportDeps } from './handler';

function deps(over: Partial<ImportDeps> = {}): ImportDeps {
  return {
    consumeToken: async () => ({ userId: 'u-1', rateLimited: false }),
    findExistingNote: async () => null,
    insertNote: async () => 'note-new',
    updateNote: async () => {},
    findOrCreateFolder: async () => 'folder-1',
    ...over,
  };
}

describe('handleImport auth', () => {
  it('401 when token hash empty', async () => {
    const res = await handleImport(deps(), '', { created_at: 'x', title: 't' });
    expect(res.status).toBe(401);
  });
  it('401 when token unknown/revoked', async () => {
    const res = await handleImport(
      deps({ consumeToken: async () => ({ userId: null, rateLimited: false }) }), 'h', { created_at: 'x' });
    expect(res.status).toBe(401);
  });
  it('429 when rate limited', async () => {
    const res = await handleImport(
      deps({ consumeToken: async () => ({ userId: null, rateLimited: true }) }), 'h', { created_at: 'x' });
    expect(res.status).toBe(429);
  });
});

describe('handleImport validation', () => {
  it('400 when created_at missing', async () => {
    const res = await handleImport(deps(), 'h', { title: 't', text: 'a' });
    expect(res.status).toBe(400);
  });
  it('400 when text exceeds the size cap', async () => {
    const big = 'x'.repeat(100 * 1024 + 1);
    const res = await handleImport(deps(), 'h', { created_at: 'x', text: big });
    expect(res.status).toBe(400);
  });
});

describe('handleImport upsert', () => {
  it('creates a new note with apple_notes provenance', async () => {
    const insertNote = vi.fn(async () => 'note-new');
    const res = await handleImport(
      deps({ insertNote }), 'h',
      { created_at: '2026-05-01T00:00:00Z', title: 'Psalm 23', text: 'shepherd' });
    expect(res).toEqual({ status: 200, body: { status: 'created', note_id: 'note-new' } });
    const row = insertNote.mock.calls[0][0];
    expect(row.source).toBe('apple_notes');
    expect(row.type).toBe('general');
    expect(row.word_count).toBe(1);
    expect(row.folder_id).toBe('folder-1');
  });

  it('is unchanged when modified_at is not newer', async () => {
    const updateNote = vi.fn(async () => {});
    const res = await handleImport(
      deps({ findExistingNote: async () => ({ id: 'old', appleModifiedAt: '2026-06-10T00:00:00Z' }), updateNote }),
      'h', { created_at: '2026-05-01T00:00:00Z', title: 'Psalm 23', text: 'x', modified_at: '2026-06-10T00:00:00Z' });
    expect(res.body).toEqual({ status: 'unchanged', note_id: 'old' });
    expect(updateNote).not.toHaveBeenCalled();
  });

  it('updates when the Apple note is newer', async () => {
    const updateNote = vi.fn(async () => {});
    const res = await handleImport(
      deps({ findExistingNote: async () => ({ id: 'old', appleModifiedAt: '2026-06-10T00:00:00Z' }), updateNote }),
      'h', { created_at: '2026-05-01T00:00:00Z', title: 'Psalm 23', text: 'new body', modified_at: '2026-06-11T00:00:00Z' });
    expect(res.body).toEqual({ status: 'updated', note_id: 'old' });
    expect(updateNote).toHaveBeenCalledOnce();
  });

  it('nests under a named subfolder when folder_name is provided', async () => {
    const calls: Array<[string, string, string | null]> = [];
    const findOrCreateFolder = vi.fn(async (u: string, name: string, parent: string | null) => {
      calls.push([u, name, parent]);
      return name === 'Apple Notes' ? 'root-folder' : 'sub-folder';
    });
    const insertNote = vi.fn(async () => 'note-new');
    await handleImport(
      deps({ findOrCreateFolder, insertNote }), 'h',
      { created_at: '2026-05-01T00:00:00Z', title: 'n', text: 'b', folder_name: 'Sermons' });
    expect(calls).toEqual([['u-1', 'Apple Notes', null], ['u-1', 'Sermons', 'root-folder']]);
    expect(insertNote.mock.calls[0][0].folder_id).toBe('sub-folder');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/import-apple-note/handler.test.ts`
Expected: FAIL — cannot resolve `./handler`.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/import-apple-note/handler.ts`:

```ts
// supabase/functions/import-apple-note/handler.ts
import { textToTipTap, countWords, computeExternalId } from '../_shared/apple-notes.ts';

export const MAX_TEXT_BYTES = 100 * 1024;
export const MAX_TITLE_LEN = 512;

export interface ImportBody {
  title?: unknown;
  text?: unknown;
  created_at?: unknown;
  modified_at?: unknown;
  folder_name?: unknown;
}

export interface NoteInsert {
  user_id: string;
  title: string;
  content: string;
  folder_id: string;
  type: 'general';
  tags: string[];
  word_count: number;
  source: 'apple_notes';
  external_id: string;
  apple_modified_at: string;
}

export interface NoteUpdate {
  title: string;
  content: string;
  word_count: number;
  apple_modified_at: string;
}

export interface ImportDeps {
  // Resolves token → user, enforcing revocation + hourly rate limit atomically.
  consumeToken: (tokenHash: string) => Promise<{ userId: string | null; rateLimited: boolean }>;
  findExistingNote: (userId: string, externalId: string) =>
    Promise<{ id: string; appleModifiedAt: string | null } | null>;
  insertNote: (row: NoteInsert) => Promise<string>;
  updateNote: (id: string, fields: NoteUpdate) => Promise<void>;
  findOrCreateFolder: (userId: string, name: string, parentId: string | null) => Promise<string>;
}

export type ImportStatus = 'created' | 'updated' | 'unchanged';
export interface HandlerResponse {
  status: number;
  body: { status: ImportStatus; note_id: string } | { error: string };
}

const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export async function handleImport(
  deps: ImportDeps,
  tokenHash: string,
  body: ImportBody,
): Promise<HandlerResponse> {
  if (!tokenHash) return { status: 401, body: { error: 'unauthorized' } };

  const { userId, rateLimited } = await deps.consumeToken(tokenHash);
  if (rateLimited) return { status: 429, body: { error: 'rate_limited' } };
  if (!userId) return { status: 401, body: { error: 'unauthorized' } };

  const text = asString(body.text) ?? '';
  if (new TextEncoder().encode(text).length > MAX_TEXT_BYTES) {
    return { status: 400, body: { error: 'text too large' } };
  }
  let title = (asString(body.title) ?? '').trim() || 'Untitled';
  if (title.length > MAX_TITLE_LEN) title = title.slice(0, MAX_TITLE_LEN);

  const createdAt = asString(body.created_at);
  if (!createdAt) return { status: 400, body: { error: 'created_at required' } };
  const modifiedAt = asString(body.modified_at) ?? createdAt;
  const folderName = asString(body.folder_name);

  const externalId = await computeExternalId(createdAt, title);
  const content = textToTipTap(text);
  const wordCount = countWords(text);

  // Placement: an "Apple Notes" root folder, optionally a named subfolder.
  const rootId = await deps.findOrCreateFolder(userId, 'Apple Notes', null);
  const folderId = folderName
    ? await deps.findOrCreateFolder(userId, folderName, rootId)
    : rootId;

  const existing = await deps.findExistingNote(userId, externalId);
  if (!existing) {
    const id = await deps.insertNote({
      user_id: userId, title, content, folder_id: folderId,
      type: 'general', tags: [], word_count: wordCount,
      source: 'apple_notes', external_id: externalId, apple_modified_at: modifiedAt,
    });
    return { status: 200, body: { status: 'created', note_id: id } };
  }

  // Upsert guard: overwrite only when the Apple note is genuinely newer than
  // what we last imported. Equal/older modified_at → no write (no-op re-run,
  // and a Psalms-side edit is preserved).
  const isNewer = existing.appleModifiedAt === null ||
    new Date(modifiedAt).getTime() > new Date(existing.appleModifiedAt).getTime();
  if (!isNewer) {
    return { status: 200, body: { status: 'unchanged', note_id: existing.id } };
  }
  await deps.updateNote(existing.id, { title, content, word_count: wordCount, apple_modified_at: modifiedAt });
  return { status: 200, body: { status: 'updated', note_id: existing.id } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/import-apple-note/handler.test.ts`
Expected: PASS (9 assertions).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/import-apple-note/handler.ts supabase/functions/import-apple-note/handler.test.ts
git commit -m "feat(apple-notes): import handler with auth, validation, upsert guard"
```

---

### Task 5: `import-apple-note` Deno wiring (`index.ts`)

**Files:**
- Create: `supabase/functions/import-apple-note/index.ts`

No unit test (matches `transcribe-note/index.ts`, which is Deno-only wiring verified manually in Task 10). Verify it type-checks via Deno.

- [ ] **Step 1: Write the implementation**

Create `supabase/functions/import-apple-note/index.ts`:

```ts
// supabase/functions/import-apple-note/index.ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { resolveAllowedOrigins, corsHeaders } from '../_shared/cors.ts';
import { bearerToken } from '../_shared/auth-identity.ts';
import { hashToken } from '../_shared/pat-hash.ts';
import { handleImport, type ImportDeps, type NoteInsert, type NoteUpdate } from './handler.ts';

// Bounds a runaway Shortcut loop; enforced atomically in the consume_pat RPC.
const MAX_PER_HOUR = 600;

serve(async (req) => {
  const cors = corsHeaders(req, resolveAllowedOrigins(Deno.env));
  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405);

  try {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }

    const supabase = serviceClient();
    const tokenHash = await hashToken(bearerToken(req));

    const deps: ImportDeps = {
      consumeToken: async (hash) => {
        const { data, error } = await supabase.rpc('consume_pat', { p_token_hash: hash, p_max_per_hour: MAX_PER_HOUR });
        if (error) throw new Error(error.message);
        const row = Array.isArray(data) ? data[0] : data;
        return { userId: row?.user_id ?? null, rateLimited: !!row?.rate_limited };
      },
      findExistingNote: async (userId, externalId) => {
        const { data, error } = await supabase
          .from('notes').select('id, apple_modified_at')
          .eq('user_id', userId).eq('external_id', externalId).maybeSingle();
        if (error) throw new Error(error.message);
        return data ? { id: data.id as string, appleModifiedAt: (data.apple_modified_at as string) ?? null } : null;
      },
      insertNote: async (row: NoteInsert) => {
        const { data, error } = await supabase.from('notes').insert(row).select('id').single();
        if (error) throw new Error(error.message);
        return data!.id as string;
      },
      updateNote: async (id: string, fields: NoteUpdate) => {
        const { error } = await supabase.from('notes')
          .update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw new Error(error.message);
      },
      findOrCreateFolder: async (userId, name, parentId) => {
        const base = supabase.from('folders').select('id').eq('user_id', userId).eq('name', name);
        const scoped = parentId === null ? base.is('parent_id', null) : base.eq('parent_id', parentId);
        const { data: found, error: findErr } = await scoped.maybeSingle();
        if (findErr) throw new Error(findErr.message);
        if (found) return found.id as string;
        const { data, error } = await supabase.from('folders')
          .insert({ user_id: userId, name, parent_id: parentId, order: 0 })
          .select('id').single();
        if (error) throw new Error(error.message);
        return data!.id as string;
      },
    };

    const res = await handleImport(deps, tokenHash, body);
    return jsonResp(res.body, res.status);
  } catch (err) {
    return jsonResp({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
```

- [ ] **Step 2: Type-check with Deno**

Run: `deno check supabase/functions/import-apple-note/index.ts`
Expected: no errors. (If `deno` is unavailable locally, this is verified at deploy time in Task 10 — note that in the commit body.)

- [ ] **Step 3: Confirm the vitest suite is still green for the function dir**

Run: `npx vitest run supabase/functions/import-apple-note`
Expected: PASS (handler tests; index.ts has no tests).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/import-apple-note/index.ts
git commit -m "feat(apple-notes): import-apple-note edge function wiring"
```

---

### Task 6: Register the function in `config.toml`

**Files:**
- Modify: `supabase/config.toml` (after the `[functions.contact-message]` block, around line 436)

- [ ] **Step 1: Add the function block**

In `supabase/config.toml`, immediately after the `[functions.contact-message]` block (which sets `verify_jwt = false`) and before `[analytics]`, insert:

```toml
# import-apple-note is invoked by the user's Apple Notes Shortcut, which carries
# a personal access token (NOT a Supabase JWT) in the Authorization header. The
# default verify_jwt gate would reject it, so verification is disabled here and
# the function authenticates the PAT itself (hash → consume_pat RPC → user_id),
# never trusting a client-supplied identity.
[functions.import-apple-note]
verify_jwt = false
```

- [ ] **Step 2: Verify the block is well-formed**

Run: `grep -A1 "functions.import-apple-note" supabase/config.toml`
Expected: prints the header line followed by `verify_jwt = false`.

- [ ] **Step 3: Commit**

```bash
git add supabase/config.toml
git commit -m "chore(apple-notes): register import-apple-note with verify_jwt=false"
```

---

### Task 7: Client-side token module

**Files:**
- Create: `src/auth/personal-tokens.ts`
- Test: `src/auth/personal-tokens.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/auth/personal-tokens.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { hashToken, generateRawToken, createToken, revokeToken } from './personal-tokens';

describe('hashToken parity', () => {
  it('matches the shared known-answer vector (must equal the edge helper)', async () => {
    expect(await hashToken('psalms-pat-known-answer'))
      .toBe('68aa6ef08e25170d27d3c4eb88e5184308cb467ab708be62bdb503ad89c9d359');
  });
});

describe('generateRawToken', () => {
  it('has the psalms_pat_ prefix and a url-safe body', () => {
    const t = generateRawToken();
    expect(t.startsWith('psalms_pat_')).toBe(true);
    expect(t.slice('psalms_pat_'.length)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('is unique across calls', () => {
    expect(generateRawToken()).not.toBe(generateRawToken());
  });
});

describe('createToken', () => {
  it('stores only the hash and returns the raw token', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const client = { from: () => ({ insert }) } as never;
    const raw = await createToken(client, 'u-1', 'My Shortcut');
    expect(raw.startsWith('psalms_pat_')).toBe(true);
    const row = insert.mock.calls[0][0];
    expect(row.user_id).toBe('u-1');
    expect(row.token_hash).toBe(await hashToken(raw));
    expect(JSON.stringify(row)).not.toContain(raw); // raw never persisted
  });
});

describe('revokeToken', () => {
  it('sets revoked_at on the row', async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const client = { from: () => ({ update }) } as never;
    await revokeToken(client, 'tok-1');
    expect(update.mock.calls[0][0]).toHaveProperty('revoked_at');
    expect(eq).toHaveBeenCalledWith('id', 'tok-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/auth/personal-tokens.test.ts`
Expected: FAIL — cannot resolve `./personal-tokens`.

- [ ] **Step 3: Write the implementation**

Create `src/auth/personal-tokens.ts`:

```ts
// src/auth/personal-tokens.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PersonalToken {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
}

// MUST match supabase/functions/_shared/pat-hash.ts exactly (the same parity
// vector is asserted in both trees) so issued tokens validate server-side.
export async function hashToken(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 32 random bytes, URL-safe base64, prefixed for recognizability.
export function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `psalms_pat_${b64}`;
}

// Creates a token and returns the RAW value (shown to the user exactly once).
// Only the hash is persisted.
export async function createToken(client: SupabaseClient, userId: string, name: string): Promise<string> {
  const raw = generateRawToken();
  const token_hash = await hashToken(raw);
  const { error } = await client.from('personal_access_tokens').insert({ user_id: userId, token_hash, name });
  if (error) throw error;
  return raw;
}

export async function listTokens(client: SupabaseClient): Promise<PersonalToken[]> {
  const { data, error } = await client
    .from('personal_access_tokens')
    .select('id, name, last_used_at, created_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    lastUsedAt: (r.last_used_at as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

export async function revokeToken(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('personal_access_tokens')
    .update({ revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/auth/personal-tokens.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/auth/personal-tokens.ts src/auth/personal-tokens.test.ts
git commit -m "feat(apple-notes): client-side personal access token module"
```

---

### Task 8: Settings UI panel

**Files:**
- Create: `src/auth/components/ApplePersonalTokensSection.tsx`
- Test: `src/auth/components/ApplePersonalTokensSection.test.tsx`
- Modify: the parent that renders `LamplightSettingsSection` (discovered in Step 1)

- [ ] **Step 1: Find where to mount the panel**

Run: `grep -rn "LamplightSettingsSection" src --include=*.tsx | grep -v ".test."`
Expected: one or more render sites. Pick the same parent that renders `<LamplightSettingsSection />` in the account/settings view; the new panel mounts directly below it. Note the file path and how it obtains the Supabase client + the signed-in `userId` (look for an existing `useAccountProfile` / auth-context hook in that file).

- [ ] **Step 2: Write the failing component test**

Create `src/auth/components/ApplePersonalTokensSection.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApplePersonalTokensSection } from './ApplePersonalTokensSection';
import * as tokens from '../personal-tokens';

vi.mock('../personal-tokens', async (orig) => {
  const actual = await orig<typeof import('../personal-tokens')>();
  return { ...actual, createToken: vi.fn(), listTokens: vi.fn(), revokeToken: vi.fn() };
});

const client = {} as never;

beforeEach(() => {
  vi.mocked(tokens.listTokens).mockResolvedValue([]);
  vi.mocked(tokens.createToken).mockResolvedValue('psalms_pat_RAWVALUE123');
  vi.mocked(tokens.revokeToken).mockResolvedValue();
});

describe('ApplePersonalTokensSection', () => {
  it('reveals the raw token once after generating', async () => {
    render(<ApplePersonalTokensSection client={client} userId="u-1" />);
    await userEvent.click(screen.getByRole('button', { name: /generate token/i }));
    await waitFor(() => expect(screen.getByText('psalms_pat_RAWVALUE123')).toBeInTheDocument());
    expect(tokens.createToken).toHaveBeenCalledWith(client, 'u-1', expect.any(String));
  });

  it('lists existing tokens and revokes one', async () => {
    vi.mocked(tokens.listTokens).mockResolvedValue([
      { id: 't1', name: 'Apple Notes Shortcut', lastUsedAt: null, createdAt: '2026-06-11T00:00:00Z' },
    ]);
    render(<ApplePersonalTokensSection client={client} userId="u-1" />);
    await waitFor(() => expect(screen.getByText('Apple Notes Shortcut')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /revoke/i }));
    expect(tokens.revokeToken).toHaveBeenCalledWith(client, 't1');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/auth/components/ApplePersonalTokensSection.test.tsx`
Expected: FAIL — cannot resolve `./ApplePersonalTokensSection`.

- [ ] **Step 4: Write the component**

Create `src/auth/components/ApplePersonalTokensSection.tsx`:

```tsx
// src/auth/components/ApplePersonalTokensSection.tsx
import { useEffect, useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createToken, listTokens, revokeToken, type PersonalToken,
} from '../personal-tokens';

const IMPORT_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/import-apple-note`;

interface Props {
  client: SupabaseClient;
  userId: string;
}

export function ApplePersonalTokensSection({ client, userId }: Props) {
  const [list, setList] = useState<PersonalToken[]>([]);
  const [raw, setRaw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try { setList(await listTokens(client)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load tokens'); }
  }, [client]);

  useEffect(() => { void refresh(); }, [refresh]);

  const onGenerate = async () => {
    setBusy(true); setError(null);
    try {
      const token = await createToken(client, userId, 'Apple Notes Shortcut');
      setRaw(token);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create token');
    } finally { setBusy(false); }
  };

  const onRevoke = async (id: string) => {
    setBusy(true); setError(null);
    try { await revokeToken(client, id); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to revoke token'); }
    finally { setBusy(false); }
  };

  return (
    <section aria-labelledby="apple-notes-heading">
      <h3 id="apple-notes-heading">Connect Apple Notes</h3>
      <p>
        Generate a token, then install the Apple Notes import Shortcut and paste the
        token plus this endpoint into it:
      </p>
      <code>{IMPORT_ENDPOINT}</code>

      <button type="button" onClick={onGenerate} disabled={busy}>Generate token</button>

      {raw && (
        <div role="status">
          <p><strong>Copy this token now — you won’t see it again.</strong></p>
          <code>{raw}</code>
          <button type="button" onClick={() => navigator.clipboard?.writeText(raw)}>Copy</button>
        </div>
      )}

      {error && <p role="alert">{error}</p>}

      <ul>
        {list.map((t) => (
          <li key={t.id}>
            <span>{t.name}</span>
            <span>{t.lastUsedAt ? `last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : 'never used'}</span>
            <button type="button" onClick={() => onRevoke(t.id)} disabled={busy}>Revoke</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/auth/components/ApplePersonalTokensSection.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Mount the panel in the settings parent**

In the parent file found in Step 1, import and render the panel directly below `<LamplightSettingsSection ... />`, passing the Supabase client and signed-in `userId` the same way that file already obtains them. Example shape (adapt prop sources to that file):

```tsx
import { ApplePersonalTokensSection } from './ApplePersonalTokensSection';
// ...
<LamplightSettingsSection /* existing props */ />
<ApplePersonalTokensSection client={supabaseClient} userId={profile.id} />
```

- [ ] **Step 7: Verify the app builds**

Run: `npm run build`
Expected: `tsc -b` and `vite build` succeed with no new errors (compare against the known pre-existing baseline — this change must add zero new errors).

- [ ] **Step 8: Commit**

```bash
git add src/auth/components/ApplePersonalTokensSection.tsx src/auth/components/ApplePersonalTokensSection.test.tsx <settings-parent-file>
git commit -m "feat(apple-notes): Connect Apple Notes settings panel"
```

---

### Task 9: Shortcut recipe + deployment runbook

**Files:**
- Create: `docs/runbooks/apple-notes-import.md`

- [ ] **Step 1: Write the runbook**

Create `docs/runbooks/apple-notes-import.md`:

```markdown
# Apple Notes Import — Runbook

Lets users bring their Apple Notes into the Psalms notepad via an Apple Shortcut
that POSTs each note to the `import-apple-note` edge function, authenticated by a
personal access token (PAT).

## User setup
1. In Psalms → Settings → **Connect Apple Notes**, tap **Generate token** and
   copy the `psalms_pat_…` value (shown once).
2. Install the Psalms "Import Apple Notes" Shortcut (link distributed separately).
3. On first run the Shortcut prompts for the token and stores it; paste the value.

## Shortcut recipe (build once, distribute as an iCloud link)
1. **Text** action → the import endpoint:
   `https://<project-ref>.functions.supabase.co/import-apple-note`
   (or `${VITE_SUPABASE_URL}/functions/v1/import-apple-note`).
2. **Find Notes** → filter to a folder the user picks (use "Ask Each Time" for the folder).
3. **Repeat with Each** (the found notes):
   - **Get Details of Notes** → Name → set variable `noteTitle`.
   - **Get Details of Notes** → Body → **Get Text from Input** → variable `noteText`.
   - **Get Details of Notes** → Creation Date → **Format Date** (ISO 8601) → `createdAt`.
   - **Get Details of Notes** → Modification Date → **Format Date** (ISO 8601) → `modifiedAt`.
   - **Get Contents of URL**:
     - Method: `POST`
     - Headers: `Authorization: Bearer <stored token>`, `Content-Type: application/json`
     - Request Body: JSON →
       `{ "title": noteTitle, "text": noteText, "created_at": createdAt, "modified_at": modifiedAt, "folder_name": "<picked folder name>" }`
4. (Optional) Show a final count of created/updated/unchanged responses.

The endpoint returns `{ status: "created" | "updated" | "unchanged", note_id }` per note.

## Behaviour
- Imported notes land in an auto-created **Apple Notes** folder (a named subfolder
  when `folder_name` is sent), with `type = general`.
- Dedup key = SHA-256 of `creation-date|title`. Re-running is safe: a note is only
  rewritten when its Apple modification date is newer than the last import.
- Rate limit: 600 requests/hour per token (HTTP 429 beyond that).

## Deployment (run by a maintainer)
1. Apply the migration (NOT in CI — manual):
   `supabase db push` (against the linked project).
2. Deploy the function (NOT carried by a frontend/Vercel deploy):
   `supabase functions deploy import-apple-note --use-api`
3. Confirm `config.toml` pushed `verify_jwt = false` for `import-apple-note`.
   **Review the push diff** — a config push can clobber the whole `[auth]` block.
4. Ensure `ALLOWED_ORIGINS` is unchanged (CORS is irrelevant to the Shortcut, but
   the shared helper still reads it).

## Revocation
Settings → Connect Apple Notes → **Revoke** sets `revoked_at`; the next Shortcut
run gets HTTP 401.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/apple-notes-import.md
git commit -m "docs(apple-notes): import Shortcut recipe + deployment runbook"
```

---

### Task 10: Deploy + manual end-to-end verification

**Files:** none (operational).

- [ ] **Step 1: Full suite green**

Run: `npm test`
Expected: PASS with zero NEW failures vs. the known pre-existing baseline (2 pre-existing failing files are acceptable; this work must not add more).

- [ ] **Step 2: Apply the migration to the linked project**

Run: `supabase db push`
Expected: `028_apple_notes_import.sql` applies; re-run is a no-op (idempotent `if not exists`).

- [ ] **Step 3: Deploy the edge function**

Run: `supabase functions deploy import-apple-note --use-api`
Expected: deploy succeeds; review the `config.toml` push diff to confirm `verify_jwt = false` and that the `[auth]` block was not altered.

- [ ] **Step 4: Generate a token in the running app**

In Settings → Connect Apple Notes, generate a token and copy it.

- [ ] **Step 5: Smoke-test the endpoint with curl (stands in for the Shortcut)**

Run (substitute the project URL and token):
```bash
curl -sS -X POST "$VITE_SUPABASE_URL/functions/v1/import-apple-note" \
  -H "Authorization: Bearer psalms_pat_..." -H "Content-Type: application/json" \
  -d '{"title":"Psalm 23","text":"The Lord is my shepherd","created_at":"2026-05-01T12:00:00Z","modified_at":"2026-05-01T12:00:00Z","folder_name":"Sermons"}'
```
Expected: `{"status":"created","note_id":"..."}`. Re-run the exact command → `{"status":"unchanged",...}`. Re-run with a later `modified_at` → `{"status":"updated",...}`. Bad/removed token → HTTP 401.

- [ ] **Step 6: Verify in the app**

Open the notepad → confirm an **Apple Notes › Sermons** folder contains a "Psalm 23" note rendering the imported text.

- [ ] **Step 7: Real Shortcut run (final)**

Run the actual Apple Shortcut against a small Apple Notes folder on a device; confirm notes appear and a second run reports unchanged for untouched notes.

- [ ] **Step 8: Record completion**

No code commit. Update project memory / runbook if any operational step differed (e.g. token rotation, ALLOWED_ORIGINS).
```

---

## Notes for the implementer

- **Pre-existing baseline:** the repo ships with ~114 lint errors, 4 tsc errors (force-sphere.test.ts), and 2 failing test files unrelated to this work. Gate on "zero NEW errors," not a globally green repo.
- **Hash parity is load-bearing:** Tasks 2 and 7 both assert `hashToken('psalms-pat-known-answer') === 68aa6ef0…`. If you change the hashing in one tree, the other test must still pass or issued tokens won't validate.
- **Migrations and edge functions deploy manually** (Task 10) — they are not carried by a frontend deploy.
