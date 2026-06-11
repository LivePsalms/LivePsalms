# "Go to sign in" fix + skippable username — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the verify-email "go to sign in" button open the sign-in form (email prefilled), and let users skip username selection by auto-generating a readable random one.

**Architecture:** Part 1 is a one-handler change in `AuthCard` that flips `mode` to `login` and clears the sign-up-only fields while keeping `email`. Part 2 adds a pure `generateUsername()` module, an optional `onSkip` button on the presentational `UsernameSetup`, and a generate-claim-retry loop in the `UsernameClaim` wiring that fires a toast.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react (jsdom), `sonner` for toasts.

Spec: [docs/superpowers/specs/2026-06-11-signin-flow-username-skip-design.md](../specs/2026-06-11-signin-flow-username-skip-design.md)

---

## File Structure

- `src/auth/AuthCard.tsx` — **modify**: replace the `onBack` handler passed to `VerifyEmailNotice`.
- `src/auth/username/username-generate.ts` — **create**: pure `generateUsername()`.
- `src/auth/username/username-generate.test.ts` — **create**: generator unit tests.
- `src/auth/username/UsernameSetup.tsx` — **modify**: add optional `onSkip` prop + "Skip for now" button.
- `src/auth/username/UsernameSetup.test.tsx` — **modify**: add skip-button tests.
- `src/auth/username/UsernameClaim.tsx` — **modify**: implement `onSkip` (generate + retry + navigate + toast).
- `src/auth/username/UsernameClaim.test.tsx` — **create**: skip-wiring tests.

Run tests with `npx vitest run <path>`. Full suite: `npm test`.

---

## Task 1: Pure random-username generator

**Files:**
- Create: `src/auth/username/username-generate.ts`
- Test: `src/auth/username/username-generate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/auth/username/username-generate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateUsername } from './username-generate';
import { validateUsername } from './username-rules';

describe('generateUsername', () => {
  it('always produces a name that passes validateUsername', () => {
    for (let i = 0; i < 500; i++) {
      const name = generateUsername();
      expect(validateUsername(name).valid, `invalid: ${name}`).toBe(true);
    }
  });

  it('matches the adjective_noun_digits shape', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateUsername()).toMatch(/^[a-z]+_[a-z]+_\d{3,4}$/);
    }
  });

  it('produces variety across calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(generateUsername());
    expect(seen.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/auth/username/username-generate.test.ts`
Expected: FAIL — cannot resolve `./username-generate`.

- [ ] **Step 3: Write minimal implementation**

Create `src/auth/username/username-generate.ts`. Word lists are authored in the app's
contemplative voice, all lowercase `[a-z]+`, none in `RESERVED_USERNAMES`:

```typescript
// Curated word lists in the app's contemplative voice. All lowercase [a-z]+ and
// none collide with RESERVED_USERNAMES, so generated names always pass
// validateUsername (3-30 chars, [a-z0-9_], not reserved).
const ADJECTIVES = [
  'quiet', 'still', 'gentle', 'humble', 'patient', 'faithful', 'tender',
  'hidden', 'gracious', 'steady', 'kindly', 'radiant', 'quiet', 'mindful',
  'hopeful', 'rooted', 'calm', 'bright', 'soft', 'true',
];

const NOUNS = [
  'psalm', 'water', 'lamp', 'dawn', 'harbor', 'meadow', 'cedar', 'river',
  'shepherd', 'pilgrim', 'garden', 'vineyard', 'mountain', 'valley', 'fountain',
  'lantern', 'ember', 'willow', 'haven', 'sparrow',
];

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Returns a readable random username like "quiet_psalm_4821".
 * Guaranteed to satisfy validateUsername.
 */
export function generateUsername(): string {
  const digits = Math.floor(1000 + Math.random() * 9000); // 1000-9999, always 4 digits
  return `${pick(ADJECTIVES)}_${pick(NOUNS)}_${digits}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/auth/username/username-generate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/auth/username/username-generate.ts src/auth/username/username-generate.test.ts
git commit -m "feat(auth): add readable random username generator"
```

---

## Task 2: "Skip for now" button on UsernameSetup

**Files:**
- Modify: `src/auth/username/UsernameSetup.tsx`
- Test: `src/auth/username/UsernameSetup.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append these tests inside the `describe('UsernameSetup', ...)` block in
`src/auth/username/UsernameSetup.test.tsx`:

```typescript
  it('renders a skip button and calls onSkip when clicked', () => {
    const onSkip = vi.fn();
    setup({ onSkip });
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('does not render a skip button when onSkip is not provided', () => {
    setup();
    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/auth/username/UsernameSetup.test.tsx`
Expected: FAIL — the first new test fails to find a "skip" button.

- [ ] **Step 3: Implement the skip button**

In `src/auth/username/UsernameSetup.tsx`:

Add `onSkip` to the props interface:

```typescript
export interface UsernameSetupProps {
  checkAvailable: (name: string) => Promise<boolean>;
  claim: (name: string) => Promise<UsernameClaimResult>;
  onClaimed: (username: string) => void;
  onSkip?: () => void | Promise<void>;
  debounceMs?: number;
}
```

Destructure it in the function signature:

```typescript
export function UsernameSetup({ checkAvailable, claim, onClaimed, onSkip, debounceMs = 300 }: UsernameSetupProps) {
```

Add the skip button immediately after the existing "Claim username" `<button>`
(after line 92's closing `</button>`, still inside the `<form>`):

```tsx
        {onSkip && (
          <button
            type="button"
            onClick={() => onSkip()}
            disabled={submitting}
            className="w-full rounded-md px-4 py-2 text-sm text-mersi-dark/60 hover:text-mersi-dark disabled:opacity-50"
          >
            Skip for now
          </button>
        )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/auth/username/UsernameSetup.test.tsx`
Expected: PASS (all existing + 2 new tests).

- [ ] **Step 5: Commit**

```bash
git add src/auth/username/UsernameSetup.tsx src/auth/username/UsernameSetup.test.tsx
git commit -m "feat(auth): add optional Skip-for-now button to UsernameSetup"
```

---

## Task 3: Wire skip in UsernameClaim (generate + retry + toast)

**Files:**
- Modify: `src/auth/username/UsernameClaim.tsx`
- Test: `src/auth/username/UsernameClaim.test.tsx` (create)

The current `UsernameClaim` pulls `account` from `useAccountProfile()` and `navigate`
from `useNavigate()`, then renders `UsernameSetup`. We add an `onSkip` handler that
generates a candidate, calls `account.setUsername`, retries on `taken`, then navigates
and toasts.

- [ ] **Step 1: Write the failing tests**

Create `src/auth/username/UsernameClaim.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { UsernameClaim } from './UsernameClaim';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

const setUsername = vi.fn();
const checkUsernameAvailable = vi.fn().mockResolvedValue(true);
vi.mock('@/auth/context/useAccountProfile', () => ({
  useAccountProfile: () => ({
    account: { setUsername, checkUsernameAvailable },
  }),
}));

beforeEach(() => {
  navigate.mockClear();
  toastSuccess.mockClear();
  setUsername.mockReset();
});
afterEach(cleanup);

describe('UsernameClaim skip', () => {
  it('generates a username, navigates, and toasts on skip', async () => {
    setUsername.mockResolvedValue({ ok: true });
    render(<UsernameClaim />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    await waitFor(() => expect(setUsername).toHaveBeenCalledTimes(1));
    const claimed = setUsername.mock.calls[0][0] as string;
    expect(claimed).toMatch(/^[a-z]+_[a-z]+_\d{3,4}$/);
    expect(navigate).toHaveBeenCalledWith(`/notepad/u/${claimed}`, { replace: true });
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastSuccess.mock.calls[0][0]).toContain(claimed);
  });

  it('retries with a new name when the first candidate is taken', async () => {
    setUsername
      .mockResolvedValueOnce({ ok: false, reason: 'taken' })
      .mockResolvedValueOnce({ ok: true });
    render(<UsernameClaim />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    await waitFor(() => expect(setUsername).toHaveBeenCalledTimes(2));
    const finalName = setUsername.mock.calls[1][0] as string;
    expect(navigate).toHaveBeenCalledWith(`/notepad/u/${finalName}`, { replace: true });
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/auth/username/UsernameClaim.test.tsx`
Expected: FAIL — no "skip" button exists yet (UsernameClaim doesn't pass `onSkip`).

- [ ] **Step 3: Implement the skip wiring**

Replace the contents of `src/auth/username/UsernameClaim.tsx` with:

```tsx
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAccountProfile } from '@/auth/context/useAccountProfile';
import { UsernameSetup } from './UsernameSetup';
import { generateUsername } from './username-generate';

const MAX_SKIP_ATTEMPTS = 5;

/** Wires the presentational picker to AccountProfile + navigation. */
export function UsernameClaim() {
  const { account } = useAccountProfile();
  const navigate = useNavigate();

  function goToNotepad(username: string) {
    navigate(`/notepad/u/${username}`, { replace: true });
  }

  async function handleSkip() {
    for (let attempt = 0; attempt < MAX_SKIP_ATTEMPTS; attempt++) {
      const candidate = generateUsername();
      const result = await account.setUsername(candidate);
      if (result.ok) {
        toast.success(`We picked @${candidate} for you — change it anytime in Settings.`);
        goToNotepad(candidate);
        return;
      }
      if (result.reason !== 'taken') break; // 'invalid' shouldn't happen; stop retrying
    }
    toast.error('Could not pick a username automatically. Please choose one.');
  }

  return (
    <UsernameSetup
      checkAvailable={account.checkUsernameAvailable}
      claim={account.setUsername}
      onClaimed={goToNotepad}
      onSkip={handleSkip}
    />
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/auth/username/UsernameClaim.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/auth/username/UsernameClaim.tsx src/auth/username/UsernameClaim.test.tsx
git commit -m "feat(auth): skip username -> auto-generate, retry on collision, toast"
```

---

## Task 4: "Go to sign in" opens the sign-in form

**Files:**
- Modify: `src/auth/AuthCard.tsx:156-161`

This is a behavior change to the `onBack` handler. `AuthCard` has no existing test
file and its state is internal (no injectable seam), so we verify by reading the
diff and a manual smoke check rather than a unit test — keep the change minimal and
self-evident.

- [ ] **Step 1: Make the change**

In `src/auth/AuthCard.tsx`, replace the `VerifyEmailNotice` block (currently lines
156-161):

```tsx
      {verifyEmail ? (
        <VerifyEmailNotice
          email={verifyEmail}
          onBack={() => setVerifyEmail(null)}
          onVerified={() => onAuthenticated?.()}
        />
      ) : (
```

with:

```tsx
      {verifyEmail ? (
        <VerifyEmailNotice
          email={verifyEmail}
          onBack={() => {
            // Return to the sign-in form (not the populated sign-up form). Keep the
            // email they just signed up with prefilled; clear everything else.
            setVerifyEmail(null);
            setMode('login');
            setPassword('');
            setConfirmPassword('');
            setFullName('');
            setAgreedToTerms(false);
            setError(null);
            setSuccess(null);
          }}
          onVerified={() => onAuthenticated?.()}
        />
      ) : (
```

(`email` is intentionally left untouched so it stays prefilled.)

- [ ] **Step 2: Typecheck**

Run: `tsc -b`
Expected: no new errors (the repo has a known pre-existing baseline; this change adds none).

- [ ] **Step 3: Commit**

```bash
git add src/auth/AuthCard.tsx
git commit -m "fix(auth): 'go to sign in' opens sign-in form with email prefilled"
```

---

## Task 5: Full verification

- [ ] **Step 1: Run the username test suite**

Run: `npx vitest run src/auth/username/`
Expected: PASS — all files green (existing + new).

- [ ] **Step 2: Typecheck the build**

Run: `tsc -b`
Expected: no new errors vs. the known pre-existing baseline.

- [ ] **Step 3: Manual smoke check (document result)**

Start the app, sign up with a fresh email, reach the "Check your email" notice, click
"← Back to sign in" → confirm the **sign-in** form shows with the email prefilled and
the password empty. Then, as a signed-in user without a username, click "Skip for now"
→ confirm you land in the notepad with a `@adjective_noun_dddd` username and a toast.

---

## Self-Review Notes

- **Spec coverage:** Part 1 → Task 4. Part 2 generator → Task 1; skip button → Task 2;
  generate/retry/toast wiring → Task 3; editable-later is pre-existing (no task needed).
- **Type consistency:** `generateUsername(): string`, `onSkip?: () => void | Promise<void>`,
  `account.setUsername(name) => Promise<UsernameClaimResult>` (`{ok:true} | {ok:false, reason:'taken'|'invalid'}`)
  used consistently across tasks.
- **No placeholders:** every step has concrete code/commands.
