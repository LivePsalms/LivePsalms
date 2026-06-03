# Connection Card — "Why" Reveal Affordance (Mobile)

**Date:** 2026-06-03
**Status:** Approved design, pending implementation

## Problem

On the mobile stacked Connection Cards (added 2026-06-03), tapping a card reveals
a "why these connect" reflection inline. Nothing on the card signals that this
reflection exists or that tapping reveals it — a user sees only the signals,
title, and "Open ↗", so the reveal is undiscoverable.

## Goal

Add a visible cue in the mobile (`stack`) card footer that tells the user the card
opens a reflection, and reflects expanded/collapsed state. Desktop (`strip`) is
unchanged.

Non-goals: changing data, the `useConnectionCards` hook, generation, or the inline
"why" rendering itself. No cue on the desktop strip.

## Design

In `stack` mode only, the card footer (currently just the right-aligned "Open ↗")
becomes a two-part row:

- **Left — reveal hint button:** reads **"Why these connect ⌄"** at rest and
  **"Hide ⌃"** when that card is expanded (the chevron flips). Muted silica tone,
  Outfit font, sized to sit quietly opposite Open. Tapping it toggles the "why"
  via the existing `handleChipClick(c.relatedNoteId)`.
- **Right — "Open ↗":** unchanged (stops propagation, calls `onOpenNote`).

The footer keeps its stack-mode top divider (`border-t`, `--pale-stone`).

### Interaction

- The title/signals area **stays tappable** as a toggle (existing behavior); the
  footer hint is the visible label for that same action. Whole card minus "Open"
  toggles the reveal.
- Tapping the hint and tapping the title do the same thing: `handleChipClick`.
- "Open ↗" remains a separate target.

### Accessibility

- The hint is a `<button>` with `aria-expanded={isActive}` and
  `aria-label={isActive ? `Hide why this connects to ${title}` : `Show why this connects to ${title}`}`.
- The existing title-area button keeps its current `aria-pressed` toggle and
  `aria-label`. (Two controls for one disclosure is acceptable; both stay in sync
  via `activeChipId`.)

### Wording (decided)

"Why these connect" (rest) / "Hide" (expanded). Chevron: `⌄` rest, rotated 180°
when expanded.

## Scope guardrails

- `strip` (desktop) footer unchanged — still only "Open ↗", no hint.
- Only the footer changes in `stack` mode; signals, title, and the inline why
  block are untouched.

## Testing

In `ConnectionCardsPanel.stack.test.tsx`:

- The hint button ("Why these connect") is present in `stack` mode at rest.
- Tapping the hint reveals the inline "why" (same assertion shape as the existing
  title-tap test).
- When expanded, the hint label switches to "Hide".
- The hint is **absent** in `strip` mode (guard via the existing
  `ConnectionCardsStrip.test.tsx`, or an explicit `layout="strip"` assertion).

## Files touched

- `src/notepad/components/lamplight/ConnectionCardsPanel.tsx` — restructure the
  stack-mode footer into a hint + Open row; add the hint button.
- `src/notepad/components/lamplight/ConnectionCardsPanel.stack.test.tsx` — add the
  affordance tests.
