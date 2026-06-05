# Mobile hero — Pellmell-style breathing room + bottom dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the mobile hero more breathing room (spacing/layout only — typography unchanged) and replace the top `HeaderMobile` with a floating bottom dock (logo + MENU) that hides on scroll-down and reveals on scroll-up.

**Architecture:** New `MobileBottomDock` component drives off a new `useScrollDirection` hook. `HeaderMobile` becomes a no-op stub; the dispatcher and desktop path are untouched. App-tree wrapper gains a single CSS variable–driven bottom padding on mobile so every route clears the floating dock. `HeroMobile` gets spacing-only changes plus one decorative red-square accent before "Psalm 23:2-3".

**Tech Stack:** React 18, TypeScript, Tailwind, Vitest + @testing-library/react (jsdom env), react-router-dom, existing shadcn `Sheet`, existing `subscribeNavTheme`.

**Spec:** [`docs/superpowers/specs/2026-05-30-mobile-hero-pellmell-breathing-room-design.md`](../specs/2026-05-30-mobile-hero-pellmell-breathing-room-design.md)

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/index.css` | Modify (`:root` block, ~line 72) | Define `--mobile-dock-clearance` CSS custom property |
| `src/hooks/use-scroll-direction.ts` | Create | Hook returning `'up' \| 'down' \| 'idle'` |
| `src/hooks/use-scroll-direction.test.ts` | Create | Hook unit tests |
| `src/components/layout/MobileBottomDock.tsx` | Create | Floating bottom-dock component with logo + MENU pill + Sheet drawer |
| `src/components/layout/MobileBottomDock.test.tsx` | Create | Component tests |
| `src/components/layout/HeaderMobile.tsx` | Modify (replace body) | Returns `null` |
| `src/components/layout/HeaderMobile.test.tsx` | Modify (replace suite) | Single "renders nothing" assertion |
| `src/components/sections/HeroMobile.tsx` | Modify | Spacing changes + red-square accent on attribution |
| `src/components/sections/HeroMobile.test.tsx` | Modify (add tests) | Assert new spacing + red-square sibling span |
| `src/App.tsx` | Modify | Extract `dockMounted` predicate; mount `<MobileBottomDock>`; add wrapper padding |

---

## Task 1: Add `--mobile-dock-clearance` CSS custom property

**Files:**
- Modify: `src/index.css` (`:root` block, currently around line 72–80)

This is a foundational, atomic change — no behavior yet, just a token other tasks consume. No test (CSS custom properties aren't unit-testable in jsdom in a meaningful way).

- [ ] **Step 1: Add the variable**

In `src/index.css`, locate the `:root` block inside `@layer base`. After the existing brand-color declarations (after the `--warm-sand` line at ~80), insert:

```css
    /* Floating mobile bottom dock — height (h-11 = 44px) + outer pb minimum
       + iOS home-indicator safe-area + 16px breathing buffer. Drives the
       mobile-only padding-bottom on the App wrapper so content never sits
       under the dock. Single source of truth. */
    --mobile-dock-clearance: calc(44px + 0.75rem + env(safe-area-inset-bottom, 0px) + 1rem);
```

- [ ] **Step 2: Verify CSS still parses**

Run: `npm run build`
Expected: build succeeds (no PostCSS/Tailwind errors). Stop early if it fails.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(css): add --mobile-dock-clearance custom property

Drives the mobile-only bottom padding on the App content wrapper so
content clears the upcoming MobileBottomDock. Single source of truth
that incorporates pill height, outer pb, iOS safe-area, and a visual
breathing buffer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `useScrollDirection` hook (TDD)

**Files:**
- Create: `src/hooks/use-scroll-direction.ts`
- Create: `src/hooks/use-scroll-direction.test.ts`

The hook tracks scroll direction with a threshold filter (rejects micro-jitter) and forces `'idle'` near the top of the page so the dock is always visible on the hero. Tests use `renderHook` plus synthetic `window.scrollY` mutations and `window.dispatchEvent(new Event('scroll'))`.

- [ ] **Step 1: Write the failing test file**

Create `src/hooks/use-scroll-direction.test.ts`:

```ts
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useScrollDirection } from './use-scroll-direction';

function setScroll(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
  window.dispatchEvent(new Event('scroll'));
}

// rAF in jsdom fires asynchronously. Flush it manually.
function flushRaf() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

afterEach(() => {
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
});

describe('useScrollDirection', () => {
  it('returns "idle" on initial mount', () => {
    const { result } = renderHook(() => useScrollDirection());
    expect(result.current).toBe('idle');
  });

  it('returns "down" after a downward scroll past threshold', async () => {
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true, writable: true });
    const { result } = renderHook(() => useScrollDirection());
    await act(async () => {
      setScroll(400);
      await flushRaf();
    });
    expect(result.current).toBe('down');
  });

  it('returns "up" after an upward scroll past threshold', async () => {
    Object.defineProperty(window, 'scrollY', { value: 400, configurable: true, writable: true });
    const { result } = renderHook(() => useScrollDirection());
    await act(async () => {
      setScroll(200);
      await flushRaf();
    });
    expect(result.current).toBe('up');
  });

  it('ignores deltas smaller than the threshold', async () => {
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true, writable: true });
    const { result } = renderHook(() => useScrollDirection(20));
    await act(async () => {
      setScroll(310); // delta 10, below threshold 20
      await flushRaf();
    });
    expect(result.current).toBe('idle');
  });

  it('forces "idle" when scrollY < 80, regardless of prior direction', async () => {
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true, writable: true });
    const { result } = renderHook(() => useScrollDirection());
    await act(async () => {
      setScroll(400);
      await flushRaf();
    });
    expect(result.current).toBe('down');
    await act(async () => {
      setScroll(20);
      await flushRaf();
    });
    expect(result.current).toBe('idle');
  });

  it('removes the scroll listener on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useScrollDirection());
    unmount();
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    remove.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/use-scroll-direction.test.ts`
Expected: FAIL — `Cannot find module './use-scroll-direction'`.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/use-scroll-direction.ts`:

```ts
import { useEffect, useState } from 'react';

export type ScrollDirection = 'up' | 'down' | 'idle';

export function useScrollDirection(threshold = 8): ScrollDirection {
  const [dir, setDir] = useState<ScrollDirection>('idle');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (y < 80) {
          setDir('idle');
          lastY = y;
        } else if (Math.abs(delta) >= threshold) {
          setDir(delta > 0 ? 'down' : 'up');
          lastY = y;
        }
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return dir;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/use-scroll-direction.test.ts`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-scroll-direction.ts src/hooks/use-scroll-direction.test.ts
git commit -m "feat(hooks): add useScrollDirection

rAF-throttled, passive-listener scroll direction tracker with threshold
filter for inertial jitter and a forced 'idle' state near the top of
the page so dependent UI (incoming MobileBottomDock) stays visible on
the hero.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `MobileBottomDock` component (TDD)

**Files:**
- Create: `src/components/layout/MobileBottomDock.tsx`
- Create: `src/components/layout/MobileBottomDock.test.tsx`

The component is the new chrome surface on mobile. Below 768px it renders a fixed-bottom `<aside>` with a logo link to `/` and a `MENU` pill that opens the existing right-side `Sheet` drawer (same `navItems`, same `onNavTrigger` callback). Above 768px it returns `null`. Visibility is driven by `useScrollDirection`.

- [ ] **Step 1: Write the failing test file**

Create `src/components/layout/MobileBottomDock.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

function setMatchMedia(opts: { mobile: boolean; reducedMotion?: boolean }) {
  const { mobile, reducedMotion = false } = opts;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches:
      query.includes('reduce') ? reducedMotion :
      query.includes('max-width') ? mobile :
      false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function flushRaf() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
});

describe('MobileBottomDock', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
  });

  it('renders nothing when viewport is desktop', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    setMatchMedia({ mobile: false });
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    const { container } = render(
      <MemoryRouter><MobileBottomDock /></MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="mobile-bottom-dock"]')).toBeNull();
  });

  it('renders a logo link to "/" and a MENU button on mobile', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    const logo = screen.getByRole('link', { name: /home/i });
    expect(logo.getAttribute('href')).toBe('/');
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('starts visible (data-visible="true")', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    const dock = screen.getByTestId('mobile-bottom-dock');
    expect(dock.getAttribute('data-visible')).toBe('true');
  });

  it('opens the Sheet drawer when MENU is clicked', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Purpose' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notepad' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Community' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact' })).toBeInTheDocument();
  });

  it('fires onNavTrigger when a trigger-label nav link is tapped', async () => {
    vi.resetModules();
    const onNavTrigger = vi.fn();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock onNavTrigger={onNavTrigger} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    fireEvent.click(screen.getByRole('link', { name: 'Purpose' }));
    expect(onNavTrigger).toHaveBeenCalled();
  });

  it('hides on scroll-down past threshold (data-visible="false")', async () => {
    vi.resetModules();
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true, writable: true });
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 400, configurable: true, writable: true });
      window.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });
    const dock = screen.getByTestId('mobile-bottom-dock');
    expect(dock.getAttribute('data-visible')).toBe('false');
  });

  it('reveals on scroll-up past threshold (data-visible="true")', async () => {
    vi.resetModules();
    Object.defineProperty(window, 'scrollY', { value: 400, configurable: true, writable: true });
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    // First scroll down to set state to down, then scroll up.
    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 500, configurable: true, writable: true });
      window.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });
    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 300, configurable: true, writable: true });
      window.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });
    const dock = screen.getByTestId('mobile-bottom-dock');
    expect(dock.getAttribute('data-visible')).toBe('true');
  });

  it('forces visible when near the top of the page (scrollY < 80)', async () => {
    vi.resetModules();
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true, writable: true });
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 600, configurable: true, writable: true });
      window.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });
    expect(screen.getByTestId('mobile-bottom-dock').getAttribute('data-visible')).toBe('false');
    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 20, configurable: true, writable: true });
      window.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });
    expect(screen.getByTestId('mobile-bottom-dock').getAttribute('data-visible')).toBe('true');
  });

  it('renders the logo with a permanent invert(1) filter for white-on-dark on the pill', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    const logo = screen.getByAltText('');
    expect(logo.style.filter).toBe('invert(1)');
  });

  it('outer aside has motion-reduce class for reduced-motion users', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    const dock = screen.getByTestId('mobile-bottom-dock');
    expect(dock.className).toContain('motion-reduce:transition-none');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx`
Expected: FAIL — `Cannot find module './MobileBottomDock'`.

- [ ] **Step 3: Implement the component**

Create `src/components/layout/MobileBottomDock.tsx`:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { navItems, NAV_TRIGGER_LABELS } from '@/data/projects';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScrollDirection } from '@/hooks/use-scroll-direction';

interface MobileBottomDockProps {
  onNavTrigger?: () => void;
}

/**
 * Floating bottom dock for the mobile viewport (< 768px). Replaces the old
 * top `HeaderMobile`. Always visible at the top of the page; hides on
 * scroll-down; reveals on scroll-up. Logo links to "/", MENU pill opens the
 * same right-side Sheet drawer the old Header used. The pill background is
 * permanently `--deep-umber` and the logo is permanently inverted to white
 * — unlike the old transparent Header, the opaque pill doesn't need
 * nav-theme color reactivity.
 */
export function MobileBottomDock({ onNavTrigger }: MobileBottomDockProps) {
  const isMobile = useIsMobile();
  const dir = useScrollDirection();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!isMobile) return null;

  const visible = dir !== 'down';

  return (
    <aside
      data-testid="mobile-bottom-dock"
      data-visible={visible ? 'true' : 'false'}
      aria-label="Quick navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-300 motion-reduce:transition-none"
      style={{ transform: visible ? 'translateY(0)' : 'translateY(calc(100% + 1rem))' }}
    >
      <div className="pointer-events-auto flex items-center gap-2">
        <Link
          to="/"
          aria-label="Home"
          className="h-11 w-11 rounded-xl bg-[color:var(--deep-umber)] inline-flex items-center justify-center"
        >
          <img
            src="/logo-icon.png"
            alt=""
            className="h-6 w-6 object-contain"
            style={{ filter: 'invert(1)' }}
          />
        </Link>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open menu"
              className="h-11 px-6 rounded-full bg-[color:var(--deep-umber)] text-white text-xs font-semibold tracking-[0.14em]"
            >
              MENU
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-3/4 sm:w-1/2 bg-[color:var(--deep-umber)] text-white"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <nav className="mt-12 flex flex-col gap-6 text-lg" aria-label="Mobile primary">
              {navItems.map((item) => (
                <SheetClose asChild key={item.label}>
                  <Link
                    to={item.href}
                    className="block py-3 min-h-[44px]"
                    onClick={() => {
                      if (NAV_TRIGGER_LABELS.has(item.label)) onNavTrigger?.();
                    }}
                  >
                    {item.label}
                  </Link>
                </SheetClose>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx`
Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/MobileBottomDock.tsx src/components/layout/MobileBottomDock.test.tsx
git commit -m "feat(layout): MobileBottomDock component

Floating bottom dock for mobile viewport — logo + MENU pill, opens the
existing right-side Sheet drawer with the same nav items as the old
HeaderMobile. Hides on scroll-down, reveals on scroll-up; forced
visible near the top of the page. Reacts to nav-theme so the logo
stays legible against dark sections. Returns null above 768px so
desktop is unaffected.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Stub `HeaderMobile` and trim its test

**Files:**
- Modify: `src/components/layout/HeaderMobile.tsx`
- Modify: `src/components/layout/HeaderMobile.test.tsx`

The old file becomes a no-op so the `Header.tsx` dispatcher can keep importing it without rendering anything on mobile. The test suite is replaced by a single "renders nothing" assertion.

- [ ] **Step 1: Replace the test suite with a failing test**

Replace the entire contents of `src/components/layout/HeaderMobile.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { HeaderMobile } from './HeaderMobile';

afterEach(cleanup);

describe('HeaderMobile (stubbed)', () => {
  it('renders nothing — the MobileBottomDock replaces it on mobile', () => {
    const { container } = render(
      <MemoryRouter>
        <HeaderMobile onNavTrigger={vi.fn()} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run src/components/layout/HeaderMobile.test.tsx`
Expected: FAIL — old `HeaderMobile` still renders the top bar, so the container is not empty.

- [ ] **Step 3: Replace `HeaderMobile.tsx` body**

Overwrite `src/components/layout/HeaderMobile.tsx` with:

```tsx
interface HeaderMobileProps {
  onNavTrigger?: () => void;
}

/**
 * No-op stub. The MobileBottomDock replaces the mobile header — see
 * `src/components/layout/MobileBottomDock.tsx`. This file is kept so the
 * `Header.tsx` dispatcher's mobile branch import doesn't have to change,
 * and so a future re-enable is a one-line revert.
 */
export function HeaderMobile(_props: HeaderMobileProps) {
  return null;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/components/layout/HeaderMobile.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the broader layout test suite for regressions**

Run: `npx vitest run src/components/layout/`
Expected: all tests in that folder PASS, including `MobileBottomDock.test.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/HeaderMobile.tsx src/components/layout/HeaderMobile.test.tsx
git commit -m "refactor(layout): HeaderMobile becomes a no-op stub

The MobileBottomDock replaces the mobile header. HeaderMobile is kept
as a returns-null component so the Header.tsx dispatcher's import is
unchanged and a future re-enable is a one-line revert. Old test suite
replaced with a single 'renders nothing' assertion.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `HeroMobile` spacing + red-square accent

**Files:**
- Modify: `src/components/sections/HeroMobile.tsx` (around lines 106–175)
- Modify: `src/components/sections/HeroMobile.test.tsx` (add tests; existing tests stay)

Layout/spacing changes only — typography is unchanged. The quote attribution gets a 6×6px red square span (decorative, `aria-hidden`) before "Psalm 23:2-3" as a pellmell-style accent.

- [ ] **Step 1: Add the failing tests**

Append the following two tests inside the existing `describe('HeroMobile content', ...)` block in `src/components/sections/HeroMobile.test.tsx` (just before the closing `});` on line 258):

```tsx
  it('outer column wrapper uses the breathing-room spacing (pt-20 pb-16 px-5 gap-10)', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { getByTestId } = render(<Hero introActive={false} />);
    const root = getByTestId('hero-mobile');
    // The column wrapper is the first child div inside the root.
    const column = root.querySelector<HTMLDivElement>(':scope > div.flex.flex-col');
    expect(column).not.toBeNull();
    expect(column?.className).toContain('pt-20');
    expect(column?.className).toContain('pb-16');
    expect(column?.className).toContain('px-5');
    expect(column?.className).toContain('gap-10');
  });

  it('quote attribution contains an aria-hidden decorative red-square accent', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { getByTestId } = render(<Hero introActive={false} />);
    const quote = getByTestId('hero-mobile-quote');
    const attr = quote.querySelector<HTMLParagraphElement>('.quote-attr');
    expect(attr).not.toBeNull();
    const accent = attr?.querySelector<HTMLSpanElement>('span[aria-hidden="true"]');
    expect(accent).not.toBeNull();
    // The accent uses the --accent-red token with a #d9483a fallback.
    expect(accent?.className).toMatch(/bg-\[var\(--accent-red,#d9483a\)\]/);
  });
```

- [ ] **Step 2: Run the failing tests to confirm**

Run: `npx vitest run src/components/sections/HeroMobile.test.tsx`
Expected: 2 new tests FAIL (current wrapper still uses `pt-24 pb-12 gap-8`; no red-square span exists). All other tests in the file PASS.

- [ ] **Step 3: Apply the spacing change**

In `src/components/sections/HeroMobile.tsx`, replace **line 106** exactly:

```tsx
      <div className="relative w-full flex flex-col items-center justify-center pt-24 pb-12 px-5 gap-8">
```

with:

```tsx
      <div className="relative w-full flex flex-col items-center justify-center pt-20 pb-16 px-5 gap-10">
```

- [ ] **Step 4: Apply the quote-container nudge**

In `src/components/sections/HeroMobile.tsx`, replace the quote container className (currently `className={cn('text-center px-6 transition-opacity duration-1000 max-w-md', quoteVisible ? 'opacity-100' : 'opacity-0',)}` at lines 112–115) so it uses `px-8 mt-2`:

```tsx
          className={cn(
            'text-center px-8 mt-2 transition-opacity duration-1000 max-w-md',
            quoteVisible ? 'opacity-100' : 'opacity-0',
          )}
```

- [ ] **Step 5: Add the red-square accent + bump attribution margin**

In `src/components/sections/HeroMobile.tsx`, replace the existing attribution paragraph (currently lines 123–125):

```tsx
          <p className="quote-attr text-xs opacity-60 mt-4">
            Psalm 23:2-3
          </p>
```

with:

```tsx
          <p className="quote-attr text-xs opacity-60 mt-5 inline-flex items-center justify-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block w-1.5 h-1.5 bg-[var(--accent-red,#d9483a)]"
            />
            Psalm 23:2-3
          </p>
```

- [ ] **Step 6: Bump the bridge container margins**

In `src/components/sections/HeroMobile.tsx`, the bridge container is currently:

```tsx
        <div
          ref={bridgeRef}
          data-testid="hero-mobile-bridge"
          data-visible={bridgeVisible ? 'true' : 'false'}
          className="mt-16 mb-24 text-center px-6 flex flex-col gap-8 max-w-md"
        >
```

Replace the className value:

```tsx
          className="mt-20 mb-32 text-center px-6 flex flex-col gap-8 max-w-md"
```

- [ ] **Step 7: Run the HeroMobile tests to verify everything passes**

Run: `npx vitest run src/components/sections/HeroMobile.test.tsx`
Expected: all tests PASS — the 2 new tests now pass; every existing test (centered wordmark, masked video, intersection-fade, GSAP-collapse, reduced-motion poster, quote-before-video DOM order) continues to pass because none of those assertions touched the classes that changed.

- [ ] **Step 8: Commit**

```bash
git add src/components/sections/HeroMobile.tsx src/components/sections/HeroMobile.test.tsx
git commit -m "feat(hero-mobile): breathing-room spacing + red-square attribution accent

Modest spacing increases per the pellmell-style breathing-room spec —
column wrapper goes pt-24/pb-12/gap-8 -> pt-20/pb-16/gap-10 (pt-20 now
the top Header is gone), quote nudged px-6 -> px-8 + mt-2, bridge
margins bumped mt-16/mb-24 -> mt-20/mb-32. Quote font is unchanged
per user direction. Adds a small decorative red square (aria-hidden)
before 'Psalm 23:2-3' as a pellmell-style brand-color punctuation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire `MobileBottomDock` into `App.tsx` + add wrapper clearance

**Files:**
- Modify: `src/App.tsx`

Three changes in one file:
1. Import `MobileBottomDock`.
2. Extract `dockMounted` predicate (currently inlined on App.tsx:130).
3. Apply `pb-[var(--mobile-dock-clearance)] md:pb-0` to the outer content wrapper when `dockMounted` is true.
4. Mount `<MobileBottomDock onNavTrigger={handleNavTrigger} />` adjacent to the `<Header>` line under the same predicate.

No new test for App.tsx — it's already covered by the end-to-end behavior of all the unit tests; an App-level test would duplicate setup with little signal. Manual verification step at the end.

- [ ] **Step 1: Add the import**

In `src/App.tsx`, at the top with the other layout imports, add:

```tsx
import { MobileBottomDock } from '@/components/layout/MobileBottomDock';
```

(Place it alphabetically near the existing `Header` / `Footer` imports.)

- [ ] **Step 2: Extract the `dockMounted` predicate and rewrite the Header conditional**

In `src/App.tsx`, locate the route-flag block at lines 104–111 and add `dockMounted` after `hideFooter`:

```tsx
const hideFooter = isDetailPage || isPurposePage || isNotepadAny || isLoginPage || isProfilePage || isWelcomePage || isCommunityPage || isContactPage;
const dockMounted = !isNotepadEditor && !isLoginPage && !isProfilePage && !isWelcomePage;
```

Then in the JSX at line 130, replace:

```tsx
{!isNotepadEditor && !isLoginPage && !isProfilePage && !isWelcomePage && <Header darkText={isDetailPage || isPurposePage} showNav={headerVisible} onNavTrigger={handleNavTrigger} />}
```

with:

```tsx
{dockMounted && <Header darkText={isDetailPage || isPurposePage} showNav={headerVisible} onNavTrigger={handleNavTrigger} />}
{dockMounted && <MobileBottomDock onNavTrigger={handleNavTrigger} />}
```

- [ ] **Step 3: Apply wrapper clearance**

In `src/App.tsx`, find the outer content wrapper at line 128:

```tsx
<div className="relative min-h-screen" style={{ background: 'var(--app-bg)', zIndex: 1 }}>
```

Replace with:

```tsx
<div
  className={cn(
    'relative min-h-screen',
    dockMounted && 'pb-[var(--mobile-dock-clearance)] md:pb-0',
  )}
  style={{ background: 'var(--app-bg)', zIndex: 1 }}
>
```

If `cn` is not yet imported in `App.tsx`, add the import alongside the other `@/lib/utils` imports (or add a new one):

```tsx
import { cn } from '@/lib/utils';
```

- [ ] **Step 4: Run the full test suite for regressions**

Run: `npm test`
Expected: all tests PASS. If a snapshot-based test (none expected, but possible) flags the new wrapper className, update it.

- [ ] **Step 5: Manual browser verification**

Start the dev server: `npm run dev`

Open `http://localhost:5173/` on a mobile viewport (Chrome DevTools device emulation, iPhone 14 / 390×844 or similar) and verify:

1. The top Header is gone on mobile.
2. The floating bottom dock is visible at the bottom — logo square + MENU pill, centered.
3. Tap MENU → the right-side Sheet drawer opens with Purpose / Notepad / Community / Contact.
4. Tap a nav link → drawer closes and navigates.
5. Scroll the hero down past ~80px → dock slides out smoothly.
6. Scroll back up → dock slides in.
7. Stop scrolling at the very bottom of the home page → dock reappears and does NOT cover the Footer's last line (there is a visible ~60px gap between Footer text and the dock).
8. Navigate to `/community` → Footer is hidden but the dock still has the same gap from the page content above it.
9. Navigate to `/notepad/notes` (the editor) → dock is gone (suppression matches the old Header rule).
10. Resize the viewport ≥ 768px → dock disappears, desktop HeaderDesktop returns.
11. iOS Safari (real device or `Show Web Inspector` simulator with notch): dock sits above the home indicator with a small visual gap.

If any of these fail, stop and report the discrepancy — do not commit yet.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): mount MobileBottomDock and add wrapper clearance

Wires the new bottom dock into App alongside the existing Header (both
under a shared dockMounted predicate). Adds mobile-only
pb-[var(--mobile-dock-clearance)] to the outer content wrapper so
content on every dock route clears the floating dock — not only routes
that render the Footer/CTA.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Final verification

After Task 6 commits:

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: every test PASSES. No suite is skipped beyond ones already skipped in `main`.

- [ ] **Step 2: TypeScript build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors introduced by the touched files.

- [ ] **Step 4: Spec coverage cross-check**

Open the spec at `docs/superpowers/specs/2026-05-30-mobile-hero-pellmell-breathing-room-design.md` and tick each section against the implemented tasks:

| Spec section | Task |
|---|---|
| `MobileBottomDock` structure | Task 3 |
| `useScrollDirection` hook | Task 2 |
| `HeaderMobile` change | Task 4 |
| `HeroMobile` spacing table | Task 5 |
| Red-square accent | Task 5 |
| `--mobile-dock-clearance` token | Task 1 |
| App.tsx wrapper + integration | Task 6 |
| Tests for each component | Tasks 2/3/4/5 |

If anything was missed, surface it before declaring done.
