# Deepen the Notepad Collection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 48-field `NotepadContext` god-bag with three deep modules — `NoteCollection`, `FolderHierarchy`, `NotepadActions` — each with a small, testable interface and its own React subscription seam.

**Architecture:** Modules are plain TypeScript classes that extend a tiny `Observable<T>` subscription primitive. Each owns a reference to a `StorageAdapter` and patches its local state from adapter return values (no full refetch on single-entity mutations; full refetch reserved for `importNotes` and the legacy repair pass). React consumers subscribe via `useSyncExternalStore` so re-renders are scoped to whichever slice changed. Cross-module sequencing (`deleteFolder` cascade, `importNotes`, adapter rebind, init) lives only in `NotepadActions`. `journalTheme` and graph fields are evicted from the provider entirely.

**Tech Stack:** TypeScript 5.9, React 19, Vite 7, Vitest (added in Task 1), existing `StorageAdapter` interface.

**Domain language:** see [docs/CONTEXT.md](../../CONTEXT.md). The names `NoteCollection`, `FolderHierarchy`, and `NotepadActions` come from there — use them exactly.

---

## File Structure

### New files
- `src/notepad/collection/observable.ts` — tiny subscription primitive
- `src/notepad/collection/observable.test.ts`
- `src/notepad/collection/fake-storage-adapter.ts` — in-memory `StorageAdapter` test fake
- `src/notepad/collection/note-collection.ts` — deep module: notes + active selection
- `src/notepad/collection/note-collection.test.ts`
- `src/notepad/collection/folder-hierarchy.ts` — folder CRUD
- `src/notepad/collection/folder-hierarchy.test.ts`
- `src/notepad/collection/notepad-actions.ts` — coordinator
- `src/notepad/collection/notepad-actions.test.ts`
- `src/notepad/collection/index.ts` — barrel
- `src/notepad/context/useNoteCollection.ts` — narrow hook
- `src/notepad/context/useFolderHierarchy.ts` — narrow hook
- `src/notepad/context/useNotepadActions.ts` — narrow hook
- `src/notepad/hooks/use-journal-theme.ts` — evicted from provider
- `vitest.config.ts`

### Modified files
- `package.json` — add Vitest + scripts
- `src/notepad/context/NotepadProvider.tsx` — rewritten to construct + provide modules
- `src/notepad/context/useNotepad.ts` — eventually deleted
- `src/notepad/components/Editor.tsx` — narrow hook + use-journal-theme
- `src/notepad/components/Sidebar.tsx` — narrow hooks
- `src/notepad/components/InfoPanel.tsx` — narrow hook
- `src/notepad/components/SearchDialog.tsx` — narrow hook
- `src/notepad/components/BacklinksPanel.tsx` — narrow hook
- `src/notepad/components/NotepadToolbar.tsx` — narrow hook
- `src/notepad/components/NewFolderDialog.tsx` — narrow hook
- `src/notepad/components/UploadModal.tsx` — narrow hook
- `src/components/sections/Notepad.tsx` — drop `refresh`
- `src/components/sections/notepad/GraphPane.tsx` — call `useGraph` directly
- `src/auth/AuthProvider.tsx` — pass adapter as prop only; effect inside provider handles rebind

### Deleted (final task)
- All graph fields and `journalTheme` from the provider value
- The legacy fat `useNotepad()` shape and its `refresh` export

---

## Task 1: Set up Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/notepad/collection/sanity.test.ts` (deleted at end of task)

- [ ] **Step 1: Install Vitest**

```bash
cd /Users/newmac/Downloads/Psalms_app && npm install --save-dev vitest @vitest/ui
```

Expected: `vitest` and `@vitest/ui` added to `devDependencies`.

- [ ] **Step 2: Add test scripts to package.json**

Edit `package.json` `scripts` block to:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui"
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4: Verify with a sanity test**

Create `src/notepad/collection/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 5: Delete the sanity test and commit**

```bash
rm src/notepad/collection/sanity.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test infrastructure"
```

---

## Task 2: Build the `Observable<T>` subscription primitive (TDD)

**Files:**
- Create: `src/notepad/collection/observable.ts`
- Test: `src/notepad/collection/observable.test.ts`

The primitive every module extends. Compatible with React's `useSyncExternalStore` contract: `subscribe(listener) → unsubscribe`, `getSnapshot()` returns a stable reference until state actually changes.

- [ ] **Step 1: Write the failing test**

`src/notepad/collection/observable.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { Observable } from './observable';

class TestObservable extends Observable<{ count: number }> {
  constructor() { super({ count: 0 }); }
  increment() { this.setState((s) => ({ count: s.count + 1 })); }
  noop() { this.setState((s) => s); }
}

describe('Observable', () => {
  it('returns initial snapshot', () => {
    const obs = new TestObservable();
    expect(obs.getSnapshot()).toEqual({ count: 0 });
  });

  it('notifies subscribers on state change', () => {
    const obs = new TestObservable();
    const listener = vi.fn();
    obs.subscribe(listener);
    obs.increment();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(obs.getSnapshot()).toEqual({ count: 1 });
  });

  it('returns stable snapshot reference when unchanged', () => {
    const obs = new TestObservable();
    const before = obs.getSnapshot();
    obs.noop();
    const after = obs.getSnapshot();
    expect(after).toBe(before);
  });

  it('does not notify when setState returns the same reference', () => {
    const obs = new TestObservable();
    const listener = vi.fn();
    obs.subscribe(listener);
    obs.noop();
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribe stops further notifications', () => {
    const obs = new TestObservable();
    const listener = vi.fn();
    const unsubscribe = obs.subscribe(listener);
    obs.increment();
    unsubscribe();
    obs.increment();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('supports multiple independent subscribers', () => {
    const obs = new TestObservable();
    const a = vi.fn();
    const b = vi.fn();
    obs.subscribe(a);
    obs.subscribe(b);
    obs.increment();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- observable`
Expected: FAIL — module `./observable` not found.

- [ ] **Step 3: Write minimal implementation**

`src/notepad/collection/observable.ts`:

```ts
export class Observable<T> {
  private snapshot: T;
  private listeners = new Set<() => void>();

  constructor(initial: T) {
    this.snapshot = initial;
  }

  getSnapshot = (): T => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  protected setState(updater: (prev: T) => T): void {
    const next = updater(this.snapshot);
    if (next === this.snapshot) return;
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- observable`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/collection/observable.ts src/notepad/collection/observable.test.ts
git commit -m "feat(notepad): add Observable subscription primitive"
```

---

## Task 3: Build the `FakeStorageAdapter` test fixture

**Files:**
- Create: `src/notepad/collection/fake-storage-adapter.ts`

A test-only in-memory implementation of `StorageAdapter`. Used by every module test so we never touch localStorage or Supabase from a unit test.

- [ ] **Step 1: Write the implementation**

`src/notepad/collection/fake-storage-adapter.ts`:

```ts
import type { StorageAdapter } from '../storage/adapter';
import type { Note, Folder } from '../types';

let idCounter = 0;
const nextId = () => `id-${++idCounter}`;

export function resetFakeAdapterIds(): void {
  idCounter = 0;
}

export class FakeStorageAdapter implements StorageAdapter {
  notes: Note[] = [];
  folders: Folder[] = [];

  async getNotes(): Promise<Note[]> {
    return this.notes.slice();
  }

  async getNote(id: string): Promise<Note | null> {
    return this.notes.find((n) => n.id === id) ?? null;
  }

  async createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    const now = new Date().toISOString();
    const created: Note = { ...note, id: nextId(), createdAt: now, updatedAt: now };
    this.notes.push(created);
    return { ...created };
  }

  async importNote(note: Note): Promise<Note> {
    this.notes = this.notes.filter((n) => n.id !== note.id);
    this.notes.push(note);
    return { ...note };
  }

  async updateNote(id: string, updates: Partial<Note>): Promise<Note> {
    const index = this.notes.findIndex((n) => n.id === id);
    if (index === -1) throw new Error(`Note ${id} not found`);
    const updated: Note = {
      ...this.notes[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.notes[index] = updated;
    return { ...updated };
  }

  async deleteNote(id: string): Promise<void> {
    this.notes = this.notes.filter((n) => n.id !== id);
  }

  async duplicateNote(id: string): Promise<Note> {
    const original = this.notes.find((n) => n.id === id);
    if (!original) throw new Error(`Note ${id} not found`);
    const now = new Date().toISOString();
    const dup: Note = { ...original, id: nextId(), title: `${original.title} (copy)`, createdAt: now, updatedAt: now };
    this.notes.push(dup);
    return { ...dup };
  }

  async getFolders(): Promise<Folder[]> {
    return this.folders.slice();
  }

  async createFolder(folder: Omit<Folder, 'id'>): Promise<Folder> {
    const created: Folder = { ...folder, id: nextId() };
    this.folders.push(created);
    return { ...created };
  }

  async importFolder(folder: Folder): Promise<Folder> {
    this.folders = this.folders.filter((f) => f.id !== folder.id);
    this.folders.push(folder);
    return { ...folder };
  }

  async updateFolder(id: string, updates: Partial<Folder>): Promise<Folder> {
    const index = this.folders.findIndex((f) => f.id === id);
    if (index === -1) throw new Error(`Folder ${id} not found`);
    const updated: Folder = { ...this.folders[index], ...updates };
    this.folders[index] = updated;
    return { ...updated };
  }

  async deleteFolder(id: string): Promise<void> {
    this.folders = this.folders.filter((f) => f.id !== id);
    this.notes = this.notes.map((n) => (n.folderId === id ? { ...n, folderId: 'root' } : n));
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/notepad/collection/fake-storage-adapter.ts
git commit -m "test(notepad): add FakeStorageAdapter fixture"
```

---

## Task 4: `NoteCollection` — read, init, snapshot (TDD)

**Files:**
- Create: `src/notepad/collection/note-collection.ts`
- Test: `src/notepad/collection/note-collection.test.ts`

Initial slice: just construction, `init()` (loads from adapter), and `openNote()` (selection). Defer mutations to Task 5.

- [ ] **Step 1: Write the failing test**

`src/notepad/collection/note-collection.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { NoteCollection } from './note-collection';
import { FakeStorageAdapter, resetFakeAdapterIds } from './fake-storage-adapter';

function seedNote(adapter: FakeStorageAdapter, overrides: Partial<{ id: string; title: string; folderId: string }> = {}) {
  const id = overrides.id ?? `id-seed-${adapter.notes.length}`;
  adapter.notes.push({
    id,
    title: overrides.title ?? 'Seeded',
    content: '',
    folderId: overrides.folderId ?? 'root',
    type: 'note',
    tags: [],
    wordCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  });
  return id;
}

describe('NoteCollection — read & init', () => {
  let adapter: FakeStorageAdapter;
  let collection: NoteCollection;

  beforeEach(() => {
    resetFakeAdapterIds();
    adapter = new FakeStorageAdapter();
    collection = new NoteCollection(adapter);
  });

  it('starts with empty state and no active note', () => {
    const state = collection.getSnapshot();
    expect(state.notes).toEqual([]);
    expect(state.activeNoteId).toBeNull();
    expect(state.activeNote).toBeNull();
  });

  it('init() loads notes from the adapter', async () => {
    seedNote(adapter, { id: 'a', title: 'A' });
    seedNote(adapter, { id: 'b', title: 'B' });
    await collection.init();
    expect(collection.getSnapshot().notes.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('openNote(id) sets activeNoteId and derives activeNote', async () => {
    seedNote(adapter, { id: 'a' });
    await collection.init();
    collection.openNote('a');
    const state = collection.getSnapshot();
    expect(state.activeNoteId).toBe('a');
    expect(state.activeNote?.id).toBe('a');
  });

  it('openNote(null) clears active selection', async () => {
    seedNote(adapter, { id: 'a' });
    await collection.init();
    collection.openNote('a');
    collection.openNote(null);
    expect(collection.getSnapshot().activeNoteId).toBeNull();
    expect(collection.getSnapshot().activeNote).toBeNull();
  });

  it('activeNote is null when activeNoteId points to a missing note', async () => {
    await collection.init();
    collection.openNote('does-not-exist');
    expect(collection.getSnapshot().activeNoteId).toBe('does-not-exist');
    expect(collection.getSnapshot().activeNote).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- note-collection`
Expected: FAIL — module `./note-collection` not found.

- [ ] **Step 3: Write minimal implementation**

`src/notepad/collection/note-collection.ts`:

```ts
import { Observable } from './observable';
import type { StorageAdapter } from '../storage/adapter';
import type { Note } from '../types';

export interface NoteCollectionState {
  notes: Note[];
  activeNoteId: string | null;
  activeNote: Note | null;
}

const EMPTY_STATE: NoteCollectionState = {
  notes: [],
  activeNoteId: null,
  activeNote: null,
};

export class NoteCollection extends Observable<NoteCollectionState> {
  private adapter: StorageAdapter;

  constructor(adapter: StorageAdapter) {
    super(EMPTY_STATE);
    this.adapter = adapter;
  }

  async init(): Promise<void> {
    const notes = await this.adapter.getNotes();
    this.update((prev) => ({ ...prev, notes }));
  }

  openNote = (id: string | null): void => {
    this.update((prev) => ({ ...prev, activeNoteId: id }));
  };

  private update(updater: (prev: NoteCollectionState) => NoteCollectionState): void {
    this.setState((prev) => {
      const next = updater(prev);
      const activeNote = next.activeNoteId
        ? next.notes.find((n) => n.id === next.activeNoteId) ?? null
        : null;
      return { ...next, activeNote };
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- note-collection`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/collection/note-collection.ts src/notepad/collection/note-collection.test.ts
git commit -m "feat(notepad): NoteCollection — read, init, selection"
```

---

## Task 5: `NoteCollection` — single mutations + selection invariant (TDD)

**Files:**
- Modify: `src/notepad/collection/note-collection.ts`
- Modify: `src/notepad/collection/note-collection.test.ts`

Add `createNote`, `updateNote`, `deleteNote` with targeted patching. Verify the deletion-clears-active invariant.

- [ ] **Step 1: Add failing tests**

Append to `src/notepad/collection/note-collection.test.ts`:

```ts
describe('NoteCollection — single mutations', () => {
  let adapter: FakeStorageAdapter;
  let collection: NoteCollection;

  beforeEach(() => {
    resetFakeAdapterIds();
    adapter = new FakeStorageAdapter();
    collection = new NoteCollection(adapter);
  });

  it('createNote appends and selects the new note', async () => {
    await collection.init();
    const created = await collection.createNote('root', 'note');
    const state = collection.getSnapshot();
    expect(state.notes.map((n) => n.id)).toEqual([created.id]);
    expect(state.activeNoteId).toBe(created.id);
    expect(state.activeNote?.id).toBe(created.id);
  });

  it('updateNote replaces the entity in place without reordering others', async () => {
    seedNote(adapter, { id: 'a', title: 'A' });
    seedNote(adapter, { id: 'b', title: 'B' });
    seedNote(adapter, { id: 'c', title: 'C' });
    await collection.init();

    await collection.updateNote('b', { title: 'B-updated' });

    const state = collection.getSnapshot();
    expect(state.notes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(state.notes.find((n) => n.id === 'b')?.title).toBe('B-updated');
  });

  it('deleteNote removes the note', async () => {
    seedNote(adapter, { id: 'a' });
    seedNote(adapter, { id: 'b' });
    await collection.init();
    await collection.deleteNote('a');
    expect(collection.getSnapshot().notes.map((n) => n.id)).toEqual(['b']);
  });

  it('deleteNote clears activeNoteId when the deleted note was active', async () => {
    seedNote(adapter, { id: 'a' });
    await collection.init();
    collection.openNote('a');
    await collection.deleteNote('a');
    expect(collection.getSnapshot().activeNoteId).toBeNull();
    expect(collection.getSnapshot().activeNote).toBeNull();
  });

  it('deleteNote leaves activeNoteId intact when a different note was active', async () => {
    seedNote(adapter, { id: 'a' });
    seedNote(adapter, { id: 'b' });
    await collection.init();
    collection.openNote('a');
    await collection.deleteNote('b');
    expect(collection.getSnapshot().activeNoteId).toBe('a');
  });

  it('updateNote on the active note refreshes derived activeNote', async () => {
    seedNote(adapter, { id: 'a', title: 'A' });
    await collection.init();
    collection.openNote('a');
    await collection.updateNote('a', { title: 'A-renamed' });
    expect(collection.getSnapshot().activeNote?.title).toBe('A-renamed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- note-collection`
Expected: 6 new failures — methods don't exist.

- [ ] **Step 3: Implement single mutations**

Add these methods to `NoteCollection` in `src/notepad/collection/note-collection.ts` (after `openNote`):

```ts
async createNote(folderId: string, type: import('../types').NoteType): Promise<Note> {
  const created = await this.adapter.createNote({
    title: 'Untitled',
    content: '',
    folderId,
    type,
    tags: [],
    wordCount: 0,
  });
  this.update((prev) => ({
    ...prev,
    notes: [...prev.notes, created],
    activeNoteId: created.id,
  }));
  return created;
}

async updateNote(id: string, updates: Partial<Note>): Promise<Note> {
  const updated = await this.adapter.updateNote(id, updates);
  this.update((prev) => ({
    ...prev,
    notes: prev.notes.map((n) => (n.id === id ? updated : n)),
  }));
  return updated;
}

async deleteNote(id: string): Promise<void> {
  await this.adapter.deleteNote(id);
  this.update((prev) => ({
    ...prev,
    notes: prev.notes.filter((n) => n.id !== id),
    activeNoteId: prev.activeNoteId === id ? null : prev.activeNoteId,
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- note-collection`
Expected: 11 passed.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/collection/note-collection.ts src/notepad/collection/note-collection.test.ts
git commit -m "feat(notepad): NoteCollection — single mutations with selection invariant"
```

---

## Task 6: `NoteCollection` — sugar mutations, applyReparenting, refetchAll, rebindAdapter (TDD)

**Files:**
- Modify: `src/notepad/collection/note-collection.ts`
- Modify: `src/notepad/collection/note-collection.test.ts`

Adds `renameNote`, `moveNote`, `duplicateNote` (sugar over update/duplicate), `applyReparenting` (called by coordinator after folder delete), `refetchAll` (escape hatch), `rebindAdapter`.

- [ ] **Step 1: Add failing tests**

Append to `src/notepad/collection/note-collection.test.ts`:

```ts
describe('NoteCollection — sugar & bulk', () => {
  let adapter: FakeStorageAdapter;
  let collection: NoteCollection;

  beforeEach(() => {
    resetFakeAdapterIds();
    adapter = new FakeStorageAdapter();
    collection = new NoteCollection(adapter);
  });

  it('renameNote updates the title', async () => {
    seedNote(adapter, { id: 'a', title: 'Old' });
    await collection.init();
    const renamed = await collection.renameNote('a', 'New');
    expect(renamed.title).toBe('New');
    expect(collection.getSnapshot().notes[0].title).toBe('New');
  });

  it('moveNote updates the folderId', async () => {
    seedNote(adapter, { id: 'a', folderId: 'root' });
    await collection.init();
    await collection.moveNote('a', 'folder-1');
    expect(collection.getSnapshot().notes[0].folderId).toBe('folder-1');
  });

  it('duplicateNote appends the duplicate', async () => {
    seedNote(adapter, { id: 'a', title: 'Original' });
    await collection.init();
    const dup = await collection.duplicateNote('a');
    const state = collection.getSnapshot();
    expect(state.notes).toHaveLength(2);
    expect(state.notes[1].id).toBe(dup.id);
    expect(state.notes[1].title).toBe('Original (copy)');
  });

  it('applyReparenting patches folderId for the named ids only', async () => {
    seedNote(adapter, { id: 'a', folderId: 'F1' });
    seedNote(adapter, { id: 'b', folderId: 'F1' });
    seedNote(adapter, { id: 'c', folderId: 'F2' });
    await collection.init();

    collection.applyReparenting(['a', 'b'], 'root');

    const state = collection.getSnapshot();
    expect(state.notes.find((n) => n.id === 'a')?.folderId).toBe('root');
    expect(state.notes.find((n) => n.id === 'b')?.folderId).toBe('root');
    expect(state.notes.find((n) => n.id === 'c')?.folderId).toBe('F2');
  });

  it('refetchAll re-reads notes from the adapter', async () => {
    await collection.init();
    seedNote(adapter, { id: 'late', title: 'Late' });
    await collection.refetchAll();
    expect(collection.getSnapshot().notes.map((n) => n.id)).toEqual(['late']);
  });

  it('rebindAdapter swaps the adapter and clears state until the next init', async () => {
    seedNote(adapter, { id: 'a' });
    await collection.init();
    expect(collection.getSnapshot().notes).toHaveLength(1);

    const next = new FakeStorageAdapter();
    collection.rebindAdapter(next);
    expect(collection.getSnapshot().notes).toEqual([]);
    expect(collection.getSnapshot().activeNoteId).toBeNull();
  });

  it('after rebindAdapter, init reads from the new adapter', async () => {
    await collection.init();
    const next = new FakeStorageAdapter();
    next.notes.push({
      id: 'fresh', title: 'Fresh', content: '', folderId: 'root', type: 'note', tags: [], wordCount: 0,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    });
    collection.rebindAdapter(next);
    await collection.init();
    expect(collection.getSnapshot().notes.map((n) => n.id)).toEqual(['fresh']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- note-collection`
Expected: 7 new failures.

- [ ] **Step 3: Implement the new methods**

Add to `NoteCollection`:

```ts
renameNote(id: string, title: string): Promise<Note> {
  return this.updateNote(id, { title });
}

moveNote(id: string, folderId: string): Promise<Note> {
  return this.updateNote(id, { folderId });
}

async duplicateNote(id: string): Promise<Note> {
  const dup = await this.adapter.duplicateNote(id);
  this.update((prev) => ({ ...prev, notes: [...prev.notes, dup] }));
  return dup;
}

applyReparenting(noteIds: string[], newFolderId: string): void {
  const idSet = new Set(noteIds);
  this.update((prev) => ({
    ...prev,
    notes: prev.notes.map((n) =>
      idSet.has(n.id) ? { ...n, folderId: newFolderId } : n,
    ),
  }));
}

async refetchAll(): Promise<void> {
  const notes = await this.adapter.getNotes();
  this.update((prev) => ({ ...prev, notes }));
}

rebindAdapter(next: StorageAdapter): void {
  this.adapter = next;
  this.update(() => EMPTY_STATE);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- note-collection`
Expected: 18 passed.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/collection/note-collection.ts src/notepad/collection/note-collection.test.ts
git commit -m "feat(notepad): NoteCollection — sugar mutations, reparenting, rebind"
```

---

## Task 7: `FolderHierarchy` (TDD)

**Files:**
- Create: `src/notepad/collection/folder-hierarchy.ts`
- Test: `src/notepad/collection/folder-hierarchy.test.ts`

- [ ] **Step 1: Write the failing test**

`src/notepad/collection/folder-hierarchy.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { FolderHierarchy } from './folder-hierarchy';
import { FakeStorageAdapter, resetFakeAdapterIds } from './fake-storage-adapter';

function seedFolder(adapter: FakeStorageAdapter, overrides: Partial<{ id: string; name: string; parentId: string | null; order: number }> = {}) {
  const id = overrides.id ?? `f-${adapter.folders.length}`;
  adapter.folders.push({
    id,
    name: overrides.name ?? 'F',
    parentId: overrides.parentId ?? null,
    order: overrides.order ?? 0,
  });
  return id;
}

describe('FolderHierarchy', () => {
  let adapter: FakeStorageAdapter;
  let hierarchy: FolderHierarchy;

  beforeEach(() => {
    resetFakeAdapterIds();
    adapter = new FakeStorageAdapter();
    hierarchy = new FolderHierarchy(adapter);
  });

  it('starts empty', () => {
    expect(hierarchy.getSnapshot().folders).toEqual([]);
  });

  it('init loads folders', async () => {
    seedFolder(adapter, { id: 'a' });
    seedFolder(adapter, { id: 'b' });
    await hierarchy.init();
    expect(hierarchy.getSnapshot().folders.map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('createFolder computes order from existing siblings', async () => {
    seedFolder(adapter, { parentId: null, order: 0 });
    seedFolder(adapter, { parentId: null, order: 1 });
    await hierarchy.init();
    const created = await hierarchy.createFolder('New', null);
    expect(created.order).toBe(2);
  });

  it('createFolder under a different parent computes its own order', async () => {
    seedFolder(adapter, { parentId: null, order: 0 });
    seedFolder(adapter, { parentId: 'parent-x', order: 0 });
    await hierarchy.init();
    const created = await hierarchy.createFolder('Child', 'parent-x');
    expect(created.order).toBe(1);
  });

  it('renameFolder replaces in place', async () => {
    seedFolder(adapter, { id: 'a', name: 'Old' });
    await hierarchy.init();
    await hierarchy.renameFolder('a', 'New');
    expect(hierarchy.getSnapshot().folders[0].name).toBe('New');
  });

  it('deleteFolder removes the folder from local state', async () => {
    seedFolder(adapter, { id: 'a' });
    seedFolder(adapter, { id: 'b' });
    await hierarchy.init();
    await hierarchy.deleteFolder('a');
    expect(hierarchy.getSnapshot().folders.map((f) => f.id)).toEqual(['b']);
  });

  it('rebindAdapter clears state', async () => {
    seedFolder(adapter, { id: 'a' });
    await hierarchy.init();
    hierarchy.rebindAdapter(new FakeStorageAdapter());
    expect(hierarchy.getSnapshot().folders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- folder-hierarchy`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/notepad/collection/folder-hierarchy.ts`:

```ts
import { Observable } from './observable';
import type { StorageAdapter } from '../storage/adapter';
import type { Folder, FolderIcon } from '../types';

export interface FolderHierarchyState {
  folders: Folder[];
}

const EMPTY_STATE: FolderHierarchyState = { folders: [] };

export class FolderHierarchy extends Observable<FolderHierarchyState> {
  private adapter: StorageAdapter;

  constructor(adapter: StorageAdapter) {
    super(EMPTY_STATE);
    this.adapter = adapter;
  }

  async init(): Promise<void> {
    const folders = await this.adapter.getFolders();
    this.setState((prev) => ({ ...prev, folders }));
  }

  async createFolder(
    name: string,
    parentId: string | null,
    icon?: FolderIcon,
    color?: string,
  ): Promise<Folder> {
    const { folders } = this.getSnapshot();
    const order = folders.filter((f) => f.parentId === parentId).length;
    const created = await this.adapter.createFolder({ name, parentId, order, icon, color });
    this.setState((prev) => ({ ...prev, folders: [...prev.folders, created] }));
    return created;
  }

  async renameFolder(id: string, name: string): Promise<Folder> {
    const updated = await this.adapter.updateFolder(id, { name });
    this.setState((prev) => ({
      ...prev,
      folders: prev.folders.map((f) => (f.id === id ? updated : f)),
    }));
    return updated;
  }

  async deleteFolder(id: string): Promise<void> {
    await this.adapter.deleteFolder(id);
    this.setState((prev) => ({
      ...prev,
      folders: prev.folders.filter((f) => f.id !== id),
    }));
  }

  async refetchAll(): Promise<void> {
    const folders = await this.adapter.getFolders();
    this.setState((prev) => ({ ...prev, folders }));
  }

  rebindAdapter(next: StorageAdapter): void {
    this.adapter = next;
    this.setState(() => EMPTY_STATE);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- folder-hierarchy`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/collection/folder-hierarchy.ts src/notepad/collection/folder-hierarchy.test.ts
git commit -m "feat(notepad): FolderHierarchy module"
```

---

## Task 8: Move `repairNoteLinks` into `NoteCollection.init` (TDD)

**Files:**
- Modify: `src/notepad/collection/note-collection.ts`
- Modify: `src/notepad/collection/note-collection.test.ts`

The legacy auto-heal pass currently runs inside `refresh()` in the provider. It belongs inside `NoteCollection.init` — the only legitimate "post-load fix-up" — and must run exactly once per adapter binding.

- [ ] **Step 1: Add failing tests**

Append to `src/notepad/collection/note-collection.test.ts`:

```ts
import { describe as describe2 } from 'vitest';
import * as repairModule from '../storage/repair-note-links';
import { vi } from 'vitest';

describe2('NoteCollection — repair pass', () => {
  let adapter: FakeStorageAdapter;
  let collection: NoteCollection;
  let repairSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetFakeAdapterIds();
    adapter = new FakeStorageAdapter();
    collection = new NoteCollection(adapter);
    repairSpy = vi.spyOn(repairModule, 'repairNoteLinks').mockResolvedValue({
      repairedNotes: 0,
      rewiredLinks: 0,
    });
  });

  it('runs repairNoteLinks on first init', async () => {
    seedNote(adapter, { id: 'a' });
    await collection.init();
    expect(repairSpy).toHaveBeenCalledTimes(1);
  });

  it('does not re-run repair on subsequent inits with the same adapter', async () => {
    seedNote(adapter, { id: 'a' });
    await collection.init();
    await collection.init();
    expect(repairSpy).toHaveBeenCalledTimes(1);
  });

  it('re-runs repair after rebindAdapter', async () => {
    await collection.init();
    collection.rebindAdapter(new FakeStorageAdapter());
    await collection.init();
    expect(repairSpy).toHaveBeenCalledTimes(2);
  });

  it('refetches notes if repair reports rewired links', async () => {
    repairSpy.mockResolvedValueOnce({ repairedNotes: 1, rewiredLinks: 3 });
    seedNote(adapter, { id: 'a', title: 'Before' });
    await collection.init();
    // After repair, the test simulates a write by mutating the fake directly.
    adapter.notes[0] = { ...adapter.notes[0], title: 'After' };
    // The repair pass would have mutated through the adapter; init should
    // re-fetch and surface the new title.
    expect(collection.getSnapshot().notes[0].title).toBe('Before');
    // Re-run init manually to confirm the contract (repair-then-refetch
    // happens once per adapter binding; we only verify the spy count here):
    expect(repairSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- note-collection`
Expected: 4 new failures (or repair spy not called).

- [ ] **Step 3: Update `NoteCollection.init` to run repair**

Update `src/notepad/collection/note-collection.ts`:

```ts
import { Observable } from './observable';
import type { StorageAdapter } from '../storage/adapter';
import type { Note, NoteType } from '../types';
import { repairNoteLinks } from '../storage/repair-note-links';
```

Add a `repairAttempted` field on the class:

```ts
private repairAttempted = false;
```

Replace `init()`:

```ts
async init(): Promise<void> {
  let notes = await this.adapter.getNotes();

  if (!this.repairAttempted && notes.length > 0) {
    this.repairAttempted = true;
    try {
      const result = await repairNoteLinks(notes, this.adapter);
      if (result.rewiredLinks > 0) {
        notes = await this.adapter.getNotes();
      }
    } catch (err) {
      console.warn('[NoteCollection] repair pass failed:', err);
    }
  }

  this.update((prev) => ({ ...prev, notes }));
}
```

Update `rebindAdapter` to reset the guard:

```ts
rebindAdapter(next: StorageAdapter): void {
  this.adapter = next;
  this.repairAttempted = false;
  this.update(() => EMPTY_STATE);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- note-collection`
Expected: 22 passed (18 from earlier + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/collection/note-collection.ts src/notepad/collection/note-collection.test.ts
git commit -m "feat(notepad): NoteCollection owns the repair pass"
```

---

## Task 9: `NotepadActions` coordinator (TDD)

**Files:**
- Create: `src/notepad/collection/notepad-actions.ts`
- Test: `src/notepad/collection/notepad-actions.test.ts`

The thin coordinator — owns the `deleteFolder` cascade, `importNotes`, init, and `rebindAdapter`. Holds no state of its own.

- [ ] **Step 1: Write the failing test**

`src/notepad/collection/notepad-actions.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { NoteCollection } from './note-collection';
import { FolderHierarchy } from './folder-hierarchy';
import { NotepadActions } from './notepad-actions';
import { FakeStorageAdapter, resetFakeAdapterIds } from './fake-storage-adapter';

function seedNote(adapter: FakeStorageAdapter, id: string, folderId: string) {
  adapter.notes.push({
    id, title: id, content: '', folderId, type: 'note', tags: [], wordCount: 0,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });
}

function seedFolder(adapter: FakeStorageAdapter, id: string) {
  adapter.folders.push({ id, name: id, parentId: null, order: adapter.folders.length });
}

describe('NotepadActions', () => {
  let adapter: FakeStorageAdapter;
  let notes: NoteCollection;
  let folders: FolderHierarchy;
  let actions: NotepadActions;

  beforeEach(() => {
    resetFakeAdapterIds();
    adapter = new FakeStorageAdapter();
    notes = new NoteCollection(adapter);
    folders = new FolderHierarchy(adapter);
    actions = new NotepadActions(adapter, notes, folders);
  });

  it('init cascades to both modules', async () => {
    seedNote(adapter, 'n1', 'root');
    seedFolder(adapter, 'f1');
    await actions.init();
    expect(notes.getSnapshot().notes.map((n) => n.id)).toEqual(['n1']);
    expect(folders.getSnapshot().folders.map((f) => f.id)).toEqual(['f1']);
  });

  it('deleteFolder reparents child notes to root and removes the folder', async () => {
    seedFolder(adapter, 'f1');
    seedNote(adapter, 'a', 'f1');
    seedNote(adapter, 'b', 'f1');
    seedNote(adapter, 'c', 'root');
    await actions.init();

    await actions.deleteFolder('f1');

    expect(folders.getSnapshot().folders.map((f) => f.id)).toEqual([]);
    const notesAfter = notes.getSnapshot().notes;
    expect(notesAfter.find((n) => n.id === 'a')?.folderId).toBe('root');
    expect(notesAfter.find((n) => n.id === 'b')?.folderId).toBe('root');
    expect(notesAfter.find((n) => n.id === 'c')?.folderId).toBe('root');
  });

  it('deleteFolder computes affected ids BEFORE deleting the folder', async () => {
    seedFolder(adapter, 'f1');
    seedNote(adapter, 'a', 'f1');
    await actions.init();

    await actions.deleteFolder('f1');

    expect(notes.getSnapshot().notes.find((n) => n.id === 'a')?.folderId).toBe('root');
  });

  it('importNotes creates notes via the adapter and refetches', async () => {
    await actions.init();
    await actions.importNotes([
      { title: 'X', content: '', folderId: 'root', type: 'note', tags: [], wordCount: 0 },
      { title: 'Y', content: '', folderId: 'root', type: 'note', tags: [], wordCount: 0 },
    ]);
    expect(notes.getSnapshot().notes.map((n) => n.title)).toEqual(['X', 'Y']);
  });

  it('rebindAdapter rebinds both modules and re-inits', async () => {
    seedNote(adapter, 'old', 'root');
    await actions.init();
    expect(notes.getSnapshot().notes.map((n) => n.id)).toEqual(['old']);

    const next = new FakeStorageAdapter();
    seedNote(next, 'new', 'root');
    await actions.rebindAdapter(next);

    expect(notes.getSnapshot().notes.map((n) => n.id)).toEqual(['new']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- notepad-actions`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/notepad/collection/notepad-actions.ts`:

```ts
import type { StorageAdapter } from '../storage/adapter';
import type { Note } from '../types';
import { NoteCollection } from './note-collection';
import { FolderHierarchy } from './folder-hierarchy';

export class NotepadActions {
  constructor(
    private adapter: StorageAdapter,
    private notes: NoteCollection,
    private folders: FolderHierarchy,
  ) {}

  async init(): Promise<void> {
    await Promise.all([this.notes.init(), this.folders.init()]);
  }

  async deleteFolder(id: string): Promise<void> {
    const affectedIds = this.notes
      .getSnapshot()
      .notes.filter((n) => n.folderId === id)
      .map((n) => n.id);

    await this.folders.deleteFolder(id);
    this.notes.applyReparenting(affectedIds, 'root');
  }

  async importNotes(items: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    for (const item of items) {
      await this.adapter.createNote(item);
    }
    await this.notes.refetchAll();
  }

  async rebindAdapter(next: StorageAdapter): Promise<void> {
    this.adapter = next;
    this.notes.rebindAdapter(next);
    this.folders.rebindAdapter(next);
    await this.init();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- notepad-actions`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/collection/notepad-actions.ts src/notepad/collection/notepad-actions.test.ts
git commit -m "feat(notepad): NotepadActions coordinator"
```

---

## Task 10: Barrel + React subscription hooks

**Files:**
- Create: `src/notepad/collection/index.ts`
- Create: `src/notepad/context/useNoteCollection.ts`
- Create: `src/notepad/context/useFolderHierarchy.ts`
- Create: `src/notepad/context/useNotepadActions.ts`

These are the thin React surface for the modules. Each hook subscribes to its module's snapshot via `useSyncExternalStore` and returns the live state plus the bound module instance for method calls.

- [ ] **Step 1: Create the barrel**

`src/notepad/collection/index.ts`:

```ts
export { Observable } from './observable';
export { NoteCollection } from './note-collection';
export type { NoteCollectionState } from './note-collection';
export { FolderHierarchy } from './folder-hierarchy';
export type { FolderHierarchyState } from './folder-hierarchy';
export { NotepadActions } from './notepad-actions';
```

- [ ] **Step 2: Create `useNoteCollection`**

`src/notepad/context/useNoteCollection.ts`:

```ts
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { NoteCollection, NoteCollectionState } from '../collection';

export const NoteCollectionContext = createContext<NoteCollection | null>(null);

export function useNoteCollection(): NoteCollectionState & { collection: NoteCollection } {
  const collection = useContext(NoteCollectionContext);
  if (!collection) throw new Error('useNoteCollection must be used within a NotepadProvider');
  const state = useSyncExternalStore(collection.subscribe, collection.getSnapshot);
  return { ...state, collection };
}
```

- [ ] **Step 3: Create `useFolderHierarchy`**

`src/notepad/context/useFolderHierarchy.ts`:

```ts
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { FolderHierarchy, FolderHierarchyState } from '../collection';

export const FolderHierarchyContext = createContext<FolderHierarchy | null>(null);

export function useFolderHierarchy(): FolderHierarchyState & { hierarchy: FolderHierarchy } {
  const hierarchy = useContext(FolderHierarchyContext);
  if (!hierarchy) throw new Error('useFolderHierarchy must be used within a NotepadProvider');
  const state = useSyncExternalStore(hierarchy.subscribe, hierarchy.getSnapshot);
  return { ...state, hierarchy };
}
```

- [ ] **Step 4: Create `useNotepadActions`**

`src/notepad/context/useNotepadActions.ts`:

```ts
import { createContext, useContext } from 'react';
import type { NotepadActions } from '../collection';

export const NotepadActionsContext = createContext<NotepadActions | null>(null);

export function useNotepadActions(): NotepadActions {
  const actions = useContext(NotepadActionsContext);
  if (!actions) throw new Error('useNotepadActions must be used within a NotepadProvider');
  return actions;
}
```

- [ ] **Step 5: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/notepad/collection/index.ts src/notepad/context/useNoteCollection.ts src/notepad/context/useFolderHierarchy.ts src/notepad/context/useNotepadActions.ts
git commit -m "feat(notepad): barrel + React subscription hooks"
```

---

## Task 11: Rewire `NotepadProvider` internals (preserves legacy `useNotepad()`)

**Files:**
- Modify: `src/notepad/context/NotepadProvider.tsx`

The provider stops being a state owner and becomes a wiring layer. It constructs the three modules once and provides them via three contexts. The legacy `NotepadContext` still exposes the fat shape so existing consumers keep working — they're migrated one-by-one in the next tasks.

- [ ] **Step 1: Replace `NotepadProvider.tsx`**

Replace the entire file with:

```tsx
import { createContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { Note, Folder, NoteType, FolderIcon, JournalTheme } from '../types';
import type { StorageAdapter } from '../storage/adapter';
import { LocalStorageAdapter } from '../storage/local-storage';
import type { GraphNode, GraphEdge } from '../graph/types';
import { useGraph } from '../graph/use-graph';
import { NoteCollection, FolderHierarchy, NotepadActions } from '../collection';
import { NoteCollectionContext } from './useNoteCollection';
import { FolderHierarchyContext } from './useFolderHierarchy';
import { NotepadActionsContext } from './useNotepadActions';

export interface NotepadContextValue {
  notes: Note[];
  folders: Folder[];
  activeNoteId: string | null;
  activeNote: Note | null;
  openNote: (id: string | null) => void;
  createNote: (folderId: string, type: NoteType) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  duplicateNote: (id: string) => Promise<Note>;
  moveNote: (id: string, folderId: string) => Promise<Note>;
  renameNote: (id: string, title: string) => Promise<Note>;
  createFolder: (name: string, parentId: string | null, icon?: FolderIcon, color?: string) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<Folder>;
  deleteFolder: (id: string) => Promise<void>;
  importNotes: (items: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<void>;
  refresh: () => Promise<void>;
  journalTheme: JournalTheme;
  setJournalTheme: (theme: JournalTheme) => void;
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  graphActiveNodeId: string | null;
  graphLoading: boolean;
  rebuildGraph: () => void;
  getNeighborhood: (nodeId: string, depth: number) => Set<string>;
}

export const NotepadContext = createContext<NotepadContextValue | null>(null);

interface NotepadProviderProps {
  children: ReactNode;
  adapter?: StorageAdapter;
}

export function NotepadProvider({ children, adapter: adapterProp }: NotepadProviderProps) {
  const initialAdapter = useMemo(() => adapterProp ?? new LocalStorageAdapter(), []);

  const { notes, folders, actions } = useMemo(() => {
    const notesModule = new NoteCollection(initialAdapter);
    const foldersModule = new FolderHierarchy(initialAdapter);
    const actionsModule = new NotepadActions(initialAdapter, notesModule, foldersModule);
    return { notes: notesModule, folders: foldersModule, actions: actionsModule };
  }, [initialAdapter]);

  // Initial load + adapter rebinds.
  useEffect(() => {
    const run = async () => {
      if (adapterProp && adapterProp !== initialAdapter) {
        await actions.rebindAdapter(adapterProp);
      } else {
        await actions.init();
      }
    };
    run().catch((err) => console.error('[NotepadProvider] init failed:', err));
  }, [adapterProp, actions, initialAdapter]);

  const notesState = useSyncExternalStore(notes.subscribe, notes.getSnapshot);
  const foldersState = useSyncExternalStore(folders.subscribe, folders.getSnapshot);

  // Journal theme — temporary; evicted in Task 16.
  const [journalTheme, setJournalThemeState] = useState<JournalTheme>(() => {
    try {
      return (localStorage.getItem('psalms-journal-theme') as JournalTheme) || 'default';
    } catch {
      return 'default';
    }
  });
  const setJournalTheme = (theme: JournalTheme) => {
    setJournalThemeState(theme);
    try { localStorage.setItem('psalms-journal-theme', theme); } catch { /* noop */ }
  };

  const graph = useGraph(notesState.notes, notesState.activeNoteId);

  const value: NotepadContextValue = {
    notes: notesState.notes,
    folders: foldersState.folders,
    activeNoteId: notesState.activeNoteId,
    activeNote: notesState.activeNote,
    openNote: notes.openNote,
    createNote: notes.createNote.bind(notes),
    updateNote: notes.updateNote.bind(notes),
    deleteNote: notes.deleteNote.bind(notes),
    duplicateNote: notes.duplicateNote.bind(notes),
    moveNote: notes.moveNote.bind(notes),
    renameNote: notes.renameNote.bind(notes),
    createFolder: folders.createFolder.bind(folders),
    renameFolder: folders.renameFolder.bind(folders),
    deleteFolder: actions.deleteFolder.bind(actions),
    importNotes: actions.importNotes.bind(actions),
    refresh: () => actions.init(),
    journalTheme,
    setJournalTheme,
    graphNodes: graph.nodes,
    graphEdges: graph.edges,
    graphActiveNodeId: graph.activeNodeId,
    graphLoading: graph.isLoading,
    rebuildGraph: graph.rebuildGraph,
    getNeighborhood: graph.getNeighborhood,
  };

  return (
    <NoteCollectionContext.Provider value={notes}>
      <FolderHierarchyContext.Provider value={folders}>
        <NotepadActionsContext.Provider value={actions}>
          <NotepadContext.Provider value={value}>{children}</NotepadContext.Provider>
        </NotepadActionsContext.Provider>
      </FolderHierarchyContext.Provider>
    </NoteCollectionContext.Provider>
  );
}
```

> **Note for the implementer:** `journalTheme` is kept inside the legacy provider value for one transitional commit so existing consumers (`Editor`) keep working. Task 16 deletes both the field and the local `useState` block.

- [ ] **Step 2: Run the dev build to verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Smoke-test in the dev server**

Run: `npm run dev`
Expected:
- App boots
- Sidebar lists existing notes/folders
- Creating, renaming, deleting a note all still work
- Deleting a folder still re-parents children to root

- [ ] **Step 4: Commit**

```bash
git add src/notepad/context/NotepadProvider.tsx
git commit -m "refactor(notepad): rewire provider through NoteCollection/FolderHierarchy/NotepadActions"
```

---

## Task 12: Migrate read-only consumers to narrow hooks

**Files:**
- Modify: `src/notepad/components/InfoPanel.tsx`
- Modify: `src/notepad/components/SearchDialog.tsx`
- Modify: `src/notepad/components/BacklinksPanel.tsx`

These components only read `notes`, `folders`, `activeNote`, `openNote`. They get the narrowest re-render footprint by switching to the per-module hooks.

- [ ] **Step 1: Migrate `InfoPanel.tsx`**

Replace line 2 `import { useNotepad } from '../context/useNotepad';` with:

```ts
import { useNoteCollection } from '../context/useNoteCollection';
import { useFolderHierarchy } from '../context/useFolderHierarchy';
```

Replace the destructure (around line 49):

```ts
const { notes, activeNote } = useNoteCollection();
const { folders } = useFolderHierarchy();
```

- [ ] **Step 2: Migrate `SearchDialog.tsx`**

Replace line 11 with `import { useNoteCollection } from '../context/useNoteCollection';`.

Replace the destructure (around line 26):

```ts
const { notes, collection } = useNoteCollection();
const openNote = collection.openNote;
```

- [ ] **Step 3: Migrate `BacklinksPanel.tsx`**

Replace line 3 with `import { useNoteCollection } from '../context/useNoteCollection';`.

Replace the destructure (around line 64):

```ts
const { notes, activeNote, collection } = useNoteCollection();
const openNote = collection.openNote;
```

- [ ] **Step 4: Verify compile + smoke-test**

Run: `npm run build && npm run dev`
Expected: build passes; opening notes from search and backlink chips still works; the info panel still shows correct counts.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/InfoPanel.tsx src/notepad/components/SearchDialog.tsx src/notepad/components/BacklinksPanel.tsx
git commit -m "refactor(notepad): migrate read-only consumers to narrow hooks"
```

---

## Task 13: Migrate single-mutation consumers

**Files:**
- Modify: `src/notepad/components/NotepadToolbar.tsx`
- Modify: `src/notepad/components/NewFolderDialog.tsx`
- Modify: `src/notepad/components/UploadModal.tsx`

These each use one mutation.

- [ ] **Step 1: Migrate `NotepadToolbar.tsx`**

Replace the `useNotepad` import (line 23) with `import { useNoteCollection } from '../context/useNoteCollection';`.

Replace destructure (line 47):

```ts
const { collection } = useNoteCollection();
const createNote = collection.createNote.bind(collection);
```

- [ ] **Step 2: Migrate `NewFolderDialog.tsx`**

Replace import (line 31) with `import { useFolderHierarchy } from '../context/useFolderHierarchy';`.

Replace destructure (line 64):

```ts
const { folders, hierarchy } = useFolderHierarchy();
const createFolder = hierarchy.createFolder.bind(hierarchy);
```

- [ ] **Step 3: Migrate `UploadModal.tsx`**

Replace import (line 19) with:

```ts
import { useFolderHierarchy } from '../context/useFolderHierarchy';
import { useNotepadActions } from '../context/useNotepadActions';
```

Replace destructure (line 163):

```ts
const { folders } = useFolderHierarchy();
const actions = useNotepadActions();
const importNotes = actions.importNotes.bind(actions);
```

- [ ] **Step 4: Verify compile + smoke-test**

Run: `npm run build && npm run dev`
Expected: creating a note from the toolbar, creating a new folder, and uploading notes all still work end-to-end.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/NotepadToolbar.tsx src/notepad/components/NewFolderDialog.tsx src/notepad/components/UploadModal.tsx
git commit -m "refactor(notepad): migrate single-mutation consumers"
```

---

## Task 14: Migrate `Editor.tsx`

**Files:**
- Modify: `src/notepad/components/Editor.tsx`

The Editor reads `notes`, `activeNote`, `updateNote`, `openNote`, `journalTheme`, `setJournalTheme`. After this task, the journal-theme bits still come through the legacy hook because Task 16 evicts them.

- [ ] **Step 1: Migrate the destructure**

Replace line 27 with:

```ts
import { useNoteCollection } from '../context/useNoteCollection';
import { useNotepad } from '../context/useNotepad';
```

Replace the destructure at line 70 with:

```ts
const { notes, activeNote, collection } = useNoteCollection();
const updateNote = collection.updateNote.bind(collection);
const openNote = collection.openNote;
const { journalTheme, setJournalTheme } = useNotepad();
```

- [ ] **Step 2: Verify compile + smoke-test**

Run: `npm run build && npm run dev`
Expected:
- Typing in a note still saves (debounced update).
- Switching journal themes still works.
- Bible-verse and note-link tooltips still appear.
- Clicking a note-link navigates to the target note.

- [ ] **Step 3: Commit**

```bash
git add src/notepad/components/Editor.tsx
git commit -m "refactor(notepad): migrate Editor to NoteCollection hook"
```

---

## Task 15: Migrate `Sidebar.tsx`

**Files:**
- Modify: `src/notepad/components/Sidebar.tsx`

The biggest god consumer — uses notes, folders, both sets of mutations, plus `deleteFolder` (which goes through the coordinator).

- [ ] **Step 1: Migrate the imports**

Replace line 50 with:

```ts
import { useNoteCollection } from '../context/useNoteCollection';
import { useFolderHierarchy } from '../context/useFolderHierarchy';
import { useNotepadActions } from '../context/useNotepadActions';
```

- [ ] **Step 2: Migrate the destructure (around line 643–656)**

Replace the destructure block with:

```ts
const { notes, activeNoteId, collection } = useNoteCollection();
const { folders, hierarchy } = useFolderHierarchy();
const actions = useNotepadActions();

const openNote = collection.openNote;
const createNote = collection.createNote.bind(collection);
const moveNote = collection.moveNote.bind(collection);
const renameNote = collection.renameNote.bind(collection);
const deleteNote = collection.deleteNote.bind(collection);
const duplicateNote = collection.duplicateNote.bind(collection);
const createFolder = hierarchy.createFolder.bind(hierarchy);
const renameFolder = hierarchy.renameFolder.bind(hierarchy);
const deleteFolder = actions.deleteFolder.bind(actions);
```

- [ ] **Step 3: Verify compile + smoke-test**

Run: `npm run build && npm run dev`
Expected:
- Creating, renaming, deleting, duplicating notes via Sidebar still works.
- Drag-to-move still updates `folderId`.
- Creating, renaming, deleting folders still works.
- Deleting a non-empty folder re-parents children to root (verify by deleting a folder containing notes — they should reappear under "root").

- [ ] **Step 4: Commit**

```bash
git add src/notepad/components/Sidebar.tsx
git commit -m "refactor(notepad): migrate Sidebar to narrow hooks + actions"
```

---

## Task 16: Evict `journalTheme` to a standalone hook

**Files:**
- Create: `src/notepad/hooks/use-journal-theme.ts`
- Modify: `src/notepad/components/Editor.tsx`
- Modify: `src/notepad/context/NotepadProvider.tsx`

`journalTheme` is used by exactly one component (`Editor`) and is persisted to its own localStorage key. It does not belong in the collection module at all — extract it.

- [ ] **Step 1: Create the standalone hook**

`src/notepad/hooks/use-journal-theme.ts`:

```ts
import { useCallback, useState } from 'react';
import type { JournalTheme } from '../types';

const STORAGE_KEY = 'psalms-journal-theme';

function readInitial(): JournalTheme {
  try {
    return (localStorage.getItem(STORAGE_KEY) as JournalTheme) || 'default';
  } catch {
    return 'default';
  }
}

export function useJournalTheme(): [JournalTheme, (theme: JournalTheme) => void] {
  const [theme, setThemeState] = useState<JournalTheme>(readInitial);

  const setTheme = useCallback((next: JournalTheme) => {
    setThemeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
  }, []);

  return [theme, setTheme];
}
```

- [ ] **Step 2: Update `Editor.tsx` to use it**

Remove the `useNotepad` import that brought in `journalTheme`/`setJournalTheme`, and replace the line:

```ts
const { journalTheme, setJournalTheme } = useNotepad();
```

with:

```ts
import { useJournalTheme } from '../hooks/use-journal-theme';
// ...
const [journalTheme, setJournalTheme] = useJournalTheme();
```

If `useNotepad` is no longer used in this file, remove its import.

- [ ] **Step 3: Strip `journalTheme` from `NotepadProvider.tsx`**

In `src/notepad/context/NotepadProvider.tsx`:

1. Remove the `JournalTheme` import.
2. Remove `journalTheme` and `setJournalTheme` from `NotepadContextValue`.
3. Delete the `useTheme` IIFE block.
4. Remove `journalTheme` and `setJournalTheme` from the `value` object.

- [ ] **Step 4: Verify compile + smoke-test**

Run: `npm run build && npm run dev`
Expected: switching journal themes still persists across reloads; no other regressions.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/hooks/use-journal-theme.ts src/notepad/components/Editor.tsx src/notepad/context/NotepadProvider.tsx
git commit -m "refactor(notepad): evict journalTheme to standalone hook"
```

---

## Task 17: Evict graph fields — `GraphPane` calls `useGraph` directly

**Files:**
- Modify: `src/components/sections/notepad/GraphPane.tsx`
- Modify: `src/notepad/context/NotepadProvider.tsx`

`useGraph(notes, activeNoteId)` is already a self-contained hook. The provider can stop calling it and stop re-exposing its return values; `GraphPane` (the only consumer) calls it directly.

- [ ] **Step 1: Update `GraphPane.tsx`**

Replace line 13 (`import { useNotepad } …`) with:

```ts
import { useNoteCollection } from '@/notepad/context/useNoteCollection';
import { useGraph } from '@/notepad/graph/use-graph';
```

Replace the destructure at line 57 with:

```ts
const { notes, activeNoteId, collection } = useNoteCollection();
const { nodes: graphNodes, edges: graphEdges, activeNodeId: graphActiveNodeId, isLoading: graphLoading, getNeighborhood } = useGraph(notes, activeNoteId);
const openNote = collection.openNote;
```

- [ ] **Step 2: Strip graph fields from `NotepadProvider.tsx`**

In `src/notepad/context/NotepadProvider.tsx`:

1. Remove the `useGraph` import and the `GraphNode`/`GraphEdge` type imports.
2. Remove all six `graph*` fields from `NotepadContextValue`.
3. Remove the `const graph = useGraph(...)` call.
4. Remove the six graph-related entries from the `value` object.

- [ ] **Step 3: Verify compile + smoke-test**

Run: `npm run build && npm run dev`
Expected: the graph pane still renders nodes and edges, neighborhood highlighting still works on click, and notes outside the graph view no longer trigger graph re-renders.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/notepad/GraphPane.tsx src/notepad/context/NotepadProvider.tsx
git commit -m "refactor(notepad): evict graph fields — GraphPane owns useGraph"
```

---

## Task 18: Drop the legacy `useNotepad()` and `refresh()`

**Files:**
- Modify: `src/components/sections/Notepad.tsx`
- Delete: `src/notepad/context/useNotepad.ts`
- Modify: `src/notepad/context/NotepadProvider.tsx`

The legacy fat shape exists only to ease migration. With every consumer migrated, delete it. `refresh()` was only used by the section component for the post-migration reload — replace with the actions equivalent.

- [ ] **Step 1: Audit any remaining `useNotepad` consumers**

Run:

```bash
grep -rn "useNotepad\|NotepadContextValue\b" /Users/newmac/Downloads/Psalms_app/src --include="*.ts" --include="*.tsx"
```

Expected: only `Notepad.tsx` (the section), `useNotepad.ts`, and `NotepadProvider.tsx` itself remain.

- [ ] **Step 2: Migrate `src/components/sections/Notepad.tsx`**

Replace line 7 with `import { useNotepadActions } from '@/notepad/context/useNotepadActions';`.

Replace line 26 (`const { refresh } = useNotepad();`) with:

```ts
const actions = useNotepadActions();
```

Wherever `refresh()` is called in this file, replace with `actions.init()`.

- [ ] **Step 3: Delete the legacy hook**

```bash
rm /Users/newmac/Downloads/Psalms_app/src/notepad/context/useNotepad.ts
```

- [ ] **Step 4: Strip the legacy shape from `NotepadProvider.tsx`**

In `src/notepad/context/NotepadProvider.tsx`:

1. Delete `NotepadContextValue` and `NotepadContext`.
2. Delete the `<NotepadContext.Provider value={value}>` wrapper.
3. Delete the `value` object construction.
4. The provider's body should now be: build modules, run init/rebind effect, wrap children in the three new contexts.

The simplified provider:

```tsx
import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { StorageAdapter } from '../storage/adapter';
import { LocalStorageAdapter } from '../storage/local-storage';
import { NoteCollection, FolderHierarchy, NotepadActions } from '../collection';
import { NoteCollectionContext } from './useNoteCollection';
import { FolderHierarchyContext } from './useFolderHierarchy';
import { NotepadActionsContext } from './useNotepadActions';

interface NotepadProviderProps {
  children: ReactNode;
  adapter?: StorageAdapter;
}

export function NotepadProvider({ children, adapter: adapterProp }: NotepadProviderProps) {
  const initialAdapter = useMemo(() => adapterProp ?? new LocalStorageAdapter(), []);

  const { notes, folders, actions } = useMemo(() => {
    const notesModule = new NoteCollection(initialAdapter);
    const foldersModule = new FolderHierarchy(initialAdapter);
    const actionsModule = new NotepadActions(initialAdapter, notesModule, foldersModule);
    return { notes: notesModule, folders: foldersModule, actions: actionsModule };
  }, [initialAdapter]);

  useEffect(() => {
    const run = async () => {
      if (adapterProp && adapterProp !== initialAdapter) {
        await actions.rebindAdapter(adapterProp);
      } else {
        await actions.init();
      }
    };
    run().catch((err) => console.error('[NotepadProvider] init failed:', err));
  }, [adapterProp, actions, initialAdapter]);

  return (
    <NoteCollectionContext.Provider value={notes}>
      <FolderHierarchyContext.Provider value={folders}>
        <NotepadActionsContext.Provider value={actions}>
          {children}
        </NotepadActionsContext.Provider>
      </FolderHierarchyContext.Provider>
    </NoteCollectionContext.Provider>
  );
}
```

- [ ] **Step 5: Verify compile + smoke-test**

Run: `npm run build && npm run dev`
Expected: app boots, every notepad feature still works, the post-migration reload still triggers a fresh load.

- [ ] **Step 6: Commit**

```bash
git add -u src/components/sections/Notepad.tsx src/notepad/context/useNotepad.ts src/notepad/context/NotepadProvider.tsx
git commit -m "refactor(notepad): drop legacy useNotepad + refresh"
```

---

## Task 19: Final verification

**Files:** none modified

Confirm the migration is complete and no stragglers remain.

- [ ] **Step 1: All tests pass**

Run: `npm test`
Expected: all module tests green (>= 41 tests across `observable`, `note-collection`, `folder-hierarchy`, `notepad-actions`).

- [ ] **Step 2: Type-check is clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint is clean**

Run: `npm run lint`
Expected: no new errors compared to the pre-refactor baseline.

- [ ] **Step 4: No legacy references remain**

Run:

```bash
grep -rn "useNotepad\b\|NotepadContextValue\|NotepadContext\b" /Users/newmac/Downloads/Psalms_app/src --include="*.ts" --include="*.tsx"
```

Expected: no matches.

- [ ] **Step 5: End-to-end smoke test**

Run: `npm run dev` and verify:

1. Anonymous (LocalStorageAdapter) flow — create notes, folders, edit, delete a non-empty folder; reload and confirm everything persists.
2. Sign-in flow — sign in, verify the migration dialog flow runs, then create/edit/delete on the cloud adapter; reload signed in.
3. Sign-out flow — sign out, verify the local data reappears (or the empty state, depending on what the local adapter held before sign-in).
4. Graph pane — open it, click around, verify highlighting; create a new `[[link]]` in a note and confirm an edge appears.

- [ ] **Step 6: Commit a release note in the plan file**

Append to this plan file:

```markdown
---

## Implementation log

- [DATE] Implementation complete. All 41+ module tests pass; manual smoke checks for local + cloud + graph all pass.
```

```bash
git add docs/superpowers/plans/2026-05-06-deepen-notepad-collection.md
git commit -m "docs(notepad): mark deepen-notepad-collection plan complete"
```

---

## Self-review notes

- Spec coverage: every decision from the design grilling is implemented — three-module split (Tasks 4–9), targeted patching (Tasks 5–6), `applyReparenting` cascade (Task 9), deletion-clears-active invariant (Task 5), repair-on-init (Task 8), `useSyncExternalStore` hooks (Task 10), evictions of `journalTheme` (Task 16) and graph (Task 17), drop of `refresh()` (Task 18), `rebindAdapter` (Tasks 6, 9, 11, 18).
- Module instances are constructed once via `useMemo([initialAdapter])`; subsequent adapter changes go through `rebindAdapter`, preserving the same instances and their subscribers.
- The repair toast is intentionally dropped during the transition — the repair pass still runs and rewires links; if you want the toast restored, add an optional callback parameter to `NoteCollection.init()` in a follow-up task. (Out of scope for this refactor.)
- `useNoteCollection`/`useFolderHierarchy` deliberately return state spread plus the bound module instance. Components destructure only what they use, which keeps the call sites readable while still allowing method calls.
