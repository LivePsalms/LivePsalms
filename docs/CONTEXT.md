# Domain language

Names for the concepts the codebase keeps re-encountering. Use these terms exactly when discussing architecture; variants ("note service", "notes manager", "notes store") drift the conversation.

When a new concept is introduced or sharpened during design work, it goes here.

---

## Note

A user-authored document with TipTap JSON content, a title, a `folderId`, a `type`, and tags. Lives in a single flat collection under whatever `StorageAdapter` is active.

## Folder

A node in a hierarchy that groups Notes. Has a `parentId` (or `null`/`'root'`), a sibling `order`, optional icon and color. Hierarchy is a tree, not a graph.

## NoteCollection

The deepened module that owns the canonical state of all Notes plus the active selection.

Responsibilities:
- The list of Notes
- `activeNoteId` and the derived `activeNote` (selection points *into* the collection)
- All single-Note mutations (create, update, rename, move, duplicate, delete)
- The selection invariant: deleting the active Note clears `activeNoteId`
- Targeted patching from adapter return values — no full refetch on single-Note mutations
- The `applyReparenting(noteIds, newFolderId)` operation invoked by `NotepadActions` after a folder delete
- The legacy `repairNoteLinks` pass on init

Does **not** own: folders, journal theme, the cross-reference graph, or any awareness of `FolderHierarchy`.

## FolderHierarchy

The deepened module that owns the canonical state of all Folders.

Responsibilities:
- The list of Folders
- All single-Folder mutations (create, rename, delete)
- Sibling-`order` computation on create
- Targeted patching from adapter return values

Does **not** own: any awareness of Notes. `deleteFolder` mutates only the folder; the cross-table re-parenting is `NotepadActions`'s concern.

## NotepadActions

The coordinator module that owns multi-module sequencing. Stateless.

Responsibilities:
- `updateNote(id, updates)` — call `NoteCollection.updateNote`; if `updates.content` was set, call `ReferenceGraph.syncNote` with the updated Note
- `deleteNote(id)` — call `NoteCollection.deleteNote`, then `ReferenceGraph.deleteReferencesFor(id)`
- `deleteFolder(id)` — read affected Note ids from `NoteCollection`, call `FolderHierarchy.deleteFolder`, then `NoteCollection.applyReparenting`
- `importNotes(items)` — bulk create through the adapter, `NoteCollection.refetchAll()`, then `ReferenceGraph.syncAll(currentNotes)`
- `rebindAdapter(newAdapter)` — cascade re-init to all three modules; init runs the repair pass and full sync
- First-load orchestration: `init()` runs `NoteCollection.init` and `FolderHierarchy.init` in parallel, then `ReferenceGraph.repairNoteLinks` against the loaded notes (re-fetching notes if anything was rewired), then `ReferenceGraph.init`

`NoteCollection`, `FolderHierarchy`, and `ReferenceGraph` do not know each other; cross-module knowledge concentrates here.

## NoteEditor

The deepened module that bridges a TipTap editor instance to `NotepadActions.updateNote` for the active Note. Surfaced as the `useNoteEditor({ activeNote, updateNote })` hook returning `{ editor }`.

Responsibilities:
- TipTap editor instantiation with the `StarterKit`, `Placeholder`, `Underline`, `BibleVerse`, `NoteLink`, and `TagMark` extensions
- Debounced save on every doc change (writes `content` + `tags` via `updateNote`)
- Active-Note swap: load content, focus start, do not emit update
- Cleanup of pending debounce on unmount

Sibling controllers in the same module live next to it:
- `useNoteLinkPopup({ editor, notes, activeNoteId })` — `[[` keydown trigger, popup anchor, search state, filtered candidates, insertion (delegates to `insertNoteLinkAt` exported from `extensions/note-link.ts`).
- `useVerseTooltip({ graph })` — hover detection over `[data-bible-verse]`, race-fenced verse resolution that **reads** from `ReferenceGraph.getScriptureNode` first and falls back to the network. Does not write the cache on miss; that path is reserved for `ReferenceGraph.syncNote`.

Does **not** own: toolbar, note-link click-through, or the journal-theme picker. Those are view concerns and stay in the consuming component. The `<input>` Enter/Escape handling on the popup also stays inline with the input element.

Tag extraction currently uses the `#\w+` regex on plain text (preserved from the prior inline implementation). Aligning this with the `tagMark` extension is intentionally out of scope for the deepening; it is filed as a future candidate.

## FolderTreeView

The deepened module that prepares `(Notes, Folders, filterText, tagFilter)` into the indexed shape the sidebar renders. Surfaced as `buildFolderTreeView(notes, folders, filterText, tagFilter)` returning `{ rootFolders, rootNotesByType, notesByFolder, childFoldersByParent, allTags }`.

Load-bearing invariants pinned in tests:

- **Orphan rule.** A Note whose `folderId` is `'root'` OR points at a folder that does not exist is treated as a root Note. This is preserved verbatim from the prior inline implementation; it lets the sidebar continue to render Notes whose folder was deleted out from under them without dropping them on the floor.
- Folders sort by `order` ascending, both at the root and within each parent bucket.
- Tag counts (`allTags`) are computed from ALL Notes, not the filtered subset, so the active tag pivot stays visible and clickable when applied.
- Empty `NoteType` buckets are dropped from `rootNotesByType`. Iteration order is `NOTE_TYPE_ORDER` (`devotion`, `sermon`, `theme`).

Sibling sub-components live next to it under `src/notepad/sidebar/`: `InlineEdit`, `MoveToFolderDialog`, `NewNoteDialog`, `NoteItem`, `FolderItem`, plus the small `NOTE_TYPE_CONFIG` lookup. `src/notepad/components/Sidebar.tsx` is now the shell that consumes `buildFolderTreeView` and mounts these.

Does **not** own: drag-and-drop reordering (none today; Move-to-Folder is dialog-driven) or selection invariants (those live in `NoteCollection`). Tree expand/collapse state is owned by `TreeViewState`, scoped to the sidebar tree.

## TreeViewState

The deepened module that holds expand/collapse state for the sidebar tree, replacing three previously-scattered state holders (top-level `tagsExpanded`, top-level `typeGroupsExpanded` record, and per-`FolderItem` local `useState`). Surfaced as `<TreeViewStateProvider>` mounted by `NotepadSidebar`, with `useTreeViewState()` returning `{ isExpanded(key, default), toggle(key, default) }`.

Underlying state is a sparse `Record<string, boolean>` of OVERRIDES only — keys absent from the record fall back to the per-call default. Folders never explicitly toggled don't appear in state, and a folder mounting/unmounting during search-filter changes doesn't clear its open state.

Key conventions:

- `folder:${folderId}` — each Folder row, default `true`.
- `type:${noteType}` — each NoteType group at root, default `true`.
- `tags` — the tags section at the bottom, default `false`.

Overrides are persisted to `localStorage` under `notepad_tree_view_overrides`, so expanded folders, type groups, and the tags section survive a page refresh. Defensive: malformed JSON, non-boolean values, missing storage, and quota errors all degrade to "ignore and continue." Storage helpers accept a `Pick<Storage, 'getItem' | 'setItem'>` so they're testable without a DOM (mirrors the `ReferenceGraph` cache pattern).

Does **not** own: filter text, tag filter pivot, or any data; only the boolean tree-view state. The state lives at the `NotepadSidebar` level — it is not pushed up into `NotepadProvider` because no other surface consumes it.

## StorageAdapter

The seam between persistence and the domain modules. Two real adapters today: `LocalStorageAdapter` (offline) and `SupabaseStorageAdapter` (cloud). The seam is real because two adapters exist; do not collapse it.

## AdapterMigration

The deepened module that copies every Folder and Note from one `StorageAdapter` to another, preserving ids and timestamps so embedded `noteLink` marks and `folderId` references keep resolving after the move. Surfaced as `migrateAdapter(source, target, { onEvent? })` returning `{ folders, notes }`.

Pure copy — does **not** mutate the source. Source-side cleanup (e.g., `LocalStorageAdapter.clearAll()` after migrating to Supabase) is the caller's concern; per-adapter cleanup methods encapsulate the storage keys.

Folders are imported before Notes so each Note's `folderId` reference resolves at the destination at write time. Note ids are preserved so embedded `noteLink` marks keep resolving — otherwise every cross-Note edge in the graph would break after migration.

## DocumentImporter

The module that turns uploaded files into full `Note` records, ready for `adapter.importNote` (id-preserving). Three exports:

- `parseFile(file)` — async, format-aware (`.md`, `.txt`, `.pdf`, `.docx`). DOM-coupled; `pdfjs-dist` and `mammoth` are dynamically imported. Not unit-tested.
- `buildNoteFromText({ title, text, folderId, type?, autoDetectVerses? })` — sync, pure. Generates a client-side `id` (`uuidv4`), `createdAt`/`updatedAt`, `wordCount`. Splits paragraphs on `\n\n+`, wraps each in a TipTap `paragraph` node. Optionally seeds tags from verse references (capped at 10).
- `linkNotesByVerses(notes)` — sync, pure. Optional cross-link pass that appends a "Related Notes" section pointing at each peer that shares at least one verse reference, using real `noteLink` marks. Because the ids exist before this pass runs, the inserted marks become genuine Reference edges in `ReferenceGraph` after `syncAll` — i.e. proper Backlinks.

The upload path uses `NotepadActions.importNotes(notes: Note[])`, which preserves ids via `adapter.importNote`. The id-preserving contract is what makes `linkNotesByVerses` work: the cross-link marks reference peers by their final ids, so `ReferenceGraph.syncNote` recognizes them as `explicit` References and they appear as Backlinks per §Backlink.

## Reference

A directed link from one Note to another (`explicit`, authored as a `noteLink` TipTap mark), from a Note to a scripture passage (`scripture-reference`, detected via verse regex in the Note's plain text), or from one scripture passage to another (`cross-reference`, derived from a bundled TSK dataset). The umbrella term is **Reference**; **cross-reference** is reserved for the scripture↔scripture kind.

## Backlink

A Note that has an inbound `explicit` Reference to the active Note — i.e. it contains an authored `noteLink` mark targeting the active Note's id. Served by `ReferenceGraph.getReferencesBy({ target: activeNoteId })` filtered to `type === 'explicit'`.

Title-substring mentions (a Note whose plain text happens to contain the active Note's title) are **not** Backlinks. They were considered and rejected: false positives are easy (any Note about "forgiveness" matches a Note titled "Forgiveness"), the heuristic doesn't survive title renames, and treating them as Backlinks creates a silent disagreement with the graph view where the same Notes are not connected. If a "soft mention" feature is ever wanted, it is a separate concept with separate UI.

## ScriptureNode

A persistent record for a scripture passage referenced by at least one Note. Holds the canonical id (`scripture:{book}-{chapter}-{verse}`), parsed location, translation, and cached verse text from the Bible API. Created lazily as References are detected.

## ReferenceGraph

The deepened module that owns the canonical state of all References plus the ScriptureNode cache.

Responsibilities:
- The list of References (note→note, note→scripture, scripture→scripture)
- The ScriptureNode cache (verse text fetched lazily, best-effort)
- Per-Note sync: parse a Note's TipTap content, write its outgoing References, create any missing ScriptureNodes, expand TSK cross-references for new scripture nodes
- TSK dataset loading and scripture↔scripture expansion
- The legacy `repairNoteLinks` pass (orphan-by-title rewiring of `noteLink` marks)
- Neighborhood queries (`getNeighborhood(nodeId, depth)`)
- Targeted patching from sync — no full rebuild on per-Note sync
- Exporting the verse regex, book patterns, canonical-id helpers, and parser for TipTap marks to import

Does **not** own: visualization shape (`GraphNode`/`GraphEdge` for `GraphPane` belong to the view layer), TipTap mark rendering (marks stay in `src/notepad/extensions/` and import from this module), or any awareness of `NoteCollection` or `FolderHierarchy`.

The localStorage keys (`notepad_graph_references`, `notepad_scripture_nodes`) are a **derivation cache**, not a source of truth. Source of truth is Note content + the bundled TSK dataset + the Bible API. Deleting the cache and re-running sync rebuilds the same state. Cross-device sync is intentionally out of scope.
