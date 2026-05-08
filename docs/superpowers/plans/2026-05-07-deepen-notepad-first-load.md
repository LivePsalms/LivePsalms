# Deepen the Notepad First-Load Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `NotepadWorkspace`'s two coordinated `useEffect` blocks (welcome redirect, daily greeting toast, local-notes migration prompt) with a single deep `NotepadFirstLoad` module + thin `useNotepadFirstLoad` hook. Side benefit: encapsulate three storage-key string templates that are currently duplicated across `Notepad.tsx`, `WelcomePage.tsx`, and (effectively) `LocalStorageAdapter`.

**Architecture:** A pure decision module — *not* a state machine. The previous deepenings (`PurposeDetailReveal`, `MigrationWorkflow`) extended `Observable<State>` because they had timers and async sequencing. This one has neither: it's pure rule evaluation. The shape is `decideFirstLoadActions(input): FirstLoadAction[]` plus pure name/key/storage helpers. The `useNotepadFirstLoad` hook coordinates the storage reads (sync localStorage / sessionStorage; async `localAdapter.getNotes()`), invokes the decision, dispatches actions to `navigate` / `toast` / `setShowMigration`, and returns `{ showMigration, dismissMigration }`.

**Tech Stack:** TypeScript 5.9, React 19, Vitest, existing `LocalStorageAdapter`, `react-router-dom`, `sonner`.

**Domain language:** see [docs/CONTEXT.md](../../CONTEXT.md) §`NotepadFirstLoad`. The name `NotepadFirstLoad`, the `FirstLoadAction` union, the `decideFirstLoadActions` signature, the storage helper API, and the hook surface come from there — use them exactly.

**Behaviour preservation:** the rules are reproduced verbatim. The pure-function shape makes them testable without React, but the order, short-circuiting, and side-effect timing are unchanged:

1. While `authLoading || !user` → no actions.
2. `!hasBeenWelcomed` → `redirect-welcome` (greet is short-circuited).
3. `hasBeenWelcomed && !hasBeenGreetedToday` → `greet` action with `firstName` resolved.
4. `localNoteCount > 0` → `offer-migration` action, evaluated independently of the welcome/greet branch (matches the original two-effect shape).
5. The `greet` dispatcher writes the sessionStorage marker BEFORE firing the toast (matches the original order).

---

## File Structure

### New files
- `src/notepad/first-load/notepad-first-load.ts` — pure module: types, `decideFirstLoadActions`, `firstNameOf`, key helpers, storage helpers, `todayDateString`
- `src/notepad/first-load/notepad-first-load.test.ts` — node-only tests with fake storages
- `src/notepad/first-load/useNotepadFirstLoad.tsx` — production React hook

### Modified files
- `src/components/sections/Notepad.tsx` — drop both `useEffect` blocks, the `showMigration` `useState`, the `toast` import; consume the hook
- `src/auth/WelcomePage.tsx` — replace the inline `localStorage.setItem(\`welcomed_${user.id}\`, 'true')` calls with `markWelcomed(user.id, localStorage)`
- `docs/CONTEXT.md` — already updated in design phase (§`NotepadFirstLoad`)

### No changes
- `src/notepad/storage/local-storage.ts` — `localAdapter.getNotes()` is the source-of-truth read for the migration prompt; the `'notepad_notes'` key stays inside the adapter

---

## Task 1: Pure module skeleton + `firstNameOf`

**Files:**
- Create: `src/notepad/first-load/notepad-first-load.ts`
- Create: `src/notepad/first-load/notepad-first-load.test.ts`

- [ ] **Step 1: Write failing tests for `firstNameOf`**

Create `src/notepad/first-load/notepad-first-load.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { firstNameOf } from './notepad-first-load';

function makeUser(overrides: Partial<User> & { id: string }): User {
  return {
    id: overrides.id,
    email: overrides.email,
    app_metadata: {},
    user_metadata: overrides.user_metadata ?? {},
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

  it("falls back to 'friend' when neither full_name nor email is available", () => {
    const user = makeUser({ id: 'u1', email: undefined, user_metadata: {} });
    expect(firstNameOf(user)).toBe('friend');
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/notepad/first-load/notepad-first-load.test.ts`
Expected: FAIL — `Cannot find module './notepad-first-load'`.

- [ ] **Step 3: Create the module skeleton with `firstNameOf`**

Create `src/notepad/first-load/notepad-first-load.ts`:

```ts
import type { User } from '@supabase/supabase-js';

export type FirstLoadAction =
  | { kind: 'redirect-welcome' }
  | { kind: 'greet'; firstName: string }
  | { kind: 'offer-migration' };

export interface FirstLoadInput {
  user: User | null;
  authLoading: boolean;
  hasBeenWelcomed: boolean;
  hasBeenGreetedToday: boolean;
  localNoteCount: number;
}

/**
 * Pure name extraction. Canonical fallback chain: full_name's first word →
 * email local-part → 'friend'. Whitespace-only full_name falls through.
 */
export function firstNameOf(user: User): string {
  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
  if (fullName) return fullName.split(/\s+/)[0];
  const email = user.email;
  if (email) return email.split('@')[0];
  return 'friend';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/notepad/first-load/notepad-first-load.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/first-load/notepad-first-load.ts src/notepad/first-load/notepad-first-load.test.ts docs/CONTEXT.md
git commit -m "feat(first-load): scaffold NotepadFirstLoad with firstNameOf"
```

---

## Task 2: Storage keys + read/write helpers

**Files:**
- Modify: `src/notepad/first-load/notepad-first-load.ts`
- Modify: `src/notepad/first-load/notepad-first-load.test.ts`

- [ ] **Step 1: Add failing tests for keys, helpers, and `todayDateString`**

Append to `src/notepad/first-load/notepad-first-load.test.ts`:

```ts
import {
  welcomedKey,
  greetedKey,
  hasBeenWelcomed,
  markWelcomed,
  hasBeenGreetedToday,
  markGreetedToday,
  todayDateString,
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

describe('storage keys', () => {
  it('welcomedKey embeds the user id', () => {
    expect(welcomedKey('user-42')).toBe('welcomed_user-42');
  });

  it('greetedKey embeds the user id and date string', () => {
    expect(greetedKey('user-42', 'Wed May 07 2026')).toBe('greeted_user-42_Wed May 07 2026');
  });
});

describe('hasBeenWelcomed / markWelcomed', () => {
  it('returns false when the key is absent', () => {
    const storage = makeFakeStorage();
    expect(hasBeenWelcomed('u1', storage)).toBe(false);
  });

  it('returns true after markWelcomed', () => {
    const storage = makeFakeStorage();
    markWelcomed('u1', storage);
    expect(hasBeenWelcomed('u1', storage)).toBe(true);
  });

  it('is scoped per-user-id', () => {
    const storage = makeFakeStorage();
    markWelcomed('u1', storage);
    expect(hasBeenWelcomed('u2', storage)).toBe(false);
  });

  it('writes the value "true" to the storage', () => {
    const storage = makeFakeStorage();
    markWelcomed('u1', storage);
    expect(storage.data.get('welcomed_u1')).toBe('true');
  });
});

describe('hasBeenGreetedToday / markGreetedToday', () => {
  it('returns false when the key is absent', () => {
    const storage = makeFakeStorage();
    expect(hasBeenGreetedToday('u1', 'Wed May 07 2026', storage)).toBe(false);
  });

  it('returns true after markGreetedToday for the same date', () => {
    const storage = makeFakeStorage();
    markGreetedToday('u1', 'Wed May 07 2026', storage);
    expect(hasBeenGreetedToday('u1', 'Wed May 07 2026', storage)).toBe(true);
  });

  it('is scoped per-day (yesterday’s mark does not satisfy today)', () => {
    const storage = makeFakeStorage();
    markGreetedToday('u1', 'Tue May 06 2026', storage);
    expect(hasBeenGreetedToday('u1', 'Wed May 07 2026', storage)).toBe(false);
  });

  it('is scoped per-user', () => {
    const storage = makeFakeStorage();
    markGreetedToday('u1', 'Wed May 07 2026', storage);
    expect(hasBeenGreetedToday('u2', 'Wed May 07 2026', storage)).toBe(false);
  });
});

describe('todayDateString', () => {
  it('returns the same shape as Date.toDateString', () => {
    const now = new Date('2026-05-07T13:00:00Z');
    expect(todayDateString(now)).toBe(now.toDateString());
  });

  it('does not include the time-of-day, so two times on the same day produce the same key', () => {
    const morning = new Date('2026-05-07T01:00:00Z');
    const evening = new Date('2026-05-07T23:00:00Z');
    expect(todayDateString(morning)).toBe(todayDateString(evening));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/notepad/first-load/notepad-first-load.test.ts`
Expected: FAIL — `welcomedKey is not exported`, etc.

- [ ] **Step 3: Implement keys, helpers, and `todayDateString`**

Append to `src/notepad/first-load/notepad-first-load.ts`:

```ts
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const welcomedKey = (userId: string): string => `welcomed_${userId}`;

export const greetedKey = (userId: string, today: string): string =>
  `greeted_${userId}_${today}`;

export const hasBeenWelcomed = (userId: string, storage: StorageLike): boolean =>
  storage.getItem(welcomedKey(userId)) !== null;

export const markWelcomed = (userId: string, storage: StorageLike): void => {
  storage.setItem(welcomedKey(userId), 'true');
};

export const hasBeenGreetedToday = (
  userId: string,
  today: string,
  storage: StorageLike,
): boolean => storage.getItem(greetedKey(userId, today)) !== null;

export const markGreetedToday = (
  userId: string,
  today: string,
  storage: StorageLike,
): void => {
  storage.setItem(greetedKey(userId, today), 'true');
};

export const todayDateString = (now: Date): string => now.toDateString();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/notepad/first-load/notepad-first-load.test.ts`
Expected: PASS (15 tests total — 5 from Task 1 + 10 new).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/first-load/notepad-first-load.ts src/notepad/first-load/notepad-first-load.test.ts
git commit -m "feat(first-load): storage keys and read/write helpers"
```

---

## Task 3: `decideFirstLoadActions` — the decision rule

**Files:**
- Modify: `src/notepad/first-load/notepad-first-load.ts`
- Modify: `src/notepad/first-load/notepad-first-load.test.ts`

- [ ] **Step 1: Add failing tests for the decision matrix**

Append to `src/notepad/first-load/notepad-first-load.test.ts`:

```ts
import { decideFirstLoadActions } from './notepad-first-load';

describe('decideFirstLoadActions — gating', () => {
  it('returns no actions while authLoading', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: true,
        hasBeenWelcomed: false,
        hasBeenGreetedToday: false,
        localNoteCount: 5,
      }),
    ).toEqual([]);
  });

  it('returns no actions when user is null', () => {
    expect(
      decideFirstLoadActions({
        user: null,
        authLoading: false,
        hasBeenWelcomed: true,
        hasBeenGreetedToday: false,
        localNoteCount: 5,
      }),
    ).toEqual([]);
  });
});

describe('decideFirstLoadActions — welcome redirect short-circuits greet', () => {
  it('first sign-in (no welcomed flag): emits redirect-welcome only', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        hasBeenWelcomed: false,
        hasBeenGreetedToday: false,
        localNoteCount: 0,
      }),
    ).toEqual([{ kind: 'redirect-welcome' }]);
  });

  it('first sign-in with local notes: emits redirect-welcome AND offer-migration', () => {
    // Migration is independent of welcome; matches the original two-effect shape.
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        hasBeenWelcomed: false,
        hasBeenGreetedToday: false,
        localNoteCount: 3,
      }),
    ).toEqual([{ kind: 'redirect-welcome' }, { kind: 'offer-migration' }]);
  });
});

describe('decideFirstLoadActions — returning user', () => {
  it('welcomed and not greeted today: emits greet with firstName', () => {
    const user = makeUser({
      id: 'u1',
      user_metadata: { full_name: 'Grace Hopper' },
      email: 'grace@hopper.dev',
    });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        hasBeenWelcomed: true,
        hasBeenGreetedToday: false,
        localNoteCount: 0,
      }),
    ).toEqual([{ kind: 'greet', firstName: 'Grace' }]);
  });

  it('welcomed and already greeted today: emits no actions', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        hasBeenWelcomed: true,
        hasBeenGreetedToday: true,
        localNoteCount: 0,
      }),
    ).toEqual([]);
  });

  it('welcomed, not greeted, with local notes: emits greet AND offer-migration in order', () => {
    const user = makeUser({ id: 'u1', email: 'ada@ex.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        hasBeenWelcomed: true,
        hasBeenGreetedToday: false,
        localNoteCount: 1,
      }),
    ).toEqual([{ kind: 'greet', firstName: 'ada' }, { kind: 'offer-migration' }]);
  });

  it('welcomed, already greeted, with local notes: emits offer-migration only', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        hasBeenWelcomed: true,
        hasBeenGreetedToday: true,
        localNoteCount: 7,
      }),
    ).toEqual([{ kind: 'offer-migration' }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/notepad/first-load/notepad-first-load.test.ts`
Expected: FAIL — `decideFirstLoadActions is not exported`.

- [ ] **Step 3: Implement the decision rule**

Append to `src/notepad/first-load/notepad-first-load.ts`:

```ts
/**
 * Pure rule evaluation for the three first-load decisions. Order:
 * - empty list while authLoading or no user
 * - redirect-welcome short-circuits greet (matches the original effect's `return`)
 * - offer-migration is evaluated independently of welcome/greet (matches the
 *   original two-effect shape: the migration check fired regardless)
 */
export function decideFirstLoadActions(input: FirstLoadInput): FirstLoadAction[] {
  const { user, authLoading, hasBeenWelcomed, hasBeenGreetedToday, localNoteCount } = input;
  if (authLoading || !user) return [];

  const actions: FirstLoadAction[] = [];
  if (!hasBeenWelcomed) {
    actions.push({ kind: 'redirect-welcome' });
  } else if (!hasBeenGreetedToday) {
    actions.push({ kind: 'greet', firstName: firstNameOf(user) });
  }
  if (localNoteCount > 0) {
    actions.push({ kind: 'offer-migration' });
  }
  return actions;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/notepad/first-load/notepad-first-load.test.ts`
Expected: PASS (22 tests total — 15 from earlier + 7 new).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/first-load/notepad-first-load.ts src/notepad/first-load/notepad-first-load.test.ts
git commit -m "feat(first-load): decideFirstLoadActions decision rule"
```

---

## Task 4: Production hook `useNotepadFirstLoad`

**Files:**
- Create: `src/notepad/first-load/useNotepadFirstLoad.tsx`

This hook is glue and the testing strategy mirrors `useDetailReveal` / `useMigrationWorkflow`: the *pure module* is exhaustively tested, the hook is a thin wiring layer.

- [ ] **Step 1: Create the hook**

Create `src/notepad/first-load/useNotepadFirstLoad.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthSession } from '@/auth/context/useAuthSession';
import { localAdapter } from '@/notepad/storage/local-storage';
import {
  decideFirstLoadActions,
  hasBeenWelcomed,
  hasBeenGreetedToday,
  markGreetedToday,
  todayDateString,
} from './notepad-first-load';

interface UseNotepadFirstLoadResult {
  showMigration: boolean;
  dismissMigration: () => void;
}

/**
 * React glue for `NotepadFirstLoad`. Reads identity from `useAuthSession`,
 * reads the local note count via `localAdapter.getNotes()`, invokes
 * `decideFirstLoadActions`, and dispatches each returned action to its
 * side-effect target. Owns the `showMigration` boolean previously held in
 * `NotepadWorkspace`.
 */
export function useNotepadFirstLoad(): UseNotepadFirstLoadResult {
  const { user, loading: authLoading } = useAuthSession();
  const navigate = useNavigate();
  const [showMigration, setShowMigration] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      const notes = await localAdapter.getNotes();
      if (cancelled) return;
      const today = todayDateString(new Date());
      const actions = decideFirstLoadActions({
        user,
        authLoading,
        hasBeenWelcomed: hasBeenWelcomed(user.id, localStorage),
        hasBeenGreetedToday: hasBeenGreetedToday(user.id, today, sessionStorage),
        localNoteCount: notes.length,
      });
      for (const action of actions) {
        switch (action.kind) {
          case 'redirect-welcome':
            navigate('/welcome');
            break;
          case 'greet':
            // Write-marker-then-toast order matches the original.
            markGreetedToday(user.id, today, sessionStorage);
            toast.success(`Welcome back, ${action.firstName}!`);
            break;
          case 'offer-migration':
            setShowMigration(true);
            break;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, navigate]);

  return {
    showMigration,
    dismissMigration: () => setShowMigration(false),
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/notepad/first-load/useNotepadFirstLoad.tsx
git commit -m "feat(first-load): useNotepadFirstLoad hook coordinates dispatch"
```

---

## Task 5: Wire `useNotepadFirstLoad` into `NotepadWorkspace`

**Files:**
- Modify: `src/components/sections/Notepad.tsx`

- [ ] **Step 1: Replace the two effects and `showMigration` state**

In `src/components/sections/Notepad.tsx`:

Replace the imports section. Currently:

```tsx
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PanelLeftClose, PanelLeftOpen, WifiOff } from 'lucide-react';
import { NotepadProvider } from '@/notepad/context/NotepadProvider';
import { useAuthSession } from '@/auth/context/useAuthSession';
```

becomes:

```tsx
import { useState, useCallback } from 'react';
import { PanelLeftClose, PanelLeftOpen, WifiOff } from 'lucide-react';
import { NotepadProvider } from '@/notepad/context/NotepadProvider';
import { useAuthSession } from '@/auth/context/useAuthSession';
import { useNotepadFirstLoad } from '@/notepad/first-load/useNotepadFirstLoad';
```

(Drop `useEffect`, `useNavigate`, `toast` — all moved into the hook.)

Then replace the body of `NotepadWorkspace` from the state declarations through the second `useEffect`. Currently:

```tsx
function NotepadWorkspace() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [graphOpen, setGraphOpen] = useState(true);
  const [graphExpanded, setGraphExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'backlinks' | 'info'>('content');

  const navigate = useNavigate();
  const { user, adapter, loading: authLoading } = useAuthSession();
  const actions = useNotepadActions();
  const refresh = useCallback(() => actions.init(), [actions]);
  const [showMigration, setShowMigration] = useState(false);

  const isOnline = useOnlineStatus();
  const isLoggedIn = !!user;
  const isOfflineAndLoggedIn = !isOnline && isLoggedIn;

  // First-time user: redirect to welcome screen, then show signed-in toast
  useEffect(() => {
    if (authLoading || !user) return;
    const welcomedKey = `welcomed_${user.id}`;
    if (!localStorage.getItem(welcomedKey)) {
      navigate('/welcome');
      return;
    }
    const greetedKey = `greeted_${user.id}_${new Date().toDateString()}`;
    if (!sessionStorage.getItem(greetedKey)) {
      sessionStorage.setItem(greetedKey, 'true');
      const firstName = user.user_metadata?.full_name?.split(' ')[0]
        ?? user.email?.split('@')[0]
        ?? 'friend';
      toast.success(`Welcome back, ${firstName}!`);
    }
  }, [user, authLoading, navigate]);

  // Check for local notes when user logs in
  useEffect(() => {
    if (user) {
      const localNotes = localStorage.getItem('notepad_notes');
      if (localNotes) {
        const parsed = JSON.parse(localNotes);
        if (parsed.length > 0) {
          setShowMigration(true);
        }
      }
    }
  }, [user]);

  const handleOpenSearch = useCallback(() => {
```

becomes:

```tsx
function NotepadWorkspace() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [graphOpen, setGraphOpen] = useState(true);
  const [graphExpanded, setGraphExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'backlinks' | 'info'>('content');

  const { user, adapter } = useAuthSession();
  const actions = useNotepadActions();
  const refresh = useCallback(() => actions.init(), [actions]);
  const { showMigration, dismissMigration } = useNotepadFirstLoad();

  const isOnline = useOnlineStatus();
  const isLoggedIn = !!user;
  const isOfflineAndLoggedIn = !isOnline && isLoggedIn;

  const handleOpenSearch = useCallback(() => {
```

Then update the `<MigrationDialog>` props at the bottom:

```tsx
      <MigrationDialog
        open={showMigration}
        onClose={() => setShowMigration(false)}
        targetAdapter={adapter}
        onMigrationComplete={refresh}
      />
```

becomes:

```tsx
      <MigrationDialog
        open={showMigration}
        onClose={dismissMigration}
        targetAdapter={adapter}
        onMigrationComplete={refresh}
      />
```

- [ ] **Step 2: Type-check + run all tests**

Run: `npx tsc -b && npm test`
Expected: no type errors, all existing tests still pass plus the 22 new `notepad-first-load` tests.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/Notepad.tsx
git commit -m "refactor(notepad): consume useNotepadFirstLoad; drop inline effects"
```

---

## Task 6: Wire `WelcomePage` to use `markWelcomed`

**Files:**
- Modify: `src/auth/WelcomePage.tsx`

- [ ] **Step 1: Replace the inline `localStorage.setItem`**

In `src/auth/WelcomePage.tsx`, find the imports section near the top of the file and add:

```tsx
import { markWelcomed } from '@/notepad/first-load/notepad-first-load';
```

Then replace `markWelcomed`'s body. Currently lines 34-38:

```tsx
  const markWelcomed = () => {
    if (user) {
      localStorage.setItem(`welcomed_${user.id}`, 'true');
    }
  };
```

becomes:

```tsx
  const markUserWelcomed = () => {
    if (user) {
      markWelcomed(user.id, localStorage);
    }
  };
```

The local function name is changed to `markUserWelcomed` to avoid shadowing the imported `markWelcomed`. Update the two call sites in the same file (line 51 and line 62 today):

```tsx
      markWelcomed();
```

becomes:

```tsx
      markUserWelcomed();
```

at both call sites.

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Smoke-test in the browser**

Run: `npm run dev` and exercise:
1. **Brand-new user signs up** → `/welcome` page → fill form → click Continue → land on `/notepad` → see "Welcome, {firstName}!" success toast (this is fired by `WelcomePage`, not the first-load flow).
2. **Sign out, sign back in same day** → land on `/notepad` directly (no welcome redirect, since `welcomed_${id}` is set) → see "Welcome back, {firstName}!" toast (the daily-greet branch).
3. **Sign in again same day** (e.g. open another tab) → no toast (greeted-today flag is set in sessionStorage; opening a new tab inherits sessionStorage from the source tab, but a fresh tab does not — verify both behaviors match pre-deepening).
4. **Sign in with local notes present** → migration dialog appears.
5. **Sign in fresh user with local notes** → redirect to `/welcome`; on returning to `/notepad`, migration dialog appears.
6. **Sign-out** → back to local-only mode (`AuthSession` restores `localAdapter`); first-load hook does nothing (no user).

Expected: behavior matches pre-deepening exactly.

- [ ] **Step 4: Commit**

```bash
git add src/auth/WelcomePage.tsx
git commit -m "refactor(welcome): use markWelcomed helper from first-load module"
```

---

## Self-review checklist (run after Task 6)

- [ ] No `welcomed_${...}` template string literal remains in `Notepad.tsx` or `WelcomePage.tsx`.
- [ ] No `greeted_${...}` template string literal remains in `Notepad.tsx`.
- [ ] No `localStorage.getItem('notepad_notes')` direct read remains in `Notepad.tsx`.
- [ ] No `useNavigate` import remains in `Notepad.tsx`.
- [ ] No `toast` import remains in `Notepad.tsx`.
- [ ] No `useEffect` for first-load logic remains in `Notepad.tsx` — only `useCallback` remains in the imports.
- [ ] All 22 new tests pass; no React, no jsdom, no real `localStorage` / `sessionStorage`.
- [ ] CONTEXT.md §`NotepadFirstLoad` reflects the implemented module.
- [ ] `useAuthSession` is still consumed in `Notepad.tsx` for `user` and `adapter`; the hook's own `useAuthSession` call is independent (no double-mount concern; the hook is just a context consumer).
