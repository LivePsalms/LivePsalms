# Post-Signup Verify-Email Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stale "Check your email" inline message after sign-up with a dedicated `/verify-email` page (clear message + resend-with-cooldown + auto-advance), and make the verification link land coherently in the app.

**Architecture:** `session.signUp` sets `emailRedirectTo` and a new `resendSignupEmail` is added. `AuthCard` navigates to a new `/verify-email` route (stashing the email in `sessionStorage`) instead of showing an inline message. `VerifyEmailPage` reads the stashed email, offers resend, and auto-advances to the notepad when the reactive `useAuthSession().user` becomes non-null (cross-tab session sync).

**Tech Stack:** React + TypeScript, react-router-dom, Supabase auth, sonner, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-06-10-verify-email-flow-design.md`

---

## File Structure

- **Modify** `src/auth/session/auth-session.ts` — `signUp` gains `emailRedirectTo`; add `resendSignupEmail`.
- **Modify** `src/auth/session/auth-session.test.ts` — extend the fake + add tests.
- **Create** `src/auth/VerifyEmailPage.tsx` — the verify-email page.
- **Create** `src/auth/VerifyEmailPage.test.tsx` — page tests.
- **Modify** `src/App.tsx` — add the `/verify-email` route + footer/dock hide.
- **Modify** `src/auth/AuthCard.tsx` — signup success navigates to `/verify-email`.
- **Modify** `src/auth/AuthCard.test.tsx` — update the signup-submit test.

---

## Task 1: Session methods — `emailRedirectTo` + `resendSignupEmail`

**Files:**
- Modify: `src/auth/session/auth-session.ts`
- Test: `src/auth/session/auth-session.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/auth/session/auth-session.test.ts`:

(a) Extend the `FakeSupabaseAuth` `signUpCalls` field type and add a `resend` method + `resendCalls`. Change:

```ts
  signUpCalls: Array<{ email: string; password: string; fullName: string }> = [];
```
to:
```ts
  signUpCalls: Array<{ email: string; password: string; fullName: string; emailRedirectTo?: string }> = [];
  resendCalls: Array<{ type: string; email: string; emailRedirectTo?: string }> = [];
```

Change the fake `signUp` to capture `emailRedirectTo`:
```ts
  async signUp(payload: { email: string; password: string; options?: { data?: { full_name?: string }; emailRedirectTo?: string } }) {
    this.signUpCalls.push({
      email: payload.email,
      password: payload.password,
      fullName: payload.options?.data?.full_name ?? '',
      emailRedirectTo: payload.options?.emailRedirectTo,
    });
    return { error: null };
  }
```

Add a fake `resend` method right after `signUp`:
```ts
  async resend(payload: { type: string; email: string; options?: { emailRedirectTo?: string } }) {
    this.resendCalls.push({
      type: payload.type,
      email: payload.email,
      emailRedirectTo: payload.options?.emailRedirectTo,
    });
    return { error: null };
  }
```

Then add two tests after the existing `'signUp passes fullName through as user_metadata'` test:
```ts
  it('signUp passes an emailRedirectTo to /notepad/notes when a window exists', async () => {
    const originalWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = { location: { origin: 'https://example.test' } };
    try {
      const { client, auth } = makeFakeClient();
      const session = new AuthSession(client, local, new FakeOAuthProbe());
      await session.signUp('a@b.com', 'pw', 'Alice Doe');
      expect(auth.signUpCalls[0].emailRedirectTo).toBe('https://example.test/notepad/notes');
    } finally {
      if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window?: unknown }).window = originalWindow;
    }
  });

  it('resendSignupEmail calls auth.resend with type=signup and the emailRedirectTo', async () => {
    const originalWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = { location: { origin: 'https://example.test' } };
    try {
      const { client, auth } = makeFakeClient();
      const session = new AuthSession(client, local, new FakeOAuthProbe());
      await session.resendSignupEmail('a@b.com');
      expect(auth.resendCalls[0]).toEqual({
        type: 'signup',
        email: 'a@b.com',
        emailRedirectTo: 'https://example.test/notepad/notes',
      });
    } finally {
      if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window?: unknown }).window = originalWindow;
    }
  });
```

(The existing `toEqual({ email, password, fullName })` test still passes — `toEqual` ignores the new `emailRedirectTo: undefined` key when no window is stubbed.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/auth/session/auth-session.test.ts`
Expected: FAIL — `session.resendSignupEmail` does not exist and `signUp` does not set `emailRedirectTo`.

- [ ] **Step 3: Implement the session changes**

In `src/auth/session/auth-session.ts`, change `signUp`:

```ts
  signUp = async (email: string, password: string, fullName: string): Promise<void> => {
    if (!this.client) throw new Error('Supabase not configured');
    const emailRedirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/notepad/notes` : undefined;
    const { error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo },
    });
    if (error) throw error;
  };
```

Add `resendSignupEmail` immediately after `signUp`:

```ts
  resendSignupEmail = async (email: string): Promise<void> => {
    if (!this.client) throw new Error('Supabase not configured');
    const emailRedirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/notepad/notes` : undefined;
    const { error } = await this.client.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo },
    });
    if (error) throw error;
  };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/auth/session/auth-session.test.ts`
Expected: PASS (all tests, including the two new ones and the unchanged `fullName` test).

- [ ] **Step 5: Commit**

```bash
git add src/auth/session/auth-session.ts src/auth/session/auth-session.test.ts
git commit -m "feat(auth): set signup emailRedirectTo and add resendSignupEmail"
```

---

## Task 2: `VerifyEmailPage` + route

**Files:**
- Create: `src/auth/VerifyEmailPage.tsx`
- Test: `src/auth/VerifyEmailPage.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/auth/VerifyEmailPage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const resendSignupEmail = vi.fn().mockResolvedValue(undefined);
let mockUser: unknown = null;
vi.mock('./context/useAuthSession', () => ({
  useAuthSession: () => ({ user: mockUser, session: { resendSignupEmail } }),
}));

import { VerifyEmailPage } from './VerifyEmailPage';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
  mockUser = null;
});

describe('VerifyEmailPage', () => {
  it('renders the stashed email', () => {
    sessionStorage.setItem('lp.verifyEmail', 'sarah@example.com');
    render(<VerifyEmailPage />);
    expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
  });

  it('navigates to /login when there is no stashed email', () => {
    render(<VerifyEmailPage />);
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('resend calls resendSignupEmail then enters cooldown (button disabled, countdown shown)', async () => {
    sessionStorage.setItem('lp.verifyEmail', 'sarah@example.com');
    render(<VerifyEmailPage cooldownSeconds={3} />);
    fireEvent.click(screen.getByRole('button', { name: /resend email/i }));
    await waitFor(() => expect(resendSignupEmail).toHaveBeenCalledWith('sarah@example.com'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /resend in/i })).toBeDisabled(),
    );
  });

  it('back to sign in navigates to /login', () => {
    sessionStorage.setItem('lp.verifyEmail', 'sarah@example.com');
    render(<VerifyEmailPage />);
    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('auto-advances to the notepad when a user session appears', () => {
    sessionStorage.setItem('lp.verifyEmail', 'sarah@example.com');
    mockUser = { id: 'u1' };
    render(<VerifyEmailPage />);
    expect(navigate).toHaveBeenCalledWith('/notepad/notes', { replace: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/auth/VerifyEmailPage.test.tsx`
Expected: FAIL — module `./VerifyEmailPage` does not exist.

- [ ] **Step 3: Implement `VerifyEmailPage`**

Create `src/auth/VerifyEmailPage.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthSession } from './context/useAuthSession';

const PENDING_EMAIL_KEY = 'lp.verifyEmail';

export interface VerifyEmailPageProps {
  cooldownSeconds?: number;
}

export function VerifyEmailPage({ cooldownSeconds = 45 }: VerifyEmailPageProps) {
  const navigate = useNavigate();
  const { user, session } = useAuthSession();
  const [email] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(PENDING_EMAIL_KEY);
    } catch {
      return null;
    }
  });
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // No pending email → nothing to verify here.
  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
  }, [email, navigate]);

  // Auto-advance once verification establishes a session (incl. cross-tab sync).
  useEffect(() => {
    if (user) navigate('/notepad/notes', { replace: true });
  }, [user, navigate]);

  // Clear the cooldown interval on unmount.
  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  const startCooldown = () => {
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
    if (!email || resending || cooldown > 0) return;
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

  if (!email) return null;

  const mmss = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}`;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--app-bg)' }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-8 text-center"
        style={{
          background: 'var(--alabaster)',
          border: '1px solid var(--pale-stone)',
          boxShadow: '0 4px 24px rgba(58, 52, 38, 0.08)',
        }}
      >
        <img src="/logo-icon.png" alt="LivePsalms" className="h-10 w-auto mb-4 mx-auto" />
        <h1
          className="text-lg font-medium mb-2"
          style={{ color: 'var(--deep-umber)', fontFamily: 'Cormorant Garamond, serif' }}
        >
          Check your email
        </h1>
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
          Click it to finish creating your account. Don’t see it? Check your spam folder.
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
          onClick={() => navigate('/login')}
          className="mt-4 text-xs underline hover:opacity-70 transition-opacity"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          ← Back to sign in
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the page tests to verify they pass**

Run: `npx vitest run src/auth/VerifyEmailPage.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Wire the route into `App.tsx`**

In `src/App.tsx`:

(a) After `import { WelcomePage } from '@/auth/WelcomePage';`, add:
```tsx
import { VerifyEmailPage } from '@/auth/VerifyEmailPage';
```

(b) After `const isWelcomePage = location.pathname === '/welcome';`, add:
```tsx
  const isVerifyEmailPage = location.pathname === '/verify-email';
```

(c) Change the `hideFooter` line to include `isVerifyEmailPage`:
```tsx
  const hideFooter = isDetailPage || isPurposePage || isNotepadAny || isLoginPage || isProfilePage || isWelcomePage || isVerifyEmailPage || isCommunityPage || isContactPage || isLegalPage;
```

(d) Change the `dockMounted` line to exclude `isVerifyEmailPage`:
```tsx
  const dockMounted = !isNotepadEditor && !isLoginPage && !isProfilePage && !isWelcomePage && !isVerifyEmailPage;
```

(e) After `<Route path="/welcome" element={<WelcomePage />} />`, add:
```tsx
            <Route path="/verify-email" element={<VerifyEmailPage />} />
```

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "VerifyEmailPage|App.tsx" || echo "no type errors in touched files"`
Expected: `no type errors in touched files`.

```bash
git add src/auth/VerifyEmailPage.tsx src/auth/VerifyEmailPage.test.tsx src/App.tsx
git commit -m "feat(auth): VerifyEmailPage with resend + auto-advance, wired at /verify-email"
```

---

## Task 3: `AuthCard` navigates to `/verify-email` on signup

**Files:**
- Modify: `src/auth/AuthCard.tsx`
- Test: `src/auth/AuthCard.test.tsx`

- [ ] **Step 1: Update the signup-submit test**

In `src/auth/AuthCard.test.tsx`:

(a) Change the testing-library / router import line:
```tsx
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
```
to:
```tsx
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
```

(b) Add `sessionStorage.clear();` to the existing `afterEach` so it becomes:
```tsx
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
});
```

(c) Replace the entire existing `it('enables Create Account on a match and submits with signUp', ...)` test with:
```tsx
  it('on a match, stashes the email and navigates to /verify-email after signUp', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<AuthCard />} />
          <Route path="/verify-email" element={<div>VERIFY EMAIL PAGE</div>} />
        </Routes>
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
    expect(await screen.findByText('VERIFY EMAIL PAGE')).toBeInTheDocument();
    expect(sessionStorage.getItem('lp.verifyEmail')).toBe('sarah@example.com');
  });
```

(Note: `renderSignup`/`renderLogin` helpers and the other four tests are unchanged. This test does its own render because it needs a `Routes` setup to observe the navigation.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/auth/AuthCard.test.tsx`
Expected: FAIL — the new test fails because `AuthCard` still calls `setSuccess` (shows the inline message) instead of navigating; "VERIFY EMAIL PAGE" never appears and `lp.verifyEmail` is null.

- [ ] **Step 3: Implement the navigation in `AuthCard`**

In `src/auth/AuthCard.tsx`:

(a) Change the import line:
```tsx
import { Link } from 'react-router-dom';
```
to:
```tsx
import { Link, useNavigate } from 'react-router-dom';
```

(b) Inside the component, immediately after `const { session } = useAuthSession();`, add:
```tsx
  const navigate = useNavigate();
```

(c) In `handleSubmit`, the signup branch, change:
```tsx
        await session.signUp(email, password, fullName);
        setSuccess('Check your email to verify your account.');
```
to:
```tsx
        await session.signUp(email, password, fullName);
        try {
          sessionStorage.setItem('lp.verifyEmail', email);
        } catch {
          /* best-effort */
        }
        navigate('/verify-email');
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/auth/AuthCard.test.tsx`
Expected: PASS (5 tests — the updated signup test plus the four unchanged ones).

- [ ] **Step 5: Commit**

```bash
git add src/auth/AuthCard.tsx src/auth/AuthCard.test.tsx
git commit -m "feat(auth): navigate to /verify-email after sign up instead of inline message"
```

---

## Task 4: Verify, lint, finalize

**Files:** none modified (verification only).

- [ ] **Step 1: Run the full auth suite**

Run: `npx vitest run src/auth`
Expected: PASS — all auth tests green (session, VerifyEmailPage, AuthCard).

- [ ] **Step 2: Typecheck the touched files**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "auth-session|VerifyEmailPage|AuthCard|App\.tsx" || echo "no type errors in touched files"`
Expected: `no type errors in touched files`.

- [ ] **Step 3: Lint the touched files**

Run: `npx eslint src/auth/session/auth-session.ts src/auth/session/auth-session.test.ts src/auth/VerifyEmailPage.tsx src/auth/VerifyEmailPage.test.tsx src/auth/AuthCard.tsx src/auth/AuthCard.test.tsx src/App.tsx`
Expected: no errors. (Do NOT run repo-wide `npm run lint`.)

- [ ] **Step 4: Manual preview check (no auth needed for the routing)**

At `/login` → "Sign up", fill a matching password + name + email + Terms, click "Create Account". Confirm the app navigates to `/verify-email` showing "Check your email" with the entered address and a "Resend email" button; clicking Resend shows the cooldown countdown and disables the button; "Back to sign in" returns to `/login`. (A real verification click / auto-advance needs a live Supabase backend — stop at the client routing + resend UI.)

- [ ] **Step 5: Confirm clean commit scope**

Run: `git show --stat HEAD~2 HEAD~1 HEAD | grep -E "auth|App" | sort -u`
Expected: only the seven intended files across the three feature commits.

---

## Self-Review Notes

- **Spec coverage:** emailRedirectTo on signUp (Task 1), resendSignupEmail (Task 1),
  `/verify-email` route + page (Task 2), sessionStorage email source + redirect-to-
  login fallback (Task 2 page), resend-with-cooldown (Task 2), auto-advance via
  `useAuthSession().user` (Task 2), AuthCard navigation + email stash (Task 3),
  footer/dock hide (Task 2 Step 5). All covered.
- **Type consistency:** `resendSignupEmail(email)` defined in Task 1, consumed by
  `VerifyEmailPage` via `session.resendSignupEmail` (Task 2) and exercised in tests;
  `PENDING_EMAIL_KEY = 'lp.verifyEmail'` matches the AuthCard stash key and the test
  assertions; `cooldownSeconds` prop matches the page test.
- **No placeholders:** every step has complete code.
- **Test-env note:** `auth-session.test.ts` runs in node; the window-stub pattern
  (mirrored from the existing resetPassword test) exercises the `emailRedirectTo`
  branch. The existing `toEqual({email,password,fullName})` test still passes because
  `toEqual` ignores the new `emailRedirectTo: undefined` key.
