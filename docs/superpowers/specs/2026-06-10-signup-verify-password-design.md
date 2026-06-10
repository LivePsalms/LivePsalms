# Sign-up Verify-Password Field — Design

**Date:** 2026-06-10
**Status:** Approved (pending spec review)

## Problem

The sign-up form has a single password field, so a typo in the password isn't
caught until the user can't log in. Add a "Verify Password" (confirm) field to the
sign-up flow that animates in once the user starts typing the password, with live
match feedback and submission blocked until the two match.

## Decisions (from brainstorming)

1. **Animation:** subtle slide-down + fade via framer-motion `AnimatePresence`
   (~0.25s ease). Reveals the moment the password has any character; collapses if the
   password is cleared. Honors `prefers-reduced-motion`.
2. **Validation:** live "✓ Passwords match" / "Passwords don't match" indicator, and
   the "Create Account" button stays disabled (plus a submit-time guard) until they
   match.
3. **Scope:** sign-up only. Login and reset modes are unchanged. No new component file
   — a localized addition to `AuthCard`.

## Current state (for reference)

- `src/auth/AuthCard.tsx` is the shared sign-in / sign-up / reset card. `mode:
  'login' | 'signup' | 'reset'`. State includes `email`, `password`, `fullName`,
  `agreedToTerms`, `error`, `loading`, `success`. `handleSubmit` branches on mode;
  the signup branch validates `fullName` and `agreedToTerms`, then `await
  session.signUp(email, password, fullName)`.
- The Password `<input>` (lines ~214–230) renders for `mode !== 'reset'`.
- The submit button is `disabled={loading || (mode === 'signup' && !agreedToTerms)}`
  with a matching `opacity` expression.
- `framer-motion` (v12) is already a dependency, used elsewhere (e.g.
  `MobileFabMenu`, `SplitTransition`). It is never mocked in existing tests.

## Architecture (all in `AuthCard.tsx`)

### State + derived values

- Add `const [confirmPassword, setConfirmPassword] = useState('');`.
- Add `import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';`.
- `const reduce = useReducedMotion();`
- `const showConfirm = mode === 'signup' && password.length > 0;`
- `const passwordsMatch = password === confirmPassword;`

### The animated confirm field

Insert immediately after the Password `<input>` block, inside the `<form>`:
```tsx
<AnimatePresence initial={false}>
  {showConfirm && (
    <motion.div
      key="confirm-password"
      style={{ overflow: 'hidden' }}
      initial={{ height: 0, opacity: 0, y: -8 }}
      animate={{ height: 'auto', opacity: 1, y: 0 }}
      exit={{ height: 0, opacity: 0, y: -8 }}
      transition={{ duration: reduce ? 0 : 0.25, ease: 'easeOut' }}
    >
      <input
        type="password"
        placeholder="Verify Password"
        aria-label="Verify Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        minLength={6}
        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
        style={{ /* same tokens as the Password input */ }}
      />
      {confirmPassword.length > 0 && (
        <p
          aria-live="polite"
          className="text-xs mt-1.5"
          style={{
            color: passwordsMatch ? '#27ae60' : '#c0392b',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          {passwordsMatch ? '✓ Passwords match' : 'Passwords don’t match'}
        </p>
      )}
    </motion.div>
  )}
</AnimatePresence>
```

### Clearing behavior

- The Password input's `onChange` also clears the confirm when the password is
  emptied, so a stale confirm value can't block a hidden field:
  `onChange={(e) => { setPassword(e.target.value); if (e.target.value === '')
  setConfirmPassword(''); }}`.

### Validation / block submit

- In `handleSubmit`, signup branch, after the `agreedToTerms` check and before
  `signUp`:
  ```tsx
  if (password !== confirmPassword) {
    setError('Passwords don’t match.');
    setLoading(false);
    return;
  }
  ```
- Submit button disabled + opacity gain `|| (mode === 'signup' && password !==
  confirmPassword)`:
  ```tsx
  disabled={loading || (mode === 'signup' && (!agreedToTerms || password !== confirmPassword))}
  ```
  (and the same boolean in the `opacity` style expression).

### Mode-switch resets

- Add `setConfirmPassword('')` everywhere the existing handlers reset
  `agreedToTerms` / `error` on a mode change: the sign-up↔sign-in toggle, the
  "Forgot password?" handler, and "← Back to sign in". So the confirm value never
  lingers across modes.

## Testing

Create `src/auth/AuthCard.test.tsx` (jsdom). Mock framer-motion so children render
synchronously (no exit-timing flakiness) and mock `useAuthSession`; wrap in
`MemoryRouter` for the Terms `<Link>`:
```tsx
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, initial, animate, exit, transition, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
      <div {...rest}>{children}</div>,
  },
  useReducedMotion: () => false,
}));
```
Cases (switch to signup mode via the "Sign up" toggle first):
- The "Verify Password" field is NOT present before the password has any text.
- Typing into the Password field reveals the "Verify Password" field.
- A non-matching confirm shows "Passwords don't match" and the "Create Account"
  button is disabled.
- A matching confirm shows "✓ Passwords match", enables "Create Account", and
  submitting calls `session.signUp` with `(email, password, fullName)` (after the
  Terms checkbox is checked and full name filled).
- In login mode, typing a password never reveals a confirm field.

Lint only the touched files.

## Out of scope

- Password strength meters, show/hide-password toggles, or changing the 6-char
  minimum.
- Any change to login or reset flows, OAuth buttons, or `session.signUp` itself.
- A reusable PasswordField component (localized addition only).
