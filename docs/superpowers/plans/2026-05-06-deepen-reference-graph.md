# Deepen the Reference Graph — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Concentrate the Reference concern — currently sprinkled across `edge-store.ts`, `scripture-store.ts`, `cross-reference.ts`, `edge-parser.ts`, the `syncNoteEdges` function inside `use-graph.ts`, and `storage/repair-note-links.ts` — into a single deep module `ReferenceGraph` with a small testable interface and its own subscription seam. `useGraph` becomes a thin view-shape transformer; TipTap marks import the canonical parser and regex from the new module.

**Architecture:** `ReferenceGraph` is a plain TypeScript class that extends the existing `Observable<T>` primitive (same pattern as `NoteCollection`, `FolderHierarchy`). It owns persistence to two localStorage cache keys (`notepad_graph_references`, `notepad_scripture_nodes`) — these are a **derivation cache**, not a source of truth. Source of truth is Note content + the bundled TSK dataset + the Bible API (injected as a `VerseFetcher` port). It exposes per-Note sync (`syncNote`), bulk sync (`syncAll`), the legacy `repairNoteLinks` pass, neighborhood queries (`getNeighborhood`), and read-only accessors. `NotepadActions` becomes the only module that knows `ReferenceGraph` exists; it sequences `syncNote` after Note content updates and `deleteReferencesFor` after deletes. React consumers subscribe via `useSyncExternalStore` through a narrow `useReferenceGraph` hook. The visualization shape (`GraphNode`/`GraphEdge` for `GraphPane`) is derived in the view layer — `ReferenceGraph` exposes its own canonical `Reference` shape.

**Tech Stack:** TypeScript 5.9, React 19, Vite 7, Vitest, existing `Observable<T>`, existing `StorageAdapter`, existing `fake-storage-adapter` for tests.

**Domain language:** see [docs/CONTEXT.md](../../CONTEXT.md). The names `Reference`, `ScriptureNode`, `ReferenceGraph` come from there — use them exactly.

---

## File Structure

### New files
- `src/notepad/graph/reference-parser.ts` — `VERSE_REGEX`, `BOOK_PATTERNS`, `normalizeVerseRef`, `fetchVerseText`, `toCanonicalScriptureId`, `parseVerseRef`, `parseReferencesFromContent`, plus a private `walkMarks` helper
- `src/notepad/graph/reference-parser.test.ts`
- `src/notepad/graph/reference-graph.ts` — the deep module
- `src/notepad/graph/reference-graph.test.ts`
- `src/notepad/graph/in-memory-verse-fetcher.ts` — test fake for the Bible API port; also exports the `VerseFetcher` type alias
- `src/notepad/context/useReferenceGraph.ts` — narrow hook (subscribes via `useSyncExternalStore`)

### Modified files
- `src/notepad/graph/types.ts` — add `Reference` type; `GraphEdge`/`GraphNode` stay as view-shape types
- `src/notepad/extensions/bible-verse-utils.ts` — shrink to TipTap-only constants (`VERSE_INPUT_REGEX`, `VERSE_PASTE_REGEX`, `VerseResult`); import canonical regex source from `reference-parser`
- `src/notepad/extensions/bible-verse.ts` — import `VERSE_REGEX` from `reference-parser`
- `src/notepad/collection/note-collection.ts` — drop the repair pass call (moves to `NotepadActions` via `ReferenceGraph`)
- `src/notepad/collection/notepad-actions.ts` — add `referenceGraph` field, `updateNote`, `deleteNote`; expand `init`, `importNotes`, `rebindAdapter`
- `src/notepad/collection/index.ts` — re-export `ReferenceGraph` and its types
- `src/notepad/context/NotepadProvider.tsx` — construct `ReferenceGraph`, wire it through `NotepadActions`, provide it via context
- `src/notepad/graph/use-graph.ts` — rewrite as a thin view-shape transformer; subscribe to `referenceGraph` + `noteCollection`, derive `GraphNode[]`/`GraphEdge[]` for `GraphPane`
- Editor consumers that mutate Note content or delete Notes — switch from `useNoteCollection` to `useNotepadActions` for those operations. Likely: `src/notepad/components/Editor.tsx`, `Sidebar.tsx`, `NotepadToolbar.tsx` (verify during Task 13).

### Deleted (final task)
- `src/notepad/graph/edge-store.ts`
- `src/notepad/graph/scripture-store.ts`
- `src/notepad/graph/cross-reference.ts`
- `src/notepad/graph/edge-parser.ts`
- `src/notepad/graph/adjacency-list.ts` (becomes a private helper inside `ReferenceGraph`)
- `src/notepad/graph/local-graph.ts` (becomes a private helper inside `ReferenceGraph`)
- `src/notepad/storage/repair-note-links.ts` (collapses into `ReferenceGraph.repairNoteLinks`; the duplicate walker becomes one private helper)

---

## Tasks

### Task 1 — Extract the canonical parser to `reference-parser.ts`

- [ ] Create `src/notepad/graph/reference-parser.ts`. Export: `VERSE_REGEX`, `BOOK_PATTERNS`, `normalizeVerseRef`, `fetchVerseText`, `toCanonicalScriptureId`, `parseVerseRef`, `parseReferencesFromContent`. Move definitions from `extensions/bible-verse-utils.ts` and `graph/edge-parser.ts`. Add a private `walkMarks(doc, markType)` helper that's the canonical TipTap walker — the single implementation that replaces both `extractNoteLinks` (in `edge-parser.ts`) and `collectNoteLinks` (in `repair-note-links.ts`).
- [ ] In `extensions/bible-verse-utils.ts`: drop the canonical exports; keep TipTap-specific (`VERSE_INPUT_REGEX`, `VERSE_PASTE_REGEX`, `VerseResult`). These should derive their regex source from `reference-parser` so there's a single source of truth.
- [ ] In `extensions/bible-verse.ts`: import `VERSE_REGEX` from `reference-parser`.
- [ ] Verify the app still builds and the editor still highlights verses (Vite dev server, manual smoke).

### Task 2 — Tests for the parser

- [ ] Create `src/notepad/graph/reference-parser.test.ts`. Cover:
  - `parseReferencesFromContent` returns `explicit` references for `noteLink` marks
  - `parseReferencesFromContent` returns `scripture-reference` references for verse-regex matches in plain text
  - `toCanonicalScriptureId` produces stable ids across abbreviation variants (`Romans 8:28`, `Rom 8:28`, `Ro 8:28` → same id)
  - `parseVerseRef` handles ranges (`Ps 23:1-6`)
  - `parseReferencesFromContent` handles nested `content`, missing marks, malformed JSON without throwing
  - `parseReferencesFromContent` deduplicates within a single document
- [ ] All tests green.

### Task 3 — `ReferenceGraph` skeleton (state + accessors)

- [ ] Add `Reference` type to `src/notepad/graph/types.ts`:
  ```ts
  export interface Reference {
    id: string;
    source: string;      // note id or scripture id
    target: string;
    type: 'explicit' | 'scripture-reference' | 'cross-reference';
    weight: number;
    createdAt: string;
  }
  ```
- [ ] Create `src/notepad/graph/in-memory-verse-fetcher.ts`. Export `type VerseFetcher = (ref: string) => Promise<{ text: string; translation: string } | null>` and `createInMemoryVerseFetcher(map: Record<string, { text: string; translation: string }>): VerseFetcher`.
- [ ] Create `src/notepad/graph/reference-graph.ts`. Class extends `Observable<ReferenceGraphState>` where `ReferenceGraphState = { references: Reference[]; scriptureNodes: ScriptureNode[] }`. Constructor takes `(adapter: StorageAdapter, fetchVerse: VerseFetcher)`. Implement only the read-only accessors first (`getReferences`, `getReferencesBy`, `getScriptureNode`, `getScriptureNodes`) plus the localStorage hydration on construction and write helpers. Defer sync logic to Task 5.
- [ ] Add `rebindAdapter(next: StorageAdapter): void` — resets state to empty and updates the adapter ref (matches `NoteCollection.rebindAdapter` pattern).

### Task 4 — Skeleton tests

- [ ] Create `src/notepad/graph/reference-graph.test.ts`. Cover hydration from localStorage on construction, empty-state defaults, accessor correctness with seeded state. Use `fake-storage-adapter` and `createInMemoryVerseFetcher`.

### Task 5 — `syncNote`, `syncAll`, `deleteReferencesFor`, `init`, `refreshVerseText`

- [ ] Implement `syncNote(note)`: parse via `parseReferencesFromContent`; delete all references whose `source === note.id`; for any new scripture target id, create the `ScriptureNode` (best-effort `fetchVerse`, empty `text` on null/throw); expand TSK cross-references for newly-created scripture nodes; insert all parsed references with idempotent `Reference.id`s. Single Observable emit at the end.
- [ ] Implement `syncAll(notes)`: iterate `syncNote`, single emit at the end. Used for `importNotes` and `rebindAdapter`.
- [ ] Implement `deleteReferencesFor(nodeId)`: drop every reference whose `source` or `target` is `nodeId`. Emit.
- [ ] Implement `init(notes)`: hydrate cache from localStorage; if cache is missing, run `syncAll(notes)`. The cache is trusted by default — per-Note sync keeps it consistent during normal use.
- [ ] Implement `refreshVerseText(scriptureId)`: re-fetch via `fetchVerse` and update the matching `ScriptureNode`'s `text`. Emit.
- [ ] Implement `getNeighborhood(nodeId, depth)`: BFS over the in-memory references list (the adjacency-list and BFS helpers from the deleted `adjacency-list.ts` and `local-graph.ts` move in as private helpers).

### Task 6 — Tests for sync behavior

- [ ] In `reference-graph.test.ts`: cover
  - `syncNote` is idempotent (calling twice with same content produces same `references`)
  - Removing a `noteLink` from content removes the corresponding `Reference` on next sync
  - A new verse reference creates a `ScriptureNode` and triggers TSK expansion (use a test TSK fixture)
  - `fetchVerse` failure produces an empty-text `ScriptureNode` (no thrown error, sync completes)
  - `refreshVerseText` populates text retroactively for an empty-text node
  - `deleteReferencesFor` removes both incoming and outgoing references
  - `syncAll` emits exactly once for the whole batch
  - `getNeighborhood(id, 1)` returns the immediate neighbors; `depth=2` extends one hop further

### Task 7 — `repairNoteLinks` migration

- [ ] Add `repairNoteLinks(notes, adapter)` method to `ReferenceGraph`. Body matches the existing `storage/repair-note-links.ts` (return shape `{ repairedNotes, rewiredLinks, orphans }`), but uses the canonical `walkMarks` helper from `reference-parser.ts`. The method does not mutate `ReferenceGraph` state directly — it mutates Note content via the adapter; the caller is expected to refetch notes.
- [ ] Add tests at the `ReferenceGraph` interface for repair: orphan-with-matching-title rewrites `noteId`, orphan-without-matching-title is left alone, return counts are correct, idempotent on a second pass over already-healed data.

### Task 8 — Wire `NotepadActions`

- [ ] Add `referenceGraph: ReferenceGraph` to `NotepadActions`'s constructor (extend the existing 3-arg constructor to 4-arg).
- [ ] Rewrite `init()`:
  ```ts
  await Promise.all([this.notes.init(), this.folders.init()]);
  const noteList = this.notes.getSnapshot().notes;
  if (noteList.length > 0) {
    try {
      const result = await this.referenceGraph.repairNoteLinks(noteList, this.adapter);
      if (result.rewiredLinks > 0) await this.notes.refetchAll();
    } catch (err) {
      console.warn('[NotepadActions] repair pass failed:', err);
    }
  }
  await this.referenceGraph.init(this.notes.getSnapshot().notes);
  ```
- [ ] Add `updateNote(id, updates)`: `const updated = await this.notes.updateNote(id, updates); if (updates.content !== undefined) await this.referenceGraph.syncNote(updated); return updated;`
- [ ] Add `deleteNote(id)`: `await this.notes.deleteNote(id); this.referenceGraph.deleteReferencesFor(id);`
- [ ] Update `importNotes`: after `notes.refetchAll()`, call `await this.referenceGraph.syncAll(this.notes.getSnapshot().notes)`.
- [ ] Update `rebindAdapter`: call `this.referenceGraph.rebindAdapter(next)` alongside the others, then `await this.init()`.

### Task 9 — Drop the repair pass from `NoteCollection`

- [ ] In `note-collection.ts`: remove the `import { repairNoteLinks }`, the `repairAttempted` flag, and the repair logic in `init()`. `init()` becomes: `const notes = await this.adapter.getNotes(); this.update((prev) => ({ ...prev, notes }));` Also remove the `repairAttempted` reset in `rebindAdapter`.
- [ ] Verify existing `note-collection.test.ts` still passes; remove or migrate any repair-specific expectations to `reference-graph.test.ts`.

### Task 10 — `NotepadActions` tests

- [ ] Update `notepad-actions.test.ts`:
  - `updateNote` with `content` triggers `referenceGraph.syncNote`
  - `updateNote` with non-content updates (e.g., `title` only) does NOT trigger `syncNote`
  - `deleteNote` triggers `referenceGraph.deleteReferencesFor`
  - `init` runs the repair pass before the full sync, and refetches notes when `rewiredLinks > 0`
  - `importNotes` calls `syncAll` after the bulk insert
  - `rebindAdapter` cascades to all three modules and re-runs init

### Task 11 — `useReferenceGraph` hook + provider wiring

- [ ] Create `src/notepad/context/useReferenceGraph.ts` modeled on `useNoteCollection`. Subscribes via `useSyncExternalStore`. Accept a slice selector argument so consumers can subscribe narrowly (e.g., `(state) => state.references`).
- [ ] In `NotepadProvider.tsx`: construct `new ReferenceGraph(adapter, fetchVerseText)`; pass it to the new 4-arg `NotepadActions`. Provide it via context alongside `NoteCollection`, `FolderHierarchy`, `NotepadActions`.

### Task 12 — Rewrite `use-graph.ts` as a view-shape transformer

- [ ] `useGraph(notes, activeNoteId)` becomes: subscribe to `referenceGraph` via `useReferenceGraph` for `references` and `scriptureNodes`. Compute `GraphNode[]` (joining `notes` + scripture nodes + weights derived from references) and `GraphEdge[]` (mapping `Reference` → `GraphEdge` for the visualizer). Return `{ nodes, edges, activeNodeId, isLoading, getNeighborhood }`.
- [ ] Remove `syncNoteEdges`, `prevContentsRef`, `initializedRef`, the diff effect, and all imports from `edge-store`/`scripture-store`/`cross-reference`/`edge-parser` — orchestration is gone.
- [ ] `getNeighborhood` delegates to `referenceGraph.getNeighborhood`.
- [ ] Verify `GraphPane.tsx` still renders the same shape; no other change required.

### Task 13 — Migrate Editor consumers to `NotepadActions` for content/delete

- [ ] Find every call to `noteCollection.updateNote` whose `updates` includes `content`, and every `noteCollection.deleteNote` call. Replace with `notepadActions.updateNote` / `notepadActions.deleteNote`. Use `grep -rn "updateNote\|deleteNote" src/notepad/components src/components`.
- [ ] Likely files: `Editor.tsx`, `Sidebar.tsx`, `NotepadToolbar.tsx`. Title-only / folder-move / tag-only updates can stay on `noteCollection` since they don't touch references.
- [ ] Manual smoke: edit a note, add a `noteLink` mark and a verse reference; confirm both appear as edges in `GraphPane`. Delete the note; confirm the edges disappear.

### Task 14 — Delete obsolete files

- [ ] `rm src/notepad/graph/edge-store.ts`
- [ ] `rm src/notepad/graph/scripture-store.ts`
- [ ] `rm src/notepad/graph/cross-reference.ts`
- [ ] `rm src/notepad/graph/edge-parser.ts`
- [ ] `rm src/notepad/graph/adjacency-list.ts`
- [ ] `rm src/notepad/graph/local-graph.ts`
- [ ] `rm src/notepad/storage/repair-note-links.ts`
- [ ] Remove any matching `.test.ts` files for the deleted modules.
- [ ] Run `tsc --noEmit` — should be green.

### Task 15 — Smoke tests + final verification

- [ ] Vitest: full suite green.
- [ ] Vite dev server: open the app, create a note with a `noteLink` mark and a verse reference, verify the graph shows both edges. Delete the note, verify the edges disappear.
- [ ] Cold-start verification: clear the localStorage cache (`notepad_graph_references`, `notepad_scripture_nodes`), reload — graph rebuilds via `init` → `syncAll`.
- [ ] Adapter rebind verification: switch from local to Supabase adapter (or vice versa) — `rebindAdapter` cascades, repair pass runs, full sync runs, graph rebuilds.
- [ ] Repair-pass verification: stage a note whose `noteLink` references an id that no longer exists but matches another note's title; reload; confirm the link is rewired and the count is reported.
