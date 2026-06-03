# Mobile Connection Cards — Vertical Layout

**Date:** 2026-06-03
**Status:** Approved design, pending implementation

## Problem

On the notes page, the "Connection Cards" feature lays out cards as a horizontal
scroll strip: fixed-width (`220px`) cards in a `flex … overflow-x-auto` row. This
strip is shared by two surfaces:

- **Desktop:** `ConnectionCardsStrip` → inline strip in the writing surface.
- **Mobile:** the "Connection Cards" segment of `LamplightMobileView`.

On mobile the horizontal strip wastes the vertical space of a phone and forces
sideways scrolling to discover connections. We want the mobile tab to present
cards as a **vertical stack**. Desktop's inline strip stays exactly as-is.

## Goal

Mobile-only: the Connection Cards segment renders cards stacked vertically
(full-width cards, one per row), with the "why" reveal expanding **inline inside
the tapped card**. No change to desktop.

Non-goals: changing the data model, the `useConnectionCards` hook, threshold
fetching, empty states, or desktop behavior. No new "% close" / similarity badge
(considered in mockups, cut for scope).

## Approach

One shared component, one new layout prop — the call site that already knows it's
mobile declares the layout. No duplicate component, no viewport media queries.

### `ConnectionCardsPanel`

Add a prop:

```ts
layout?: 'strip' | 'stack'; // default 'strip'
```

Behavior by layout:

| Concern            | `strip` (default, unchanged)         | `stack` (new, mobile)                          |
| ------------------ | ------------------------------------ | ---------------------------------------------- |
| Cards container    | `flex gap-2 overflow-x-auto pb-1`    | `flex flex-col gap-2`                          |
| Card width         | `flex-none w-[220px]`                | `w-full`                                        |
| Card title         | `text-xs` Outfit                     | larger serif (Cormorant Garamond), with a footer hairline border above "Open ↗" |
| "Why" reveal       | top panel above all cards (current)  | inline, inside the active card (between title and the Open footer) |

The `strip` code path must remain byte-for-byte equivalent to today because
`'strip'` is the default and desktop passes nothing.

### Why-reveal extraction

Extract the why-state rendering (`loading` → "Lighting…", `shown` → italic serif
text via `prefixWhyWithName`, `error` → message + "Try again" calling `retryWhy`)
into a single small helper so both layouts share identical logic and only the
**placement** differs:

- `strip`: render the helper in the existing top `activeCard` panel; do **not**
  render it inline.
- `stack`: do **not** render the top panel; render the helper inside each active
  card.

### `LamplightMobileView`

Pass `layout="stack"` to `ConnectionCardsPanel`. The segment is already wrapped in
a vertical `overflow-y-auto` container, so stacked cards scroll vertically with no
extra work. The desktop `ConnectionCardsStrip` continues to pass no `layout`.

## Unchanged

Data shape (`ConnectionCard`), `useConnectionCards`, `getConnectionCardThresholds`
fetching, tap-to-expand toggle logic (`activeChipId`), `onOpenNote`, empty states
(`showEmptyStates` / `ConnectionCardsEmpty`), and all color tokens / fonts.

## Testing

- `ConnectionCardsPanel` tests: add a `layout="stack"` case asserting (a) the
  cards container is vertical (no `overflow-x-auto`; column flow) and (b) when a
  card is active the "why" text renders **inside** that card, not in a top panel.
  Keep existing `strip` assertions green (top panel present, horizontal container).
- `LamplightMobileView` test: confirm it renders `ConnectionCardsPanel` with
  `layout="stack"`.

## Files touched

- `src/notepad/components/lamplight/ConnectionCardsPanel.tsx` — add prop, branch
  container/card classes, extract + place the why renderer.
- `src/components/sections/notepad/mobile/LamplightMobileView.tsx` — pass
  `layout="stack"`.
- Tests alongside both.
