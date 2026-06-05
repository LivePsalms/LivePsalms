# Loading Overlay Scoping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict `HeroLoadingOverlay` activation to clicks on header items (Logo, Purpose, Notepad, Devotion) and their mobile equivalents. Remove all other activation paths.

**Architecture:** Replace the URL-driven activation (initial-mount flag + `location.pathname` effect) with explicit click-source triggers wired into `Header`. A new `onNavTrigger` prop on `Header` is called from the click handlers of the four allowed entry points; everything else (purpose-card clicks, browser back/forward, auth redirects, reloads) no longer fires the overlay.

**Tech Stack:** React, react-router-dom (`useLocation`, `useNavigate`), existing `useLoadingOverlay` hook (unchanged).

**Spec:** `docs/superpowers/specs/2026-05-13-loading-overlay-scoping-design.md`

---

## File Structure

- `src/components/layout/Header.tsx` — modify: add `onNavTrigger` prop, import `useLocation`, wire trigger to logo (same-path-suppressed) + desktop nav items (label-filtered) + mobile menu items (label-filtered).
- `src/App.tsx` — modify: set `useLoadingOverlay({ initialActive: false })`, delete the pathname-watching `useEffect` and `previousPathnameRef`, add `handleNavTrigger` callback (reduced-motion-aware), pass it to `<Header>`.

No new files. No test files (per spec §6 — manual verification only; the existing `loading-state.test.ts` tests still apply unchanged).

---

## Task 1: Header — add `onNavTrigger` prop and wire all four entry points

This change is purely additive at the call-site level — `App.tsx` doesn't pass `onNavTrigger` yet, so it's a no-op until Task 2. Header remains backward-compatible.

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add `useLocation` import**

Replace the existing react-router-dom import line in `src/components/layout/Header.tsx` (line 2):

```tsx
import { useNavigate, useLocation } from 'react-router-dom';
```

- [ ] **Step 2: Extend `HeaderProps` with the new optional prop**

Replace the `HeaderProps` interface block at lines 34-37:

```tsx
interface HeaderProps {
  showNav?: boolean;
  darkText?: boolean;
  /**
   * Called when the user clicks one of the trigger nav entries
   * (Logo, Purpose, Notepad, Devotion — and their mobile equivalents).
   * The logo suppresses this on same-path clicks; other entries fire
   * unconditionally. Optional so the component remains usable without it.
   */
  onNavTrigger?: () => void;
}
```

- [ ] **Step 3: Destructure the new prop and add `useLocation()`**

Replace the function signature and the first `useNavigate` line (lines 39-40):

```tsx
export function Header({ showNav = true, darkText = false, onNavTrigger }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
```

- [ ] **Step 4: Add a labels constant near the top of the component body**

Insert immediately after `const location = useLocation();` (still inside the function body, before `const [isScrolled...`):

```tsx
  // Labels that fire the loading overlay when clicked. Contact and Social
  // are intentionally excluded.
  const NAV_TRIGGER_LABELS = new Set(['Purpose', 'Notepad', 'Devotion']);
```

- [ ] **Step 5: Wire the logo with same-path suppression**

Replace the logo `<a>`'s `onClick` (currently at lines 80-83):

```tsx
          onClick={(e) => {
            e.preventDefault();
            if (location.pathname !== '/') {
              onNavTrigger?.();
            }
            navigate('/');
          }}
```

- [ ] **Step 6: Wire desktop nav items with label filter**

Replace the desktop `<WaterText as="a">` `onClick` (currently at lines 133-138) inside the `navItems.map`:

```tsx
              onClick={(e: React.MouseEvent) => {
                if (NAV_TRIGGER_LABELS.has(item.label)) {
                  onNavTrigger?.();
                }
                if (item.href.startsWith('/')) {
                  e.preventDefault();
                  navigate(item.href);
                }
              }}
```

- [ ] **Step 7: Wire mobile menu items with label filter**

Replace the mobile menu `<a>`'s `onClick` (currently at lines 244-250) inside the `navItems.map` in the mobile overlay:

```tsx
              onClick={(e) => {
                if (NAV_TRIGGER_LABELS.has(item.label)) {
                  onNavTrigger?.();
                }
                if (item.href.startsWith('/')) {
                  e.preventDefault();
                  navigate(item.href);
                }
                setIsMobileMenuOpen(false);
              }}
```

Leave the hardcoded mobile "Social" link at lines 266-279 untouched — it does not call `onNavTrigger` and never should.

- [ ] **Step 8: Typecheck and lint**

Run:
```
npm run build
npm run lint
```

Expected: both pass with no new errors. (The build runs `tsc -b` which fails on type errors.)

- [ ] **Step 9: Run existing test suite to confirm nothing regressed**

Run:
```
npm test
```

Expected: all tests pass. (No tests reference Header directly for this behavior, but `loading-state.test.ts` and others should remain green.)

- [ ] **Step 10: Commit**

```
git add src/components/layout/Header.tsx
git commit -m "feat(header): add onNavTrigger prop wired to logo and nav items"
```

---

## Task 2: App.tsx — swap to explicit nav-triggered activation

This is the behavior swap. After this commit, the overlay only fires from the four allowed click sources.

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Set `initialActive` to `false`**

Replace the `useLoadingOverlay` call (currently at lines 67-70):

```tsx
  const overlay = useLoadingOverlay({
    minMs: 1500,
    initialActive: false,
  });
```

- [ ] **Step 2: Delete the pathname-watching effect and its ref**

Delete this entire block (currently lines 82-99 in `src/App.tsx`):

```tsx
  // Trigger the overlay on every SPA location change after the initial mount.
  // The initial mount's overlay state is handled by useLoadingOverlay's
  // initialActive parameter. `overlay.trigger` is a fresh closure each render
  // (it reads from a ref), so we intentionally omit it from the deps to avoid
  // running this effect on every render — pathname is the only real signal.
  const previousPathnameRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialDecision.prefersReducedMotion) return;
    if (previousPathnameRef.current === null) {
      previousPathnameRef.current = location.pathname;
      return;
    }
    if (previousPathnameRef.current !== location.pathname) {
      overlay.trigger();
      previousPathnameRef.current = location.pathname;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, initialDecision.prefersReducedMotion]);
```

- [ ] **Step 3: Add the reduced-motion-aware nav trigger**

Immediately after the `overlay` declaration (i.e., after the `useLoadingOverlay({...})` block from Step 1), add:

```tsx
  const handleNavTrigger = useCallback(() => {
    if (initialDecision.prefersReducedMotion) return;
    overlay.trigger();
  }, [overlay, initialDecision.prefersReducedMotion]);
```

- [ ] **Step 4: Pass the trigger to `<Header>`**

Replace the Header render line (currently line 128):

```tsx
          {!isNotepadPage && !isLoginPage && !isProfilePage && !isWelcomePage && <Header darkText={isDetailPage} showNav={headerVisible} onNavTrigger={handleNavTrigger} />}
```

- [ ] **Step 5: Remove now-unused imports**

After Step 2, `useEffect` and `useRef` are no longer used anywhere in `src/App.tsx` (verified — they appear only inside the deleted block).

Replace the React import line (currently line 1):

```tsx
import { useCallback, useMemo, useState } from 'react';
```

Verify with:
```
grep -n "useEffect\|useRef" src/App.tsx
```

Expected: no matches.

- [ ] **Step 6: Typecheck and lint**

Run:
```
npm run build
npm run lint
```

Expected: both pass with no new errors. If the lint or tsc complains about unused `useEffect` or `useRef`, Step 5 wasn't done correctly — fix and re-run.

- [ ] **Step 7: Run existing test suite**

Run:
```
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```
git add src/App.tsx
git commit -m "feat(app): scope loading overlay to nav-bar clicks only"
```

---

## Task 3: Manual verification

Run the dev server and walk through the matrix. No code changes — this is a verification gate before declaring the work done.

- [ ] **Step 1: Start dev server**

Run:
```
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`).

- [ ] **Step 2: Clear sessionStorage and reload**

In DevTools console:
```
sessionStorage.clear(); location.reload();
```

Expected: hero intro plays once, no separate loading overlay.

- [ ] **Step 3: Reload `/` (same session, intro already played)**

Reload the page.
Expected: no intro, no overlay, hero visible immediately.

- [ ] **Step 4: Reload `/purpose/:id`**

Navigate to any project detail page, then reload.
Expected: no overlay. Page renders directly.

- [ ] **Step 5: Reload `/notepad`**

Navigate to `/notepad`, reload.
Expected: no overlay.

- [ ] **Step 6: Click a purpose card from `/`**

From the home page, click a purpose image in the grid.
Expected: `SplitTransition` plays (color expansion + reveal). No dark overlay layered on top.

- [ ] **Step 7: Header → Purpose**

From `/`, click the "Purpose" nav link.
Expected: overlay plays, lands on `/purpose`.

- [ ] **Step 8: Header → Notepad**

From `/`, click the "Notepad" nav link.
Expected: overlay plays, lands on `/notepad`.

- [ ] **Step 9: Header → Devotion**

From `/`, click the "Devotion" nav link.
Expected: overlay plays. URL gains `#devotion` (or stays put if the anchor target doesn't exist — that's fine; the overlay is independent of the anchor outcome).

- [ ] **Step 10: Header → Contact**

From `/`, click the "Contact" nav link.
Expected: no overlay.

- [ ] **Step 11: Logo click from `/purpose`**

Navigate to `/purpose`, then click the logo.
Expected: overlay plays, lands on `/`.

- [ ] **Step 12: Logo click while on `/`**

On `/`, click the logo.
Expected: no overlay (same-path suppression).

- [ ] **Step 13: Browser back from `/purpose/:id`**

Navigate to a purpose detail, then press the browser back button.
Expected: `SplitTransition` exit only, no dark overlay.

- [ ] **Step 14: Mobile menu — Purpose**

Resize the window to a mobile width (e.g., 400px wide) or open DevTools device mode. Open the mobile menu, tap "Purpose".
Expected: overlay plays, lands on `/purpose`, menu closes.

- [ ] **Step 15: Reduced motion**

In DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce". Click "Purpose" in header.
Expected: no overlay. Navigation still works.

- [ ] **Step 16: Confirm no console errors**

DevTools console should be free of new errors or warnings introduced by these changes during all the above steps.

- [ ] **Step 17: Stop dev server**

Press Ctrl+C in the terminal running `npm run dev`.

If any matrix row fails, return to the relevant task and fix before declaring complete. No commit on this task — verification only.

---

## Notes for the implementer

- **Where the overlay component lives:** `src/components/sections/HeroLoadingOverlay.tsx`. Untouched. It already handles its own three-phase visual lifecycle (`invisible → active → dissolving`).
- **What `overlay.trigger()` does:** Calls the state machine in `src/hooks/loading-state.ts`, which sets `active=true`, schedules a `setActive(false)` after `minMs` (1500), and debounces re-entry. Calling it while active is a no-op for the visual.
- **`navItems` source:** `src/data/projects.ts` line 118 — `[{ label: 'Purpose', href: '/purpose' }, { label: 'Notepad', href: '/notepad' }, { label: 'Devotion', href: '#devotion' }, { label: 'Contact', href: '#contact' }]`. The `NAV_TRIGGER_LABELS` set explicitly omits `Contact`.
- **Why label-matching, not href-matching:** `#devotion` and `#contact` both start with `#`, so href patterns can't distinguish them. Labels are the stable, semantic key.
- **Header is not rendered everywhere:** `App.tsx:128` hides Header on `/notepad`, `/login`, `/profile`, `/welcome`. On those routes there's no nav-bar entry to click — consistent with the spec.
