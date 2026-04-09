# Restoration Strip → Grid Scroll Morph — Design

**Date:** 2026-04-08
**Scope:** `ProjectsGrid` section only
**Status:** Approved for implementation

## Goal

When the user scrolls the `ProjectsGrid` section into view, the horizontal
image strip (current state) fluidly collapses into an editorial grid using
the row pattern **3 / 4 / 3 / 4 …** — applied regardless of which filter is
active. The morph is scroll-linked (progress tied to scroll position) and
reversible. Clicking a filter after the morph re-flows the grid in place.

## Row Layout

### Row-count algorithm

Strict 3/4/3/4 pattern; the final row truncates to whatever items remain:

```
rowCounts(n):
  rows = []
  remaining = n
  i = 0
  while remaining > 0:
    expected = (i % 2 == 0) ? 3 : 4
    take = min(expected, remaining)
    rows.push(take)
    remaining -= take
    i += 1
```

Concrete results with current data:

| Filter | Count | Rows |
|---|---|---|
| `all` | 18 | 3, 4, 3, 4, 3, **1** |
| `residential` | 9 | 3, 4, 2 |
| `retail` | 6 | 3, 3 |
| `hospitality` | 3 | 3 |

### Lone-last-item special case

When the last row contains a single item (the `all` = 18 case), that item
gets **full-bleed** styling — it spans the full row width rather than
sitting stranded in a 3- or 4-column cell. Reads as intentional editorial
punctuation.

### CSS grid structure

Target layout is a **12-column CSS grid** (LCM of 3 and 4):

- Row with 3 items → each item `grid-column: span 4`
- Row with 4 items → each item `grid-column: span 3`
- Row with 2 items (partial) → each item `grid-column: span 6`
- Row with 1 item (full-bleed) → item `grid-column: span 12`

Row heights keep the existing `heightCycle` varied-height pattern so the
top edge keeps breathing.

## Scroll Mechanics (Option C — scrub without pin)

1. Items render in the current flex-wrap strip layout (unchanged initial
   paint).
2. On section mount:
   - Capture `Flip.getState(items)` — strip positions.
   - Swap container from `strip-layout` → `grid-layout` (applies 12-col
     grid + per-item span classes).
   - Call `Flip.from(state, { duration: 1, ease: 'none' })` → returns a
     paused GSAP timeline representing the strip→grid morph.
3. Attach the timeline to a ScrollTrigger:
   ```
   trigger: section
   start:   'top 80%'
   end:     'top 30%'
   scrub:   1             // 1s smoothing for fluid feel
   animation: tl
   invalidateOnRefresh: true
   ```
   - Scroll progress 0 → strip
   - Scroll progress 1 → grid

## Interaction Cases

### Filter reflow (grid → grid)

Existing Flip-on-filter code continues to handle grid → grid reflow. One
addition: before capturing the filter Flip state, **force-complete** the
strip→grid scrub timeline (`tl.progress(1)`) if it's mid-flight, so Flip
measures a stable grid state.

### Scroll back up past section

- Existing `onLeaveBack` already resets the filter to `'all'`.
- **New:** also reset the scrub timeline to `progress(0)` so the strip
  re-materializes for the next scroll-down entry. Without this, scrolling
  back down would show a pre-collapsed grid.

### Reduced motion

Respect `prefers-reduced-motion: reduce`:
- Skip the morph timeline entirely.
- Apply `grid-layout` class immediately on mount.
- Skip the scroll-back strip-restore.

### Resize

`invalidateOnRefresh: true` on the ScrollTrigger so Flip re-measures
positions on resize. The scrub timeline is rebuilt on refresh.

## Files Touched

- [src/components/sections/ProjectsGrid.tsx](../../../src/components/sections/ProjectsGrid.tsx)
  - New `rowCounts(n)` helper (pure function, local to file).
  - New `getSpanClass(rowIndex, rowLength, itemIndexInRow)` helper
    returning one of `md:col-span-12 | md:col-span-6 | md:col-span-4 | md:col-span-3`.
  - New effect: strip→grid scrub morph (Flip + ScrollTrigger).
  - Extend existing `onLeaveBack` to also call `tl.progress(0)`.
  - Filter-change handler: force-complete scrub `tl` before capturing
    Flip state.
  - Reduced-motion branch: skip scrub, land in grid.
  - Container classes: conditional between strip (initial) and grid
    (final) via a state flag or direct classList manipulation.

No CSS file changes anticipated — Tailwind arbitrary values cover it.

## Preserved Behavior

- Height cycle per item
- Scroll-reveal fade-in of items
- Hover scale
- Click → project detail
- FilterTabs (Restoration / Renewal / Serenity) — unchanged
- Mobile horizontal-scroll strip — unchanged (`md:`-prefixed only)

## Risks / Open Questions

- **Flip timeline + scrub compatibility**: Flip.from returns a standard
  GSAP timeline, which ScrollTrigger's `animation` param accepts. Verified
  pattern in GSAP docs.
- **Image loading race**: Flip measures positions at capture time. If
  images haven't loaded, heights may be 0. Mitigation: the height cycle
  uses fixed Tailwind height classes (`h-[24rem]` etc.), so cell heights
  don't depend on image load. Safe.
- **Filter mid-morph**: handled by `tl.progress(1)` force-complete.
- **Double-mount in React strict mode**: use `gsap.context()` + cleanup,
  matching the pattern of existing effects in this file.
