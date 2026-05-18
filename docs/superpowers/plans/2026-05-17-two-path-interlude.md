# Two-Path Interlude Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a contemplative 100vh interlude band between `MidSectionMotion` and `PurposeGrid` on the home page, with two italic statements, a thin vertical hairline, a "Read Below" scroll cue (animated arrow), and a "Go to Notepad" link.

**Architecture:** New isolated section component (`TwoPathInterlude`) rendered in `src/App.tsx`. Pure scroll logic is extracted to its own module (`two-path-interlude-actions.ts`) with dependency injection, following the existing test pattern in this repo (see `src/transitions/route-transition.ts`). The component uses GSAP + ScrollTrigger for the one-shot entrance animation (matching `MidSectionMotion`'s pattern). The continuous arrow "bob" is a pure CSS keyframes animation gated by `data-entered` to avoid running before entrance settles. `prefers-reduced-motion` swaps in an `IntersectionObserver` cross-fade and disables all animation.

**Tech Stack:** React 18 + TypeScript + Vite, GSAP `ScrollTrigger` (already installed), react-router-dom (uses `<Link>` for navigation), Tailwind for utility classes used by neighbors, plain CSS in `src/index.css` for the section's bespoke styles, Vitest for unit tests.

**Spec:** [docs/superpowers/specs/2026-05-17-two-path-interlude-design.md](../specs/2026-05-17-two-path-interlude-design.md)

## File Structure

**New:**
- `src/components/sections/TwoPathInterlude.tsx` — the React component (markup, motion effects, click wiring).
- `src/components/sections/two-path-interlude-actions.ts` — pure scroll-to-projects logic, dependency-injected for unit testing.
- `src/components/sections/two-path-interlude-actions.test.ts` — Vitest unit tests for the scroll logic.

**Modified:**
- `src/App.tsx` — import and render `<TwoPathInterlude />` between `<MidSectionMotion />` and `<PurposeGrid …/>`.
- `src/index.css` — append a `/* ── Two-Path Interlude ── */` block with all bespoke styles.

**Not modified (verified):**
- `src/components/sections/PurposeGrid.tsx` — already has `id="projects"` on its root section at line 418. The scroll target reuses this id.

---

## Task 1: Pure scroll-to-projects helper with tests

**Files:**
- Create: `src/components/sections/two-path-interlude-actions.ts`
- Test: `src/components/sections/two-path-interlude-actions.test.ts`

The component's only piece of real logic is the smooth-scroll-to-`#projects` behavior. We extract it as a pure function with dependency injection so it's directly testable in vitest without DOM rendering — matching the pattern in `src/transitions/route-transition.ts` + `route-transition.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/components/sections/two-path-interlude-actions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { scrollToPurposeGrid } from './two-path-interlude-actions';
import type { ScrollToPurposeGridDeps } from './two-path-interlude-actions';

interface DepsRecord {
  findCalls: string[];
  scrollIntoViewCalls: Array<{ behavior?: ScrollBehavior; block?: ScrollLogicalPosition }>;
}

function makeDeps(targetExists: boolean): { deps: ScrollToPurposeGridDeps; rec: DepsRecord } {
  const rec: DepsRecord = { findCalls: [], scrollIntoViewCalls: [] };
  const fakeElement = {
    scrollIntoView: (opts: ScrollIntoViewOptions) => {
      rec.scrollIntoViewCalls.push({ behavior: opts.behavior, block: opts.block });
    },
  } as unknown as HTMLElement;
  const deps: ScrollToPurposeGridDeps = {
    findElementById: (id: string) => {
      rec.findCalls.push(id);
      return targetExists ? fakeElement : null;
    },
  };
  return { deps, rec };
}

describe('scrollToPurposeGrid', () => {
  it('looks up the #projects element', () => {
    const { deps, rec } = makeDeps(true);
    scrollToPurposeGrid(deps);
    expect(rec.findCalls).toEqual(['projects']);
  });

  it('scrolls smoothly to the top of the element when it exists', () => {
    const { deps, rec } = makeDeps(true);
    scrollToPurposeGrid(deps);
    expect(rec.scrollIntoViewCalls).toEqual([{ behavior: 'smooth', block: 'start' }]);
  });

  it('is a no-op when the target element is missing (no throw)', () => {
    const { deps, rec } = makeDeps(false);
    expect(() => scrollToPurposeGrid(deps)).not.toThrow();
    expect(rec.findCalls).toEqual(['projects']);
    expect(rec.scrollIntoViewCalls).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/sections/two-path-interlude-actions.test.ts`

Expected: FAIL with module-not-found / "Cannot find module './two-path-interlude-actions'".

- [ ] **Step 3: Write minimal implementation**

Create `src/components/sections/two-path-interlude-actions.ts`:

```typescript
export interface ScrollToPurposeGridDeps {
  findElementById: (id: string) => HTMLElement | null;
}

export const PURPOSE_GRID_ID = 'projects';

export function scrollToPurposeGrid(deps: ScrollToPurposeGridDeps): void {
  const target = deps.findElementById(PURPOSE_GRID_ID);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/sections/two-path-interlude-actions.test.ts`

Expected: 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/two-path-interlude-actions.ts src/components/sections/two-path-interlude-actions.test.ts
git commit -m "feat(two-path): scroll-to-purpose-grid helper with tests"
```

---

## Task 2: Component shell with click wiring (no styles, no motion yet)

**Files:**
- Create: `src/components/sections/TwoPathInterlude.tsx`

We build the component with semantic markup and wire the click handlers first. No styles yet — we'll add them in Task 3. No GSAP entrance yet — that comes in Task 4. This task gets us a working, navigable section.

- [ ] **Step 1: Create the component file**

Create `src/components/sections/TwoPathInterlude.tsx`:

```typescript
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { scrollToPurposeGrid } from './two-path-interlude-actions';

export function TwoPathInterlude() {
  const sectionRef = useRef<HTMLElement>(null);

  const handleReadBelow = () => {
    scrollToPurposeGrid({
      findElementById: (id) => document.getElementById(id),
    });
  };

  return (
    <section
      ref={sectionRef}
      className="two-path-interlude"
      data-entered="false"
      aria-label="Continue"
    >
      <div className="two-path-hairline" aria-hidden="true" />

      <div className="two-path-col two-path-col-left">
        <p className="two-path-statement">
          Let's take a journey through God's word and find the peace that returns your joy. Let restoration guide you to serenity.
        </p>
        <button
          type="button"
          onClick={handleReadBelow}
          className="two-path-cta two-path-cta-read"
          aria-label="Read below — scroll to the purpose grid"
        >
          <span className="two-path-cta-label">Read Below</span>
          <span className="two-path-arrow" aria-hidden="true" />
        </button>
      </div>

      <div className="two-path-col two-path-col-right">
        <p className="two-path-statement">
          Take a moment to write about where you're at and see how God meets you there.
        </p>
        <Link
          to="/notepad"
          className="two-path-cta two-path-cta-notepad"
          aria-label="Go to Notepad"
        >
          <span className="two-path-cta-label">Go to Notepad</span>
          <span className="two-path-underline" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run typecheck to confirm the component compiles**

Run: `npx tsc --noEmit`

Expected: No errors related to `TwoPathInterlude.tsx`. (If other unrelated errors exist in the repo, they should be the same ones as before — note them but don't fix.)

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/TwoPathInterlude.tsx
git commit -m "feat(two-path): component shell with click handlers"
```

---

## Task 3: Mount the component in App.tsx

**Files:**
- Modify: `src/App.tsx` (add import; render between MidSectionMotion and PurposeGrid)

- [ ] **Step 1: Add the import**

In `src/App.tsx`, find the existing import line for `MidSectionMotion` at line 8:

```typescript
import { MidSectionMotion } from '@/components/sections/MidSectionMotion';
```

Immediately below it, add:

```typescript
import { TwoPathInterlude } from '@/components/sections/TwoPathInterlude';
```

- [ ] **Step 2: Render the component between MidSectionMotion and PurposeGrid**

In `src/App.tsx`, find the home route element around line 130:

```typescript
                  <MidSectionMotion />
                  <PurposeGrid projects={projects} onProjectClick={handleProjectClick} />
```

Insert `<TwoPathInterlude />` between them:

```typescript
                  <MidSectionMotion />
                  <TwoPathInterlude />
                  <PurposeGrid projects={projects} onProjectClick={handleProjectClick} />
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`

Expected: No new errors.

- [ ] **Step 4: Smoke-test in the browser**

Start the dev server (if not already running):

```bash
npm run dev
```

Open the home page (`/`). Scroll past the WebGPU mid-section. You should see the two unstyled statements stacked (since no styles exist yet) followed by the purpose grid. Click "Read Below" — the page should smooth-scroll to the purpose grid. Click "Go to Notepad" — the URL should change to `/notepad` and the Notepad page should render.

If either click doesn't work, stop and debug before moving on. Do not commit broken interaction wiring.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(two-path): mount interlude between mid-section and purpose grid"
```

---

## Task 4: Add static styles (layout, typography, hairline, arrow, underline)

**Files:**
- Modify: `src/index.css` (append a new block at end-of-file)

This task adds every static style — desktop layout, typography, the hairline, the arrow ornament, the underline, and the continuous arrow-bob keyframes. The bob is gated by `[data-entered="true"]` so it stays paused until Task 5's entrance settles.

- [ ] **Step 1: Append the styles to `src/index.css`**

Open `src/index.css` and append at the end of the file (after the last existing block):

```css
/* ─────────────── Two-Path Interlude ─────────────── */
.two-path-interlude {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 12vw;
  min-height: 100vh;
  background: var(--app-bg);
  overflow: hidden;
}

.two-path-hairline {
  position: absolute;
  top: 28%;
  bottom: 28%;
  left: 50%;
  width: 1px;
  background: rgba(58, 47, 36, 0.22);
  transform-origin: center;
  /* Initial state — set explicitly so GSAP has a clean baseline to tween from. */
  transform: scaleY(0);
  opacity: 1;
  pointer-events: none;
}

.two-path-col {
  max-width: 380px;
  text-align: center;
  padding: 0 16px;
  /* Initial state — entrance animation tweens these to 0 / 1. */
  opacity: 0;
}
.two-path-col-left { justify-self: end; transform: translateX(20px); }
.two-path-col-right { justify-self: start; transform: translateX(-20px); }

.two-path-statement {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-weight: 300;
  color: var(--deep-umber);
  font-size: clamp(22px, 2.4vw, 28px);
  line-height: 1.55;
  margin: 0;
}

/* Shared CTA structure: button + Link both use this. */
.two-path-cta {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  margin-top: 36px;
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-weight: 400;
  font-size: 17px;
  color: var(--deep-umber);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}
.two-path-cta:focus-visible {
  outline: 2px solid var(--deep-umber);
  outline-offset: 4px;
  border-radius: 2px;
}

.two-path-cta-label { line-height: 1; }

/* Read Below — vertical line + chevron, paused until entrance completes. */
.two-path-arrow {
  position: relative;
  display: inline-block;
  width: 1px;
  height: 28px;
  background: currentColor;
  animation: two-path-arrow-bob 2.6s ease-in-out infinite;
  animation-play-state: paused;
}
.two-path-arrow::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 6px;
  height: 6px;
  border-right: 1px solid currentColor;
  border-bottom: 1px solid currentColor;
  transform: translateX(-50%) rotate(45deg);
}
.two-path-interlude[data-entered="true"] .two-path-arrow {
  animation-play-state: running;
}

@keyframes two-path-arrow-bob {
  0%, 100% { transform: translateY(-4px); opacity: 0.55; }
  50% { transform: translateY(4px); opacity: 1; }
}

/* Go to Notepad — static underline, hover ramps. */
.two-path-underline {
  display: inline-block;
  width: 24px;
  height: 1px;
  background: currentColor;
  opacity: 0.5;
  transition: opacity 200ms ease;
}
.two-path-cta-notepad:hover .two-path-underline,
.two-path-cta-notepad:focus-visible .two-path-underline {
  opacity: 1;
}

/* ─── Mobile (< 768px): stack vertically, horizontal hairline stub ─── */
@media (max-width: 767px) {
  .two-path-interlude {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto 1fr;
    gap: 64px;
    min-height: auto;
    padding: 12vh 24px;
  }
  .two-path-hairline {
    position: relative;
    top: auto;
    bottom: auto;
    left: auto;
    width: 64px;
    height: 1px;
    margin: 0 auto;
    justify-self: center;
    transform: scaleX(0);
  }
  .two-path-col,
  .two-path-col-left,
  .two-path-col-right {
    justify-self: center;
    transform: translateY(20px);
  }
}
```

- [ ] **Step 2: Verify the styles render correctly**

Reload the home page in the dev server. You should now see:

- The interlude is a full viewport (100vh) of warm taupe.
- Two italic statements, centered, mirrored across the center.
- A thin vertical hairline down the middle (top/bottom 28% from the edges) — **but it will be invisible because `transform: scaleY(0)` is the initial state, set up for Task 5's entrance.** Don't worry about that yet.
- Both columns are also invisible because `opacity: 0` is their initial state — same reason.

To visually verify the static layout, temporarily comment out the three initial-state lines (the `transform: scaleY(0)` on `.two-path-hairline`, the `opacity: 0` on `.two-path-col`, and the two `translateX(...)` lines on the left/right cols). Check that the layout looks right, the typography is correct, the hairline is centered, the CTAs are below their statements, and the arrow is visible. Then **un-comment** them — you must leave the initial state intact so the entrance animation can tween from it.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(two-path): static styles + arrow bob keyframes"
```

---

## Task 5: GSAP entrance motion + arrow-bob gate

**Files:**
- Modify: `src/components/sections/TwoPathInterlude.tsx`

This task adds the entrance animation: hairline radiates from center → both columns fade and drift inward. On completion it sets `data-entered="true"` on the section root, which un-pauses the CSS arrow-bob.

- [ ] **Step 1: Add the GSAP imports and refs**

At the top of `src/components/sections/TwoPathInterlude.tsx`, replace the existing `import { useRef } from 'react';` with:

```typescript
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollToPurposeGrid } from './two-path-interlude-actions';

gsap.registerPlugin(ScrollTrigger);
```

- [ ] **Step 2: Add refs for the three animated children**

Inside the component, replace the existing single ref declaration with:

```typescript
  const sectionRef = useRef<HTMLElement>(null);
  const hairlineRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
```

Wire them onto the JSX. Find:

```typescript
      <div className="two-path-hairline" aria-hidden="true" />
```

Replace with:

```typescript
      <div ref={hairlineRef} className="two-path-hairline" aria-hidden="true" />
```

Find the left column:

```typescript
      <div className="two-path-col two-path-col-left">
```

Replace with:

```typescript
      <div ref={leftColRef} className="two-path-col two-path-col-left">
```

Find the right column:

```typescript
      <div className="two-path-col two-path-col-right">
```

Replace with:

```typescript
      <div ref={rightColRef} className="two-path-col two-path-col-right">
```

- [ ] **Step 3: Add the entrance effect**

Inside the component, immediately after the `handleReadBelow` declaration, add:

```typescript
  useEffect(() => {
    const section = sectionRef.current;
    const hairline = hairlineRef.current;
    const left = leftColRef.current;
    const right = rightColRef.current;
    if (!section || !hairline || !left || !right) return;

    // Respect reduced-motion — handled separately in Task 6. For now, skip the
    // entrance entirely when reduced-motion is preferred (Task 6 will replace
    // this branch with the IntersectionObserver cross-fade).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        section.dataset.entered = 'true';
      },
    });

    // Hairline radiates from center outward, 0.9s.
    tl.to(hairline, {
      scaleY: 1,
      duration: 0.9,
      ease: 'power2.out',
    }, 0);

    // Columns fade in and drift inward, starting at 0.6s, 1.2s duration.
    // Tween both x and y because the desktop initial state is translateX(±20px)
    // but the mobile media query (in index.css) overrides it to translateY(20px).
    // Tweening both lets the same useEffect cover both layouts.
    tl.to([left, right], {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 1.2,
      ease: 'power3.out',
    }, 0.6);

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top 70%',
      once: true,
      onEnter: () => tl.play(),
    });

    return () => {
      st.kill();
      tl.kill();
    };
  }, []);
```

The final component file should look like:

```typescript
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollToPurposeGrid } from './two-path-interlude-actions';

gsap.registerPlugin(ScrollTrigger);

export function TwoPathInterlude() {
  const sectionRef = useRef<HTMLElement>(null);
  const hairlineRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);

  const handleReadBelow = () => {
    scrollToPurposeGrid({
      findElementById: (id) => document.getElementById(id),
    });
  };

  useEffect(() => {
    const section = sectionRef.current;
    const hairline = hairlineRef.current;
    const left = leftColRef.current;
    const right = rightColRef.current;
    if (!section || !hairline || !left || !right) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        section.dataset.entered = 'true';
      },
    });

    tl.to(hairline, {
      scaleY: 1,
      duration: 0.9,
      ease: 'power2.out',
    }, 0);

    tl.to([left, right], {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 1.2,
      ease: 'power3.out',
    }, 0.6);

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top 70%',
      once: true,
      onEnter: () => tl.play(),
    });

    return () => {
      st.kill();
      tl.kill();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="two-path-interlude"
      data-entered="false"
      aria-label="Continue"
    >
      <div ref={hairlineRef} className="two-path-hairline" aria-hidden="true" />

      <div ref={leftColRef} className="two-path-col two-path-col-left">
        <p className="two-path-statement">
          Let's take a journey through God's word and find the peace that returns your joy. Let restoration guide you to serenity.
        </p>
        <button
          type="button"
          onClick={handleReadBelow}
          className="two-path-cta two-path-cta-read"
          aria-label="Read below — scroll to the purpose grid"
        >
          <span className="two-path-cta-label">Read Below</span>
          <span className="two-path-arrow" aria-hidden="true" />
        </button>
      </div>

      <div ref={rightColRef} className="two-path-col two-path-col-right">
        <p className="two-path-statement">
          Take a moment to write about where you're at and see how God meets you there.
        </p>
        <Link
          to="/notepad"
          className="two-path-cta two-path-cta-notepad"
          aria-label="Go to Notepad"
        >
          <span className="two-path-cta-label">Go to Notepad</span>
          <span className="two-path-underline" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`

Expected: No new errors.

- [ ] **Step 5: Verify in browser**

Reload the home page. Scroll past the WebGPU mid-section.

Expected: As the interlude enters at ~70% viewport, you should see the hairline radiate from the center outward (top + bottom growing simultaneously), then the two columns fade in and drift inward. After ~1.8s, the arrow under "Read Below" should begin gently bobbing up and down. Scroll away and back — the entrance should NOT re-fire.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/TwoPathInterlude.tsx
git commit -m "feat(two-path): GSAP entrance animation with arrow-bob gate"
```

---

## Task 6: Reduced-motion fallback (IntersectionObserver cross-fade)

**Files:**
- Modify: `src/components/sections/TwoPathInterlude.tsx`
- Modify: `src/index.css` (add reduced-motion media query)

When `prefers-reduced-motion: reduce` is set, we skip GSAP entirely and use a simple `IntersectionObserver` to add a `data-entered="true"` attribute when the section comes into view. CSS handles a 600ms opacity cross-fade. The arrow bob is suppressed.

- [ ] **Step 1: Replace the early-return in the useEffect with an IntersectionObserver branch**

In `src/components/sections/TwoPathInterlude.tsx`, find this block inside the useEffect (the 4-line comment plus the matchMedia check):

```typescript
    // Respect reduced-motion — handled separately in Task 6. For now, skip the
    // entrance entirely when reduced-motion is preferred (Task 6 will replace
    // this branch with the IntersectionObserver cross-fade).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
```

Replace it with:

```typescript
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              section.dataset.entered = 'true';
            }
          }
        },
        { threshold: 0.4 },
      );
      observer.observe(section);
      return () => observer.disconnect();
    }
```

- [ ] **Step 2: Add the reduced-motion CSS branch**

In `src/index.css`, immediately after the mobile media query you added in Task 4 (at the very end of the two-path block), append:

```css
/* ─── Reduced-motion path: no draw, no drift, simple cross-fade ─── */
@media (prefers-reduced-motion: reduce) {
  .two-path-hairline {
    transform: scaleY(1);
    opacity: 0;
    transition: opacity 600ms ease-out;
  }
  .two-path-col,
  .two-path-col-left,
  .two-path-col-right {
    transform: none;
    transition: opacity 600ms ease-out;
  }
  .two-path-interlude[data-entered="true"] .two-path-hairline,
  .two-path-interlude[data-entered="true"] .two-path-col {
    opacity: 1;
  }
  /* Arrow remains static — no bob. */
  .two-path-interlude[data-entered="true"] .two-path-arrow,
  .two-path-arrow {
    animation: none;
    transform: none;
    opacity: 0.7;
  }
}
```

- [ ] **Step 3: Verify in browser**

In Chrome DevTools, open the Rendering panel (⋯ → More tools → Rendering). Find "Emulate CSS media feature prefers-reduced-motion" and set it to "reduce". Reload the page.

Expected: When the interlude scrolls into view, the hairline appears with a soft fade (no draw animation). Both columns fade in (no drift). The arrow under "Read Below" is rendered but does NOT bob. Click "Read Below" — smooth scroll still works. Click "Go to Notepad" — navigation still works.

Disable the emulation and reload. Expected: full GSAP entrance returns.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/TwoPathInterlude.tsx src/index.css
git commit -m "feat(two-path): reduced-motion cross-fade fallback"
```

---

## Task 7: Cross-device manual verification and final commit

**Files:** None modified. This is a verification-only task.

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`

Expected: All tests pass, including the 3 new ones in `two-path-interlude-actions.test.ts`. No regressions in existing tests.

- [ ] **Step 2: Run the full typecheck**

Run: `npx tsc --noEmit`

Expected: No errors related to this feature.

- [ ] **Step 3: Desktop visual + behavior check**

With the dev server running, open the home page in a Chromium browser at desktop width (≥1280px):

1. Scroll from the hero through the WebGPU mid-section into the interlude. Confirm: hairline radiates, columns drift in, arrow bob starts after settle.
2. Click "Read Below". Confirm: page smooth-scrolls to the purpose grid; the grid's filter tabs are visible below the fixed header (not occluded).
3. Use the browser back button to return. Scroll up past the interlude and back down. Confirm: the entrance does NOT re-fire (it's once: true).
4. Click "Go to Notepad". Confirm: URL changes to `/notepad` and the Notepad page renders without a full reload (no flash of blank page).
5. Cmd-click (macOS) or Ctrl-click (Windows/Linux) "Go to Notepad". Confirm: opens `/notepad` in a new tab.
6. Tab through the section. Confirm: both CTAs receive a visible focus ring (deep-umber outline, 4px offset). Press Enter on each — same behavior as clicking.

- [ ] **Step 4: Mobile responsive check**

In Chrome DevTools, switch to a mobile viewport (e.g., iPhone 12 Pro, 390×844).

1. Scroll to the interlude. Confirm: columns stack vertically; the hairline is a short horizontal stub between them.
2. Confirm: the section has comfortable padding (~12vh top/bottom).
3. Tap "Read Below" — confirm smooth scroll. Tap "Go to Notepad" — confirm navigation.

- [ ] **Step 5: Reduced-motion check**

In DevTools Rendering panel, set `prefers-reduced-motion` to "reduce". Reload.

Confirm: no draw, no drift, simple cross-fade. Arrow is static. CTAs still work. Then disable emulation and confirm normal motion returns on reload.

- [ ] **Step 6: Console check**

With DevTools console open, perform a full home → scroll → click cycle. Confirm: no errors, no warnings related to this feature.

- [ ] **Step 7: Tag the feature complete**

If any issue was found and required a fix in this task, commit those fixes:

```bash
git add -A
git commit -m "fix(two-path): <specific fix description>"
```

If no fixes were needed, no commit is required for this verification task.

---

## Verification Summary

When this plan is complete you should have:

- 8 commits on this branch (one per implementation task, possibly +1 for any verification fixes).
- 3 new files: `TwoPathInterlude.tsx`, `two-path-interlude-actions.ts`, `two-path-interlude-actions.test.ts`.
- 2 modified files: `App.tsx`, `index.css`.
- 0 modifications to `PurposeGrid.tsx` (we reused its existing `id="projects"`).
- 3 new passing unit tests.
- All existing tests still passing.
- No TypeScript errors.
- Visually-verified behavior on desktop, mobile, and reduced-motion modes.

Spec satisfied — every acceptance criterion in [docs/superpowers/specs/2026-05-17-two-path-interlude-design.md](../specs/2026-05-17-two-path-interlude-design.md) is met.
