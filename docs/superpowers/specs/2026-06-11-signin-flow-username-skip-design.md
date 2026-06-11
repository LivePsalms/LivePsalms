# "Go to sign in" fix + skippable username — Design

**Date:** 2026-06-11
**Status:** Approved (design)

## Problem

Two issues in the notes/Lamplight auth flow:

1. **"Go to sign in" returns to a populated sign-up form.** After a user signs up,
   `AuthCard` swaps to the inline `VerifyEmailNotice` ("Check your email"). Its
   "← Back to sign in" button calls `onBack`, which today is
   `() => setVerifyEmail(null)` ([AuthCard.tsx:159](../../../src/auth/AuthCard.tsx#L159)).
   That only clears the verify state — `mode` is still `'signup'` and the email /
   password / full-name fields are still populated, so the user lands back on the
   filled-in **sign-up** form instead of the **sign-in** form they expected. After
   confirming their email in their inbox, they want to come back and just log in.

2. **Username is mandatory with no escape hatch.** A signed-in user without a
   username hits the `needs-username` gate
   ([username-gate.ts](../../../src/auth/username/username-gate.ts)) and must claim
   one via `UsernameSetup` before reaching the notepad. There is no way to defer the
   decision.

## Goals

- Clicking "go to sign in" from the verify-email screen opens the **sign-in** form,
  with the user's email prefilled and the password cleared.
- Keep username collection mandatory (users are always directed to pick one) but add
  a **"Skip for now"** button that generates a readable random username for them.
- The generated username is editable later in Settings (already supported).

## Non-goals

- No copy or visual redesign of the auth/username screens.
- No changes to the username gate logic itself.
- No new settings UI — username editing already exists via `ProfilePage` /
  `UsernameSection`.

## Part 1 — "Go to sign in" opens the sign-in form

**File:** `src/auth/AuthCard.tsx`

Replace the inline `onBack={() => setVerifyEmail(null)}` with a handler that returns
the card to the **sign-in** state:

- `setVerifyEmail(null)` — leave the verify notice
- `setMode('login')` — show the sign-in form
- **Keep `email`** (it is the address they just signed up with → prefilled)
- Clear `password`, `confirmPassword`, `fullName`
- Reset `agreedToTerms` to `false`
- Clear `error` and `success`

Result: after confirming in their inbox, "go to sign in" lands them on the sign-in
form with their email already filled — they only type their password.

No other component changes. `VerifyEmailNotice` keeps its `onBack` prop contract; only
the handler AuthCard passes in changes.

## Part 2 — Skippable username with a readable random fallback

### New module: `src/auth/username/username-generate.ts`

A pure function `generateUsername(): string` that returns a readable name shaped like
`quiet_psalm_4821`:

- `<adjective>_<noun>_<digits>` where the adjective/noun come from small curated word
  lists in the app's contemplative voice, and digits is a 3–4 digit number.
- Every generated name is **guaranteed** to satisfy `validateUsername`
  ([username-rules.ts](../../../src/auth/username/username-rules.ts)): length 3–30,
  charset `[a-z0-9_]`, and not in `RESERVED_USERNAMES`. Word lists are authored to
  avoid reserved words.
- Pure (uses `Math.random()` only) → unit-testable.

### `UsernameSetup` (presentational) — `src/auth/username/UsernameSetup.tsx`

- Add an optional `onSkip?: () => void | Promise<void>` prop.
- Render a secondary **"Skip for now"** button beneath "Claim username".
- The skip button is disabled while `submitting` is true (shared with the claim
  flow), and triggers `onSkip`.
- Component stays presentational — it does not generate names or call the API itself.

### `UsernameClaim` (wiring) — `src/auth/username/UsernameClaim.tsx`

Implement `onSkip`:

1. Generate a candidate via `generateUsername()`.
2. Call `account.setUsername(candidate)`.
3. On `{ ok: false, reason: 'taken' }`, regenerate and retry — up to ~5 attempts.
   (On `reason: 'invalid'`, treat as a bug and surface a generic error; should not
   happen given the generator's guarantees.)
4. On success, `navigate(`/notepad/u/${username}`, { replace: true })` (same target as
   `onClaimed`) **and** fire a toast via `sonner`:
   *"We picked @{username} for you — change it anytime in Settings."*

This also covers OAuth (Google / Apple) sign-ups, since those users reach the same
`needs-username` gate.

## Testing (TDD)

- `username-generate.test.ts`
  - Generated names always satisfy `validateUsername`.
  - Names match the expected `adj_noun_digits` shape.
  - Successive calls produce variety (not a constant).
- `UsernameSetup`
  - "Skip for now" button renders and calls `onSkip` when clicked.
  - Skip button is disabled while submitting.
- `UsernameClaim` skip wiring
  - Collision-then-success: first `setUsername` returns `taken`, retry succeeds,
    navigation + toast fire with the final username.
- `AuthCard` "go to sign in" (if a testing seam exists)
  - After clicking back from the verify notice: `mode` is `login`, `email` retained,
    `password` cleared.

## Affected files

- `src/auth/AuthCard.tsx` — change the `onBack` handler.
- `src/auth/username/username-generate.ts` — new pure generator.
- `src/auth/username/UsernameSetup.tsx` — add `onSkip` prop + skip button.
- `src/auth/username/UsernameClaim.tsx` — implement skip (generate + retry + toast).
- Test files for the above.
