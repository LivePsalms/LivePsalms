# Mobile Tile Wipe Direction Alternation

**Date:** 2026-05-29
**Component:** `src/components/sections/MobileProjectTile.tsx`
**Scope:** Alternate the image curtain-wipe direction per tile so even-index tiles wipe left-to-right and odd-index tiles wipe right-to-left.

## Goal

Add per-tile alternation to the existing left-to-right curtain wipe so the eye is pulled in the direction of the text anchor on each tile. Even-index tiles (text bottom-left) keep the current LTR wipe. Odd-index tiles (text bottom-right) flip to RTL — image reveals from the right edge inward to the left. Creates a rhythmic zig-zag across the section.

## Why

The current uniform LTR wipe is asymmetric against the alternating text anchor — on odd tiles where text sits bottom-right, the image curtain wipes away from the text, which puts the eye on the side where there's no caption. Reversing the wipe direction on odd tiles pulls the eye in the same direction as the text settles, so the image and text resolve on the same side. The overall rhythm reads as the curtain bouncing back and forth across the page, matching the alternation of text anchor.

## Motion change

In `MobileProjectTile.tsx`:

- Derive a `wipeDirection: 'ltr' | 'rtl'` from `index`:
  ```ts
  const wipeDirection: 'ltr' | 'rtl' = index % 2 === 0 ? 'ltr' : 'rtl';
  ```
- Rename `imageInsetRight` to `imageInsetValue` (it's a 100→0 scalar; the side it applies to depends on direction).
- Update `imageClipPath` to flip the inset side:
  ```ts
  const imageClipPath = useTransform(
    imageInsetValue,
    (v) => wipeDirection === 'ltr'
      ? `inset(0 ${v}% 0 0)`   // clipped from right, unveils left→right
      : `inset(0 0 0 ${v}%)`   // clipped from left, unveils right→left
  );
  ```
- Add `data-wipe-direction={wipeDirection}` on the `tile-image` motion.div for testability.

Everything else stays unchanged:
- Trigger range `['start 50%', 'end 50%']`.
- Image clip + opacity progress range `[0, 0.85]`.
- Text drop motion (translateY from -60, blur 14, opacity 0→1 over `[0.2, 0.95]`).
- Easing `cubicBezier(0.22, 1, 0.36, 1)`.
- One-way latch via `useMotionValue` + `useMotionValueEvent`.
- `prefers-reduced-motion` short-circuit.
- Text anchor alternation (`data-text-anchor` on text wrap).

## Alignment with text anchor

| Index | Text anchor | Wipe direction |
|---|---|---|
| 0 | left | LTR |
| 1 | right | RTL |
| 2 | left | LTR |
| 3 | right | RTL |
| ... | ... | ... |

Both attributes derive from `index % 2 === 0`. They are always in lockstep.

## Tests

`src/components/sections/MobileProjectTile.test.tsx`:

- **Existing test** `"renders the initial (fully right-clipped) image state at scroll progress 0"` — passes unchanged. It renders at index 0 which still maps to LTR (right-clipped initial state).
- **New test**: `"renders the initial (fully left-clipped) image state at index 1"` — at index 1, the initial clip-path is `inset(0 0 0 100%)` (clipped from left, ready to unveil right→left).
- **New test**: `"exposes data-wipe-direction reflecting the per-index wipe pattern"` — index 0 → `'ltr'`, index 1 → `'rtl'`.

All other tests (content, fallback, click, aria-label, alternation by tile-order, alternation by text-anchor, motion presence/absence, reduced-motion) unchanged.

## Files touched

- **Modified**: `src/components/sections/MobileProjectTile.tsx` (motion derivation + JSX attribute).
- **Modified**: `src/components/sections/MobileProjectTile.test.tsx` (two new tests).

## Risk

Minimal. One derived value + a ternary in the existing clip-path transform. No structural changes, no new dependencies, no other component touched. Existing motion choreography, latch, reduced-motion fallback are all unchanged.

## Out of scope

- Any change to the text drop direction (text always drops from above; doesn't flip per tile).
- Any change to the trigger range or progress ranges.
- Any change to non-tile components or section chrome.
- Desktop: untouched.
