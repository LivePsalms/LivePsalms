# Purpose Stack — Snap to Panel Design

**Date:** 2026-05-21
**Surface:** `/purpose` route — `PurposeStack` section
**Builds on:** `2026-05-21-purpose-stack-infinite-loop-design.md`

## Goal

When the user stops scrolling mid-transition between two panels:
- if they're less than halfway through (frac < 0.5), the page auto-completes back to the current panel
- if they're more than halfway through (frac > 0.5), the page auto-completes forward to the next panel

The split-reveal animation drives itself to a clean resting state on the nearest panel boundary.

## Decisions (locked during brainstorm)

- **Speed / feel:** Cinematic — 700ms, `power2.inOut`. Matches the slow contemplative pacing of the rest of the page.
- **Reduced motion:** Snap still fires, but with `duration: 0` (instant scroll jump). Honors the OS-level no-motion preference while keeping the scrollbar position in sync with the snapped visual.

## Architecture

GSAP `ScrollTrigger.create()` accepts a `snap` config object. Add it to the existing pinned trigger in `PurposeStack.tsx`:

```ts
snap: {
  snapTo: 1 / (CYCLES * N),
  duration: reducedMotion ? 0 : 0.7,
  ease: 'power2.inOut',
  delay: 0.15,
  inertia: false,
  directional: false,
}
```

- `snapTo: 1 / (CYCLES * N)` — snaps `self.progress` (range 0..1) to the nearest multiple of `1 / 110`. Each multiple corresponds to an integer panel-step boundary in our `globalStep = progress * CYCLES * N` math. The "nearest" rule is exactly the half-meet rule the user requested.
- `duration` — 700ms for motion, 0 for reduced-motion.
- `ease: 'power2.inOut'` — smooth start, smooth finish; reads as "the page is settling on its own."
- `delay: 0.15` — small idle window after scroll stops. Prevents snap from fighting an active scroll gesture (e.g. mid-trackpad-swipe pause).
- `inertia: false` — ignore scroll velocity when picking the snap target. Use the resting position only.
- `directional: false` — snap to the nearest target regardless of the user's last scroll direction. (GSAP's default in current versions is `true`, which would force snap to always advance in the scroll direction even when the user is past the boundary; this would break the "stop before half = go back" behavior.)

## Why no other code changes

- The slot-swap math already handles arbitrary `frac` values. Post-snap `frac` settles to 0; slot A shows the resting devotion, slot B is off-screen with the next devotion pre-loaded. No code reads "did snap happen?" — it just sees the new progress and renders the right state.
- Pill morph fires at `frac` crossing 0.5. During a forward snap from `frac ≥ 0.5`, the pill has already morphed to the destination panel before the snap begins. During a backward snap from `frac < 0.5`, the pill is still on the source panel. Both end states are correct.
- The cycle wrap (seam between cycles K and K+1) is just another integer step boundary in progress space, so snap handles it identically — no special case.

## Acceptance criteria

1. Desktop: stop scrolling at `frac < 0.5` → page auto-scrolls back to the current panel over ~700ms.
2. Desktop: stop scrolling at `frac > 0.5` → page auto-scrolls forward to the next panel over ~700ms.
3. Snap holds across the cycle seam (e.g. stopping just past panel 11 → snap to panel 1 in the next cycle).
4. Mobile: same behavior as desktop.
5. `prefers-reduced-motion`: snap completes in 0ms (instant scrollbar jump) without animating the split-reveal halves any differently from before — they still snap-cut at frac=0.5.
6. Pill click navigation still works at the resting state and during a snap.

## Out of scope

- Snap with custom resistance / "rubber band" feel
- Snap targets that skip panels (e.g. "snap to every other panel")
- Disabling snap based on input device (e.g. mouse wheel vs trackpad)
