# Mobile Editor Empty-State New-Note FAB

**Date:** 2026-06-02
**Status:** Approved (design)

## Problem

On mobile, the editor tab shows "Select a note or create a new one" when no note
is open, but there is no way to act on "create a new one" from that screen. The
plus FAB that creates notes lives only on the Notes tab. A user sitting on an
empty editor has no affordance to start a note.

## Goal

On the mobile **editor tab only**, when no note is displayed, show a plus FAB
that directly creates a new note. Tapping it creates a new devotion note, which
loads in the editor (so the empty state — and the FAB — disappear).

## Scope

- **In scope:** a direct-create plus FAB on the mobile editor tab's empty state.
- **Out of scope:** the Notes-tab FAB (`MobileFabMenu`) is unchanged; no upload
  option on this FAB (direct create was chosen); desktop is unchanged; no shared
  FAB-primitive refactor.

## Key decisions

1. **Direct create, no menu.** A single tap creates a new note — the same action
   as the Notes-tab FAB's "New note" option — rather than expanding a menu.
2. **Only when no note is displayed.** The FAB shows only in the editor empty
   state and is hidden whenever a note is open.
3. **Mobile only.** Implemented purely in the mobile component tree.

## Signal for "no note displayed"

The editor's empty state is driven by `if (!activeNote)` in
`src/notepad/components/Editor.tsx:123`, where `activeNote` comes from
`useNoteCollection()`. `useMobileWorkspaceModel` exposes that same value as
`model.activeNote`. Therefore `!!model.activeNote` is an exact, consistent
signal for whether a note is displayed in the editor.

## Architecture

### 1. New component: `MobileNewNoteFab.tsx`

`src/components/sections/notepad/mobile/MobileNewNoteFab.tsx`

- Single-purpose presentational button. Props: `{ onClick: () => void }`.
- A gold (`#b8843a`) 52×52 circular button, white `Plus` icon (lucide-react),
  `shadow-lg`, `aria-label="New note"`, `type="button"`.
- Positioned bottom-right to match the Notes-tab FAB:
  `right: 16`, `bottom: calc(72px + env(safe-area-inset-bottom))`, `absolute z-50`.
- No expanding menu, no file input, no spinner. (Standalone rather than
  overloading `MobileFabMenu`, keeping each component to one responsibility. The
  few shared style values are cheaper to duplicate than to abstract.)

### 2. `MobileEditorView.tsx` (modify)

- Add props: `hasActiveNote: boolean` and `onNewNote: () => void`.
- Add `relative` to the root container (as `MobileNotesView` already does) so
  the absolutely-positioned FAB anchors to it.
- Render `{!hasActiveNote && <MobileNewNoteFab onClick={onNewNote} />}`.

### 3. `MobileNotepadWorkspace.tsx` (modify)

- Pass `hasActiveNote={!!model.activeNote}` and `onNewNote={handleNewNote}` to
  `MobileEditorView` (the `tab === 'editor'` render block, lines 126–134).
- `handleNewNote` already exists: `createNote('root', 'devotion'); setTab('editor');`
  — exactly the desired action.

## Data flow

```
Editor tab, no note open
  → MobileEditorView (hasActiveNote=false)
    → renders <MobileNewNoteFab onClick={onNewNote} />
       → tap → handleNewNote() → createNote('root','devotion')
          → model.activeNote becomes the new note
          → MobileEditorView re-renders with hasActiveNote=true
          → FAB unmounts; editor shows the new note
```

## Error handling

None specific. `createNote` is the existing, already-used creation path; this
change only adds a new trigger for it. No new async or failure modes.

## Testing

**`MobileNewNoteFab` (component):**
- Renders a button with accessible name "New note".
- Clicking the button calls `onClick` exactly once.

**`MobileEditorView` (component):**
- With `hasActiveNote={false}`, the "New note" FAB is present.
- With `hasActiveNote={true}`, the "New note" FAB is absent.
- Clicking the FAB (in the empty state) calls `onNewNote`.
- (Existing editor-view tests continue to pass; the `NotepadEditor` child is
  mocked as it is today.)

## YAGNI notes

- No upload affordance on this FAB.
- No changes to `MobileFabMenu` or the Notes tab.
- No desktop changes.
- No extraction of a shared FAB visual primitive — duplication of a handful of
  style values is acceptable and keeps the components independent.
