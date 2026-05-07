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

## StorageAdapter

The seam between persistence and the domain modules. Two real adapters today: `LocalStorageAdapter` (offline) and `SupabaseStorageAdapter` (cloud). The seam is real because two adapters exist; do not collapse it.

## Reference

A directed link from one Note to another (`explicit`, authored as a `noteLink` TipTap mark), from a Note to a scripture passage (`scripture-reference`, detected via verse regex in the Note's plain text), or from one scripture passage to another (`cross-reference`, derived from a bundled TSK dataset). The umbrella term is **Reference**; **cross-reference** is reserved for the scripture↔scripture kind.

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
