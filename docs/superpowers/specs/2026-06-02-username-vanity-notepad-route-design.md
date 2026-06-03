# Username + Private Vanity Notepad Route — Design

**Date:** 2026-06-02
**Status:** Approved (design); ready for implementation planning
**Scope:** Phase A + B (username system + private vanity route). Phase C (per-note public share links) is deferred to a later spec.

## Problem

Today every signed-in user shares the same notepad URL (`/notepad/notes`). We want each user to have a unique, personalized notepad address (`/notepad/u/<username>`) as a foundation for future note sharing. The address is a **private vanity URL**: only the owner (signed in) can reach it. Actual note sharing (public links) is a later phase that this work sets up but does not build.

## Goals

- Users pick a **unique username** (DB-enforced) the first time they visit the notepad.
- Existing signed-in users (no username yet) are prompted to pick one on their next visit.
- The notepad editor lives at `/notepad/u/<username>` and is owner-only.
- `/notepad/notes` and the post-OAuth redirect resolve to the user's username route.
- Live "as-you-type" availability feedback in the picker.

## Non-Goals (deferred to Phase C)

- Public/read-only note views.
- Share tokens, share-management UI, share tables.
- Any unauthenticated access to notepad content.

## Existing architecture (context)

- **Router:** React Router DOM v7. Routes in `src/App.tsx`. Notepad at `/notepad` (landing) and `/notepad/notes` (editor).
- **Auth:** Supabase Auth. User identified by `session.user.id` (UUID). Accessed via `useAuthSession()` (`src/auth/session/auth-session.ts`).
- **Profiles:** `profiles` table (`src/auth/profile/account-profile.ts`): `id` (PK = auth user id), `full_name`, `date_of_birth`, `avatar_url`, `note_count`, `highest_note_count`, `created_at`, `updated_at`.
- **Notes:** Supabase `notes` table, scoped per-user by RLS (`src/notepad/storage/supabase-adapter.ts`).
- **OAuth redirect:** Hardcoded to `${window.location.origin}/notepad/notes` in `auth-session.ts` (~lines 125–126, 136–137).

## Decisions (locked)

| Topic | Decision |
|---|---|
| Core intent | Personal workspace URL **and** per-note share links; sharing deferred. |
| Workspace URL purpose | **Private vanity address** — owner-only, not viewable by others. |
| URL identifier | A **chosen unique username** (not UUID/auto-slug). |
| When picked | **First notepad visit** (one-time); existing users prompted next visit. |
| Uniqueness | Enforced at the DB; if taken, user must choose another. |
| Route shape | `/notepad/u/<username>` becomes the **home**; `/notepad/notes` redirects there. |
| Availability check | **Live, as-you-type** via a `SECURITY DEFINER` RPC (Approach 2). |
| Mismatched username param | **Redirect to the owner's own URL** (not 404). |

## Design

### 1. Data model (Supabase)

Extend the existing `profiles` table — no new tables.

- Add column `username text` (nullable; existing rows stay null until the user picks).
- Case-insensitive uniqueness via a unique index on `lower(username)`:
  ```sql
  ALTER TABLE profiles ADD COLUMN username text;
  CREATE UNIQUE INDEX profiles_username_lower_idx ON profiles (lower(username));
  ```
- Availability RPC (returns only a boolean — never leaks who owns a name):
  ```sql
  CREATE OR REPLACE FUNCTION check_username_available(candidate text)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT NOT EXISTS (
      SELECT 1 FROM profiles WHERE lower(username) = lower(candidate)
    );
  $$;
  GRANT EXECUTE ON FUNCTION check_username_available(text) TO authenticated;
  ```
- Saving writes `username` on the user's own profile row (existing self-update RLS applies). The unique index is the hard backstop against simultaneous claims (Postgres error `23505`).

### 2. Username rules — pure `validateUsername(name): { valid: boolean, reason?: string }`

- Length 3–30 characters.
- Allowed characters: lowercase `a–z`, `0–9`, underscore `_`. Input is auto-lowercased before validation.
- Reserved words blocked (collide with route segments): `u`, `notes`, `note`, `shared`, `admin`, `api`, `settings`, `account`, `signin`, `signup`, `lamplight`.
- Returns a precise `reason` so the UI can show a specific message.
- Pure function, unit-tested in isolation.

### 3. Picker + guard

**`RequireUsername`** (wraps the notepad routes):
- Profile loading → spinner.
- Signed in, **no username** → render `<UsernameSetup>`.
- Signed in, **has username** → render the editor (`<Outlet/>`).

**`UsernameSetup`** (the one-time picker):
- Single input; auto-lowercases.
- Debounced (~300 ms) availability check calling `check_username_available` after typing stops.
- Visible states: *empty → invalid-format → checking… → ✓ available → ✗ taken*.
- Submit disabled unless `validateUsername` passes **and** availability is true.
- On submit: write username; on success → navigate to `/notepad/u/<username>`; on unique-violation race (`23505`) → set state to "✗ just taken, try another".

### 4. Routing

- **New:** `/notepad/u/:username` → guarded editor (canonical personal home).
- **Owner-only gate:** compare `:username` (case-insensitive) to the signed-in user's own username.
  - Match → render editor.
  - Mismatch → redirect to the user's own `/notepad/u/<their-username>`.
  - Signed in, no username → render picker.
  - Not signed in → existing sign-in flow.
- **`/notepad/notes`** → resolver redirect to `/notepad/u/<username>` (or picker if none). Preserves old links/bookmarks.
- **OAuth redirect:** updated so post-login flows through the resolver and lands on the username route (instead of the hardcoded `/notepad/notes`).

### 5. Error handling

- Availability RPC error / offline → **fail open** (allow submit); the submit-time unique constraint is the real guard.
- Submit race → caught `23505` → "just taken, try another."
- Existing users (null username) → guard routes them to the picker on next visit.
- Reserved/invalid input → blocked client-side by `validateUsername`.

### 6. Foundation for Phase C (deferred — not built now)

Establishing `username` and the `/notepad/u/<username>` namespace is what future per-note share links will hang off of. When Phase C is built, public share routes will live on a **separate top-level tree** (e.g. `/u/<username>/n/<token>`) to keep unauthenticated public access cleanly decoupled from the authenticated editor. No share tables or public routes are added in this phase.

## Components / units (designed for isolation)

| Unit | Responsibility | Depends on |
|---|---|---|
| `validateUsername(name)` | Pure format/length/reserved-word validation. | — |
| `checkUsernameAvailable(name)` | Wraps the `check_username_available` RPC. | Supabase client |
| `setUsername(name)` | Writes own profile username; maps `23505` → `{ error: 'taken' }`. | Supabase client |
| `useProfileUsername()` | Hook exposing `{ username, loading }` (extends profile fetch). | profile layer |
| `RequireUsername` | Route guard: picker vs editor vs spinner. | `useProfileUsername` |
| `UsernameSetup` | The picker UI + state machine. | the three functions above |
| Route resolvers/redirects | `/notepad/notes` → username route; owner-only gate. | router, profile |

## Testing strategy

- **Unit:** `validateUsername` — format, length boundaries (2/3/30/31), reserved words, uppercase normalization.
- **DB/RPC:** `check_username_available` returns correct boolean; unique index rejects duplicate (incl. case-variant) inserts.
- **Component:** `UsernameSetup` state machine — invalid → checking → available → taken → submit success → redirect; submit-time `23505` handling.
- **Guard/routing:** no-username → picker; mismatched `:username` → redirect to own; `/notepad/notes` → username route; signed-out → sign-in.

## Open questions

None at design approval. (Username rules and mismatch-redirect behavior confirmed.)
