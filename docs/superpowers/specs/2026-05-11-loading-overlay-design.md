# PSALMS Loading Overlay — Design

**Date:** 2026-05-11
**Status:** Approved (design phase)
**Scope:** All routes — universal loading-state animation

---

## 1. Goal

Add a short, branded loading animation that plays during SPA navigations and hard reloads on any non-home route, with the existing home intro (`/` fresh load) preserved as the once-per-session brand moment. The two animations are visually consistent but distinct in purpose.

## 2. Source material

Reuses visuals from the home intro (`Hero.tsx`):

- Dark canvas radial gradient (`#0e0c10 → #08070a → #050507` over `#0a0a0c`)
- Glow-aura (cream `rgba(246, 244, 240)` series, `mix-blend-mode: screen`, `filter: blur(14px)`)
- Heartbeat lub-dub pattern (same GSAP keyframes as the home intro at t=2.10 and t=2.85)
- The A glyph path from `PsalmsWordmarkSvg.tsx`
- Crossfade-out (`opacity 1 → 0` over 1.2s, `power2.inOut`)

## 3. Architecture

### 3.1 Component model

A new `<HeroLoadingOverlay>` component rendered at the App level (sibling to `<Routes>` in `App.tsx`). Full-viewport `position: fixed`, z-index above `Header` (which is `z-50`). Renders:

- Dark canvas (radial gradient, same as home intro)
- Centered A glyph SVG (cream `#f6f4f0`)
- Glow-aura behind the A
- Heartbeat loop on the A + aura, repeating until the overlay deactivates
- Crossfade-out when `active` flips to false

The overlay component is purely presentational — it doesn't decide when to activate/deactivate. That decision lives in `useLoadingOverlay`.

### 3.2 State machine: `useLoadingOverlay`

A small hook that owns the overlay's lifecycle:

```ts
const { active, trigger } = useLoadingOverlay({
  minMs: 1500,
  initialActive: boolean,
});
```

- `active`: current overlay visibility state.
- `trigger()`: imperatively show the overlay (used on location changes). Each call resets the deactivate timer to `minMs` from now.
- The state machine schedules `setActive(false)` `minMs` after activation. Re-triggering during activation extends the timer.
- On mount: if `initialActive` is true, schedules the deactivate timer immediately.

The hook wraps a pure-ish state machine (`createLoadingState`) that's testable with vitest fake timers.

### 3.3 App.tsx integration

App.tsx computes the initial decisions once at first render:

- `gate = decideHeroIntro(...)` — same as today
- `isInitiallyOnHome = window.location.pathname === '/'`
- `homeIntroPlays = isInitiallyOnHome && gate.playIntro`
- `overlayInitiallyActive = !homeIntroPlays && !prefersReducedMotion`

Initial `introActive` becomes `homeIntroPlays` (not just `gate.playIntro`). This means if a user lands on `/notepad` first, even with no session flag, the home intro doesn't play when they later navigate to `/` — the loading overlay covers that navigation instead.

App.tsx subscribes to `useLocation()` and calls `triggerOverlay()` on every location change (skipping the initial mount, since `initialActive` handles that).

### 3.4 Hero.tsx coordination

`Hero.tsx`'s intro timeline already runs only when `introActive=true`. No changes required to Hero's internals — the gating happens in App.tsx via the initial state computation.

### 3.5 Pointer events

The overlay is `pointer-events: auto` while `active=true` (blocks clicks during loading to prevent rapid double-navigation). The crossfade-out element retains pointer events until `opacity` reaches 0.

## 4. Lifecycle rules

| Scenario | Animation |
|---|---|
| Fresh session, initial route `/`, gate `playIntro: true` | Full home intro plays. **No overlay.** |
| Fresh session, initial route `/`, gate skips (reduced motion or flag set) | **No overlay**, **no intro**. Hero renders in final state. |
| Fresh session, initial route ≠ `/`, no reduced motion | **Overlay plays** (1.5s min), then destination renders. |
| Fresh session, initial route ≠ `/`, reduced motion | **No overlay**. Destination renders instantly. |
| SPA navigation between any routes (back/forward included) | **Overlay plays** (1.5s min), then destination renders. |
| Reduced motion + SPA navigation | **No overlay**. |
| Hard reload of `/` | Treated as a fresh-session mount: home intro plays only if gate says so AND `/` is the initial route. Otherwise overlay. |
| Hard reload of `/notepad` etc. | Overlay plays. |

The home intro **never** plays on SPA navigation to `/` — only on initial mount with `/` as the landing route.

## 5. Visual specifications

### Overlay layout

```
┌──────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← Dark canvas (full viewport)
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░⚫░░░░░░░░░░░░░░░░░░░░░ │  ← Glow aura (mix-blend-mode: screen)
│ ░░░░░░░░░░░░░░ A ░░░░░░░░░░░░░░░░░░░ │  ← Centered A glyph, cream
│ ░░░░░░░░░░░░░░⚫░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────────────┘
```

### A glyph sizing

Centered, width ~12vw (clamped to 80–160px). Smaller than the home intro's wordmark — it's just an icon-scale brand mark, not a hero element.

### Heartbeat loop

Same lub-dub keyframes as home intro:
- Lub: A scales `1 → 1.022 → 1` over 0.5s (0.18 + 0.32). Glow blooms `0.18 → 0.42 → 0.18`.
- Gap: 0.25s.
- Dub: A scales `1 → 1.042 → 1` over 0.72s. Glow blooms `0.18 → 0.78 → 0.18`.
- Rest: 0.5s.
- Cycle total: ~1.95s. Loops infinitely (`repeat: -1`) until deactivation.

### Crossfade-out

`opacity 1 → 0` over 1.2s `power2.inOut` on the entire overlay div, then unmount (or set `display: none` and keep mounted for fast re-trigger).

### Z-index

`zIndex: 100` on the overlay root. Sits above `Header` (z=50) and `OrganicBackdrop`.

## 6. Accessibility

- `prefers-reduced-motion: reduce` → overlay does not activate. SPA navigation falls through to whatever the destination renders, unchanged from current behavior.
- The overlay element has `role="status"` and `aria-live="polite"` with an off-screen "Loading" text label, so screen readers announce the loading state.
- `aria-busy="true"` on the overlay container during active state.

## 7. Pre-hydration handling

The overlay can only render after React hydrates. For hard reloads, the user briefly sees the browser's default (plaster page background) for ~200ms before the overlay appears.

**This is acceptable as v1.** If we want pixel-perfect coverage on hard reload, a follow-up can add a static inline `<div>` in `index.html` matching the overlay's t=0 state (dark canvas + centered A) and remove it from the DOM once React mounts. Out of scope for this design.

## 8. File-level changes

**New files:**

- `src/components/sections/HeroLoadingOverlay.tsx` — overlay component with dark canvas + A glyph + glow + heartbeat GSAP timeline.
- `src/hooks/useLoadingOverlay.ts` — React hook that owns `active` state and the deactivate-timer logic. Exposes `{ active, trigger }`.
- `src/hooks/loading-state.ts` — pure state machine factory `createLoadingState({ minMs, initialActive, onChange, setTimeoutFn, clearTimeoutFn })` that the hook wraps. Testable with vitest fake timers.
- `src/hooks/loading-state.test.ts` — unit tests for `createLoadingState`.

**Modified files:**

- `src/App.tsx` — compute `homeIntroPlays`, gate initial `introActive` on it, set up `useLoadingOverlay` with the right initial state, subscribe to `useLocation` for navigation triggers, render `<HeroLoadingOverlay>` at root.
- `src/components/sections/Hero.tsx` — no changes (Hero already keys off `introActive` prop; App.tsx controls when that's true).

## 9. Verification plan

**Automated (vitest):**

- `loading-state.test.ts` covers:
  - Initial `active` matches `initialActive`.
  - Deactivates after `minMs` if `initialActive=true`.
  - `trigger()` sets `active=true` and schedules deactivate.
  - Re-triggering before deactivate extends the timer.
  - `cleanup()` cancels the timer.

**Manual (chrome-devtools MCP / browser):**

- Land on `/` fresh: home intro plays, no overlay.
- Land on `/notepad` fresh: overlay plays for ~1.5s.
- Navigate `/notepad → /`: overlay plays, no home intro afterward.
- Navigate `/ → /purpose`: overlay plays.
- Reload `/`: home intro plays if it's a fresh session, otherwise overlay.
- Reload `/notepad`: overlay plays.
- Reduced motion on: no overlay anywhere.

## 10. Non-goals and risks

**Non-goals:**

- No skip button on the loading overlay.
- No different visuals per route (e.g., colored variants).
- No pre-hydration static fallback in `index.html` (deferred follow-up).
- No measurement of actual route-mount time. The 1.5s minimum is fixed; we don't try to detect "destination ready" and dissolve early.

**Risks:**

- **Hash-only navigation** (`/#contact`): React Router may not trigger a location change. Overlay won't fire. Acceptable — that's a same-page anchor jump, not a "loading" event.
- **External link clicks** (e.g., social media in Header): browser handles navigation, overlay can't help. Acceptable.
- **Pointer-event blocking** during overlay: if a user clicks rapidly during a 1.5s overlay, subsequent clicks queue or drop depending on browser. We block all events to be safe.
