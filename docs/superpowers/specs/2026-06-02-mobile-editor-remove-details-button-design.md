# Remove Redundant 3-Dots "Note Details" Button (Mobile Editor)

**Date:** 2026-06-02
**Status:** Approved (design)

## Problem

On mobile, the editor tab header shows a 3-dots ("Note details") button next to
the Account/avatar button. Tapping it opens `MobileMoreSheet` (Backlinks / Info
/ Graph). The bottom tab bar's "More" tab opens the **same** sheet via the same
`setMoreOpen(true)` call. The 3-dots button is therefore redundant with the More
tab, which is present on every tab including the editor.

## Goal

Remove the 3-dots "Note details" button from the mobile editor header. The right
side of the header keeps only the Account/avatar button. No functionality is
lost — `MobileMoreSheet` remains reachable via the bottom "More" tab.

## Scope

- **In scope:** the 3-dots button in `MobileEditorView`, its now-unused
  `onOpenDetails` prop, and the prop pass from `MobileNotepadWorkspace`.
- **Out of scope:** the bottom "More" tab, `MobileMoreSheet` itself, the
  Notes-tab header, and desktop — all untouched. `setMoreOpen` / `moreOpen` /
  the `<MobileMoreSheet>` render stay (still used by the More tab).

## Redundancy confirmation

- `MobileEditorView` 3-dots button (`aria-label="Note details"`) →
  `onOpenDetails` → (workspace) `setMoreOpen(true)` → `MobileMoreSheet`.
- Bottom tab bar "More" tab → `handleSelectTab('more')` → `setMoreOpen(true)` →
  the same `MobileMoreSheet`.

Both paths open the identical sheet, so removing the 3-dots removes a duplicate
entry point only.

## Changes

### 1. `MobileEditorView.tsx`

- Delete the `MoreHorizontal` "Note details" `<button>` from the header.
- Remove `MoreHorizontal` from the `lucide-react` import (keep `User`).
- Remove the `onOpenDetails: () => void` prop from `MobileEditorViewProps` and
  from the destructured params — it has no remaining use.
- The right-side `<div className="flex items-center gap-1">` now contains only
  the Account button (left as-is; the wrapper is harmless and keeps spacing
  consistent).

### 2. `MobileNotepadWorkspace.tsx`

- Remove `onOpenDetails={() => setMoreOpen(true)}` from the `<MobileEditorView>`
  render in the `tab === 'editor'` block.
- Leave `moreOpen`, `setMoreOpen`, `handleSelectTab`, and the
  `<MobileMoreSheet open={moreOpen} ... />` render unchanged (the More tab still
  uses them).

### 3. Tests — `MobileEditorView.test.tsx`

- Remove the test `opens details when the ⋯ button is tapped`.
- Remove `onOpenDetails` from every `MobileEditorView` render in the file.
- Add an assertion that the editor header no longer renders a "Note details"
  button (e.g. `expect(screen.queryByLabelText('Note details')).toBeNull()`).
- The FAB tests and the bottom-toolbar-placement test remain unchanged (aside
  from dropping the `onOpenDetails` prop).

## Testing

**`MobileEditorView` (component):**
- The "Note details" button is absent (`queryByLabelText('Note details')` is
  null).
- Existing behavior preserved: editor renders with `toolbarPlacement="bottom"`;
  the New-note FAB shows when `hasActiveNote={false}`, is absent when `true`,
  and calls `onNewNote` on tap.

**Verification:** `tsc -b --noEmit` clean (confirms no dangling `onOpenDetails`
references), the editor-view test file passes, and ESLint is clean on the two
touched source files (no unused `MoreHorizontal` import / unused param).

## YAGNI notes

- Fully remove the `onOpenDetails` prop rather than keeping it optional — the
  only caller is the workspace, which also drops it.
- No replacement affordance is added; the More tab already covers it.
