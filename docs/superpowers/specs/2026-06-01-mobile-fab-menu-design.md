# Mobile FAB Expanding Menu — Design Spec

**Date:** 2026-06-01
**Status:** Approved (design)
**Scope:** Mobile notepad workspace only

## Problem

On mobile, the gold circular **+** button in
[`MobileNotesView.tsx`](../../../src/components/sections/notepad/mobile/MobileNotesView.tsx)
creates a `devotion` note immediately and jumps to the editor. We want it to
instead present a small menu offering two actions: **New note** and
**Upload note**.

This is mobile-only by construction — the button lives inside the mobile
workspace tree and is never rendered on desktop, so no additional `useIsMobile`
gating is required.

## Behavior

Tapping **+** opens an **expanding FAB menu** (the pattern from the user's
reference `FloatingActionMenu`):

- The trigger rotates `+` → `×` (spring).
- Two option pills fade/slide/blur in, stacked above the trigger, top-to-bottom:
  1. **New note** — pencil icon.
  2. **Upload note** — upload-arrow icon.
- The menu dismisses on: selecting an option, tapping **+** again, tapping the
  backdrop, or pressing **Escape**.

### New note
Unchanged from today: calls the existing `onNewNote` callback, which runs
`createNote('root', 'devotion')` and switches the workspace to the editor tab.

### Upload note
Opens the **native file picker** (a hidden `<input type="file" multiple>` with
`accept=".md,.txt,.pdf,.docx"`). On file selection, the workspace runs the
existing import pipeline with default options:

- `folderId: 'root'`
- `autoDetectVerses: true`
- `autoCreateLinks: false`

After import the workspace stays on the **notes** tab so the newly imported
notes appear in the list.

### Upload feedback
While files are parsing (PDF/DOCX parsing is async and can take a moment), the
FAB trigger shows a small spinner and is disabled. It resets to the normal `+`
once import completes. No other progress UI.

## Components & data flow

### 1. `MobileFabMenu.tsx` (new)
Location: `src/components/sections/notepad/mobile/MobileFabMenu.tsx`

Self-contained, presentational. Owns:
- open/closed state,
- framer-motion animations (trigger rotation, pill enter/exit, backdrop fade),
- the option pills,
- a full-screen transparent backdrop for tap-outside dismiss,
- a hidden `<input type="file">` and the click-to-open wiring,
- a `busy` state for the spinner while an upload is in flight.

Props:
```ts
interface MobileFabMenuProps {
  onNewNote: () => void;
  /** Receives the selected files; resolves when import finishes. */
  onUploadFiles: (files: File[]) => void | Promise<void>;
}
```

Visual style matches the app, not the dark reference palette:
- Trigger: gold `#b8843a`, white icon, 52×52, `rounded-full`, `shadow-lg`,
  positioned exactly where the current button sits
  (`bottom: calc(72px + env(safe-area-inset-bottom)); right: 16px`).
- Pills: `--plaster` background, `--deep-umber` text/icon, `Outfit` font,
  `rounded-full`, subtle border/shadow.

Accessibility & motion:
- Trigger `aria-label` toggles ("New note menu" / "Close menu") and exposes
  `aria-expanded`.
- Each option is a real `<button>` with an `aria-label`.
- **Escape** closes the menu.
- Respects `prefers-reduced-motion` via framer-motion's `useReducedMotion`:
  when reduced, drop the blur/slide/spring and use a plain opacity fade.

### 2. `MobileNotesView.tsx` (edit)
Replace the inline `<button aria-label="New note">` with `<MobileFabMenu>`.
Add an `onUploadFiles: (files: File[]) => void | Promise<void>` prop to
`MobileNotesViewProps`, passed straight through to `MobileFabMenu` alongside the
existing `onNewNote`.

### 3. `MobileNotepadWorkspace.tsx` (edit)
Add a `handleUploadFiles` callback that:
1. calls the shared `filesToNotes(files, { folderId: 'root', autoDetectVerses: true })` helper,
2. awaits `actions.importNotes(notes)`,
3. leaves `tab` on `'notes'`.

Pass `onUploadFiles={handleUploadFiles}` into `<MobileNotesView>`.

## Refactor (DRY)

The parse → build → (optional) link orchestration currently lives inline in
`UploadModal.handleUpload`
([`UploadModal.tsx:85-113`](../../../src/notepad/components/UploadModal.tsx)).
Extract it into a pure helper in
[`document-importer.ts`](../../../src/notepad/import/document-importer.ts):

```ts
export interface FilesToNotesOpts {
  folderId: string;
  autoDetectVerses?: boolean;
  autoCreateLinks?: boolean;
}

export async function filesToNotes(
  files: File[],
  opts: FilesToNotesOpts,
): Promise<Note[]>;
```

It performs the `Promise.all(parseFile)` → `buildNoteFromText` map → optional
`linkNotesByVerses` pass, returning the `Note[]` ready for `importNotes`.
Both `UploadModal` and the new mobile flow call it, so there is a single import
code path. `UploadModal` keeps ownership of `importNotes`, the UI state, and the
modal close.

## Testing

- **`filesToNotes`** (unit): `.txt`/`.md` files produce the expected note count,
  titles (filename without extension), and `folderId`; the `autoDetectVerses`
  flag toggles verse tags. (PDF/DOCX parsing stays untested — DOM/dynamic-import
  coupled, as documented in `document-importer.ts`.)
- **`MobileFabMenu`** (component):
  - tapping **+** reveals both options and sets `aria-expanded`;
  - **New note** fires `onNewNote` and closes;
  - selecting a file fires `onUploadFiles` with the `File[]`;
  - backdrop tap and **Escape** close the menu;
  - reduced-motion path renders both options without the spring/blur.

## Out of scope

- Desktop behavior (the desktop sidebar's `NewNoteDialog` is untouched).
- Changing the upload import pipeline itself or `UploadModal`'s full options UI.
- Note-type selection on mobile (New note stays devotion-by-default).
