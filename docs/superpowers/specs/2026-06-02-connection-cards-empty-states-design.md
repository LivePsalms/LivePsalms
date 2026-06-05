# Connection Cards — Empty States (Mobile)

**Date:** 2026-06-02
**Status:** Approved (design)
**Scope:** Mobile Connection Cards segment only. Desktop unchanged.

## Problem

On the mobile notepad, the Lamplight view has a segmented control:
"Today's Lamp" / "Connection Cards" (`LamplightMobileView`). When the user
selects **Connection Cards** but there are no cards to show, the segment
renders `ConnectionCardsStrip`, which returns `null` for every hook phase
except `ready`. The result is a blank screen with no explanation and no
guidance on how connection cards come to exist.

This spec adds contextual empty states to that segment so the user always
sees a calm, helpful message reflecting *why* there are no cards and, where
relevant, what helps the lamp find them.

## Goals

- Replace the blank Connection Cards segment with one of four contextual
  empty states, each mapped to a real hook phase.
- Keep the copy aligned with the Lamplight voice principle: gentle, never
  prescriptive — invitation, not instruction.
- Preserve all existing desktop behavior exactly.

## Non-Goals

- No Connection Cards view is added to the **desktop** Lamplight tab (that
  tab remains Today's-Lamp-only). Decided explicitly during brainstorming:
  "Mobile only for now."
- The desktop Content-tab inline strip keeps its deliberate self-hiding
  behavior ("no empty-state placeholders in the writing surface").
- No change to the signed-out fallback ("Sign in to see connections.").
- No change to thresholds, embedding logic, or the `why` explanation flow.

## Behavior

The mobile Connection Cards segment renders a contextual empty state for
every non-`ready` hook phase. Mapping:

| Hook phase | Empty state title | Family | Notes |
|---|---|---|---|
| `inactive` (`note_too_short` / `vault_too_small` / `no_active_note`) | "No connections lit yet" | You can help | Shows a 2-item checklist with live ✓ / · status |
| `waiting_for_embedding` | "The lamp is reading…" | Just wait | `aria-live="polite"` |
| `no_connections` | "Nothing echoes yet" | Just wait | — |
| `error` | "Couldn't reach the lamp" | Retry | "Try again" re-runs the hook |
| `ready` | (cards render — not an empty state) | — | Existing behavior |

### Copy (final)

**inactive**
- Title: "No connections lit yet."
- Body: "The lamp finds notes that quietly echo one another. A couple of
  things help it along:"
- Checklist (each item shows ✓ when satisfied, · when not yet):
  - "Write a note with some depth" — satisfied when `meetsDepth` is true
  - "Keep a few more notes in your vault" — satisfied when `meetsVault` is true

**waiting_for_embedding**
- Title: "The lamp is reading…"
- Body: "It's quietly taking in what you've written — connections will
  surface here in a moment."
- Container carries `role="status"` / `aria-live="polite"`.

**no_connections**
- Title: "Nothing echoes yet."
- Body: "This note stands on its own for now. As your vault grows, the lamp
  may find quiet threads between it and others."

**error**
- Title: "Couldn't reach the lamp."
- Body: "A brief hiccup — your notes are safe."
- Action: a "Try again" button that re-runs the hook.

## Architecture

Three pieces.

### 1. Hook enrichment — `useConnectionCards`

`src/notepad/hooks/useConnectionCards.ts`

Currently three distinct reasons collapse into a bare `{ phase: 'inactive' }`
via early returns:
- no active note (`!activeNote`)
- note below word threshold (`countWords < qualifyingMinWords`)
- vault below size threshold (`totalNoteCount < qualifyingMinVaultSize`)

Enrich the `inactive` variant so the checklist can reflect accurate per-item
status. Compute **both** booleans before deciding the phase (cheap; both
inputs are already in scope):

```ts
| {
    phase: 'inactive';
    reason: 'no_active_note' | 'note_too_short' | 'vault_too_small';
    meetsDepth: boolean;   // countWords(plaintext) >= qualifyingMinWords
    meetsVault: boolean;   // totalNoteCount >= qualifyingMinVaultSize
  }
```

- `no_active_note` → `meetsDepth = false`, `meetsVault = (totalNoteCount >= min)`.
- `note_too_short` → `meetsDepth = false`, `meetsVault` computed from count.
- `vault_too_small` → `meetsDepth = true`, `meetsVault = false`.

This is additive: every existing `state.phase === 'inactive'` check keeps
working; only new fields are added. Other phases are unchanged.

**Retry for the error state.** The hook today exposes `retryWhy` (for
re-running a single explanation) but no way to re-run the neighbor fetch
after a `network` error. The error empty state's "Try again" needs that.
Add a `retry: () => void` to `UseConnectionCardsResult` that bumps an
internal nonce included in the effect's dependency array, re-triggering
`run()`. `ConnectionCardsPanel` passes this through to
`ConnectionCardsEmpty` as `onRetry`.

### 2. `ConnectionCardsEmpty` (new, pure presentational)

`src/notepad/components/lamplight/ConnectionCardsEmpty.tsx`

- Props: the non-`ready` `ConnectionCardsState` plus an `onRetry: () => void`
  callback (used by the error state).
- Renders the correct title/body per phase, the checklist for `inactive`
  (driven by `meetsDepth` / `meetsVault`), and the "Try again" button for
  `error`.
- No data fetching, no hook calls — fully unit-testable in isolation.
- Styling matches the existing strip: CSS-variable palette (`--alabaster`,
  `--pale-stone`, `--silica`, `--deep-umber`), `Outfit` for UI text,
  `Cormorant Garamond` for the titles. Centered column, comfortable padding,
  consistent with the mobile segment's look.

### 3. Wiring — `ConnectionCardsPanel` (new container)

`src/notepad/components/lamplight/ConnectionCardsPanel.tsx`

Lift the hook call and the server-threshold fetch out of
`ConnectionCardsStrip` into this container so the state is owned in exactly
one place. The panel:

- Calls `useConnectionCards` (+ `getConnectionCardThresholds`) once.
- `phase === 'ready'` → renders the existing cards UI. The current strip
  body moves into the panel as-is (the ready-view stays inline in the panel;
  no separate `ConnectionCardsReadyView` component is introduced).
- Otherwise → renders `ConnectionCardsEmpty` **iff** `showEmptyStates` is
  `true`; else returns `null`.
- New prop: `showEmptyStates?: boolean` (default `false`).

`ConnectionCardsStrip` is refactored to a thin wrapper:
`<ConnectionCardsPanel {...props} showEmptyStates={false} />`. Its existing
call sites (desktop Content tab in `Notepad.tsx`) keep importing
`ConnectionCardsStrip` and behave identically — single hook instance, no
empty states in the writing surface.

`LamplightMobileView` connections branch switches from `ConnectionCardsStrip`
to `<ConnectionCardsPanel ... showEmptyStates />`. The signed-out fallback is
unchanged.

### Rejected alternatives

- **(B) Second hook instance for the empty decision** — a mobile wrapper runs
  its own `useConnectionCards` to decide empty-vs-strip. Causes double
  network/embedding checks, possible flicker, and two sources of truth.
- **(C) Inline empty JSX in `LamplightMobileView`** — same double-hook problem
  unless the strip is refactored anyway, with messier component boundaries.

Approach A (panel container) wins on single-source-of-truth and isolation.

## Accessibility

- `waiting_for_embedding` empty state uses `role="status"` /
  `aria-live="polite"` so screen readers announce the transient "reading"
  message.
- The "Try again" control is a real `<button>` with an accessible label.
- Checklist status (✓ / ·) is conveyed with text, not color alone.
- No animation is required; nothing to gate behind reduced-motion.

## Testing

- **`ConnectionCardsEmpty` unit tests:** correct title/body per phase; the
  `inactive` checklist renders ✓ / · per `meetsDepth` / `meetsVault`
  combinations; `error` renders a working "Try again" that invokes `onRetry`.
- **`useConnectionCards` tests:** add assertions that the `inactive` state now
  carries `reason`, `meetsDepth`, and `meetsVault` for each sub-case
  (no active note, note too short, vault too small). Existing phase-based
  assertions continue to pass. Add a test that `retry()` re-runs the fetch
  after an `error` phase (e.g. failing fetch then succeeding on retry).
- **`LamplightMobileView` test:** connections segment renders
  `ConnectionCardsEmpty` content when the hook is not `ready`, renders cards
  when `ready`, and still shows the sign-in line when signed out.

## Files

- `src/notepad/hooks/useConnectionCards.ts` — enrich `inactive` state.
- `src/notepad/components/lamplight/ConnectionCardsEmpty.tsx` — new.
- `src/notepad/components/lamplight/ConnectionCardsPanel.tsx` — new container.
- `src/notepad/components/lamplight/ConnectionCardsStrip.tsx` — refactor to
  wrap the panel with `showEmptyStates={false}`.
- `src/components/sections/notepad/mobile/LamplightMobileView.tsx` — use the
  panel with `showEmptyStates` in the connections segment.
- Test files alongside the above.
