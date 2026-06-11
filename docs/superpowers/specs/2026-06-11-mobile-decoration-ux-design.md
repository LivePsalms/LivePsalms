# Mobile Decoration UX — Native-Feel Redesign

**Date:** 2026-06-11
**Status:** Approved (design), pending spec review
**Scope:** Mobile / coarse-pointer only. Desktop decoration interaction is unchanged.

## Problem

On mobile (`livepsalms.com` in iOS Safari), editing a decoration — the hand-drawn
rectangles, arrows, and freehand marks overlaid on note text — does not feel like a
native iOS experience. Five concrete failures, all confirmed against the current code
in [DecorationItem.tsx](../../../src/notepad/decorations/DecorationItem.tsx):

1. **Edit pill clips off-screen.** The per-decoration action bar is hard-pinned at
   `top:-34, left:0` (DecorationItem.tsx:284) with no viewport flip or horizontal
   clamp. Eight buttons in a row overflow a phone's width and render above the
   visible area when the decoration sits near the top.
2. **Rotation is twitchy.** The rotate handle sits only `-22px` above the box
   (DecorationItem.tsx:282) and maps finger-to-center angle 1:1 with no snapping
   (`applyRotationDrag`). A small wrist movement at that short radius produces a
   large rotation.
3. **Handles are too small for a finger.** The resize and rotate handles are 12px
   (`handleStyle`, DecorationItem.tsx:312) — well under Apple's 44px minimum touch
   target. Easy to miss, easy to grab the wrong one.
4. **Gestures fight each other.** `surfacePointerDown` starts a move and selects on
   the same pointer-down (DecorationItem.tsx:136-137), so a tap meant to select can
   nudge the decoration. Combined with the tiny handles, there is no clear mode.
5. **No clear way out.** Nothing reads as "I'm done — collapse this and get back to
   writing" beyond tapping empty space.

## Goals

- The selected-decoration experience on mobile feels like manipulating an object in
  Keynote / Apple Freeform: deliberate, forgiving, finger-sized.
- Zero regressions on desktop. All new behavior is gated behind the existing
  mobile/coarse-pointer signal.
- No new dependencies. Build on the existing pointer-event model and geometry helpers.

## Non-Goals

- Redesigning desktop decoration editing.
- Changing the decoration data model (`NoteDecoration` in
  [types.ts](../../../src/notepad/types.ts) stays as-is).
- Changing how decorations are created/inserted, or the asset manifest.

## Mobile Detection

Reuse the signal the Editor already computes: `isBottomToolbar` (Editor.tsx:78,
`toolbarPlacement === 'bottom'`). On mobile the editor toolbar is already pinned to
the bottom, so `isBottomToolbar === true` is our authoritative "this is the mobile
layout" flag. It is threaded down to `DecorationLayer` → `DecorationItem` as a
`mobile` boolean prop, and used in the Editor to decide whether to render the
contextual decoration toolbar.

> No `matchMedia` / `pointer: coarse` check is introduced — staying on the existing
> `toolbarPlacement` signal keeps a single source of truth for "mobile layout" and
> avoids two flags disagreeing.

## Design

### 1. Selection without accidental movement (drag threshold)

`surfacePointerDown` continues to select on pointer-down, but on mobile a **move is
not applied until the pointer travels past a 6px threshold** from the start point.
Below the threshold the gesture is treated as a tap (selection only). Track a
`movedEnough` flag in the existing gesture ref; `surfacePointerMove` only calls
`onChange(moveTo(...))` once the cumulative distance exceeds the threshold.

This removes the "tap to select also nudged it" failure. Desktop keeps its current
immediate-move behavior (threshold = 0).

### 2. Finger-sized handles (44px targets)

Replace the 12px handles with a **transparent 44px touch area wrapping a ~24px visual
handle** (white fill, 2px `--deep-umber` border, centered in the touch area).
`handleStyle` gains a `mobile` branch that returns the enlarged geometry; the visual
circle is a centered child so the larger hit area is invisible. Positions are
recomputed so the visual handle still sits on the box edge/corner.

Resize handles appear at **all four corners** on mobile (desktop keeps the single
bottom-right handle). Each corner resizes proportionally (width-driven, height follows
the asset aspect ratio) and **keeps the diagonally-opposite corner anchored** — i.e.
dragging the top-left handle holds the bottom-right corner fixed. This requires a new
geometry helper, `resizeFromCorner(base, { corner, dxPx, dyPx, contentWidth })`, in
[decoration-geometry.ts](../../../src/notepad/decorations/decoration-geometry.ts),
honoring the existing `MIN_WIDTH_PCT` / `MAX_WIDTH_PCT` clamps. The existing
bottom-right `resizeWidthPct` path is the corner=bottom-right case.

### 3. Rotation that doesn't fight back

Three changes, all mobile-gated:

- **Larger radius.** The rotate handle moves further out (`~-40px` above the box on
  mobile vs `-22px`). A longer lever means a given finger displacement turns the
  object through a smaller angle — the direct cause of the twitch.
- **Angle snapping.** Rotation snaps to the nearest multiple of 45° when within ±5°
  of it. Implemented as a pure `snapAngle(deg, { step: 45, threshold: 5 })` helper in
  decoration-geometry.ts, applied inside both the rotate-handle path
  (`applyRotationDrag` result) and the two-finger pinch path (`pinchTransform`
  rotation result) so both gestures snap identically.
- **Live angle readout.** While rotating, a small badge (e.g. `0°`) renders next to
  the handle showing the current snapped angle, so the user has feedback for precise
  alignment. The badge is only present during an active rotate gesture.

Two-finger pinch continues to scale **and** rotate together (the existing
`pinchTransform` path), now with the same snapping applied to its rotation output.

### 4. Contextual bottom toolbar (replaces the floating pill on mobile)

On mobile, the per-decoration floating action bar (DecorationItem.tsx:284-297) is
**not rendered**. Instead, while a decoration is selected, the Editor renders a
**contextual decoration toolbar that replaces the editor toolbar** at the bottom of
the screen, then swaps back to the editor toolbar on deselect. Because it is pinned to
the bottom edge (not anchored to the decoration), it can never clip off-screen.

- The Editor already owns `selectedDecoration` (id) and all handlers (`onChange`,
  `onDelete`, `onDuplicate`, `onBringToFront`, `onSendToBack`, `onDeselect`,
  Editor.tsx:596-603). It looks up the selected decoration object from
  `decorationsApi.decorations` to drive `flipH`/`flipV` toggles via
  `decorationsApi.update`.
- **Flat button row** (left → right): Flip-H, Flip-V, Send-to-back, Bring-to-front,
  Duplicate, Delete, **Done**. Seven targets fit a phone width at ≥44px each.
- The old **rotate ± 15° buttons are removed** — the rotate handle and two-finger
  gesture replace them. (Desktop keeps the rotate± buttons in its floating bar.)
- **Done** calls `onDeselect`. Tapping empty editor space still deselects via the
  existing `setSelectedDecoration(null)` path (Editor.tsx:571).
- The contextual toolbar respects the existing keyboard-lift offset used by the editor
  toolbar (the `toolbarPlacement='bottom'` keyboard offset) so it tracks the keyboard
  the same way.

### 5. Snap feedback (honest about iOS)

On each snap, fire visual feedback: the angle badge updates to the snapped value and
the rotate handle does a brief pulse. A guarded `navigator.vibrate?.(10)` is also
called for real haptics where supported (Android Chrome) — **iOS Safari does not
implement the Vibration API, so on iPhone the feedback is visual only.** The pulse
animation respects `prefers-reduced-motion` (no animation when reduce is set; the
badge value still updates).

## Architecture / Data Flow

```
Editor (owns selectedDecoration id + handlers + isBottomToolbar)
 ├─ renders contextual decoration toolbar  ◄── only when isBottomToolbar && selectedDecoration
 │     (Flip-H, Flip-V, Back, Front, Duplicate, Delete, Done)
 │     looks up decoration object from decorationsApi.decorations
 │
 └─ DecorationLayer (mobile prop = isBottomToolbar)
      └─ DecorationItem (mobile prop)
           - drag threshold (mobile)
           - 4 corner resize handles w/ 44px hit area (mobile) / 1 corner (desktop)
           - rotate handle: larger radius + snap + angle badge (mobile)
           - two-finger pinch: scale + rotate + snap
           - floating action bar rendered only when !mobile
```

New pure helpers in `decoration-geometry.ts` (unit-testable in isolation):

- `snapAngle(deg, { step, threshold })` — snaps to nearest step within threshold.
- `resizeFromCorner(base, { corner, dxPx, dyPx, contentWidth })` — proportional
  corner resize anchoring the opposite corner; clamped to MIN/MAX width.

## Error / Edge Cases

- **Decoration near the keyboard.** The contextual toolbar uses the same
  keyboard-lift offset as the editor toolbar, so it stays above the keyboard.
- **Decoration deleted while selected.** `onDelete` already clears
  `selectedDecoration`; the contextual toolbar unmounts and the editor toolbar
  returns.
- **Rotate then deselect mid-gesture.** Pointer capture + existing `rotateEnd`
  cleanup already handle pointer loss; the angle badge is gated on an active gesture
  so it disappears on end.
- **Two decorations / fast switching.** Selecting a different decoration updates
  `selectedDecoration`; the contextual toolbar re-reads the new decoration object.
- **jsdom in tests.** Existing `setPointerCapture` try/catch guards remain; new
  helpers are pure and tested without the DOM.

## Testing

Unit (geometry helpers, no DOM):
- `snapAngle` snaps within threshold, passes through outside it, handles wrap at 360°.
- `resizeFromCorner` anchors the opposite corner for each of the four corners and
  respects MIN/MAX width clamps.

Component (DecorationItem / Editor, jsdom + pointer events):
- Mobile: a sub-threshold pointer move selects without changing position; a move past
  threshold updates position.
- Mobile: floating action bar is **not** rendered; desktop: it **is**.
- Mobile: the Editor renders the contextual decoration toolbar when a decoration is
  selected and swaps back to the editor toolbar on Done/deselect.
- Rotate path applies snapping at cardinal angles; two-finger pinch applies the same
  snapping.
- Handle hit areas meet the 44px target on mobile.
- Desktop regression: existing single bottom-right resize handle and rotate± buttons
  still behave as before.

## Out of Scope / Follow-ups

- Per-step rotation fine-control (e.g. a long-press nudge) — not needed if snapping +
  larger radius lands well.
- Migrating `yPx` → `yPct` (uniform-zoom) is tracked separately in
  `2026-06-08-uniform-zoom-decorations-design.md` and is independent of this work.
