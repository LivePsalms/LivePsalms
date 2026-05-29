# Mobile Tile Intro Motion Retune — Design

**Date:** 2026-05-29
**Component:** `src/components/sections/MobileProjectTile.tsx`
**Scope:** Replace the current scroll-driven reveal choreography on mobile project tiles with the reference code's left-to-right curtain wipe + text-drop-from-above pattern. Bolder magnitudes and a later trigger start so the reveal reads as an intentional intro rather than a subtle settle.

## Goal

Switch the per-tile reveal animation from the current vertical clip-path + blurred text fade (Task 3) to the reference's choreography: horizontal left-to-right curtain wipe on the image, text translating from `-50px` (above) to `0`. Stretch the scrub progress ranges so the motion takes longer to complete, and push the trigger start point further into the viewport so the tile becomes ~40% visible before any motion begins.

## Why

The current reveal is subtle to the point of being missable — text moves only 20px, blur clears from a modest 6px, and the trigger fires while the tile is still peeking in from the bottom. After looking at it in the browser, the intro reads as a settle, not an intro. The reference code's choreography (horizontal curtain + text drop from above) is more overtly cinematic, and the bolder magnitudes plus a later trigger make the moment feel intentional. Removing the text blur is a deliberate simplification — the curtain wipe + 50px drop carry the motion on their own, and blur on top of those reads as over-decoration.

## Motion spec

### Trigger range
`useScroll({ target: tileRef, offset: ['start 60%', 'start 5%'] })`

- Progress 0 when the tile's top edge is 60% from the top of the viewport (i.e., the tile has come 40% into view).
- Progress 1 when the tile's top edge is 5% from the top of the viewport.
- Window length: 55% of viewport height (preserves the previous window length while shifting it ~25% later).

### Image
- **Clip-path**: interpolates `inset(0 100% 0 0)` (fully clipped from the right; image invisible) → `inset(0 0% 0 0)` (fully visible). Reveals **left to right** like a curtain.
- **Opacity**: `0 → 1`.
- **Progress range for both**: `[0, 0.75]` (clip + opacity in lockstep).

### Text column
- **Opacity**: `0 → 1`.
- **TranslateY**: `-50px → 0`. Text drops down into place from 50px above its final position.
- **No blur.** The previous `filter: blur(6px) → blur(0)` is removed entirely.
- **Progress range**: `[0.15, 0.85]`. Text starts moving slightly after the image begins its wipe and finishes notably after the image — reinforces the read of "image first, then text settles."

### Easing
Unchanged: Framer Motion `cubicBezier(0.22, 1, 0.36, 1)` on every `useTransform`.

### One-way latch
Unchanged. The existing `latchedProgress = useMotionValue(0)` + `useMotionValueEvent` that ratchets progress monotonically stays in place — scrolling back up past a revealed tile still does not reverse the animation.

### `prefers-reduced-motion`
Unchanged. The `reduced` short-circuit still renders the tile at its final state with no inline motion styles (no clip-path, no transform). Identical to the current implementation's reduced-motion branch.

## Files touched

- **Modified**: `src/components/sections/MobileProjectTile.tsx`
  - Trigger offset values (one line).
  - Five `useTransform` calls retuned: rename `imageInsetBottom` → `imageInsetRight` (or equivalent), change the `imageClipPath` interpolator to write `inset(0 ${v}% 0 0)`, change `imageOpacity` range, change `textOpacity`/`textY` ranges and the `textY` output domain to `[-50, 0]`.
  - **Delete** the `textBlurPx` and `textFilter` `useTransform`s and remove `filter: textFilter` from the text column's `style` prop.

- **Modified**: `src/components/sections/MobileProjectTile.test.tsx`
  - Update the "initial fully-clipped image state" test: asserted value changes from `'inset(0 0 100% 0)'` to `'inset(0 100% 0 0)'`.
  - Update the "applies an initial clip-path/blur when reduced motion is not set" test:
    - Rename to `"applies an initial clip-path when reduced motion is not set"`.
    - Remove the `expect(textCol.style.filter).not.toBe('')` assertion (there is no filter anymore).
    - Keep the `expect(imageWrap.style.clipPath).not.toBe('')` assertion.
  - The reduced-motion "renders no clip-path or blur" test already asserts absence — it remains valid with no implementation changes needed.

## What does NOT change

- Tile structure (the `<button>` shell, the two columns, the testids, the aria-label).
- Alternation logic (`order` based on `index % 2`).
- Content rendering (eyebrow, title, scripture, fallback chain).
- The one-way latch.
- Section chrome (watermark, FilterTabs, section fade).
- Desktop `DesktopMosaic` — entirely untouched.

## Risk

Negligible. The change retunes five `useTransform` calls, deletes two, swaps a clip-path direction, and shifts a trigger range. No structural changes, no new dependencies, no new accessibility surface, no new tests to add beyond updating the two assertions above. Behavior at progress 0 (start) and progress 1.0 (end) is identical to the previous implementation in terms of presence/absence; only the intermediate interpolation and the trigger window position change.

## Out of scope

- Adjusting motion on the desktop hover overlay.
- Any change to the reduced-motion fallback semantics.
- Any change to the latch mechanism.
- Cascade / stagger between adjacent tiles (each tile's reveal is independent of its neighbors, as it is today).
