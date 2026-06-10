# Standard Password Rules (Sign-up + Reset) — Design

**Date:** 2026-06-10
**Status:** Approved (pending spec review)

## Problem

Email/password sign-up only requires 6 characters (`minLength={6}` + a Supabase
error mapping). Add standard password-strength rules with live feedback, applied to
both sign-up and the password-reset page so a reset can't set a weaker password.

## Decisions (from brainstorming)

1. **Rules:** at least 8 characters AND at least one uppercase letter, one lowercase
   letter, one number, and one special character.
2. **Surfacing:** a live requirements checklist under the password field — each rule
   flips ✓ (met) / dim (unmet) as the user types; submit is blocked until all rules
   pass.
3. **Scope:** both the sign-up form (`AuthCard`) and the reset page
   (`UpdatePasswordPage`), via a shared validator.

## Current state (for reference)

- `AuthCard.tsx`: signup password `<input minLength={6}>`; the confirm field + a live
  "Passwords match" indicator already reveal when `mode === 'signup' &&
  password.length > 0`; the submit button's `disabled`/`opacity` already OR a
  signup-only clause `(!agreedToTerms || password !== confirmPassword)`. `mapAuthError`
  maps Supabase `'password should be at least'` → `'Password must be at least 6
  characters.'`.
- `UpdatePasswordPage.tsx`: `password` + `confirm` state, `handleSubmit` checks
  `password !== confirm` then `session.updatePassword(password)`; two `<input
  minLength={6}>`. No test file.
- `username-rules.ts` is the established pattern for a pure rules module.

## Architecture

### Unit 1 — `src/auth/password-rules.ts` (pure)

```ts
export interface PasswordRule { id: string; label: string; test: (pw: string) => boolean; }
export interface PasswordRuleResult { id: string; label: string; met: boolean; }

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= PASSWORD_MIN_LENGTH },
  { id: 'upper',  label: 'An uppercase letter',   test: (pw) => /[A-Z]/.test(pw) },
  { id: 'lower',  label: 'A lowercase letter',    test: (pw) => /[a-z]/.test(pw) },
  { id: 'number', label: 'A number',              test: (pw) => /[0-9]/.test(pw) },
  { id: 'symbol', label: 'A special character',   test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export function evaluatePassword(pw: string): PasswordRuleResult[] {
  return PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, met: r.test(pw) }));
}
export function isPasswordValid(pw: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(pw));
}
```

### Unit 2 — `src/auth/PasswordChecklist.tsx` (presentational)

Props: `{ password: string }`. Renders `evaluatePassword(password)` as a compact list;
each row shows a marker (✓ when `met`, in `#27ae60`; a dim `○`/✗ when not, in
`var(--silica)`) + the rule `label`. Uses the form's font tokens (`Outfit`, small
text). No state. Each row has a stable `key={r.id}`. (Tip for testability: give each
row a `data-met={r.met}` attribute.)

### Unit 3 — Sign-up (`AuthCard.tsx`)

- Import `isPasswordValid` and `PasswordChecklist`.
- Add `const passwordValid = isPasswordValid(password);` near the other derived
  values.
- Render `<PasswordChecklist password={password} />` directly under the password
  `<input>`, gated by `mode === 'signup' && password.length > 0` (same trigger as the
  confirm reveal).
- Bump the password input `minLength={6}` → `minLength={8}`.
- Extend the submit `disabled` and `opacity` signup clause to also require
  `passwordValid`:
  `(!agreedToTerms || password !== confirmPassword || !passwordValid)`.
- Add a submit-time guard in `handleSubmit` (signup branch, before `signUp`, after the
  match check): `if (!isPasswordValid(password)) { setError('Password doesn’t meet the
  requirements.'); setLoading(false); return; }`.
- Update the `mapAuthError` signup line `'Password must be at least 6 characters.'` →
  `'Password must be at least 8 characters.'`.

### Unit 4 — Reset (`UpdatePasswordPage.tsx`)

- Import `isPasswordValid` and `PasswordChecklist`.
- Render `<PasswordChecklist password={password} />` under the new-password input
  (when `password.length > 0`).
- Bump both `minLength={6}` → `minLength={8}`.
- In `handleSubmit`, after the `password !== confirm` check and before
  `updatePassword`, add: `if (!isPasswordValid(password)) { setError('Password doesn’t
  meet the requirements.'); return; }`. (Optionally also disable the submit button
  when `!isPasswordValid(password)`, consistent with sign-up.)

## Testing

- **`password-rules.test.ts`:** `isPasswordValid('Secret1!')` true; invalids each miss
  exactly one class — `'secret1!'` (no upper), `'SECRET1!'` (no lower), `'Secrettt!'`
  (no number), `'Secret11'` (no symbol), `'Sec1!'` (too short). `evaluatePassword`
  returns the right `met` flags for a mixed sample.
- **`PasswordChecklist.test.tsx`** (jsdom): for `password="Secret1!"` all five rows are
  met; for `password="abc"` the length/upper/number/symbol rows are unmet and the
  lower row is met (assert via `data-met`).
- **`AuthCard.test.tsx`:** add a test that a weak password (e.g. `secret1`) keeps
  "Create Account" disabled; update the existing submit/enable tests that use
  `secret1` to a compliant password `Secret1!` (both password and confirm) so they
  still exercise the match + submit path. (The reveal/mismatch tests that don't enable
  the button can keep their current values.)
- **`UpdatePasswordPage.test.tsx`** (new, jsdom; mock `useAuthSession`/router as the
  other auth tests do): a weak password shows the requirements error / blocks
  `updatePassword`; a compliant matching password calls `session.updatePassword`.
- Lint only the touched files.

## Out of scope

- A password strength *meter* (bars/score) — the checklist is the chosen surfacing.
- Changing the Supabase server-side password policy.
- Breach/HIBP checks, passphrase rules, or disallowed-common-password lists.
- Applying rules to OAuth (Google/Apple) — they don't set a password here.
