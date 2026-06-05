# Dock Logo Tap Sparkle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fire a brief sparkle (ripple ring + rising warm-white embers) from the mobile bottom-dock logo tile when it is tapped, echoing the existing loading animation.

**Architecture:** A small presentational component `DockHomeSparkle` holds particle descriptors in React state and renders them as `aria-hidden` `<span>`s animated by two new CSS keyframes; particles remove themselves `onAnimationEnd`. It exposes an imperative `burst()` (no-op under `prefers-reduced-motion`) called from the dock logo `<Link>`'s `onClick`. The dock is a persistent `fixed` element, so the effect plays in place and navigation is unchanged.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind, CSS keyframes, Vitest + @testing-library/react (jsdom).

---

## Reference

- Spec: `docs/superpowers/specs/2026-06-01-dock-logo-tap-sparkle-design.md`
- Target element: `.dock-home` `<Link to="/">` in `src/components/layout/MobileBottomDock.tsx` (currently lines 113–123).
- Pattern to follow: `src/components/ui-custom/WaterRipple.tsx` (state-driven particles, self-cleanup).
- Reduced-motion hook: `src/notepad-landing/hooks/use-prefers-reduced-motion.ts` (exports `usePrefersReducedMotion(): boolean`).
- Existing keyframes block to add next to: `src/index.css` around the `water-ripple-ring-*` rules (lines ~496–522).

## File Structure

- **Create** `src/components/layout/DockHomeSparkle.tsx` — the FX component + `DockHomeSparkleHandle` type.
- **Create** `src/components/layout/DockHomeSparkle.test.tsx` — unit tests.
- **Modify** `src/index.css` — add `@keyframes dock-sparkle-ring` and `@keyframes dock-ember`.
- **Modify** `src/components/layout/MobileBottomDock.tsx` — render the sparkle in the logo Link and fire `burst()` on click.
- **Modify** `src/components/layout/MobileBottomDock.test.tsx` — assert sparkle present + nav intact.

---

## Task 1: Add the sparkle keyframes to global CSS

**Files:**
- Modify: `src/index.css` (after the `.water-ripple-ring-3 { ... }` rule, ~line 522)

- [ ] **Step 1: Add the keyframes**

Insert this block immediately after the closing `}` of `.water-ripple-ring-3` in `src/index.css`:

```css
/* ============================================
   DOCK LOGO TAP SPARKLE
   Ring + rising embers fired from the mobile
   bottom-dock logo tile. Per-particle drift is
   supplied via inline --ex / --ey custom props.
   ============================================ */

@keyframes dock-sparkle-ring {
  0%   { transform: scale(0.3); opacity: 0.8; }
  100% { transform: scale(4);   opacity: 0; }
}

@keyframes dock-ember {
  0%   { transform: translate(0, 0); opacity: 0; }
  16%  { opacity: 1; }
  100% { transform: translate(var(--ex, 0), var(--ey, -44px)); opacity: 0; }
}
```

- [ ] **Step 2: Verify CSS still compiles**

Run: `npm run build`
Expected: build succeeds (no CSS syntax errors). If the full build is slow, it is acceptable to instead confirm the file has no unbalanced braces by eye; the component tests in later tasks exercise the class usage.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(dock): add sparkle keyframes for logo tap"
```

---

## Task 2: Create the `DockHomeSparkle` component (TDD)

**Files:**
- Create: `src/components/layout/DockHomeSparkle.tsx`
- Test: `src/components/layout/DockHomeSparkle.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/DockHomeSparkle.test.tsx`:

```tsx
// @vitest-environment jsdom
import { createRef } from 'react';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { DockHomeSparkle, type DockHomeSparkleHandle } from './DockHomeSparkle';

function setReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('reduce') ? reduced : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => cleanup());

describe('DockHomeSparkle', () => {
  beforeEach(() => setReducedMotion(false));

  it('renders an aria-hidden layer with no particles initially', () => {
    const { container } = render(<DockHomeSparkle />);
    const layer = container.querySelector('[data-testid="dock-home-sparkle"]');
    expect(layer).not.toBeNull();
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('[data-particle]')).toHaveLength(0);
  });

  it('spawns one ring + 8 embers when burst() is called', () => {
    const ref = createRef<DockHomeSparkleHandle>();
    const { container } = render(<DockHomeSparkle ref={ref} />);
    act(() => ref.current?.burst());
    expect(container.querySelector('[data-particle="ring"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-particle="ember"]')).toHaveLength(8);
  });

  it('spawns no particles under prefers-reduced-motion', () => {
    setReducedMotion(true);
    const ref = createRef<DockHomeSparkleHandle>();
    const { container } = render(<DockHomeSparkle ref={ref} />);
    act(() => ref.current?.burst());
    expect(container.querySelectorAll('[data-particle]')).toHaveLength(0);
  });

  it('removes a particle when its animation ends', () => {
    const ref = createRef<DockHomeSparkleHandle>();
    const { container } = render(<DockHomeSparkle ref={ref} />);
    act(() => ref.current?.burst());
    const before = container.querySelectorAll('[data-particle]').length;
    const first = container.querySelector('[data-particle]') as HTMLElement;
    act(() => fireEvent.animationEnd(first));
    expect(container.querySelectorAll('[data-particle]').length).toBe(before - 1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/layout/DockHomeSparkle.test.tsx`
Expected: FAIL — cannot resolve `./DockHomeSparkle` (module does not exist yet).

- [ ] **Step 3: Write the component**

Create `src/components/layout/DockHomeSparkle.tsx`:

```tsx
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
  type CSSProperties,
} from 'react';
import { usePrefersReducedMotion } from '@/notepad-landing/hooks/use-prefers-reduced-motion';

export interface DockHomeSparkleHandle {
  burst: () => void;
}

interface Particle {
  id: number;
  kind: 'ring' | 'ember';
  style: CSSProperties;
}

const EMBER_COUNT = 8;
const TILE = 44; // .dock-home is h-11 w-11 = 44px
const CENTER = TILE / 2;

const rnd = (min: number, max: number) => min + Math.random() * (max - min);

let seq = 0;
const nextId = () => (seq += 1);

function buildParticles(): Particle[] {
  const particles: Particle[] = [];

  // One ripple ring, centered on the tile.
  particles.push({
    id: nextId(),
    kind: 'ring',
    style: {
      left: `${CENTER}px`,
      top: `${CENTER}px`,
      width: '14px',
      height: '14px',
      marginLeft: '-7px',
      marginTop: '-7px',
      border: '2px solid rgba(255,253,248,0.9)',
      background: 'transparent',
      boxShadow: '0 0 6px rgba(255,253,248,0.5)',
      animation: 'dock-sparkle-ring 900ms cubic-bezier(0.22,0.61,0.36,1) forwards',
    },
  });

  // Embers ignite ~10px above the tile center so they are never briefly
  // hidden against the cream tile in the dark-section dock theme.
  const originY = CENTER - 10;
  for (let i = 0; i < EMBER_COUNT; i += 1) {
    const size = rnd(3.5, 6);
    const x = CENTER + rnd(-8, 8);
    const y = originY + rnd(-4, 4);
    particles.push({
      id: nextId(),
      kind: 'ember',
      style: {
        left: `${x}px`,
        top: `${y}px`,
        width: `${size}px`,
        height: `${size}px`,
        marginLeft: `${-size / 2}px`,
        marginTop: `${-size / 2}px`,
        background:
          'radial-gradient(circle, #fffdf8 0%, #f6f4f0 55%, rgba(246,244,240,0) 100%)',
        boxShadow:
          '0 0 7px 2px rgba(255,253,248,0.95), 0 0 2px 1px rgba(120,110,95,0.4)',
        ['--ex' as string]: `${rnd(-11, 11)}px`,
        ['--ey' as string]: `${rnd(-56, -34)}px`,
        animation: `dock-ember ${rnd(850, 1150)}ms cubic-bezier(0.22,0.61,0.36,1) ${rnd(0, 150)}ms forwards`,
      },
    });
  }

  return particles;
}

/**
 * Fire-and-forget sparkle layer for the mobile bottom-dock logo tile.
 * Mirrors the WaterRipple pattern: particles live in state and remove
 * themselves on animation end. Call burst() (via ref) to fire one.
 * burst() is a no-op under prefers-reduced-motion.
 */
export const DockHomeSparkle = forwardRef<DockHomeSparkleHandle>(
  function DockHomeSparkle(_props, ref) {
    const [particles, setParticles] = useState<Particle[]>([]);
    const reducedMotion = usePrefersReducedMotion();

    const burst = useCallback(() => {
      if (reducedMotion) return;
      setParticles((prev) => [...prev, ...buildParticles()]);
    }, [reducedMotion]);

    useImperativeHandle(ref, () => ({ burst }), [burst]);

    const remove = useCallback((id: number) => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, []);

    return (
      <span
        aria-hidden="true"
        data-testid="dock-home-sparkle"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {particles.map((p) => (
          <span
            key={p.id}
            data-particle={p.kind}
            onAnimationEnd={() => remove(p.id)}
            style={{
              position: 'absolute',
              borderRadius: '50%',
              pointerEvents: 'none',
              willChange: 'transform, opacity',
              opacity: 0,
              ...p.style,
            }}
          />
        ))}
      </span>
    );
  },
);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/layout/DockHomeSparkle.test.tsx`
Expected: PASS (4 tests).

Note: in jsdom, CSS animations do not run, so `onAnimationEnd` never fires on its own — the cleanup test simulates it with `fireEvent.animationEnd(...)`. That is the intended behavior to verify.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/DockHomeSparkle.tsx src/components/layout/DockHomeSparkle.test.tsx
git commit -m "feat(dock): DockHomeSparkle ripple + ember component"
```

---

## Task 3: Wire the sparkle into the dock logo tile (TDD)

**Files:**
- Modify: `src/components/layout/MobileBottomDock.tsx` (imports + the `.dock-home` `<Link>`, ~lines 1–6 and 113–123)
- Test: `src/components/layout/MobileBottomDock.test.tsx` (add one test)

- [ ] **Step 1: Write the failing test**

In `src/components/layout/MobileBottomDock.test.tsx`, add this test inside the `describe('MobileBottomDock', ...)` block (after an existing test). It reuses the file's existing `setMatchMedia` helper and `beforeEach` (which sets `mobile: true`). Make sure `act` and `fireEvent` are imported at the top of the file — `fireEvent` is already imported; add `act` to the import from `@testing-library/react` if it is not already present (it is imported in the existing file).

```tsx
  it('fires the sparkle and still links home when the logo tile is tapped', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(
      <MemoryRouter><MobileBottomDock /></MemoryRouter>,
    );
    const homeLink = screen.getByLabelText('Home');
    // Navigation target is unchanged.
    expect(homeLink.getAttribute('href')).toBe('/');
    // Sparkle layer is mounted inside the tile.
    expect(
      homeLink.querySelector('[data-testid="dock-home-sparkle"]'),
    ).not.toBeNull();
    // Tapping fires a burst (particles appear) without removing the link.
    act(() => {
      fireEvent.click(homeLink);
    });
    expect(homeLink.querySelectorAll('[data-particle]').length).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx -t "fires the sparkle"`
Expected: FAIL — `[data-testid="dock-home-sparkle"]` is not found (sparkle not wired yet).

- [ ] **Step 3: Wire the component into the dock**

In `src/components/layout/MobileBottomDock.tsx`:

a) Add `useRef` to the React import on line 1. Change:

```tsx
import { useEffect, useState, type CSSProperties } from 'react';
```

to:

```tsx
import { useEffect, useRef, useState, type CSSProperties } from 'react';
```

b) Add the component import after the existing hook imports (after line 6, `import { useAdaptiveDockTheme, ... }`):

```tsx
import { DockHomeSparkle, type DockHomeSparkleHandle } from './DockHomeSparkle';
```

c) Inside the `MobileBottomDock` function, near the other hooks (e.g. just after `const [socialExpanded, setSocialExpanded] = useState(false);`), add the ref:

```tsx
  const sparkleRef = useRef<DockHomeSparkleHandle>(null);
```

d) Replace the existing logo `<Link>` (currently lines 113–123):

```tsx
          <Link
            to="/"
            aria-label="Home"
            className="dock-home h-11 w-11 rounded-xl inline-flex items-center justify-center"
          >
            <img
              src="/logo-icon.png"
              alt=""
              className="h-6 w-6 object-contain"
            />
          </Link>
```

with:

```tsx
          <Link
            to="/"
            aria-label="Home"
            className="dock-home relative overflow-visible h-11 w-11 rounded-xl inline-flex items-center justify-center"
            onClick={() => sparkleRef.current?.burst()}
          >
            <img
              src="/logo-icon.png"
              alt=""
              className="h-6 w-6 object-contain"
            />
            <DockHomeSparkle ref={sparkleRef} />
          </Link>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx`
Expected: PASS (all existing tests plus the new one).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/MobileBottomDock.tsx src/components/layout/MobileBottomDock.test.tsx
git commit -m "feat(dock): fire logo sparkle on tap, nav unchanged"
```

---

## Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — no regressions across the suite.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors in `DockHomeSparkle.tsx` or `MobileBottomDock.tsx`. Fix any reported issues (e.g. import order) inline.

- [ ] **Step 3: Typecheck / build**

Run: `npm run build`
Expected: `tsc -b` and Vite build succeed with no type errors.

- [ ] **Step 4: Manual check (optional but recommended)**

Run: `npm run dev`, open the app at a mobile viewport (≤ 767px wide, e.g. DevTools device toolbar), and tap the floating bottom-dock logo tile.
Expected: a ring + rising warm-white embers fire from the tile; navigation to `/` happens normally; with OS "Reduce Motion" enabled, no sparkle fires.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(dock): lint/type fixes for logo sparkle"
```

(Skip if Steps 1–3 produced no changes.)

---

## Self-Review notes

- **Spec coverage:** target element (Task 3), ripple+ember visuals (Task 1 keyframes + Task 2 styles), white-ish color fixed across themes (Task 2 inline colors), ignite-above-tile origin (Task 2 `originY`), reduced-motion no-op (Task 2 + test), accessibility `aria-hidden`/`pointer-events:none` (Task 2 + test), nav unchanged (Task 3 test), self-cleanup (Task 2 `onAnimationEnd` + test). All covered.
- **Out of scope** (header logos, desktop, theming) is untouched — only the dock Link and one CSS block change.
- **Type consistency:** `DockHomeSparkleHandle.burst` is defined in Task 2 and consumed identically in Task 3; `data-particle` values `"ring"`/`"ember"` match between component and all tests.
