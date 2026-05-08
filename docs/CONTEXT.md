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
- First-load orchestration: `init()` runs `NoteCollection.init` and `FolderHierarchy.init` in parallel, then `ReferenceGraph.repairNoteLinks` against the loaded notes — applying each returned rewire through `NoteCollection.updateNote` so canonical in-memory state stays in sync — then `ReferenceGraph.init`

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

## MigrationWorkflow

The deepened module that owns the multi-phase orchestration around `migrateAdapter` — the stateful coordinator that the pure `AdapterMigration` module's "caller's concern" is referring to. Surfaced as the `useMigrationWorkflow({ source, target, onMigrationComplete, onClose })` hook returning `{ state, start, dismissError }`. Mounted by `MigrationDialog`.

Seven-state status machine:

```
idle ──(start)──> loading ──> folders(c,t) ──> notes(c,t) ──> cleanup ──> done(folders,notes)
                                                                              │
                                                                  (TIMELINE.celebratoryPause)
                                                                              ▼
                                                                            idle  (fires onClose)

(any step) ──(throw)──> error(message)
                            │
                            ├──(start)──────────> loading (retry)
                            └──(dismissError)───> idle  (fires onClose)
```

Class responsibilities:

- The seven-state status (idle / loading / folders / notes / cleanup / done / error) and the per-status payload (progress counts on folders/notes, result counts on done, message on error)
- `start()` — `idle | error → loading`; runs the migrate→clearSource→onMigrationComplete→done sequence; schedules the celebratory close timer
- `dismissError()` — `error → idle`; fires `onClose`
- `dispose()` — clears any pending celebratory timer (called on hook unmount); guards against the stale-fire race
- Guarded transitions: `start` no-ops from any in-progress status; mid-migration progress events from `migrateAdapter` flow through a private `setPhaseFromEvent` translator
- Side-effect orchestration via injected `MigrationWorkflowDeps`: `migrate`, `clearSource`, `toastSuccess`, `toastError`, `setTimer`, `clearTimer`, `onMigrationComplete`, `onClose`. Pure-state-and-deps, testable in node — fakes substitute for the storage adapters, toast, and timers at test time.

Owns the timeline as `MIGRATION_TIMELINE`: `celebratoryPauseMs` (default 1400). Single source of truth for the dialog's pause-then-close timing.

Composes with `AdapterMigration`: `start()` calls `deps.migrate(source, target, { onEvent })`, translating each `MigrationEvent` into a status mutation. The result `{ folders, notes }` flows into the `done` payload so the toast message ("1 note imported" vs "N notes imported") is computed inside the workflow, not the dialog.

Does **not** own: the dialog's `open` prop, the source-side `noteCount` shown on the intro panel (one-shot fetch, lives in the dialog's `useEffect`), the JSX panels themselves (intro / in-progress / error), or the in-progress click-outside guard (`open && !inProgress` is a view concern reading `state.status` from the workflow).

The fallback error message ("Something went wrong importing your notes. Your local copy was left untouched.") lives in the workflow, not the dialog — it is part of the lifecycle's contract that source data is preserved on failure.

## DocumentImporter

The module that turns uploaded files into full `Note` records, ready for `adapter.importNote` (id-preserving). Three exports:

- `parseFile(file)` — async, format-aware (`.md`, `.txt`, `.pdf`, `.docx`). DOM-coupled; `pdfjs-dist` and `mammoth` are dynamically imported. Not unit-tested.
- `buildNoteFromText({ title, text, folderId, type?, autoDetectVerses? })` — sync, pure. Generates a client-side `id` (`uuidv4`), `createdAt`/`updatedAt`, `wordCount`. Splits paragraphs on `\n\n+`, wraps each in a TipTap `paragraph` node. Optionally seeds tags from verse references (capped at 10).
- `linkNotesByVerses(notes)` — sync, pure. Optional cross-link pass that appends a "Related Notes" section pointing at each peer that shares at least one verse reference, using real `noteLink` marks. Because the ids exist before this pass runs, the inserted marks become genuine Reference edges in `ReferenceGraph` after `syncAll` — i.e. proper Backlinks.

The upload path uses `NotepadActions.importNotes(notes: Note[])`, which preserves ids via `adapter.importNote`. The id-preserving contract is what makes `linkNotesByVerses` work: the cross-link marks reference peers by their final ids, so `ReferenceGraph.syncNote` recognizes them as `explicit` References and they appear as Backlinks per §Backlink.

## tiptap-text

The canonical TipTap-text-extraction utility, lifted out of five inline copies that had drifted across the codebase (`word-count.ts`, `reference-parser.ts`, `SearchDialog.tsx`, `InfoPanel.tsx`, `document-importer.ts`). Lives at `src/notepad/utils/tiptap-text.ts`.

Three exports:

- `extractPlainText(node)` — recursive walker over a parsed TipTap JSON tree. Defensive on `unknown` input: returns `''` for non-objects. Joins child text on a single space.
- `extractTextFromNote(note)` — `extractPlainText(JSON.parse(note.content))` with a try/catch fallback to the raw `note.content` string for non-JSON. The shape `document-importer.ts` already exposed; promoted here so every caller goes through the same path.
- `countWordsFromTipTapJSON(jsonString)` — preserved from the original `word-count.ts`. Implementation now reuses `extractPlainText`.

The five previous copies had minor drift — `InfoPanel.tsx`'s version was missing the `type === 'text'` gate (theoretically buggy on TipTap docs with stray `text` fields on non-text nodes; in practice harmless on valid docs). The canonical version uses the gate; the migration is effectively a defensive bug fix.

Does **not** own: verse extraction (that's `extractVerseRefs` in `bible-verse-utils`), tag parsing (that's `tags.ts`), or any TipTap *editor* coupling — these are pure utilities operating on parsed JSON.

## SearchIndex

The deepened module that builds the deduped verse-and-tag index `SearchDialog` renders. Surfaced as `buildSearchIndex(notes): { verses, tags }`, each entry shaped `{ <key>, noteId, noteTitle }`.

Responsibilities:

- For each Note: extract plain text via `extractTextFromNote` (§tiptap-text), then run `extractVerseRefs` over the result.
- Dedup verses by ref string, **first-occurrence-wins**: the first Note in `notes` order containing a given verse owns the entry. Same dedup logic for tags, reading from `note.tags` directly (tags are pre-stored on the Note, not parsed from content).
- Pure of React, DOM, and persistence; tested in node.

Does **not** own: the cmdk command-palette UI (lives in `SearchDialog`), the keyboard shortcut binding (`useEffect` listener in the dialog), or full-text note search (the dialog leans on cmdk's substring-on-`value` matching for the Notes group).

## dominant-color

The deepened pure module that owns the dominant-color extraction algorithm previously buried inside `extractDominantColor`'s canvas `onload` handler. Lives at `src/utils/dominant-color.ts`.

One public export:

- `dominantColorFromPixels(pixels: Uint8ClampedArray): string` — takes an RGBA pixel buffer (any size; algorithm walks `pixels.length / 4` pixels), returns a muted overlay-friendly hex color.

Algorithm steps (preserved from the original):

1. Walk every pixel, skip transparent (alpha < 128), too-dark/too-bright (brightness < 25 or > 230), and near-grey (HSL saturation < 0.08).
2. Quantise the survivors into 32-step RGB buckets; track count and running RGB sum per bucket.
3. If the filtered pass produced no buckets, do a second pass over **every** opaque pixel (skipping only the alpha gate) — this is the "fully grey image" rescue.
4. Pick the bucket with the highest count (initial `best` is the algorithm's neutral starting RGB, hardcoded to `(0x8B, 0x83, 0x78)` — not to be confused with `FALLBACK_OVERLAY_COLOR`, which is the project-data fallback used by the DOM wrapper for image-load failures).
5. Average the real RGB values inside that bucket.
6. Mute via HSL: saturation × 0.45, lightness blended toward 0.45 (`l × 0.55 + 0.45 × 0.45`).

Internal helpers (`rgbToHsl`, `hslToRgb`, `toHex`) stay private to the module — they are algorithm support, not a public color-math API.

`extractDominantColor` is now a thin DOM wrapper around this: load `Image`, draw to a 50×50 canvas, `getImageData`, hand the buffer to `dominantColorFromPixels`. Image-load failures and missing canvas context resolve to `FALLBACK_OVERLAY_COLOR` directly without calling the algorithm.

Pure of DOM, canvas, and React. Tested in node by constructing synthetic `Uint8ClampedArray` pixel buffers — the previous embedded algorithm had zero test coverage despite four magic numbers and a two-pass fallback structure.

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
- The legacy `repairNoteLinks` pass (orphan-by-title rewiring of `noteLink` marks). Returns `{ rewires, rewiredLinks, orphans }` — pure, no I/O. Caller (`NotepadActions`) persists each rewire through `NoteCollection`.
- Neighborhood queries (`getNeighborhood(nodeId, depth)`)
- Targeted patching from sync — no full rebuild on per-Note sync
- `reset()` — clears state to empty; called from `NotepadActions.rebindAdapter` cascade. Does not take an adapter; `ReferenceGraph` has no adapter coupling.
- Exporting the verse regex, book patterns, canonical-id helpers, and parser for TipTap marks to import

Does **not** own: visualization shape (`GraphNode`/`GraphEdge` for `GraphPane` belong to the view layer), TipTap mark rendering (marks stay in `src/notepad/extensions/` and import from this module), the `StorageAdapter` (graph is pure of persistence — note mutations from `repairNoteLinks` flow back through `NoteCollection`), or any awareness of `NoteCollection` or `FolderHierarchy`.

The localStorage keys (`notepad_graph_references`, `notepad_scripture_nodes`) are a **derivation cache**, not a source of truth. Source of truth is Note content + the bundled TSK dataset + the Bible API. Deleting the cache and re-running sync rebuilds the same state. Cross-device sync is intentionally out of scope.

## projectGraph

The pure function that turns `(Note[], Reference[], ScriptureNode[])` into `{ nodes: GraphNode[], edges: GraphEdge[] }` for `GraphView`. Owns three load-bearing rules:

- Edge weights are summed per node id (both endpoints accumulate).
- A `ScriptureNode` is emitted only if it participates in at least one edge — verses fetched lazily during `ReferenceGraph.syncNote` but never actually referenced from a Note are omitted from the view.
- Reference type strings (`'scripture-reference'`, `'cross-reference'`, `'explicit'`) are mapped to view-side edge types (`'scripture_reference'`, `'cross_reference'`, `'explicit'`).

Lives next to `reference-graph.ts` because the rules are about References, not layout. The previous `useGraph` hook collapses to a thin `useMemo` around this function, or is dropped entirely if the shell prefers to project inline.

## GraphView

The deepened module that owns the d3-force simulation, canvas rendering, and pointer interaction for the knowledge graph. Surfaced as a `GraphView` class extending `Observable<GraphViewState>`, instantiated by `GraphPane` and attached to a canvas element. `GraphPane` becomes the view shell: controls panel, canvas + popover-overlay markup, and `useEffect`-bound forwarders to `view.setData`, `view.setMode`, `view.setFilters`, `view.setSettings`.

Responsibilities:

- d3-force simulation lifecycle (rebuild on data / mode / filter changes, preserve `(x, y)` of surviving node ids across rebuilds)
- Canvas drawing of edges, nodes, labels, and the active-node glow ring
- Pan/zoom transform — internal, mutated by pointer/wheel handlers without React rerenders
- Pointer handling: hover detection, drag-vs-click discrimination, wheel zoom anchored at cursor
- Scripture popover state on the observable snapshot. Rendered by the shell as a positioned DOM element over the canvas, not via `ctx.fillText` — the previous in-canvas `drawPopover` is removed
- Auto-fit camera once at tick 80
- `ResizeObserver` coupling (canvas DPR sizing + sim recenter)

Construction takes `GraphViewDeps`: `onNodeOpen(noteId)` is the sole outbound callback (what to do on a non-scripture node click is the shell's concern). Optional `now()` and `devicePixelRatio()` deps make tick counting and DPR injectable for tests.

Pure of React, persistence, and `NoteCollection` knowledge. Consumes `GraphNode[] / GraphEdge[]` produced by `projectGraph`; knows nothing about `Reference` shapes. Tested in node with a `MockCanvasContext` (recorder of draw calls) and a `MockResizeObserver`, mirroring the `RouteTransition` testing pattern.

`GraphPane` (the view shell) keeps mode/filter/settings React state because those are bound to form inputs; on every change it forwards the new value to the matching `setX` method. Position preservation is `GraphView`'s concern, not the shell's — the shell can rerender without losing dragged positions.

## AuthSession

The deepened module that owns user identity for the active session. Surfaced as the `useAuthSession()` hook returning `{ user, loading, adapter, session }` — methods (`signUp`, `signIn`, `signInWithGoogle`, `signInWithApple`, `signOut`) are called on `session`, mirroring the `useNoteCollection().collection` pattern. Mounted by `<AuthProvider>`, which wires `AuthSession`, `AccountProfile`, and `AccountActions` together (mirroring how `<NotepadProvider>` wires the notepad-domain classes).

Responsibilities:
- The Supabase `User` (or `null`) and the auth subscription lifecycle
- `loading`: session-level loading only — `false` once `getSession()` resolves, regardless of profile state
- The active `StorageAdapter`: the `localAdapter` singleton from `local-storage.ts` when no user, a `SupabaseStorageAdapter` memoized on `user.id` when signed in
- Sign-up, password sign-in, Google/Apple OAuth, and sign-out
- OAuth callback URL stripping (the once-on-first-mount `window.history.replaceState`)

Does **not** own: profile data, account-deletion sequencing, or online/offline detection.

The `adapter` field is derived state, not separately managed: a fresh `SupabaseStorageAdapter` is constructed when `user.id` changes, and `signOut` resets it to `localAdapter`. `NotepadProvider` consumes it as a prop and calls `NotepadActions.rebindAdapter` when it changes; that pipe is unchanged from before the deepening.

## ProfileStatus

A four-state value indicating the lifecycle of `AccountProfile`'s fetch for the current user:
- `'loading'` — fetch in flight (initial or after `refreshProfile`)
- `'loaded'` — profile row was returned and is non-null
- `'missing'` — fetch resolved with no row (e.g. signed-in user without a profile row yet)
- `'error'` — fetch threw; `profile` is `null` and the error was swallowed

Distinguished from `AuthSession.loading`: that flag covers session resolution; `profileStatus` covers profile resolution. They move independently. Consumers that need the distinction read `profileStatus`; consumers that just need "is there a profile?" can keep checking `profile !== null`.

## AccountProfile

The deepened module that owns the active user's profile. Surfaced as the `useAccountProfile()` hook returning `{ profile, profileStatus, account }` — methods (`updateProfile`, `refreshProfile`, `uploadAvatar`) are called on `account`. Mounted via `<AuthProvider>`.

Responsibilities:
- The `UserProfile` (or `null`) for the current user
- `profileStatus: ProfileStatus` — explicit state machine for the profile fetch
- The snake_case ↔ camelCase mapping for the `profiles` table — concentrated here, not duplicated at callsites
- Profile field updates (`fullName`, `dateOfBirth`, `avatarUrl`) and `refreshProfile`
- Avatar upload to Supabase Storage and write-back to the profile row

Does **not** own: identity, sign-in/out, or account-level multi-step operations like deletion.

Fetch fires when `AuthSession.user` changes and intentionally does **not** gate `AuthSession.loading`. A slow or failed profile fetch leaves the rest of the UI usable.

## AccountActions

The coordinator module that owns multi-module sequencing for account-level operations. Stateless. Surfaced as `useAccountActions()` returning `{ deleteAccount }`, composing `useAuthSession()` and `useAccountProfile()` internally.

Responsibilities:
- `deleteAccount()` — remove avatar files from Supabase Storage, delete the profile row (cascades to notes/folders via FK), then `signOut`. The adapter resets to `localAdapter` automatically because `AuthSession` derives it from `user`.
- `exportData()` — read all Notes and Folders from the active `StorageAdapter` for download as JSON. Adapter-level rather than in-memory because the only consumer is `ProfilePage`, which lives outside `<NotepadProvider>` and therefore has no in-memory `NoteCollection` to read from.

`AuthSession` and `AccountProfile` do not know each other; cross-module knowledge concentrates here.

## RouteTransition

The deepened module that owns the state machine and side-effect orchestration for cross-route page transitions (the `SplitTransition` overlay flow). Surfaced as the `useRouteTransition(projects)` hook returning `{ status, color, transition }`. The hook also internally mounts the popstate-driven back-button interception on `/purpose/:id` detail pages and the belt-and-suspenders scroll restore in a `useLayoutEffect` on pathname change.

Status is a four-state machine:

```
idle ──(beginNavigation)──> expanding ──(completePhase)──> revealing ──(completePhase)──> idle
idle ──(beginExit)─────────> exiting ──(completeExit)────> expanding (then as above)
```

`exiting` exists only on the back-from-detail flow: `PurposeDetail` plays its text-fade animation while the overlay is still hidden, then calls `completeExit('/')` to start the overlay.

Class responsibilities:

- The four-state status, current `color`, and (private) `pendingTarget`, `isBackNav`, `savedScrollY`
- Phase transitions including double-click defense (`beginNavigation` / `beginExit` no-op when not idle) and double-popstate defense
- Side-effect orchestration via injected `RouteTransitionDeps`: `navigate`, `killScrollTriggers`, `setBodyOverflow`, `scrollWindow`, `getScrollY`. The class is pure-state-and-deps, testable in node — fakes substitute for DOM, GSAP, and react-router at test time.
- Scroll restoration on back nav (restore saved Y) versus forward nav (scroll to 0), both inside the `expanding → revealing` boundary and as a backstop in `handleLocationChanged()`.

Does **not** own: the popstate listener itself, `history.pushState` for the back-button trap, or knowledge of which paths are detail pages. Those live in `useRouteTransition` because they are window-event coupling.

The status value is a four-state superset of `SplitTransition`'s three-state `phase` prop. App-level rendering maps `'exiting' → SplitTransition is hidden` and the other three pass through directly.

## PurposeDetailReveal

The deepened module that owns the entry + exit reveal lifecycle for the purpose detail page. Surfaced as the `useDetailReveal({ project, exiting, onExitComplete })` hook returning `{ isVisible, textReady, contentRef, imageRef }`. Mounted by `PurposeDetail`.

Five-state status machine:

```
idle ──(start)──> entering ──(textReadyTimer @ TIMELINE.textReadyAt)──> revealed
                     │                                                     │
                     └──────────────(requestExit)─────────────────────────-┤
                                                                           ▼
                                                                        exiting
                                                                           │
                                                              (TIMELINE.exitCompleteAt)
                                                                           ▼
                                                                        exited  (fires onExitComplete)
```

Class responsibilities:

- The five-state status and the derived `isVisible` / `textReady` booleans the JSX consumes
- `start()` — `idle → entering`; schedules the text-ready timer
- `reset()` — for project change; cancels any pending timer and re-enters
- `requestExit()` — `entering | revealed → exiting`; calls `applyExitStyles` for `'content'` and `'image'` with the styles from `DETAIL_REVEAL_TIMELINE`; schedules the exit-complete timer that fires `onExitComplete` and transitions to `exited`
- `dispose()` — clears any pending timers (called on hook unmount)
- Guarded transitions: each method no-ops from the wrong status, mirroring `RouteTransition.beginNavigation` / `beginExit` defense
- Side-effect orchestration via injected `DetailRevealDeps`: `applyExitStyles`, `setTimer`, `clearTimer`, `onExitComplete`. The class is pure-state-and-deps, testable in node — fakes substitute for DOM mutation and timers at test time.

Owns the timeline as `DETAIL_REVEAL_TIMELINE` exported from the module: `textReadyAt`, `exitCompleteAt`, `easing`, and the `contentExit` / `imageExit` style objects. JSX imports the easing string for the inline `<h1>` / small-text transitions.

Composes with `RouteTransition`: `RouteTransition.beginExit()` flows down as the `exiting` prop, the controller plays the fade, then `onExitComplete` (= `RouteTransition.completeExit`) hands back. The two halves of the back-from-detail handshake.

Does **not** own: scroll reset on project change (stays a `useLayoutEffect` in `PurposeDetail` because it is layout-effect-coupled), per-reveal animation durations on `<LineMaskReveal>` / `<ImageReveal>` (those are aesthetic, not lifecycle), or the Restoration1/3-vs-standard layout branching (pure JSX).

## NotepadFirstLoad

The deepened module that owns the three first-load decisions fired when a signed-in user lands on `/notepad`: welcome redirect, daily greeting, and local-notes migration prompt. Surfaced as the `useNotepadFirstLoad()` hook returning `{ showMigration, dismissMigration }`. Mounted by `NotepadWorkspace`.

Unlike the other deepened modules in this file, this one is **not a state machine** — there are no timers, no async sequencing, no observable status to react to. The shape is a pure decision module:

```ts
decideFirstLoadActions({
  user, authLoading,
  hasBeenWelcomed, hasBeenGreetedToday, localNoteCount
}): FirstLoadAction[]

// FirstLoadAction =
//   | { kind: 'redirect-welcome' }
//   | { kind: 'greet'; firstName: string }
//   | { kind: 'offer-migration' }
```

The hook coordinates the storage reads (sync localStorage / sessionStorage; async `localAdapter.getNotes()`), invokes the decision, and dispatches each returned action to its side-effect target (`navigate`, `toast`, `setShowMigration`).

Module responsibilities:

- `decideFirstLoadActions(input)` — pure rule evaluation. Empty list when `authLoading || !user`. Returns `redirect-welcome` first when `!hasBeenWelcomed` (and short-circuits the greet decision); always evaluates the migration decision independently. `greet` carries the resolved `firstName` so the toast string is computed inside the decision, not at the call site.
- `firstNameOf(user)` — pure name extraction with the canonical fallback chain: `user_metadata.full_name` first word → email local-part → `'friend'`.
- `welcomedKey(userId)` and `greetedKey(userId, today)` — single source of truth for the storage key formats. Previously templated inline in two places (`WelcomePage` writer, `Notepad` reader); both now import from here.
- `hasBeenWelcomed` / `markWelcomed` and `hasBeenGreetedToday` / `markGreetedToday` — sync read/write helpers taking `Pick<Storage, 'getItem' | 'setItem'>` so they're testable without a DOM (mirrors the `TreeViewState` and `ReferenceGraph` cache pattern).
- `todayDateString(now)` — pure thin wrapper over `Date.toDateString()`, parameterized for fake-clock tests.

Hook responsibilities:

- Owns the `showMigration` boolean previously held in `NotepadWorkspace`
- Reads the local note count via `localAdapter.getNotes()` (async). The previous direct `localStorage.getItem('notepad_notes')` read leaked the storage key past `LocalStorageAdapter`'s seam — that leak is closed.
- Dispatches each `FirstLoadAction` in order:
  - `redirect-welcome` → `navigate('/welcome')`
  - `greet` → `markGreetedToday(...)` then `toast.success('Welcome back, {firstName}!')` (write-marker-then-toast order matches the original)
  - `offer-migration` → `setShowMigration(true)`
- Returns `{ showMigration, dismissMigration }` to the consumer; the migration dialog's `onClose` wires to `dismissMigration`.

Does **not** own: identity (that's `AuthSession`), the migration workflow itself (that's `MigrationWorkflow`), or the WelcomePage UI flow (the page calls `markWelcomed` directly when the user submits the form).
