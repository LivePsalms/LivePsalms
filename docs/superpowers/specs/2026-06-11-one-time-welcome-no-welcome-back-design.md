# One-time "Welcome" on the notes page, no "welcome back" ever

**Date:** 2026-06-11
**Status:** Approved (design)

## Problem

When a user first signs up and lands on `/notes/u/:username`, they see a **"Welcome Back, {name}"** toast — wrong for a first-time user, and it recurs on every return visit (once per day). The desired behavior: a single **"Welcome, {name}"** greeting shown exactly once at signup, and **no "welcome back" greeting ever**.

Today there are two greetings:
1. `/welcome` onboarding page shows `toast.success("Welcome, {name}!")` when the user enters their name ([WelcomePage.tsx:48](../../../src/auth/WelcomePage.tsx#L48)).
2. The notepad first-load logic fires a recurring per-day `toast.success("Welcome back, {name}!")` ([useNotepadFirstLoad.tsx:48](../../../src/notepad/first-load/useNotepadFirstLoad.tsx#L48), driven by the `greet` action in [notepad-first-load.ts:53](../../../src/notepad/first-load/notepad-first-load.ts#L53)).

A new email signup therefore sees "Welcome, X" on `/welcome` and then "Welcome back, X" on the notes page, then "Welcome back, X" again on later visits. OAuth (Google/Apple) signups can arrive with a provider-supplied name and skip `/welcome` entirely, so for them the notes-page toast is the only greeting they would ever get.

## Goals

- The notes page shows **"Welcome, {name}!"** exactly once — the first time a welcomed user arrives — and never again.
- The recurring "Welcome back" greeting is removed entirely.
- Uniform across signup methods (email and OAuth).

## Non-goals

- No server-side / DB flag. The "welcomed once" state is persisted per-account in `localStorage` (decision below). A new device or cleared storage may show the greeting once more — acceptable, it's cosmetic.
- No change to the migration-offer flow or the `/welcome` onboarding flow other than removing its toast.

## Decisions

- **Once-ever scope:** persist a per-account flag in `localStorage`, keyed by user id, no date.
- **/welcome toast:** removed — the notes page becomes the single source of the greeting (avoids email-signup users seeing "Welcome, X" twice).

## Design

### Logic — `src/notepad/first-load/notepad-first-load.ts`

- Rename the recurring `greet` action to a one-time `welcome` action: `{ kind: 'welcome'; firstName: string | null }`.
- Replace the input field `hasBeenGreetedToday: boolean` with `hasBeenWelcomedOnce: boolean`.
- Decision in `decideFirstLoadActions`:
  ```
  if (!hasBeenWelcomed)          → push { kind: 'redirect-welcome' }
  else if (!hasBeenWelcomedOnce) → push { kind: 'welcome', firstName: firstNameOf(user) }
  if (localNoteCount > 0)        → push { kind: 'offer-migration' }   // unchanged
  ```
- Replace the per-day storage helpers with per-account ones:
  - `welcomedOnceKey(userId: string): string` → `welcomed_once_${userId}`
  - `hasBeenWelcomedOnce(userId: string, storage: StorageLike): boolean`
  - `markWelcomedOnce(userId: string, storage: StorageLike): void`
  - Remove `greetedKey`, `hasBeenGreetedToday`, `markGreetedToday`, and `todayDateString`.
- `firstNameOf` and `StorageLike` stay (`firstNameOf` is used by `LamplightTabPanel` and `ConnectionCardsPanel` — untouched).

### Wiring — `src/notepad/first-load/useNotepadFirstLoad.tsx`

- Use `localStorage` (persists across sessions) instead of `sessionStorage`.
- Remove the `today` computation.
- Replace the `greet` case with:
  ```ts
  case 'welcome':
    markWelcomedOnce(user.id, localStorage);
    toast.success(`Welcome${action.firstName ? `, ${action.firstName}` : ''}!`);
    break;
  ```
- Pass `hasBeenWelcomedOnce: hasBeenWelcomedOnce(user.id, localStorage)` into `decideFirstLoadActions`.

### Onboarding page — `src/auth/WelcomePage.tsx`

- Remove the `toast.success(`Welcome, ${fullName.trim().split(' ')[0]}!`)` line (currently line 48). No replacement.

### Tests — `src/notepad/first-load/notepad-first-load.test.ts`

- Update imports/usages: `greet` → `welcome`, `hasBeenGreetedToday` → `hasBeenWelcomedOnce`, per-day helpers → per-account helpers.
- Drop the `todayDateString` describe block and the per-day scoping tests.
- Keep/adapt: `firstNameOf` tests (unchanged); gating tests (authLoading / null user / profileLoading) with the renamed field; "first sign-in (no welcomed flag) → redirect-welcome only"; "first sign-in with local notes → redirect-welcome + offer-migration".
- Add/adapt:
  - welcomed and not-welcomed-once → `[{ kind: 'welcome', firstName }]`.
  - welcomed and welcomed-once → `[]` (no greeting).
  - welcomed, not-welcomed-once, with local notes → `[{ kind: 'welcome', firstName }, { kind: 'offer-migration' }]`.
  - storage round-trip: `markWelcomedOnce` then `hasBeenWelcomedOnce` is true; scoped per-user (`u2` not satisfied by `u1`'s mark); `welcomedOnceKey` embeds the user id.

## Behavior matrix

| Scenario | redirect-welcome | welcome toast | later visits |
| --- | --- | --- | --- |
| Email signup (pre-onboarding) | yes | — (no toast on `/welcome`) | — |
| Email signup, returns from `/welcome` | — | "Welcome, X" once → flag set | silent |
| OAuth signup (name from provider, skips `/welcome`) | — | "Welcome, X" once → flag set | silent |
| Returning user (flag set) | — | — | silent |

## Files touched

- `src/notepad/first-load/notepad-first-load.ts`
- `src/notepad/first-load/useNotepadFirstLoad.tsx`
- `src/auth/WelcomePage.tsx`
- `src/notepad/first-load/notepad-first-load.test.ts`
