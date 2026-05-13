# Loading Overlay — Scoping to Nav-Bar-Only Triggers

**Date:** 2026-05-13
**Status:** Approved (design phase)
**Scope:** Activation rules for `HeroLoadingOverlay`
**Supersedes:** Activation portion of `2026-05-11-loading-overlay-design.md` (visuals unchanged)

---

## 1. Goal

Restrict when the loading overlay plays. Today it plays on every initial mount (any reload, any deep link) and on every SPA route change — including purpose-image clicks that already have a `SplitTransition`. The brand-heartbeat overlay is therefore over-exposed and redundant in places where another transition is already running.

New rule: **the overlay plays only when the user clicks a specific subset of header items.** Nothing else triggers it.

## 2. Current behavior (what changes)

`App.tsx` drives activation from two places:

1. `useLoadingOverlay({ initialActive: !homeIntroPlays && !prefersReducedMotion })` — fires the overlay on initial mount whenever the home intro isn't going to play. This means every reload of `/purpose/:id`, `/notepad`, `/login`, etc., and every reload of `/` after the session intro has already played, shows the overlay.
2. A `useEffect` on `location.pathname` (App.tsx:87–99) that calls `overlay.trigger()` on every pathname change after first mount. This fires regardless of who caused the navigation: nav-bar click, purpose-image click, browser back/forward, programmatic auth redirect.

Both behaviors are removed.

## 3. New behavior

### 3.1 Activation matrix

| Action | Today | After |
|---|---|---|
| First-ever home visit in session | Hero intro (no overlay) | Hero intro (no overlay) — unchanged |
| Reload `/` (intro already played this session) | Overlay | None — direct render |
| Reload `/purpose/:id` | Overlay | None — direct render |
| Reload `/notepad`, `/login`, `/profile`, `/welcome`, `/purpose` | Overlay | None — direct render |
| Click purpose card (Hero/PurposeGrid/PurposeGallery → `/purpose/:id`) | Overlay + SplitTransition | SplitTransition only |
| Back from purpose detail (`completeExit('/')`) | Overlay + SplitTransition exit | SplitTransition exit only |
| Header → Logo (`/`) | Overlay | Overlay, **only if `location.pathname !== '/'`** |
| Header → Purpose (`/purpose`) | Overlay | Overlay |
| Header → Notepad (`/notepad`) | Overlay | Overlay |
| Header → Devotion (`#devotion`) | None (anchor, no path change) | Overlay (new) |
| Header → Contact (`#contact`) | None | None |
| Header → Social/Instagram (external) | N/A | N/A |
| Mobile menu → Purpose / Notepad / Devotion | Overlay | Overlay |
| Mobile menu → Contact | None | None |
| Browser back/forward | Overlay | None |
| Auth redirects (login → home, etc.) | Overlay | None |
| Footer links (`#` placeholders) | None | None |

Reduced-motion (`prefers-reduced-motion: reduce`) continues to suppress the overlay in all cases.

### 3.2 Mechanism — explicit click-source trigger

Instead of inferring activation from URL state, the overlay is triggered by the click handler at each allowed entry point. This is the only way to honor item D ("Devotion") which doesn't change `location.pathname`, and it eliminates accidental triggers from back/forward and programmatic redirects.

**Allowed click sources:**

- Header logo (anchor wrapping `<img>`)
- Header desktop nav items where `label` is `Purpose`, `Notepad`, or `Devotion`
- Header mobile menu items with the same three labels

**Disallowed:** "Contact" and "Social/Instagram" entries pass through with no trigger. Purpose card clicks (which call `transition.beginNavigation`) are untouched.

### 3.3 Same-path suppression for the logo

The logo's `onClick` always calls `navigate('/')`. When the user is already on `/`, there's no route change, so firing the overlay would produce a "ghost" flash with no destination. The logo handler suppresses the trigger when `location.pathname === '/'`. All other nav items fire unconditionally (Devotion is intentionally a same-page anchor with overlay).

### 3.4 Reduced-motion handling

The trigger function passed to the header is wrapped: if `prefersReducedMotion` is true, it no-ops. This keeps the policy in one place (App.tsx) instead of forcing the Header to know about motion preferences.

## 4. Implementation outline

### 4.1 `App.tsx`

- `useLoadingOverlay` is constructed with `initialActive: false` always. The `!initialDecision.homeIntroPlays && !initialDecision.prefersReducedMotion` condition is removed.
- The `useEffect` block at App.tsx:87–99 (the pathname-watching trigger) is deleted, along with `previousPathnameRef`.
- A new memoized handler is created:
  ```
  const handleNavTrigger = useCallback(() => {
    if (initialDecision.prefersReducedMotion) return;
    overlay.trigger();
  }, [overlay, initialDecision.prefersReducedMotion]);
  ```
- The handler is passed to the single `<Header>` render in `App.tsx`. The prop is optional so Header remains usable without it.

Note: `Header` is not rendered on `/notepad`, `/login`, `/profile`, or `/welcome` (existing App.tsx logic at line 128). On those routes there is no entry point to click, so no overlay is possible from this surface — consistent with the rule.

### 4.2 `components/layout/Header.tsx`

- New optional prop `onNavTrigger?: () => void`.
- Logo `<a>` `onClick`: call `onNavTrigger?.()` **only if** `location.pathname !== '/'`, then `navigate('/')`. The component reads `useLocation()` for this check.
- Desktop nav `<WaterText as="a">` `onClick`: for items whose label is `Purpose`, `Notepad`, or `Devotion`, call `onNavTrigger?.()`. Then, if the href starts with `/`, preventDefault and `navigate(item.href)`; otherwise let the browser handle the anchor.
- Mobile menu `<a>` `onClick`: same rule as desktop — match on label, call `onNavTrigger?.()`, then route or fall through.
- The Social/Instagram link and the Contact item never call `onNavTrigger`.

### 4.3 `hooks/useLoadingOverlay.ts`

No changes. The hook already supports `trigger()` and is agnostic to caller.

### 4.4 `components/sections/HeroLoadingOverlay.tsx`

No changes. The visual lifecycle (invisible → active → dissolving) is unchanged.

## 5. Edge cases

- **Logo click on `/`:** Suppressed, see §3.3.
- **Devotion link with no `#devotion` target on the page:** Overlay still plays. The link's anchor behavior is whatever the browser does (likely a no-op scroll) — the overlay is decoupled from the anchor outcome by design.
- **Rapid double-click on a nav item:** `useLoadingOverlay`'s state machine already debounces re-entry; calling `trigger()` while active is a no-op for the visual.
- **Reduced motion + nav click:** No overlay. The route still navigates normally.
- **Deep link to `/purpose/:id` (no source page):** No overlay, no SplitTransition. The page just renders. Per agreement in §1.
- **Auth flows redirecting via `<Navigate>` or `navigate()` in effects:** No overlay, since they don't go through the Header click handlers.

## 6. Testing notes

Manual verification matrix (one pass per row):

1. Fresh session → land on `/` → hero intro plays, no overlay. ✓
2. Same session → reload `/` → no intro, no overlay, hero visible. ✓
3. Reload `/purpose/:id` (any project) → no overlay. ✓
4. Reload `/notepad` → no overlay. ✓
5. From `/`, click a purpose image → SplitTransition only, no overlay layered on top.
6. From `/`, click Header "Purpose" → overlay → lands on `/purpose`.
7. From `/`, click Header "Notepad" → overlay → lands on `/notepad`.
8. From `/`, click Header "Devotion" → overlay plays even though URL unchanged.
9. From `/`, click Header "Contact" → no overlay.
10. From `/purpose/:id` or `/purpose`, click logo → overlay → lands on `/`. (Header is not rendered on `/notepad`/`/login`/`/profile`/`/welcome`, so logo isn't reachable there.)
11. From `/`, click logo → no overlay (same path).
12. From `/purpose/:id`, browser back → SplitTransition exit only, no overlay.
13. Open mobile menu on `/`, tap "Purpose" → overlay → lands on `/purpose`, menu closed.
14. `prefers-reduced-motion: reduce` set, click any nav item → no overlay, navigation still works.

No new unit tests required. The existing `useLoadingOverlay` and `loading-state` tests still apply.

## 7. Out of scope

- Visual changes to the overlay (heartbeat, A glyph, particle dissolve, timing) — untouched.
- The home hero intro gating logic in `decideHeroIntro` — untouched.
- `SplitTransition` and `useRouteTransition` — untouched.
- Footer link behavior — they remain inert `#` anchors.
