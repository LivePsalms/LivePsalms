# Standard Password Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce standard password rules (8+ chars with upper, lower, number, symbol) with a live requirements checklist on both sign-up and the password-reset page.

**Architecture:** A pure shared validator (`password-rules.ts`) + a presentational `PasswordChecklist` are consumed by `AuthCard` (sign-up) and `UpdatePasswordPage` (reset). Both gate their submit on `isPasswordValid` and show the checklist live as the user types.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-06-10-password-rules-design.md`

---

## File Structure

- **Create** `src/auth/password-rules.ts` — pure validator (`PASSWORD_RULES`, `evaluatePassword`, `isPasswordValid`).
- **Create** `src/auth/password-rules.test.ts`.
- **Create** `src/auth/PasswordChecklist.tsx` — live checklist UI.
- **Create** `src/auth/PasswordChecklist.test.tsx`.
- **Modify** `src/auth/AuthCard.tsx` + `src/auth/AuthCard.test.tsx`.
- **Modify** `src/auth/UpdatePasswordPage.tsx`; **Create** `src/auth/UpdatePasswordPage.test.tsx`.

---

## Task 1: `password-rules` validator

**Files:**
- Create: `src/auth/password-rules.ts`
- Test: `src/auth/password-rules.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/auth/password-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isPasswordValid, evaluatePassword, PASSWORD_RULES } from './password-rules';

describe('password-rules', () => {
  it('accepts a password meeting all five rules', () => {
    expect(isPasswordValid('Secret1!')).toBe(true);
  });

  it('rejects a password missing exactly one rule', () => {
    expect(isPasswordValid('secret1!')).toBe(false);  // no uppercase
    expect(isPasswordValid('SECRET1!')).toBe(false);  // no lowercase
    expect(isPasswordValid('Secrettt!')).toBe(false); // no number
    expect(isPasswordValid('Secret11')).toBe(false);  // no symbol
    expect(isPasswordValid('Sec1!')).toBe(false);     // too short (5)
  });

  it('evaluatePassword reports per-rule met flags', () => {
    const byId = Object.fromEntries(evaluatePassword('abc').map((r) => [r.id, r.met]));
    expect(byId.lower).toBe(true);
    expect(byId.length).toBe(false);
    expect(byId.upper).toBe(false);
    expect(byId.number).toBe(false);
    expect(byId.symbol).toBe(false);
  });

  it('exposes exactly five rules with labels', () => {
    expect(PASSWORD_RULES).toHaveLength(5);
    expect(PASSWORD_RULES.every((r) => typeof r.label === 'string' && r.label.length > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/auth/password-rules.test.ts`
Expected: FAIL — module `./password-rules` does not exist.

- [ ] **Step 3: Implement the validator**

Create `src/auth/password-rules.ts`:

```ts
export interface PasswordRule {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

export interface PasswordRuleResult {
  id: string;
  label: string;
  met: boolean;
}

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= PASSWORD_MIN_LENGTH },
  { id: 'upper', label: 'An uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'lower', label: 'A lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { id: 'number', label: 'A number', test: (pw) => /[0-9]/.test(pw) },
  { id: 'symbol', label: 'A special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export function evaluatePassword(pw: string): PasswordRuleResult[] {
  return PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, met: r.test(pw) }));
}

export function isPasswordValid(pw: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(pw));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/auth/password-rules.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/auth/password-rules.ts src/auth/password-rules.test.ts
git commit -m "feat(auth): add shared password-rules validator"
```

---

## Task 2: `PasswordChecklist` component

**Files:**
- Create: `src/auth/PasswordChecklist.tsx`
- Test: `src/auth/PasswordChecklist.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/auth/PasswordChecklist.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PasswordChecklist } from './PasswordChecklist';

afterEach(cleanup);

describe('PasswordChecklist', () => {
  it('marks all five rules met for a strong password', () => {
    render(<PasswordChecklist password="Secret1!" />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items.every((li) => li.getAttribute('data-met') === 'true')).toBe(true);
  });

  it('marks only the lowercase rule met for "abc"', () => {
    render(<PasswordChecklist password="abc" />);
    const items = screen.getAllByRole('listitem');
    const metCount = items.filter((li) => li.getAttribute('data-met') === 'true').length;
    expect(metCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/auth/PasswordChecklist.test.tsx`
Expected: FAIL — module `./PasswordChecklist` does not exist.

- [ ] **Step 3: Implement the component**

Create `src/auth/PasswordChecklist.tsx`:

```tsx
import { evaluatePassword } from './password-rules';

export interface PasswordChecklistProps {
  password: string;
}

export function PasswordChecklist({ password }: PasswordChecklistProps) {
  const rules = evaluatePassword(password);
  return (
    <ul className="flex flex-col gap-1 mt-1" aria-label="Password requirements">
      {rules.map((r) => (
        <li
          key={r.id}
          data-met={r.met}
          className="flex items-center gap-2 text-[11px]"
          style={{
            color: r.met ? '#27ae60' : 'var(--silica)',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          <span aria-hidden="true">{r.met ? '✓' : '○'}</span>
          {r.label}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/auth/PasswordChecklist.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/auth/PasswordChecklist.tsx src/auth/PasswordChecklist.test.tsx
git commit -m "feat(auth): add live PasswordChecklist component"
```

---

## Task 3: Wire rules into sign-up (`AuthCard`)

**Files:**
- Modify: `src/auth/AuthCard.tsx`
- Test: `src/auth/AuthCard.test.tsx`

- [ ] **Step 1: Update the tests**

In `src/auth/AuthCard.test.tsx`:

(a) In the test `it('on a match, swaps the card to the verify notice inline ...')`, change the three `secret1` occurrences to `Secret1!` — the Password value, the Verify Password value, and the `signUp` assertion arg. The three lines become:
```tsx
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'Secret1!' } });
    fireEvent.change(screen.getByLabelText('Verify Password'), { target: { value: 'Secret1!' } });
```
and
```tsx
      expect(signUp).toHaveBeenCalledWith('sarah@example.com', 'Secret1!', 'Sarah'),
```

(b) Add a new test after that one (before the `'never shows the verify field in login mode'` test):
```tsx
  it('keeps Create Account disabled until the password meets the requirements', () => {
    renderSignup();
    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: 'Sarah' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'sarah@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret1' } });
    fireEvent.change(screen.getByLabelText('Verify Password'), { target: { value: 'secret1' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'Secret1!' } });
    fireEvent.change(screen.getByLabelText('Verify Password'), { target: { value: 'Secret1!' } });
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled();
  });
```

(The `reveal`/`mismatch`/`login` tests keep `secret1` — they don't enable/submit, so password validity is irrelevant to them.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/auth/AuthCard.test.tsx`
Expected: FAIL — the inline-swap test now expects `signUp('...','Secret1!','Sarah')` but the button is still enabled by the old logic (no `isPasswordValid` gate), and the new disabled-until-valid test fails because the gate doesn't exist yet.

- [ ] **Step 3: Add imports + derived value to `AuthCard.tsx`**

After the existing imports (the `framer-motion` line is last), add:
```tsx
import { isPasswordValid } from './password-rules';
import { PasswordChecklist } from './PasswordChecklist';
```

Find the derived-values block:
```tsx
  const reduce = useReducedMotion();
  const showConfirm = mode === 'signup' && password.length > 0;
  const passwordsMatch = password === confirmPassword;
```
and add a line:
```tsx
  const reduce = useReducedMotion();
  const showConfirm = mode === 'signup' && password.length > 0;
  const passwordsMatch = password === confirmPassword;
  const passwordValid = isPasswordValid(password);
```

- [ ] **Step 4: Add the submit-time guard**

In `handleSubmit`, signup branch, change:
```tsx
        if (password !== confirmPassword) {
          setError('Passwords don’t match.');
          setLoading(false);
          return;
        }
        await session.signUp(email, password, fullName);
```
to:
```tsx
        if (password !== confirmPassword) {
          setError('Passwords don’t match.');
          setLoading(false);
          return;
        }
        if (!isPasswordValid(password)) {
          setError('Password doesn’t meet the requirements.');
          setLoading(false);
          return;
        }
        await session.signUp(email, password, fullName);
```

- [ ] **Step 5: Bump minLength and add the checklist under the password input**

Find the main Password `<input>` block (the one with `placeholder="Password"` whose `onChange` also clears the confirm). Change its `minLength={6}` to `minLength={8}`, then insert the checklist right after that input's closing `)}`. The block + following `<AnimatePresence>` currently read:
```tsx
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
```
Change them to:
```tsx
            required
            minLength={8}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{
              border: '1px solid var(--pale-stone)',
              background: 'var(--plaster)',
              fontFamily: 'Outfit, sans-serif',
              color: 'var(--deep-umber)',
            }}
          />
        )}

        {mode === 'signup' && password.length > 0 && (
          <PasswordChecklist password={password} />
        )}

        <AnimatePresence initial={false}>
```

- [ ] **Step 6: Add `passwordValid` to the submit gate**

Change the submit button's `disabled` expression:
```tsx
          disabled={loading || (mode === 'signup' && (!agreedToTerms || password !== confirmPassword))}
```
to:
```tsx
          disabled={loading || (mode === 'signup' && (!agreedToTerms || password !== confirmPassword || !passwordValid))}
```
and its `opacity` expression:
```tsx
            opacity: loading || (mode === 'signup' && (!agreedToTerms || password !== confirmPassword)) ? 0.6 : 1,
```
to:
```tsx
            opacity: loading || (mode === 'signup' && (!agreedToTerms || password !== confirmPassword || !passwordValid)) ? 0.6 : 1,
```

- [ ] **Step 7: Update the Supabase error mapping**

In `mapAuthError`, change:
```tsx
    if (m.includes('password should be at least')) {
      return 'Password must be at least 6 characters.';
    }
```
to:
```tsx
    if (m.includes('password should be at least')) {
      return 'Password must be at least 8 characters.';
    }
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/auth/AuthCard.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 9: Commit**

```bash
git add src/auth/AuthCard.tsx src/auth/AuthCard.test.tsx
git commit -m "feat(auth): enforce password rules + live checklist on sign up"
```

---

## Task 4: Wire rules into reset (`UpdatePasswordPage`) + finalize

**Files:**
- Modify: `src/auth/UpdatePasswordPage.tsx`
- Test: `src/auth/UpdatePasswordPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/auth/UpdatePasswordPage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

const updatePassword = vi.fn().mockResolvedValue(undefined);
vi.mock('./context/useAuthSession', () => ({
  useAuthSession: () => ({ session: { updatePassword } }),
}));

import { UpdatePasswordPage } from './UpdatePasswordPage';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('UpdatePasswordPage', () => {
  it('disables Update for a weak password', () => {
    render(<UpdatePasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('New Password'), { target: { value: 'weak' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm New Password'), { target: { value: 'weak' } });
    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled();
  });

  it('updates with a compliant matching password', async () => {
    render(<UpdatePasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('New Password'), { target: { value: 'Secret1!' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm New Password'), { target: { value: 'Secret1!' } });
    const btn = screen.getByRole('button', { name: /update password/i });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith('Secret1!'));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/auth/UpdatePasswordPage.test.tsx`
Expected: FAIL — the button is not disabled for a weak password (no validity gate yet).

- [ ] **Step 3: Implement the changes in `UpdatePasswordPage.tsx`**

(a) After `import { useAuthSession } from './context/useAuthSession';`, add:
```tsx
import { isPasswordValid } from './password-rules';
import { PasswordChecklist } from './PasswordChecklist';
```

(b) After `const [done, setDone] = useState(false);`, add:
```tsx
  const passwordValid = isPasswordValid(password);
```

(c) In `handleSubmit`, change:
```tsx
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
```
to:
```tsx
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!isPasswordValid(password)) {
      setError('Password doesn’t meet the requirements.');
      return;
    }
    setLoading(true);
```

(d) Bump both `minLength={6}` to `minLength={8}` (the New Password and Confirm New Password inputs).

(e) Insert the checklist after the FIRST password input (the `placeholder="New Password"` one). That input ends with:
```tsx
              }}
            />
            <input
              type="password"
              placeholder="Confirm New Password"
```
Change it to:
```tsx
              }}
            />
            {password.length > 0 && <PasswordChecklist password={password} />}
            <input
              type="password"
              placeholder="Confirm New Password"
```

(f) Gate the submit button. Change:
```tsx
              type="submit"
              disabled={loading}
```
to:
```tsx
              type="submit"
              disabled={loading || !passwordValid}
```
and change:
```tsx
                opacity: loading ? 0.6 : 1,
```
to:
```tsx
                opacity: loading || !passwordValid ? 0.6 : 1,
```

- [ ] **Step 4: Run the page tests to verify they pass**

Run: `npx vitest run src/auth/UpdatePasswordPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full auth suite + lint**

Run: `npx vitest run src/auth`
Expected: PASS — all auth tests green.

Run: `npx eslint src/auth/password-rules.ts src/auth/password-rules.test.ts src/auth/PasswordChecklist.tsx src/auth/PasswordChecklist.test.tsx src/auth/AuthCard.tsx src/auth/AuthCard.test.tsx src/auth/UpdatePasswordPage.tsx src/auth/UpdatePasswordPage.test.tsx`
Expected: no errors. (Do NOT run repo-wide `npm run lint`.)

- [ ] **Step 6: Commit**

```bash
git add src/auth/UpdatePasswordPage.tsx src/auth/UpdatePasswordPage.test.tsx
git commit -m "feat(auth): enforce password rules + checklist on the reset page"
```

- [ ] **Step 7: Manual preview check (no auth needed)**

At `/login` → "Sign up": type into Password and confirm the requirements checklist appears under it, each rule flipping ✓ as it's satisfied; "Create Account" stays disabled until all five pass (and the confirm matches + Terms checked). Then a compliant password enables it. (Don't submit against the real backend.)

---

## Self-Review Notes

- **Spec coverage:** validator with the 5 rules (Task 1); live checklist (Task 2);
  sign-up checklist + disabled gate + submit guard + minLength 8 + error-mapping
  (Task 3); reset-page checklist + gate + guard + minLength 8 (Task 4). All covered.
- **Type consistency:** `isPasswordValid`/`evaluatePassword`/`PASSWORD_RULES` defined
  in Task 1 and consumed identically in Tasks 2–4; `PasswordChecklist` prop `password`
  matches all call sites; `data-met` attribute matches the checklist tests.
- **No placeholders:** every step has complete code.
- **Test-password note:** only the AuthCard inline-swap test needed its `secret1` →
  `Secret1!` (it submits); the reveal/mismatch/login tests keep `secret1` (they don't
  enable/submit). The mapAuthError `6`→`8` string is asserted by no test.
