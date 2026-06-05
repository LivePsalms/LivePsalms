# Mobile bridge — pinned three-beat handoff

**Date:** 2026-05-30
**Status:** Approved (brainstorming)
**Surface:** `HeroMobile.tsx` bridge section (the "Come here to pause… / Restoration is a returning. / Your life with God is not slipping away." trio)

## Problem

The desktop hero bridge is a pinned 300vh stage with a scroll-scrubbed kiss-handoff sequence: text 1 rises from below, hands off to text 2 sliding in from the right, then to text 3 rising at center. Each beat occupies its own spatial position (left / right / center) and is the only beat visible during its hold window.

The mobile bridge is presently a single static flex column. All three lines fade in together via `useIntersectionStage`, then stay visible. None of the desktop motion, spatial layout, or kiss-handoff timing survives on mobile.

Goal: bring the mobile bridge to feature-parity with desktop — same scroll animation, same spatial composition, tuned for mobile viewport and gesture pace.

## Decisions (from brainstorming)

| Decision | Value | Rationale |
|---|---|---|
| Beat positioning | **A — Spatial (left / right / center)** | Beats live in distinct horizontal positions on the pinned stage, mirroring desktop. Strongest visual match. |
| Pin distance | **B — 300svh** | Matches desktop's 300vh exactly. Roughly 740px of scroll per beat on a 740px viewport — comfortable reading pace. |
| Reduced-motion fallback | **(ii) Static vertical stack** | Matches desktop's reduced-motion path; deletes the current `useIntersectionStage` plumbing for one unified behavior. |
| Section ordering inside `HeroMobile` | Unchanged | Bridge stays after the video mask (current mobile flow). "This section" was scoped to the bridge internals, not page ordering. |

## Architecture

The bridge JSX inside `HeroMobile.tsx` is replaced with the same shape as `HeroDesktop`'s bridge:

```tsx
{prefersReducedMotion ? (
  /* Static vertical stack — same as desktop reduced-motion */
  <section
    ref={bridgeRef}
    data-testid="hero-mobile-bridge"
    aria-label="Site introduction"
    className="relative flex flex-col items-center justify-center px-6 py-24 text-center"
    style={{ minHeight: '100svh', backgroundColor: 'var(--paper-cream)' }}
  >
    <div className="flex flex-col items-center">
      <p ref={bridgeInviteRef} className="bridge-line-center">{BRIDGE_COPY.invitation}</p>
      <p ref={bridgeThesisRef} className="bridge-thesis mt-8">{BRIDGE_COPY.thesis}</p>
      <p ref={bridgeAssureRef} className="bridge-line-center mt-8">{BRIDGE_COPY.assurance}</p>
    </div>
  </section>
) : (
  /* Pinned three-beat stage — same shape as desktop */
  <div ref={bridgeRef} data-testid="hero-mobile-bridge" className="relative" style={{ height: '300svh' }}>
    <section
      aria-label="Site introduction"
      className="overflow-hidden"
      style={{ position: 'sticky', top: 0, height: '100svh', backgroundColor: 'var(--paper-cream)' }}
    >
      <p ref={bridgeInviteRef} className="bridge-beat bridge-beat-left   bridge-line-side">{BRIDGE_COPY.invitation}</p>
      <p ref={bridgeThesisRef} className="bridge-beat bridge-beat-right  bridge-thesis">{BRIDGE_COPY.thesis}</p>
      <p ref={bridgeAssureRef} className="bridge-beat bridge-beat-center bridge-line-center">{BRIDGE_COPY.assurance}</p>
    </section>
  </div>
)}
```

Notes:
- `svh` (not `vh`) so iOS Safari address-bar dynamics don't shift the pin mid-scroll.
- `BRIDGE_COPY` and `BRIDGE_PIN_TIMING` continue to come from `src/components/sections/hero-bridge-content.ts` — single source of truth shared with desktop.
- Three new refs (`bridgeInviteRef`, `bridgeThesisRef`, `bridgeAssureRef`) added alongside the existing `bridgeRef`.

## CSS adjustment — unlock side offsets at every viewport

`src/index.css:324-335` currently gates `.bridge-beat-left` and `.bridge-beat-right` behind `@media (min-width: 768px)`. Remove the gate so they apply at every width, and tune the text max-widths so the side beats don't overflow on narrow viewports.

```css
/* No media query — applies at every viewport */
.bridge-beat-left {
  left: 8vw;
  right: auto;
  transform: translate(0, -50%);
  text-align: left;
}
.bridge-beat-right {
  left: auto;
  right: 8vw;
  transform: translate(0, -50%);
  text-align: right;
}
/* .bridge-beat-center keeps the default 50/50 centering */

/* Three typography classes — add a viewport-relative cap so side beats fit narrow widths */
.bridge-line-side    { max-width: min(440px, 80vw); }
.bridge-thesis       { max-width: min(440px, 80vw); }
.bridge-line-center  { max-width: min(560px, 80vw); }
```

At a 360px viewport: `8vw` ≈ 29px inset, `80vw` ≈ 288px of text width. Combined with the existing `clamp(24px, 4vw, 40px)` type ramp (which floors at 24px on narrow viewports), the Cormorant italic stays readable. Desktop is unchanged because `min(440px, 80vw)` resolves to `440px` at any viewport ≥ 550px.

Note: Desktop's side offset was `10vw`. Mobile uses `8vw` after the media-query gate is removed. This is a tightening (~2vw closer to edge) that benefits both — narrower viewports get more breathing room, wider viewports get a marginal compositional shift that's well within the existing 440px max-width.

## GSAP timeline — ported from desktop, tuned for mobile

A new `useEffect` in `HeroMobile.tsx` that mirrors `HeroDesktop.tsx:115-203`, with two mobile-specific values:

| Parameter | Desktop | Mobile | Why |
|---|---|---|---|
| `scrub` | `2` | `2 * MOBILE_TIME_SCALE` = `1.4` | Snappier on mobile, consistent with the existing wordmark-collapse scrub at `HeroMobile.tsx:81`. |
| Text-2 enter `x` | `120` | `30` | Proportional to viewport. Desktop's 120px ÷ 1440px ≈ 8.3%. 360px × 8.3% ≈ 30px — feels identical to a mobile thumb. |

Everything else is byte-for-byte the desktop animation:

- `gsap.set(t1, { opacity: 0, y: 40,  filter: 'blur(10px)' })`
- `gsap.set(t2, { opacity: 0, x: 30,  filter: 'blur(10px)' })`  ← mobile-tuned x
- `gsap.set(t3, { opacity: 0, y: 80,  filter: 'blur(10px)' })`
- Trigger: `start: 'top 80%'`, `end: 'bottom bottom'`, `scrub: 1.4`, `invalidateOnRefresh: true`
- Per-beat enter (`power2.out`, blur clear, opacity 1), hold, exit (`power1.in`, opacity 0) using the same `BRIDGE_PIN_TIMING` fractions: `text1 { enter:0, holdStart:0.10, holdEnd:0.32, exit:0.40 }`, etc.

Reduced-motion path: identical to desktop reduced-motion. Snapshot `prefersReducedMotion` once at mount (already done in `HeroMobile.tsx:48-51`); when true, `gsap.set([t1, t2, t3], { opacity: 1, y: 0, filter: 'blur(0px)' })` to clear any transform state.

Cleanup uses `gsap.context` scoped to `scrollEl` and `ctx.revert()` on unmount — same pattern desktop uses, no leaked ScrollTriggers.

## Removed code

- `bridgeVisible` constant (`HeroMobile.tsx:37`) — no longer needed.
- `useIntersectionStage(bridgeRef, { threshold: 0.3 })` call — replaced by the GSAP timeline.
- The three `transition-opacity duration-700 delay-200` Tailwind utility chains on the beat paragraphs — replaced by GSAP-driven opacity.
- The `data-visible` attribute on the bridge wrapper — no longer meaningful.

The `useIntersectionStage` import survives because `quoteVisible` still uses it for the Psalm 23 fade above the bridge.

## Testing

`src/components/sections/HeroMobile.test.tsx` currently asserts:
- `data-testid="hero-mobile-bridge"` exists
- `data-visible` attribute toggles

After this change:
- `data-testid="hero-mobile-bridge"` continues to exist (now on the outer 300svh wrapper, or on the reduced-motion static section).
- `data-visible` assertions are removed.

New assertions:
- The bridge wrapper, when motion is enabled, has `style="height: 300svh"`.
- Three `<p>` elements exist as children with classes `bridge-beat-left bridge-line-side`, `bridge-beat-right bridge-thesis`, `bridge-beat-center bridge-line-center` respectively.
- Each `<p>` contains the corresponding `BRIDGE_COPY` text.
- Under reduced-motion, the bridge renders a static section with no 300svh wrapper and all three texts present and visible.

GSAP itself is exercised by E2E rather than unit tests (matches the convention in the existing repo — no unit tests touch GSAP's internals).

## Out of scope

- Section ordering on mobile (wordmark → quote → mask → bridge) stays as is.
- The mask-expand scroll animation, wordmark-collapse, and Psalm 23 quote are not touched.
- Desktop bridge behavior is not changed beyond the CSS gate removal (which is a no-op at ≥768px).
- The `MidSectionMotion` / `TwoPathInterlude` / `PurposeGrid` sections that follow the hero are not touched.

## File changes summary

| File | Change |
|---|---|
| `src/components/sections/HeroMobile.tsx` | Replace bridge JSX, add 3 refs, add GSAP useEffect (port of desktop), drop `bridgeVisible` and the intersection-observer-driven Tailwind opacity classes. |
| `src/index.css` | Remove `@media (min-width: 768px)` gate around `.bridge-beat-left`/`-right`; tighten `left/right` from `10vw` to `8vw`; add `max-width: min(440px, 80vw)` to the three typography classes (and `min(560px, 80vw)` on `.bridge-line-center`). |
| `src/components/sections/HeroMobile.test.tsx` | Remove `data-visible` assertions; add 300svh / spatial-beat-class assertions; add reduced-motion test. |
