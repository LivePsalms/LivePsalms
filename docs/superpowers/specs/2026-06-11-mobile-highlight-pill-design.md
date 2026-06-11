# Spec: Mobile Highlight Pill (notepad editor)

**Date:** 2026-06-11
**Status:** Approved design — ready for implementation plan.
**Supersedes:** `docs/superpowers/specs/2026-06-11-mobile-highlight-toolbar-button-design.md` (the toolbar-button approach this replaces).
**Base `main` commit:** `325812f`

## Problem

On mobile, last session shipped a Highlight **toolbar button** that opens the swatch picker for the current selection. The user wants the highlights to live **in a floating pill near the selection**, not in the toolbar: select text, let the finger settle, and a pill appears just above the selection with the swatches inline.

The constraint that motivated the toolbar approach still holds: the picker must **never appear mid-drag** (it fought the selection gesture). The pill solves that with a settle debounce.

## Scope

- **Mobile only**, gated on `isBottomToolbar` (`toolbarPlacement === 'bottom'`).
- **Desktop is byte-for-byte unchanged.** Desktop keeps its existing auto-opening `HighlightSwatchPopover` anchored at the selection. On mobile, `swatchAnchor` stays `null` and the popover never renders.
- Frontend only. Ships via the normal Vercel deploy on `main` push. No `supabase/functions/**`.

## Behavior

1. **Settle, not drag.** While the selection range is changing, the pill is hidden. ~250ms after the range stops changing (finger up / selection settled), the pill appears above the selection.
2. **Range-unchanged is a no-op.** If `selectionUpdate` fires with the same range (e.g. a highlight mark was just applied), do nothing — prevents flicker.
3. **Collapse hides.** When the selection collapses (`from === to`), clear any pending timer and hide the pill.
4. **Content.** The pill is a single horizontal-scrolling row: a remove (✕) chip followed by the highlight swatches. **No search field.**
5. **Apply / remove.** Tapping a swatch applies it via `editor.chain().focus().setStyleHighlight(id).run()`. Tapping the ✕ chip removes via `unsetStyleHighlight()`.
6. **Dismiss.** A `pointerdown` outside the pill closes it (mirrors the existing popover's outside-dismiss).

## Design

### A. Remove last session's toolbar button

In `src/notepad/components/Editor.tsx`, delete:
- The `isBottomToolbar &&` Highlight `ToolbarButton` block (the `<div ref={highlightBtnRef} className="relative">…</div>`, currently lines 433–443, placed just before the Decorate/Sparkles button).
- The `openHighlightSwatch` handler (currently lines 118–125).
- The `highlightBtnRef` ref (line 114).
- The `hasSelection` state (line 113) — becomes unused.

### B. Debounced "settle" detection

In the mobile branch of the `selectionUpdate` effect (currently the `if (isBottomToolbar) { … }` block, lines 131–142):

- Add two refs: `pillTimerRef` (holds the `setTimeout` id) and `pillRangeRef` (holds the `{ from, to }` currently shown or pending).
- Add state: `pillAnchor` (`{ top?: number; bottom?: number; left: number } | null`).
- On each `selectionUpdate` in the mobile branch:
  - If `from === to` (collapsed): clear `pillTimerRef`, set `pillAnchor` to `null`, clear `pillRangeRef`, return.
  - If the range is **unchanged** vs `pillRangeRef` (`from`/`to` both equal): no-op, return (prevents flicker after a mark applies).
  - Otherwise (range changed, non-empty): update `pillRangeRef` to the new range, `setPillAnchor(null)` (hide while moving), clear the existing timer, and start a ~250ms timer. When it fires: recompute `editor.view.coordsAtPos(from)` and set `pillAnchor` (positioning below).
- Clear `pillTimerRef` in the effect cleanup.

Desktop branch (the `from === to` / `coordsAtPos` path below it) is untouched.

### C. New component `src/notepad/components/HighlightPill.tsx`

Mobile-only, self-contained.

- **Props:** `assets: StyleAsset[]`, `anchor: { top?: number; bottom?: number; left: number }`, `onPick: (id: string) => void`, `onRemove: () => void`, `onClose: () => void`.
- Renders a `position: fixed` pill at `anchor`. `zIndex` above editor content (match/exceed the popover's `60`).
- Content: a remove ✕ chip, then a **horizontal-scroll row** of swatch buttons. Reuse `filterAssets(assets, 'highlight', '')` and the `<img src={a.thumbUrl} alt="" …>` swatch pattern from `HighlightSwatchPopover.tsx`. Row scrolls horizontally (`overflowX: 'auto'`, `scrollbar-hide`) because there are many `category: 'highlight'` swatches in `src/notepad/styles/manifest.ts`.
- Each swatch `aria-label={`Highlight ${a.id}`}`; remove chip `aria-label="Remove highlight"`. Root `role="dialog"` / `aria-label="Highlight swatches"`.
- Outside `pointerdown` → `onClose` (same effect pattern as the popover).

### D. Positioning (computed in Editor where `coordsAtPos` is available)

Compute the anchor at timer-fire time from `editor.view.coordsAtPos(from)`:
- **Above the selection (default):** `bottom = window.innerHeight - coords.top + 6`, `left = coords.left`.
- **Fallback below** if the selection is near the top of the viewport (e.g. `coords.top < PILL_ESTIMATED_HEIGHT + margin`): `top = coords.bottom + 6`.
- **Clamp `left`** so the pill stays within the viewport horizontally.

`HighlightPill` consumes a ready-made `{ top?, bottom?, left }` anchor and just applies it — positioning math lives in `Editor.tsx` (it owns `editor`/`coordsAtPos`), the component stays presentational.

### E. Wiring

- Render `<HighlightPill assets={…} anchor={pillAnchor} onPick={…} onRemove={…} onClose={…} />` when `isBottomToolbar && pillAnchor`.
- `onPick(id)` → `editor.chain().focus().setStyleHighlight(id).run()` then hide the pill (`setPillAnchor(null)`).
- `onRemove()` → `editor.chain().focus().unsetStyleHighlight().run()` then hide.
- `onClose()` → `setPillAnchor(null)`.
- Desktop `swatchAnchor` / `HighlightSwatchPopover` path stays verbatim; `swatchAnchor` stays `null` on mobile.

### F. Revert the dead `bottom?` anchor (decision)

Last session added an optional `bottom?` anchor to `HighlightSwatchPopover` plus `HighlightSwatchPopover.anchor.test.tsx`. Once the toolbar button is removed, only desktop uses that popover (top-anchored), so the `bottom?` path is dead code.

**Decision: revert.** Restore `HighlightSwatchPopover.tsx`'s `Anchor` interface and `style` to their original top-only shape (drop `bottom?`), and **delete** `src/notepad/components/HighlightSwatchPopover.anchor.test.tsx`. Verify nothing else references the `bottom?` field before removing it.

## Testing

- **Replace** `src/notepad/components/Editor.mobile-highlight.test.tsx` (currently tests the toolbar button) with pill tests. Reuse the `fakeEditor` mock + `act()` wrapper from that file. Drive the debounce with `vi.useFakeTimers()`.
  - Non-empty selection does **not** immediately render the pill.
  - Advancing ~250ms renders the pill.
  - Collapsing the selection hides the pill.
  - Tapping a swatch calls `setStyleHighlight` with the swatch id.
  - Tapping the ✕ chip calls `unsetStyleHighlight`.
  - No `[title="Highlight"]` toolbar button exists in the mobile toolbar.
  - Desktop (`toolbarPlacement` ≠ `'bottom'`) renders no pill.
- Optional small unit test for `HighlightPill` render/positioning (applies `top` vs `bottom` from the anchor; renders remove chip + swatches).
- **Do NOT** extend the stale `Editor.toolbar-placement.test.tsx` (pre-existing red baseline).

## Constraints / baseline

- React 19 → wrap direct listener invocations and timer flushes in `act()` (state set outside `act` won't flush).
- Tests run with `npx vitest run <file>`.
- Known-red baseline: ~114 lint errors, tsc errors only in `force-sphere.test.ts`, pre-existing failing `Editor.toolbar-placement` + `garden-scene`. Goal: **zero NEW failures**, not a green repo.
- Optional manual verification: live DevTools touch-drag at 375px on `/notepad/notes` (signed-out local mode) to confirm settle timing and positioning, which jsdom can't fully cover.

## Out of scope

- Search/filter within the pill.
- Any desktop change.
- Changes to the highlight swatch manifest or the `setStyleHighlight`/`unsetStyleHighlight` commands themselves.
