# Hero Scroll-Collapse — Design Spec

**Date:** 2026-05-12
**Status:** Approved (ready for implementation plan)
**Owner:** Hero section, `src/components/sections/Hero.tsx`

---

## Summary

Insert a scroll-pinned segment into the existing Hero section. After the existing intro plays and the user is at rest with the full PSALMS wordmark visible, the act of scrolling drives a frame-by-frame collapse of the wordmark back into the A, accompanied by an umber halo and warm-sand expanding ring. The pin releases at progress 1.0 and the existing mask-expand animation picks up scroll-driven control from there. The new animation feels like the Hero responding to the user's scroll — not a separate scene.

The standalone HTML composition at `public/logo-freefall/` is the *design reference*. It is not loaded at runtime. Its GSAP timeline structure (three-wave collapse, A pulse, glow choreography) is ported into a new React effect inside `Hero.tsx`, re-skinned for the cream/deep-umber Hero palette.

---

## Goals

- Add a "more sophisticated" scroll-driven beat between the wordmark resting state and the existing mask-expand animation.
- Reuse the existing `PsalmsWordmarkSvg` component and the existing collapse-geometry constants — single source of truth.
- Preserve the existing intro, mask-expand, and quote animations unchanged.
- Match the Hero's cream + deep-umber aesthetic so the new beat reads as part of the Hero, not as a foreign cinematic insert.
- Honor `prefers-reduced-motion` with a graceful in-place fade.
- Mobile parity — same scrub mechanic, no degraded mobile fallback.

## Non-Goals

- No changes to the standalone `public/logo-freefall/` composition. It remains a reference artifact.
- No changes to the existing intro animation, mask-expand, quote, or any post-Hero content.
- No new route, no new top-level component file.
- No new automated tests for this iteration — verification is manual (Section 8) plus future Playwright if/when that lands.
- No mobile-specific shortened pin distance.

---

## 1. Placement & Flow

New scroll order inside the Hero:

1. Hero intro plays (unchanged — first viewport, dark canvas, A heartbeat, letters spread).
2. Intro handoff completes. Wordmark settles at deep-umber `#3A3426` / opacity 0.12 (unchanged resting state).
3. **NEW pinned scroll-collapse region.** First 15% of pin progress blooms the wordmark from 0.12 → 1.0 opacity. Remaining 85% drives the three-wave collapse, A pulse, and climax.
4. Pin releases. Existing mask-expand region (`maskScrollRef` at [Hero.tsx:362](../../../src/components/sections/Hero.tsx#L362)) engages.
5. Quote section. Footer continues page.

The new region sits in the DOM between the existing first viewport ([Hero.tsx:279](../../../src/components/sections/Hero.tsx#L279)) and `maskScrollRef`.

---

## 2. Visual Treatment (palette adaptation)

The standalone composition's "dark canvas + cream wordmark + cream halo" palette is **not** carried over. On the Hero's cream `--plaster` background, additive light cannot read. The adaptation:

| Element | Standalone composition | Hero adaptation |
|---------|------------------------|-----------------|
| Background | `#0a0a0c` near-black radial | `var(--plaster) #F0ECE8` — Hero's existing cream |
| Wordmark fill | `#f6f4f0` cream | `var(--deep-umber) #3A3426` — existing color |
| Halo (behind A, persistent) | Cream radial wash | `rgba(58, 52, 38, 0.18)` deep-umber wash, blur 18px. Reads as gentle weight, not light. |
| Ring (expanding gesture) | Cream border | 1.5px ring in `var(--warm-sand) #BCB3A3` at opacity 0.85 |
| Core flash | Bright cream center | **Removed.** Replaced by an A-fill tonal warming (see below) |
| A flash | (uses core element) | A's fill warms `#3A3426 → #5A4520 → #3A3426` during the climax — a tonal shift, not additive light |

All collapse mechanics (three eases per letter — position `power3.out`, opacity `power1.out`, blur `power2.out`; `blur(0px → 6px)` mask trick; three-wave timing) are preserved from the standalone composition.

---

## 3. Timeline & Motion Spec

### Pin configuration

```
trigger:                collapseScrollRef     (height: 150vh)
pin (sticky):           collapsePinRef        (height: 100vh, position: sticky, top: 0)
start:                  'top top'
end:                    'bottom top'
scrub:                  1                     (1-second smoothing)
invalidateOnRefresh:    true
```

CSS `position: sticky` handles the visual pinning. GSAP's `pin` option is **not** used. This mirrors the existing mask-expand pattern at [Hero.tsx:84-96](../../../src/components/sections/Hero.tsx#L84-L96).

### Progress mapping

- Total scroll cost: 150vh (1.5 viewport heights).
- Standalone composition duration: 6.0s.
- Bloom prefix: 15% of scroll progress.
- Mapping: `original_time = max(0, (scroll_progress - 0.15) / 0.85 × 6.0)`

### Phase keyframes (in scroll-progress space)

| Phase | Progress range | What happens |
|-------|----------------|--------------|
| 1. Bloom | 0.000 → 0.150 | Wordmark `opacity 0.12 → 1.0`, faint `scale 0.98 → 1.0`. Halo prepped at opacity 0. |
| 2. Wave 1 — S₂ | 0.150 → 0.377 | S₂ flies inward: `x → 0` (power3.out), `opacity → 0` (power1.out), `filter: blur(0 → 6px)` (power2.out). |
| 3. Wave 2 — P + M | 0.221 → 0.448 | Outer pair collapse together with the same three independent eases. |
| 4. Wave 3 — S₁ + L | 0.292 → 0.518 | Inner pair collapse — last to merge into the A. |
| 5. A pulse | 0.504 → 0.639 | A scales `1 → 1.06 → 1` (power2.out up, power3.out down). |
| 6. Climax | 0.568 → 0.780 | Halo swells in then settles, ring expands and fades, A fill warms `#3A3426 → #5A4520 → #3A3426`. |
| 7. Rest | 0.780 → 1.000 | A still at full opacity, deep-umber. Halo holds at opacity 0.10. Pin releases at 1.000. |

### Climax detail (Phase 6)

- **Halo** (`collapseHaloRef`): radial gradient, 520px × 520px square, blur(18px), `rgba(58, 52, 38, 0.18)` at center. Swells `opacity 0 → 0.85, scale 0.3 → 1.0` over progress 0.568 → 0.643 (power2.out), then eases to `opacity: 0.10` over progress 0.643 → 0.780 (power2.out) and holds through Phase 7.
- **Ring** (`collapseRingRef`): 24px × 24px starting circle, 1.5px solid border `rgba(188, 179, 163, 0.85)` (warm-sand). Blooms `opacity 0 → 0.85, scale 0.3 → 1.0` over progress 0.568 → 0.588 (power1.out), then expands `scale 1 → 45` while fading `opacity → 0` over progress 0.588 → 0.780 (power2.out).
- **A tonal warming:** A's fill tweens `#3A3426 → #5A4520` over progress 0.568 → 0.604 (power2.out), then `#5A4520 → #3A3426` over progress 0.604 → 0.760 (power2.out). Subtle, brand-coherent, replaces the standalone's bright core flash which would not read on cream.

### Easing principles (preserved from standalone)

Three independent eases per letter, applied to three independent properties:
- `x`: `power3.out` (deceleration into the A)
- `opacity`: `power1.out` (gentle fade)
- `filter: blur(0 → 6px)`: `power2.out` (blur-to-mask trick)

No `ease-in` family anywhere. No springs, bounces, elastics, or back-eases.

### Letter geometry — single source of truth

The existing intro effect declares collapse offsets locally at [Hero.tsx:188-195](../../../src/components/sections/Hero.tsx#L188-L195):

```ts
const COLLAPSE = {
  P:  653.3,
  S1: 339.8,
  L: -313.9,
  M: -690.5,
  S2: -1076.4,
};
```

These values are in SVG user-space (the wordmark's viewBox), so they scale automatically with the SVG's rendered width. **Refactor:** extract this `COLLAPSE` const to module scope at the top of `Hero.tsx` so both the intro effect and the new collapse effect reference one definition. The new effect uses the same values (collapse direction is the inverse of intro spread, but the magnitude is identical).

---

## 4. Component Structure

The work lives inside `Hero.tsx`. No new file is created. Justification: the new effect must gate on `introActive` and reuses the existing intro's wordmark geometry — extracting would force prop-drilling without a meaningful boundary benefit.

### DOM additions (between first viewport and `maskScrollRef`)

```jsx
{/* NEW — scroll-collapse pin region */}
<div ref={collapseScrollRef} style={{ height: '150vh' }} className="relative">
  <div
    ref={collapsePinRef}
    className="sticky top-0 h-screen flex items-center justify-center overflow-hidden"
  >
    {/* Persistent umber halo — sits behind the wordmark */}
    <div ref={collapseHaloRef} aria-hidden="true" className="absolute pointer-events-none" />

    {/* Second wordmark instance — the one that animates the collapse */}
    <PsalmsWordmarkSvg
      ref={collapseSvgRef}
      className="w-[95vw] md:w-[80vw] max-w-4xl relative z-10"
      style={{ opacity: 0.12, color: 'var(--deep-umber)' }}
    />

    {/* Expanding warm-sand ring — sits in front of the wordmark */}
    <div ref={collapseRingRef} aria-hidden="true" className="absolute pointer-events-none" />
  </div>
</div>
```

### New refs (five total)

- `collapseScrollRef: RefObject<HTMLDivElement>` — outer 150vh container, the ScrollTrigger trigger.
- `collapsePinRef: RefObject<HTMLDivElement>` — inner sticky pin element.
- `collapseSvgRef: RefObject<SVGSVGElement>` — second `PsalmsWordmarkSvg` instance, used for letter selectors.
- `collapseHaloRef: RefObject<HTMLDivElement>` — the umber halo div.
- `collapseRingRef: RefObject<HTMLDivElement>` — the expanding warm-sand ring div.

### Why a second `PsalmsWordmarkSvg` instance

The first instance is glued to the resting first-viewport. The second instance is glued to the pin's sticky child. At the boundary, the user scrolls the first instance UP and out of view at the exact moment the pin's sticky engages — both render the same SVG at the same viewport position with the same starting opacity (0.12 deep-umber). The handoff is visually invisible. A single shared instance would require either moving DOM nodes mid-scroll or a `position: sticky` wrapper around both viewports (a larger refactor of the intro for marginal benefit). Duplicating an SVG is cheap.

### New effect (sketch)

```tsx
useLayoutEffect(() => {
  if (introActive) return;

  const scrollEl = collapseScrollRef.current;
  const pinEl    = collapsePinRef.current;
  const svgEl    = collapseSvgRef.current;
  const haloEl   = collapseHaloRef.current;
  const ringEl   = collapseRingRef.current;
  if (!scrollEl || !pinEl || !svgEl || !haloEl || !ringEl) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const letterA  = svgEl.querySelector<SVGGElement>('#letter-A');
  const letterP  = svgEl.querySelector<SVGGElement>('#letter-P');
  const letterS1 = svgEl.querySelector<SVGGElement>('#letter-S1');
  const letterL  = svgEl.querySelector<SVGGElement>('#letter-L');
  const letterM  = svgEl.querySelector<SVGGElement>('#letter-M');
  const letterS2 = svgEl.querySelector<SVGGElement>('#letter-S2');
  if (!letterA || !letterP || !letterS1 || !letterL || !letterM || !letterS2) return;

  const ctx = gsap.context(() => {
    const tl = gsap.timeline({
      defaults: { force3D: true },
      scrollTrigger: {
        trigger: scrollEl,
        start: 'top top',
        end: 'bottom top',
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    // Phase 1 — bloom (progress 0 → 0.15)
    // Phase 2-4 — three waves (progress 0.150 → 0.518)
    // Phase 5 — A pulse (progress 0.504 → 0.639)
    // Phase 6 — climax (progress 0.568 → 0.780)
    // Phase 7 — rest hold (progress 0.780 → 1.000)
    // Each phase wired via tl.to() / tl.fromTo() at the exact progress offsets from Section 3.
  }, scrollEl);

  return () => ctx.revert();
}, [introActive]);
```

### Lifecycle integration

- `useLayoutEffect` (not `useEffect`) — prevents un-set wordmark flash before GSAP seeds initial state. Matches the existing intro effect's choice at [Hero.tsx:168](../../../src/components/sections/Hero.tsx#L168).
- Effect deps: `[introActive]`. When intro completes, the effect re-runs and registers the ScrollTrigger. When `introActive` flips back to true (intro replay scenario), `ctx.revert()` cleans up.
- `gsap.context()` scoped to `collapseScrollRef.current` — all tweens and ScrollTriggers tagged to this context, fully reversible on unmount.

### No new React state

The animation is fully scroll-driven. No new `useState`, no new prop on `Hero`, no changes to `App.tsx`, the intro gate, or the loading overlay.

---

## 5. Reduced-Motion Fallback

Users with `prefers-reduced-motion: reduce` follow a separate code path:

**Path-switching mechanism.** A small `useLayoutEffect` (separate from the main scrub effect) reads `window.matchMedia('(prefers-reduced-motion: reduce)').matches` at mount and sets a `data-reduced-motion` attribute on the pin region's outer element (`collapseScrollRef`'s div). Two scoped CSS rules in `Hero.tsx`'s nearby stylesheet (or as inline styles keyed on the attribute) handle layout switching:
- `[data-reduced-motion="true"]` sets `height: 100vh` on the outer container (overrides the 150vh inline style — apply via a class or attribute selector).
- `[data-reduced-motion="true"] > div` sets `position: static` on the sticky child.

**The main scrub effect** returns early if the attribute is present (or directly on the `matchMedia` check, as already shown in the effect sketch). No ScrollTrigger registered. No timeline created.

**Fade-only entrance.** A second small effect, only active when `data-reduced-motion === "true"`, attaches an `IntersectionObserver` to `collapseScrollRef` (one-shot, threshold 0.3). On first intersection, GSAP runs a single 800ms tween group (no ScrollTrigger):
- `letterP, letterS1, letterL, letterM, letterS2` (resolved via `collapseSvgRef.querySelector<SVGGElement>`): `opacity: 0.12 → 0`, ease `power1.out`.
- `letterA`: `opacity: 0.12 → 1.0`, ease `power2.out` — the A bumps to full presence since the rest of the wordmark is leaving.
- `collapseHaloRef`: `opacity: 0 → 0.10`, ease `power2.out`. Halo holds at 0.10 indefinitely.
- The expanding ring (`collapseRingRef`) does not animate. No `x` translation, no `filter: blur`, no A pulse.

The observer disconnects after firing. The result reads as "letters dissolve, A emerges, umber halo settles" — same narrative, zero scroll-coupling, zero large transforms.

---

## 6. Mobile

Same scrub as desktop. Two specific considerations:

- **iOS rubber-band overscroll.** Add `overscroll-behavior-y: contain` to `collapseScrollRef` (localized — does not affect any other section).
- **Touch fling smoothing.** `scrub: 1` already correct — fast flicks settle gracefully into the timeline.

The wordmark's existing responsive sizing (`w-[95vw] md:w-[80vw] max-w-4xl`) handles narrow viewports. `COLLAPSE` offsets in SVG user-space scale automatically with the SVG viewBox.

---

## 7. Edge Cases

| Case | Behavior |
|------|----------|
| Refresh mid-scroll | `ScrollTrigger` reads scroll position on refresh, timeline scrubs to correct progress. No flash. |
| Tab switch / blur | Timeline pauses naturally. Scrub resumes from scroll position on return. |
| Browser back from `/purpose/:id` | Manual scroll restoration ([App.tsx:27](../../../src/App.tsx#L27)) resets to top. Pin region renders at progress 0. Acceptable. |
| Viewport resize | `invalidateOnRefresh: true` recalculates trigger boundaries. |
| Returning session (intro skipped) | `introActive` is false from mount; effect registers immediately. Inline-styled SVG renders at 12% deep-umber from first paint — identical to post-intro rest state. |
| Fast mousewheel | `scrub: 1` smooths over ~1s. |
| Hot reload during dev | `ctx.revert()` cleans up cleanly. |
| Scroll back up after collapse | Timeline reverses smoothly. Wordmark blooms back DOWN to 0.12, halo fades, A returns to rest. |

---

## 8. Verification

| Check | How |
|-------|-----|
| Bloom timing | DevTools: `tl.progress(0.075)`. Verify wordmark at ~56% opacity, no letter movement yet. |
| Wave order | Manually scrub `tl.progress` 0.150 → 0.518. S₂ moves first, P+M next, S₁+L last. |
| Climax palette | At `tl.progress(0.6)`: halo is umber-tinted (not cream), ring is warm-sand, A's fill warmed toward `#5A4520`. |
| Rest state | At `tl.progress(1.0)`: A at full deep-umber, halo opacity ~0.10, ring gone. |
| Scroll-up reverse | Scroll forward to mid-pin, scroll back. Timeline reverses smoothly. |
| Boundary handoff | Cross first-viewport ↔ pin boundary — no flash. Both wordmark instances render identically at 12% deep-umber. |
| Mask-expand chain | After pin releases at progress 1.0, existing `maskScrollRef` triggers normally. Quote fades in. |
| Reduced-motion | DevTools → Rendering tab → emulate `prefers-reduced-motion: reduce`. Reload. Pin region 100vh, no sticky, fade-only on intersection. |
| Intro coexistence | First-visit load: intro runs in viewport 1, scroll-collapse dormant. Intro completes. Scroll-collapse engages on first scroll. |
| Mobile (device emulation) | Pin scrubs smoothly on touch fling. iOS Safari profile: no premature pin release. |
| ScrollTrigger leaks | After scrolling past and back many times, `ScrollTrigger.getAll().length` returns expected count. |

---

## 9. Open Questions

None at this time. All design decisions captured above.

---

## 10. Implementation Order (preview for the plan)

1. Extract `COLLAPSE` const to module scope in `Hero.tsx`. Verify intro still works.
2. Add the five new refs and the new DOM block between first viewport and `maskScrollRef`.
3. Add the new `useLayoutEffect` with timeline phases 1–7.
4. Wire the climax (halo, ring, A tonal warming).
5. Add the reduced-motion `IntersectionObserver` fallback path and the `data-reduced-motion` CSS rules.
6. Manual verification pass (Section 8 checklist).

Implementation plan to follow via `superpowers:writing-plans`.
