# Welcome prompt recognizes existing profile

**Date:** 2026-05-22
**Status:** Design — awaiting approval

## Problem

After a user signs in to their notepad account, the app repeatedly redirects them to the Welcome screen and asks for name + date of birth, even when those fields are already saved in the `profiles` table.

The cause is that the "has this user been welcomed?" signal is stored client-side per device in `localStorage` (key `welcomed_<userId>`), independent of the actual profile data in the database. Any time that key is absent, the redirect fires — which means it fires on every new device, after clearing site data, in incognito sessions, after verifying a signup email in a different browser than the signin, and for any user who existed before this flow shipped.

Specifically:

- [src/notepad/first-load/useNotepadFirstLoad.tsx:34](../../../src/notepad/first-load/useNotepadFirstLoad.tsx#L34) passes `hasBeenWelcomed: hasBeenWelcomed(user.id, localStorage)` into `decideFirstLoadActions`.
- [src/notepad/first-load/notepad-first-load.ts:31-32](../../../src/notepad/first-load/notepad-first-load.ts#L31-L32) defines `hasBeenWelcomed` as `storage.getItem('welcomed_<userId>') !== null`.
- [src/notepad/first-load/notepad-first-load.ts:59-60](../../../src/notepad/first-load/notepad-first-load.ts#L59-L60) emits `redirect-welcome` whenever the flag is false.
- [src/auth/WelcomePage.tsx:37](../../../src/auth/WelcomePage.tsx#L37) writes the flag only when the user completes (or skips) the welcome form on that device.

Meanwhile the DB already knows the truth: [001_profiles.sql:4](../../../supabase/migrations/001_profiles.sql#L4) defines `full_name text not null`, and the signup trigger at [003_triggers.sql:5-9](../../../supabase/migrations/003_triggers.sql#L5-L9) populates `full_name` from `raw_user_meta_data->>'full_name'`, coalescing to an empty string when absent.

## Goal

Treat the `profiles.full_name` column as the source of truth for "this user has been welcomed." A signed-in user with a non-empty `full_name` should never see the Welcome screen again on any device.

DOB stays optional. The Welcome screen's own copy already says "(optional)" and "You can always add this later in your profile." Users with `full_name` set but `date_of_birth` null are considered welcomed; they can add DOB any time on the Profile page.

## Approach

Derive `hasBeenWelcomed` from the loaded profile rather than from `localStorage`. Wait for the profile fetch to complete before deciding, so we don't redirect during the load window and then bounce back.

### Source-of-truth rule

```
hasBeenWelcomed = !!profile.fullName.trim()
```

Note `.trim()` — the trigger coalesces missing metadata to `''`, so a falsy/empty check is required.

### Loading gate

`decideFirstLoadActions` already short-circuits while `authLoading` is true. We extend that gate with `profileLoading`:

- While `authLoading || profileLoading`, return `[]` (no actions yet).
- Once both settle, compute as today, using the DB-derived `hasBeenWelcomed`.

`profileLoading` is derived from `profileStatus === 'loading'` in the hook.

## Changes by file

### `src/notepad/first-load/notepad-first-load.ts`

- Delete the localStorage helpers: `welcomedKey`, `hasBeenWelcomed`, `markWelcomed`. No callers remain after the changes below.
- Keep `decideFirstLoadActions` and its `FirstLoadInput.hasBeenWelcomed: boolean` field — the function stays pure; only the caller-side derivation changes.
- Add `profileLoading: boolean` to `FirstLoadInput`. Update the guard at the top of `decideFirstLoadActions` from `if (authLoading || !user) return [];` to `if (authLoading || profileLoading || !user) return [];`.

### `src/notepad/first-load/useNotepadFirstLoad.tsx`

- Add `import { useAccountProfile } from '@/auth/context/useAccountProfile';`
- Remove `hasBeenWelcomed` from the import of `./notepad-first-load`.
- Call `const { profile, profileStatus } = useAccountProfile();` alongside the existing `useAuthSession` call.
- Inside the effect, replace the localStorage-derived value with:
  ```
  hasBeenWelcomed: !!profile?.fullName?.trim(),
  profileLoading: profileStatus === 'loading',
  ```
- Extend the effect's dependency array to include `profileStatus` and `profile?.fullName` so the effect re-runs once the profile finishes loading.

### `src/auth/WelcomePage.tsx`

- Remove the import of `markWelcomed`.
- Remove the `markUserWelcomed` helper function.
- In `handleContinue`, remove the `markUserWelcomed()` call. The subsequent `navigate('/notepad')` will re-enter `useNotepadFirstLoad`, which now reads the freshly-saved `fullName` from the refetched profile and skips the redirect.
- Remove the **Skip for now** button and its `handleSkip` handler. Under the new model, Skip without saving would leave `fullName` empty and bounce the user right back to `/welcome` — the button is dead UX. DOB remains optional within the Continue path: leaving the date input blank saves `null`.

### `src/notepad/first-load/notepad-first-load.test.ts`

- Delete the `hasBeenWelcomed / markWelcomed` describe block (the helpers no longer exist).
- Add `profileLoading: false` to every existing `decideFirstLoadActions` input.
- Add a new test: with `profileLoading: true` and otherwise valid inputs, the function returns `[]` regardless of `user`, `hasBeenWelcomed`, `hasBeenGreetedToday`, and `localNoteCount`.

## What does NOT change

- `profiles` schema and RLS policies.
- Auth / session flow, including OAuth providers.
- The greet and offer-migration paths inside `decideFirstLoadActions`.
- `ProfilePage`.
- The `greeted_<userId>_<date>` sessionStorage key (daily greeting is a separate signal).
- `AccountProfile` / `AuthSession` classes.

## Edge cases resolved

- **New device or browser:** DB has `full_name` → no welcome prompt.
- **Cleared cookies, incognito, reinstalled PWA:** same.
- **Signup email verified in a different browser than signin:** same.
- **Pre-existing users from before this flow shipped:** same.
- **OAuth signup where Google/Apple metadata lacks a name:** profile row exists with `full_name = ''` → welcome prompt shows once → user fills in name → saved to DB → no more prompts anywhere.
- **Profile still loading after sign-in:** `profileLoading: true` short-circuits → no spurious redirect.

## Risks and non-issues

- **Stale localStorage keys.** Old `welcomed_<userId>` entries linger in users' browsers. Harmless — nothing reads the key after this change. No cleanup pass required.
- **Empty-string vs null name.** Handled by `.trim()` in the derivation.
- **Profile in `'missing'` or `'error'` state.** The hook will treat these as "name empty" → redirects to `/welcome`. The page's `updateProfile` call uses `update` not `upsert`, which would fail with no row, but this scenario is orthogonal to the bug being fixed (it implies the signup trigger failed) and is out of scope.

## Acceptance criteria

1. Existing user with `full_name` set signs in on a fresh browser → goes straight to `/notepad`, no welcome prompt.
2. Same user clears site data and signs in again → goes straight to `/notepad`.
3. OAuth user whose provider returns no name (profile row has `full_name = ''`) → sees Welcome screen, fills in name, clicks Continue → lands on `/notepad`.
4. Same OAuth user signs in again on a second device → goes straight to `/notepad`.
5. Welcome screen no longer renders a "Skip for now" button.
6. Existing test suite passes after the test updates described above.

## Out of scope

- Cleaning up dead `welcomed_<userId>` keys from users' localStorage.
- Backfilling DOB for existing users.
- Reworking the OAuth metadata-to-profile mapping at the trigger level.
- Changing the "daily greet" sessionStorage signal.
