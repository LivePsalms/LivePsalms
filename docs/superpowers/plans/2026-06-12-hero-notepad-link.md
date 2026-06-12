# Hero "Open Your Notepad" Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single subtle "Open Your Notepad →" link to the home hero's opening view (desktop + mobile) that routes straight to `/notepad` using the existing nav-trigger transition.

**Architecture:** One shared presentational component, `HeroNotepadLink`, reused by `HeroDesktop` and `HeroMobile`. The component owns appearance (copy, arrow, `TextStaggerHover` blur hover, `.psalms-nav-link` styling) and the click→navigate behavior. The host hero owns *when* it is visible: on desktop the link fades in once the intro is revealed and fades out early as the wordmark-collapse scroll progresses (driven by the existing `nav-collapse-progress` singleton that the nav already subscribes to); on mobile it renders statically in the opening column. A pure exported helper, `heroNotepadLinkOpacity`, computes the desktop fade so the visibility math is unit-tested in isolation.

**Tech Stack:** React + TypeScript, react-router-dom (`useNavigate`), framer-motion (via existing `TextStaggerHover`), Vitest + React Testing Library, Tailwind + CSS custom properties.

---

## File Structure

- **Create** `src/components/sections/HeroNotepadLink.tsx` — shared link component + `heroNotepadLinkOpacity` helper. Single responsibility: render the Notepad link and compute its desktop fade opacity.
- **Create** `src/components/sections/HeroNotepadLink.test.tsx` — unit tests for the helper and the component (semantics, click, arrow).
- **Modify** `src/index.css` — add a small `.hero-notepad-link` block for the arrow glyph spacing and hover drift.
- **Modify** `src/components/sections/HeroDesktop.tsx` — add `onNavTrigger` to `HeroProps`; subscribe to collapse progress; render `HeroNotepadLink` bottom-right of the sticky opening viewport with computed opacity.
- **Modify** `src/components/sections/HeroMobile.tsx` — render `HeroNotepadLink` statically, right-aligned, directly under the wordmark.
- **Modify** `src/App.tsx` — pass `onNavTrigger={handleNavTrigger}` into `<Hero>`.

---

## Task 1: `heroNotepadLinkOpacity` helper (pure fade math)

**Files:**
- Create: `src/components/sections/HeroNotepadLink.tsx`
- Test: `src/components/sections/HeroNotepadLink.test.tsx`

The desktop link is fully opaque in the calm opening frame (progress 0) and fades to 0 by an early progress threshold — gone well before the first nav item begins collapsing at progress 0.15 and long before the manifesto. Fade window: `[0.02, 0.12]`. When the intro is not yet revealed, opacity is 0.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { heroNotepadLinkOpacity } from './HeroNotepadLink';

describe('heroNotepadLinkOpacity', () => {
  it('is 0 before the intro is revealed, regardless of progress', () => {
    expect(heroNotepadLinkOpacity(false, 0)).toBe(0);
    expect(heroNotepadLinkOpacity(false, 0.5)).toBe(0);
  });

  it('is fully visible in the calm opening frame (progress 0)', () => {
    expect(heroNotepadLinkOpacity(true, 0)).toBe(1);
  });

  it('stays fully visible until the fade window opens', () => {
    expect(heroNotepadLinkOpacity(true, 0.02)).toBe(1);
  });

  it('is fully faded out by the end of the early window', () => {
    expect(heroNotepadLinkOpacity(true, 0.12)).toBe(0);
  });

  it('clamps to 0 past the window (during collapse / manifesto)', () => {
    expect(heroNotepadLinkOpacity(true, 0.2)).toBe(0);
    expect(heroNotepadLinkOpacity(true, 1)).toBe(0);
  });

  it('interpolates linearly across the window midpoint', () => {
    expect(heroNotepadLinkOpacity(true, 0.07)).toBeCloseTo(0.5, 5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/sections/HeroNotepadLink.test.tsx`
Expected: FAIL — `heroNotepadLinkOpacity` is not exported / module has no component yet.

- [ ] **Step 3: Write the minimal helper**

Create `src/components/sections/HeroNotepadLink.tsx` with just the helper for now:

```tsx
const FADE_START = 0.02;
const FADE_END = 0.12;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * Desktop opacity for the hero Notepad link.
 * - Hidden (0) until the intro is revealed.
 * - Fully visible at the start of scroll, then fades out across
 *   [FADE_START, FADE_END] so it is gone before the wordmark-collapse
 *   climax and the manifesto below.
 */
export function heroNotepadLinkOpacity(introRevealed: boolean, progress: number): number {
  if (!introRevealed) return 0;
  const t = clamp01((progress - FADE_START) / (FADE_END - FADE_START));
  return 1 - t;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/sections/HeroNotepadLink.test.tsx`
Expected: PASS (6 passing).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/HeroNotepadLink.tsx src/components/sections/HeroNotepadLink.test.tsx
git commit -m "feat(hero): add heroNotepadLinkOpacity fade helper"
```

---

## Task 2: `HeroNotepadLink` component (semantics, click, arrow)

**Files:**
- Modify: `src/components/sections/HeroNotepadLink.tsx`
- Test: `src/components/sections/HeroNotepadLink.test.tsx`

The component renders a real anchor to `/notepad`, styled with the existing `.psalms-nav-link` class (which already provides the transparent→currentColor hairline underline at 6px offset). Hover uses `TextStaggerHover` blur (matching the nav) plus a CSS arrow drift. Clicking fires `onNavTrigger` then client-side `navigate('/notepad')` — identical to the nav "Notepad" item.

- [ ] **Step 1: Write the failing tests** (append to `HeroNotepadLink.test.tsx`)

```tsx
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, vi } from 'vitest';
import { HeroNotepadLink } from './HeroNotepadLink';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

afterEach(() => {
  cleanup();
  navigateMock.mockReset();
});

describe('HeroNotepadLink', () => {
  function renderLink(props: Partial<{ onNavTrigger: () => void }> = {}) {
    return render(
      <MemoryRouter>
        <HeroNotepadLink onNavTrigger={props.onNavTrigger} />
      </MemoryRouter>,
    );
  }

  it('renders a link to /notepad with an accessible name', () => {
    renderLink();
    const link = screen.getByRole('link', { name: /open your notepad/i });
    expect(link).toHaveAttribute('href', '/notepad');
  });

  it('renders the arrow glyph, hidden from assistive tech', () => {
    const { container } = renderLink();
    const arrow = container.querySelector('[data-testid="hero-notepad-arrow"]');
    expect(arrow).not.toBeNull();
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
  });

  it('fires onNavTrigger and navigates to /notepad on click', () => {
    const onNavTrigger = vi.fn();
    renderLink({ onNavTrigger });
    fireEvent.click(screen.getByRole('link', { name: /open your notepad/i }));
    expect(onNavTrigger).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/notepad');
  });

  it('does not throw when onNavTrigger is omitted, still navigates', () => {
    renderLink();
    fireEvent.click(screen.getByRole('link', { name: /open your notepad/i }));
    expect(navigateMock).toHaveBeenCalledWith('/notepad');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/sections/HeroNotepadLink.test.tsx`
Expected: FAIL — `HeroNotepadLink` is not exported.

- [ ] **Step 3: Implement the component**

Add to `src/components/sections/HeroNotepadLink.tsx` (keep the helper from Task 1 above the new code; add these imports at the top of the file):

```tsx
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextStaggerHover,
  TextStaggerHoverActive,
  TextStaggerHoverHidden,
} from '@/components/ui/text-stagger-hover';

const LINK_LABEL = 'Open Your Notepad';

export interface HeroNotepadLinkProps {
  onNavTrigger?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function HeroNotepadLink({ onNavTrigger, className, style }: HeroNotepadLinkProps) {
  const navigate = useNavigate();

  return (
    <TextStaggerHover
      as="a"
      href="/notepad"
      aria-label="Open your Notepad"
      data-testid="hero-notepad-link"
      className={[
        'psalms-nav-link hero-notepad-link',
        'text-sm md:text-base font-bold tracking-wide cursor-pointer',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          fontFamily: "'The Softly Serif', serif",
          ['--c-rest' as string]: 'var(--deep-umber)',
          ['--c-hover' as string]: 'var(--charred)',
          ...style,
        } as CSSProperties
      }
      onClick={(e: React.MouseEvent) => {
        e.preventDefault();
        onNavTrigger?.();
        navigate('/notepad');
      }}
    >
      <span className="relative inline-block align-baseline">
        <TextStaggerHoverActive animation="blur">{LINK_LABEL}</TextStaggerHoverActive>
        <TextStaggerHoverHidden animation="blur">{LINK_LABEL}</TextStaggerHoverHidden>
      </span>
      <span
        data-testid="hero-notepad-arrow"
        aria-hidden="true"
        className="hero-notepad-arrow inline-block"
      >
        →
      </span>
    </TextStaggerHover>
  );
}
```

Note: `TextStaggerHover` already wires `onMouseEnter/Leave/Focus/Blur` for the blur hover, applies `relative inline-block`, and forwards `href`, `aria-label`, `onClick`, `data-testid`, `className`, and `style` to the underlying `<a>`. The visible label comes from `TextStaggerHoverActive`; the `TextStaggerHoverHidden` copy is `aria-hidden`, so the accessible name resolves cleanly (and `aria-label` pins it regardless).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/sections/HeroNotepadLink.test.tsx`
Expected: PASS (all helper + component tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/HeroNotepadLink.tsx src/components/sections/HeroNotepadLink.test.tsx
git commit -m "feat(hero): add HeroNotepadLink component"
```

---

## Task 3: Arrow styling in CSS

**Files:**
- Modify: `src/index.css` (add after the `.psalms-nav-link:hover` rule, which ends at line 172)

The `.psalms-nav-link` class already supplies the underline. Add only the arrow spacing and the hover drift. The drift is suppressed under reduced motion.

- [ ] **Step 1: Add the CSS block**

Insert immediately after line 172 (`.psalms-nav-link:hover { ... }`):

```css
.hero-notepad-link .hero-notepad-arrow {
  margin-left: 0.5ch;
  font-size: 0.85em;
  opacity: 0.7;
  transition: transform 300ms ease, opacity 300ms ease;
  will-change: transform;
}

.hero-notepad-link:hover .hero-notepad-arrow,
.hero-notepad-link:focus-visible .hero-notepad-arrow {
  transform: translateX(3px);
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .hero-notepad-link .hero-notepad-arrow {
    transition: none;
  }
  .hero-notepad-link:hover .hero-notepad-arrow,
  .hero-notepad-link:focus-visible .hero-notepad-arrow {
    transform: none;
  }
}
```

- [ ] **Step 2: Verify the build still compiles**

Run: `npx vitest run src/components/sections/HeroNotepadLink.test.tsx`
Expected: PASS (CSS change is non-breaking; tests still green).

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style(hero): arrow spacing and hover drift for notepad link"
```

---

## Task 4: Thread `onNavTrigger` through `HeroProps` and `App`

**Files:**
- Modify: `src/components/sections/HeroDesktop.tsx:17-21` (the `HeroProps` interface)
- Modify: `src/App.tsx:192` (the `<Hero ... />` element)

`HeroProps` is the shared type (re-exported by `Hero.tsx` and imported by `HeroMobile.tsx`), so adding the prop here flows to both heroes.

- [ ] **Step 1: Extend `HeroProps`**

In `src/components/sections/HeroDesktop.tsx`, change:

```tsx
export interface HeroProps {
  introActive?: boolean;
  onIntroComplete?: () => void;
  onHandoff?: () => void;
}
```

to:

```tsx
export interface HeroProps {
  introActive?: boolean;
  onIntroComplete?: () => void;
  onHandoff?: () => void;
  /** Fires the loading-veil transition before routing to /notepad (same as nav clicks). */
  onNavTrigger?: () => void;
}
```

- [ ] **Step 2: Pass the handler from `App`**

In `src/App.tsx`, change line 192 from:

```tsx
<Hero introActive={introActive} onIntroComplete={handleIntroComplete} onHandoff={handleIntroHandoff} />
```

to:

```tsx
<Hero introActive={introActive} onIntroComplete={handleIntroComplete} onHandoff={handleIntroHandoff} onNavTrigger={handleNavTrigger} />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no new errors (the repo has a known pre-existing red baseline in `force-sphere.test.ts`; this change must add zero new errors).

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/HeroDesktop.tsx src/App.tsx
git commit -m "feat(hero): thread onNavTrigger into HeroProps and Hero"
```

---

## Task 5: Render the link in `HeroDesktop` with visibility gating

**Files:**
- Modify: `src/components/sections/HeroDesktop.tsx` (imports at line 13; destructure at line 23; new subscription near line 289; JSX inside the sticky inner div, before its closing `</div>` at line 521)

The link mounts inside the sticky opening viewport, positioned bottom-right, with opacity from `heroNotepadLinkOpacity(introRevealed, progress)`. `introStatus` is already computed (line 289-292); `progress` comes from the same `nav-collapse-progress` singleton the collapse timeline publishes to. Under reduced motion the collapse effect never runs, so progress stays 0 and the link stays statically visible — exactly the intended fallback.

- [ ] **Step 1: Add imports and read the helper + progress store**

In `src/components/sections/HeroDesktop.tsx`, update the `nav-collapse-progress` import (line 13) from:

```tsx
import { setNavCollapseProgress } from '@/lib/nav-collapse-progress';
```

to:

```tsx
import {
  setNavCollapseProgress,
  subscribeNavCollapseProgress,
  getNavCollapseProgress,
} from '@/lib/nav-collapse-progress';
import { HeroNotepadLink, heroNotepadLinkOpacity } from './HeroNotepadLink';
```

- [ ] **Step 2: Accept the prop**

Change the component signature (line 23) from:

```tsx
export function HeroDesktop({ introActive = false, onIntroComplete, onHandoff }: HeroProps) {
```

to:

```tsx
export function HeroDesktop({ introActive = false, onIntroComplete, onHandoff, onNavTrigger }: HeroProps) {
```

- [ ] **Step 3: Subscribe to collapse progress and compute opacity**

Immediately after the existing `introStatus` / `showNav` block (currently lines 289-293, ending with `const showNav = !introActive || introStatus === 'revealed';`), add:

```tsx
  const collapseProgress = useSyncExternalStore(
    subscribeNavCollapseProgress,
    getNavCollapseProgress,
    () => 0,
  );
  const introRevealed = !introActive || introStatus === 'revealed';
  const notepadLinkOpacity = heroNotepadLinkOpacity(introRevealed, collapseProgress);
```

(`useSyncExternalStore` is already imported at line 1. The third arg is the server snapshot for SSR safety.)

- [ ] **Step 4: Render the link inside the sticky opening viewport**

Inside the sticky inner `<div>` that opens at line 427 (`className="top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden"`), add this as the **last child**, immediately before that div's closing `</div>` (currently line 521, right after the collapse-ring block):

```tsx
          {/* Subtle shortcut into the journaling space. Lives in the calm
              opening frame: fades in once the intro reveals, fades out early
              as the wordmark begins to collapse (well before the manifesto).
              Its own pointer-events layer — the wordmark layer above is
              pointer-events-none. */}
          <div
            className="absolute bottom-8 right-10 z-[6]"
            style={{
              opacity: notepadLinkOpacity,
              pointerEvents: notepadLinkOpacity < 0.05 ? 'none' : 'auto',
              transition: 'opacity 1200ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <HeroNotepadLink onNavTrigger={onNavTrigger} />
          </div>
```

- [ ] **Step 5: Typecheck and run the hero-related tests**

Run: `npx tsc -b`
Expected: no new errors.

Run: `npx vitest run src/components/sections/HeroNotepadLink.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/HeroDesktop.tsx
git commit -m "feat(hero): render notepad link in desktop opening view with scroll-fade"
```

---

## Task 6: Render the link in `HeroMobile`

**Files:**
- Modify: `src/components/sections/HeroMobile.tsx` (import near line 11; destructure at line 26; JSX after the wordmark at line 149)

On mobile the opening view is a centered flex column. The link renders statically (mobile has no dark intro and a short, unpinned collapse), right-aligned directly under the wordmark so it sits in the opening view without fragile absolute positioning. No progress gating.

- [ ] **Step 1: Import the component**

In `src/components/sections/HeroMobile.tsx`, after the existing `import type { HeroProps } from './HeroDesktop';` (line 11), add:

```tsx
import { HeroNotepadLink } from './HeroNotepadLink';
```

- [ ] **Step 2: Accept the prop**

Change the signature (line 26) from:

```tsx
export function HeroMobile({ introActive = false, onIntroComplete, onHandoff }: HeroProps) {
```

to:

```tsx
export function HeroMobile({ introActive = false, onIntroComplete, onHandoff, onNavTrigger }: HeroProps) {
```

- [ ] **Step 3: Render the link under the wordmark**

In the JSX, the wordmark is at line 149: `<PsalmsWordmarkSvg ref={svgRef} className="w-[88vw] max-w-md" />`. Immediately after it, add:

```tsx
        <HeroNotepadLink onNavTrigger={onNavTrigger} className="self-end -mt-4" />
```

(`self-end` right-aligns it within the `items-center` column; `-mt-4` tightens it under the wordmark against the column's `gap-10`.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/HeroMobile.tsx
git commit -m "feat(hero): render notepad link in mobile opening view"
```

---

## Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the new test file**

Run: `npx vitest run src/components/sections/HeroNotepadLink.test.tsx`
Expected: PASS — all helper + component tests green.

- [ ] **Step 2: Run the hero/layout test neighborhood to confirm no regressions**

Run: `npx vitest run src/components/sections src/components/layout`
Expected: No **new** failures vs. the known baseline. Per the repo's documented red baseline, `Editor.toolbar-placement` and `garden-scene` may already fail and `force-sphere.test.ts` has pre-existing tsc errors — those are not caused by this change. Confirm `HeroNotepadLink` tests pass and no previously-green hero test regressed.

- [ ] **Step 3: Typecheck the real build**

Run: `npx tsc -b`
Expected: only the pre-existing `force-sphere.test.ts` errors, zero new errors from these files.

- [ ] **Step 4: Manual smoke (human, in the running app)**

Start the app and verify on `/`:
- Desktop: after the intro settles, "Open Your Notepad →" appears bottom-right; hovering blurs/deepens the text and drifts the arrow; clicking shows the loading veil and lands on `/notepad`; scrolling a little makes the link fade out before the wordmark collapses.
- Mobile viewport: the link sits right-aligned under the wordmark in the opening view, clear of the bottom dock; tapping routes to `/notepad`.
- Reduced motion (OS setting on): the link is statically visible and still routes; no arrow drift.

- [ ] **Step 5: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "test(hero): verify notepad link across heroes"
```

---

## Self-Review Notes

- **Spec coverage:** placement bottom-right desktop (Task 5) + mobile under-wordmark right-aligned (Task 6); copy "Open Your Notepad" + arrow (Task 2); deep-umber color + hairline underline via `.psalms-nav-link` (Tasks 2-3); same nav→`/notepad` transition via `onNavTrigger` + `navigate` (Tasks 2,4); intro-settle fade-in / early scroll fade-out (Tasks 1,5); reduced-motion static (progress stays 0 desktop; static mobile; arrow drift suppressed — Tasks 3,5,6); accessibility real link + `aria-label` + own pointer-events layer (Tasks 2,5); shared component reused by both heroes (all tasks); tests for helper + component (Tasks 1-2,7); zero-new-error bar (Tasks 4-7). All spec sections map to a task.
- **No placeholders:** every code step shows complete code and exact insertion points with line anchors.
- **Type consistency:** `heroNotepadLinkOpacity(introRevealed, progress)`, `HeroNotepadLinkProps { onNavTrigger?, className?, style? }`, and `HeroProps.onNavTrigger` are used identically everywhere they appear.
- **Mobile placement note:** the spec's default was "bottom-right, fall back to bottom-center." Against the real mobile column layout (a flowing `min-h-[100svh]` stack, not a fixed first-screen box), an absolute bottom-right anchor would attach to the bottom of the entire multi-screen hero, not the opening view. The faithful, robust adaptation is right-aligned (`self-end`) directly under the wordmark, which keeps it in the opening view without fragile positioning. If manual smoke (Task 7) finds it cramped, switch `self-end` → `self-center` for the bottom-center fallback.
