# Edit Username in Profile Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user view and change their username from Profile settings, with live availability feedback.

**Architecture:** A new self-contained `UsernameSection` (matching the `SecuritySection`/`LamplightSettingsSection` pattern) reuses the existing username primitives — `useUsernameAvailability`, `normalizeUsername`/`validateUsername`, and the `account.checkUsernameAvailable`/`account.setUsername` methods — and is rendered as its own section on `ProfilePage`. The `!unchanged` gate skips the availability check on the user's own current name.

**Tech Stack:** React + TypeScript, Vite, Vitest + @testing-library/react (jsdom), sonner toasts.

**Spec:** `docs/superpowers/specs/2026-06-09-edit-username-profile-design.md`

---

## File Structure

- **Create** `src/auth/components/UsernameSection.tsx` — the editable-username profile sub-section.
- **Create** `src/auth/components/UsernameSection.test.tsx` — unit tests.
- **Modify** `src/auth/ProfilePage.tsx` — render `<UsernameSection />` after the PROFILE section.

---

## Task 1: `UsernameSection` component

**Files:**
- Create: `src/auth/components/UsernameSection.tsx`
- Test: `src/auth/components/UsernameSection.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/auth/components/UsernameSection.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { UsernameSection } from './UsernameSection';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from 'sonner';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderSection(
  overrides: Partial<React.ComponentProps<typeof UsernameSection>> = {},
) {
  const checkAvailable = overrides.checkAvailable ?? vi.fn().mockResolvedValue(true);
  const setUsername = overrides.setUsername ?? vi.fn().mockResolvedValue({ ok: true });
  render(
    <UsernameSection
      currentUsername="sarah"
      checkAvailable={checkAvailable}
      setUsername={setUsername}
      sectionStyle={{}}
      labelStyle={{}}
      inputStyle={{}}
      debounceMs={0}
      {...overrides}
    />,
  );
  return { checkAvailable, setUsername };
}

describe('UsernameSection', () => {
  it('pre-fills the current username and disables Save when unchanged', () => {
    const { checkAvailable } = renderSection();
    expect(screen.getByLabelText('Username')).toHaveValue('sarah');
    expect(screen.getByText(/your current username/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save username/i })).toBeDisabled();
    expect(checkAvailable).not.toHaveBeenCalled();
  });

  it('shows Available and enables Save for a free changed name; Save calls setUsername + toasts', async () => {
    const { checkAvailable, setUsername } = renderSection({
      checkAvailable: vi.fn().mockResolvedValue(true),
    });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'natalie' } });
    await waitFor(() => expect(checkAvailable).toHaveBeenCalledWith('natalie'));
    expect(await screen.findByText(/available/i)).toBeInTheDocument();

    const save = screen.getByRole('button', { name: /save username/i });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(setUsername).toHaveBeenCalledWith('natalie'));
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows Taken and disables Save when the name is unavailable', async () => {
    renderSection({ checkAvailable: vi.fn().mockResolvedValue(false) });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'natalie' } });
    expect(await screen.findByText(/^taken$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save username/i })).toBeDisabled();
  });

  it('shows the format reason and disables Save for an invalid name (no availability check)', () => {
    const checkAvailable = vi.fn();
    renderSection({ checkAvailable });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'ab' } });
    expect(screen.getByText(/at least 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save username/i })).toBeDisabled();
    expect(checkAvailable).not.toHaveBeenCalled();
  });

  it('surfaces an inline error when the name is taken at save time', async () => {
    const setUsername = vi.fn().mockResolvedValue({ ok: false, reason: 'taken' });
    renderSection({ checkAvailable: vi.fn().mockResolvedValue(true), setUsername });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'natalie' } });
    await screen.findByText(/available/i);
    fireEvent.click(screen.getByRole('button', { name: /save username/i }));
    await waitFor(() => expect(screen.getByText(/just taken/i)).toBeInTheDocument());
    expect(toast.success).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/auth/components/UsernameSection.test.tsx`
Expected: FAIL — module `./UsernameSection` does not exist yet.

- [ ] **Step 3: Implement the component**

Create `src/auth/components/UsernameSection.tsx`:

```tsx
import { useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { toast } from 'sonner';
import { normalizeUsername, validateUsername } from '@/auth/username/username-rules';
import type { UsernameClaimResult } from '@/auth/username/username-rules';
import { useUsernameAvailability } from '@/auth/username/useUsernameAvailability';

export interface UsernameSectionProps {
  currentUsername: string | null;
  checkAvailable: (name: string) => Promise<boolean>;
  setUsername: (name: string) => Promise<UsernameClaimResult>;
  sectionStyle: CSSProperties;
  labelStyle: CSSProperties;
  inputStyle: CSSProperties;
  debounceMs?: number;
}

export function UsernameSection({
  currentUsername,
  checkAvailable,
  setUsername,
  sectionStyle,
  labelStyle,
  inputStyle,
  debounceMs = 300,
}: UsernameSectionProps) {
  const [value, setValue] = useState(currentUsername ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const normalized = normalizeUsername(value);
  const format = validateUsername(value);
  const unchanged = normalized === (currentUsername ?? '');

  const { status: availability, markTaken } = useUsernameAvailability({
    checkAvailable,
    name: normalized,
    eligible: format.valid && !unchanged,
    debounceMs,
  });

  const canSave =
    format.valid && !unchanged && availability === 'available' && !submitting;

  const status = (() => {
    if (unchanged) return 'This is your current username';
    if (!format.valid) return format.reason ?? null;
    if (availability === 'checking') return 'Checking…';
    if (availability === 'available') return 'Available';
    if (availability === 'taken') return 'Taken';
    return null;
  })();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await setUsername(normalized);
    setSubmitting(false);
    if (result.ok) {
      toast.success('Username updated.');
      return;
    }
    if (result.reason === 'taken') {
      markTaken();
      setSubmitError('That username was just taken. Try another.');
    } else {
      setSubmitError('That username isn’t valid.');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={sectionStyle}>
      <p style={labelStyle}>USERNAME</p>
      <div className="flex flex-col gap-2">
        <p
          className="text-xs"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          This is your notepad address.
        </p>
        <input
          type="text"
          aria-label="Username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSubmitError(null);
          }}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={inputStyle}
        />
        {status && (
          <p
            className="text-xs"
            style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
          >
            {status}
          </p>
        )}
        {submitError && (
          <p
            className="text-xs"
            style={{ color: '#b3261e', fontFamily: 'Outfit, sans-serif' }}
          >
            {submitError}
          </p>
        )}
        <button
          type="submit"
          disabled={!canSave}
          className="self-end px-5 py-2 rounded-lg text-xs font-medium transition-opacity"
          style={{
            background: 'var(--deep-umber)',
            color: 'var(--plaster)',
            fontFamily: 'Outfit, sans-serif',
            opacity: canSave ? 1 : 0.6,
          }}
        >
          {submitting ? 'Saving…' : 'Save Username'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/auth/components/UsernameSection.test.tsx`
Expected: PASS (5 tests). The `await waitFor(...)` / `findByText(...)` calls handle
the availability hook's async resolution (tests pass `debounceMs={0}`).

- [ ] **Step 5: Commit**

```bash
git add src/auth/components/UsernameSection.tsx src/auth/components/UsernameSection.test.tsx
git commit -m "feat(profile): UsernameSection — view and change username with live availability"
```

---

## Task 2: Render `UsernameSection` on the Profile page + verify

**Files:**
- Modify: `src/auth/ProfilePage.tsx`

- [ ] **Step 1: Add the import**

In `src/auth/ProfilePage.tsx`, after the existing
`import { LamplightSettingsSection } from './components/LamplightSettingsSection';`
line (near the other `./components/...` imports), add:

```tsx
import { UsernameSection } from './components/UsernameSection';
```

- [ ] **Step 2: Render the section after the PROFILE section**

In the JSX, find the Auth Management section anchor:

```tsx
        {/* Auth Management */}
        <SecuritySection
```

and replace it with (insert the Username section immediately before it):

```tsx
        {/* Username */}
        <UsernameSection
          currentUsername={profile?.username ?? null}
          checkAvailable={account.checkUsernameAvailable}
          setUsername={account.setUsername}
          sectionStyle={sectionStyle}
          labelStyle={labelStyle}
          inputStyle={inputStyle}
        />

        {/* Auth Management */}
        <SecuritySection
```

(`sectionStyle`, `labelStyle`, and `inputStyle` are already defined in
`ProfilePage`; `profile` and `account` come from the existing
`const { profile, account } = useAccountProfile();`. `account.checkUsernameAvailable`
and `account.setUsername` are bound arrow-method properties, so passing them as props
preserves `this`.)

- [ ] **Step 3: Typecheck the wiring**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "ProfilePage|UsernameSection" || echo "no type errors in touched files"`
Expected: `no type errors in touched files` (confirms `profile.username` exists on
the profile type and the prop types line up). If `tsc` reports unrelated pre-existing
errors elsewhere, ignore them — only the touched files matter.

- [ ] **Step 4: Run the full auth suite**

Run: `npx vitest run src/auth`
Expected: PASS — new `UsernameSection` tests green, all existing auth tests unaffected.

- [ ] **Step 5: Lint the touched files**

Run: `npx eslint src/auth/components/UsernameSection.tsx src/auth/components/UsernameSection.test.tsx src/auth/ProfilePage.tsx`
Expected: no errors. (Do NOT run repo-wide `npm run lint` — it has unrelated
pre-existing errors.)

- [ ] **Step 6: Commit**

```bash
git add src/auth/ProfilePage.tsx
git commit -m "feat(profile): show the editable username section on the Profile page"
```

---

## Self-Review Notes

- **Spec coverage:** dedicated USERNAME section (Task 2 Step 2), live availability via
  `useUsernameAvailability` (Task 1 Step 3), `!unchanged` gate + "current username"
  status (Task 1 Step 3 + test 1), `canSave` requires `available` (Task 1 Step 3),
  save via `setUsername` with taken/invalid handling + `markTaken` (Task 1 Step 3 +
  tests), reuse of primitives not the full-screen `UsernameSetup` (imports only the
  hook/rules), wiring with existing style tokens (Task 2). All covered.
- **Type consistency:** `UsernameSectionProps` (`currentUsername`, `checkAvailable`,
  `setUsername`, `sectionStyle`, `labelStyle`, `inputStyle`, `debounceMs?`) matches
  both the test `renderSection` props and the ProfilePage render. `UsernameClaimResult`
  / `AvailabilityStatus` come from the existing modules.
- **No placeholders:** every code step is complete.
- **Manual note:** the live Profile page needs a real authenticated session, so this is
  verified via the component tests + full auth suite rather than the local preview.
