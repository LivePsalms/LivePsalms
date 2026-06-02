# Dock logo tap sparkle — design

**Date:** 2026-06-01
**Status:** Approved (design)
**Scope:** Mobile-only microinteraction on the floating bottom-dock logo tile.

## Summary

When the user taps the floating bottom-dock logo tile on mobile, a brief sparkle
fires from the tile: a thin water-ripple ring plus ~8 warm-white embers that
ignite just above the tile and drift upward, fading out. The motion echoes the
existing loading animation (`HeroLoadingOverlay`), which dissolves the brand "A"
into rising specks — this is that vocabulary at micro scale.

Navigation is unchanged: the tile still links to `/`. The dock is a persistent
`fixed` element rendered at the app root (outside `<Routes>`), so it does not
unmount on navigation and the effect plays in place over any route change.

## Target element

The logo tile in the floating bottom dock:

- `src/components/layout/MobileBottomDock.tsx`, the `.dock-home` `<Link to="/">`
  (currently lines 113–123).

This is the only "nav bar logo tab." The two mobile workspace header logos
(`MobileNotesView`, `MobileEditorView`) are explicitly **out of scope** — they
call `onExit` and unmount immediately, and the user scoped this to the dock.

## Visual specification

Confirmed via the visual brainstorming companion (variant "Ripple + ember",
"Subtle" intensity, white-ish color matching the loader):

- **Ripple ring:** one ring, `2px solid` warm-white, soft outer glow. Animates
  from `scale(0.3)` at `opacity ~0.8` to `scale(4)` at `opacity 0` over ~900ms,
  easing `cubic-bezier(0.22, 0.61, 0.36, 1)`.
- **Embers:** ~8 small dots, 3.5–6px, radial-gradient fill
  (`#fffdf8` core → `#f6f4f0` → transparent) with a soft warm-white box-shadow
  glow (`0 0 7px 2px rgba(255,253,248,.95)` plus a faint
  `rgba(120,110,95,.4)` ring so they read on light backgrounds too).
  - **Origin:** ignite ~10px **above** the tile center (not at center) so they
    are never briefly hidden against the cream tile in the dark-section theme.
    Small random horizontal jitter (±8px) and vertical jitter (±4px) at origin.
  - **Motion:** rise by a randomized −34px to −56px with ±11px horizontal drift,
    opacity ramps 0 → 1 (by ~16% of the timeline) → 0, over a randomized
    850–1150ms with a randomized 0–150ms start delay. Easing
    `cubic-bezier(0.22, 0.61, 0.36, 1)`.
- **Color is fixed warm-white in both dock themes.** It reads on the default
  dark tile by contrast, and on the cream tile (dark page sections) via the glow
  plus igniting above the tile. No coupling to the dock's `data-bg` theme.

These exact numbers are the validated reference; minor tuning during
implementation is fine as long as the feel matches the approved mockup.

## Architecture

### New component: `src/components/layout/DockHomeSparkle.tsx`

A self-contained, presentational FX layer that mirrors the established
`src/components/ui-custom/WaterRipple.tsx` pattern (React-state-driven particles
that clean themselves up).

- Renders an absolutely-positioned, `aria-hidden`, `pointer-events: none` layer
  intended to sit inside the `.dock-home` tile.
- Holds an array of particle descriptors in state. Each descriptor carries its
  randomized values (size, end x/y, duration, delay) generated at spawn time.
- Renders each particle as a `<span>` whose randomized values are passed as
  inline CSS custom properties (`--ex`, `--ey`, `--dur`, etc.) consumed by the
  keyframes in `index.css`.
- Exposes an imperative `burst()` method via `useImperativeHandle` (forwarded
  ref). `burst()` is a **no-op when `prefers-reduced-motion` is set**, using the
  existing `usePrefersReducedMotion` hook
  (`src/notepad-landing/hooks/use-prefers-reduced-motion.ts`).
- Each particle removes itself from state `onAnimationEnd` (the longest of its
  ring/ember animations), so the DOM never accumulates nodes. A spawn generation
  id keeps concurrent bursts from colliding in state.

### CSS: `src/index.css`

Two `@keyframes` added next to the existing `water-ripple-ring-*` block:

- `dock-sparkle-ring` — `scale` + `opacity` for the ring.
- `dock-ember` — rise + fade: `translate(0,0)`/`opacity:0` → peak opacity →
  `translate(var(--ex), var(--ey))`/`opacity:0`, driven by per-particle custom
  properties so each ember drifts independently from one shared keyframe.

Reduced-motion is enforced in JS (the `burst()` no-op), so no particle is ever
spawned under reduced motion; no extra CSS guard is required, but the new
keyframes will not run because nothing mounts.

### Wiring: `src/components/layout/MobileBottomDock.tsx`

- The `.dock-home` `<Link>` becomes the positioning context: add
  `position: relative` and `overflow: visible` (via className/inline style) so
  the FX layer can paint above the tile without clipping.
- Render `<DockHomeSparkle ref={sparkleRef} />` inside the `<Link>`.
- In the `<Link>`'s `onClick`, call `sparkleRef.current?.burst()` before/alongside
  default navigation. Do **not** `preventDefault` — navigation proceeds normally.
- Mobile-only is already guaranteed by the dock's `if (!isMobile) return null`.

## Accessibility

- FX layer and all particles are `aria-hidden="true"` and `pointer-events: none`.
- The `<Link>`'s accessible name ("Home") and navigation are untouched.
- `prefers-reduced-motion: reduce` → no animation at all.

## Testing

New `src/components/layout/DockHomeSparkle.test.tsx`:

- Calling `burst()` renders particle nodes (assert count > 0).
- With `prefers-reduced-motion` matched, `burst()` renders no particles.
- Particles are removed after their animation ends (simulate `animationend`).

Extend `src/components/layout/MobileBottomDock.test.tsx`:

- Tapping the `.dock-home` tile still navigates to `/` (existing nav behavior
  intact) and the sparkle layer is present in the tile.

## Out of scope

- The mobile workspace header logos (`MobileNotesView`, `MobileEditorView`).
- Desktop. The dock is mobile-only.
- Any change to navigation behavior, the MENU panel, or dock theming.

## Dependencies / reuse

- Reuses `usePrefersReducedMotion` for the reduced-motion guard.
- Follows the `WaterRipple` particle/self-cleanup pattern for consistency.
- No new npm dependencies; CSS keyframes + the Web Animations-free, state-driven
  approach already used in the codebase.
