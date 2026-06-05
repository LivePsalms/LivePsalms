# Mobile Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-specific home page (viewport < 768px) that preserves the desktop's 5-act narrative — Hero, MidSectionMotion, TwoPathInterlude, PurposeGrid, FinalReflectionCta — but is rebuilt for one-thumb scroll with simplified animations, the existing video render mode in place of WebGPU, scroll-snap on the purpose carousel, and a hamburger drawer for nav.

**Architecture:** Variant components, not separate routes. Each affected section file either becomes a thin dispatcher (`Hero.tsx`, `Header.tsx`) that picks between a desktop body and a mobile body, or gains a CSS/behavior branch keyed off the existing `useIsMobile()` hook at `@/hooks/use-mobile.ts`. A single `MOBILE_TIME_SCALE = 0.7` constant scales GSAP durations on the mobile paths.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind CSS v3.4, GSAP + ScrollTrigger, shadcn/ui (`Sheet`, radix dialog), Vitest + Testing Library, IntersectionObserver, `matchMedia`.

**Spec:** `docs/superpowers/specs/2026-05-28-mobile-home-page-design.md`

**Spec deviations:**
- **Hook reuse.** Spec listed `src/hooks/useIsMobile.ts` as "Create." Plan reuses the existing `@/hooks/use-mobile.ts` (same 768px breakpoint, SSR-safe) — DRY.
- **Breakpoint exact boundary.** Existing hook uses `< 768px` (matches Tailwind `md:` which is `min-width: 768px`). Spec said `≤ 768px`; the existing semantics are correct and consistent with all Tailwind `md:` classes in the repo. The 1px difference is functionally invisible.

---

## File Structure

### Create
- `src/lib/motion-scale.ts` — exports `MOBILE_TIME_SCALE = 0.7`
- `src/lib/motion-scale.test.ts`
- `src/components/sections/HeroMobile.tsx` — full mobile hero composition
- `src/components/sections/HeroMobile.test.tsx`
- `src/components/sections/HeroDesktop.tsx` — extracted body of today's `Hero.tsx` (no functional change)
- `src/components/sections/PurposeGridDots.tsx` — small dot-indicator subcomponent
- `src/components/sections/PurposeGridDots.test.tsx`
- `src/components/layout/HeaderMobile.tsx` — mobile top bar with hamburger Sheet
- `src/components/layout/HeaderMobile.test.tsx`
- `src/components/layout/HeaderDesktop.tsx` — extracted body of today's `Header.tsx` (no functional change)

### Modify
- `src/components/sections/Hero.tsx` — becomes a thin dispatcher `useIsMobile()? <HeroMobile/> : <HeroDesktop/>`
- `src/components/sections/MidSectionMotion.tsx` — `initialRenderMode()` forces `'video'` on mobile; pin ScrollTrigger constructed only when `!isMobile`
- `src/components/sections/MidSectionMotion.test.ts` (new sibling test file)
- `src/components/sections/TwoPathInterlude.tsx` — Tailwind responsive classes; `TextStaggerHover` skipped on `(hover: none)`
- `src/components/sections/PurposeGrid.tsx` — `snap-x snap-mandatory md:snap-none` on row, `snap-center` on tiles, renders `<PurposeGridDots/>` beneath on mobile
- `src/components/sections/FinalReflectionCta.tsx` — Tailwind responsive type + button width
- `src/components/layout/Header.tsx` — becomes a thin dispatcher
- `src/components/layout/Footer.tsx` — Tailwind responsive single-column stack
- `src/App.css` and/or `src/index.css` — only if `two-path-*` and footer classes need mobile-specific declarations beyond what Tailwind utilities can express

### Untouched (called out so future implementers know not to drift)
- `src/App.tsx` route composition and intro-gate logic
- `src/hooks/use-mobile.ts` (reused as-is)
- `src/components/sections/PsalmsWordmarkSvg.tsx`, `HeroMaskClipDef.tsx` (shared primitives)
- `src/components/sections/hero-bridge-content.ts`, `mid-section-motion-content.ts` (shared data)
- `src/lib/nav-collapse-progress.ts`, `nav-theme.ts` (shared global state)

---

## Task 1: Motion-scale constant

**Files:**
- Create: `src/lib/motion-scale.ts`
- Test: `src/lib/motion-scale.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/motion-scale.test.ts
import { describe, it, expect } from 'vitest';
import { MOBILE_TIME_SCALE, scaleForMobile } from './motion-scale';

describe('motion-scale', () => {
  it('exposes MOBILE_TIME_SCALE = 0.7', () => {
    expect(MOBILE_TIME_SCALE).toBe(0.7);
  });

  it('scaleForMobile returns the desktop duration when isMobile is false', () => {
    expect(scaleForMobile(1.0, false)).toBe(1.0);
  });

  it('scaleForMobile multiplies the duration by MOBILE_TIME_SCALE when isMobile is true', () => {
    expect(scaleForMobile(1.0, true)).toBeCloseTo(0.7);
    expect(scaleForMobile(2.5, true)).toBeCloseTo(1.75);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/motion-scale.test.ts`
Expected: FAIL — `Cannot find module './motion-scale'`

- [ ] **Step 3: Implement the module**

```ts
// src/lib/motion-scale.ts

/**
 * GSAP duration scaling for mobile. Mobile timings = desktop × this value.
 * Source of truth for "snappier on mobile" per the mobile home page spec.
 */
export const MOBILE_TIME_SCALE = 0.7;

export function scaleForMobile(desktopDuration: number, isMobile: boolean): number {
  return isMobile ? desktopDuration * MOBILE_TIME_SCALE : desktopDuration;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/lib/motion-scale.test.ts`
Expected: PASS — 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/motion-scale.ts src/lib/motion-scale.test.ts
git commit -m "feat(mobile): add MOBILE_TIME_SCALE constant + scaleForMobile helper"
```

---

## Task 2: Extract `HeroDesktop` (refactor, no behavior change)

`Hero.tsx` is 815 lines. We will not edit it in place. We extract today's body verbatim into `HeroDesktop.tsx`, then in Task 3 turn `Hero.tsx` itself into a thin dispatcher.

**Files:**
- Create: `src/components/sections/HeroDesktop.tsx`
- Modify: `src/components/sections/Hero.tsx` (full rewrite to dispatcher)

- [ ] **Step 1: Snapshot the existing Hero rendering as a starting point**

Run: `git mv src/components/sections/Hero.tsx src/components/sections/HeroDesktop.tsx`

- [ ] **Step 2: Rename the exported component inside the moved file**

Edit `src/components/sections/HeroDesktop.tsx`:
- Change `export function Hero({ introActive = false, onIntroComplete, onHandoff }: HeroProps)` to `export function HeroDesktop({ introActive = false, onIntroComplete, onHandoff }: HeroProps)`
- Change `interface HeroProps` to `export interface HeroProps` (so the dispatcher and the mobile sibling can reuse it)

- [ ] **Step 3: Verify the existing tests still pass against the renamed file**

Run: `npx vitest run src/components/sections/hero-intro-gate.test.ts src/components/sections/hero-bridge-content.test.ts`
Expected: PASS — both test files exercise pure helpers that don't import the component itself, so they are unaffected.

- [ ] **Step 4: Verify the build still resolves**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: TypeScript errors for `App.tsx` because it still imports `{ Hero }` from `./sections/Hero`. That's expected — Task 3 fixes it.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/HeroDesktop.tsx
git commit -m "refactor(hero): extract HeroDesktop from Hero.tsx (no behavior change)"
```

---

## Task 3: Hero dispatcher + HeroMobile shell

**Files:**
- Create: `src/components/sections/Hero.tsx` (new dispatcher)
- Create: `src/components/sections/HeroMobile.tsx` (shell that renders a static placeholder for now)
- Create: `src/components/sections/HeroMobile.test.tsx`

- [ ] **Step 1: Write the failing dispatcher test**

```tsx
// src/components/sections/HeroMobile.test.tsx
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

// Stub matchMedia for the entire suite — covered by jsdom but with default false.
// Each test overrides as needed.
function setMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(cleanup);

describe('Hero dispatcher', () => {
  beforeEach(() => {
    // Below the mobile breakpoint
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia(true);
  });

  it('renders HeroMobile below 768px', async () => {
    const { Hero } = await import('./Hero');
    render(<Hero introActive={false} />);
    expect(screen.getByTestId('hero-mobile')).toBeInTheDocument();
    expect(screen.queryByTestId('hero-desktop')).not.toBeInTheDocument();
  });

  it('renders HeroDesktop at or above 768px', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    setMatchMedia(false);
    vi.resetModules();
    const { Hero } = await import('./Hero');
    render(<Hero introActive={false} />);
    expect(screen.getByTestId('hero-desktop')).toBeInTheDocument();
    expect(screen.queryByTestId('hero-mobile')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/sections/HeroMobile.test.tsx`
Expected: FAIL — Hero module not found / data-testids missing.

- [ ] **Step 3: Create the HeroMobile shell**

```tsx
// src/components/sections/HeroMobile.tsx
import type { HeroProps } from './HeroDesktop';

/**
 * Mobile-specific Hero composition. Same 4 beats as desktop —
 * wordmark intro, scroll-collapse (shortened), static silhouette image,
 * quote sequence (cross-fade), bridge copy — rebuilt for one-thumb scroll.
 * Built out across Tasks 4-7. This is the shell only.
 */
export function HeroMobile({ introActive = false, onIntroComplete, onHandoff }: HeroProps) {
  return (
    <div data-testid="hero-mobile" data-intro-active={introActive ? 'true' : 'false'}>
      {/* Beats are wired in Tasks 4-7. */}
    </div>
  );
}
```

Add a `data-testid` to `HeroDesktop`'s root wrapper. Open `src/components/sections/HeroDesktop.tsx` and find the outermost returned element (a `<div ref={heroRef} …>` near the end of the file). Add `data-testid="hero-desktop"` to that div.

- [ ] **Step 4: Create the dispatcher**

```tsx
// src/components/sections/Hero.tsx
import { useIsMobile } from '@/hooks/use-mobile';
import { HeroDesktop, type HeroProps } from './HeroDesktop';
import { HeroMobile } from './HeroMobile';

export type { HeroProps };

export function Hero(props: HeroProps) {
  const isMobile = useIsMobile();
  return isMobile ? <HeroMobile {...props} /> : <HeroDesktop {...props} />;
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npx vitest run src/components/sections/HeroMobile.test.tsx`
Expected: PASS — 2 tests pass

- [ ] **Step 6: Run the typechecker to confirm imports resolve**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: No errors. `App.tsx`'s `import { Hero } from '@/components/sections/Hero'` resolves to the new dispatcher's `Hero` export.

- [ ] **Step 7: Commit**

```bash
git add src/components/sections/Hero.tsx src/components/sections/HeroMobile.tsx src/components/sections/HeroMobile.test.tsx src/components/sections/HeroDesktop.tsx
git commit -m "feat(hero): dispatcher + HeroMobile shell, HeroDesktop testid"
```

---

## Task 4: HeroMobile — wordmark + static silhouette image

The mobile hero shows the PSALMS wordmark with the silhouette image masked beneath. No video. No scroll-collapse yet (Task 5).

**Files:**
- Modify: `src/components/sections/HeroMobile.tsx`
- Modify: `src/components/sections/HeroMobile.test.tsx`

- [ ] **Step 1: Add the "no `<video>` element" test**

Append to `HeroMobile.test.tsx`:

```tsx
describe('HeroMobile content', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia(true);
  });

  it('renders the PSALMS wordmark', async () => {
    const { Hero } = await import('./Hero');
    render(<Hero introActive={false} />);
    // PsalmsWordmarkSvg renders an SVG with role="img" + aria-label.
    expect(screen.getByLabelText(/psalms/i)).toBeInTheDocument();
  });

  it('does NOT render a <video> element', async () => {
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    expect(container.querySelector('video')).toBeNull();
  });

  it('renders the silhouette image as an <img>', async () => {
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    expect(container.querySelector('img[alt]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/sections/HeroMobile.test.tsx`
Expected: FAIL — no wordmark, no `<img>`, but no `<video>` already passes.

- [ ] **Step 3: Find the silhouette image source used by HeroDesktop**

Open `src/components/sections/HeroDesktop.tsx` and locate the `<img ref={maskImgRef} ... />` element. Note its `src` and `alt` attributes. The same asset is the mobile silhouette.

- [ ] **Step 4: Build the HeroMobile body**

```tsx
// src/components/sections/HeroMobile.tsx
import { useEffect, useRef } from 'react';
import { PsalmsWordmarkSvg } from './PsalmsWordmarkSvg';
import type { HeroProps } from './HeroDesktop';

const SILHOUETTE_SRC = '/hero/silhouette.jpg'; // Replace with the actual src copied from HeroDesktop's <img ref={maskImgRef}>
const SILHOUETTE_ALT = 'A solitary figure in soft light';   // Replace with HeroDesktop's <img alt>

export function HeroMobile({ introActive = false, onIntroComplete, onHandoff }: HeroProps) {
  const introFiredRef = useRef(false);

  // The intro gate's "completion" beat on mobile fires immediately when introActive
  // is true so that the App.tsx handoff state advances. Mobile does not run the
  // long letter-spread intro; the wordmark renders settled, then the rest of the
  // sequence (Tasks 5-7) runs on scroll.
  useEffect(() => {
    if (!introActive || introFiredRef.current) return;
    introFiredRef.current = true;
    onIntroComplete?.();
    onHandoff?.();
  }, [introActive, onIntroComplete, onHandoff]);

  return (
    <div data-testid="hero-mobile" className="relative w-full min-h-[100svh] bg-[var(--deep-umber)] text-[color:var(--bone)]">
      <div className="relative w-full flex flex-col items-center justify-center pt-24 pb-12 px-5 gap-8">
        <PsalmsWordmarkSvg className="w-[88vw] max-w-md" />
        <img
          src={SILHOUETTE_SRC}
          alt={SILHOUETTE_ALT}
          className="w-[88vw] max-w-md aspect-[4/5] object-cover opacity-90"
          loading="eager"
          decoding="async"
        />
      </div>
    </div>
  );
}
```

> **Note:** Replace `SILHOUETTE_SRC` and `SILHOUETTE_ALT` with the literal strings from `HeroDesktop.tsx`'s `<img ref={maskImgRef} ... />` — do not invent paths.

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npx vitest run src/components/sections/HeroMobile.test.tsx`
Expected: PASS — 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/HeroMobile.tsx src/components/sections/HeroMobile.test.tsx
git commit -m "feat(hero-mobile): wordmark + static silhouette image (no video)"
```

---

## Task 5: HeroMobile — shortened scroll-collapse

The collapse animation tweens the wordmark letters toward the central A as the user scrolls. On mobile we keep the effect but shorten the pin distance to ~60vh.

**Files:**
- Modify: `src/components/sections/HeroMobile.tsx`

- [ ] **Step 1: Read the desktop collapse implementation to learn the math**

Read `HeroDesktop.tsx` for the `collapseScrollRef` ScrollTrigger and the `COLLAPSE` table. Note the per-letter destinations and the eased tween.

- [ ] **Step 2: Add the collapse path to HeroMobile**

In `HeroMobile.tsx`, add:

```tsx
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MOBILE_TIME_SCALE } from '@/lib/motion-scale';

gsap.registerPlugin(ScrollTrigger);

const COLLAPSE = { P: 653.3, S1: 339.8, L: -313.9, M: -690.5, S2: -1076.4 } as const;
const MOBILE_COLLAPSE_VH = 60; // pin distance ≤ 60vh per spec
```

Inside the component, add a ref for the wordmark SVG (`svgRef`) and an effect that builds a ScrollTrigger keyed to that pin distance. Reduce-motion users skip it entirely.

```tsx
const svgRef = useRef<SVGSVGElement>(null);

const prefersReducedMotion = useMemo(() => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}, []);

useLayoutEffect(() => {
  const svg = svgRef.current;
  if (!svg || prefersReducedMotion) return;

  const letters = {
    P: svg.querySelector<SVGGElement>('[data-letter="P"]'),
    S1: svg.querySelector<SVGGElement>('[data-letter="S1"]'),
    L: svg.querySelector<SVGGElement>('[data-letter="L"]'),
    M: svg.querySelector<SVGGElement>('[data-letter="M"]'),
    S2: svg.querySelector<SVGGElement>('[data-letter="S2"]'),
  };
  if (!letters.P || !letters.S1 || !letters.L || !letters.M || !letters.S2) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: svg,
      start: 'top top',
      end: `+=${window.innerHeight * (MOBILE_COLLAPSE_VH / 100)}`,
      scrub: 1 * MOBILE_TIME_SCALE,
      pin: false,  // No pinning on mobile — address bar resize fights pins.
    },
  });

  tl.to(letters.P,  { x: COLLAPSE.P,  ease: 'power2.inOut' }, 0)
    .to(letters.S1, { x: COLLAPSE.S1, ease: 'power2.inOut' }, 0)
    .to(letters.L,  { x: COLLAPSE.L,  ease: 'power2.inOut' }, 0)
    .to(letters.M,  { x: COLLAPSE.M,  ease: 'power2.inOut' }, 0)
    .to(letters.S2, { x: COLLAPSE.S2, ease: 'power2.inOut' }, 0);

  return () => {
    tl.scrollTrigger?.kill();
    tl.kill();
  };
}, [prefersReducedMotion]);
```

Pass `ref={svgRef}` to the `<PsalmsWordmarkSvg>`. If `PsalmsWordmarkSvg` does not currently forward refs, wrap with `forwardRef` in that file (one-line change) or render the SVG inline with the same internals — pick the smaller change after reading the component.

- [ ] **Step 3: Add a reduced-motion test**

Append to `HeroMobile.test.tsx`:

```tsx
it('skips the collapse animation when prefers-reduced-motion is set', async () => {
  Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('reduce') || query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  vi.resetModules();
  const { Hero } = await import('./Hero');
  // Render and unmount cleanly — assertion is that no GSAP-triggered errors
  // occur (jsdom has no layout, so absence of crash is the contract).
  const { unmount } = render(<Hero introActive={false} />);
  expect(() => unmount()).not.toThrow();
});
```

- [ ] **Step 4: Run all hero tests**

Run: `npx vitest run src/components/sections/HeroMobile.test.tsx`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/HeroMobile.tsx src/components/sections/HeroMobile.test.tsx
git commit -m "feat(hero-mobile): shortened scroll-collapse (60vh, no pin)"
```

---

## Task 6: HeroMobile — quote sequence (IntersectionObserver cross-fade)

The desktop hero runs a scroll-progress quote sequence. Mobile fades the same three lines in once visible, without scroll-progress.

**Files:**
- Modify: `src/components/sections/HeroMobile.tsx`

- [ ] **Step 1: Find the quote copy in HeroDesktop**

Open `HeroDesktop.tsx` and locate `quoteLine1Ref`, `quoteLine2Ref`, `quoteAttrRef` and the literal text rendered through them. Copy the literal strings — same content used on mobile.

- [ ] **Step 2: Add the quote block**

In `HeroMobile.tsx`, below the silhouette image:

```tsx
import { useEffect, useRef, useState } from 'react';

// inside the component body:
const quoteRef = useRef<HTMLDivElement>(null);
const [quoteVisible, setQuoteVisible] = useState(false);

useEffect(() => {
  const node = quoteRef.current;
  if (!node) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setQuoteVisible(true);
        observer.disconnect();
      }
    },
    { threshold: 0.4 },
  );
  observer.observe(node);
  return () => observer.disconnect();
}, []);
```

And in the JSX, after the silhouette image:

```tsx
<div
  ref={quoteRef}
  data-testid="hero-mobile-quote"
  data-visible={quoteVisible ? 'true' : 'false'}
  className={[
    'mt-12 text-center px-6 transition-opacity duration-1000',
    quoteVisible ? 'opacity-100' : 'opacity-0',
  ].join(' ')}
>
  <p className="quote-text italic text-[15px] leading-relaxed">
    {/* QUOTE_LINE_1 from HeroDesktop */}
  </p>
  <p className="quote-text italic text-[15px] leading-relaxed mt-2">
    {/* QUOTE_LINE_2 from HeroDesktop */}
  </p>
  <p className="quote-attr text-xs opacity-60 mt-4">
    {/* QUOTE_ATTRIBUTION from HeroDesktop */}
  </p>
</div>
```

Replace the three comment-placeholders with the literal strings copied in Step 1.

- [ ] **Step 3: Add a quote-visibility test**

Append to `HeroMobile.test.tsx`:

```tsx
it('renders the quote container initially hidden, then visible after intersection', async () => {
  Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
  setMatchMedia(true);

  // IntersectionObserver mock that immediately reports intersection on observe
  const observe = vi.fn((node: Element) => {
    // Microtask resolves after render
    queueMicrotask(() => {
      (globalThis as { __ioCallback?: (entries: IntersectionObserverEntry[]) => void }).__ioCallback?.([
        { isIntersecting: true, target: node } as IntersectionObserverEntry,
      ]);
    });
  });
  class MockIO {
    constructor(cb: (entries: IntersectionObserverEntry[]) => void) {
      (globalThis as { __ioCallback?: (entries: IntersectionObserverEntry[]) => void }).__ioCallback = cb;
    }
    observe = observe;
    disconnect = vi.fn();
    unobserve = vi.fn();
    takeRecords = vi.fn();
    root = null; rootMargin = ''; thresholds = [];
  }
  vi.stubGlobal('IntersectionObserver', MockIO);

  vi.resetModules();
  const { Hero } = await import('./Hero');
  const { findByTestId } = render(<Hero introActive={false} />);
  const quote = await findByTestId('hero-mobile-quote');
  // Allow the microtask + state flush
  await new Promise((r) => setTimeout(r, 0));
  expect(quote.getAttribute('data-visible')).toBe('true');

  vi.unstubAllGlobals();
});
```

- [ ] **Step 4: Run all hero tests**

Run: `npx vitest run src/components/sections/HeroMobile.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/HeroMobile.tsx src/components/sections/HeroMobile.test.tsx
git commit -m "feat(hero-mobile): quote sequence cross-fade via IntersectionObserver"
```

---

## Task 7: HeroMobile — bridge copy stack

The desktop bridge has three vertically-paced lines (invite / thesis / assure). Mobile stacks them and fades them in identically.

**Files:**
- Modify: `src/components/sections/HeroMobile.tsx`

- [ ] **Step 1: Reuse BRIDGE_COPY from existing data module**

```tsx
import { BRIDGE_COPY } from './hero-bridge-content';
```

- [ ] **Step 2: Render the three lines with the same IntersectionObserver pattern**

Below the quote block in `HeroMobile.tsx`:

```tsx
const bridgeRef = useRef<HTMLDivElement>(null);
const [bridgeVisible, setBridgeVisible] = useState(false);

useEffect(() => {
  const node = bridgeRef.current;
  if (!node) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setBridgeVisible(true);
        observer.disconnect();
      }
    },
    { threshold: 0.3 },
  );
  observer.observe(node);
  return () => observer.disconnect();
}, []);
```

JSX, after the quote:

```tsx
<div
  ref={bridgeRef}
  data-testid="hero-mobile-bridge"
  data-visible={bridgeVisible ? 'true' : 'false'}
  className="mt-16 mb-24 text-center px-6 flex flex-col gap-8"
>
  <p
    className={['bridge-invite text-[15px] leading-relaxed transition-opacity duration-700',
      bridgeVisible ? 'opacity-100' : 'opacity-0'].join(' ')}
  >
    {BRIDGE_COPY.invite}
  </p>
  <p
    className={['bridge-thesis text-[15px] leading-relaxed transition-opacity duration-700 delay-200',
      bridgeVisible ? 'opacity-100' : 'opacity-0'].join(' ')}
  >
    {BRIDGE_COPY.thesis}
  </p>
  <p
    className={['bridge-line-center text-[15px] leading-relaxed transition-opacity duration-700 delay-500',
      bridgeVisible ? 'opacity-100' : 'opacity-0'].join(' ')}
  >
    {BRIDGE_COPY.assure}
  </p>
</div>
```

> **If `BRIDGE_COPY` keys differ from `invite`/`thesis`/`assure`** — open `hero-bridge-content.ts` first and use the actual exported keys.

- [ ] **Step 3: Add a bridge-render test**

Append to `HeroMobile.test.tsx`:

```tsx
it('renders all three BRIDGE_COPY lines', async () => {
  Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
  setMatchMedia(true);
  vi.resetModules();
  const { BRIDGE_COPY } = await import('./hero-bridge-content');
  const { Hero } = await import('./Hero');
  render(<Hero introActive={false} />);
  expect(screen.getByText(BRIDGE_COPY.invite)).toBeInTheDocument();
  expect(screen.getByText(BRIDGE_COPY.thesis)).toBeInTheDocument();
  expect(screen.getByText(BRIDGE_COPY.assure)).toBeInTheDocument();
});
```

- [ ] **Step 4: Run all hero tests**

Run: `npx vitest run src/components/sections/HeroMobile.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/HeroMobile.tsx src/components/sections/HeroMobile.test.tsx
git commit -m "feat(hero-mobile): bridge copy stack with staggered fade-in"
```

---

## Task 8: MidSectionMotion — force video on mobile + skip pin

**Files:**
- Modify: `src/components/sections/MidSectionMotion.tsx`
- Create: `src/components/sections/MidSectionMotion.test.ts`

- [ ] **Step 1: Write the failing render-mode test**

```ts
// src/components/sections/MidSectionMotion.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('initialRenderMode (mobile branch)', () => {
  let originalGpu: unknown;
  beforeEach(() => {
    originalGpu = (navigator as unknown as { gpu?: unknown }).gpu;
    (navigator as unknown as { gpu: unknown }).gpu = {}; // simulate WebGPU available
  });
  afterEach(() => {
    if (originalGpu === undefined) {
      delete (navigator as unknown as { gpu?: unknown }).gpu;
    } else {
      (navigator as unknown as { gpu: unknown }).gpu = originalGpu;
    }
    vi.restoreAllMocks();
  });

  it('returns "video" on mobile even when WebGPU is available', async () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes('max-width'), // mobile = true; reduced-motion = false
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    vi.resetModules();
    const mod = await import('./MidSectionMotion');
    // The module exports the function for tests. If not yet exported, this test
    // drives that change as part of Step 3.
    expect(mod.initialRenderMode()).toBe('video');
  });

  it('returns "webgpu" on desktop when WebGPU is available', async () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    vi.resetModules();
    const mod = await import('./MidSectionMotion');
    expect(mod.initialRenderMode()).toBe('webgpu');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/sections/MidSectionMotion.test.ts`
Expected: FAIL — `initialRenderMode` is not exported, or doesn't gate on width.

- [ ] **Step 3: Update `MidSectionMotion.tsx`**

In `MidSectionMotion.tsx`:

```ts
// Add to the imports near the top:
const MOBILE_BREAKPOINT = 768;

// Replace the existing initialRenderMode body:
export function initialRenderMode(): RenderMode {
  if (typeof window === 'undefined') return 'video';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced';
  if (window.innerWidth < MOBILE_BREAKPOINT) return 'video';
  if ('gpu' in navigator) return 'webgpu';
  return 'video';
}
```

Note: also `export` the function (it was previously module-local).

- [ ] **Step 4: Skip the pin on mobile**

In the same file, find the ScrollTrigger that pins the stage (look for `pin: true` or `pin: stageRef.current` inside a `ScrollTrigger.create({ ... })`). Wrap its creation in a guard:

```ts
const isMobileViewport =
  typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;

if (!isMobileViewport) {
  const pinST = ScrollTrigger.create({
    // existing pin config
  });
  // existing cleanup also conditioned on !isMobileViewport
}
```

The reduced-motion path that runs IntersectionObserver instead of a pinned timeline is already in place — mobile reuses it implicitly by also taking a non-pinned path. Verify the existing `reducedBeatRefs` IntersectionObserver fades the BEAT copy when the section enters view; if it's gated on `renderMode === 'reduced'`, broaden the gate to `renderMode === 'reduced' || isMobileViewport`.

- [ ] **Step 5: Run all related tests**

Run: `npx vitest run src/components/sections/MidSectionMotion.test.ts src/components/sections/mid-section-intensity.test.ts src/components/sections/mid-section-motion-content.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/MidSectionMotion.tsx src/components/sections/MidSectionMotion.test.ts
git commit -m "feat(mid-section): force video mode + skip pin on mobile"
```

---

## Task 9: TwoPathInterlude — vertical stack + touch-hover collapse

**Files:**
- Modify: `src/components/sections/TwoPathInterlude.tsx`
- Possibly modify: `src/App.css` (only if the `two-path-*` CSS rules use absolute positioning that needs a mobile override)

- [ ] **Step 1: Inspect the existing CSS for `two-path-*`**

Run: `grep -n "two-path-" src/App.css src/index.css`

If the existing rules use CSS Grid / absolute positioning that fights a single-column layout, add a mobile override block. Otherwise the component-level Tailwind classes are sufficient.

- [ ] **Step 2: Update the component to stack on mobile**

In `TwoPathInterlude.tsx`, on the outer `<section>` add the Tailwind utility classes that override the existing class-based layout:

```tsx
<section
  ref={sectionRef}
  className="two-path-interlude flex flex-col md:grid"
  data-entered="false"
  aria-label="Two ways to continue"
>
```

(Use `md:grid` or `md:flex-row` to match whatever the desktop's `.two-path-interlude` class currently uses — read the CSS first and pick the right override.)

Above the existing `two-path-hairline`, add a mobile-only "— or —" label between the columns:

```tsx
<div
  ref={hairlineRef}
  className="two-path-hairline hidden md:block"
  aria-hidden="true"
/>
<div className="md:hidden text-center text-xs tracking-[0.2em] opacity-50 my-6">
  — or —
</div>
```

Reorder JSX so the "— or —" sits between the two `two-path-col` blocks.

- [ ] **Step 3: Disable hover stagger on touch devices**

The `TextStaggerHover` component is built for hover. On touch (`(hover: none)`) it should render the static state. Wrap each `<TextStaggerHover>` usage:

```tsx
import { useEffect, useState } from 'react';

function useIsHoverable(): boolean {
  const [hoverable, setHoverable] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(hover: hover)').matches,
  );
  useEffect(() => {
    const mql = window.matchMedia('(hover: hover)');
    const onChange = () => setHoverable(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return hoverable;
}
```

Use it in the render:

```tsx
const hoverable = useIsHoverable();

// ...
{hoverable ? (
  <TextStaggerHover as="span" className="two-path-cta-label">
    <TextStaggerHoverActive animation="blur">Read Below</TextStaggerHoverActive>
    <TextStaggerHoverHidden animation="blur">Read Below</TextStaggerHoverHidden>
  </TextStaggerHover>
) : (
  <span className="two-path-cta-label">Read Below</span>
)}
```

Do the same for "Go to Notepad".

- [ ] **Step 4: Add a snapshot test for the touch-hover branch**

Create `src/components/sections/TwoPathInterlude.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { TwoPathInterlude } from './TwoPathInterlude';

afterEach(cleanup);

describe('TwoPathInterlude on touch devices', () => {
  it('renders plain CTA labels (no TextStaggerHover) when (hover: none) matches', () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes('hover: hover') ? false : true, // hoverable = false
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    render(
      <MemoryRouter>
        <TwoPathInterlude />
      </MemoryRouter>,
    );

    // "Read Below" and "Go to Notepad" each appear once (as plain spans),
    // not twice (which would mean Active + Hidden duplicates from TextStaggerHover).
    expect(screen.getAllByText('Read Below').length).toBe(1);
    expect(screen.getAllByText('Go to Notepad').length).toBe(1);
  });
});
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/components/sections/TwoPathInterlude.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/TwoPathInterlude.tsx src/components/sections/TwoPathInterlude.test.tsx
git commit -m "feat(two-path): vertical stack + (hover: none) plain CTAs on mobile"
```

---

## Task 10: PurposeGrid — scroll-snap + dot indicator

**Files:**
- Modify: `src/components/sections/PurposeGrid.tsx`
- Create: `src/components/sections/PurposeGridDots.tsx`
- Create: `src/components/sections/PurposeGridDots.test.tsx`

- [ ] **Step 1: Write the failing PurposeGridDots test**

```tsx
// src/components/sections/PurposeGridDots.test.tsx
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { PurposeGridDots } from './PurposeGridDots';

afterEach(cleanup);

describe('PurposeGridDots', () => {
  const projects = [
    { id: 'a', name: 'Aleph' },
    { id: 'b', name: 'Beth' },
    { id: 'c', name: 'Gimel' },
  ];

  it('renders one dot per project', () => {
    render(<PurposeGridDots projects={projects} activeId="a" />);
    expect(screen.getAllByRole('presentation')).toHaveLength(3);
  });

  it('marks the dot whose id matches activeId as active', () => {
    render(<PurposeGridDots projects={projects} activeId="b" />);
    const dots = screen.getAllByRole('presentation');
    expect(dots[0].getAttribute('data-active')).toBe('false');
    expect(dots[1].getAttribute('data-active')).toBe('true');
    expect(dots[2].getAttribute('data-active')).toBe('false');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/sections/PurposeGridDots.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement PurposeGridDots**

```tsx
// src/components/sections/PurposeGridDots.tsx

interface PurposeGridDotsProps {
  projects: Array<{ id: string; name?: string }>;
  activeId: string | null;
}

export function PurposeGridDots({ projects, activeId }: PurposeGridDotsProps) {
  return (
    <div
      className="md:hidden flex justify-center gap-1.5 mt-4"
      aria-hidden="true"
    >
      {projects.map((p) => {
        const active = p.id === activeId;
        return (
          <span
            key={p.id}
            role="presentation"
            data-active={active ? 'true' : 'false'}
            className={[
              'h-1.5 w-1.5 rounded-full transition-opacity duration-200',
              active ? 'bg-current opacity-100' : 'bg-current opacity-30',
            ].join(' ')}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/components/sections/PurposeGridDots.test.tsx`
Expected: PASS — 2 tests pass.

- [ ] **Step 5: Wire PurposeGridDots into PurposeGrid**

In `PurposeGrid.tsx`:

1. Find the existing row container — the `<div>` with `className="relative flex w-full items-end gap-1 px-0 overflow-x-auto md:overflow-visible"` (around `PurposeGrid.tsx:497`). Add `snap-x snap-mandatory md:snap-none` to its `className`.
2. Find the per-tile container (the `pg-img` wrapper around `PurposeGrid.tsx:90`). Add `snap-center md:snap-align-none` to its className.
3. Track the active tile via IntersectionObserver. Above the JSX return, add:

```tsx
import { useEffect, useState } from 'react';
import { PurposeGridDots } from './PurposeGridDots';

const [activeId, setActiveId] = useState<string | null>(null);
const tileRefs = useRef<Map<string, HTMLElement>>(new Map());

useEffect(() => {
  // Watch viewport-center intersection on each tile so the dot indicator
  // tracks the snapped tile.
  const observers: IntersectionObserver[] = [];
  tileRefs.current.forEach((node, id) => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          setActiveId(id);
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    obs.observe(node);
    observers.push(obs);
  });
  return () => observers.forEach((o) => o.disconnect());
}, [projects.length]);
```

4. In the per-tile JSX, register the ref:

```tsx
<div
  ref={(el) => {
    if (el) tileRefs.current.set(project.id, el);
    else tileRefs.current.delete(project.id);
  }}
  // ... existing className with snap-center md:snap-align-none appended
  data-project-id={project.id}
>
```

5. Below the row container, render the dots:

```tsx
<PurposeGridDots projects={projects} activeId={activeId} />
```

- [ ] **Step 6: Verify PurposeGrid's existing tests still pass**

Run: `npx vitest run src/components/sections/purpose-stack-data.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/sections/PurposeGridDots.tsx src/components/sections/PurposeGridDots.test.tsx src/components/sections/PurposeGrid.tsx
git commit -m "feat(purpose-grid): scroll-snap carousel + dot indicator on mobile"
```

---

## Task 11: FinalReflectionCta — responsive type + button width

**Files:**
- Modify: `src/components/sections/FinalReflectionCta.tsx`

- [ ] **Step 1: Locate the headline and button elements**

In `FinalReflectionCta.tsx`, find:
- The headline (likely a `<h2>` or large text element near the top of the section).
- The CTA button (look for `button` or `Link` with the existing `final-reflection-cta` class).

- [ ] **Step 2: Add mobile-specific scaling via Tailwind**

Add to the headline `className`: `text-2xl md:text-5xl leading-tight md:leading-tight` (preserve whatever desktop class is currently there as the `md:` value).

Add to the CTA: `max-w-[70vw] md:max-w-none w-full md:w-auto px-6 md:px-8`.

Tighten the section padding for mobile if needed: the wrapping `<section>` already has `py-32 md:py-40 px-4 md:px-8` (per `FinalReflectionCta.tsx:92`). That is already mobile-tuned — no change needed.

- [ ] **Step 3: Verify the section still renders and the existing tests pass**

Run: `npx vitest run src/components/sections/`
Expected: PASS — no test for this file currently exists; rest of section tests stay green.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/FinalReflectionCta.tsx
git commit -m "feat(final-cta): mobile responsive type scale + clamped button width"
```

---

## Task 12: HeaderMobile component (Sheet drawer)

**Files:**
- Create: `src/components/layout/HeaderMobile.tsx`
- Create: `src/components/layout/HeaderMobile.test.tsx`

- [ ] **Step 1: Write the failing HeaderMobile test**

```tsx
// src/components/layout/HeaderMobile.test.tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { HeaderMobile } from './HeaderMobile';

afterEach(cleanup);

describe('HeaderMobile', () => {
  it('renders a compact top bar with the PSALMS wordmark and a menu button', () => {
    render(
      <MemoryRouter>
        <HeaderMobile onNavTrigger={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/psalms/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('opens the drawer when the menu button is tapped', () => {
    render(
      <MemoryRouter>
        <HeaderMobile onNavTrigger={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    // The Sheet renders nav items inside a dialog
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /purpose/i })).toBeInTheDocument();
  });

  it('fires onNavTrigger when a nav link is tapped', () => {
    const onNavTrigger = vi.fn();
    render(
      <MemoryRouter>
        <HeaderMobile onNavTrigger={onNavTrigger} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    fireEvent.click(screen.getByRole('link', { name: /purpose/i }));
    expect(onNavTrigger).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/layout/HeaderMobile.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement HeaderMobile**

First, inspect the existing nav data: `src/data/projects.ts` exports `navItems`. Open it and confirm the shape (`{ label: string; href: string }` or similar).

Then create:

```tsx
// src/components/layout/HeaderMobile.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { PsalmsWordmarkSvg } from '@/components/sections/PsalmsWordmarkSvg';
import { navItems } from '@/data/projects';

interface HeaderMobileProps {
  onNavTrigger: () => void;
}

const TRIGGER_LABELS = new Set(['Purpose', 'Notepad', 'Community', 'Contact']);

export function HeaderMobile({ onNavTrigger }: HeaderMobileProps) {
  const [open, setOpen] = useState(false);

  return (
    <header
      data-testid="header-mobile"
      className="fixed top-0 left-0 right-0 z-40 h-14 px-4 flex items-center justify-between bg-[var(--deep-umber)]/90 backdrop-blur-sm text-[color:var(--bone)]"
      role="banner"
    >
      <Link to="/" aria-label="PSALMS — home" className="block">
        <PsalmsWordmarkSvg className="h-5 w-auto" />
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open menu"
            className="h-11 w-11 inline-flex items-center justify-center"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-3/4 sm:w-1/2 bg-[var(--deep-umber)] text-[color:var(--bone)]">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <nav className="mt-12 flex flex-col gap-6 text-lg" aria-label="Mobile primary">
            {navItems.map((item) => (
              <SheetClose asChild key={item.label}>
                <Link
                  to={item.href}
                  className="block py-3 min-h-[44px]"
                  onClick={() => {
                    if (TRIGGER_LABELS.has(item.label)) onNavTrigger();
                  }}
                >
                  {item.label}
                </Link>
              </SheetClose>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
```

> **If `navItems` uses `name`/`path` instead of `label`/`href`** — open `src/data/projects.ts` and use the actual field names.
> **If `Sheet`'s `SheetTitle` export differs in `src/components/ui/sheet.tsx`** — read the file and import the real name. Many shadcn variants expose `SheetHeader` instead.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/components/layout/HeaderMobile.test.tsx`
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/HeaderMobile.tsx src/components/layout/HeaderMobile.test.tsx
git commit -m "feat(header-mobile): compact top bar + Sheet drawer"
```

---

## Task 13: Header dispatcher + HeaderDesktop extraction

Same pattern as Hero: extract today's Header body into `HeaderDesktop`, then `Header.tsx` becomes the dispatcher.

**Files:**
- Modify: `src/components/layout/Header.tsx` → split into dispatcher
- Create: `src/components/layout/HeaderDesktop.tsx`

- [ ] **Step 1: Rename Header.tsx → HeaderDesktop.tsx**

Run: `git mv src/components/layout/Header.tsx src/components/layout/HeaderDesktop.tsx`

- [ ] **Step 2: Update the export name and Props**

Inside `HeaderDesktop.tsx`:
- Find the exported function (`export function Header(...) {`) and rename to `export function HeaderDesktop(...) {`.
- If a `HeaderProps` interface exists, export it: `export interface HeaderProps { ... }`. If not, create one matching the current call signature in `App.tsx` (look at `<Header onNavTrigger={...} headerVisible={...} introActive={...} />` etc. and capture the prop names + types).

- [ ] **Step 3: Create the dispatcher**

```tsx
// src/components/layout/Header.tsx
import { useIsMobile } from '@/hooks/use-mobile';
import { HeaderDesktop, type HeaderProps } from './HeaderDesktop';
import { HeaderMobile } from './HeaderMobile';

export type { HeaderProps };

export function Header(props: HeaderProps) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <HeaderMobile onNavTrigger={props.onNavTrigger} />;
  }
  return <HeaderDesktop {...props} />;
}
```

> **Note:** `HeaderMobile` only accepts `onNavTrigger`. The other Header props (visibility, intro coordination) are desktop-only — the static mobile bar doesn't participate in the nav-collapse choreography.

- [ ] **Step 4: Verify the build and tests**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/components/layout/`
Expected: No type errors. Tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Header.tsx src/components/layout/HeaderDesktop.tsx
git commit -m "refactor(header): dispatcher + extracted HeaderDesktop"
```

---

## Task 14: Footer — single-column stack on mobile

**Files:**
- Modify: `src/components/layout/Footer.tsx`

- [ ] **Step 1: Identify the existing grid/column wrapper**

In `Footer.tsx`, read the JSX block (after `useEffect`) and find the wrapper that lays out footer content side-by-side on desktop. Typical pattern is a `<div className="grid grid-cols-...">` or `<div className="flex">`.

- [ ] **Step 2: Add mobile-stack utilities**

For each multi-column wrapper, prepend mobile classes. Examples:

- `grid grid-cols-3` → `grid grid-cols-1 md:grid-cols-3`
- `flex flex-row` → `flex flex-col md:flex-row`
- `gap-12` → `gap-8 md:gap-12`

Tighten padding/font-size on mobile if currently uniform: e.g. `text-base md:text-base`, `py-8 md:py-12`.

The GSAP `from('.footer-animate', ...)` reveal can stay — it's idempotent across viewports.

- [ ] **Step 3: Confirm nothing else regressed**

Run: `npx vitest run src/`
Expected: PASS (no Footer-specific tests exist; this is a visual CSS change).

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Footer.tsx
git commit -m "feat(footer): single-column stack + tightened spacing on mobile"
```

---

## Task 15: Visual smoke check + suite-level validation

**Files:** None — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all tests green.

- [ ] **Step 2: Run the typechecker**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: No errors.

- [ ] **Step 3: Run the linter**

Run: `npx eslint src --max-warnings 0`
Expected: No errors.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Manual smoke (golden path)**

Start the dev server: `npm run dev`

In Chrome DevTools, toggle device emulation to **iPhone 14 Pro (390×844)** and walk through `/`:

- Header: wordmark + hamburger visible, drawer opens on tap, link tap closes drawer + fires loading overlay (matches desktop behavior).
- Hero: PSALMS wordmark fully visible at first paint, silhouette image renders (no `<video>` in DevTools network panel), scroll-collapse runs as letters slide toward center, no scroll-pin jank during URL bar resize.
- MidSectionMotion: scrolls naturally past the viewport (not pinned), `<video>` element confirmed in DevTools (no WebGPU canvas), BEAT copy fades in as the section enters view.
- TwoPathInterlude: two cards stack vertically with "— or —" between them; CTA labels render as plain text (no hover stagger duplicates).
- PurposeGrid: row scroll-snaps to each tile; dot indicator beneath updates as you swipe; tap → PurposeDetail flow opens.
- FinalReflectionCta: headline scaled down, CTA button width ≤ 70vw, generous vertical padding.
- Footer: single column, animations still play.

Resize to **iPad Pro (1024×1366)**: layout returns to desktop (this is intentional — tablet stays on the desktop layout per spec).

Resize back to **390×844**: layout switches to mobile (matchMedia subscription works).

- [ ] **Step 6: Reduced-motion smoke**

In DevTools `Rendering` panel, set `Emulate CSS media feature prefers-reduced-motion: reduce`. Reload `/`. Confirm:
- Hero collapse does not run; letters render at rest.
- MidSection BEAT fades on enter (already supported).
- All transitions snap to final state.

- [ ] **Step 7: Commit (verification artifacts only — no code changes expected)**

If any issues surface during smoke, return to the failing task and fix. Re-run Steps 1–6 until clean. No code commit at this step.

---

## Self-Review Notes

**Spec coverage check (against `docs/superpowers/specs/2026-05-28-mobile-home-page-design.md`):**

| Spec section | Task |
|---|---|
| Decision 1 — Faithful translation | Implicit across Tasks 3–14 (same 5 acts) |
| Decision 2 — `max-width: 768px` | Task 1 (constant), Task 3 (Hero), Task 8 (MidSection), Tasks 9–14 use Tailwind `md:` |
| Decision 3 — Variant components, not separate routes | Tasks 2–3 (Hero), Tasks 12–13 (Header) |
| Decision 4 — `useIsMobile()` for behavioral branches | Tasks 3, 8, 13 |
| Decision 5 — Theater (lite) hero | Tasks 4–7 |
| Decision 6 — Static image, no video on mobile hero | Task 4 |
| Decision 7 — MidSection video mode + no pin | Task 8 |
| Decision 8 — TwoPath vertical stack + "— or —" + (hover: none) | Task 9 |
| Decision 9 — PurposeGrid scroll-snap + dot indicator | Task 10 |
| Decision 10 — FinalReflection responsive type + clamped button | Task 11 |
| Decision 11 — Header compact bar + Sheet drawer | Tasks 12–13 |
| Decision 12 — Footer single-column | Task 14 |
| Decision 13 — Intro gate inherited | Task 4 (HeroMobile receives same `introActive` prop) |
| Decision 14 — `MOBILE_TIME_SCALE = 0.7` | Task 1, used Task 5 |
| Decision 15 — Reduced motion inherited | Task 5 (collapse), Task 8 (BEATS fade) |
| Decision 16 — Loading overlay timings | Inherited via shared `useLoadingOverlay`; no task needed (spec calls this out as a side-effect of `MOBILE_TIME_SCALE`, not a separate workstream — `useLoadingOverlay`'s `minMs` is the same for both; explicit scaling deferred per spec scope) |
| Decision 17 — Analytics / sessionStorage unchanged | No task needed (no changes) |
| Decision 18 — Out of scope (other routes) | No tasks for other routes |

**Placeholder scan:** No `TBD`, no `TODO`, no "implement later." All code blocks contain runnable code. Three places call out *literal strings to copy from existing files* (HeroMobile silhouette src/alt, BRIDGE_COPY keys, navItems field names) — those are intentional read-from-source steps, not placeholders.

**Type consistency:**
- `HeroProps` defined in Task 2, imported in Task 3 (Hero dispatcher), Tasks 4–7 (HeroMobile).
- `HeaderProps` defined in Task 13.
- `MOBILE_TIME_SCALE` defined Task 1, used Task 5.
- `useIsMobile` reused from `@/hooks/use-mobile.ts` everywhere.
- `initialRenderMode` exported in Task 8.
- `PurposeGridDots` props match the test in Task 10.

**Risks per spec → mitigations in plan:**
- Hero file size → Task 2 splits before adding (`HeroDesktop` extraction, then dispatcher, then mobile sibling).
- MidSection pin-as-no-op → Task 8 step 4 explicitly *does not construct* the pin ScrollTrigger on mobile.
- Mobile Safari address-bar resize → Task 4 step 4 uses `min-h-[100svh]` for the hero wrapper.
- Sheet z-index collision → Task 12 sets `z-40` on the header bar; verify against `useLoadingOverlay`'s overlay z-index during the Task 15 smoke check.
- Scroll-snap with unloaded tile images → existing PurposeGrid tiles are already sized via Tailwind height classes; no jump expected.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-28-mobile-home-page.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task with two-stage review between tasks. Slower but each task gets independent verification, and the main session stays clean for orchestration.
2. **Inline Execution** — execute tasks in this session using `executing-plans`, with checkpoints at Tasks 2 (Hero extraction), 8 (MidSection), 13 (Header dispatcher), and 15 (final smoke). Faster, but more context pressure.

Which approach?
