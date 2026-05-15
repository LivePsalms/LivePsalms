# Nav Scroll-Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Couple the desktop nav's collapse to the home hero's existing wordmark-collapse pin (with a scrollY fallback elsewhere) so nav items fade rightward one-by-one into a hamburger that, when clicked, reverse-plays the collapse inline.

**Architecture:** A module-level pub/sub singleton (`nav-collapse-progress.ts`) carries a normalized `[0,1]` progress value. Hero publishes from its existing collapse timeline's `onUpdate`. Header subscribes; on routes without a hero, Header creates its own lightweight `scrollY` ScrollTrigger that publishes to the same singleton. The subscriber mutates DOM refs directly (no React re-renders during scroll). Click-to-expand and scroll-resync run as separate GSAP tweens managed via refs.

**Tech Stack:** React 18, TypeScript, GSAP + ScrollTrigger (already in repo), Tailwind, Lucide icons. No new dependencies. No automated tests this iteration (per spec — verification is manual).

**Spec reference:** [docs/superpowers/specs/2026-05-15-nav-scroll-collapse-design.md](../specs/2026-05-15-nav-scroll-collapse-design.md)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/nav-collapse-progress.ts` | Create | Module-level pub/sub for nav-collapse progress |
| `src/components/sections/Hero.tsx` | Modify (1 line in existing effect) | Publish progress from existing wordmark-collapse timeline |
| `src/components/layout/Header.tsx` | Modify (extensive) | Subscribe + apply per-item transforms, render desktop burger, own the click-expand state machine, own the non-home fallback ScrollTrigger |

Each task below produces a self-contained, verifiable change and a commit. Verification is run in a dev server (`npm run dev` → `http://localhost:5173`).

---

### Task 1: Pub/sub module

**Files:**
- Create: `src/lib/nav-collapse-progress.ts`

- [ ] **Step 1: Create the module**

Write file `src/lib/nav-collapse-progress.ts`:

```ts
// Module-level pub/sub for the nav-collapse animation's progress.
//
// One publisher at a time — either the Hero's scroll-collapse timeline on `/`
// or the Header's fallback ScrollTrigger on other routes. Subscribers (the
// Header's nav DOM applier and the click-expand state machine) read directly
// from this module; no React Context is involved.

type Listener = (progress: number) => void;

const listeners = new Set<Listener>();
let current = 0;

export function setNavCollapseProgress(progress: number): void {
  current = progress;
  listeners.forEach((l) => l(progress));
}

export function subscribeNavCollapseProgress(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function getNavCollapseProgress(): number {
  return current;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors (the file is unused at this point, but the type-checker should be happy).

- [ ] **Step 3: Commit**

```bash
git add src/lib/nav-collapse-progress.ts
git commit -m "feat(nav): add nav-collapse-progress pub/sub module"
```

---

### Task 2: Hero publishes from its existing collapse timeline

**Files:**
- Modify: `src/components/sections/Hero.tsx:1-7` (add import) and `src/components/sections/Hero.tsx:332-347` (add `onUpdate`)

- [ ] **Step 1: Add the import**

Edit `src/components/sections/Hero.tsx`. After the existing imports at lines 1-4, before `gsap.registerPlugin`:

Old:
```ts
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PsalmsWordmarkSvg } from './PsalmsWordmarkSvg';

gsap.registerPlugin(ScrollTrigger);
```

New:
```ts
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PsalmsWordmarkSvg } from './PsalmsWordmarkSvg';
import { setNavCollapseProgress } from '@/lib/nav-collapse-progress';

gsap.registerPlugin(ScrollTrigger);
```

- [ ] **Step 2: Add `onUpdate` to the existing collapse timeline's ScrollTrigger**

Edit `src/components/sections/Hero.tsx`. Locate the existing `gsap.timeline({...})` inside the scroll-collapse `useLayoutEffect` (around lines 331-347).

Old:
```ts
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { force3D: true },
        scrollTrigger: {
          trigger: scrollEl,
          start: 'top top',
          // 60% of the 380vh outer = 228vh of scrub. The remaining 152vh of
          // the outer is the natural sticky-release exit. Each collapse wave
          // gets ~84vh of scroll to read at a deliberate pace.
          end: '60% top',
          // scrub: 2 lerps the timeline ~2s behind the scroll position, so
          // fast trackpad flicks decompress into a smooth settle instead of
          // racing through the collapse.
          scrub: 2,
          invalidateOnRefresh: true,
        },
      });
```

New:
```ts
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { force3D: true },
        scrollTrigger: {
          trigger: scrollEl,
          start: 'top top',
          // 60% of the 380vh outer = 228vh of scrub. The remaining 152vh of
          // the outer is the natural sticky-release exit. Each collapse wave
          // gets ~84vh of scroll to read at a deliberate pace.
          end: '60% top',
          // scrub: 2 lerps the timeline ~2s behind the scroll position, so
          // fast trackpad flicks decompress into a smooth settle instead of
          // racing through the collapse.
          scrub: 2,
          invalidateOnRefresh: true,
          // Publishes the wordmark-collapse progress to the singleton so the
          // Header's nav-collapse subscriber can drive the per-item fade in
          // lockstep with the letter waves.
          onUpdate: (self) => setNavCollapseProgress(self.progress),
        },
      });
```

- [ ] **Step 3: Verify**

Start dev server: `npm run dev`. Open `http://localhost:5173/`. After the intro completes, scroll slowly through the hero. In DevTools console:
```js
const m = await import('/src/lib/nav-collapse-progress.ts');
console.log(m.getNavCollapseProgress());
```
Expected: a number between 0 and 1 that matches your scroll position into the pin region. Scrolling up resets it toward 0. Wordmark collapse animation still plays as before.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "feat(hero): publish collapse progress for nav subscriber"
```

---

### Task 3: Header — imports, prefersReducedMotion, refs scaffolding

**Files:**
- Modify: `src/components/layout/Header.tsx:1-4` (imports) and `src/components/layout/Header.tsx:50-62` (component body)

- [ ] **Step 1: Update imports**

Edit `src/components/layout/Header.tsx`. Replace lines 1-4:

Old:
```ts
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { navItems } from '@/data/projects';
import { X, Menu } from 'lucide-react';
```

New:
```ts
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { navItems } from '@/data/projects';
import { X, Menu } from 'lucide-react';
import {
  subscribeNavCollapseProgress,
  setNavCollapseProgress,
  getNavCollapseProgress,
} from '@/lib/nav-collapse-progress';

gsap.registerPlugin(ScrollTrigger);
```

- [ ] **Step 2: Add prefersReducedMotion memo and refs inside the Header component**

Edit `src/components/layout/Header.tsx`. Locate the component start (around line 50). After the existing `const [isScrolled, setIsScrolled] = useState(false);` (~line 53) and `const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);` (~line 54), insert the new refs and memo:

Old:
```ts
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Soft-translucent text — paired with the glass text-shadow in
```

New:
```ts
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Nav-collapse refs. The DOM applier writes directly to these on every
  // scroll/scrub frame; no React state is involved.
  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const burgerRef = useRef<HTMLButtonElement | null>(null);
  // State machine: 'scrub' (default), 'click-expanded' (user clicked burger),
  // 'resyncing' (first scroll input after click-expanded — tweening back).
  const stateRef = useRef<'scrub' | 'click-expanded' | 'resyncing'>('scrub');
  // Last progress value applyDom wrote. Used as the starting point for the
  // click-expand tween so it doesn't pop.
  const currentProgressRef = useRef<number>(0);
  // Active click-expand or resync tween, so we can kill it on re-entry.
  const activeTweenRef = useRef<gsap.core.Tween | null>(null);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const isHome = location.pathname === '/';

  // Soft-translucent text — paired with the glass text-shadow in
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors. Refs are unused at this point but TypeScript is happy with the types.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(header): add nav-collapse refs and prefersReducedMotion memo"
```

---

### Task 4: Add nav id + per-item wrapper spans with refs

**Files:**
- Modify: `src/components/layout/Header.tsx:121-164` (desktop nav + items)

- [ ] **Step 1: Add `id="primary-nav"` and `ref={navRef}` to the desktop `<nav>`**

Edit `src/components/layout/Header.tsx`. Locate the desktop nav opening tag (around line 122).

Old:
```tsx
        {/* Desktop Navigation - 3D emergence effect */}
        <nav
          className="hidden md:flex items-center gap-6 lg:gap-8"
          style={{
```

New:
```tsx
        {/* Desktop Navigation - 3D emergence effect */}
        <nav
          ref={navRef}
          id="primary-nav"
          className="hidden md:flex items-center gap-6 lg:gap-8"
          style={{
```

- [ ] **Step 2: Wrap each navItems entry in a span with a ref**

Edit `src/components/layout/Header.tsx`. Locate the `navItems.map(...)` block (around lines 135-164).

Old:
```tsx
          {navItems.map((item, index) => (
            <WaterText
              key={item.label}
              href={item.href}
              as="a"
              className="psalms-nav-link text-base lg:text-lg font-bold tracking-wide"
              style={{
                fontFamily: "'The Softly Serif', serif",
                fontStyle: 'italic',
                opacity: showNav ? 1 : 0,
                transform: showNav
                  ? 'translateY(0)'
                  : 'translateY(20px)',
                transition: `opacity 2.5s cubic-bezier(0.16, 1, 0.3, 1) ${800 + index * 150}ms, transform 2.5s cubic-bezier(0.16, 1, 0.3, 1) ${800 + index * 150}ms, color 300ms ease, text-decoration-color 300ms ease`,
                ['--c-rest' as string]: textColor,
                ['--c-hover' as string]: hoverColor,
              } as React.CSSProperties}
              onClick={(e: React.MouseEvent) => {
                if (NAV_TRIGGER_LABELS.has(item.label)) {
                  onNavTrigger?.();
                }
                if (item.href.startsWith('/')) {
                  e.preventDefault();
                  navigate(item.href);
                }
              }}
            >
              {item.label}
            </WaterText>
          ))}
```

New:
```tsx
          {navItems.map((item, index) => (
            <span
              key={item.label}
              ref={(el) => { itemRefs.current[index] = el; }}
              style={{ display: 'inline-flex', willChange: 'transform, opacity, filter' }}
            >
              <WaterText
                href={item.href}
                as="a"
                className="psalms-nav-link text-base lg:text-lg font-bold tracking-wide"
                style={{
                  fontFamily: "'The Softly Serif', serif",
                  fontStyle: 'italic',
                  opacity: showNav ? 1 : 0,
                  transform: showNav
                    ? 'translateY(0)'
                    : 'translateY(20px)',
                  transition: `opacity 2.5s cubic-bezier(0.16, 1, 0.3, 1) ${800 + index * 150}ms, transform 2.5s cubic-bezier(0.16, 1, 0.3, 1) ${800 + index * 150}ms, color 300ms ease, text-decoration-color 300ms ease`,
                  ['--c-rest' as string]: textColor,
                  ['--c-hover' as string]: hoverColor,
                } as React.CSSProperties}
                onClick={(e: React.MouseEvent) => {
                  if (NAV_TRIGGER_LABELS.has(item.label)) {
                    onNavTrigger?.();
                  }
                  if (item.href.startsWith('/')) {
                    e.preventDefault();
                    navigate(item.href);
                  }
                }}
              >
                {item.label}
              </WaterText>
            </span>
          ))}
```

- [ ] **Step 3: Verify**

`npm run dev`. Visual layout of the desktop nav is unchanged (the wrapping span is inline-flex with no padding/margin). Inspect DOM in DevTools: each WaterText anchor is now inside a `<span style="display: inline-flex">` with a ref attached.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(header): wrap nav items with ref-bearing spans"
```

---

### Task 5: Wrap em-dash + Social into Social-block ref wrapper

**Files:**
- Modify: `src/components/layout/Header.tsx:165-228` (em-dash + Social dropdown)

- [ ] **Step 1: Wrap the em-dash span and the Social `<div>` into a single ref-bearing `<div>`**

Edit `src/components/layout/Header.tsx`. Locate the em-dash span and Social dropdown block (around lines 165-227).

Old:
```tsx
          <span 
            style={{
              color: textColor,
              opacity: showNav ? 0.3 : 0,
              transition: 'opacity 2s ease',
              transitionDelay: '1400ms',
            }}
          >—</span>
          <div
            className="relative group"
            style={{
              opacity: showNav ? 1 : 0,
              transform: showNav
                ? 'translateY(0)'
                : 'translateY(20px)',
              transition: 'all 2.5s cubic-bezier(0.16, 1, 0.3, 1)',
              transitionDelay: '1500ms',
            }}
          >
```

New:
```tsx
          <div
            ref={(el) => { itemRefs.current[4] = el; }}
            className="flex items-center gap-6 lg:gap-8"
            style={{ willChange: 'transform, opacity, filter' }}
          >
            <span 
              style={{
                color: textColor,
                opacity: showNav ? 0.3 : 0,
                transition: 'opacity 2s ease',
                transitionDelay: '1400ms',
              }}
            >—</span>
            <div
              className="relative group"
              style={{
                opacity: showNav ? 1 : 0,
                transform: showNav
                  ? 'translateY(0)'
                  : 'translateY(20px)',
                transition: 'all 2.5s cubic-bezier(0.16, 1, 0.3, 1)',
                transitionDelay: '1500ms',
              }}
            >
```

- [ ] **Step 2: Close the new wrapping `<div>`**

Still in `src/components/layout/Header.tsx`. Find the closing `</div>` that ends the Social `relative group` block (just before the `</nav>` for desktop, around line 228). Add another closing `</div>` for the new wrapper.

Old:
```tsx
                  Instagram
                </WaterText>
              </div>
            </div>
          </div>
        </nav>
```

New:
```tsx
                  Instagram
                </WaterText>
              </div>
            </div>
          </div>
          </div>
        </nav>
```

(Two closing `</div>` tags now — one for the original `relative group`, one for the new Social-block wrapper.)

- [ ] **Step 3: Verify**

`npm run dev`. The em-dash + Social still appear with the same spacing because the wrapper has matching `gap-6 lg:gap-8`. Hover Social — the submenu still appears.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(header): bundle em-dash and Social into ref wrapper"
```

---

### Task 6: Add the desktop hamburger button

**Files:**
- Modify: `src/components/layout/Header.tsx:228-251` (between desktop `</nav>` and mobile menu button)

- [ ] **Step 1: Insert the desktop burger button after `</nav>`**

Edit `src/components/layout/Header.tsx`. Locate the closing `</nav>` (around line 228) for the desktop nav, followed by `{/* Mobile Menu Button - 3D emergence effect */}`. Insert the desktop burger between them.

Old:
```tsx
          </div>
          </div>
        </nav>

        {/* Mobile Menu Button - 3D emergence effect */}
```

New:
```tsx
          </div>
          </div>
        </nav>

        {/* Desktop hamburger — appears as the nav items collapse on scroll. */}
        {!prefersReducedMotion && (
          <button
            ref={burgerRef}
            type="button"
            onClick={() => {}}
            aria-label="Toggle navigation"
            aria-controls="primary-nav"
            aria-expanded={false}
            className="hidden md:flex items-center justify-center w-10 h-10 absolute right-4 md:right-6 lg:right-10 top-1/2"
            style={{
              opacity: 0,
              transform: 'translateY(-50%) scale(0.7)',
              transformOrigin: 'center center',
              pointerEvents: 'none',
              color: textColor,
              transition: 'color 300ms ease',
              willChange: 'opacity, transform',
            }}
          >
            <Menu className="w-6 h-6" />
          </button>
        )}

        {/* Mobile Menu Button - 3D emergence effect */}
```

Note the burger is positioned absolutely so it can sit on top of the (faded-out) nav items at the right edge without disrupting the flex layout. The `top: 50%; transform: translateY(-50%)` centers it vertically; `right-4 md:right-6 lg:right-10` matches the existing header padding.

- [ ] **Step 2: Verify**

`npm run dev`. On desktop (`>= md` viewport), inspect DOM — the button exists at the right edge of the header but is invisible (opacity 0). Page layout is otherwise unchanged. Switch DevTools "Rendering → emulate prefers-reduced-motion: reduce" → reload — the button is **not** in the DOM.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(header): add desktop hamburger button (inactive)"
```

---

### Task 7: Add ease helpers and window constants at module scope

**Files:**
- Modify: `src/components/layout/Header.tsx:1-20` (after imports, before WaterText)

- [ ] **Step 1: Add constants and ease helpers after the imports**

Edit `src/components/layout/Header.tsx`. After the `gsap.registerPlugin(ScrollTrigger);` line added in Task 3 and before `const NAV_TRIGGER_LABELS = ...` (around line 19):

Old:
```ts
gsap.registerPlugin(ScrollTrigger);

// Labels that fire the loading overlay when clicked. Contact and Social
// are intentionally excluded.
const NAV_TRIGGER_LABELS = new Set(['Purpose', 'Notepad', 'Devotion']);
```

New:
```ts
gsap.registerPlugin(ScrollTrigger);

// Labels that fire the loading overlay when clicked. Contact and Social
// are intentionally excluded.
const NAV_TRIGGER_LABELS = new Set(['Purpose', 'Notepad', 'Devotion']);

// Nav-collapse: per-element fade windows in [0,1] progress space. Order
// matches the visual left→right reading order. Indexes 0..3 are the four
// navItems anchors (Purpose, Notepad, Devotion, Contact); index 4 is the
// Social-block wrapper (em-dash + Social dropdown).
const NAV_WINDOWS: readonly { start: number; end: number }[] = [
  { start: 0.150, end: 0.310 }, // Purpose
  { start: 0.210, end: 0.370 }, // Notepad
  { start: 0.270, end: 0.430 }, // Devotion
  { start: 0.330, end: 0.490 }, // Contact
  { start: 0.390, end: 0.520 }, // Social-block
] as const;
const BURGER_WINDOW = { start: 0.45, end: 0.55 } as const;
const ITEM_TRANSLATE_PX = 28;
const ITEM_BLUR_PX = 3;

// Stand-alone ease helpers — pure math, no GSAP dependency. Used by the
// hot-path applyDom function which runs every scroll frame.
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const easePower1Out = (n: number): number => 1 - (1 - n);
const easePower2Out = (n: number): number => 1 - (1 - n) * (1 - n);
const easePower3Out = (n: number): number => 1 - (1 - n) * (1 - n) * (1 - n);
```

(Note: `easePower1Out` simplifies to `n` but is kept explicit to mirror the spec naming.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(header): add ease helpers and nav-collapse windows"
```

---

### Task 8: Add the `applyDom` helper inside the Header component

**Files:**
- Modify: `src/components/layout/Header.tsx` (inside Header component, after the refs declared in Task 3)

- [ ] **Step 1: Add `applyDom` as a useCallback-free function declared inside the component**

Edit `src/components/layout/Header.tsx`. After the `const isHome = location.pathname === '/';` line (added in Task 3) and before the existing `const textColor = ...`:

Old:
```ts
  const isHome = location.pathname === '/';

  // Soft-translucent text — paired with the glass text-shadow in
  // .psalms-nav-link (index.css). Constant across scroll; only flips to
  // the light variant when the page itself declares a dark theme via the
  // darkText prop (e.g. detail pages with colored backgrounds).
  const textColor = darkText ? 'rgba(255, 255, 255, 0.72)' : 'rgba(0, 0, 0, 0.65)';
```

New:
```ts
  const isHome = location.pathname === '/';

  // Hot-path DOM applier. Reads the current progress and mutates inline
  // styles + aria attributes on each nav-item wrapper and on the burger.
  // Declared inside the component (closes over refs) but allocated once per
  // render — fine because the refs themselves are stable.
  const applyDom = (progress: number): void => {
    currentProgressRef.current = progress;
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const w = NAV_WINDOWS[i];
      const local = clamp01((progress - w.start) / (w.end - w.start));
      const x = ITEM_TRANSLATE_PX * easePower3Out(local);
      const op = 1 - easePower1Out(local);
      const blur = ITEM_BLUR_PX * easePower2Out(local);
      el.style.transform = `translateX(${x}px)`;
      el.style.opacity = String(op);
      el.style.filter = `blur(${blur}px)`;
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
      burgerEl.style.transform = `translateY(-50%) scale(${scale})`;
      burgerEl.style.pointerEvents = progress >= 0.5 ? 'auto' : 'none';
      burgerEl.setAttribute(
        'aria-expanded',
        stateRef.current === 'click-expanded' ? 'true' : 'false',
      );
    }
  };

  // Soft-translucent text — paired with the glass text-shadow in
  // .psalms-nav-link (index.css). Constant across scroll; only flips to
  // the light variant when the page itself declares a dark theme via the
  // darkText prop (e.g. detail pages with colored backgrounds).
  const textColor = darkText ? 'rgba(255, 255, 255, 0.72)' : 'rgba(0, 0, 0, 0.65)';
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(header): add applyDom helper for nav-collapse frames"
```

---

### Task 9: Subscribe to progress + create route-dependent fallback ScrollTrigger

**Files:**
- Modify: `src/components/layout/Header.tsx` (after existing isScrolled effect, around line 70)

- [ ] **Step 1: Add Effect 1 — subscribe + fallback ScrollTrigger**

Edit `src/components/layout/Header.tsx`. After the existing `useEffect` that handles `isScrolled` (around lines 63-70), insert the new effect:

Old:
```ts
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Prevent body scroll when mobile menu is open
```

New:
```ts
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Nav-collapse: subscribe to progress; on non-home routes, run our own
  // ScrollTrigger as the publisher. On home, Hero is the publisher.
  useLayoutEffect(() => {
    if (prefersReducedMotion) return;

    let fallbackTrigger: ScrollTrigger | undefined;
    if (!isHome) {
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
      // On the next mount the singleton's `current` will be whatever the
      // previous publisher last wrote — that's intentional, it prevents a
      // visual pop on route change.
    };
  }, [isHome, prefersReducedMotion]);

  // Prevent body scroll when mobile menu is open
```

- [ ] **Step 2: Verify on home**

`npm run dev`. Reload `/`. Wait for intro to finish. Slow-scroll. Expected: Purpose fades first, items follow rightward with stagger; by the wordmark's A-pulse beat, all items are gone and burger is mostly visible. Scroll back up — items return in reverse order.

- [ ] **Step 3: Verify on non-home**

Navigate to `/purpose/strength` (or any `/purpose/:id`). Slow-scroll from top — same stagger plays across roughly 40 → 360px of scroll. Items fade right, burger appears.

- [ ] **Step 4: Verify reduced-motion**

DevTools → Rendering → Emulate CSS media `prefers-reduced-motion: reduce`. Reload. Scroll on `/` — nav items stay full. Burger button is not rendered.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(header): wire nav-collapse to hero pin and scrollY fallback"
```

---

### Task 10: Wire the burger click — expand state machine

**Files:**
- Modify: `src/components/layout/Header.tsx` (replace the `onClick={() => {}}` placeholder from Task 6 + add Effect 2)

- [ ] **Step 1: Add the `handleBurgerClick` handler inside the component**

Edit `src/components/layout/Header.tsx`. After the `applyDom` helper from Task 8 and before `const textColor`:

Old:
```ts
    const burgerEl = burgerRef.current;
    if (burgerEl) {
      const local = clamp01((progress - BURGER_WINDOW.start) / (BURGER_WINDOW.end - BURGER_WINDOW.start));
      const op = easePower2Out(local);
      const scale = 0.7 + 0.3 * easePower2Out(local);
      burgerEl.style.opacity = String(op);
      burgerEl.style.transform = `translateY(-50%) scale(${scale})`;
      burgerEl.style.pointerEvents = progress >= 0.5 ? 'auto' : 'none';
      burgerEl.setAttribute(
        'aria-expanded',
        stateRef.current === 'click-expanded' ? 'true' : 'false',
      );
    }
  };

  // Soft-translucent text — paired with the glass text-shadow in
```

New:
```ts
    const burgerEl = burgerRef.current;
    if (burgerEl) {
      const local = clamp01((progress - BURGER_WINDOW.start) / (BURGER_WINDOW.end - BURGER_WINDOW.start));
      const op = easePower2Out(local);
      const scale = 0.7 + 0.3 * easePower2Out(local);
      burgerEl.style.opacity = String(op);
      burgerEl.style.transform = `translateY(-50%) scale(${scale})`;
      burgerEl.style.pointerEvents = progress >= 0.5 ? 'auto' : 'none';
      burgerEl.setAttribute(
        'aria-expanded',
        stateRef.current === 'click-expanded' ? 'true' : 'false',
      );
    }
  };

  // Tween between current progress and a target, using applyDom as the
  // per-frame setter. Kills any in-flight tween first so re-entry is safe.
  const tweenProgressTo = (target: number, duration: number, onComplete?: () => void): void => {
    activeTweenRef.current?.kill();
    const box = { progress: currentProgressRef.current };
    activeTweenRef.current = gsap.to(box, {
      progress: target,
      duration,
      ease: 'power2.out',
      onUpdate: () => applyDom(box.progress),
      onComplete: () => {
        activeTweenRef.current = null;
        onComplete?.();
      },
    });
  };

  // Burger click handler — entry point for click-expanded and the toggle
  // back. The first-scroll-input listener (attached in Effect 2 below) owns
  // the resync transition.
  const handleBurgerClick = (): void => {
    if (stateRef.current === 'click-expanded') {
      // Toggle back to collapsed without waiting for scroll.
      stateRef.current = 'resyncing';
      tweenProgressTo(getNavCollapseProgress(), 0.5, () => {
        stateRef.current = 'scrub';
      });
      return;
    }
    if (currentProgressRef.current < 0.5) return; // shouldn't happen — pointer-events gating
    stateRef.current = 'click-expanded';
    tweenProgressTo(0, 0.5);
  };

  // Soft-translucent text — paired with the glass text-shadow in
```

- [ ] **Step 2: Wire `handleBurgerClick` to the burger button's `onClick`**

Edit `src/components/layout/Header.tsx`. Locate the burger button added in Task 6.

Old:
```tsx
        {/* Desktop hamburger — appears as the nav items collapse on scroll. */}
        {!prefersReducedMotion && (
          <button
            ref={burgerRef}
            type="button"
            onClick={() => {}}
            aria-label="Toggle navigation"
```

New:
```tsx
        {/* Desktop hamburger — appears as the nav items collapse on scroll. */}
        {!prefersReducedMotion && (
          <button
            ref={burgerRef}
            type="button"
            onClick={handleBurgerClick}
            aria-label="Toggle navigation"
```

- [ ] **Step 3: Verify click-expand**

`npm run dev`. Reload `/`. Scroll down past the intro until items are fully collapsed and the burger is visible. Click the burger. Expected: items reverse-collapse back inline over ~500ms. The burger fades out as items reappear.

- [ ] **Step 4: Verify click-toggle (collapse without scroll)**

While in the click-expanded state from Step 3 (don't scroll yet), click the burger again. Expected: items collapse back, burger re-appears.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(header): wire burger click to expand/toggle state machine"
```

---

### Task 11: Resync on first scroll input after click-expand

**Files:**
- Modify: `src/components/layout/Header.tsx` (extend Effect 1, or add Effect 3 — we add Effect 3 to keep concerns separate)

- [ ] **Step 1: Add Effect 3 — scroll-input resync listener**

Edit `src/components/layout/Header.tsx`. After Effect 1 (the subscribe effect added in Task 9) and before the existing `useEffect` for `isMobileMenuOpen`:

Old:
```ts
    return () => {
      unsubscribe();
      fallbackTrigger?.kill();
      // On the next mount the singleton's `current` will be whatever the
      // previous publisher last wrote — that's intentional, it prevents a
      // visual pop on route change.
    };
  }, [isHome, prefersReducedMotion]);

  // Prevent body scroll when mobile menu is open
```

New:
```ts
    return () => {
      unsubscribe();
      fallbackTrigger?.kill();
      // On the next mount the singleton's `current` will be whatever the
      // previous publisher last wrote — that's intentional, it prevents a
      // visual pop on route change.
    };
  }, [isHome, prefersReducedMotion]);

  // Nav-collapse: while click-expanded, the first scroll input from the user
  // triggers a smooth resync to the publisher's current value, then yields
  // back to scrub. Listeners are attached once at mount and use the state
  // ref to gate their behavior, avoiding per-state listener add/remove churn.
  useLayoutEffect(() => {
    if (prefersReducedMotion) return;

    const RESYNC_KEYS = new Set([
      'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ',
    ]);

    const handleResyncTrigger = (): void => {
      if (stateRef.current !== 'click-expanded') return;
      stateRef.current = 'resyncing';
      const target = getNavCollapseProgress();
      tweenProgressTo(target, 0.4, () => {
        stateRef.current = 'scrub';
      });
    };

    const onWheel = (_e: WheelEvent) => handleResyncTrigger();
    const onTouchMove = (_e: TouchEvent) => handleResyncTrigger();
    const onKeyDown = (e: KeyboardEvent) => {
      if (RESYNC_KEYS.has(e.key)) handleResyncTrigger();
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [prefersReducedMotion]);

  // Prevent body scroll when mobile menu is open
```

- [ ] **Step 2: Verify resync via wheel**

`npm run dev`. Reload `/`. Scroll down, click the burger to expand inline, then scroll-wheel down one tick. Expected: items smoothly collapse back to whatever progress matches the current scroll position over ~400ms.

- [ ] **Step 3: Verify resync via keyboard**

Repeat: expand via click, then press `ArrowDown`. Same smooth re-collapse occurs.

- [ ] **Step 4: Verify resync via touch (mobile emulation)**

DevTools → Toggle device toolbar → use touch emulation. Note: desktop burger is `md:flex` so this won't appear on small phones. Use the "Tablet" or larger preset (≥ 768px). Scroll, click burger, drag finger up to scroll — same smooth resync occurs.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(header): smooth resync from click-expanded on first scroll"
```

---

### Task 12: Final cross-route + edge-case verification pass

**Files:**
- No code changes — verification only.

This task walks the Section 9 verification matrix from the spec and confirms each line.

- [ ] **Step 1: Scrub mapping on home**

`npm run dev`. Reload `/`. After intro, slow-scroll. Verify the per-item progress windows visually:
- At ~progress 0.20 (just past bloom), Purpose is mid-fade.
- At ~progress 0.30, Notepad starts fading, Purpose nearly gone.
- At ~progress 0.45, only Social-block remains visible, burger half-visible.
- At ~progress 0.55, items gone, burger fully visible.

In DevTools console:
```js
const m = await import('/src/lib/nav-collapse-progress.ts');
m.getNavCollapseProgress(); // matches scroll position
```

- [ ] **Step 2: Reverse direction**

Scroll all the way past the pin region, then scroll back up. Items reappear in reverse order (Social first, Purpose last).

- [ ] **Step 3: Route handoff `/` → `/purpose/:id` → `/`**

From `/`, scroll mid-pin (items partially collapsed). Click a nav item that takes you to `/purpose/<some-slug>`. The Header should preserve its state during route change (no pop). Scroll on the new page — fallback ScrollTrigger drives the same stagger. Navigate back to `/`. Hero pin resumes publishing.

- [ ] **Step 4: Click-expand on non-home route**

On `/purpose/<slug>`, scroll to collapse, click the burger to expand inline. Same behavior as home: items reappear, scroll re-collapses.

- [ ] **Step 5: Aria attributes inventory**

In DevTools console at fully-collapsed state:
```js
document.querySelectorAll('#primary-nav > *').forEach(el => console.log(el.getAttribute('aria-hidden')));
// → "true" for each item
document.querySelector('button[aria-controls="primary-nav"]').getAttribute('aria-expanded');
// → "false"
```

Click burger to expand:
```js
document.querySelector('button[aria-controls="primary-nav"]').getAttribute('aria-expanded');
// → "true"
```

- [ ] **Step 6: ScrollTrigger inventory after several route changes**

Navigate `/` → `/purpose/strength` → `/notepad` (where header isn't rendered, per [App.tsx:114](../../../src/App.tsx#L114)) → back → `/`. In console:
```js
ScrollTrigger.getAll().length;
```
Expected: a reasonable, stable number (Hero's pin + mask + collapse + the Header's fallback when not on home). Not growing unbounded.

- [ ] **Step 7: Mobile breakpoint sanity**

DevTools → device toolbar → iPhone 14 (390px width). Reload `/`. The desktop nav is hidden; mobile hamburger is visible at top-right; tapping it opens the existing full-screen overlay. None of the new desktop logic affects mobile.

- [ ] **Step 8: Reduced-motion sanity**

DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`. Reload. Verify:
- The desktop burger is **not** in the DOM (check `document.querySelector('button[aria-controls="primary-nav"]')` returns `null`).
- Nav items stay at full opacity at every scroll position.
- Scrolling does not affect their `style.opacity` or `style.transform`.

- [ ] **Step 9: Existing animations untouched**

Verify the existing hero intro plays normally; the wordmark scroll-collapse animates as before; the mask-expand and quote animations are unchanged; the mobile menu opens and closes as before.

---

### Task 13: Lint and build

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: no new errors. If there are pre-existing warnings unrelated to this feature, leave them.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: production build completes successfully.

- [ ] **Step 3: If anything failed, fix and re-run. Otherwise commit if any tweaks were needed**

```bash
git add -A  # only if lint/build needed touchups
git commit -m "chore(nav): lint/build cleanup for nav scroll-collapse"
```

(Skip the commit if no changes were necessary.)

---

## Spec Coverage Map

| Spec section | Implemented by |
|--------------|----------------|
| §1 Behavior overview / state machine | Task 9 (scrub), Task 10 (click-expand), Task 11 (resync) |
| §2.1 Source of progress (Hero publisher) | Task 2 |
| §2.1 Source of progress (non-home fallback) | Task 9 |
| §2.2 Per-element fade windows | Task 7 (constants), Task 8 (applyDom) |
| §2.3 Per-element ease | Task 7 + Task 8 |
| §2.4 Hamburger entrance | Task 8 (applyDom), Task 6 (DOM) |
| §2.5 Logo (unchanged) | No task — by omission |
| §2.6 Click-expand tween | Task 10 |
| §2.7 Resync tween | Task 11 |
| §3 Pub/sub module | Task 1 |
| §4 Component structure (Hero edit) | Task 2 |
| §4 Component structure (Header refs, wrappers, burger) | Tasks 3, 4, 5, 6 |
| §4 applyDom + utilities | Tasks 7, 8 |
| §4 Effect 1 (subscribe + fallback) | Task 9 |
| §4 Effect 2 (click handler + state machine) | Tasks 10, 11 |
| §5 Reduced-motion fallback | Tasks 6, 9, 11 (each gates on `prefersReducedMotion`) |
| §6 Edge cases | Verified in Task 12 |
| §7 Accessibility | Tasks 4, 6 (aria-controls / aria-label / aria-expanded), Task 8 (aria-hidden) |
| §8 Visual treatment | Tasks 6 (burger DOM), 7 (translate magnitude), 8 (transforms) |
| §9 Verification matrix | Task 12 |
