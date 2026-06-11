# One-Time Welcome (No "Welcome Back") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a single "Welcome, {name}!" on the notes page exactly once at signup (any method), and remove the recurring "Welcome back" greeting entirely.

**Architecture:** The pure decision module `notepad-first-load.ts` replaces its recurring per-day `greet` action with a one-time `welcome` action, gated by a per-account `localStorage` flag instead of a per-day `sessionStorage` flag. The hook `useNotepadFirstLoad.tsx` is rewired to the new API and `localStorage`, and the duplicate toast on the `/welcome` onboarding page is removed so the notes page is the single source of the greeting.

**Tech Stack:** React + TypeScript, Vitest, `sonner` toasts, `localStorage`.

---

## File Structure

- `src/notepad/first-load/notepad-first-load.ts` — pure decision logic + storage helpers. Owns: what actions fire on first load, and the welcomed-once flag key/read/write.
- `src/notepad/first-load/notepad-first-load.test.ts` — unit tests for the above (full rewrite to the new API).
- `src/notepad/first-load/useNotepadFirstLoad.tsx` — React hook that runs the decision and performs side effects (navigate, toast, migration). No unit test exists for the hook; it's verified by tsc + lint + the module tests.
- `src/auth/WelcomePage.tsx` — remove the onboarding-page welcome toast (one line).

---

## Task 1: Replace the first-load decision logic + tests

**Files:**
- Modify: `src/notepad/first-load/notepad-first-load.ts`
- Test: `src/notepad/first-load/notepad-first-load.test.ts`

- [ ] **Step 1: Write the failing tests** — overwrite `src/notepad/first-load/notepad-first-load.test.ts` ENTIRELY with:

```ts
import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import {
  firstNameOf,
  welcomedOnceKey,
  hasBeenWelcomedOnce,
  markWelcomedOnce,
  decideFirstLoadActions,
} from './notepad-first-load';

interface FakeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  data: Map<string, string>;
}

function makeFakeStorage(): FakeStorage {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function makeUser(overrides: Partial<User> & { id: string }): User {
  return {
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as User;
}

describe('firstNameOf', () => {
  it('returns the first word of full_name when present', () => {
    const user = makeUser({ id: 'u1', user_metadata: { full_name: 'Ada Lovelace' } });
    expect(firstNameOf(user)).toBe('Ada');
  });

  it('returns just the full_name when it has no spaces', () => {
    const user = makeUser({ id: 'u1', user_metadata: { full_name: 'Plato' } });
    expect(firstNameOf(user)).toBe('Plato');
  });

  it('falls back to the email local-part when full_name is empty', () => {
    const user = makeUser({ id: 'u1', email: 'grace@hopper.dev', user_metadata: {} });
    expect(firstNameOf(user)).toBe('grace');
  });

  it('returns null when neither full_name nor email is available', () => {
    const user = makeUser({ id: 'u1', email: undefined, user_metadata: {} });
    expect(firstNameOf(user)).toBeNull();
  });

  it('falls back to email when full_name is whitespace only', () => {
    const user = makeUser({
      id: 'u1',
      email: 'ada@ex.com',
      user_metadata: { full_name: '   ' },
    });
    expect(firstNameOf(user)).toBe('ada');
  });
});

describe('welcomed-once storage', () => {
  it('welcomedOnceKey embeds the user id (no date)', () => {
    expect(welcomedOnceKey('user-42')).toBe('welcomed_once_user-42');
  });

  it('hasBeenWelcomedOnce returns false when the key is absent', () => {
    const storage = makeFakeStorage();
    expect(hasBeenWelcomedOnce('u1', storage)).toBe(false);
  });

  it('returns true after markWelcomedOnce for the same user', () => {
    const storage = makeFakeStorage();
    markWelcomedOnce('u1', storage);
    expect(hasBeenWelcomedOnce('u1', storage)).toBe(true);
  });

  it('is scoped per-user', () => {
    const storage = makeFakeStorage();
    markWelcomedOnce('u1', storage);
    expect(hasBeenWelcomedOnce('u2', storage)).toBe(false);
  });
});

describe('decideFirstLoadActions — gating', () => {
  it('returns no actions while authLoading', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: true,
        profileLoading: false,
        hasBeenWelcomed: false,
        hasBeenWelcomedOnce: false,
        localNoteCount: 5,
      }),
    ).toEqual([]);
  });

  it('returns no actions when user is null', () => {
    expect(
      decideFirstLoadActions({
        user: null,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: true,
        hasBeenWelcomedOnce: false,
        localNoteCount: 5,
      }),
    ).toEqual([]);
  });

  it('returns no actions while profileLoading', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: true,
        hasBeenWelcomed: false,
        hasBeenWelcomedOnce: false,
        localNoteCount: 5,
      }),
    ).toEqual([]);
  });
});

describe('decideFirstLoadActions — welcome redirect short-circuits the greeting', () => {
  it('first sign-in (no welcomed flag): emits redirect-welcome only', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: false,
        hasBeenWelcomedOnce: false,
        localNoteCount: 0,
      }),
    ).toEqual([{ kind: 'redirect-welcome' }]);
  });

  it('first sign-in with local notes: emits redirect-welcome AND offer-migration', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: false,
        hasBeenWelcomedOnce: false,
        localNoteCount: 3,
      }),
    ).toEqual([{ kind: 'redirect-welcome' }, { kind: 'offer-migration' }]);
  });
});

describe('decideFirstLoadActions — one-time welcome', () => {
  it('welcomed and not welcomed-once: emits welcome with firstName', () => {
    const user = makeUser({
      id: 'u1',
      user_metadata: { full_name: 'Grace Hopper' },
      email: 'grace@hopper.dev',
    });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: true,
        hasBeenWelcomedOnce: false,
        localNoteCount: 0,
      }),
    ).toEqual([{ kind: 'welcome', firstName: 'Grace' }]);
  });

  it('emits welcome with firstName: null when user has no name or email', () => {
    const user = makeUser({ id: 'u1', email: undefined, user_metadata: {} });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: true,
        hasBeenWelcomedOnce: false,
        localNoteCount: 0,
      }),
    ).toEqual([{ kind: 'welcome', firstName: null }]);
  });

  it('welcomed and already welcomed-once: emits no greeting', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: true,
        hasBeenWelcomedOnce: true,
        localNoteCount: 0,
      }),
    ).toEqual([]);
  });

  it('welcomed, not welcomed-once, with local notes: emits welcome AND offer-migration in order', () => {
    const user = makeUser({ id: 'u1', email: 'ada@ex.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: true,
        hasBeenWelcomedOnce: false,
        localNoteCount: 1,
      }),
    ).toEqual([{ kind: 'welcome', firstName: 'ada' }, { kind: 'offer-migration' }]);
  });

  it('welcomed, already welcomed-once, with local notes: emits offer-migration only', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: false,
        hasBeenWelcomed: true,
        hasBeenWelcomedOnce: true,
        localNoteCount: 7,
      }),
    ).toEqual([{ kind: 'offer-migration' }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/notepad/first-load/notepad-first-load.test.ts`
Expected: FAIL — the module still exports the old `greetedKey`/`hasBeenGreetedToday`/`markGreetedToday`/`todayDateString` and a `greet` action, so the new imports (`welcomedOnceKey`, `hasBeenWelcomedOnce`, `markWelcomedOnce`) are undefined and the `welcome`-action assertions don't match.

- [ ] **Step 3: Replace the module** — overwrite `src/notepad/first-load/notepad-first-load.ts` ENTIRELY with:

```ts
import type { User } from '@supabase/supabase-js';

export type FirstLoadAction =
  | { kind: 'redirect-welcome' }
  | { kind: 'welcome'; firstName: string | null }
  | { kind: 'offer-migration' };

export interface FirstLoadInput {
  user: User | null;
  authLoading: boolean;
  profileLoading: boolean;
  hasBeenWelcomed: boolean;
  hasBeenWelcomedOnce: boolean;
  localNoteCount: number;
}

export function firstNameOf(user: User): string | null {
  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
  if (fullName) return fullName.split(/\s+/)[0];
  const email = user.email;
  if (email) return email.split('@')[0];
  return null;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const welcomedOnceKey = (userId: string): string =>
  `welcomed_once_${userId}`;

export const hasBeenWelcomedOnce = (
  userId: string,
  storage: StorageLike,
): boolean => storage.getItem(welcomedOnceKey(userId)) !== null;

export const markWelcomedOnce = (
  userId: string,
  storage: StorageLike,
): void => {
  storage.setItem(welcomedOnceKey(userId), 'true');
};

export function decideFirstLoadActions(input: FirstLoadInput): FirstLoadAction[] {
  const { user, authLoading, profileLoading, hasBeenWelcomed, hasBeenWelcomedOnce, localNoteCount } = input;
  if (authLoading || profileLoading || !user) return [];

  const actions: FirstLoadAction[] = [];
  if (!hasBeenWelcomed) {
    actions.push({ kind: 'redirect-welcome' });
  } else if (!hasBeenWelcomedOnce) {
    actions.push({ kind: 'welcome', firstName: firstNameOf(user) });
  }
  if (localNoteCount > 0) {
    actions.push({ kind: 'offer-migration' });
  }
  return actions;
}
```

Note: the destructured local `hasBeenWelcomedOnce` (boolean) intentionally shares its name with the exported helper `hasBeenWelcomedOnce` — this mirrors the existing module's prior `hasBeenGreetedToday` pattern and lints clean.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/notepad/first-load/notepad-first-load.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/first-load/notepad-first-load.ts src/notepad/first-load/notepad-first-load.test.ts
git commit -m "feat(onboarding): one-time welcome action, drop per-day greet

Replaces the recurring per-day 'greet' (Welcome back) with a one-time
'welcome' action gated by a per-account welcomed-once flag.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Rewire the hook + remove the onboarding-page toast

**Files:**
- Modify: `src/notepad/first-load/useNotepadFirstLoad.tsx`
- Modify: `src/auth/WelcomePage.tsx`

No unit test exists for the hook or the page; this task is verified by tsc + lint + the Task 1 module tests still passing. (TDD does not apply to this pure-wiring task.)

- [ ] **Step 1: Update the hook imports** — in `src/notepad/first-load/useNotepadFirstLoad.tsx`, replace:

```ts
import {
  decideFirstLoadActions,
  hasBeenGreetedToday,
  markGreetedToday,
  todayDateString,
} from './notepad-first-load';
```

with:

```ts
import {
  decideFirstLoadActions,
  hasBeenWelcomedOnce,
  markWelcomedOnce,
} from './notepad-first-load';
```

- [ ] **Step 2: Update the effect body** — in the same file, replace this block:

```ts
      const today = todayDateString(new Date());
      const actions = decideFirstLoadActions({
        user,
        authLoading,
        profileLoading: false, // guarded above: profileStatus === 'loading' already returned
        hasBeenWelcomed: !!profile?.fullName?.trim(),
        hasBeenGreetedToday: hasBeenGreetedToday(user.id, today, sessionStorage),
        localNoteCount: notes.length,
      });
      for (const action of actions) {
        switch (action.kind) {
          case 'redirect-welcome':
            navigate('/welcome');
            break;
          case 'greet':
            markGreetedToday(user.id, today, sessionStorage);
            toast.success(`Welcome back${action.firstName ? `, ${action.firstName}` : ''}!`);
            break;
          case 'offer-migration':
            setShowMigration(true);
            break;
        }
      }
```

with:

```ts
      const actions = decideFirstLoadActions({
        user,
        authLoading,
        profileLoading: false, // guarded above: profileStatus === 'loading' already returned
        hasBeenWelcomed: !!profile?.fullName?.trim(),
        hasBeenWelcomedOnce: hasBeenWelcomedOnce(user.id, localStorage),
        localNoteCount: notes.length,
      });
      for (const action of actions) {
        switch (action.kind) {
          case 'redirect-welcome':
            navigate('/welcome');
            break;
          case 'welcome':
            markWelcomedOnce(user.id, localStorage);
            toast.success(`Welcome${action.firstName ? `, ${action.firstName}` : ''}!`);
            break;
          case 'offer-migration':
            setShowMigration(true);
            break;
        }
      }
```

- [ ] **Step 3: Remove the onboarding-page toast** — in `src/auth/WelcomePage.tsx`, delete this single line (currently line 48, inside `handleContinue`, right after the `await account.updateProfile({...})` call):

```ts
      toast.success(`Welcome, ${fullName.trim().split(' ')[0]}!`);
```

Leave the surrounding lines (`setStep('import');`, the `catch` with `toast.error`, etc.) intact. `toast` stays imported (still used by the `toast.error` calls).

- [ ] **Step 4: Verify types, lint, and module tests**

Run: `npx tsc --noEmit`
Expected: no NEW errors in `useNotepadFirstLoad.tsx` or `WelcomePage.tsx`. (Ignore any unrelated pre-existing baseline errors.)

Run: `npx eslint src/notepad/first-load/useNotepadFirstLoad.tsx src/auth/WelcomePage.tsx src/notepad/first-load/notepad-first-load.ts`
Expected: zero errors/warnings on these files (in particular, no `no-unused-vars` for a leftover `toast`/`sessionStorage`/`todayDateString`).

Run: `npx vitest run src/notepad/first-load/notepad-first-load.test.ts`
Expected: PASS (unchanged from Task 1).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/first-load/useNotepadFirstLoad.tsx src/auth/WelcomePage.tsx
git commit -m "feat(onboarding): notes page is single source of one-time welcome

Wires the hook to the one-time welcome action via a per-account
localStorage flag and removes the duplicate /welcome page toast.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the changed test file + typecheck + lint together**

Run: `npx vitest run src/notepad/first-load/notepad-first-load.test.ts`
Expected: PASS.

Run: `npx eslint src/notepad/first-load/notepad-first-load.ts src/notepad/first-load/useNotepadFirstLoad.tsx src/auth/WelcomePage.tsx`
Expected: clean.

- [ ] **Step 2: Confirm no stray references to the old API remain**

Run: `grep -rn "greet\|Welcome back\|GreetedToday\|todayDateString" src --include='*.ts' --include='*.tsx'`
Expected: no matches in `src/notepad/first-load/` or `src/auth/WelcomePage.tsx`. (Unrelated matches elsewhere, if any, are out of scope — but there should be none for these tokens.)

- [ ] **Step 3: Manual smoke (optional, requires running app)**

1. Fresh email signup → `/welcome` shows NO toast → after entering name and continuing, the notes page shows "Welcome, {name}!" exactly once.
2. Reload / log out and back in → no greeting at all (no "Welcome back").
3. (If testable) OAuth signup that skips `/welcome` → notes page shows "Welcome, {name}!" once, then silent thereafter.

---

## Notes / out of scope

- `firstNameOf` is exported and used by `LamplightTabPanel` and `ConnectionCardsPanel`; it is unchanged.
- Persistence is per-browser `localStorage` keyed by user id. A new device or cleared storage may show the one-time welcome again — accepted per the spec (cosmetic, no server flag).
