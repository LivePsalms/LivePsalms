# Personalized Editor Empty State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic "Select a note or create a new one" editor placeholder with a quiet, on-brand line that greets the user by first name.

**Architecture:** Extract a pure `emptyStateMessage(fullName)` helper (testable without TipTap), then call it from the no-active-note branch of `NotepadEditor` using the first name from `useAccountProfile()`. One change covers both desktop and mobile, which share `NotepadEditor`.

**Tech Stack:** React, TypeScript, Vitest. Reuses the existing `sanitizeFirstName` util for injection-safe first-name extraction.

---

## File Structure

- **Create:** `src/notepad/utils/empty-state-message.ts` — pure function mapping an optional full name to the editor empty-state copy. One responsibility, no React/DOM deps.
- **Create:** `src/notepad/utils/empty-state-message.test.ts` — colocated Vitest unit test (matches `personalization.test.ts`, `tags.test.ts` convention).
- **Modify:** `src/notepad/components/Editor.tsx` — read profile, call the helper, render the result in the existing placeholder `<div>`.

Spec: `docs/superpowers/specs/2026-06-02-personalized-editor-empty-state-design.md`

---

## Task 1: Pure empty-state message helper

**Files:**
- Create: `src/notepad/utils/empty-state-message.ts`
- Test: `src/notepad/utils/empty-state-message.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/notepad/utils/empty-state-message.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { emptyStateMessage } from './empty-state-message';

describe('emptyStateMessage', () => {
  it('personalizes with the first name', () => {
    expect(emptyStateMessage('Natalie Magee')).toBe('The page is yours, Natalie.');
  });

  it('uses a single-word name', () => {
    expect(emptyStateMessage('Plato')).toBe('The page is yours, Plato.');
  });

  it('falls back to the name-less line for null', () => {
    expect(emptyStateMessage(null)).toBe('The page is yours.');
  });

  it('falls back to the name-less line for undefined', () => {
    expect(emptyStateMessage(undefined)).toBe('The page is yours.');
  });

  it('falls back for whitespace-only names', () => {
    expect(emptyStateMessage('   ')).toBe('The page is yours.');
  });

  it('falls back when the name fails sanitization', () => {
    expect(emptyStateMessage('<script>')).toBe('The page is yours.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/utils/empty-state-message.test.ts`
Expected: FAIL — cannot resolve `./empty-state-message` (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/notepad/utils/empty-state-message.ts`:

```typescript
import { sanitizeFirstName } from './personalization';

/**
 * Copy for the editor's no-active-note state. Personalizes with the user's
 * first name when one is available; otherwise returns the name-less line,
 * which is a true subset so the loading state never produces a jarring swap.
 *
 * First-name extraction is delegated to `sanitizeFirstName` (injection-safe,
 * first-token-only). Any unusable name falls back to the plain line.
 */
export function emptyStateMessage(fullName: string | null | undefined): string {
  const firstName = sanitizeFirstName(fullName);
  return firstName ? `The page is yours, ${firstName}.` : 'The page is yours.';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notepad/utils/empty-state-message.test.ts`
Expected: PASS — 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/utils/empty-state-message.ts src/notepad/utils/empty-state-message.test.ts
git commit -m "feat(notepad): add personalized empty-state message helper"
```

---

## Task 2: Wire the helper into the editor empty state

**Files:**
- Modify: `src/notepad/components/Editor.tsx` (imports near line 19-26; empty-state branch at lines 123-139)

- [ ] **Step 1: Add the imports**

In `src/notepad/components/Editor.tsx`, alongside the existing context-hook imports (after the `useNoteCollection` import on line 19), add:

```typescript
import { useAccountProfile } from '../../auth/context/useAccountProfile';
```

And alongside the existing util import (`import { formatTag } from '../utils/tags';` on line 26), add:

```typescript
import { emptyStateMessage } from '../utils/empty-state-message';
```

> Verify the relative path resolves from `src/notepad/components/Editor.tsx` to `src/auth/context/useAccountProfile.ts` — it is `../../auth/context/useAccountProfile`. If the file uses the `@/` alias elsewhere, prefer `@/auth/context/useAccountProfile` to match local style.

- [ ] **Step 2: Read the profile inside the component**

Inside `NotepadEditor`, next to the other hook calls (after `const { notes, activeNote, collection } = useNoteCollection();` on line 62), add:

```typescript
  const { profile } = useAccountProfile();
```

- [ ] **Step 3: Replace the static placeholder text**

In the no-active-note branch (lines 123-139), replace the hardcoded line:

```tsx
        Select a note or create a new one
```

with:

```tsx
        {emptyStateMessage(profile?.fullName)}
```

Leave the surrounding `<div>` and its styles unchanged.

- [ ] **Step 4: Typecheck and run the full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: typecheck clean; all tests pass (including the new helper test from Task 1).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/Editor.tsx
git commit -m "feat(notepad): greet user by first name in editor empty state"
```

---

## Task 3: Manual verification

- [ ] **Step 1: Run the app and confirm both branches**

Run the dev server (e.g. `npm run dev`), sign in, and open the notepad editor with no note selected.

Verify:
- Signed-in user with a name on file sees `The page is yours, {firstName}.`
- During profile load (and for any account with no name) the line reads `The page is yours.` with no flicker between the two forms.
- Both the desktop editor (`Notepad.tsx`) and the mobile editor (`MobileEditorView.tsx`) show the new copy.

No commit — verification only.

---

## Self-Review

- **Spec coverage:** Copy (`The page is yours, {firstName}.` / `The page is yours.`) → Task 1. First-name derivation via existing util → Task 1 (`sanitizeFirstName`, an improvement over the spec's `split(' ')[0]` precedent — injection-safe, same first-token result). Single edit to shared `NotepadEditor` covering both surfaces → Task 2. No styling changes → Task 2 Step 3. Testing (both branches) → Task 1 test + Task 3 manual. All spec sections covered.
- **Placeholder scan:** No TBD/TODO; every code step shows complete code and exact commands.
- **Type consistency:** `emptyStateMessage(fullName: string | null | undefined): string` defined in Task 1 is called as `emptyStateMessage(profile?.fullName)` in Task 2; `profile.fullName` is `string | null` per `UserProfile`, compatible with the parameter type.
