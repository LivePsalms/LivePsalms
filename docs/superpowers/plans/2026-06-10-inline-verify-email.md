# Inline Verify-Email Card Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the post-signup `/verify-email` navigation with an in-place card swap: `AuthCard` renders a shared `VerifyEmailNotice` inline, and the standalone route/page is removed.

**Architecture:** Extract `VerifyEmailNotice` (verify content + resend/cooldown + auto-advance) from the existing `VerifyEmailPage`. `AuthCard` gains a `verifyEmail` state; on signup success it sets that state instead of navigating, swapping the card body to the notice. The `/verify-email` route and `VerifyEmailPage` are deleted.

**Tech Stack:** React + TypeScript, react-router-dom, Supabase auth, sonner, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-06-10-inline-verify-email-design.md`

---

## File Structure

- **Create** `src/auth/VerifyEmailNotice.tsx` — reusable verify content + behavior.
- **Create** `src/auth/VerifyEmailNotice.test.tsx` — notice tests.
- **Modify** `src/auth/AuthCard.tsx` — inline swap on signup; drop navigate/sessionStorage.
- **Modify** `src/auth/AuthCard.test.tsx` — update the signup-submit test.
- **Modify** `src/App.tsx` — remove the route + import + footer/dock guard.
- **Delete** `src/auth/VerifyEmailPage.tsx` and `src/auth/VerifyEmailPage.test.tsx`.

---

## Task 1: `VerifyEmailNotice` component

**Files:**
- Create: `src/auth/VerifyEmailNotice.tsx`
- Test: `src/auth/VerifyEmailNotice.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/auth/VerifyEmailNotice.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const resendSignupEmail = vi.fn().mockResolvedValue(undefined);
let mockUser: unknown = null;
vi.mock('./context/useAuthSession', () => ({
  useAuthSession: () => ({ user: mockUser, session: { resendSignupEmail } }),
}));

import { VerifyEmailNotice } from './VerifyEmailNotice';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockUser = null;
});

describe('VerifyEmailNotice', () => {
  it('renders the email', () => {
    render(<VerifyEmailNotice email="sarah@example.com" onBack={() => {}} />);
    expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
  });

  it('resend calls resendSignupEmail then enters cooldown (button disabled, countdown shown)', async () => {
    render(<VerifyEmailNotice email="sarah@example.com" onBack={() => {}} cooldownSeconds={3} />);
    fireEvent.click(screen.getByRole('button', { name: /resend email/i }));
    await waitFor(() => expect(resendSignupEmail).toHaveBeenCalledWith('sarah@example.com'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /resend in/i })).toBeDisabled(),
    );
  });

  it('back calls onBack', () => {
    const onBack = vi.fn();
    render(<VerifyEmailNotice email="sarah@example.com" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('calls onVerified when a user session appears', () => {
    const onVerified = vi.fn();
    mockUser = { id: 'u1' };
    render(<VerifyEmailNotice email="sarah@example.com" onBack={() => {}} onVerified={onVerified} />);
    expect(onVerified).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/auth/VerifyEmailNotice.test.tsx`
Expected: FAIL — module `./VerifyEmailNotice` does not exist.

- [ ] **Step 3: Implement `VerifyEmailNotice`**

Create `src/auth/VerifyEmailNotice.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuthSession } from './context/useAuthSession';

export interface VerifyEmailNoticeProps {
  email: string;
  onBack: () => void;
  onVerified?: () => void;
  cooldownSeconds?: number;
}

export function VerifyEmailNotice({
  email,
  onBack,
  onVerified,
  cooldownSeconds = 45,
}: VerifyEmailNoticeProps) {
  const { user, session } = useAuthSession();
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-advance once verification establishes a session (incl. cross-tab sync).
  useEffect(() => {
    if (user) onVerified?.();
  }, [user, onVerified]);

  // Clear the cooldown interval on unmount.
  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  const startCooldown = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCooldown(cooldownSeconds);
    intervalRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    try {
      await session.resendSignupEmail(email);
      toast.success('Verification email sent.');
      startCooldown();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const mmss = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}`;

  return (
    <div className="text-center">
      <h2
        className="text-lg font-medium mb-2"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Cormorant Garamond, serif' }}
      >
        Check your email
      </h2>
      <p
        className="text-sm mb-1"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        We sent a verification link to
      </p>
      <p
        className="text-sm font-medium mb-4"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        {email}
      </p>
      <p
        className="text-xs mb-6"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        Click it to finish creating your account. Don't see it? Check your spam folder.
      </p>
      <button
        type="button"
        onClick={handleResend}
        disabled={resending || cooldown > 0}
        className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity"
        style={{
          background: 'var(--deep-umber)',
          color: 'var(--plaster)',
          fontFamily: 'Outfit, sans-serif',
          opacity: resending || cooldown > 0 ? 0.6 : 1,
        }}
      >
        {cooldown > 0 ? `Resend in ${mmss}` : resending ? 'Sending…' : 'Resend email'}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="mt-4 text-xs underline hover:opacity-70 transition-opacity"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        ← Back to sign in
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/auth/VerifyEmailNotice.test.tsx`
Expected: PASS (4 tests). The `waitFor` calls handle async; do NOT add sleeps.

- [ ] **Step 5: Commit**

```bash
git add src/auth/VerifyEmailNotice.tsx src/auth/VerifyEmailNotice.test.tsx
git commit -m "feat(auth): extract VerifyEmailNotice (reusable verify content + resend)"
```

---

## Task 2: `AuthCard` swaps inline on signup

**Files:**
- Modify: `src/auth/AuthCard.tsx`
- Test: `src/auth/AuthCard.test.tsx`

- [ ] **Step 1: Update the signup-submit test**

In `src/auth/AuthCard.test.tsx`:

(a) Change the import line:
```tsx
import { MemoryRouter, Routes, Route } from 'react-router-dom';
```
to:
```tsx
import { MemoryRouter } from 'react-router-dom';
```

(b) Replace the ENTIRE existing test `it('on a match, stashes the email and navigates to /verify-email after signUp', ...)` with:
```tsx
  it('on a match, swaps the card to the verify notice inline (no navigation, no sessionStorage)', async () => {
    render(
      <MemoryRouter>
        <AuthCard />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));
    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: 'Sarah' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'sarah@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret1' } });
    fireEvent.change(screen.getByLabelText('Verify Password'), { target: { value: 'secret1' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith('sarah@example.com', 'secret1', 'Sarah'),
    );
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
    // The sign-up form is gone (swapped out), and nothing was stashed/navigated.
    expect(screen.queryByPlaceholderText('Full Name')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('lp.verifyEmail')).toBeNull();
  });
```

(The `afterEach` already calls `sessionStorage.clear()`; the four other tests and the `renderLogin`/`renderSignup` helpers are unchanged. The mocked `useAuthSession` returns `{ session: {...} }` with no `user`/`resendSignupEmail`; the inline `VerifyEmailNotice` reads `user` as `undefined` (auto-advance no-op) and only touches `resendSignupEmail` on a Resend click, which this test does not do — so the existing mock is sufficient.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/auth/AuthCard.test.tsx`
Expected: FAIL — `AuthCard` still navigates to `/verify-email` (and `VerifyEmailNotice` is not rendered), so "Check your email" never appears.

- [ ] **Step 3: Update imports in `AuthCard.tsx`**

Change:
```tsx
import { Link, useNavigate } from 'react-router-dom';
import { useAuthSession } from './context/useAuthSession';
```
to:
```tsx
import { Link } from 'react-router-dom';
import { useAuthSession } from './context/useAuthSession';
import { VerifyEmailNotice } from './VerifyEmailNotice';
```

- [ ] **Step 4: Replace navigate state with `verifyEmail` state**

Change:
```tsx
  const { session } = useAuthSession();
  const navigate = useNavigate();
```
to:
```tsx
  const { session } = useAuthSession();
```

And immediately after `const [success, setSuccess] = useState<string | null>(null);`, add:
```tsx
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
```

- [ ] **Step 5: Set inline state on signup success**

In `handleSubmit`, change:
```tsx
        await session.signUp(email, password, fullName);
        try {
          sessionStorage.setItem('lp.verifyEmail', email);
        } catch {
          /* best-effort */
        }
        navigate('/verify-email');
```
to:
```tsx
        await session.signUp(email, password, fullName);
        setVerifyEmail(email);
```

- [ ] **Step 6: Make the heading conditional and swap the card body**

In the JSX, change the logo block's `<h1>` so it only renders when NOT verifying. Replace:
```tsx
        <img src="/logo-icon.png" alt="LivePsalms" className="h-10 w-auto mb-3" />
        <h1
          className="text-lg font-medium"
          style={{
            color: 'var(--deep-umber)',
            fontFamily: 'Cormorant Garamond, serif',
          }}
        >
          {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
        </h1>
      </div>
```
with:
```tsx
        <img src="/logo-icon.png" alt="LivePsalms" className="h-10 w-auto mb-3" />
        {!verifyEmail && (
          <h1
            className="text-lg font-medium"
            style={{
              color: 'var(--deep-umber)',
              fontFamily: 'Cormorant Garamond, serif',
            }}
          >
            {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h1>
        )}
      </div>

      {verifyEmail ? (
        <VerifyEmailNotice
          email={verifyEmail}
          onBack={() => setVerifyEmail(null)}
          onVerified={() => onAuthenticated?.()}
        />
      ) : (
        <>
```

Then close the ternary's `<>` fragment just before the card's final closing `</div>`. The component currently ends with:
```tsx
        </p>
      )}
    </div>
  );
}
```
Change it to:
```tsx
        </p>
      )}
        </>
      )}
    </div>
  );
}
```
(The added `</>\n      )}` closes the `: (` fragment opened in Step 6. Read the file to confirm this is the final `</div>` of the card before `);` — there is exactly one such closing sequence at the end of the component.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/auth/AuthCard.test.tsx`
Expected: PASS (5 tests — the updated inline-swap test plus the four unchanged ones).

- [ ] **Step 8: Typecheck + commit**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "AuthCard" || echo "no type errors in AuthCard"`
Expected: `no type errors in AuthCard`.

```bash
git add src/auth/AuthCard.tsx src/auth/AuthCard.test.tsx
git commit -m "feat(auth): swap AuthCard to the verify notice inline instead of navigating"
```

---

## Task 3: Remove the `/verify-email` route + page

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/auth/VerifyEmailPage.tsx`, `src/auth/VerifyEmailPage.test.tsx`

- [ ] **Step 1: Remove the App.tsx wiring**

In `src/App.tsx`:

(a) Delete the import line:
```tsx
import { VerifyEmailPage } from '@/auth/VerifyEmailPage';
```

(b) Delete the line:
```tsx
  const isVerifyEmailPage = location.pathname === '/verify-email';
```

(c) Change the `hideFooter` line — remove `|| isVerifyEmailPage`. It should go from:
```tsx
  const hideFooter = isDetailPage || isPurposePage || isNotepadAny || isLoginPage || isProfilePage || isWelcomePage || isVerifyEmailPage || isCommunityPage || isContactPage || isLegalPage;
```
to:
```tsx
  const hideFooter = isDetailPage || isPurposePage || isNotepadAny || isLoginPage || isProfilePage || isWelcomePage || isCommunityPage || isContactPage || isLegalPage;
```

(d) Change the `dockMounted` line — remove `&& !isVerifyEmailPage`. It should go from:
```tsx
  const dockMounted = !isNotepadEditor && !isLoginPage && !isProfilePage && !isWelcomePage && !isVerifyEmailPage;
```
to:
```tsx
  const dockMounted = !isNotepadEditor && !isLoginPage && !isProfilePage && !isWelcomePage;
```

(e) Delete the route line:
```tsx
            <Route path="/verify-email" element={<VerifyEmailPage />} />
```

- [ ] **Step 2: Delete the page + its test**

```bash
git rm src/auth/VerifyEmailPage.tsx src/auth/VerifyEmailPage.test.tsx
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "VerifyEmailPage|App\.tsx" || echo "no type errors / no dangling references"`
Expected: `no type errors / no dangling references` (confirms nothing still imports `VerifyEmailPage`).

- [ ] **Step 4: Run the full auth suite**

Run: `npx vitest run src/auth`
Expected: PASS — `VerifyEmailNotice` + `AuthCard` green; the deleted `VerifyEmailPage.test.tsx` is gone.

- [ ] **Step 5: Lint the touched files**

Run: `npx eslint src/auth/VerifyEmailNotice.tsx src/auth/VerifyEmailNotice.test.tsx src/auth/AuthCard.tsx src/auth/AuthCard.test.tsx src/App.tsx`
Expected: no errors. (Do NOT run repo-wide `npm run lint`.)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(auth): remove the standalone /verify-email route and page"
```

- [ ] **Step 7: Manual preview check**

At `/login` → "Sign up", fill name + email + matching passwords + Terms, click "Create Account". Confirm the SAME card swaps in place to "Check your email" with the entered address, a Resend button (cooldown on click), and "← Back to sign in" returning to the sign-up form — and the URL stays `/login` (no navigation). (Avoid clicking Resend against the real backend; that path is unit-tested.)

---

## Self-Review Notes

- **Spec coverage:** shared `VerifyEmailNotice` (Task 1); AuthCard `verifyEmail`
  state + inline swap + `onVerified`/`onBack` + dropped navigate/sessionStorage
  (Task 2); route/page/App-wiring removal (Task 3). All covered.
- **Type consistency:** `VerifyEmailNoticeProps` (`email`, `onBack`, `onVerified?`,
  `cooldownSeconds?`) matches both the test and the AuthCard usage; `verifyEmail`
  state typed `string | null`.
- **No placeholders:** every step has complete code.
- **Notes:** mode-switch handlers do NOT set `verifyEmail` to null — they are
  unreachable while the notice is shown (the toggle/form live in the non-verify
  branch); `onBack` is the only exit and it clears the state. The AuthCard test's
  existing `useAuthSession` mock needs no change (the inline notice reads `user` as
  undefined and never calls `resendSignupEmail` in that test).
