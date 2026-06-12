# Session Restore + Bible Verse Highlighting — Design

**Date:** 2026-06-11
**Status:** Approved (design); pending implementation plan

## Summary

Three related improvements to "leave off where you left off" and to scripture study:

1. **Restore the open note** — after a refresh or sign-out/sign-in, the editor reopens whichever note the user last had open (instead of starting blank).
2. **Restore the Bible position** — the Bible study window reopens at the last book + chapter the user was reading (instead of resetting to John 1).
3. **Bible verse highlighting** — the user can highlight scripture in the Bible tab using the same swatch palette as notes, with highlights persisted to their account.

All "last position" state (open note, active top-level view, Bible passage) is **per-device** (localStorage). Bible **highlights** are durable content and persist via the existing notes adapter pattern (localStorage when signed out → Supabase when signed in).

## Goals

- Refresh or sign-out/sign-in returns the user to the note they had open, in the top-level view they were in.
- Refresh or sign-out/sign-in returns the Bible window to the last book + chapter.
- The user can highlight whole Bible verses with the shared swatch colors and have those highlights persist with their account.

## Non-Goals (YAGNI)

- Cross-device sync of "last position" (open note / active view / Bible passage stay per-device).
- Multi-verse drag-selection for Bible highlighting (one verse per action in this iteration).
- Arbitrary sub-verse text-range highlighting in the Bible tab (whole-verse only).
- Changing how notes' own highlighting works.

---

## Section 1 — Restore the open note

### Problem mechanics

`activeNoteId` is in-memory only. It is `null` on a fresh page load, and is explicitly wiped to `EMPTY_STATE` in `NoteCollection.rebindAdapter()` on every adapter switch (sign-out/sign-in).

- State: [note-collection.ts:5-15](../../../src/notepad/collection/note-collection.ts#L5-L15)
- Selection chokepoint: `openNote(id)` — [note-collection.ts:30-32](../../../src/notepad/collection/note-collection.ts#L30-L32)
- Reset on adapter switch: [note-collection.ts:94-97](../../../src/notepad/collection/note-collection.ts#L94-L97)
- Init: [note-collection.ts:25-28](../../../src/notepad/collection/note-collection.ts#L25-L28) and [notepad-actions.ts:25-41](../../../src/notepad/collection/notepad-actions.ts#L25-L41)

### Design

- New helper module (e.g. `src/notepad/session/last-open-note.ts`) exposing `saveLastNoteId(scope, id)` and `loadLastNoteId(scope)` backed by localStorage.
- **Scope key** = current user id when signed in, `'local'` when signed out. Signed-in notes and signed-out local notes are different sets; scoping prevents reopening a Supabase note id against the local set (and vice versa).
- **Save:** `NoteCollection.openNote(id)` writes the id for the current scope (including `null` on close/delete).
- **Restore:** after `init()` and after `rebindAdapter()`'s reload, read the stored id for the current scope and call `openNote(id)` **only if a note with that id exists** in the loaded set (guards deleted notes).
- **Scope source:** the scope key is derived from the active adapter / auth session. Implementation plan decides exact wiring (pass scope into the collection on construct/rebind, or read from auth session).

### Mobile caveat

On mobile, the open note drives which pane/view shows ([MobileNotepadWorkspace.tsx](../../../src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx)). Restoring `activeNoteId` alone may not switch the mobile workspace into the editor view. The plan must ensure the mobile view derives from (or reacts to) the restored active note so a refresh lands the user *in* the note, not on the list.

---

## Section 1b — Restore the active top-level view

In addition to the open note, persist **which top-level view** the user was in (Notes editor vs Bible study window) so a refresh returns them to that view.

- One additional localStorage key (per-device, e.g. `lamplight-active-view`).
- Saved when the active top-level view changes; read on load to select the initial view.
- The top-level view container lives around [Notepad.tsx](../../../src/components/sections/Notepad.tsx) (`StudyWindow` / view switching). The plan identifies the exact state to persist.
- Validation guard: if the stored view value is unknown, fall back to the default view.

---

## Section 2 — Restore the Bible position (book + chapter)

### Problem mechanics

`passage` is plain `useState({ book: 'jhn', chapter: 1 })`, reset on every mount.

- State: [BibleStudyPane.tsx:25](../../../src/notepad/bible/BibleStudyPane.tsx#L25)
- Reader state + nav handlers: [BibleReader.tsx:32-99](../../../src/notepad/bible/BibleReader.tsx#L32-L99)
- Precedent for localStorage persistence: chat split fraction (`lamplight-chat-split-fraction`) in `useDragResize.ts`.

### Design

- Helper functions `saveBiblePassage({book, chapter})` / `loadBiblePassage()` against a single localStorage key (e.g. `lamplight-bible-passage`).
- Per-device, **not** scope-keyed (reading position is not tied to a notes set).
- **Initialize** `BibleStudyPane`'s `passage` lazily from `loadBiblePassage()`, falling back to John 1 if absent/malformed.
- **Persist** on every passage change via the existing `onPassageChange` chokepoint.
- **Validation guard:** restore only if `book` is a known OSIS code and `chapter` is within that book's range (see `bible-books.ts`); otherwise fall back to the default.

---

## Section 3 — Bible verse highlighting

A **separate system** from notes' highlighting (notes use a TipTap mark inside editable content; Bible verses are read-only spans that re-render per chapter). It **reuses the notes swatch palette and swatch visual styling** for a consistent look.

### Current verse rendering

Each verse is a clickable `<span id="bible-verse-{n}">` with a transient single-verse "selected" tan background:
- [BibleReader.tsx:254-273](../../../src/notepad/bible/BibleReader.tsx#L254-L273)
- Existing selection mechanism: `selectVerse` / `selectedVerse` — [BibleReader.tsx:96-99](../../../src/notepad/bible/BibleReader.tsx#L96-L99)

Notes swatch palette + visual styling to reuse:
- Swatch manifest: [src/notepad/styles/manifest.ts](../../../src/notepad/styles/manifest.ts)
- Swatch picker UI: [HighlightSwatchPopover.tsx](../../../src/notepad/components/HighlightSwatchPopover.tsx) (desktop), [HighlightPill.tsx](../../../src/notepad/components/HighlightPill.tsx) (mobile)
- Swatch background style helper: `highlightBackgroundStyle` in [style-highlight.ts:76-86](../../../src/notepad/extensions/style-highlight.ts#L76-L86)

### Interaction

- Tap a verse → it selects (existing `selectVerse`) and a swatch picker appears anchored to it (reusing `HighlightSwatchPopover` desktop / `HighlightPill` mobile).
- Pick a swatch → that verse gets the swatch background, persisted.
- Tap an already-highlighted verse → picker shows the active swatch plus a **remove** option.
- One verse per action (no drag multi-select this iteration).

### Data model

`BibleHighlight { verseId: "{book}.{chapter}.{verse}", swatchId }`, per user. (`verseId` matches the existing `bible_passages` id format, e.g. `jhn.1.1`.)

### Storage — notes adapter pattern

- New Supabase table `bible_highlights`: `user_id`, `verse_id`, `swatch_id`, created/updated timestamps. **RLS** so each user only reads/writes their own rows (consistent with the repo's established security-remediation patterns).
- localStorage fallback when signed out, keyed `'local'`, mirroring how notes degrade when signed out.
- The plan defines a small adapter interface (`localBibleHighlightAdapter` / `supabaseBibleHighlightAdapter`) selected by auth state, parallel to the notes adapter.

### Loading & rendering

- New hook `useBibleHighlights(book, chapter)` loads highlights for the visible chapter and returns a `verse → swatchId` map plus `setHighlight(verseId, swatchId)` and `removeHighlight(verseId)`.
- The verse `<span>` applies the swatch background using the **same** swatch visual helper the notes highlights use, so a given swatch renders identically in both places.
- The transient tan "selected" background remains as the selection affordance; the persisted highlight is what survives a chapter change / refresh.

### Decoupling note

The swatch-picker UI currently fires an editor command on pick. The plan lightly decouples the picker's `onPick(swatchId)` callback so it can also drive `setHighlight(verseId, swatchId)` in the Bible context, without disturbing the notes/editor path.

---

## Data flow summary

| Concern | Persistence | Scope | Chokepoint to save | Restore point |
|---|---|---|---|---|
| Open note | localStorage | per user-id / `'local'` | `NoteCollection.openNote` | after `init()` / `rebindAdapter()` |
| Active top-level view | localStorage | per-device | view-switch handler | on load |
| Bible passage | localStorage | per-device | `onPassageChange` | `BibleStudyPane` init |
| Bible highlights | localStorage → Supabase (`bible_highlights`, RLS) | per user / `'local'` | `setHighlight` / `removeHighlight` | `useBibleHighlights` on chapter load |

## Testing

- **Restore open note:** open a note, refresh → same note open; sign out then sign in → scope-correct note restored; delete the restored note's id → falls back gracefully (no crash, blank/list state).
- **Restore active view:** switch to Bible view, refresh → still on Bible view; unknown stored value → default view.
- **Restore Bible passage:** navigate to Psalm 23, refresh → Psalm 23; corrupt/out-of-range stored value → John 1 fallback.
- **Bible highlighting:** highlight a verse, change chapter and return → still highlighted; remove → cleared; signed-out highlight persists in localStorage; signed-in highlight round-trips through Supabase and is RLS-isolated per user.
- Guard against zero new lint/tsc errors over the pre-existing baseline; typecheck with `tsc -b`.

## Risks / Open questions for planning

- Exact wiring of the scope key into `NoteCollection` (constructor vs rebind vs read from auth session).
- Exact top-level view state to persist in `Notepad.tsx` and how it composes with the restored open note.
- Mobile workspace view derivation from a restored active note.
- Whether the swatch picker components need a small prop/interface change to be context-agnostic, or can be reused as-is.
- `bible_highlights` migration + RLS policy authored alongside existing migrations; edge functions / table deploy follows the manual Supabase deploy process.
