# Mobile Native App-Shell Lock — Design

**Date:** 2026-06-10
**Status:** Approved (design); pending implementation plan
**Scope:** Make LivePsalms feel like a locked native app on mobile, site-wide,
with the heaviest treatment on the actual application screens (notepad + auth).

## Problem

On a real iPhone, the app reads as a webpage, not a native app. The reported
symptoms:

- The notepad's chrome (toolbar, tab bar) and the whole `fixed inset-0`
  workspace **drift off-center** when you rubber-band/overscroll or pinch —
  "it's built within a wrapper that can move off and it's not stuck like an
  application." Around the displaced shell the taupe `<body>` (`--app-bg
  #988F80`) shows.
- Some app modals overflow the right edge on mobile (the "Import Local Notes?"
  dialog's confirm button is cut off).

### Root cause

iOS Safari pins `position: fixed` elements to the **layout** viewport, not the
**visual** viewport. The app screens (`/notepad/*`, auth) are `fixed inset-0`
overlays floating on top of a **scrolling document** (`<html>` is the scroller;
no `overscroll-behavior` is set, so rubber-band is fully active). During
overscroll/pinch the visual viewport diverges from the layout viewport and the
"fixed" chrome appears to slide, revealing the body behind it. A native app
can't do this because there is no draggable document underneath.

This is **not** a responsive-width problem. The mobile notepad layout already
exists and is full-width (`MobileNotepadWorkspace`, `MobileTabBar`,
`MobileNotesView`, etc.). The fix is to remove the draggable surface and weld
the shell to the visual viewport.

## Decisions (from brainstorming)

- **Scope:** entire site should feel native. Realized as two tiers — cheap
  global hardening everywhere + a full document lock on app screens. Marketing
  pages must keep vertical scroll (their animations are GSAP ScrollTrigger
  driven off window scroll; gsap 3.14, no Lenis).
- **Pinch-zoom:** disabled site-wide (`maximum-scale=1, user-scalable=no`).
  Accepted accessibility tradeoff in exchange for the locked feel.
- **Approach:** A — two-tier (global hardening + route-aware body-lock). Not B
  (global single-scroller rewrite — too risky for the marketing animations),
  not C (CSS-only — `overscroll-behavior` alone doesn't reliably stop fixed
  drift on iOS).

## Design

### Tier 1 — Global hardening (all routes)

1. **Viewport meta** (`index.html`):
   `width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1, user-scalable=no`
   — disables pinch-zoom site-wide. (`viewport-fit=cover` already shipped.)
2. **Overscroll** (`src/index.css`): add `overscroll-behavior: none` to
   `html, body`. Kills rubber-band chaining everywhere. Marketing pages keep
   normal vertical content scroll and their ScrollTrigger animations.

### Tier 2 — App-shell lock (app routes only)

App routes: `/notepad/notes`, `/notepad/u/:username`, `/login`, `/welcome`,
`/profile`, `/update-password`. **Not** `/notepad` (marketing landing — scrolls).

- New hook **`useAppShellLock()`** (`src/hooks/useAppShellLock.ts`):
  - On mount: add class `app-shell-locked` to `<html>`.
  - On unmount: remove it. Idempotent / ref-counted so overlapping app screens
    (e.g. an auth modal opened over the notepad) don't unlock prematurely.
- CSS (`src/index.css`):
  ```css
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
  With the document non-scrollable and overscroll off, iOS has no surface to
  rubber-band → fixed chrome stays welded.
- The hook is consumed by the app screens (notepad workspace + auth pages) so
  the lock tracks route presence, not a global flag.

### Tier 2b — Shell sizing to the visual viewport

- App shells move from `fixed inset-0` (= `100vh` = iOS *large* viewport, which
  cuts the bottom under the toolbar) to a shell sized with **`100dvh`** plus
  `env(safe-area-inset-*)` padding (valid now that `viewport-fit=cover` ships).
- Internal scroll stays where it already is (`flex-1 overflow-y-auto` for the
  notes list and editor body).
- `useKeyboardInset` (VisualViewport-based, already present) keeps handling the
  on-screen keyboard. No change.

### Tier 3 — Bundled mobile fit-ups (in scope)

1. **Dialog overflow:** constrain app-route modals (Import/Migration dialog,
   `MobileAuthModal`, and the migration confirm) to the mobile viewport —
   `max-width: calc(100vw - 2rem)` and stack action buttons vertically on
   narrow widths so no control is clipped.
2. **Duplicate fixed chrome:** the global `Header` / `MobileBottomDock` render
   *under* the full-screen notepad on `/notepad/*`. Gate them off on notepad
   routes — removes dead duplicate fixed elements beneath the lock. (Auth pages
   unchanged.)

## Out of scope

- Rewiring marketing scroll into a custom scroller (Approach B).
- Restructuring the desktop notepad (already a fixed app; unaffected).
- Any change to the marketing scroll animations themselves.
- A full responsive redesign of marketing pages — they already have dedicated
  mobile components.

## Constraints & verification

- **Desktop (≥768px) unaffected:** the desktop notepad is already a fixed app;
  no-zoom + overscroll-none are harmless there.
- **Tests:** add a unit test for `useAppShellLock` (adds class on mount, removes
  on unmount, ref-counts nested locks). Keep the existing mobile `*.test.tsx`
  suite green.
- **Known red baseline:** the repo ships with pre-existing lint/tsc/test
  failures. Acceptance = **zero new** errors introduced, not a globally green
  repo.
- **Manual QA:** mobile emulation on the live preview + real-device check that
  the chrome no longer drifts on overscroll/pinch and no dialog clips.

## Affected files (anticipated)

- `index.html` — viewport meta.
- `src/index.css` — `overscroll-behavior`, `.app-shell-locked` rules.
- `src/hooks/useAppShellLock.ts` (new) + test.
- `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx` — consume
  lock, `100dvh` sizing.
- Auth pages (`LoginPage`, `WelcomePage`, `ProfilePage`, `UpdatePasswordPage`) —
  consume lock.
- `src/App.tsx` — gate global `Header`/`MobileBottomDock` off notepad routes.
- Dialog components (Import/Migration, `MobileAuthModal`) — mobile width fit.
