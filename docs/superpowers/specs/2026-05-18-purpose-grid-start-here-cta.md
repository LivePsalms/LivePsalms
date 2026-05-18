# Purpose Grid — "Start Here" hover CTA

**Status:** Approved 2026-05-18
**Scope:** [src/components/sections/PurposeGrid.tsx](../../../src/components/sections/PurposeGrid.tsx)

## Goal

Add a `START HERE` label to the bottom-right corner of every project card's hover overlay, signaling that the card is the entry point to a devotion. Applies to all eleven cards (8 restoration + 3 serenity).

## Visual treatment

- **Text:** `START HERE` (uppercase, no arrow, no punctuation)
- **Classes:** `text-[10px] uppercase tracking-[0.2em] text-white/60` — identical to the existing centered category label, so the two read as the same voice
- **Position:** `absolute bottom-4 right-4` (16px inset from the bottom and right edges of the card)
- **Pointer events:** inherits `pointer-events-none` from the overlay wrapper so the whole card stays clickable

## Animation

Inherits the existing overlay fade-in by being rendered inside the same `motion.div`:

- `initial={{ opacity: 0, scale: 0.9 }}`
- `animate={{ opacity: 1, scale: 1 }}`
- `transition={{ duration: 0.3, delay: 0.15 }}`

No separate timeline, no stagger — appears in lockstep with the centered watermark + category label after the two split panels meet.

## Implementation sketch

Inside the existing `AnimatePresence`/`motion.div` at [PurposeGrid.tsx:104-126](../../../src/components/sections/PurposeGrid.tsx#L104-L126), add one additional `<span>` as a sibling of the centered content:

```tsx
<span className="absolute bottom-4 right-4 text-[10px] uppercase tracking-[0.2em] text-white/60">
  Start here
</span>
```

The wrapper already has `flex flex-col items-center justify-center` — the new span is positioned absolutely so it does not enter the flex flow and floats freely in the bottom-right corner.

## Out of scope

- Mobile rendering: the overlay is already `display: none` below the md breakpoint; this change does not affect mobile.
- Reduced-motion branch: not introduced — the existing overlay has none, and the new label inherits the same fade.
- Per-card variant text: every card uses the identical "Start Here" string.
- New design tokens: none — uses existing Tailwind utilities.

## Acceptance criteria

1. On md+ viewports, hovering any project card in the Purpose grid reveals the existing watermark + category label in the center AND a new "Start Here" label anchored bottom-right.
2. Both elements fade in together (same opacity + scale transition, same 0.15s delay).
3. Clicking anywhere on the card — including over the new label — still opens the project (pointer events pass through).
4. The label is absent on mobile and absent when the card is not hovered.
5. No regression in typecheck or in the existing strip→grid Flip morph.
