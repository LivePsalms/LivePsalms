# Purpose Stack — Infinite Loop Design

**Date:** 2026-05-21
**Surface:** `/purpose` route — `PurposeStack` section
**Builds on:** `2026-05-21-purpose-page-pinned-split-reveal-design.md` (full-bleed pinned panels)

## Goal

When the user scrolls past the last (11th) panel of `PurposeStack`, the stack continues cycling back to panel 1 with the same split-reveal motion — visually indistinguishable from any other panel-to-panel transition. The loop runs both directions and never ends.

## Decisions (locked during brainstorm)

- **Seam visual:** Same split-reveal animation. No marker, no flash. Panel 11→1 looks like any other transition.
- **Direction:** Bidirectional. Scrolling backward wraps panel 1→11 with the split-reveal running in reverse.
- **Coverage:** Loop applies on desktop AND mobile. Same motion treatment.
- **Reduced motion:** `prefers-reduced-motion` still loops (still infinite, still cycles through 11), but with no split-reveal animation — panels snap-cut on boundary.
- **Entry asymmetry (accepted):** From cold entry at scroll 0 the user is on panel 0. Scrolling up immediately exits the pin to the top of the page rather than wrapping to panel 10. After one downward scroll cycle this asymmetry resolves and reverse-scroll wraps normally. We accept this tradeoff to keep native scroll, scrollbar, and keyboard accessibility intact.

## Architecture: 2-Panel Swap with Modulo Scroll

The existing N-panel stack with growing z-index cannot deliver a seamless seam: at the cycle wrap point the timeline jumps from "panel N covering everything" to "panel 1 alone with all higher panels off-screen" — a hard cut.

The correct model is **two panel slots that swap roles at each boundary**:

- **Slot A** (background, lower z, fully visible)
- **Slot B** (foreground, higher z, halves slide in/out of view)
- At any moment: A shows the current devotion, B shows the next devotion (with halves at a partial reveal position determined by scroll progress)
- At each integer boundary cross, the two slots rotate their data so the user always sees visual continuity across the seam

This replaces the current "render N panels, scrub a long GSAP timeline" with "render 2 panels, drive halves per frame from scroll progress, swap data at boundaries."

### Constants

- `N` = number of panels (`projects.length`, currently 11)
- `K` = scroll multiplier (set to **10**) — pins the section for ~10 cycles of scroll distance (~7,400 viewport heights), plenty for any realistic session, well below browser scroll height limits
- `cycleLength` = `N` (was `N-1`; now we have N transitions per cycle including the wrap)

### Pinned ScrollTrigger

```ts
ScrollTrigger.create({
  trigger: wrapper,
  start: 'top top',
  end: () => `+=${K * cycleLength * window.innerHeight}`,
  pin: true,
  scrub: 0.6,
  invalidateOnRefresh: true,
  onUpdate: handleProgress,
})
```

`scrub: 0.6` is retained for the same smoothing feel as the existing implementation. No GSAP timeline is built — we drive halves directly in `onUpdate`.

### Progress → frame state

```ts
function handleProgress(self) {
  const globalStep = self.progress * K * cycleLength   // 0 .. K*N
  const intStep    = Math.floor(globalStep)
  const frac       = globalStep - intStep              // 0 .. <1

  const aIdx = ((intStep % N) + N) % N                 // safe modulo
  const bIdx = (aIdx + 1) % N

  // Update slot data only when the integer step changes
  if (intStep !== currentIntStepRef.current) {
    currentIntStepRef.current = intStep
    setSlotData(slotARef.current, pillDataPerPanel[aIdx])
    setSlotData(slotBRef.current, pillDataPerPanel[bIdx])
  }

  // Pill morphs based on which slot the user is mostly looking at
  const visibleIdx = frac < 0.5 ? aIdx : bIdx
  if (visibleIdx !== currentVisibleIdxRef.current) {
    currentVisibleIdxRef.current = visibleIdx
    pillRef.current?.morphTo(pillDataPerPanel[visibleIdx])
  }

  // Drive slot B halves per frame (frac=0 → off-screen, frac=1 → fully met)
  const lHalf = slotBRef.current?.querySelector('[data-ps-half="l"]')
  const rHalf = slotBRef.current?.querySelector('[data-ps-half="r"]')
  if (lHalf) gsap.set(lHalf, { yPercent: 100 * (1 - frac) })
  if (rHalf) gsap.set(rHalf, { yPercent: -100 * (1 - frac) })
}
```

### Why this works at the seam

- **Forward seam (intStep increments):** Just before the boundary, `frac` is near 1 — slot B is fully meeting (covering A). On increment, we re-assign A's data to what was B's, and B's data to the next devotion. Halves jump from frac≈1 to frac≈0 (off-screen). User saw slot B fully covering A with image X just before the swap; immediately after, slot A is showing image X (same pixels). No flash.
- **Reverse seam (intStep decrements):** Just before the boundary, `frac` is near 0 — slot B's halves are off-screen, A is fully visible with image X. On decrement, A's data becomes the previous devotion, B's data becomes what A was (image X). Halves jump from frac≈0 to frac≈1 (fully met). User saw slot A with image X just before; immediately after, slot B is fully covering A with the same image X. No flash.

Visual continuity is preserved across both directions because the "currently visible image" is always preserved across the data swap.

### `setSlotData` helper

Updates the background images on the left and right halves of a slot. Pure DOM style writes (no React state churn) for 60fps:

```ts
function setSlotData(slot: HTMLDivElement | null, data: PillData) {
  if (!slot) return
  const l = slot.querySelector<HTMLDivElement>('[data-ps-half="l"]')
  const r = slot.querySelector<HTMLDivElement>('[data-ps-half="r"]')
  if (l) l.style.backgroundImage = `url(${data.leftImage})`
  if (r) r.style.backgroundImage = `url(${data.rightImage})`
}
```

### Reduced-motion path

Same pinned ScrollTrigger and same modulo math, but no fractional half animation. `gsap.set` jumps slot B's halves to either fully met (`0`) or fully off-screen (`±100`) based on a threshold — e.g. snap to met when `frac > 0.5`, off-screen when `frac < 0.5`. This produces a hard cut on each boundary cross while still cycling through all 11 devotions infinitely. Pill morphs on `visibleIdx` change exactly as in the motion path.

In code this is the same `handleProgress` with a `prefersReducedMotion` branch that replaces the continuous `gsap.set(yPercent: 100 * (1 - frac))` with a discrete `gsap.set(yPercent: frac > 0.5 ? 0 : 100)`.

### Mobile

Per the C1 decision, mobile gets the same pinned motion treatment. The current `<= 768` early-exit in `useLayoutEffect` and the `useFallback` branch on width are removed. Only `prefersReducedMotion` routes to the reduced-motion variant.

### Pill click navigation

`handlePillActivate` reads `currentVisibleIdxRef.current` (0..N-1) and uses it to resolve `projects[i]` and `pillDataPerPanel[i]`. No further math. The pill expand transition continues to work as today.

### Resize

`invalidateOnRefresh: true` is set. The `end` getter recomputes from `window.innerHeight`. On refresh we also resync `setSlotData` for current `intStep` so the slots reflect the right images after any context loss.

## DOM Structure

Replaces the current `projects.map(...)` block inside `.ps-stage`:

```tsx
<div ref={stageRef} className="ps-stage relative w-full h-screen overflow-hidden">
  <div ref={slotARef} data-ps-slot="a" className="absolute inset-0 grid grid-cols-2 overflow-hidden" style={{ zIndex: 1 }}>
    <div data-ps-half="l" className="relative overflow-hidden will-change-transform" style={{ backgroundSize: 'cover', backgroundPosition: 'center' }} />
    <div data-ps-half="r" className="relative overflow-hidden will-change-transform" style={{ backgroundSize: 'cover', backgroundPosition: 'center' }} />
    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/15 pointer-events-none" />
  </div>
  <div ref={slotBRef} data-ps-slot="b" className="absolute inset-0 grid grid-cols-2 overflow-hidden" style={{ zIndex: 2 }}>
    <div data-ps-half="l" className="relative overflow-hidden will-change-transform" style={{ backgroundSize: 'cover', backgroundPosition: 'center' }} />
    <div data-ps-half="r" className="relative overflow-hidden will-change-transform" style={{ backgroundSize: 'cover', backgroundPosition: 'center' }} />
    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/15 pointer-events-none" />
  </div>
  <PurposeStackPill ref={pillRef} initial={pillDataPerPanel[0]} onActivate={handlePillActivate} />
</div>
```

Initial state set imperatively before pin attaches:
- Slot A: `pillDataPerPanel[0]`, halves at yPercent 0 (visible)
- Slot B: `pillDataPerPanel[1]`, halves at yPercent ±100 (off-screen)

## State refs

- `currentIntStepRef: number` — tracks the last applied integer step so slot swaps fire only once per boundary
- `currentVisibleIdxRef: number` — tracks the visible devotion index for pill morph and click handler

No React state changes during scroll — the slot data writes go through refs + direct DOM style writes to avoid re-render churn.

## File touchpoints

- `src/components/sections/PurposeStack.tsx` — full rewrite of the desktop motion path, removal of `FallbackStack`, replacement with `ReducedMotionStack` (or a `reducedMotion` branch in the same effect — TBD during implementation). Tests in `src/components/sections/purpose-stack-data.test.ts` are unaffected because the pill data shape doesn't change.

No new files. No new dependencies. The `purpose-stack-data.ts` module is unchanged.

## Acceptance criteria

1. On `/purpose` desktop: scrolling continuously down past the 11th panel reveals panel 1 via the same split-reveal — no visible seam, no flash.
2. After cycling one full revolution down, scrolling back up wraps panel 1 → panel 11 with the split-reveal reversed — also seamless.
3. Pill text/color/glyph morph cycles through all 11 panels indefinitely in both directions, switching at the half-meet point of each transition.
4. Mobile (≤768px) exhibits identical behavior to desktop.
5. With `prefers-reduced-motion: reduce`, panels snap-cut on boundary cross; cycle is still infinite; pill morphs unchanged.
6. Clicking the pill at any cycle index navigates to `/purpose/${projects[visibleIdx].id}` and the pill-expand transition still plays.
7. No layout regression to the full-bleed positioning from `2026-05-21-purpose-page-pinned-split-reveal-design.md`.

## Out of scope

- Mid-range scroll initialization to remove entry asymmetry
- Virtual-scroll / wheel-hijack architecture
- Snap-to-panel scroll behavior
- Loop counter UI or "you've cycled N times" indicators
- Preloading images beyond what the browser handles naturally — all 11 images are already in the DOM via `pillDataPerPanel`; the 2-slot rewrite still references the same URL set
