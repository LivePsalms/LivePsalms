# Notes 3-dot menu: working actions + inline rename

**Date:** 2026-06-02
**Scope:** `src/notepad/sidebar/` — `NoteItem.tsx`, `FolderItem.tsx`, `InlineEdit.tsx`, plus one new hook.

## Problem

The 3-dot (kebab) dropdown menu on note rows and folder rows is now visible on
mobile, but its actions don't work:

1. **Delete / Move to Folder do nothing.** Each menu item runs
   `setMenuOpen(false)` and then opens a dialog (`setDeleteOpen(true)` /
   `setMoveOpen(true)`) synchronously in the same click. Closing a Radix menu in
   the same tick as opening an `AlertDialog`/`Dialog` triggers a focus/pointer
   race: the modal opens and is immediately dismissed. The right-click
   `ContextMenu` items work because they don't close-then-open in the same tick.
2. **Rename uses a browser `prompt()`** instead of editing the name in place.

## Goal

- All 3-dot menu actions behave exactly like the right-click context menu.
- **Rename edits the name inline, right on the row** (type, `Enter` saves,
  `Esc` cancels) — for **note rows and folder rows**, from **both** the 3-dot
  menu and right-click. Every `prompt()`-based rename is removed.

## Approach

Chosen: run each menu action in the menu's `onCloseAutoFocus` rather than during
the click. This is the documented Radix pattern for opening a dialog from a menu
item. Rejected alternatives: deferring with `requestAnimationFrame`/`setTimeout`
(scatters frame-timing magic into every handler) and `modal={false}` (doesn't
reliably fix the focus race).

## Design

### 1. `useDeferredMenuAction` hook (new)

`src/notepad/sidebar/useDeferredMenuAction.ts`

```ts
export function useDeferredMenuAction() {
  const pending = useRef<(() => void) | null>(null);
  const run = (fn: () => void) => { pending.current = fn; };
  const onCloseAutoFocus = (e: Event) => {
    if (!pending.current) return;
    e.preventDefault();           // don't bounce focus back to the trigger
    const fn = pending.current;
    pending.current = null;
    fn();                          // open dialog / start inline edit / duplicate
  };
  return { run, onCloseAutoFocus };
}
```

`run` owns *when* (after close); the components own *what*. Wired onto both
`DropdownMenuContent` and `ContextMenuContent` via their `onCloseAutoFocus` prop.

### 2. `InlineEdit` — make editing controllable

Add optional `editing?: boolean` and `onEditingChange?: (v: boolean) => void`.

- When provided, edit mode is controlled by the parent (the menu can start it).
- When omitted, behavior is unchanged (internal state + double-click to edit), so
  existing call sites that don't pass them are unaffected.

The existing `<input>` already calls `e.stopPropagation()` on click, so typing in
it won't trigger the row's `onClick` (open note / toggle folder).

### 3. `NoteItem.tsx`

- Add `const [renaming, setRenaming] = useState(false)`.
- Pass `editing={renaming} onEditingChange={setRenaming}` to the title
  `InlineEdit`.
- Add `const menuAction = useDeferredMenuAction()`; set
  `onCloseAutoFocus={menuAction.onCloseAutoFocus}` on `DropdownMenuContent` and
  `ContextMenuContent`.
- Route all items (both menus) through `menuAction.run(...)`, dropping the manual
  `setMenuOpen(false)` (Radix closes on select):
  - Rename → `setRenaming(true)`  (replaces the `prompt()`)
  - Move to Folder → `setMoveOpen(true)`
  - Duplicate → `onDuplicate(note.id)`
  - Delete → `setDeleteOpen(true)`

### 4. `FolderItem.tsx`

- Convert the icon+name toggle from a `<button>` to a clickable `<div>`
  (`onClick={toggle}`, `cursor-pointer`) so an `<input>` can live inside it
  (input-in-button is invalid HTML). The **chevron stays a real `<button>`**, so
  keyboard expand/collapse is preserved.
- Replace the folder-name `<span>` with a controlled `InlineEdit`
  (`value={folder.name}`, `onSave={(name) => onRenameFolder(folder.id, name)}`,
  `editing={renaming}`, `onEditingChange={setRenaming}`).
- Add `renaming` state and a `useDeferredMenuAction()`; set `onCloseAutoFocus`
  on both menus. Route items through `run(...)`:
  - Rename → `setRenaming(true)`  (replaces the `prompt()`)
  - New Note Inside → `setNewNoteOpen(true)`
  - New Subfolder → existing `prompt()` for the name (unchanged — this is
    creation, not rename; out of scope)
  - Delete → `setDeleteOpen(true)`

## Boundaries / data flow

- Hook owns "when"; the parent components own "what"; `InlineEdit` owns the
  editing UI.
- The `onRename` / `onRenameFolder` / `onDuplicate` / `onMove` / `onDelete`
  callbacks and the `MoveToFolderDialog` / `NewNoteDialog` / `AlertDialog`
  components are unchanged — no upstream ripple.

## Verification (manual, mobile viewport)

For a **note row** and a **folder row**, from **both** the 3-dot menu and
right-click:

- Rename → name becomes an input, `Enter` saves, `Esc` cancels, clicking the
  input does not open the note / toggle the folder.
- Move to Folder (note) → dialog opens and a move completes.
- Duplicate (note) → a copy appears.
- New Note Inside (folder) → dialog opens and a note is created.
- Delete → confirmation modal opens and deletes on confirm.

Desktop unchanged: dots fade in on hover; double-click-to-rename still works.
