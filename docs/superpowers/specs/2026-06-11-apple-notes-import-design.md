# Apple Notes Import via Apple Shortcut — Design

**Date:** 2026-06-11
**Status:** Approved (design); pending implementation plan
**Author:** brainstorming session

## Summary

Let users bring their Apple Notes into the Psalms notepad. Apple provides **no
public cloud API** for Notes, so a one-click OAuth integration is impossible.
The viable automated path is an **Apple Shortcut** the user installs once, which
reads a chosen Apple Notes folder and POSTs each note's plain text to a new
Psalms edge function. The function authenticates the request with a
**personal access token (PAT)** the user generates in Psalms, converts the text
to TipTap JSON, and upserts a note row scoped to that user.

This spec covers the first phase only. Image/attachment import, markdown
fidelity, a single-note Share Sheet shortcut, and true two-way sync are
explicitly out of scope (see [Out of Scope](#out-of-scope)).

## Decisions (locked during brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Auth | Personal access token | Supabase session JWTs expire (~1h); a PAT is long-lived, revocable, purpose-built for non-browser clients. |
| Content fidelity | Plain text → TipTap paragraphs | Shortcuts reliably exposes a note's plain text; the body is the value, styling rarely is. |
| Import scope | Bulk: one chosen Apple Notes folder per run | Supports the initial "bring my library over" moment. |
| Re-run behaviour | Upsert on `external_id`, with a modified-date guard | Apple Notes is the source of truth, but identical re-runs are no-ops and Psalms-side edits are not clobbered unless the Apple note actually changed. |

## Architecture & flow

```
Apple Notes (iOS/Mac)
   │  user runs Shortcut, picks a folder
   ▼
Apple Shortcut  ──POST──►  edge fn: import-apple-note  ──►  notes table
   per note:                 1. validate PAT (Bearer)        (upsert on
   { external_id,            2. resolve user_id               external_id)
     title, text,            3. text → TipTap JSON
     created_at,             4. upsert row for that user
     modified_at,            5. return {status, note_id}
     folder_name? }
```

- One HTTP POST **per note**. The Shortcut loops over the folder's notes and
  fires a request for each. The endpoint is stateless; deduplication lives in
  the database via a unique key.
- The Shortcut is intentionally "dumb": no token refresh, no batching, no
  retry orchestration. All correctness logic lives server-side.

## Data model changes

A single new migration (next number in `supabase/migrations/`, e.g.
`028_apple_notes_import.sql`).

### New table: `public.personal_access_tokens`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `user_id` | uuid | FK → `profiles(id)` on delete cascade |
| `token_hash` | text | SHA-256 hex of the raw token. **Raw token is never stored.** Unique. |
| `name` | text | User-facing label, e.g. "Apple Notes Shortcut" |
| `last_used_at` | timestamptz | nullable; stamped on each successful auth |
| `created_at` | timestamptz | default `now()` |
| `revoked_at` | timestamptz | nullable; non-null = revoked |

- **RLS:** a user may `select`/`insert`/`update` (revoke) only rows where
  `auth.uid() = user_id`. The edge function reads this table via the
  service-role client (PAT requests carry no Supabase JWT, so they cannot ride
  RLS).
- Raw token format: `psalms_pat_` + 32+ bytes of URL-safe random. Only the
  hash is persisted; the raw value is shown to the user exactly once.

### New columns on `public.notes`

| Column | Type | Notes |
|---|---|---|
| `source` | text | default `'app'`; imported rows = `'apple_notes'` |
| `external_id` | text | nullable; dedup hash (see below) |
| `apple_modified_at` | timestamptz | nullable; the Apple note's modification date at last import |

- Partial unique index:
  `create unique index ... on notes (user_id, external_id) where external_id is not null;`
  — enforces one row per (user, Apple note) without constraining
  app-created notes.
- `external_id` = `sha256(appleCreationDate_iso + "|" + title)`, hex-encoded.
  Shortcuts does not reliably expose a native note UUID, so this synthetic key
  is the dedup anchor. Title or creation-date changes in Apple Notes will
  produce a new row; this is an accepted limitation.

## Edge function: `import-apple-note`

Location: `supabase/functions/import-apple-note/index.ts`.
Config: `verify_jwt = false` in `supabase/config.toml` (PAT clients have no
Supabase JWT — auth is performed **manually inside the function**, following the
existing "never trust `body.user_id`" discipline used by `transcribe-note` and
`lamplight-generate`).

### Request

```
POST /functions/v1/import-apple-note
Authorization: Bearer psalms_pat_<token>
Content-Type: application/json

{
  "external_id": "<client may omit; server derives if absent>",
  "title": "Psalm 23 reflection",
  "text": "The Lord is my shepherd\n...",
  "created_at": "2026-05-01T12:00:00Z",
  "modified_at": "2026-06-10T09:30:00Z",
  "folder_name": "Sermons"        // optional
}
```

- Body validated with **Zod**. `text` capped at 100 KB; `title` capped at a
  sane length (e.g. 512 chars). Missing `title` defaults to `'Untitled'`.
- `external_id` is recomputed server-side from `created_at + title` regardless
  of what the client sends, so the client cannot spoof another note's identity.

### Behaviour

1. **Authenticate:** extract Bearer token → SHA-256 → look up a
   `personal_access_tokens` row with matching `token_hash` and
   `revoked_at IS NULL`. Miss → `401`. Hit → resolve `user_id`, stamp
   `last_used_at`.
2. **Rate limit:** cap requests per token (target: 600/hour) to bound a
   runaway Shortcut loop. Over limit → `429`.
3. **Convert:** `textToTipTap(text)` → stringified TipTap JSON; compute
   `word_count` via the existing `countWordsFromTipTapJSON`.
4. **Resolve folder:** find-or-create a folder named `'Apple Notes'` for this
   user; if `folder_name` is supplied, nest a subfolder under it. Imported note
   gets `type = 'general'`.
5. **Upsert** into `notes` via the **service-role client**, always scoped to the
   resolved `user_id`, on conflict `(user_id, external_id)`:
   - **Insert** when no existing row → `status: 'created'`.
   - **Update** `title`/`content`/`word_count`/`apple_modified_at` **only when**
     incoming `modified_at` > stored `apple_modified_at` → `status: 'updated'`.
   - Otherwise no write → `status: 'unchanged'`.
   This guard makes identical re-runs no-ops and avoids clobbering a Psalms-side
   edit unless the Apple note was genuinely modified afterward.
6. **Respond:** `200 { status: 'created' | 'updated' | 'unchanged', note_id }`.

### Errors

| Condition | Status |
|---|---|
| Missing/invalid/revoked token | 401 |
| Body fails Zod validation | 400 |
| Rate limit exceeded | 429 |
| Unexpected server error | 500 |

CORS is not a concern (the Shortcut is not a browser and sends no `Origin`
header), but the function still accepts only `POST`.

## Content conversion helper

`supabase/functions/_shared/text-to-tiptap.ts` exporting `textToTipTap(text)`:

- Split `text` on `\n`.
- Each non-empty line → a `{ type: 'paragraph', content: [{ type: 'text', text: line }] }` node.
- Blank lines → empty `{ type: 'paragraph' }` nodes (preserve spacing).
- Wrap in `{ type: 'doc', content: [...] }` and `JSON.stringify`.
- Empty input → a doc with a single empty paragraph (matches how the app
  represents an empty note).

Placed in `_shared/` so the edge function and any future importer reuse it.

## Token management UI

A **Settings → "Connect Apple Notes"** panel:

- **Generate token** button → calls a flow that creates a PAT, returns the raw
  `psalms_pat_…` value **once**, displayed with copy-to-clipboard and a clear
  "you won't see this again" warning. Only the hash is stored.
- **Active tokens list:** `name` + `last_used_at` + a **Revoke** action
  (sets `revoked_at`).
- **Setup instructions block:** a link to install the Shortcut and the endpoint
  URL, so the user can paste token + URL into the Shortcut.

Token creation/revocation happen through the user's authenticated Supabase
session (RLS-protected), not through the PAT endpoint.

## Security

PATs are high-value (long-lived, back service-role writes), so:

- Store only the SHA-256 hash; show the raw token exactly once; tokens are
  revocable and carry `last_used_at` for auditability.
- Rate-limit per token; Zod-validate the body; cap `text` size.
- Recompute `external_id` server-side; never trust a client-supplied `user_id`.
- Structured logging that **never** logs the token or note bodies.
- Service-role client writes are always explicitly scoped to the resolved
  `user_id`.

## Testing

**Unit**
- `textToTipTap`: single line, multiple lines, blank-line preservation, empty
  input, unicode.
- `external_id` hashing: stable for same input, differs on title/date change.
- Upsert-guard date logic: older/equal `modified_at` → no update; newer →
  update.

**Integration** (Deno tests against the function)
- Valid PAT → note created.
- Re-run identical note → `unchanged`, no duplicate row.
- Re-run with newer `modified_at` → `updated`.
- Revoked token → 401.
- Malformed body → 400.
- Cross-user isolation: token belonging to user A cannot write to user B.
- Rate limit triggers 429.

**Manual**
- One real Apple Shortcut run against a dev folder of a few notes; verify rows
  land in the "Apple Notes" folder and render in the notepad.

## Deployment notes

- New migration must be applied to Supabase manually (migrations are not in CI).
- The edge function deploys manually:
  `supabase functions deploy import-apple-note --use-api`
  (edge functions are **not** carried by a frontend/Vercel deploy).
- `config.toml` must pin `verify_jwt = false` for this function; review the push
  diff carefully (config pushes can clobber the whole `[auth]` block).

## Out of Scope

- Image / attachment import (needs storage upload + multipart Shortcut).
- Markdown / rich-formatting fidelity (headings, lists, bold).
- Single-note Share Sheet shortcut (a later convenience mode against the same
  endpoint).
- True two-way sync (Psalms → Apple Notes, or live propagation).
