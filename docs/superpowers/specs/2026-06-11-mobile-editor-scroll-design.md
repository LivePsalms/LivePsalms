# Mobile Notepad Editor — Scroll Fix Design

**Date:** 2026-06-11
**Scope:** Mobile view only (the bottom-toolbar editor path). Desktop is untouched.

## Problem

On mobile, the notepad writing pad runs off the right edge of the screen and the
formatting toolbar runs off-screen with no way to reach the hidden buttons. Vertical
scrolling of long notes also feels broken.

## Root Cause

The shared TipTap editor ([`src/notepad/components/Editor.tsx`](../../../src/notepad/components/Editor.tsx))
renders as a flex **column** (`column-reverse` on mobile). Its width therefore equals
the width of its widest child.

The bottom toolbar is a single non-wrapping flex row of 12+ fixed-width buttons
(30px each, `ToolbarButton` at lines 667–695) plus dividers and `px-3` padding. Its
intrinsic width (~430px) exceeds a phone viewport (~375px). Because nothing constrains
or scrolls the toolbar, the whole editor column inflates to ~430px — dragging the
writing pad past the right edge with it. That horizontal overflow is what makes the
text appear cut off and breaks the feel of vertical scrolling.

The app-shell lock (`html.app-shell-locked { overflow: hidden }`, applied on notepad
routes) is correct and stays — all scrolling is meant to happen inside the editor's
inner `overflow-y: auto` container.

## Desired Behavior

- **Writing pad** (title, date, divider, note body, decoration layer): fits within
  the screen width, text wraps, scrolls **vertically only**, never horizontally.
- **Toolbar**: allowed to be wider than the screen; scrolls **horizontally** so every
  button is reachable. Buttons keep their size (no shrinking/squishing).
- Mobile only. Gated on `isBottomToolbar` (`toolbarPlacement === 'bottom'`), which is
  the mobile path. Desktop (top toolbar) is unchanged.

## Design

Three coordinated changes, all in `Editor.tsx`.

### 1. Toolbar — horizontal scroll (mobile only)

On the toolbar container (line ~206), when `isBottomToolbar`:

- `minWidth: 0` — allow the flex item to be narrower than its content.
- `overflowX: 'auto'` — buttons that exceed the width scroll left/right.
- Keep `flexWrap` as nowrap (single row).
- Buttons must not shrink: set `flexShrink: 0` on `ToolbarButton` and `ToolbarDivider`
  so they keep their 30px / divider width and the row stays scrollable rather than
  squishing. (Apply only when mobile, or unconditionally since fixed-width buttons
  shouldn't shrink on desktop either — desktop toolbar fits, so it's a no-op there.)
- Hide the horizontal scrollbar visually for a native feel (e.g. a `scrollbar-hide`
  utility / `::-webkit-scrollbar { display: none }`), keeping scroll functional.

This collapses the toolbar to viewport width and, as a side effect, stops it inflating
the editor column — which is what frees the writing pad.

### 2. Writing pad — clamp to screen, vertical only

- Editor root container (line ~203): add `width: '100%'`, `minWidth: 0`, and
  `maxWidth: '100%'` so the column can never exceed the viewport.
- Scroll content area (line ~348): keep `overflowY: 'auto'`; add `overflowX: 'hidden'`
  so the writing pad never scrolls horizontally even if some inner content is wide.
- Mobile horizontal padding: reduce from `2.5rem` (~40px) to ~`1.25rem` (~20px) when
  `isBottomToolbar`, giving text comfortable room on a narrow screen. Vertical padding
  unchanged.

### 3. Heading dropdown — portal to escape the scroll clip

Setting `overflowX: 'auto'` on the toolbar makes the computed `overflow-y` `auto` too,
which would vertically clip the heading dropdown (it opens **above** the toolbar via
`bottom-full`, lines 250–277).

Fix: render the heading dropdown **menu** through `createPortal` to `document.body`
with `position: fixed`, positioned from the trigger button's
`getBoundingClientRect()` so it sits directly above the button. The trigger button
stays in the toolbar; only the open menu is portaled out, so it escapes the scroll clip.

- Position: `bottom = viewportHeight - buttonRect.top + gap`, `left = buttonRect.left`,
  anchored above the button (matching current upward open).
- Recompute on open. Close on outside click / selection as today.
- The **Decorate tray** (`DecorationTray`, line 642) already renders at the editor's
  top level, outside the toolbar — unaffected, no change needed.

This is the only in-toolbar popover, so the portal change is small and isolated.

## Files Touched

- `src/notepad/components/Editor.tsx` — toolbar container styles, root/scroll-area
  styles, mobile padding, `ToolbarButton`/`ToolbarDivider` `flexShrink`, heading
  dropdown portal.
- Possibly `src/index.css` (or a Tailwind utility) for `scrollbar-hide` if no existing
  utility is available.

## Out of Scope

- Desktop editor layout.
- Decoration placement / off-canvas decorations (decorations should not sit beyond the
  screen edge; this design keeps content within screen width).
- Any change to the app-shell lock or viewport meta.

## Testing / Verification

- On a mobile viewport (~375px): toolbar scrolls horizontally and every button is
  reachable; writing pad text wraps within the screen and only scrolls vertically; a
  long note scrolls to the bottom; the heading dropdown opens fully visible above its
  button.
- Desktop editor unchanged (top toolbar still fits, no horizontal scroll, dropdown
  behaves as before).
