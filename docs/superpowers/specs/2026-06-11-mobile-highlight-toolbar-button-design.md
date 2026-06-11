# Design: Mobile highlight via toolbar button

**Date:** 2026-06-11
**Scope:** Mobile notepad editor only (`toolbarPlacement === 'bottom'`). Desktop (top toolbar) behavior unchanged.
**Status:** Approved in brainstorming. Ready for implementation plan.

## Problem

On mobile, in the notepad editor, the user cannot comfortably highlight full
words or sentences. The highlight-swatch popover (`HighlightSwatchPopover`)
auto-opens the instant a selection becomes non-empty and re-fires on every
`selectionUpdate`. On desktop a mouse drag is one quick gesture, so this feels
fine. On mobile, selection is extended incrementally via drag handles, so the
popover repeatedly pops over the text mid-selection and fights the drag, making
multi-word/sentence selection very hard.

## Root cause (verified)

The `selectionUpdate` effect at `src/notepad/components/Editor.tsx:111-132` runs
the same path on every platform. On any change where `from !== to` it sets
`swatchAnchor` (anchored at the selection *start*, so it overlaps the text being
selected), which renders the popover at `Editor.tsx:690-706`. There is no mobile
gating. Apply path: `onPick → editor.chain().focus().setStyleHighlight(id).run()`
(`Editor.tsx:696`); the mark is named `styleHighlight`
(`src/notepad/extensions/style-highlight.ts:52`).

## Decisions (from brainstorming)

- **Interaction model:** Manual affordance (iOS-like). On mobile the picker never
  auto-opens; the user opens it deliberately. Selection is never interrupted.
- **Affordance location:** A Highlight button in the existing sticky bottom
  toolbar — fixed, predictable, never overlaps text.

## Design

### 1. Behavior split in the `selectionUpdate` effect

Branch the existing effect on `isBottomToolbar` (`toolbarPlacement === 'bottom'`):

- **Desktop (`!isBottomToolbar`):** the current effect body runs verbatim —
  auto-anchors and opens the popover on every non-empty selection change. No
  behavior change.
- **Mobile (`isBottomToolbar`):** the effect no longer opens the popover. It
  tracks a new `hasSelection` state (`from !== to`) for the toolbar button, and
  when the selection collapses it closes any open picker (clears `swatchAnchor`,
  resets `swatchDismissed`, clears `dismissedRangeRef`).

`isBottomToolbar` is added to the effect dependency array. It is constant per
render, so the desktop branch re-subscribes identically.

Net effect: on mobile the popover can never appear mid-drag, because nothing in
the selection lifecycle opens it.

### 2. Mobile Highlight toolbar button

A new `ToolbarButton` (lucide `Highlighter` icon), rendered **only when
`isBottomToolbar`**, placed in the inline-formatting cluster after the Underline
button and before the Decorate button (`Editor.tsx:405`).

- **Enabled when:** `hasSelection || editor.isActive('styleHighlight')`. This
  allows applying a highlight to a fresh selection and removing/changing one when
  the caret sits inside an existing highlight. Otherwise the button is disabled
  (greyed, non-interactive), consistent with the existing disabled Undo/Redo
  buttons.
- **On tap:**
  1. Read the button's `getBoundingClientRect`.
  2. Set `swatchAnchor` to a bottom-anchored position above the toolbar, mirroring
     the heading-menu pattern (`Editor.tsx:303-321`): `bottom = window.innerHeight
     - rect.top + gap`, `left = rect.left`.
  3. Clear `swatchDismissed`.
  4. Set `swatchAutoFocus = false` so opening does not focus the search input and
     pop the soft keyboard.

The ProseMirror selection survives the toolbar tap (toolbar interaction does not
change `editor.state.selection`), so `onPick → chain().focus().setStyleHighlight()`
applies to the preserved range.

### 3. Popover anchoring (prop change)

The popover positions with `top`/`left` (top-anchored,
`HighlightSwatchPopover.tsx:80-84`). To dock it above the bottom toolbar without
overlapping the selection, extend the `Anchor` interface with an optional
`bottom?: number`, and apply whichever is set in the style (`top: anchor.top`,
`bottom: anchor.bottom`).

- Desktop passes `{ top, left }` → unchanged.
- Mobile passes `{ bottom, left }` → the popover sits above the toolbar.

The popover already renders outside the toolbar div with `position: fixed`, so it
is not clipped by the toolbar's `overflow-x` and needs no portal.

### 4. Out of scope

- No change to how highlights are applied or removed (`setStyleHighlight` /
  `unsetStyleHighlight` unchanged).
- No change to the popover's internal swatch grid, search, keyboard navigation, or
  outside-pointerdown dismissal.
- No desktop behavior change of any kind.

## Testing

New test file copying the `fakeEditor` mock from
`src/notepad/components/Editor.mobile-scroll.test.tsx` (do NOT extend the stale
`Editor.toolbar-placement.test.tsx`).

**Mobile (`toolbarPlacement='bottom'`):**
- A non-empty selection (`selectionUpdate` with `from !== to`) does NOT open the
  popover.
- The Highlight button is disabled with no selection and enabled with a non-empty
  selection.
- Tapping the enabled Highlight button opens the popover.
- Collapsing the selection (`from === to`) closes an open popover.

**Desktop (`toolbarPlacement='top'`):**
- A non-empty selection still auto-opens the popover (regression guard).
- No Highlight button is rendered.

Goal: zero NEW failures against the known-red baseline (~114 lint errors, tsc
errors only in `force-sphere.test.ts`, pre-existing failing
`Editor.toolbar-placement` and `garden-scene`). Verify with
`npx vitest run <new file>`. Manual check: Chrome DevTools touch-drag select at
375px on `/notepad/notes` (signed-out local mode), confirm no mid-drag popover and
that the toolbar button opens the picker above the toolbar.

## Conventions

- Mobile-only via `isBottomToolbar`; desktop path byte-for-byte unchanged.
- Frontend-only change; ships via normal Vercel deploy on `main`. No
  `supabase/functions/**` involved.
- Feature branch → merge to `main` → push.
