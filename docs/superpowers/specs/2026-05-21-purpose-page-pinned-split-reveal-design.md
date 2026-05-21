# /purpose — Pinned Split-Reveal Listing with Fixed Pill

**Date:** 2026-05-21
**Branch:** deepen-architecture
**Status:** Design approved, ready for implementation plan
**Replaces:** [src/components/sections/PurposeGallery.tsx](../../../src/components/sections/PurposeGallery.tsx)

## Goal

Replace the current `/purpose` route's stacked full-bleed listing with a cinematic, scroll-pinned, opposing-direction split-reveal mechanic that surfaces each devotion in the same visual language as Zone 8 of the moodboard ([NextDevotionHandoff](../../../src/components/sections/NextDevotionHandoff.tsx)).

The user navigates from one devotion to the next not by leaving the page, but by scrolling through a pinned stage where the next devotion's two image halves rise from below (left) and drop from above (right), meeting in the middle, while a fixed center pill morphs its label, title, category, and scripture reference upward — line by line — and its background color crossfades to the new dominant color.

## The Mechanic (read this section twice)

When the user reaches the `/purpose` listing:

1. The wrapping section pins to the top of the viewport via GSAP `ScrollTrigger { pin: true, scrub }`.
2. All N project panels stack absolutely on top of one another at `inset: 0`.
3. Each panel is a full-screen 50/50 grid:
   - **Left half** = `project.thumbnail`
   - **Right half** = `devotion.firstMoodboardImage` (falls back to `project.images[1] ?? project.thumbnail` for projects without an attached devotion)
4. At rest, panel 1 sits with both halves at `yPercent: 0`. Panels 2..N are pre-positioned with their **left half at `yPercent: 100`** (below the viewport) and **right half at `yPercent: -100`** (above the viewport).
5. As the user scrolls, the master timeline tweens panel `i`'s left half from `100 → 0` and right half from `-100 → 0` in lockstep, occupying one viewport of scroll. At the midpoint, the two halves meet at the divider line and complete the overwrite of panel `i-1`.
6. A center **pill** is positioned `absolute` within the pinned stage at 50/50, rendered with the existing `hero-mask-clip` clipPath. It does not move vertically. As each incoming panel crosses the halfway threshold, the pill's four text stacks (label, title, category, scripture ref) each translate upward by 100% of their own line height, revealing the next devotion's content. The pill's background color crossfades to the next devotion's dominant color in the same beat.
7. Total pinned scroll distance = `(N - 1) × window.innerHeight`. After the last panel completes, pin releases and the page ends quietly (footer is already hidden on `/purpose`).

This is the project-transition pattern from `scrollanimationdetails.md`, with the opposing-direction column motion from `scrollanimation.md`, applied to the Zone 8 composition.

## Component Structure

```
src/components/sections/
  PurposeStack.tsx              ← NEW. Replaces PurposeGallery.tsx on /purpose.
                                  Owns the pinned wrapper, panel stack, fixed
                                  pill, and the master ScrollTrigger timeline.

  purpose-stack-pill.tsx        ← NEW. The fixed center pill. Renders the
                                  hero-mask-clipped shape, the three-column
                                  content grid, and the four upward-rising
                                  text stacks. Exposes imperative refs so
                                  PurposeStack can drive the morph.

src/transitions/
  usePillExpandNavigation.ts    ← NEW. Extracted from NextDevotionHandoff's
                                  useClickToExpand hook. Same DOM-overlay
                                  expand-to-fullscreen morph + navigate, but
                                  parameterized over (targetProject, pillEl,
                                  pillColor). Used by both Zone 8 and the new
                                  PurposeStack pill.

src/components/sections/
  NextDevotionHandoff.tsx       ← REFACTORED. Replace its private
                                  useClickToExpand with usePillExpandNavigation.
                                  Behavior unchanged.
```

`PurposeGallery.tsx` is deleted in the same commit that wires `PurposeStack` into the `/purpose` route in [App.tsx](../../../src/App.tsx) (line 144).

## Data Flow

`PurposeStack` consumes the same `projects: Project[]` array from `useProjectColors()` that the rest of the app uses, plus the `devotions` map from [data/devotions.ts](../../../src/data/devotions.ts).

Per panel, it computes:

| Field        | Source                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| `leftImage`  | `project.thumbnail`                                                     |
| `rightImage` | `devotions[project.id]?.firstMoodboardImage ?? project.images[1] ?? project.thumbnail` |
| `label`      | `'Devotion'` (constant, sits where Zone 8 has "Next Devotion")          |
| `title`      | `devotions[project.id]?.title ?? project.name`                          |
| `category`   | `devotions[project.id]?.label.replace(/^(The )?(Restoration of \|Serenity of )/, '')` (or `categoryLabel[project.category]` fallback) |
| `scripture`  | `devotions[project.id]?.scriptureRef ?? ''`                             |
| `pillColor`  | dominant color extracted from `project.thumbnail` via `extractDominantColor`, with `project.overlayColor` as the synchronous fallback |

Image preloading is opportunistic — set `loading="lazy"` and `decoding="async"` on every `<img>`; the first panel's images get `loading="eager"` so the resting state paints immediately.

## Animation Spec

### Master pinned timeline

```ts
ScrollTrigger.create({
  trigger: wrapperRef.current,
  start: 'top top',
  end: () => `+=${(panels.length - 1) * window.innerHeight}`,
  pin: true,
  scrub: 0.6,
  invalidateOnRefresh: true,
})
```

### Per-panel split tween

```ts
panels.slice(1).forEach((panel, i) => {
  tl.to(panel.leftHalf,  { yPercent: 0, ease: 'none' }, i)
    .to(panel.rightHalf, { yPercent: 0, ease: 'none' }, i)
})
```

Both halves move at the same rate. No staggered easing — the motion reads cleaner when the two halves meet symmetrically.

### Pill content morph (per-line rise)

Each pill text stack is a `position: relative; overflow: hidden;` container holding a vertical column of frames. To advance:

1. Append the new frame to the bottom of the stack.
2. `requestAnimationFrame`, then set `transform: translateY(-100%)` with a 550ms `cubic-bezier(0.65, 0, 0.25, 1)` transition.
3. On `transitionend`, remove the now-off-screen top frame and reset `transform: translateY(0)` without transition (forced reflow first).

This runs independently per stack (label, title, category, scripture), so all four lines rise together at the same beat.

### Pill color crossfade

`pillShapeRef.current.style.transition = 'background-color 0.55s cubic-bezier(0.65, 0, 0.25, 1)'` is set once on mount. Each midpoint trigger sets `style.backgroundColor = newPillColor`. The transition handles the rest.

### Midpoint triggers

```ts
panels.slice(1).forEach((panel, i) => {
  ScrollTrigger.create({
    trigger: wrapperRef.current,
    start: () => `top -${(i - 0.5) * window.innerHeight}px`,
    onEnter:     () => updatePill(panel.data),
    onLeaveBack: () => updatePill(panels[i - 1].data),
  })
})
```

`(i - 0.5) × viewportHeight` matches the half-meet point of the split reveal.

### Initial state

Panel 1 fully visible (halves at `yPercent: 0`). Pill populated with panel 1's data, no entrance animation. The resting state should be paint-stable before JS hydration completes — write the initial pill text into the DOM on first render so the static HTML matches the JS resting state.

## Click Behavior

The pill is a full-bleed click target within its clip-path bounds. Clicking it:

1. Reads the currently centered devotion's project from the panel pointer (a `currentIndexRef` updated by the midpoint triggers).
2. Calls `usePillExpandNavigation.startExpand()` — the extracted DOM-overlay expand-to-fullscreen morph that:
   - Snapshots the pill's `getBoundingClientRect()`.
   - Mounts a detached `[data-pill-cover]` div outside React on `document.body`.
   - Animates the cover from pill rect to `100vw × 100vh` with a 0.65s `power3.inOut` ease.
   - Crossfades a clip-path-bounded color layer to an unclipped one mid-expand (0.35s overlap starting at `t=0.15`).
   - Calls `navigate('/purpose/:id')`.
   - After 200ms post-nav hold, fades the cover out (400ms `ease-out`).
3. Keyboard activation: `tabIndex={0}`, `Enter` / `Space` triggers the same flow, `role="link"`, `aria-label` = devotion title.

## Mobile Fallback (≤768px)

Pinned scrub on touch is fussy and reads poorly on small viewports. Mobile drops the pin entirely:

- Each panel renders as a vertical `h-screen` section in normal document flow (no `position: absolute`).
- The split-reveal entrance plays **once per panel** as it enters the viewport, via a non-pinned `ScrollTrigger` with `toggleActions: 'play none none reverse'` and `start: 'top 80%'`.
- The pill is positioned `absolute` center within each panel (one pill per panel, not a shared fixed one), with the same content for that panel. No content morph — each panel's pill is statically populated.
- Click behavior unchanged.

This mirrors the existing [NextDevotionHandoff](../../../src/components/sections/NextDevotionHandoff.tsx) mobile variant pattern.

## Reduced Motion (`prefers-reduced-motion: reduce`)

- Skip the pin and the scrub timeline entirely.
- Render panels as a vertical `h-screen` stack with both halves at `yPercent: 0` from the start.
- Each panel renders its own static pill (no shared fixed pill, no content morph).
- The pill click expand morph still runs but at `duration: 0` (instant) — preserves the navigation contract without the cinematic flourish.

## Header

The header stays visible throughout. Use the existing `darkText={false}` (light text) since panels are dark with white pill text. No header fade — keeps consistent with the rest of the app and avoids jank around the pin.

## Edge Cases

| Case | Behavior |
| ---- | -------- |
| User scrolls back up past the start of the wrapper | Pin releases naturally. First panel resting state remains intact. |
| User scrolls past the end of the wrapper | Pin releases. Page ends (footer hidden, nothing below). |
| Image fails to load | Half renders with `project.overlayColor` as a solid fallback. No layout shift. |
| User clicks pill mid-morph | First click wins (`navigatedRef.current` guard, same as today's Zone 8). |
| Window resize during pin | `invalidateOnRefresh: true` recalculates the end distance. ScrollTrigger handles. |
| `HeroMaskClipDef` already mounted (e.g., user navigated from Home to /purpose without unmount) | Don't mount it again from `PurposeStack` — check if the element exists in DOM first, or hoist the def into a top-level layout component as a follow-up. **Initial implementation:** mount it locally in `PurposeStack` only when not present in DOM. |
| First paint before JS hydration | First panel and pill content render statically from server (or initial React render). No flash of empty pill. |
| Project list changes (extremely unlikely in this app) | The component re-runs the timeline setup on `projects.length` change via dependency array. |

## Files Affected

| File | Change |
| ---- | ------ |
| [src/components/sections/PurposeStack.tsx](../../../src/components/sections/) | NEW — the new pinned stack component. |
| [src/components/sections/purpose-stack-pill.tsx](../../../src/components/sections/) | NEW — extracted pill subcomponent. |
| [src/transitions/usePillExpandNavigation.ts](../../../src/transitions/) | NEW — extracted expand-to-fullscreen hook. |
| [src/components/sections/NextDevotionHandoff.tsx](../../../src/components/sections/NextDevotionHandoff.tsx) | REFACTOR — replace private `useClickToExpand` with `usePillExpandNavigation`. Behavior unchanged. |
| [src/components/sections/PurposeGallery.tsx](../../../src/components/sections/PurposeGallery.tsx) | DELETE — no longer routed. |
| [src/App.tsx](../../../src/App.tsx) line 144 | Swap `<PurposeGallery …>` for `<PurposeStack …>`. |
| `src/components/sections/__tests__/PurposeStack.test.tsx` | NEW — covers panel count, initial pill content, midpoint trigger fires `updatePill`, mobile fallback path, reduced-motion path. |
| `src/transitions/__tests__/usePillExpandNavigation.test.ts` | NEW — covers cover-element lifecycle, `navigatedRef` guard, reduced-motion duration collapse. |

## Acceptance Criteria

1. Navigating to `/purpose` lands on the first devotion's panel; both halves at rest, pill populated with that devotion's label/title/category/scripture, pill color matches first devotion's dominant color.
2. Scrolling down pins the stage. The second panel's left half rises from below while the right half drops from above; they meet at the divider; the pill's four lines rise to the next devotion's content; pill color crossfades.
3. The pin holds across all 11 panels (~10 viewports of pinned scroll).
4. Pill is a click/keyboard-activated target. Activation runs the expand-to-fullscreen morph and routes to `/purpose/:id` of the centered devotion.
5. Scrolling back up reverses the timeline cleanly, including pill content reverting line by line.
6. On viewports ≤768px, the pin is bypassed; each panel renders in flow with its own static pill; the split-reveal entrance plays once per panel as it scrolls in.
7. `prefers-reduced-motion: reduce` bypasses the pin and animations; each panel is statically rendered; pill click still navigates (no morph).
8. The Zone 8 `NextDevotionHandoff` behavior is unchanged after the `useClickToExpand` → `usePillExpandNavigation` extraction. The existing devotion → next-devotion click + expand + navigate flow continues to work indistinguishably from today.
9. No console errors. ScrollTrigger pin doesn't leak across route changes (cleanup on unmount via `gsap.context().revert()`).
10. No layout shift on initial paint. No long-tasks > 200ms during the pinned scroll (verify in DevTools Performance panel against the existing `/purpose` baseline).

## Out of Scope (for this spec)

- Adding a "Return to Home" or "End of Devotions" tail beat after the last panel — deferred until we see how the end-feel reads in QA.
- Hoisting `HeroMaskClipDef` to a layout root — deferred until we have a second route that needs it concurrently with Hero or MoodBoard.
- Filter tabs (the home `PurposeGrid` has them; the `/purpose` page does not need them per current UX).
- Search / quick-jump to a specific devotion — not in current product surface.
- The `TODO(handoff)` cleanup in `devotions.ts` and `PurposeDetail.tsx` — orthogonal refactor, file an issue.

## Reference Material

- Mechanic primer: `scrollanimationdetails.md` (provided by user) — pinned wrapper + scrub + center banner pattern.
- Opposing-direction motion: `scrollanimation.md` (provided by user) — the `col-scroll__box--odd` `yPercent: 100` trick adapted to a single panel's two halves.
- Existing Zone 8 composition: [NextDevotionHandoff](../../../src/components/sections/NextDevotionHandoff.tsx) — visual reference, click-to-expand source.
- Hero mask clip path: [HeroMaskClipDef](../../../src/components/ui-custom/HeroMaskClipDef.tsx).
