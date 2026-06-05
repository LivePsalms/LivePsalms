# Mobile Lamplight Manual Start

**Date:** 2026-06-02
**Status:** Approved (design)

## Problem

On mobile, opening the "Today's Lamp" tab immediately fires the expensive
`generateDailyDevotion` call. There's no moment of intent, and a failed
generation (e.g. the "Couldn't reach Lamplight" error) is the first thing a
user sees with no opportunity to choose to start.

We want a calmer, deliberate entry **on mobile only**: when nothing has been
generated for today yet, show a brief intro of what Today's Lamp is plus a
**"Show Me Today's Lamp"** button. Generation only happens when the user taps
it. Desktop behavior is unchanged (still auto-generates).

## Scope

- **In scope:** mobile Today's Lamp tab manual-start gate.
- **Out of scope:** desktop behavior, Connection Cards tab, the sign-in /
  consent / opted-out / paywall gating chain (all preserved as-is), the
  generation pipeline itself.

## Key behaviors (decided)

1. **Skip the gate if already generated.** The cheap cached read
   (`getDailyDevotion`) still runs on tab entry for both desktop and mobile.
   If today's lamp already exists, it shows immediately with no button.
2. **Remember within session (for free).** Because a generated lamp is cached
   server-side, tapping the button and generating means re-entering the tab
   later finds the cached lamp and shows it directly. No extra client state is
   needed for this; it falls out of behavior #1. (Exception: if generation
   errors, nothing is cached, so a later re-entry shows the intro again — this
   is acceptable.)
3. **Mobile only.** Implemented via a prop, not a viewport check, so it is
   explicit and unit-testable. Desktop keeps auto-generating.

## Architecture

The gate sits exactly at the expensive `generateDailyDevotion` call inside the
`useTodaysLamp` hook. The sign-in → consent → opted-out → paywall chain in
`LamplightTabPanel` runs first, unchanged; the intro only appears once a user
would otherwise reach generation.

### 1. `useTodaysLamp` hook (`src/notepad/hooks/useTodaysLamp.ts`)

- Add arg: `autoGenerate?: boolean` (default `true`).
- Add state: `{ phase: 'idle' }` to `TodaysLampState`.
- Effect logic on each run:
  1. Reset to `loading` (step 0) and call `getDailyDevotion`.
  2. If a cached artifact exists → `ready`. (Identical for both modes.)
  3. If no cached artifact:
     - `autoGenerate === true` → call `generateDailyDevotion` (current desktop
       behavior).
     - `autoGenerate === false` → set state to `idle` (no generation call).
- Add `start()` to the result. It marks that an explicit start was requested
  and bumps the existing `generation` counter, reusing the same effect code
  path as `retry()`.
- Distinguishing "initial mount, no cache" from "user tapped start": use a ref,
  `startRequestedRef` (initialized `false`). `start()` sets it `true` before
  bumping `generation`. The cache-miss branch of the run generates when
  `autoGenerate === true || startRequestedRef.current === true`; otherwise it
  sets state to `idle`. This makes the rule a single explicit condition with no
  reliance on the counter's value.
- `retry()` is unchanged in signature; after an error the start was already
  requested (mobile) or `autoGenerate` is `true` (desktop), so retry correctly
  re-runs generation in both modes.

- `retry()` keeps working as today (used by the error state).

### 2. `TodaysLampCard` (`src/notepad/components/lamplight/TodaysLampCard.tsx`)

- Accept `autoGenerate?: boolean` prop; pass it to `useTodaysLamp`.
- When `state.phase === 'idle'`, render a new `TodaysLampIntro` component:
  brief "what this is" copy + a "Show Me Today's Lamp" button wired to
  `start()`. Personalized with the existing `firstName` prop.
- `loading` / `error` / `ready` rendering is unchanged.

### 3. `TodaysLampIntro` (new, small component)

- Lives alongside `TodaysLampCard` (e.g.
  `src/notepad/components/lamplight/TodaysLampIntro.tsx`).
- Props: `firstName: string | null`, `onStart: () => void`.
- Renders: candle glyph (consistent with existing surfaces), one-to-two
  sentence intro, and the primary button. Styled with the existing tokens
  (`--alabaster`, `--deep-umber`, `--silica`, Outfit / Cormorant Garamond).
- Voice: inviting, never prophetic (per the project's Lamplight voice
  principle). It describes what Today's Lamp does and offers it; it does not
  pronounce.

### 4. Copy (`src/notepad/lamplight/lamplight-copy.ts`)

Add a helper consistent with the existing personalized helpers:

```ts
export function todaysLampIntro(firstName: string | null): string {
  return firstName
    ? `${firstName}, Today's Lamp draws quietly from your recent notes — a piece of Scripture and a short reflection for where you are right now.`
    : `Today's Lamp draws quietly from your recent notes — a piece of Scripture and a short reflection for where you are right now.`;
}
```

Button label: **"Show Me Today's Lamp"** (constant in the intro component).

### 5. Wiring

- `LamplightTabPanel` (`src/notepad/components/lamplight/LamplightTabPanel.tsx`):
  add `autoGenerate?: boolean` prop (default `true`), thread to
  `TodaysLampCard`.
- `LamplightMobileView`
  (`src/components/sections/notepad/mobile/LamplightMobileView.tsx`): pass
  `autoGenerate={false}` to `LamplightTabPanel`.
- `Notepad.tsx` (desktop): no change — default `true`.

## Data flow

```
Enter Today's Lamp tab (mobile)
  → LamplightTabPanel: sign-in/consent/opted-out/paywall checks (unchanged)
  → TodaysLampCard (autoGenerate=false)
    → useTodaysLamp: getDailyDevotion (cheap read)
       ├─ cached found     → ready  → Devotion
       └─ cached miss      → idle   → TodaysLampIntro [Show Me Today's Lamp]
                                         → start() → loading → generate
                                            ├─ ok    → ready → Devotion (now cached)
                                            └─ error → TodaysLampError → retry()
```

## Error handling

- Generation failure after tapping the button → existing `TodaysLampError`
  surface with its retry, exactly as today. Nothing is cached, so a later tab
  re-entry returns to the intro (acceptable).
- Cached-read failure (network) → existing `error` phase with reason
  `network`, same as today.

## Testing

**`useTodaysLamp` (unit):**
- Cache hit → `ready` regardless of `autoGenerate` value; `generateDailyDevotion`
  not called.
- Cache miss + `autoGenerate: false` → `idle`; `generateDailyDevotion` not
  called.
- Cache miss + `autoGenerate: false`, then `start()` → `loading` → `ready`;
  `generateDailyDevotion` called exactly once.
- `start()` path that errors → `error`; subsequent `retry()` re-runs generation.
- Cache miss + `autoGenerate: true` (default/desktop) → generates immediately
  (regression guard).

**`TodaysLampCard` / mobile (component):**
- With `autoGenerate={false}` and a cache miss, the intro + "Show Me Today's
  Lamp" button render; no devotion is shown yet.
- Tapping the button triggers exactly one generation and then renders the
  devotion.
- `LamplightMobileView` passes `autoGenerate={false}` through (and desktop
  `Notepad`/`LamplightTabPanel` default remains `true`).

## YAGNI notes

- No viewport detection — mobile-only is expressed purely via the prop from the
  mobile view tree.
- No new client persistence for "remember within session" — server-side caching
  already provides it.
- No change to the generation pipeline, prompts, or adapters.
