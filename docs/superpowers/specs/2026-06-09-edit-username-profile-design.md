# Edit Username in Profile Settings — Design

**Date:** 2026-06-09
**Status:** Approved (pending spec review)

## Problem

A user's username is claimed once during onboarding (the `UsernameClaim` gate) and
can never be changed afterward — it isn't even shown on the Profile page. Add an
editable username to Profile settings so users can see and change their handle, with
live availability feedback.

## Decisions (from brainstorming)

1. **Dedicated "USERNAME" section** on the Profile page (separate from the PROFILE
   name/DOB section, which saves via `updateProfile` — username saves via the
   different `setUsername` path with an availability check).
2. **Live availability check while typing**, reusing the existing debounced
   `useUsernameAvailability` hook (Checking… / Available / Taken / invalid).
3. Reuse the existing primitives (`useUsernameAvailability`, `normalizeUsername`,
   `validateUsername`, `account.checkUsernameAvailable`, `account.setUsername`); do
   NOT reuse the full-screen `UsernameSetup` claim component.

## Current state (for reference)

- `ProfilePage.tsx` (`src/auth/ProfilePage.tsx`): `const { profile, account } =
  useAccountProfile();`. It defines `sectionStyle`, `labelStyle`, `inputStyle` and
  renders sections (PROFILE name/DOB, `SecuritySection`, `LamplightSettingsSection`,
  ACCOUNT). `profile.username` is available but shown nowhere.
- `account` is an `AccountProfile` with:
  - `checkUsernameAvailable(name) => Promise<boolean>` (RPC `check_username_available`).
  - `setUsername(name) => Promise<UsernameClaimResult>` — updates `profiles.username`,
    maps a `23505` unique-violation to `{ ok: false, reason: 'taken' }`, and on success
    calls `fetchProfile(userId)` so the observable (`profile.username`) refreshes.
- `useUsernameAvailability({ checkAvailable, name, eligible, debounceMs }) =>
  { status, markTaken }`, `status: AvailabilityStatus` (`'idle' | 'checking' |
  'available' | 'taken'`). It only checks when `eligible` is true.
- `normalizeUsername`, `validateUsername` (returns `{ valid: boolean; reason?: string }`)
  from `src/auth/username/username-rules.ts`.
- `UsernameClaimResult` (from username-rules): `{ ok: true } | { ok: false; reason:
  'taken' | 'invalid' }`.
- Pattern: profile sub-sections (`SecuritySection`, `LamplightSettingsSection`) live
  in `src/auth/components/` and receive style tokens as props.

## Architecture

### Unit 1 — `UsernameSection` (new: `src/auth/components/UsernameSection.tsx`)

Self-contained profile sub-section. Props:
```ts
interface UsernameSectionProps {
  currentUsername: string | null;
  checkAvailable: (name: string) => Promise<boolean>;
  setUsername: (name: string) => Promise<UsernameClaimResult>;
  sectionStyle: CSSProperties;
  labelStyle: CSSProperties;
  inputStyle: CSSProperties;
}
```

Behavior:
- Local state: `value` (init `currentUsername ?? ''`), `submitting`, `submitError`.
- Derived: `normalized = normalizeUsername(value)`, `format = validateUsername(value)`,
  `unchanged = normalized === (currentUsername ?? '')`.
- `useUsernameAvailability({ checkAvailable, name: normalized, eligible: format.valid
  && !unchanged, debounceMs: 300 })`. The `!unchanged` gate means the user's own
  current name is never checked (it would read "Taken") — it shows "This is your
  current username" instead.
- Status line precedence: `unchanged` → "This is your current username"; `!format.valid`
  → `format.reason`; `availability === 'checking'` → "Checking…"; `'available'` →
  "Available"; `'taken'` → "Taken"; else nothing.
- `canSave = format.valid && !unchanged && availability === 'available' && !submitting`.
- `handleSave`: guard `canSave`; `setSubmitting(true)`; `const result = await
  setUsername(normalized)`; `setSubmitting(false)`; on `result.ok` →
  `toast.success('Username updated.')` (profile auto-refreshes via `fetchProfile`,
  so `currentUsername` prop updates and `unchanged` becomes true); on
  `reason === 'taken'` → `markTaken()` + `setSubmitError('That username was just
  taken. Try another.')`; else `setSubmitError('That username isn’t valid.')`.
- Renders a section using the passed style tokens: label "USERNAME", a one-line
  helper ("This is your notepad address"), the input (`autoCapitalize="none"`,
  `autoComplete="off"`, `spellCheck={false}`), the status / error line, and a Save
  button (`disabled={!canSave}`, text "Saving…" while submitting else "Save Username").

### Unit 2 — ProfilePage wiring (`src/auth/ProfilePage.tsx`)

Render `<UsernameSection ... />` as its own section immediately after the existing
"PROFILE" (name/DOB) section:
```tsx
<UsernameSection
  currentUsername={profile?.username ?? null}
  checkAvailable={account.checkUsernameAvailable}
  setUsername={account.setUsername}
  sectionStyle={sectionStyle}
  labelStyle={labelStyle}
  inputStyle={inputStyle}
/>
```

## Testing

- **`UsernameSection.test.tsx`** (jsdom), mocking `sonner`'s `toast`. The
  availability hook is debounced (`debounceMs: 300`) and timer-driven; the existing
  `UsernameSetup.test.tsx` already exercises it — mirror that approach (fake timers
  or a short debounce + `waitFor`). Cases:
  - Renders with the current username pre-filled in the input.
  - Save is disabled when the value is unchanged; status shows "This is your current
    username"; `setUsername` is never called.
  - Typing a different, valid, available name (`checkAvailable` resolves `true`):
    status becomes "Available", Save enables; clicking Save calls
    `setUsername(normalized)` and (on `{ok:true}`) toasts success.
  - A taken name (`checkAvailable` resolves `false`): status "Taken", Save disabled.
  - An invalid name (e.g. too short / bad chars per `validateUsername`): shows the
    format reason, Save disabled, no availability check.
  - `setUsername` resolving `{ ok: false, reason: 'taken' }` after Save: surfaces the
    inline "just taken" error and does not toast success.
- ProfilePage wiring is a single render addition — covered like the other sections,
  no separate ProfilePage integration test.
- Lint only the touched files.

## Out of scope

- Changing username validation rules, the availability RPC, or the onboarding
  `UsernameClaim` gate.
- Rate-limiting / cooldown on username changes, or redirecting old vanity URLs.
- Reserving / history of past usernames.
