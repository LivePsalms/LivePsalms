# Sign-up Verify-Password Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Verify Password" field to the sign-up form that animates in once the user starts typing the password, with live match feedback and submission blocked until the passwords match.

**Architecture:** A localized addition to `src/auth/AuthCard.tsx` — new `confirmPassword` state, a framer-motion `AnimatePresence` reveal (signup-only, gated on `password.length > 0`), live match indicator, a submit-time guard, and an updated disabled condition. No new component file.

**Tech Stack:** React + TypeScript, framer-motion (already a dep), Vitest + @testing-library/react (jsdom), MemoryRouter.

**Spec:** `docs/superpowers/specs/2026-06-10-signup-verify-password-design.md`

---

## File Structure

- **Modify** `src/auth/AuthCard.tsx` — the shared sign-in/up card; all feature logic lives here.
- **Create** `src/auth/AuthCard.test.tsx` — behavior tests (framer-motion + useAuthSession mocked).

---

## Task 1: Verify-password field in `AuthCard`

**Files:**
- Modify: `src/auth/AuthCard.tsx`
- Test: `src/auth/AuthCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/auth/AuthCard.test.tsx`:

```tsx
// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      initial,
      animate,
      exit,
      transition,
      ...rest
    }: Record<string, unknown> & { children?: ReactNode }) => <div {...rest}>{children}</div>,
  },
  useReducedMotion: () => false,
}));

const signUp = vi.fn().mockResolvedValue(undefined);
const signIn = vi.fn().mockResolvedValue(undefined);
vi.mock('./context/useAuthSession', () => ({
  useAuthSession: () => ({
    session: {
      signUp,
      signIn,
      resetPassword: vi.fn(),
      signInWithGoogle: vi.fn(),
      signInWithApple: vi.fn(),
    },
  }),
}));

import { AuthCard } from './AuthCard';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderLogin() {
  render(
    <MemoryRouter>
      <AuthCard />
    </MemoryRouter>,
  );
}

function renderSignup() {
  renderLogin();
  fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));
}

describe('AuthCard verify-password', () => {
  it('does not show the verify field until the password has text', () => {
    renderSignup();
    expect(screen.queryByLabelText('Verify Password')).not.toBeInTheDocument();
  });

  it('reveals the verify field once the user types a password', () => {
    renderSignup();
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret1' } });
    expect(screen.getByLabelText('Verify Password')).toBeInTheDocument();
  });

  it('shows a mismatch message and disables Create Account when the passwords differ', () => {
    renderSignup();
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret1' } });
    fireEvent.change(screen.getByLabelText('Verify Password'), { target: { value: 'secret2' } });
    expect(screen.getByText(/passwords don.t match/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
  });

  it('enables Create Account on a match and submits with signUp', async () => {
    renderSignup();
    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: 'Sarah' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'sarah@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret1' } });
    fireEvent.change(screen.getByLabelText('Verify Password'), { target: { value: 'secret1' } });
    expect(screen.getByText(/passwords match/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox'));
    const submit = screen.getByRole('button', { name: /create account/i });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith('sarah@example.com', 'secret1', 'Sarah'),
    );
  });

  it('never shows the verify field in login mode', () => {
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret1' } });
    expect(screen.queryByLabelText('Verify Password')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/auth/AuthCard.test.tsx`
Expected: FAIL — there is no "Verify Password" field yet (`getByLabelText('Verify Password')` not found), so the reveal/mismatch/match tests fail.

- [ ] **Step 3: Add the framer-motion import**

In `src/auth/AuthCard.tsx`, after the existing import block (the three top imports), add a fourth import line so the top reads:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthSession } from './context/useAuthSession';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
```

- [ ] **Step 4: Add `confirmPassword` state**

Immediately after `const [password, setPassword] = useState('');`, add:

```tsx
  const [confirmPassword, setConfirmPassword] = useState('');
```

- [ ] **Step 5: Add the submit-time guard**

In `handleSubmit`, in the signup branch, insert the match guard between the
`agreedToTerms` check and the `signUp` call. Change:

```tsx
        if (!agreedToTerms) {
          setError('Please agree to the Terms of Service to continue.');
          setLoading(false);
          return;
        }
        await session.signUp(email, password, fullName);
```

to:

```tsx
        if (!agreedToTerms) {
          setError('Please agree to the Terms of Service to continue.');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords don’t match.');
          setLoading(false);
          return;
        }
        await session.signUp(email, password, fullName);
```

- [ ] **Step 6: Add derived values before the return**

Find the start of the JSX return:

```tsx
  return (
    <div
      className="w-full max-w-sm rounded-xl p-8"
```

and insert the derived values just above it:

```tsx
  const reduce = useReducedMotion();
  const showConfirm = mode === 'signup' && password.length > 0;
  const passwordsMatch = password === confirmPassword;

  return (
    <div
      className="w-full max-w-sm rounded-xl p-8"
```

- [ ] **Step 7: Update the Password input and add the animated verify field**

Replace the entire Password input block:

```tsx
        {mode !== 'reset' && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{
              border: '1px solid var(--pale-stone)',
              background: 'var(--plaster)',
              fontFamily: 'Outfit, sans-serif',
              color: 'var(--deep-umber)',
            }}
          />
        )}
```

with (changes the password `onChange` to clear the confirm when emptied, then adds the `AnimatePresence` reveal):

```tsx
        {mode !== 'reset' && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (e.target.value === '') setConfirmPassword('');
            }}
            required
            minLength={6}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{
              border: '1px solid var(--pale-stone)',
              background: 'var(--plaster)',
              fontFamily: 'Outfit, sans-serif',
              color: 'var(--deep-umber)',
            }}
          />
        )}

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
                style={{
                  border: '1px solid var(--pale-stone)',
                  background: 'var(--plaster)',
                  fontFamily: 'Outfit, sans-serif',
                  color: 'var(--deep-umber)',
                }}
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

- [ ] **Step 8: Block submit via the disabled + opacity conditions**

In the submit `<button>`, replace the `disabled` expression:

```tsx
          disabled={loading || (mode === 'signup' && !agreedToTerms)}
```

with:

```tsx
          disabled={loading || (mode === 'signup' && (!agreedToTerms || password !== confirmPassword))}
```

and replace the `opacity` line inside its `style`:

```tsx
            opacity: loading || (mode === 'signup' && !agreedToTerms) ? 0.6 : 1,
```

with:

```tsx
            opacity: loading || (mode === 'signup' && (!agreedToTerms || password !== confirmPassword)) ? 0.6 : 1,
```

- [ ] **Step 9: Reset `confirmPassword` on every mode switch**

There are three handlers that reset state on a mode change. Add
`setConfirmPassword('');` to each.

(a) The "Forgot password?" button — change:

```tsx
            onClick={() => {
              setMode('reset');
              setError(null);
              setSuccess(null);
            }}
```

to:

```tsx
            onClick={() => {
              setMode('reset');
              setError(null);
              setSuccess(null);
              setConfirmPassword('');
            }}
```

(b) The "← Back to sign in" button — change:

```tsx
            onClick={() => {
              setMode('login');
              setError(null);
              setSuccess(null);
            }}
```

to:

```tsx
            onClick={() => {
              setMode('login');
              setError(null);
              setSuccess(null);
              setConfirmPassword('');
            }}
```

(c) The sign-up ↔ sign-in toggle — change:

```tsx
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
              setSuccess(null);
              setAgreedToTerms(false);
            }}
```

to:

```tsx
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
              setSuccess(null);
              setAgreedToTerms(false);
              setConfirmPassword('');
            }}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run src/auth/AuthCard.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 11: Commit**

```bash
git add src/auth/AuthCard.tsx src/auth/AuthCard.test.tsx
git commit -m "feat(auth): animated verify-password field on sign up with live match check"
```

---

## Task 2: Verify, lint, finalize

**Files:** none modified (verification only).

- [ ] **Step 1: Run the full auth suite**

Run: `npx vitest run src/auth`
Expected: PASS — the new `AuthCard` tests are green and existing auth tests are
unaffected.

- [ ] **Step 2: Typecheck the touched file**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "AuthCard" || echo "no type errors in AuthCard"`
Expected: `no type errors in AuthCard`. (Ignore unrelated pre-existing errors in
other files.)

- [ ] **Step 3: Lint the touched files**

Run: `npx eslint src/auth/AuthCard.tsx src/auth/AuthCard.test.tsx`
Expected: no errors. (Do NOT run repo-wide `npm run lint`.)

- [ ] **Step 4: Manual verification note (preview)**

The live `/login` page is reachable in the preview without auth. If verifying
manually at desktop width: open `/login`, click "Sign up", and confirm the "Verify
Password" field slides/fades in as soon as the Password field gets a character;
typing a non-matching value shows "Passwords don't match" and greys out "Create
Account"; matching shows "✓ Passwords match" and enables it; clearing the password
collapses the field. (Sign-up submission itself needs a real backend, so stop at the
client behavior.)

- [ ] **Step 5: Confirm clean commit scope**

Run: `git show --stat HEAD | grep -E "AuthCard"`
Expected: only `src/auth/AuthCard.tsx` and `src/auth/AuthCard.test.tsx` appear.

---

## Self-Review Notes

- **Spec coverage:** confirm state (Step 4), framer-motion slide+fade reveal gated on
  `showConfirm` with reduced-motion (Steps 3, 6, 7), live match indicator (Step 7),
  submit-time guard (Step 5) + disabled/opacity block (Step 8), clear-on-empty
  (Step 7) and reset-on-mode-switch (Step 9), signup-only / login untouched
  (`showConfirm` gate + test 5). All covered.
- **Type consistency:** `confirmPassword`/`setConfirmPassword`, `showConfirm`,
  `passwordsMatch`, `reduce` are defined before use; `signUp(email, password,
  fullName)` arg order matches the test assertion.
- **No placeholders:** every code step is complete, including the exact reused style
  object.
- **Test robustness:** framer-motion is mocked to render children synchronously, so
  presence/absence assertions don't depend on animation timing; the curly-apostrophe
  copy is matched with `/don.t/` (regex `.`).
