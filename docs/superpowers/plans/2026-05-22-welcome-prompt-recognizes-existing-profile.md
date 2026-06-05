# Welcome Prompt Recognizes Existing Profile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop re-prompting signed-in users for their name and date of birth when those fields are already saved in the `profiles` table.

**Architecture:** Replace the per-device `localStorage` "welcomed" flag with a DB-derived signal: `hasBeenWelcomed = !!profile.fullName.trim()`. Gate the first-load decision on the profile fetch by introducing `profileLoading` into `decideFirstLoadActions`, so we don't redirect during the load window. Remove the now-redundant `markWelcomed` call from `WelcomePage` and the `Skip for now` button (Skip becomes unreachable-by-design once name is required to leave Welcome).

**Tech Stack:** React + TypeScript, Vite, Vitest, Supabase JS client, React Router, `sonner` toasts.

**Spec:** [docs/superpowers/specs/2026-05-22-welcome-prompt-recognizes-existing-profile-design.md](../specs/2026-05-22-welcome-prompt-recognizes-existing-profile-design.md)

---

## File Structure

| File | Responsibility | Change type |
|---|---|---|
| `src/notepad/first-load/notepad-first-load.ts` | Pure helpers + the `decideFirstLoadActions` decision function. | Modify: add `profileLoading` field + guard; delete `welcomedKey`/`hasBeenWelcomed`/`markWelcomed` helpers. |
| `src/notepad/first-load/notepad-first-load.test.ts` | Vitest unit tests for the pure layer. | Modify: add `profileLoading: false` to existing inputs; add new test for the gate; delete tests covering the deleted helpers. |
| `src/notepad/first-load/useNotepadFirstLoad.tsx` | React hook that wires the pure decision function to live auth/profile state and routing. | Modify: read `useAccountProfile`; derive `hasBeenWelcomed` from `profile.fullName`; pass `profileLoading`; widen effect deps. |
| `src/auth/WelcomePage.tsx` | The Welcome screen UI. | Modify: drop `markWelcomed` call + import; remove `Skip for now` button and `handleSkip`. |

No new files. No schema changes.

---

## Task 1: Add `profileLoading` gate to `decideFirstLoadActions`

This is a pure-function change with full unit-test coverage. Tests drive the change.

**Files:**
- Modify: `src/notepad/first-load/notepad-first-load.ts`
- Modify: `src/notepad/first-load/notepad-first-load.test.ts`

---

- [ ] **Step 1: Write the failing test for the new gate**

Open `src/notepad/first-load/notepad-first-load.test.ts`. Find the `describe('decideFirstLoadActions — gating', () => { ... })` block (around line 147). Inside that block, **add a third test** just before the closing `});`:

```ts
  it('returns no actions while profileLoading', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: false,
        profileLoading: true,
        hasBeenWelcomed: false,
        hasBeenGreetedToday: false,
        localNoteCount: 5,
      }),
    ).toEqual([]);
  });
```

Save the file. Do **not** modify any other tests in this step.

- [ ] **Step 2: Run the test, verify failure**

Run:

```bash
npm test -- src/notepad/first-load/notepad-first-load.test.ts
```

Expected: TypeScript / vitest reports the new test fails because `profileLoading` is not a known property of `FirstLoadInput`. (The other tests still pass — they don't reference `profileLoading`.)

If the test instead *passes*, you've edited the wrong block; revert and re-do Step 1.

- [ ] **Step 3: Add `profileLoading` to `FirstLoadInput` and extend the guard**

Open `src/notepad/first-load/notepad-first-load.ts`. Find the `FirstLoadInput` interface (around line 8) and add `profileLoading: boolean;` between `authLoading` and `hasBeenWelcomed`:

```ts
export interface FirstLoadInput {
  user: User | null;
  authLoading: boolean;
  profileLoading: boolean;
  hasBeenWelcomed: boolean;
  hasBeenGreetedToday: boolean;
  localNoteCount: number;
}
```

Then find `decideFirstLoadActions` (around line 54) and update its destructure + guard. The current first two lines of the function body are:

```ts
  const { user, authLoading, hasBeenWelcomed, hasBeenGreetedToday, localNoteCount } = input;
  if (authLoading || !user) return [];
```

Replace them with:

```ts
  const { user, authLoading, profileLoading, hasBeenWelcomed, hasBeenGreetedToday, localNoteCount } = input;
  if (authLoading || profileLoading || !user) return [];
```

Save.

- [ ] **Step 4: Add `profileLoading: false` to every existing `decideFirstLoadActions` test**

In `src/notepad/first-load/notepad-first-load.test.ts`, every existing call to `decideFirstLoadActions({...})` needs `profileLoading: false` added to its input object. There are **eight** such calls. Add the field on a new line immediately after `authLoading: <value>` in each.

The eight existing tests live in these `describe` blocks:

1. `describe('decideFirstLoadActions — gating', ...)` — two existing tests (authLoading: true case; user: null case).
2. `describe('decideFirstLoadActions — welcome redirect short-circuits greet', ...)` — two tests.
3. `describe('decideFirstLoadActions — returning user', ...)` — four tests.

For example, the first existing gating test becomes:

```ts
  it('returns no actions while authLoading', () => {
    const user = makeUser({ id: 'u1', email: 'a@b.com' });
    expect(
      decideFirstLoadActions({
        user,
        authLoading: true,
        profileLoading: false,
        hasBeenWelcomed: false,
        hasBeenGreetedToday: false,
        localNoteCount: 5,
      }),
    ).toEqual([]);
  });
```

Do the same for the remaining seven. Do **not** modify the new `profileLoading: true` test you added in Step 1 — it already has the field.

- [ ] **Step 5: Run the full test file, verify all pass**

Run:

```bash
npm test -- src/notepad/first-load/notepad-first-load.test.ts
```

Expected: all tests pass — every existing test plus the new `profileLoading: true` gate test. If any test fails because of a missing `profileLoading` field, you missed one of the eight in Step 4; add it.

- [ ] **Step 6: Commit**

```bash
git add src/notepad/first-load/notepad-first-load.ts src/notepad/first-load/notepad-first-load.test.ts
git commit -m "feat(first-load): add profileLoading gate to decideFirstLoadActions"
```

---

## Task 2: Wire profile-derived `hasBeenWelcomed` into `useNotepadFirstLoad`

The hook is the seam where the pure function meets live state. This task changes only that wiring; the pure function is unchanged from Task 1. There is no unit test for this hook in the repo, so verification is via TypeScript build + a manual browser check covering AC #1 and #2 of the spec.

**Files:**
- Modify: `src/notepad/first-load/useNotepadFirstLoad.tsx`

---

- [ ] **Step 1: Rewrite the hook**

Open `src/notepad/first-load/useNotepadFirstLoad.tsx` and replace its full contents with:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthSession } from '@/auth/context/useAuthSession';
import { useAccountProfile } from '@/auth/context/useAccountProfile';
import { localAdapter } from '@/notepad/storage/local-storage';
import {
  decideFirstLoadActions,
  hasBeenGreetedToday,
  markGreetedToday,
  todayDateString,
} from './notepad-first-load';

interface UseNotepadFirstLoadResult {
  showMigration: boolean;
  dismissMigration: () => void;
}

export function useNotepadFirstLoad(): UseNotepadFirstLoadResult {
  const { user, loading: authLoading } = useAuthSession();
  const { profile, profileStatus } = useAccountProfile();
  const navigate = useNavigate();
  const [showMigration, setShowMigration] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    if (profileStatus === 'loading') return;
    let cancelled = false;
    (async () => {
      const notes = await localAdapter.getNotes();
      if (cancelled) return;
      const today = todayDateString(new Date());
      const actions = decideFirstLoadActions({
        user,
        authLoading,
        profileLoading: profileStatus === 'loading',
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
  }, [user, authLoading, profile?.fullName, profileStatus, navigate]);

  return {
    showMigration,
    dismissMigration: () => setShowMigration(false),
  };
}
```

Save.

Three things changed versus the original:
1. Imports `useAccountProfile`; no longer imports `hasBeenWelcomed` from `./notepad-first-load`.
2. The effect short-circuits while `profileStatus === 'loading'` and passes the derived `hasBeenWelcomed` + `profileLoading` into `decideFirstLoadActions`.
3. The dependency array gains `profile?.fullName` and `profileStatus` so the effect re-runs when the profile finishes loading.

- [ ] **Step 2: Verify the TypeScript build**

Run:

```bash
npm run build
```

Expected: clean build. No type errors.

If the build fails on the `useAccountProfile` import, verify the import path with:

```bash
ls src/auth/context/useAccountProfile.ts
```

(The file exists per the spec; the path `@/auth/context/useAccountProfile` should resolve via the project's path alias — same alias used by `useAuthSession` already in the file.)

- [ ] **Step 3: Run the existing test suite to confirm no collateral damage**

Run:

```bash
npm test
```

Expected: all tests pass. (No tests cover this hook directly; this is a sanity check that nothing else broke.)

- [ ] **Step 4: Manual browser verification — AC #1 and #2**

Start the dev server:

```bash
npm run dev
```

Open the dev URL in a browser, in an **incognito / private** window so localStorage starts empty.

Verify **AC #1** — existing user with `full_name` set lands on `/notepad` without a welcome prompt:
1. Sign in with an account whose `profiles.full_name` is already populated.
2. Expected: page lands on `/notepad`. No redirect to `/welcome`. No name/DOB prompt.

Verify **AC #2** — clearing site data and signing in again still skips the prompt:
1. While signed in to that account on `/notepad`, open DevTools → Application → Storage → "Clear site data".
2. Reload, sign back in.
3. Expected: lands on `/notepad`, no welcome prompt.

If either step instead redirects to `/welcome`, the wiring is wrong — check the effect dependency array and that `profile?.fullName?.trim()` evaluates truthy for that user.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/first-load/useNotepadFirstLoad.tsx
git commit -m "fix(first-load): derive welcomed state from profile.fullName, not localStorage"
```

---

## Task 3: Remove `markWelcomed` call and Skip button from `WelcomePage`

Once the hook reads the DB, the `markWelcomed` call is redundant (the page's `updateProfile` call writes `full_name` to the DB, which is now the signal). The `Skip for now` button becomes dead UX — under the new model, skipping without saving leaves `full_name` empty and bounces the user right back.

**Files:**
- Modify: `src/auth/WelcomePage.tsx`

---

- [ ] **Step 1: Remove the `markWelcomed` import**

Open `src/auth/WelcomePage.tsx`. Delete the import at line 6:

```tsx
import { markWelcomed } from '@/notepad/first-load/notepad-first-load';
```

- [ ] **Step 2: Remove the `markUserWelcomed` helper**

In the same file, delete the helper at lines 35–39:

```tsx
  const markUserWelcomed = () => {
    if (user) {
      markWelcomed(user.id, localStorage);
    }
  };
```

- [ ] **Step 3: Remove the `markUserWelcomed()` call from `handleContinue`**

In `handleContinue` (around line 41), the body currently includes:

```tsx
      await account.updateProfile({
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth || null,
      });
      markUserWelcomed();
      toast.success(`Welcome, ${fullName.trim().split(' ')[0]}!`);
      navigate('/notepad');
```

Delete the `markUserWelcomed();` line so it becomes:

```tsx
      await account.updateProfile({
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth || null,
      });
      toast.success(`Welcome, ${fullName.trim().split(' ')[0]}!`);
      navigate('/notepad');
```

- [ ] **Step 4: Remove the `handleSkip` function**

Delete the entire `handleSkip` function (around lines 62–65):

```tsx
  const handleSkip = () => {
    markUserWelcomed();
    navigate('/notepad');
  };
```

- [ ] **Step 5: Remove the Skip for now button from the JSX**

In the JSX, delete the `<button>` block for Skip for now (around lines 174–181):

```tsx
          <button
            onClick={handleSkip}
            disabled={saving}
            className="w-full text-xs hover:opacity-70 transition-opacity"
            style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
          >
            Skip for now
          </button>
```

The Continue button immediately above stays.

- [ ] **Step 6: Verify the TypeScript build**

Run:

```bash
npm run build
```

Expected: clean build. No unused-import warnings for `markWelcomed`, no references to `markUserWelcomed` or `handleSkip`.

- [ ] **Step 7: Run tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Manual browser verification — AC #3, #4, #5**

Start the dev server:

```bash
npm run dev
```

Verify **AC #5** — the Skip button is gone:
1. Manually navigate to `/welcome` in your browser as a signed-in user (or use a fresh OAuth account whose provider returned no name).
2. Expected: the form shows Full Name, Date of Birth, and **only** a Continue button. No "Skip for now" link.

Verify **AC #3** — an OAuth user with empty `full_name` can complete the flow:
1. In a private window, sign up via Google or Apple with an account whose metadata lacks a full name (or, if unavailable, manually set `profiles.full_name = ''` in Supabase for a test account and sign in).
2. The app should redirect to `/welcome`.
3. Fill in Full Name (leave DOB blank).
4. Click Continue.
5. Expected: toast confirms `Welcome, <first name>!`. Page lands on `/notepad`. No second prompt, even on reload.

Verify **AC #4** — same OAuth user on a second device skips the prompt:
1. In yet another private window, sign in with the same account.
2. Expected: lands on `/notepad`, no welcome prompt.

Stop the dev server.

- [ ] **Step 9: Commit**

```bash
git add src/auth/WelcomePage.tsx
git commit -m "fix(welcome): drop markWelcomed call and Skip-for-now button"
```

---

## Task 4: Delete dead `welcomedKey` / `hasBeenWelcomed` / `markWelcomed` exports

These helpers have no remaining callers after Tasks 2 and 3. Remove them and their tests.

**Files:**
- Modify: `src/notepad/first-load/notepad-first-load.ts`
- Modify: `src/notepad/first-load/notepad-first-load.test.ts`

---

- [ ] **Step 1: Confirm no callers remain**

Run:

```bash
grep -rn "welcomedKey\|markWelcomed\|hasBeenWelcomed" src --include="*.ts" --include="*.tsx"
```

Expected: only references are inside `src/notepad/first-load/notepad-first-load.ts` (the definitions) and `src/notepad/first-load/notepad-first-load.test.ts` (the tests). If any other file matches, stop and investigate — Tasks 2 or 3 missed something.

- [ ] **Step 2: Delete the three helpers from the production file**

Open `src/notepad/first-load/notepad-first-load.ts`. Delete these three exports (around lines 26–36):

```ts
export const welcomedKey = (userId: string): string => `welcomed_${userId}`;

export const greetedKey = (userId: string, today: string): string =>
  `greeted_${userId}_${today}`;

export const hasBeenWelcomed = (userId: string, storage: StorageLike): boolean =>
  storage.getItem(welcomedKey(userId)) !== null;

export const markWelcomed = (userId: string, storage: StorageLike): void => {
  storage.setItem(welcomedKey(userId), 'true');
};
```

**Keep** `greetedKey` — it is still used by the greeting flow. After the edit, only `greetedKey` should remain in that section:

```ts
export const greetedKey = (userId: string, today: string): string =>
  `greeted_${userId}_${today}`;
```

- [ ] **Step 3: Remove the corresponding test coverage**

Open `src/notepad/first-load/notepad-first-load.test.ts`.

3a. In the imports (around lines 3–13), remove `welcomedKey`, `hasBeenWelcomed`, and `markWelcomed`. The block becomes:

```ts
import {
  firstNameOf,
  greetedKey,
  hasBeenGreetedToday,
  markGreetedToday,
  todayDateString,
  decideFirstLoadActions,
} from './notepad-first-load';
```

3b. Delete the entire `describe('hasBeenWelcomed / markWelcomed', () => { ... })` block (lines 83–106).

3c. Inside the `describe('storage keys', ...)` block, delete the `welcomedKey` test, leaving only the `greetedKey` test:

```ts
describe('storage keys', () => {
  it('greetedKey embeds the user id and date string', () => {
    expect(greetedKey('user-42', 'Wed May 07 2026')).toBe('greeted_user-42_Wed May 07 2026');
  });
});
```

Save both files.

- [ ] **Step 4: Run the full test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Verify the build**

Run:

```bash
npm run build
```

Expected: clean build. No "unused export" warnings, no missing-import errors.

- [ ] **Step 6: Commit**

```bash
git add src/notepad/first-load/notepad-first-load.ts src/notepad/first-load/notepad-first-load.test.ts
git commit -m "refactor(first-load): remove dead localStorage welcome helpers"
```

---

## Acceptance check

After all four tasks, re-read each acceptance criterion from the spec and confirm:

- [ ] AC #1 — existing user, fresh browser → `/notepad`, no prompt.
- [ ] AC #2 — same user clears site data → `/notepad`, no prompt.
- [ ] AC #3 — OAuth user with empty `full_name` → `/welcome` → fills name → `/notepad`.
- [ ] AC #4 — same OAuth user on a second device → `/notepad`, no prompt.
- [ ] AC #5 — no "Skip for now" button on the Welcome screen.
- [ ] AC #6 — `npm test` passes; `npm run build` clean.
