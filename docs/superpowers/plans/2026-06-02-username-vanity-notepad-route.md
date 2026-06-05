# Username + Private Vanity Notepad Route — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every signed-in user a unique, DB-enforced username and a private vanity notepad route `/notepad/u/<username>`, picked on first visit, with live as-you-type availability.

**Architecture:** Add a `username` column + uniqueness + a `check_username_available` RPC to Supabase. A pure `validateUsername` util enforces format/reserved words. `AccountProfile` gains `checkUsernameAvailable` and `setUsername`. A pure `computeUsernameGate` + `useUsernameGate` hook classify the signed-in/username state; two thin route components (`LegacyNotepadRoute` for `/notepad/notes`, `VanityNotepadRoute` for `/notepad/u/:username`) render the editor, the picker (`UsernameSetup`), a spinner, or a redirect. Signed-out users keep using `/notepad/notes` locally — the gate only engages when signed in.

**Tech Stack:** React 19, React Router v7, Supabase (Postgres + RLS + RPC), Vitest + @testing-library/react.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/migrations/018_profiles_username.sql` | `username` column, unique index on `lower(username)`, `check_username_available` RPC + grant | Create |
| `src/auth/username/username-rules.ts` | Pure `normalizeUsername`, `validateUsername`, `RESERVED_USERNAMES`, `UsernameClaimResult` type | Create |
| `src/auth/username/username-rules.test.ts` | Unit tests for the rules | Create |
| `src/auth/types.ts` | Add `username: string \| null` to `UserProfile` | Modify |
| `src/auth/profile/account-profile.ts` | Map `username`; add `checkUsernameAvailable`, `setUsername` | Modify |
| `src/auth/profile/account-profile.test.ts` | Extend fake client (rpc + update error); username tests | Modify |
| `src/auth/username/username-gate.ts` | `UsernameGate` type, pure `computeUsernameGate`, `useUsernameGate` hook | Create |
| `src/auth/username/username-gate.test.ts` | Unit tests for `computeUsernameGate` | Create |
| `src/auth/username/UsernameSetup.tsx` | Presentational picker (input + live availability + submit) | Create |
| `src/auth/username/UsernameSetup.test.tsx` | Component tests for the picker state machine | Create |
| `src/auth/username/UsernameClaim.tsx` | Connects `UsernameSetup` to `AccountProfile` + navigation | Create |
| `src/auth/username/NotepadRoutes.tsx` | `LegacyNotepadRoute`, `VanityNotepadRoute`, gate spinner | Create |
| `src/auth/username/NotepadRoutes.test.tsx` | Route gating/redirect tests (mocked gate) | Create |
| `src/App.tsx` | Wire new routes; extend notepad-editor layout detection | Modify |

---

## Task 1: Username rules (pure, unit-tested)

**Files:**
- Create: `src/auth/username/username-rules.ts`
- Test: `src/auth/username/username-rules.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/auth/username/username-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeUsername, validateUsername, RESERVED_USERNAMES } from './username-rules';

describe('normalizeUsername', () => {
  it('trims and lowercases', () => {
    expect(normalizeUsername('  Natalie  ')).toBe('natalie');
  });
});

describe('validateUsername', () => {
  it('accepts a simple valid name', () => {
    expect(validateUsername('natalie')).toEqual({ valid: true });
  });

  it('accepts letters, numbers, underscores within length', () => {
    expect(validateUsername('quiet_cedar_42')).toEqual({ valid: true });
  });

  it('normalizes case before validating', () => {
    expect(validateUsername('Natalie')).toEqual({ valid: true });
  });

  it('rejects fewer than 3 characters', () => {
    const r = validateUsername('ab');
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/at least 3/i);
  });

  it('rejects more than 30 characters', () => {
    const r = validateUsername('a'.repeat(31));
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/30 characters/i);
  });

  it('rejects disallowed characters', () => {
    const r = validateUsername('has space');
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/lowercase letters, numbers/i);
  });

  it('rejects hyphens', () => {
    expect(validateUsername('no-hyphens').valid).toBe(false);
  });

  it('rejects reserved words', () => {
    for (const word of RESERVED_USERNAMES) {
      expect(validateUsername(word).valid).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/auth/username/username-rules.test.ts`
Expected: FAIL — cannot find module `./username-rules`.

- [ ] **Step 3: Write minimal implementation**

Create `src/auth/username/username-rules.ts`:

```ts
const USERNAME_PATTERN = /^[a-z0-9_]+$/;

/** Usernames that collide with route segments or are otherwise off-limits. */
export const RESERVED_USERNAMES = new Set([
  'u',
  'notes',
  'note',
  'shared',
  'admin',
  'api',
  'settings',
  'account',
  'signin',
  'signup',
  'lamplight',
]);

export interface UsernameValidation {
  valid: boolean;
  reason?: string;
}

export type UsernameClaimResult =
  | { ok: true }
  | { ok: false; reason: 'taken' | 'invalid' };

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): UsernameValidation {
  const name = normalizeUsername(raw);
  if (name.length < 3) return { valid: false, reason: 'Must be at least 3 characters.' };
  if (name.length > 30) return { valid: false, reason: 'Must be 30 characters or fewer.' };
  if (!USERNAME_PATTERN.test(name)) {
    return { valid: false, reason: 'Use only lowercase letters, numbers, and underscores.' };
  }
  if (RESERVED_USERNAMES.has(name)) return { valid: false, reason: 'That username is reserved.' };
  return { valid: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/auth/username/username-rules.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/auth/username/username-rules.ts src/auth/username/username-rules.test.ts
git commit -m "feat(notepad): pure username validation rules"
```

---

## Task 2: Database migration (column + uniqueness + RPC)

**Files:**
- Create: `supabase/migrations/018_profiles_username.sql`

> No TDD here — this is SQL applied by Supabase. Behavioral confidence for the TS layer comes from Tasks 3–6 (fake-client unit tests). This task delivers the schema those layers assume.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/018_profiles_username.sql`:

```sql
-- 018_profiles_username.sql — per-user vanity username for the notepad route.
--
-- Adds a nullable `username` to profiles (existing rows stay null until the
-- user picks one on first notepad visit). Uniqueness is case-insensitive via a
-- unique index on lower(username) so 'Natalie' and 'natalie' cannot coexist.
-- check_username_available() returns only a boolean — it never leaks who owns a
-- name — so it is safe to grant to `authenticated` and power the live picker.

alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create or replace function public.check_username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
      from public.profiles
     where lower(username) = lower(trim(candidate))
  );
$$;

grant execute on function public.check_username_available(text) to authenticated;
```

- [ ] **Step 2: Apply and verify locally**

Run: `npx supabase db reset`
Expected: all migrations apply through `018_profiles_username.sql` with no error. (If a local Supabase stack is not running, apply against the linked project with `npx supabase db push` and confirm "Applying migration 018_profiles_username.sql".)

- [ ] **Step 3: Sanity-check the RPC**

Run (psql against the local DB, or the Supabase SQL editor):
```sql
select public.check_username_available('definitely_unclaimed_name');
```
Expected: `true`. Insert a username on a test profile row and re-run with that value — expected `false`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/018_profiles_username.sql
git commit -m "feat(notepad): username column, unique index, availability RPC"
```

---

## Task 3: Profile data layer — map username, add availability + claim

**Files:**
- Modify: `src/auth/types.ts`
- Modify: `src/auth/profile/account-profile.ts`
- Test: `src/auth/profile/account-profile.test.ts` (extend existing fake + add tests)

- [ ] **Step 1: Write the failing tests**

In `src/auth/profile/account-profile.test.ts`, make these edits:

(a) Add `username` to the `ProfileRow` interface (after `id`):
```ts
  id: string;
  username: string | null;
```

(b) Add fields to `FakeProfilesTable`:
```ts
class FakeProfilesTable {
  rows: ProfileRow[] = [];
  fetchError: { message: string } | null = null;
  updateError: { code?: string; message: string } | null = null;
  rpcError: { message: string } | null = null;
  usernameAvailable = true;
  rpcCalls: Array<{ name: string; params: unknown }> = [];
  uploadCalls: Array<{ path: string; upsert: boolean }> = [];
  removeCalls: string[][] = [];
  updateCalls: Array<{ id: string; updates: Record<string, unknown> }> = [];
  deleteCalls: string[] = [];
}
```

(c) Honor `updateError` inside the fake client's `update().eq()`:
```ts
        update(updates: Record<string, unknown>) {
          return {
            async eq(_col: string, id: string) {
              table.updateCalls.push({ id, updates });
              if (table.updateError) return { error: table.updateError };
              const row = table.rows.find((r) => r.id === id);
              if (row) Object.assign(row, updates);
              return { error: null };
            },
          };
        },
```

(d) Add an `rpc` method to the fake `client` object (sibling of `from`, `storage`):
```ts
    async rpc(name: string, params: unknown) {
      table.rpcCalls.push({ name, params });
      if (name === 'check_username_available') {
        if (table.rpcError) return { data: null, error: table.rpcError };
        return { data: table.usernameAvailable, error: null };
      }
      throw new Error(`Unexpected rpc: ${name}`);
    },
```

(e) Add `username: null` to `makeRow`'s defaults (after `id: 'user-1',`):
```ts
    id: 'user-1',
    username: null,
```

(f) Append this describe block at the end of the file:
```ts
describe('AccountProfile — username', () => {
  let local: StorageAdapter;
  let table: FakeProfilesTable;

  beforeEach(() => {
    local = new FakeStorageAdapter();
    table = new FakeProfilesTable();
  });

  async function signedInProfile() {
    const { client, auth } = makeFakeClient(table);
    table.rows.push(makeRow({ id: 'user-1' }));
    const session = new AuthSession(client, local, new FakeOAuthProbe());
    const profile = new AccountProfile(client, session);
    session.init();
    profile.init();
    await flush();
    auth.emit('SIGNED_IN', { user: makeUser('user-1') });
    await flush();
    return { profile };
  }

  it('checkUsernameAvailable returns true when the RPC says available', async () => {
    const { profile } = await signedInProfile();
    table.usernameAvailable = true;
    await expect(profile.checkUsernameAvailable('Natalie')).resolves.toBe(true);
    expect(table.rpcCalls[0]).toEqual({
      name: 'check_username_available',
      params: { candidate: 'natalie' },
    });
  });

  it('checkUsernameAvailable returns false when the RPC says taken', async () => {
    const { profile } = await signedInProfile();
    table.usernameAvailable = false;
    await expect(profile.checkUsernameAvailable('natalie')).resolves.toBe(false);
  });

  it('checkUsernameAvailable throws when the RPC errors', async () => {
    const { profile } = await signedInProfile();
    table.rpcError = { message: 'boom' };
    await expect(profile.checkUsernameAvailable('natalie')).rejects.toBeDefined();
  });

  it('setUsername writes the normalized username and refetches', async () => {
    const { profile } = await signedInProfile();
    const result = await profile.setUsername('  Natalie  ');
    expect(result).toEqual({ ok: true });
    expect(table.updateCalls[0]).toEqual({ id: 'user-1', updates: { username: 'natalie' } });
    expect(profile.getSnapshot().profile?.username).toBe('natalie');
  });

  it('setUsername maps a unique-violation to { ok: false, reason: "taken" }', async () => {
    const { profile } = await signedInProfile();
    table.updateError = { code: '23505', message: 'duplicate key' };
    await expect(profile.setUsername('natalie')).resolves.toEqual({ ok: false, reason: 'taken' });
  });

  it('setUsername rejects invalid format without touching the DB', async () => {
    const { profile } = await signedInProfile();
    await expect(profile.setUsername('no')).resolves.toEqual({ ok: false, reason: 'invalid' });
    expect(table.updateCalls).toHaveLength(0);
  });

  it('setUsername throws when not authenticated', async () => {
    const { client } = makeFakeClient(table);
    const session = new AuthSession(client, local, new FakeOAuthProbe());
    const profile = new AccountProfile(client, session);
    session.init();
    profile.init();
    await expect(profile.setUsername('natalie')).rejects.toThrow(/not authenticated/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/auth/profile/account-profile.test.ts`
Expected: FAIL — `profile.checkUsernameAvailable`/`setUsername` are not functions; `mapProfile` does not set `username`.

- [ ] **Step 3: Implement the data layer**

(a) In `src/auth/types.ts`, add `username` to `UserProfile`:
```ts
export interface UserProfile {
  id: string;
  username: string | null;
  fullName: string;
  dateOfBirth: string | null;
  avatarUrl: string | null;
  noteCount: number;
  highestNoteCount: number;
  createdAt: string;
  updatedAt: string;
}
```

(b) In `src/auth/profile/account-profile.ts`, add the import at the top (after existing imports):
```ts
import { normalizeUsername, validateUsername } from '@/auth/username/username-rules';
import type { UsernameClaimResult } from '@/auth/username/username-rules';
```

(c) In `mapProfile`, set `username` (add as the second property, after `id`):
```ts
    id: row.id as string,
    username: (row.username as string | null) ?? null,
```

(d) Add two methods to the `AccountProfile` class (place them after `uploadAvatar`, before `private handleSessionChange`):
```ts
  checkUsernameAvailable = async (name: string): Promise<boolean> => {
    if (!this.client) throw new Error('Supabase not configured');
    const candidate = normalizeUsername(name);
    const { data, error } = await this.client.rpc('check_username_available', { candidate });
    if (error) throw error;
    return data === true;
  };

  setUsername = async (name: string): Promise<UsernameClaimResult> => {
    const userId = this.session.getSnapshot().user?.id;
    if (!this.client || !userId) throw new Error('Not authenticated');
    const candidate = normalizeUsername(name);
    if (!validateUsername(candidate).valid) return { ok: false, reason: 'invalid' };
    const { error } = await this.client
      .from('profiles')
      .update({ username: candidate })
      .eq('id', userId);
    if (error) {
      if ((error as { code?: string }).code === '23505') return { ok: false, reason: 'taken' };
      throw error;
    }
    await this.fetchProfile(userId);
    return { ok: true };
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/auth/profile/account-profile.test.ts`
Expected: PASS (existing tests still green; new username block green).

- [ ] **Step 5: Commit**

```bash
git add src/auth/types.ts src/auth/profile/account-profile.ts src/auth/profile/account-profile.test.ts
git commit -m "feat(notepad): AccountProfile username availability + claim"
```

---

## Task 4: Username gate (pure classifier + hook)

**Files:**
- Create: `src/auth/username/username-gate.ts`
- Test: `src/auth/username/username-gate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/auth/username/username-gate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeUsernameGate } from './username-gate';

describe('computeUsernameGate', () => {
  it('is loading while the session resolves', () => {
    expect(
      computeUsernameGate({ sessionLoading: true, hasUser: false, profileStatus: 'missing', username: null }),
    ).toEqual({ kind: 'loading' });
  });

  it('is signed-out when there is no user', () => {
    expect(
      computeUsernameGate({ sessionLoading: false, hasUser: false, profileStatus: 'missing', username: null }),
    ).toEqual({ kind: 'signed-out' });
  });

  it('is loading while the profile loads', () => {
    expect(
      computeUsernameGate({ sessionLoading: false, hasUser: true, profileStatus: 'loading', username: null }),
    ).toEqual({ kind: 'loading' });
  });

  it('needs-username when loaded with no username', () => {
    expect(
      computeUsernameGate({ sessionLoading: false, hasUser: true, profileStatus: 'loaded', username: null }),
    ).toEqual({ kind: 'needs-username' });
  });

  it('is ready when loaded with a username', () => {
    expect(
      computeUsernameGate({ sessionLoading: false, hasUser: true, profileStatus: 'loaded', username: 'natalie' }),
    ).toEqual({ kind: 'ready', username: 'natalie' });
  });

  it('treats a transient missing/error profile as loading (row exists via trigger)', () => {
    expect(
      computeUsernameGate({ sessionLoading: false, hasUser: true, profileStatus: 'missing', username: null }).kind,
    ).toBe('loading');
    expect(
      computeUsernameGate({ sessionLoading: false, hasUser: true, profileStatus: 'error', username: null }).kind,
    ).toBe('loading');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/auth/username/username-gate.test.ts`
Expected: FAIL — cannot find module `./username-gate`.

- [ ] **Step 3: Implement the gate**

Create `src/auth/username/username-gate.ts`:

```ts
import type { ProfileStatus } from '@/auth/types';
import { useAuthSession } from '@/auth/context/useAuthSession';
import { useAccountProfile } from '@/auth/context/useAccountProfile';

export type UsernameGate =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'needs-username' }
  | { kind: 'ready'; username: string };

export interface UsernameGateInput {
  sessionLoading: boolean;
  hasUser: boolean;
  profileStatus: ProfileStatus;
  username: string | null;
}

/**
 * Pure classifier for the notepad username gate. A signed-in user always has a
 * profile row (created by the on_auth_user_created trigger), so `missing`/`error`
 * are transient and map to `loading` rather than flashing the picker or leaking
 * the editor.
 */
export function computeUsernameGate(input: UsernameGateInput): UsernameGate {
  if (input.sessionLoading) return { kind: 'loading' };
  if (!input.hasUser) return { kind: 'signed-out' };
  if (input.profileStatus !== 'loaded') return { kind: 'loading' };
  if (!input.username) return { kind: 'needs-username' };
  return { kind: 'ready', username: input.username };
}

export function useUsernameGate(): UsernameGate {
  const { user, loading } = useAuthSession();
  const { profile, profileStatus } = useAccountProfile();
  return computeUsernameGate({
    sessionLoading: loading,
    hasUser: !!user,
    profileStatus,
    username: profile?.username ?? null,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/auth/username/username-gate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/username/username-gate.ts src/auth/username/username-gate.test.ts
git commit -m "feat(notepad): username gate classifier + hook"
```

---

## Task 5: UsernameSetup picker component

**Files:**
- Create: `src/auth/username/UsernameSetup.tsx`
- Test: `src/auth/username/UsernameSetup.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/auth/username/UsernameSetup.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UsernameSetup } from './UsernameSetup';

function setup(overrides: Partial<React.ComponentProps<typeof UsernameSetup>> = {}) {
  const checkAvailable = overrides.checkAvailable ?? vi.fn().mockResolvedValue(true);
  const claim = overrides.claim ?? vi.fn().mockResolvedValue({ ok: true });
  const onClaimed = overrides.onClaimed ?? vi.fn();
  render(
    <UsernameSetup
      checkAvailable={checkAvailable}
      claim={claim}
      onClaimed={onClaimed}
      debounceMs={0}
      {...overrides}
    />,
  );
  return { checkAvailable, claim, onClaimed };
}

describe('UsernameSetup', () => {
  it('disables submit and shows a hint for too-short input', () => {
    setup();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ab' } });
    expect(screen.getByText(/at least 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /claim/i })).toBeDisabled();
  });

  it('shows availability and enables submit for a free valid name', async () => {
    const { checkAvailable } = setup({ checkAvailable: vi.fn().mockResolvedValue(true) });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'natalie' } });
    await waitFor(() => expect(checkAvailable).toHaveBeenCalledWith('natalie'));
    expect(await screen.findByText(/available/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /claim/i })).toBeEnabled();
  });

  it('shows taken and disables submit when the name is taken', async () => {
    setup({ checkAvailable: vi.fn().mockResolvedValue(false) });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'natalie' } });
    expect(await screen.findByText(/taken/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /claim/i })).toBeDisabled();
  });

  it('calls onClaimed with the normalized name on successful submit', async () => {
    const { onClaimed } = setup({
      checkAvailable: vi.fn().mockResolvedValue(true),
      claim: vi.fn().mockResolvedValue({ ok: true }),
    });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Natalie' } });
    await screen.findByText(/available/i);
    fireEvent.click(screen.getByRole('button', { name: /claim/i }));
    await waitFor(() => expect(onClaimed).toHaveBeenCalledWith('natalie'));
  });

  it('surfaces a race when the name is taken at submit time', async () => {
    setup({
      checkAvailable: vi.fn().mockResolvedValue(true),
      claim: vi.fn().mockResolvedValue({ ok: false, reason: 'taken' }),
    });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'natalie' } });
    await screen.findByText(/available/i);
    fireEvent.click(screen.getByRole('button', { name: /claim/i }));
    expect(await screen.findByText(/just taken/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/auth/username/UsernameSetup.test.tsx`
Expected: FAIL — cannot find module `./UsernameSetup`.

- [ ] **Step 3: Implement the component**

Create `src/auth/username/UsernameSetup.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { normalizeUsername, validateUsername } from './username-rules';
import type { UsernameClaimResult } from './username-rules';

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export interface UsernameSetupProps {
  checkAvailable: (name: string) => Promise<boolean>;
  claim: (name: string) => Promise<UsernameClaimResult>;
  onClaimed: (username: string) => void;
  debounceMs?: number;
}

export function UsernameSetup({ checkAvailable, claim, onClaimed, debounceMs = 300 }: UsernameSetupProps) {
  const [value, setValue] = useState('');
  const [availability, setAvailability] = useState<Availability>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const normalized = normalizeUsername(value);
  const format = validateUsername(value);

  useEffect(() => {
    if (!format.valid) {
      setAvailability('idle');
      return;
    }
    let cancelled = false;
    setAvailability('checking');
    const handle = setTimeout(() => {
      checkAvailable(normalized)
        .then((ok) => {
          if (!cancelled) setAvailability(ok ? 'available' : 'taken');
        })
        .catch(() => {
          // Fail open — the submit-time unique constraint is the real guard.
          if (!cancelled) setAvailability('error');
        });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [normalized, format.valid, checkAvailable, debounceMs]);

  const canSubmit =
    format.valid && !submitting && availability !== 'taken' && availability !== 'checking';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!format.valid) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await claim(normalized);
    setSubmitting(false);
    if (result.ok) {
      onClaimed(normalized);
      return;
    }
    if (result.reason === 'taken') {
      setAvailability('taken');
      setSubmitError('That username was just taken. Try another.');
    } else {
      setSubmitError('That username isn’t valid.');
    }
  }

  const status = (() => {
    if (!value) return null;
    if (!format.valid) return format.reason;
    if (availability === 'checking') return 'Checking…';
    if (availability === 'available') return 'Available';
    if (availability === 'taken') return 'Taken';
    return null;
  })();

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Choose your username</h1>
          <p className="text-sm text-mersi-dark/60">
            This is your private notepad address — you can share notes from it later.
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor="username" className="text-sm font-medium">
            Username
          </label>
          <input
            id="username"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          />
          {status && <p className="text-sm text-mersi-dark/70">{status}</p>}
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-md bg-mersi-dark px-4 py-2 text-white disabled:opacity-50"
        >
          Claim username
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/auth/username/UsernameSetup.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/username/UsernameSetup.tsx src/auth/username/UsernameSetup.test.tsx
git commit -m "feat(notepad): username picker with live availability"
```

---

## Task 6: Route components + App wiring

**Files:**
- Create: `src/auth/username/UsernameClaim.tsx`
- Create: `src/auth/username/NotepadRoutes.tsx`
- Test: `src/auth/username/NotepadRoutes.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/auth/username/NotepadRoutes.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { UsernameGate } from './username-gate';

// Mocks must be declared before importing the module under test.
let mockGate: UsernameGate = { kind: 'loading' };
vi.mock('./username-gate', () => ({
  useUsernameGate: () => mockGate,
}));
vi.mock('@/components/sections/Notepad', () => ({
  Notepad: () => <div>EDITOR</div>,
}));
vi.mock('./UsernameClaim', () => ({
  UsernameClaim: () => <div>PICKER</div>,
}));

import { LegacyNotepadRoute, VanityNotepadRoute } from './NotepadRoutes';

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/notepad/notes" element={<LegacyNotepadRoute />} />
        <Route path="/notepad/u/:username" element={<VanityNotepadRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LegacyNotepadRoute (/notepad/notes)', () => {
  beforeEach(() => {
    mockGate = { kind: 'loading' };
  });

  it('renders the editor for signed-out users (local mode)', () => {
    mockGate = { kind: 'signed-out' };
    renderAt('/notepad/notes');
    expect(screen.getByText('EDITOR')).toBeInTheDocument();
  });

  it('renders the picker when a username is needed', () => {
    mockGate = { kind: 'needs-username' };
    renderAt('/notepad/notes');
    expect(screen.getByText('PICKER')).toBeInTheDocument();
  });

  it('redirects a signed-in user with a username to their vanity route', () => {
    mockGate = { kind: 'ready', username: 'natalie' };
    renderAt('/notepad/notes');
    expect(screen.getByText('EDITOR')).toBeInTheDocument(); // vanity route renders editor for the owner
  });
});

describe('VanityNotepadRoute (/notepad/u/:username)', () => {
  it('renders the editor when the param matches the owner', () => {
    mockGate = { kind: 'ready', username: 'natalie' };
    renderAt('/notepad/u/natalie');
    expect(screen.getByText('EDITOR')).toBeInTheDocument();
  });

  it('redirects to the owner route when the param does not match', () => {
    mockGate = { kind: 'ready', username: 'natalie' };
    renderAt('/notepad/u/someone_else');
    // redirected to /notepad/u/natalie which renders the editor for the owner
    expect(screen.getByText('EDITOR')).toBeInTheDocument();
  });

  it('redirects signed-out users back to /notepad/notes (local mode)', () => {
    mockGate = { kind: 'signed-out' };
    renderAt('/notepad/u/whoever');
    // /notepad/notes renders the editor for signed-out (local) users
    expect(screen.getByText('EDITOR')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/auth/username/NotepadRoutes.test.tsx`
Expected: FAIL — cannot find module `./NotepadRoutes`.

- [ ] **Step 3: Implement the connected picker**

Create `src/auth/username/UsernameClaim.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { useAccountProfile } from '@/auth/context/useAccountProfile';
import { UsernameSetup } from './UsernameSetup';

/** Wires the presentational picker to AccountProfile + navigation. */
export function UsernameClaim() {
  const { account } = useAccountProfile();
  const navigate = useNavigate();
  return (
    <UsernameSetup
      checkAvailable={account.checkUsernameAvailable}
      claim={account.setUsername}
      onClaimed={(username) => navigate(`/notepad/u/${username}`, { replace: true })}
    />
  );
}
```

- [ ] **Step 4: Implement the route components**

Create `src/auth/username/NotepadRoutes.tsx`:

```tsx
import { Navigate, useParams } from 'react-router-dom';
import { Notepad } from '@/components/sections/Notepad';
import { useUsernameGate } from './username-gate';
import { UsernameClaim } from './UsernameClaim';
import { normalizeUsername } from './username-rules';

function NotepadGateSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-mersi-dark/60">Loading…</p>
    </div>
  );
}

/** /notepad/notes — legacy entry. Signed-out users stay here (local mode). */
export function LegacyNotepadRoute() {
  const gate = useUsernameGate();
  switch (gate.kind) {
    case 'loading':
      return <NotepadGateSpinner />;
    case 'signed-out':
      return <Notepad />;
    case 'needs-username':
      return <UsernameClaim />;
    case 'ready':
      return <Navigate to={`/notepad/u/${gate.username}`} replace />;
  }
}

/** /notepad/u/:username — private vanity editor, owner-only. */
export function VanityNotepadRoute() {
  const gate = useUsernameGate();
  const { username: param } = useParams();
  switch (gate.kind) {
    case 'loading':
      return <NotepadGateSpinner />;
    case 'signed-out':
      return <Navigate to="/notepad/notes" replace />;
    case 'needs-username':
      return <UsernameClaim />;
    case 'ready':
      return normalizeUsername(param ?? '') === gate.username ? (
        <Notepad />
      ) : (
        <Navigate to={`/notepad/u/${gate.username}`} replace />
      );
  }
}
```

- [ ] **Step 5: Run the route test to verify it passes**

Run: `npx vitest run src/auth/username/NotepadRoutes.test.tsx`
Expected: PASS.

- [ ] **Step 6: Wire the routes into App.tsx**

In `src/App.tsx`:

(a) Add the import (next to the other section imports, after the `Notepad` import line):
```ts
import { LegacyNotepadRoute, VanityNotepadRoute } from '@/auth/username/NotepadRoutes';
```

(b) Extend the notepad-editor layout detection so `/notepad/u/...` is treated like the editor (hides footer/dock). Replace:
```ts
  const isNotepadEditor = location.pathname.startsWith('/notepad/notes');
```
with:
```ts
  const isNotepadEditor =
    location.pathname.startsWith('/notepad/notes') ||
    location.pathname.startsWith('/notepad/u/');
```

(c) Replace the notepad notes route and add the vanity route. Replace:
```tsx
            <Route path="/notepad/notes" element={<Notepad />} />
```
with:
```tsx
            <Route path="/notepad/notes" element={<LegacyNotepadRoute />} />
            <Route path="/notepad/u/:username" element={<VanityNotepadRoute />} />
```

> Note: the direct `import { Notepad }` in App.tsx is now only used through the route components, so the `Notepad` symbol becomes unused in App.tsx — remove its import line to satisfy the linter:
> ```ts
> import { Notepad } from '@/components/sections/Notepad';   // delete this line
> ```

(d) OAuth redirect (`src/auth/session/auth-session.ts`) needs **no change** — it targets `/notepad/notes`, which now resolves through `LegacyNotepadRoute` to the username route (or picker for new users). Leave it as-is.

- [ ] **Step 7: Run the full test suite + typecheck**

Run: `npx vitest run`
Expected: PASS (whole suite).

Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/auth/username/UsernameClaim.tsx src/auth/username/NotepadRoutes.tsx src/auth/username/NotepadRoutes.test.tsx src/App.tsx
git commit -m "feat(notepad): vanity /notepad/u/:username route + picker gate"
```

---

## Task 7: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the app**

Run: `npm run dev`

- [ ] **Step 2: Walk the flows** (use a throwaway account)

1. Sign in as a user **without** a username → at `/notepad/notes` you see the username picker; typing shows live *Checking…* → *Available*/*Taken*; claiming a free name lands you on `/notepad/u/<name>` with the editor.
2. Reload `/notepad/u/<name>` → editor loads directly (owner match).
3. Visit `/notepad/u/someone-else` → redirected to `/notepad/u/<name>`.
4. Visit `/notepad/notes` while signed in with a username → redirected to `/notepad/u/<name>`.
5. Sign out, visit `/notepad/notes` → local notepad still works (no picker, no redirect).
6. Sign out, visit `/notepad/u/<name>` → redirected to `/notepad/notes`.
7. Try to claim a username already held by another account → *just taken* error.

- [ ] **Step 3: Confirm and finish**

If all flows pass, the feature is complete. Use the `superpowers:finishing-a-development-branch` skill to decide how to integrate (merge / PR).

---

## Notes on Phase C (deferred)

Per the design, public per-note share links are **not** built here. When built, they live on a separate top-level public tree (e.g. `/u/<username>/n/<token>`) decoupled from this authenticated editor. The `username` column and `/notepad/u/<username>` namespace established here are the foundation that work will hang off of.
