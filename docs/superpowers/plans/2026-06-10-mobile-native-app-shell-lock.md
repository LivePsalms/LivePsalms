# Mobile Native App-Shell Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LivePsalms feel like a locked native app on mobile — kill pinch-zoom and rubber-band site-wide, and weld the notepad/auth chrome in place by locking the document on app routes.

**Architecture:** Two tiers. (1) Global hardening in `index.html` + `src/index.css` (no pinch-zoom, `overscroll-behavior: none`). (2) A route-driven document lock: a `useAppShellLock` hook toggles an `app-shell-locked` class on `<html>` for app routes (`/notepad/notes`, `/notepad/u/:username`, `/login`, `/welcome`, `/profile`, `/update-password`); CSS pins `html`/`body` so there is no draggable surface under the `fixed` overlays, which stops the iOS drift. Plus the notepad shell is sized to `100dvh` and the Migration dialog is clamped to the mobile viewport.

**Tech Stack:** React 18 + react-router-dom, Vite, Tailwind, vitest + @testing-library/react. gsap 3.14 ScrollTrigger drives marketing scroll (must not be broken).

---

## File Structure

- `index.html` — viewport meta (add no-zoom).
- `src/index.css` — global `overscroll-behavior`, `.app-shell-locked` rules.
- `src/hooks/useAppShellLock.ts` (new) — the lock hook.
- `src/hooks/useAppShellLock.test.tsx` (new) — hook unit test.
- `src/App.tsx` — compute `isAppShell`, call the hook, add `isUpdatePasswordPage` flag.
- `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx` — `100dvh` shell sizing.
- `src/notepad/components/MigrationDialog.tsx` — clamp dialog width to viewport.

> **Note — already handled, do NOT redo:** The global `Header`/`MobileBottomDock` are already gated off notepad-editor + login/profile/welcome routes via `dockMounted` in `src/App.tsx:128`. `MobileTabBar` already pads `env(safe-area-inset-bottom)` (`MobileTabBar.tsx:33`). `MobileAuthModal` is already responsive (`px-4` + `w-full max-w-sm`). No work needed on these.

---

## Task 1: Global hardening (no pinch-zoom + no rubber-band)

**Files:**
- Modify: `index.html` (the `<meta name="viewport">` line)
- Modify: `src/index.css` (the `@layer base` html/body block, ~line 133–150)

- [ ] **Step 1: Disable pinch-zoom in the viewport meta**

In `index.html`, replace the viewport meta line:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

with:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
```

- [ ] **Step 2: Add `overscroll-behavior: none` to html and body**

In `src/index.css`, inside `@layer base`, the `html { ... }` block currently is:

```css
  html {
    scroll-behavior: smooth;
    position: relative;
  }
```

Change it to:

```css
  html {
    scroll-behavior: smooth;
    position: relative;
    overscroll-behavior: none;
  }
```

And the `body { ... }` block currently ends with `-webkit-font-smoothing: antialiased;`. Add `overscroll-behavior: none;` to it:

```css
  body {
    @apply bg-background text-foreground antialiased;
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--app-bg);
    color: var(--deep-umber);
    position: relative;
    overflow-x: hidden;
    overscroll-behavior: none;
    -webkit-font-smoothing: antialiased;
  }
```

- [ ] **Step 3: Build to verify no breakage**

Run: `npm run build`
Expected: `✓ built in …` with no new errors. (Chunk-size warnings are pre-existing and fine.)

- [ ] **Step 4: Commit**

```bash
git add index.html src/index.css
git commit -m "feat(mobile): disable pinch-zoom and rubber-band site-wide"
```

---

## Task 2: `useAppShellLock` hook + document-lock CSS + wiring

**Files:**
- Create: `src/hooks/useAppShellLock.ts`
- Test: `src/hooks/useAppShellLock.test.tsx`
- Modify: `src/index.css` (append `.app-shell-locked` rules)
- Modify: `src/App.tsx` (add `isUpdatePasswordPage`, compute `isAppShell`, call hook)

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useAppShellLock.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppShellLock } from './useAppShellLock';

const LOCK_CLASS = 'app-shell-locked';

afterEach(() => {
  document.documentElement.classList.remove(LOCK_CLASS);
});

describe('useAppShellLock', () => {
  it('adds the lock class when locked is true', () => {
    renderHook(() => useAppShellLock(true));
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(true);
  });

  it('does not add the class when locked is false', () => {
    renderHook(() => useAppShellLock(false));
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(false);
  });

  it('removes the class on unmount', () => {
    const { unmount } = renderHook(() => useAppShellLock(true));
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(false);
  });

  it('removes the class when locked flips to false', () => {
    const { rerender } = renderHook(({ locked }) => useAppShellLock(locked), {
      initialProps: { locked: true },
    });
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(true);
    rerender({ locked: false });
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/hooks/useAppShellLock.test.tsx`
Expected: FAIL — cannot resolve `./useAppShellLock` (module does not exist yet).

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useAppShellLock.ts`:

```ts
import { useEffect } from 'react';

const LOCK_CLASS = 'app-shell-locked';

/**
 * Locks the document into an app-shell state on app routes. When `locked` is
 * true, adds the `app-shell-locked` class to <html>; CSS then pins html/body
 * (`position: fixed; overflow: hidden`) so there is no scrollable/draggable
 * surface beneath the route's `fixed` overlay. On iOS this stops the toolbar /
 * tab bar from drifting during rubber-band scroll or pinch.
 *
 * Driven by a single central call in App.tsx keyed on the current route, so it
 * needs no ref-counting: one consumer owns the class.
 */
export function useAppShellLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const html = document.documentElement;
    html.classList.add(LOCK_CLASS);
    return () => {
      html.classList.remove(LOCK_CLASS);
    };
  }, [locked]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hooks/useAppShellLock.test.tsx`
Expected: PASS (4 passing).

- [ ] **Step 5: Add the document-lock CSS**

Append to the end of `src/index.css`:

```css
/* App-shell lock: on app routes (notepad/auth) the document is pinned so the
   fixed overlay has no draggable surface underneath it. This is what stops the
   iOS chrome-drift during rubber-band scroll / pinch. Toggled by
   useAppShellLock via the .app-shell-locked class on <html>. */
html.app-shell-locked,
html.app-shell-locked body {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}
```

- [ ] **Step 6: Wire the hook into App.tsx**

In `src/App.tsx`, the route flags are computed around lines 114–128. After the existing `isWelcomePage` line (line 123), add:

```tsx
  const isUpdatePasswordPage = location.pathname === '/update-password';
  const isAppShell =
    isNotepadEditor ||
    isLoginPage ||
    isProfilePage ||
    isWelcomePage ||
    isUpdatePasswordPage;
```

Then call the hook. Add the import near the other hook imports at the top of the file:

```tsx
import { useAppShellLock } from '@/hooks/useAppShellLock';
```

And inside the `App` component body, after `isAppShell` is computed, call:

```tsx
  useAppShellLock(isAppShell);
```

- [ ] **Step 7: Build + full test run to verify no breakage**

Run: `npm run build && npx vitest run src/hooks/useAppShellLock.test.tsx`
Expected: build succeeds; hook tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useAppShellLock.ts src/hooks/useAppShellLock.test.tsx src/index.css src/App.tsx
git commit -m "feat(mobile): lock document on app routes to stop iOS chrome drift"
```

---

## Task 3: Size the notepad mobile shell to the visual viewport (100dvh)

**Files:**
- Modify: `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx:126`

- [ ] **Step 1: Change the shell root to use 100dvh**

In `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`, the return root (line 126) is currently:

```tsx
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--plaster)' }}>
```

Change it to size by the dynamic viewport (tracks the iOS toolbar) instead of `inset-0` (= the large `100vh`):

```tsx
    <div
      className="fixed inset-x-0 top-0 flex flex-col"
      style={{ height: '100dvh', background: 'var(--plaster)' }}
    >
```

- [ ] **Step 2: Build to verify no breakage**

Run: `npm run build`
Expected: `✓ built`.

- [ ] **Step 3: Verify in mobile emulation (manual)**

Start preview: `npx vite preview --port 4321` (run in background), then with Chrome DevTools MCP: emulate `390x844x3,mobile,touch`, navigate to `http://localhost:4321/notepad/notes`, and confirm the tab bar sits at the bottom with the notes list filling the height (no overlap, no cutoff). Kill the preview on port 4321 when done.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx
git commit -m "feat(mobile): size notepad shell to 100dvh"
```

---

## Task 4: Clamp the Migration dialog to the mobile viewport

**Files:**
- Modify: `src/notepad/components/MigrationDialog.tsx:74`

This is the "Import Local Notes?" dialog that clipped off the right edge in mobile screenshots. `max-w-sm` (24rem) does not guarantee fit with the dialog's centered transform on the narrowest phones; clamp to the viewport width with a horizontal margin.

- [ ] **Step 1: Clamp the DialogContent width**

In `src/notepad/components/MigrationDialog.tsx`, the `DialogContent` (line 74) is currently:

```tsx
      <DialogContent
        className="max-w-sm p-8"
```

Change the className so width never exceeds the viewport minus a 1rem gutter each side, while keeping the `sm` cap on larger screens:

```tsx
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-sm p-8"
```

- [ ] **Step 2: Build to verify no breakage**

Run: `npm run build`
Expected: `✓ built`.

- [ ] **Step 3: Commit**

```bash
git add src/notepad/components/MigrationDialog.tsx
git commit -m "fix(mobile): clamp migration dialog to viewport width"
```

---

## Task 5: Final verification & deploy

**Files:** none (verification only)

- [ ] **Step 1: Confirm no NEW lint/tsc errors vs the known red baseline**

Run: `npm run build`
Expected: succeeds (tsc + vite). The repo's known baseline has pre-existing failures in unrelated files (force-sphere test, Editor.toolbar-placement, garden-scene). Acceptance: no NEW errors attributable to the files in this plan.

- [ ] **Step 2: Run the touched test files**

Run: `npx vitest run src/hooks/useAppShellLock.test.tsx`
Expected: PASS.

- [ ] **Step 3: Manual mobile QA on a real device (after deploy)**

After merging/deploying, on a real iPhone confirm:
1. Notepad: rubber-band/overscroll and pinch no longer slide the toolbar/tab bar off-center; no taupe shows around the shell.
2. Marketing pages (`/`, `/notepad`, `/purpose`) still scroll and animate normally.
3. The "Import Local Notes?" dialog fits within the screen.

- [ ] **Step 4: Push to deploy**

```bash
git push origin main
```

(Vercel auto-deploys `main`.)

---

## Self-Review notes

- **Spec coverage:** Tier 1 global hardening → Task 1. Tier 2 lock (hook + CSS + routes) → Task 2. Tier 2b dvh sizing → Task 3. Tier 3 dialog fit → Task 4. Duplicate-chrome item dropped (already handled by `dockMounted`; documented in File Structure note). Verification/baseline → Task 5.
- **Type consistency:** `useAppShellLock(locked: boolean)` signature and `app-shell-locked` class name are identical across hook, test, CSS, and App.tsx wiring.
- **Routes:** lock applies to `/notepad/notes`, `/notepad/u/:username`, `/login`, `/welcome`, `/profile`, `/update-password`; excludes `/notepad` (marketing landing) — consistent with the spec.
