# Session Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a refresh or sign-out/sign-in, return the user to the note they had open, the top-level view they were in, and the Bible book/chapter they were reading — all persisted per-device.

**Architecture:** A single localStorage-backed helper module (`session-storage.ts`) exposes typed get/set functions. The notes layer persists the open-note id at its existing selection chokepoint and restores it (guarded by existence) after notes load. The mobile workspace, desktop editor tab bar, StudyWindow tab, and BibleStudyPane each lazily initialize their view/passage state from the helper and persist on change.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, localStorage. Typecheck with `tsc -b` (NOT bare `tsc --noEmit`).

**Scope note:** Bible verse highlighting is a separate subsystem with its own plan (`2026-06-11-bible-verse-highlighting.md`). This plan covers only "leave off where you left off."

**Spec:** `docs/superpowers/specs/2026-06-11-session-restore-and-bible-highlights-design.md`

---

## File Structure

- **Create** `src/notepad/session/session-storage.ts` — all localStorage read/write helpers for session state (last note id, active mobile tab, editor tab, study tab, Bible passage). One responsibility: durable per-device session state.
- **Create** `src/notepad/session/session-storage.test.ts` — unit tests for the helpers.
- **Modify** `src/notepad/collection/note-collection.ts` — persist/restore the open note.
- **Modify** `src/notepad/collection/note-collection.test.ts` (create if absent) — tests for persist/restore behavior.
- **Modify** `src/notepad/bible/BibleStudyPane.tsx` — lazy-init + persist the Bible passage.
- **Modify** `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx` — lazy-init + persist the mobile tab.
- **Modify** `src/components/sections/Notepad.tsx` — lazy-init + persist the desktop editor `activeTab`.
- **Modify** `src/components/sections/notepad/StudyWindow.tsx` — lazy-init + persist the study `tab` (bible/graph).

---

## Task 1: session-storage helper module

**Files:**
- Create: `src/notepad/session/session-storage.ts`
- Test: `src/notepad/session/session-storage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/notepad/session/session-storage.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadLastNoteId,
  saveLastNoteId,
  loadEnum,
  saveEnum,
  loadBiblePassage,
  saveBiblePassage,
} from './session-storage';

afterEach(() => {
  localStorage.clear();
});

describe('session-storage', () => {
  it('round-trips the last note id', () => {
    expect(loadLastNoteId()).toBeNull();
    saveLastNoteId('note-123');
    expect(loadLastNoteId()).toBe('note-123');
    saveLastNoteId(null);
    expect(loadLastNoteId()).toBeNull();
  });

  it('round-trips an enum value within an allow-list', () => {
    const allowed = ['notes', 'editor', 'lamplight'] as const;
    expect(loadEnum('psalms.test.tab', allowed, 'notes')).toBe('notes');
    saveEnum('psalms.test.tab', 'editor');
    expect(loadEnum('psalms.test.tab', allowed, 'notes')).toBe('editor');
  });

  it('falls back when a stored enum value is not in the allow-list', () => {
    const allowed = ['notes', 'editor'] as const;
    saveEnum('psalms.test.tab', 'garbage');
    expect(loadEnum('psalms.test.tab', allowed, 'notes')).toBe('notes');
  });

  it('round-trips a Bible passage', () => {
    expect(loadBiblePassage()).toBeNull();
    saveBiblePassage({ book: 'psa', chapter: 23 });
    expect(loadBiblePassage()).toEqual({ book: 'psa', chapter: 23 });
  });

  it('returns null for a malformed stored passage', () => {
    localStorage.setItem('psalms.bible.passage', '{not json');
    expect(loadBiblePassage()).toBeNull();
    localStorage.setItem('psalms.bible.passage', '{"book":"psa"}'); // missing chapter
    expect(loadBiblePassage()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/session/session-storage.test.ts`
Expected: FAIL — `Cannot find module './session-storage'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/notepad/session/session-storage.ts`:

```ts
// Per-device session state persisted to localStorage so the app can return the
// user to where they left off after a refresh or sign-out/sign-in. All reads and
// writes are guarded — a disabled/full localStorage degrades to "no memory"
// rather than throwing.

const KEY_LAST_NOTE = 'psalms.session.lastNoteId';
const KEY_MOBILE_TAB = 'psalms.session.mobileTab';
const KEY_EDITOR_TAB = 'psalms.session.editorTab';
const KEY_STUDY_TAB = 'psalms.session.studyTab';
const KEY_BIBLE_PASSAGE = 'psalms.bible.passage';

export {
  KEY_LAST_NOTE,
  KEY_MOBILE_TAB,
  KEY_EDITOR_TAB,
  KEY_STUDY_TAB,
};

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore — persistence is best-effort
  }
}

export function loadLastNoteId(): string | null {
  return readRaw(KEY_LAST_NOTE);
}

export function saveLastNoteId(id: string | null): void {
  writeRaw(KEY_LAST_NOTE, id);
}

// Generic enum persistence with an allow-list guard so a stale/garbage value
// never selects an invalid view.
export function loadEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = readRaw(key);
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export function saveEnum(key: string, value: string): void {
  writeRaw(key, value);
}

export interface StoredPassage {
  book: string;
  chapter: number;
}

export function loadBiblePassage(): StoredPassage | null {
  const raw = readRaw(KEY_BIBLE_PASSAGE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as StoredPassage).book === 'string' &&
      typeof (parsed as StoredPassage).chapter === 'number'
    ) {
      return { book: (parsed as StoredPassage).book, chapter: (parsed as StoredPassage).chapter };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveBiblePassage(passage: StoredPassage): void {
  writeRaw(KEY_BIBLE_PASSAGE, JSON.stringify(passage));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notepad/session/session-storage.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/session/session-storage.ts src/notepad/session/session-storage.test.ts
git commit -m "feat(session): add localStorage helpers for session restore"
```

---

## Task 2: Persist + restore the open note

**Files:**
- Modify: `src/notepad/collection/note-collection.ts`
- Test: `src/notepad/collection/note-collection.test.ts` (create)

The behavior: `openNote(id)` and `createNote(...)` persist the id; `deleteNote(id)` clears the stored id when the deleted note was the open one; `init()` restores the stored id only if a note with that id is present in the loaded set.

- [ ] **Step 1: Write the failing test**

Create `src/notepad/collection/note-collection.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { NoteCollection } from './note-collection';
import { loadLastNoteId } from '../session/session-storage';
import type { StorageAdapter } from '../storage/adapter';
import type { Note } from '../types';

function makeNote(id: string): Note {
  const now = new Date().toISOString();
  return {
    id,
    title: id,
    content: '',
    folderId: 'root',
    type: 'note',
    tags: [],
    wordCount: 0,
    createdAt: now,
    updatedAt: now,
  } as Note;
}

// Minimal in-memory adapter seeded with a fixed note list.
function fakeAdapter(notes: Note[]): StorageAdapter {
  return {
    getNotes: async () => notes,
    getNote: async (id) => notes.find((n) => n.id === id) ?? null,
    createNote: async (n) => makeNote('created-1'),
    importNote: async (n) => n,
    updateNote: async (id, u) => ({ ...makeNote(id), ...u }),
    deleteNote: async () => {},
    duplicateNote: async (id) => makeNote(`${id}-dup`),
    getFolders: async () => [],
    createFolder: async (f) => ({ ...f, id: 'f1' }),
    importFolder: async (f) => f,
    updateFolder: async (id, u) => ({ id, name: '', parentId: null, ...u }),
    deleteFolder: async () => {},
  } as StorageAdapter;
}

afterEach(() => localStorage.clear());

describe('NoteCollection session restore', () => {
  it('persists the id when a note is opened', () => {
    const c = new NoteCollection(fakeAdapter([makeNote('a'), makeNote('b')]));
    c.openNote('b');
    expect(loadLastNoteId()).toBe('b');
  });

  it('restores the persisted note on init when it still exists', async () => {
    localStorage.setItem('psalms.session.lastNoteId', 'b');
    const c = new NoteCollection(fakeAdapter([makeNote('a'), makeNote('b')]));
    await c.init();
    expect(c.getSnapshot().activeNoteId).toBe('b');
  });

  it('does not restore a persisted note that no longer exists', async () => {
    localStorage.setItem('psalms.session.lastNoteId', 'gone');
    const c = new NoteCollection(fakeAdapter([makeNote('a')]));
    await c.init();
    expect(c.getSnapshot().activeNoteId).toBeNull();
  });

  it('clears the persisted id when the open note is deleted', async () => {
    const c = new NoteCollection(fakeAdapter([makeNote('a')]));
    c.openNote('a');
    await c.deleteNote('a');
    expect(loadLastNoteId()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/collection/note-collection.test.ts`
Expected: FAIL — `init` does not restore (activeNoteId is null in the restore test); `openNote`/`deleteNote` do not touch localStorage.

- [ ] **Step 3: Write minimal implementation**

In `src/notepad/collection/note-collection.ts`, add the import at the top (after the existing imports):

```ts
import { loadLastNoteId, saveLastNoteId } from '../session/session-storage';
```

Replace `init()` (currently lines 25-28) with:

```ts
  async init(): Promise<void> {
    const notes = await this.adapter.getNotes();
    // Restore the last-open note only when it still exists in this adapter's set.
    // Signed-in (Supabase) and signed-out (local) id spaces never collide, so a
    // stored id from the other scope simply won't be found here.
    const restoredId = loadLastNoteId();
    const activeNoteId = restoredId && notes.some((n) => n.id === restoredId) ? restoredId : null;
    this.update((prev) => ({ ...prev, notes, activeNoteId }));
  }
```

Replace `openNote` (currently lines 30-32) with:

```ts
  openNote = (id: string | null): void => {
    saveLastNoteId(id);
    this.update((prev) => ({ ...prev, activeNoteId: id }));
  };
```

In `createNote` (currently lines 34-49), persist the new note as the last-open one. After `const created = await this.adapter.createNote({...})` and before the `this.update(...)` call, add:

```ts
    saveLastNoteId(created.id);
```

In `deleteNote` (currently lines 60-67), clear the stored id when the deleted note is the open one. Replace the body with:

```ts
  deleteNote = async (id: string): Promise<void> => {
    await this.adapter.deleteNote(id);
    this.update((prev) => {
      if (prev.activeNoteId === id) saveLastNoteId(null);
      return {
        ...prev,
        notes: prev.notes.filter((n) => n.id !== id),
        activeNoteId: prev.activeNoteId === id ? null : prev.activeNoteId,
      };
    });
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notepad/collection/note-collection.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify no regressions in the notes layer**

Run: `npx vitest run src/notepad/collection`
Expected: PASS (existing collection tests still green).

- [ ] **Step 6: Commit**

```bash
git add src/notepad/collection/note-collection.ts src/notepad/collection/note-collection.test.ts
git commit -m "feat(session): persist and restore the open note across refresh/sign-in"
```

---

## Task 3: Restore the Bible passage

**Files:**
- Modify: `src/notepad/bible/BibleStudyPane.tsx`

`passage` is `useState<PassageRef>({ book: 'jhn', chapter: 1 })` at line 25. We lazy-init it from storage (validated) and persist it from the existing `handlePassageChange` chokepoint. `BibleReader` already accepts `initialBook`/`initialChapter`, so we pass the restored values down.

- [ ] **Step 1: Add the validated lazy initializer and persistence**

In `src/notepad/bible/BibleStudyPane.tsx`:

Add imports near the top (after the existing `BibleReader` import on line 12):

```ts
import { bookByAbbrev } from './bible-books';
import { loadBiblePassage, saveBiblePassage } from '@/notepad/session/session-storage';
```

Replace the `passage` state declaration (line 25):

```ts
  const [passage, setPassage] = useState<PassageRef>({ book: 'jhn', chapter: 1 });
```

with a validated lazy initializer:

```ts
  const [passage, setPassage] = useState<PassageRef>(() => {
    const stored = loadBiblePassage();
    if (stored) {
      const meta = bookByAbbrev(stored.book);
      // Only restore when the book is real and the chapter is in range.
      if (meta && stored.chapter >= 1 && stored.chapter <= meta.chapterCount) {
        return { book: stored.book, chapter: stored.chapter };
      }
    }
    return { book: 'jhn', chapter: 1 };
  });
```

Replace `handlePassageChange` (lines 33-35) so it also persists:

```ts
  const handlePassageChange = useCallback((ref: PassageRef) => {
    setPassage((prev) => {
      if (prev.book === ref.book && prev.chapter === ref.chapter) return prev;
      saveBiblePassage(ref);
      return ref;
    });
  }, []);
```

Pass the restored passage into `BibleReader` so it starts there. Replace line 98:

```ts
          <BibleReader onPassageChange={handlePassageChange} />
```

with:

```ts
          <BibleReader
            initialBook={passage.book}
            initialChapter={passage.chapter}
            onPassageChange={handlePassageChange}
          />
```

- [ ] **Step 2: Typecheck**

Run: `tsc -b`
Expected: no new errors (the repo baseline has 4 pre-existing `tsc` errors in `force-sphere.test.ts`; do not introduce new ones).

- [ ] **Step 3: Manual verification**

Run the app (`npm run dev`), open the Bible study window, navigate to Psalm 23, refresh the page. Expected: the reader reopens at Psalm 23, not John 1. Then set `localStorage['psalms.bible.passage'] = '{"book":"zzz","chapter":99}'` in devtools and refresh. Expected: falls back to John 1.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/bible/BibleStudyPane.tsx
git commit -m "feat(session): restore last Bible book/chapter on reload"
```

---

## Task 4: Restore the mobile top-level tab

**Files:**
- Modify: `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`

The mobile `tab` state (line 38) is the primary view switch. We lazy-init it from storage (validated against the `MobileTab` union, excluding the transient `'more'` sheet) and persist every change via an effect. If `'editor'` is restored but no note ends up active, fall back to `'notes'`.

- [ ] **Step 1: Lazy-init + persist the tab**

In `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`:

Add `useEffect` to the React import (line 2):

```ts
import { useCallback, useEffect, useState } from 'react';
```

Add the session-storage import near the other imports (e.g. after line 26):

```ts
import { loadEnum, saveEnum, KEY_MOBILE_TAB } from '../../../../notepad/session/session-storage';
```

Replace the `tab` state declaration (line 38):

```ts
  const [tab, setTab] = useState<MobileTab>('notes');
```

with a validated lazy initializer. `'more'` is a transient sheet, never a restorable view:

```ts
  const [tab, setTab] = useState<MobileTab>(() =>
    loadEnum<MobileTab>(KEY_MOBILE_TAB, ['notes', 'editor', 'lamplight'], 'notes'),
  );
```

After the `tab` state and the other `useState` lines, add an effect that persists changes and guards a stale `'editor'` restore (no active note → show the list instead):

```ts
  // Persist the active tab so a refresh lands the user back on it. If 'editor'
  // was restored but no note became active, drop back to the notes list.
  useEffect(() => {
    if (tab === 'editor' && !model.activeNote) {
      setTab('notes');
      return;
    }
    saveEnum(KEY_MOBILE_TAB, tab);
  }, [tab, model.activeNote]);
```

- [ ] **Step 2: Typecheck**

Run: `tsc -b`
Expected: no new errors. (`MobileTab` is imported from `./types` at line 26; confirm it includes `'notes' | 'editor' | 'lamplight' | 'more'`.)

- [ ] **Step 3: Manual verification (mobile viewport)**

Run the app, switch to a mobile viewport, open a note (lands on `editor`), refresh. Expected: returns to the editor on that note. Sign out then back in. Expected: returns to the editor if the note exists in the signed-in set, otherwise the notes list.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx
git commit -m "feat(session): restore the active mobile tab on reload"
```

---

## Task 5: Restore the desktop editor tab and StudyWindow tab

**Files:**
- Modify: `src/components/sections/Notepad.tsx`
- Modify: `src/components/sections/notepad/StudyWindow.tsx`

Two small desktop view-states: the editor's `activeTab` (content/backlinks/info/lamplight) and the StudyWindow's `tab` (bible/graph).

- [ ] **Step 1: Persist the desktop editor `activeTab`**

In `src/components/sections/Notepad.tsx`:

Update the React import (line 1):

```ts
import { useState, useCallback, useMemo, useEffect } from 'react';
```

Add the session-storage import (after line 24):

```ts
import { loadEnum, saveEnum, KEY_EDITOR_TAB } from '@/notepad/session/session-storage';
```

Replace the `activeTab` state declaration (line 30):

```ts
  const [activeTab, setActiveTab] = useState<'content' | 'backlinks' | 'info' | 'lamplight'>('content');
```

with a restored initializer:

```ts
  const [activeTab, setActiveTab] = useState<'content' | 'backlinks' | 'info' | 'lamplight'>(() =>
    loadEnum(KEY_EDITOR_TAB, ['content', 'backlinks', 'info', 'lamplight'] as const, 'content'),
  );
```

Immediately after the `activeTab` declaration, add:

```ts
  useEffect(() => {
    saveEnum(KEY_EDITOR_TAB, activeTab);
  }, [activeTab]);
```

- [ ] **Step 2: Persist the StudyWindow `tab`**

In `src/components/sections/notepad/StudyWindow.tsx`:

Update the React import (line 2):

```ts
import { useEffect, useState } from 'react';
```

Add the session-storage import (after line 7):

```ts
import { loadEnum, saveEnum, KEY_STUDY_TAB } from '@/notepad/session/session-storage';
```

Replace the `tab` state declaration (line 21):

```ts
  const [tab, setTab] = useState<StudyTab>('bible');
```

with:

```ts
  const [tab, setTab] = useState<StudyTab>(() =>
    loadEnum<StudyTab>(KEY_STUDY_TAB, ['bible', 'graph'], 'bible'),
  );

  useEffect(() => {
    saveEnum(KEY_STUDY_TAB, tab);
  }, [tab]);
```

- [ ] **Step 3: Typecheck**

Run: `tsc -b`
Expected: no new errors.

- [ ] **Step 4: Manual verification (desktop viewport)**

Run the app on a desktop viewport. Switch the editor pane to the "Info" tab and the study window to "GRAPH", then refresh. Expected: both come back selected.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/Notepad.tsx src/components/sections/notepad/StudyWindow.tsx
git commit -m "feat(session): restore desktop editor tab and study window tab"
```

---

## Task 6: Full verification pass

- [ ] **Step 1: Run the full unit suite for touched areas**

Run: `npx vitest run src/notepad/session src/notepad/collection`
Expected: PASS.

- [ ] **Step 2: Typecheck the whole build**

Run: `tsc -b`
Expected: only the 4 pre-existing `force-sphere.test.ts` errors — zero new errors.

- [ ] **Step 3: Lint the changed files**

Run: `npx eslint src/notepad/session src/notepad/collection/note-collection.ts src/notepad/bible/BibleStudyPane.tsx src/components/sections/Notepad.tsx src/components/sections/notepad/StudyWindow.tsx src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`
Expected: zero new errors over the pre-existing ~114-error baseline (ideally clean for these files).

- [ ] **Step 4: End-to-end manual smoke**

With `npm run dev`: open a note → refresh → same note open. Navigate Bible to Psalm 23 → refresh → Psalm 23. Sign out → sign in → the signed-in last note reopens (or list if none). Confirm no console errors.

---

## Self-Review Notes

- **Spec coverage:** Section 1 (open note) → Task 2. Section 1b (active top-level view) → Tasks 4 (mobile) + 5 (desktop editor tab + study tab). Section 2 (Bible passage) → Task 3. Bible highlighting (Section 3) is intentionally deferred to its own plan.
- **Scope-key simplification:** the spec described scope-keying by user-id/local; the existence guard in Task 2 achieves the same observable behavior (never reopen a wrong-scope note) without threading user identity into `NoteCollection`. This is a deliberate, documented refinement.
- **Type consistency:** `loadEnum`/`saveEnum`/`loadLastNoteId`/`saveLastNoteId`/`loadBiblePassage`/`saveBiblePassage` are defined once in Task 1 and used unchanged in Tasks 2-5. Key constants (`KEY_MOBILE_TAB`, `KEY_EDITOR_TAB`, `KEY_STUDY_TAB`) are exported from the helper and imported where used.
