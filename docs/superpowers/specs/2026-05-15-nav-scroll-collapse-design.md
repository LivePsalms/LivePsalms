# Nav Scroll-Collapse — Design Spec

**Date:** 2026-05-15
**Status:** Approved (ready for implementation plan)
**Owner:** Header component, [src/components/layout/Header.tsx](../../../src/components/layout/Header.tsx); minor publisher hook into Hero, [src/components/sections/Hero.tsx](../../../src/components/sections/Hero.tsx).

---

## Summary

As the home-page hero's collapse pin scrubs, the desktop nav items fade and slide rightward one by one and resolve into a hamburger button at the right edge of the header. The logo stays at full opacity. On every other route, the same animation runs but is driven by a vanilla `scrollY` window instead of the hero pin. Clicking the hamburger reverse-plays the collapse so items reappear inline; the next scroll event re-collapses them smoothly via a resync tween. This adds a fifth coordinated beat to the existing hero choreography (intro → mask-expand → wordmark-collapse → quote → nav-collapse) without changing any of them.

The existing mobile menu (`md:hidden`) is untouched.

---

## Goals

- Couple the desktop nav's collapse to the **same** hero-pin timeline that drives the wordmark collapse, so the two gestures read as one.
- Preserve the look on routes where there is no hero, using a lightweight `scrollY` fallback driver with identical visual outcome.
- Make the hamburger interactive: click → inline reverse-collapse; scroll → smooth re-collapse.
- Zero changes to the existing intro, mask-expand, wordmark-collapse, quote, or mobile-menu animations.
- Honor `prefers-reduced-motion: reduce` with a graceful no-animation path.
- Avoid React re-renders during scroll — animation state mutates DOM refs directly.

## Non-Goals

- No changes to the existing wordmark-collapse spec at [2026-05-12-hero-scroll-collapse-design.md](2026-05-12-hero-scroll-collapse-design.md). This new animation **rides on** that timeline; it does not modify it.
- No new global state library, no React Context for progress, no prop drilling.
- No changes to the mobile hamburger path (`md:hidden`).
- No changes to the existing `isScrolled` 100px padding-shrink. It continues to operate orthogonally.
- No animated transformation of the burger icon itself (e.g., morph from "—" to bars). The burger fades+scales in; it does not metamorphose.
- No new automated tests for this iteration — verification is manual (Section 9).

---

## 1. Behavior Overview

### State machine (desktop only, `md:flex`)

```
scrub ──click burger──▶ click-expanded ──first scroll input──▶ resyncing ──▶ scrub
                  ▲          │
                  │          └──click burger again──┐
                  └──────────────────────────────────┘
```

- **scrub** (default): Progress flows from the active scroll source straight to the DOM refs. No animation other than the scrub itself.
- **click-expanded**: Subscriber updates are gated. A direct GSAP tween animates items from their current state back to fully expanded (progress 0) over 500ms, and the burger tweens out across the same span. Items remain interactive.
- **resyncing**: Triggered by the first `wheel`, `touchmove`, or vertical scroll-key input fired while click-expanded. A 400ms `power2.out` tween brings items from "expanded" → the state matching the user's actual current scroll progress, then control returns to scrub.

Clicking the burger again while click-expanded toggles back to collapsed without waiting for scroll (uses the same 500ms reverse tween, in the other direction).

### Visibility / pointer rules

- The burger is rendered only when `md:flex` (desktop) AND `!prefersReducedMotion`.
- The burger's pointer events are disabled until local progress ≥ 0.5 (below that, it is barely visible).
- When a nav item's computed opacity drops below 0.05, it receives `aria-hidden="true"` and `pointer-events: none` (set in the same rAF as the transform). Restored when opacity rises above 0.05.

---

## 2. Animation Spec

### Source of progress

Single shared value: `nav-collapse-progress` ∈ [0, 1].

- **Route `/`:** Published by the existing wordmark-collapse timeline in Hero. One line is added inside its `scrollTrigger`: `onUpdate: (self) => setNavCollapseProgress(self.progress)`.
- **Every other route:** Published by a Header-owned ScrollTrigger:
  - `trigger: document.documentElement`
  - `start: 'top top-=40'`
  - `end: 'top top-=360'`
  - `scrub: 1`
  - On home, this trigger is **not** created. On other routes, the Hero pin doesn't exist, so its publisher is silent and this trigger fills the role.

Only one publisher is active at a time. The Header chooses based on `useLocation().pathname === '/'`.

### Per-element fade windows (in progress space)

Five fading elements (left to right): `Purpose`, `Notepad`, `Devotion`, `Contact`, `Social-block` (the em-dash + Social dropdown bundle).

| Element       | Local progress window |
|---------------|-----------------------|
| Purpose       | 0.150 → 0.310 |
| Notepad       | 0.210 → 0.370 |
| Devotion      | 0.270 → 0.430 |
| Contact       | 0.330 → 0.490 |
| Social-block  | 0.390 → 0.520 |

The window width is 0.16 for items 1–4 and 0.13 for the Social-block. Adjacent items overlap by 0.10 of progress (e.g., Purpose ends at 0.310, Notepad starts at 0.210), so two items are always mid-fade at once and the stagger reads as a smooth sweep, not five distinct flips.

### Per-element ease (matches wordmark waves)

Within each element's window, three independent eases on three independent properties:

- `transform: translateX(0 → +28px)` — `power3.out`
- `opacity: 1 → 0` — `power1.out`
- `filter: blur(0 → 3px)` — `power2.out`

The +28px destination is chosen relative to the existing nav `gap` (~32px) — large enough to feel intentional, small enough not to overflow the header on narrow desktop viewports.

### Hamburger entrance

Window: progress 0.45 → 0.55 (overlaps the Contact / Social exits).

- `opacity: 0 → 1` — `power2.out`
- `transform: scale(0.7) → scale(1)` — `power2.out`
- `pointer-events`: `none` below progress 0.5, `auto` above.

### Logo

No state change tied to progress. Logo remains at full opacity throughout. Existing intro animation untouched.

### Click-expand tween (separate from scrub)

When the burger is clicked while in `scrub` and progress ≥ 0.5:

```ts
gsap.to({ progress: currentProgress }, {
  progress: 0,
  duration: 0.5,
  ease: 'power2.out',
  onUpdate: function () { applyDom(this.targets()[0].progress); },
});
```

The tween writes to the same DOM refs the subscriber uses. The subscriber is gated during click-expanded so it cannot fight the tween. The burger fades+scales out as part of the same tween via its own GSAP `to` call (or by virtue of the `applyDom` helper which reads progress and updates both items and burger).

### Resync tween (separate from scrub)

When the first qualifying scroll input arrives during `click-expanded`:

```ts
const targetProgress = currentPublisherProgress; // last value the subscriber would have applied
gsap.to({ progress: 0 }, {
  progress: targetProgress,
  duration: 0.4,
  ease: 'power2.out',
  onUpdate: function () { applyDom(this.targets()[0].progress); },
  onComplete: () => { state = 'scrub'; },
});
```

Qualifying inputs (any of):
- `wheel` event (deltaY or deltaX)
- `touchmove` event
- Keys: `ArrowDown`, `ArrowUp`, `PageDown`, `PageUp`, `Home`, `End`, `Space`
- Programmatic scroll (`window.scrollY` changes between rAF samples)

The listeners are attached only while `click-expanded` and removed when `state` transitions back to `scrub`.

---

## 3. Cross-Component Communication

A tiny module-level pub/sub at `src/lib/nav-collapse-progress.ts`:

```ts
type Listener = (progress: number) => void;
const listeners = new Set<Listener>();
let current = 0;

export function setNavCollapseProgress(p: number) {
  current = p;
  listeners.forEach((l) => l(p));
}

export function subscribeNavCollapseProgress(l: Listener) {
  listeners.add(l);
  l(current);
  return () => { listeners.delete(l); };
}

export function getNavCollapseProgress() {
  return current;
}
```

- No React Context, no global store library.
- Hero calls `setNavCollapseProgress(self.progress)` from inside its existing collapse timeline's `onUpdate`.
- The Header-owned fallback ScrollTrigger (on non-home routes) calls the same setter.
- Header subscribes in a `useLayoutEffect`; the callback writes to refs (no `setState` during scroll).

Why a module-level singleton: there is exactly one Header and exactly one active progress source at any time. Context adds re-render risk; events add dispatch overhead. A `Set<Listener>` is the minimum mechanism that satisfies the requirement.

---

## 4. Component Structure

The work happens in two files. No new component files.

### `src/lib/nav-collapse-progress.ts` (new, ~20 lines)

The pub/sub module above.

### `src/components/sections/Hero.tsx` (one-line edit)

Inside the existing scroll-collapse `useLayoutEffect` at [Hero.tsx:314](../../../src/components/sections/Hero.tsx#L314), add an `onUpdate` to the timeline's `scrollTrigger` config:

```ts
scrollTrigger: {
  trigger: scrollEl,
  start: 'top top',
  end: '60% top',
  scrub: 2,
  invalidateOnRefresh: true,
  onUpdate: (self) => setNavCollapseProgress(self.progress),
},
```

That is the only change to Hero. The `gsap.context(scrollEl)` cleanup also handles publisher teardown — when Hero unmounts (route change), the trigger is killed and the publisher stops firing. The last-seen value remains in the singleton so the Header doesn't see a discontinuity.

### `src/components/layout/Header.tsx` (the bulk of the work)

New imports:

```ts
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { subscribeNavCollapseProgress, setNavCollapseProgress } from '@/lib/nav-collapse-progress';
```

New refs (desktop nav):

- `navRef: RefObject<HTMLElement>` — the existing `<nav>` element.
- `itemRefs: RefObject<HTMLElement[]>` — the 4 nav-item anchors plus the Social-block wrapper (5 entries total). Populated via a ref-callback `(el, i) => { itemRefs.current[i] = el }`.
- `burgerRef: RefObject<HTMLButtonElement>` — the new desktop hamburger.
- `stateRef: RefObject<'scrub' | 'click-expanded' | 'resyncing'>` — the active state.
- `currentProgressRef: RefObject<number>` — last applied progress, used by the click-expand tween as a starting point.

Module-scope constants for window math:

```ts
const NAV_WINDOWS = [
  { start: 0.150, end: 0.310 }, // Purpose
  { start: 0.210, end: 0.370 }, // Notepad
  { start: 0.270, end: 0.430 }, // Devotion
  { start: 0.330, end: 0.490 }, // Contact
  { start: 0.390, end: 0.520 }, // Social-block
] as const;
const BURGER_WINDOW = { start: 0.45, end: 0.55 } as const;
const ITEM_TRANSLATE_PX = 28;
const ITEM_BLUR_PX = 3;
```

`applyDom(progress)` helper inside the Header reads progress and writes inline styles to each ref:

```ts
function applyDom(progress: number) {
  currentProgressRef.current = progress;
  itemRefs.current.forEach((el, i) => {
    if (!el) return;
    const w = NAV_WINDOWS[i];
    const local = clamp01((progress - w.start) / (w.end - w.start));
    // Per-property ease (matches wordmark waves):
    const x = ITEM_TRANSLATE_PX * easePower3Out(local);
    const op = 1 - easePower1Out(local);
    const blur = ITEM_BLUR_PX * easePower2Out(local);
    el.style.transform = `translateX(${x}px)`;
    el.style.opacity = String(op);
    el.style.filter = `blur(${blur}px)`;
    // Aria + pointer events gating
    if (op < 0.05) {
      el.setAttribute('aria-hidden', 'true');
      el.style.pointerEvents = 'none';
    } else {
      el.removeAttribute('aria-hidden');
      el.style.pointerEvents = '';
    }
  });
  const burgerEl = burgerRef.current;
  if (burgerEl) {
    const local = clamp01((progress - BURGER_WINDOW.start) / (BURGER_WINDOW.end - BURGER_WINDOW.start));
    const op = easePower2Out(local);
    const scale = 0.7 + 0.3 * easePower2Out(local);
    burgerEl.style.opacity = String(op);
    burgerEl.style.transform = `scale(${scale})`;
    burgerEl.style.pointerEvents = progress >= 0.5 ? 'auto' : 'none';
    burgerEl.setAttribute('aria-expanded', stateRef.current === 'click-expanded' ? 'true' : 'false');
  }
}
```

Ease helpers are stand-alone math (`x => 1 - Math.pow(1 - x, n)` family). No GSAP dependency in `applyDom` itself — it runs hot. GSAP is only used to drive the click-expand and resync tweens.

### Effect 1 — subscribe & set up route-dependent publisher

```ts
useLayoutEffect(() => {
  let fallbackTrigger: ScrollTrigger | undefined;

  if (!isHome) {
    // Non-home: install the fallback publisher.
    fallbackTrigger = ScrollTrigger.create({
      trigger: document.documentElement,
      start: 'top top-=40',
      end: 'top top-=360',
      scrub: 1,
      onUpdate: (self) => setNavCollapseProgress(self.progress),
    });
  }

  const unsubscribe = subscribeNavCollapseProgress((p) => {
    if (stateRef.current === 'scrub') applyDom(p);
  });

  return () => {
    unsubscribe();
    fallbackTrigger?.kill();
  };
}, [isHome]);
```

### Effect 2 — click handler & expand/resync state machine

The burger's `onClick`:
1. If `stateRef.current === 'click-expanded'`: tween back to collapsed (progress `currentProgressRef.current` is 0; target = the most-recent publisher value), set state to `scrub`. The publisher's current value is read from `getNavCollapseProgress()`.
2. Otherwise: if `currentProgressRef.current >= 0.5`, tween from current progress → 0, set state to `click-expanded`, attach scroll-input listeners.

The scroll-input listener (attached only during `click-expanded`):
1. On first qualifying input: detach itself, set state to `resyncing`, tween from 0 → `getNavCollapseProgress()`, on complete set state to `scrub`.

A single `useLayoutEffect` owns the listener lifecycle, keyed off the state transitions managed via a small reducer-like helper or direct refs+effect.

### DOM additions in Header

The desktop `<nav>` block at [Header.tsx:122-228](../../../src/components/layout/Header.tsx#L122-L228) gains:

- A `ref={navRef}` and `id="primary-nav"` on the existing `<nav>`.
- A wrapping `<span>` (display: inline-block) around each of the four `WaterText` nav-item anchors. The ref callback `(el) => { itemRefs.current[index] = el }` is attached to the **wrapper span**, not to `WaterText` itself (which is not a `forwardRef` component — wrapping avoids touching it). Transform / opacity / blur on the wrapper cascade visually to the anchor inside.
- A new wrapping `<div>` around the em-dash `<span>` + the existing Social `<div class="relative group">`, so they fade as a single Social-block unit. The ref `itemRefs.current[4]` is attached to this wrapper. Existing flex `gap` on the parent `<nav>` keeps spacing identical (the wrapper itself is a flex child).
- A new sibling `<button>` for the desktop burger, after the Social-block wrapper:

```tsx
{!prefersReducedMotion && (
  <button
    ref={burgerRef}
    type="button"
    onClick={handleBurgerClick}
    aria-label="Toggle navigation"
    aria-controls="primary-nav"
    aria-expanded={false}
    className="hidden md:flex items-center justify-center w-10 h-10"
    style={{
      opacity: 0,
      transform: 'scale(0.7)',
      transformOrigin: 'center center',
      pointerEvents: 'none',
      color: textColor,
      transition: 'color 300ms ease',
    }}
  >
    <Menu className="w-6 h-6" />
  </button>
)}
```

The existing mobile burger and overlay (lines 231-309) are unchanged.

The existing nav `<span>—</span>` separator gets bundled inside the Social-block wrapper (see DOM additions above) so its fade is automatic.

`prefersReducedMotion` is added to Header via the same pattern Hero already uses ([Hero.tsx:44-47](../../../src/components/sections/Hero.tsx#L44-L47)): `useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])`. It gates both the burger DOM and the publisher/subscriber effects.

### No new React state

`useState` is not added for collapse state. The state machine uses refs, so transitions don't trigger re-renders during scroll. The visible aria attributes (`aria-expanded`, `aria-hidden`) are set imperatively in `applyDom`.

---

## 5. Reduced-Motion Fallback

When `window.matchMedia('(prefers-reduced-motion: reduce)').matches`:

- The desktop burger is **not rendered** (the `!prefersReducedMotion` gate above).
- The Header's subscriber effect short-circuits: `applyDom` is never called.
- The fallback ScrollTrigger is not created.
- The Hero's existing publisher line still fires (cheap, just calls `setNavCollapseProgress`), but no subscriber consumes it. (No-op.)

Net result: nav looks and behaves exactly as it did before this feature.

Matches the existing pattern used by the wordmark-collapse: reduced motion falls back to a static state, not an alternate animation.

---

## 6. Edge Cases

| Case | Behavior |
|------|----------|
| Refresh mid-scroll on `/` | Hero pin reads scroll position via ScrollTrigger, fires `onUpdate`, subscriber applies state. No flash. |
| Refresh mid-scroll on `/purpose/:id` | Header's fallback ScrollTrigger reads scrollY, fires `onUpdate`, subscriber applies state. No flash. |
| Route change `/` → `/purpose/:id` | Hero unmounts, its `ctx.revert()` kills the publisher. Header's `useLayoutEffect` re-runs with `isHome=false`, creates the fallback trigger. The last-seen progress value remains in the singleton, so the subscriber's next call doesn't pop. |
| Route change `/purpose/:id` → `/` | Header's `useLayoutEffect` re-runs with `isHome=true`, kills the fallback trigger. Hero mounts; its pin reinitializes; publisher resumes. |
| Click burger when local progress < 0.5 | No-op. `pointer-events: none` prevents the click entirely. |
| Click burger while already `click-expanded` | Reverse the click-expand tween back to the publisher's current value. State → `scrub`. |
| Click burger mid-`resyncing` | Allowed: cancel the resync tween, run the click-expand tween from the current applied progress. State → `click-expanded`. Detach existing listeners; re-attach when needed. |
| User clicks a nav-item link while `click-expanded` | The item's existing `onClick` fires (route navigation). Component unmounts on route change; no need to clean up state. |
| Fast scroll while `click-expanded` | First qualifying scroll input triggers resync. Subsequent inputs are scrub-driven naturally. |
| Mobile (`<md` viewport) | Desktop nav is `hidden md:flex`; desktop burger is `hidden md:flex`. The existing mobile menu path is unaffected. |
| Hero intro still playing | The collapse timeline's `useLayoutEffect` early-returns on `introActive`, so the publisher doesn't fire. Subscriber sees the initial progress = 0 from the singleton. Nav is at full opacity. |
| Existing `isScrolled` 100px padding shrink | Unchanged. It modifies the `<header>` padding; the new logic modifies the nav items' transforms. They compose cleanly. |
| ScrollTrigger leaks | Hero's `gsap.context()` reverts on unmount. Header's `fallbackTrigger?.kill()` cleans up on effect re-run / unmount. |
| Window resize | ScrollTriggers refresh via `invalidateOnRefresh: true`. Inline transforms are pixel-based but small (28px); no responsive recalculation needed. |
| Reduced-motion toggled at runtime | Page-level: the existing components key off the value at mount. A toggle would require a refresh to take effect — acceptable; matches current behavior across the app. |

---

## 7. Accessibility

- The desktop burger button:
  - `aria-label="Toggle navigation"`
  - `aria-controls="primary-nav"` (the `<nav>` element gains `id="primary-nav"`)
  - `aria-expanded` reflects state: `false` in `scrub`/`resyncing`, `true` in `click-expanded`
  - Reachable via Tab, activated by Enter or Space (default button behavior)
- Each fading nav item gets `aria-hidden="true"` when computed opacity < 0.05. The Social-block container is treated as a single unit for this purpose.
- Focus: tabbing through the page while items are faded skips them (they're hidden). If the user has focus on a nav item and the timeline scrubs the item to opacity 0, focus is **not** programmatically moved — the user can press Tab to leave it. This matches typical hidden-element behavior.
- Color contrast: unchanged. The existing nav text colors are used.

---

## 8. Visual Treatment

Pulled from the brainstorm mockups; no surprises:

- Translate magnitude: +28px rightward. Small enough not to overflow on a 1024px viewport with all items visible.
- Blur magnitude: max 3px. Reads as softening, not loss of identity.
- Burger icon: existing Lucide `Menu` icon, sized `w-6 h-6` to match the mobile burger.
- Burger placement: right edge of the header, where the rightmost nav item used to terminate. Vertically centered with the logo.
- Color: `color: textColor` — the same `rgba(0, 0, 0, 0.65)` / `rgba(255, 255, 255, 0.72)` the existing nav links use, with the same `darkText` override.

---

## 9. Verification

| Check | How |
|-------|-----|
| Scrub mapping (home) | Slow-scroll `/`. Observe: Purpose fades first, Social last. By the wordmark's A-pulse beat (progress 0.504), all items are gone, burger is ~80% visible. |
| Scrub mapping (non-home) | On `/purpose/:id`, scroll from top. Same stagger plays across 40 → 360px of scroll. |
| Reverse direction | Scroll all the way down, then up. Items reappear in reverse order (Social first, Purpose last). |
| Click-expand | At fully-collapsed state, click burger. Items tween back inline over 500ms. Burger fades out. |
| First-scroll resync | After click-expanded, wheel-scroll once. Items smoothly re-collapse to match current scroll position. Burger reappears. |
| Click-toggle | At click-expanded, click burger again. Items collapse without scroll input. |
| Aria expanded | DevTools: `document.querySelector('button[aria-controls="primary-nav"]').getAttribute('aria-expanded')` — toggles `false` ↔ `true` correctly. |
| Aria hidden on items | At progress 1.0, every nav item has `aria-hidden="true"`. |
| Pointer events | At progress < 0.5, burger is `pointer-events: none`. At progress ≥ 0.5, `pointer-events: auto`. |
| Reduced motion | Emulate `prefers-reduced-motion: reduce`. Burger is not in the DOM. Nav stays full at every scroll position. |
| Route handoff `/` → other | Navigate from home to `/purpose/foo` mid-scroll. Nav state does not jump; new fallback publisher takes over. |
| Route handoff other → `/` | Navigate from `/purpose/foo` back to `/`. Fallback trigger is killed; Hero publisher resumes. |
| Mobile breakpoint | At `< md`, desktop nav and desktop burger are not rendered. Existing mobile menu works as before. |
| Existing intro coexistence | First-visit load with intro: nav stays full through intro; collapse engages on first scroll after intro completes. |
| ScrollTrigger inventory | After several navigation cycles, `ScrollTrigger.getAll()` doesn't grow unbounded — each route change kills the prior trigger. |
| Click-expand mid-scrub | While timeline is at progress 0.3 (burger invisible), clicking does nothing. At progress 0.6, clicking expands cleanly. |

---

## 10. Open Questions

None at this time. All design decisions captured above.

---

## 11. Implementation Order (preview for the plan)

1. Add `src/lib/nav-collapse-progress.ts` with the pub/sub module.
2. Hero edit: add `onUpdate: (self) => setNavCollapseProgress(self.progress)` to the existing collapse timeline's `scrollTrigger`. Verify wordmark collapse still works.
3. Header: add `prefersReducedMotion` memo, `navRef`, `itemRefs`, `burgerRef`, `stateRef`, `currentProgressRef`. Add `id="primary-nav"` to the desktop `<nav>`. Wrap each of the four `WaterText` nav-items in a `<span>` and attach `ref` callbacks. Wrap the em-dash separator + Social `<div>` in a single `<div>` wrapper as the fifth ref.
4. Header: add the desktop burger button (gated on `md:flex && !prefersReducedMotion`).
5. Header: add the `applyDom` helper and ease utilities.
6. Header: add Effect 1 (subscribe & route-dependent publisher).
7. Header: add Effect 2 (burger click handler + state machine + scroll-input listeners).
8. Manual verification pass (Section 9).
9. Run `npm run lint`, `npm run build`. Smoke-test home and `/purpose/:id` in browser.

Implementation plan to follow via `superpowers:writing-plans`.
