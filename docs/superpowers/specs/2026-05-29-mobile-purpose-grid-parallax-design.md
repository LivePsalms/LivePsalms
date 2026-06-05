# Mobile PurposeGrid Parallax — Design

**Date:** 2026-05-29
**Component:** `src/components/sections/PurposeGrid.tsx`
**Scope:** Mobile-only revamp of the "Devotions" section (categories: Restoration / Serenity)

## Goal

Replace the mobile horizontal-strip + hover-overlay treatment of `PurposeGrid` with a vertical parallax-scroll list that pairs each project image with its devotion title and scripture reference. The text that today lives inside the on-image hover overlay moves to a column alongside the image, alternating sides per project. Desktop behavior is unchanged.

## Why

The current mobile view inherits the desktop interaction grammar — a horizontal snap strip with hover overlays that require pointer hover to reveal title and CTA. On touch devices the overlay never reveals at all (no hover), so the photographs read as decoration with no context. Mobile users see eleven near-anonymous tiles with no devotion titles, no scripture, and no obvious entry into the underlying content. The new layout makes the devotion title and scripture visible at rest, replaces hover-only context with always-on context, and gives the section a cinematic vertical-scroll cadence that matches the rest of the mobile home page.

## Scope boundary

- **In scope:** the mobile rendering of `PurposeGrid` below the `useIsMobile()` breakpoint (`window.innerWidth < 768`).
- **Out of scope:** desktop strip→grid Flip morph, desktop hover overlays, desktop editorial mosaic, filter logic (filter tabs continue to drive `filteredProjects` unchanged), devotion detail navigation, the devotions data shape itself.

## Layout

Each project renders as a full-width tile. The tile divides into two columns:

- **Text column** — ~45% width, vertically centered. Implementation: `flex-1`.
- **Image column** — ~55% width, aspect ratio `3 / 4` (portrait crop), `object-cover`. Implementation: `flex-[1.15]`.
- **Column order alternates per project** by tile index: even-indexed tiles render text-left/image-right; odd-indexed tiles render image-left/text-right. The alternation is based on the tile's position in the rendered `filteredProjects` array (recomputed on filter change), not on the project id, so the rhythm survives filtering.

Tile container:
- `min-height: 70vh` — pacing decision. At normal phone heights this leaves the next tile peeking into the viewport before the current tile finishes its reveal, producing the parallax overlap.
- Horizontal padding: `px-6` (24px outer, against the section background).
- Inter-column gap: `gap-6` (24px).
- Background: inherits the section's `var(--app-bg)`. No per-tile background fill.

Inter-tile spacing: none. The 70vh tile height is the spacing.

## Content (per tile)

Three lines, top to bottom in the text column:

1. **Eyebrow** — `categoryLabel[project.category]`, i.e. `RESTORATION` or `SERENITY`. Style: 10px, `letter-spacing: 0.3em`, uppercase, white at 60% opacity.
2. **Title** — `devotions[project.id]?.title` (e.g. `Beside Still Waters`). Style: Cormorant Garamond, italic, ~26px (`text-2xl` or `text-[26px]`), white at 100% opacity, `line-height: 1.05`.
3. **Scripture reference** — `devotions[project.id]?.scriptureRef` (e.g. `Psalm 23:2–3`). Style: 10px, `letter-spacing: 0.12em`, uppercase, white at 70% opacity.

There is **no "Start here" CTA** on mobile. The entire tile is tappable (see Interaction).

**Fallback when a devotion is missing for a project id:**
- Use `overlayLabelById[project.id] ?? categoryLabel[project.category]` as the title (rendered in the same Cormorant Garamond style as the devotion title).
- Hide the scripture line entirely.
- Eyebrow always renders.

(Today every project id has a devotion entry, so this branch is defensive.)

## Motion

Each tile has its own scroll-driven reveal, scrubbed against the tile's progress through the viewport.

- **Image reveal**
  - `clip-path: inset(0 0 100% 0)` at progress 0 (hidden, clipped from the bottom).
  - `clip-path: inset(0 0 0% 0)` at progress 0.6 (fully revealed; the photo unveils top-to-bottom as the user scrolls down).
  - `opacity: 0 → 1` over the same `[0, 0.6]` range.
- **Text reveal** — lags the image so the photograph unveils first:
  - `opacity: 0 → 1` over `[0.1, 0.7]`.
  - `translateY: 20px → 0` over `[0.1, 0.7]`.
  - `filter: blur(6px) → blur(0)` over `[0.1, 0.7]`.
- **Trigger range** — `scrollTrigger`/`useScroll` offset of `['start 85%', 'start 30%']` relative to the tile (i.e. the reveal begins when the tile's top edge is 85% down the viewport and completes when the top edge reaches 30% down).
- **Easing** — Framer Motion `useTransform` with a cubic-bezier ease applied via the `ease` option (e.g. `[0.22, 1, 0.36, 1]`, equivalent to `power2.out`). The whole section already mixes Framer Motion (the desktop hover overlay) and GSAP (the strip→grid morph); the mobile tile uses Framer Motion exclusively to keep one library in the new component.
- **No leave / re-hide animation.** Once a tile completes its reveal, it stays revealed as the user scrolls past. Scrolling back up does not reverse the animation — the tile remains in its final state. This avoids the strobe effect of repeated reveals during back-and-forth scrolling.
- **`prefers-reduced-motion: reduce`** — all reveal logic is skipped. The image renders at `clip-path: inset(0 0 0% 0)` and `opacity: 1`; the text renders at `opacity: 1`, no transform, no blur. The layout is otherwise identical.

## Interaction

- The entire tile is a single tappable target. Tap anywhere on the text column or the image fires `onProjectClick(project)`, opening the devotion detail (same handler used by the desktop `ProjectCard`).
- No hover state on mobile.
- The desktop `ProjectCard`'s hover-overlay panels, "Start here" CTA, and `pg-hover-overlay` motion divs are not rendered on mobile.

## Section chrome on mobile

- **`Devotions` watermark** — kept; current reveal animation kept.
- **`FilterTabs` (All / Restoration / Serenity)** — kept; sit above the vertical list. Filter changes update `filteredProjects` and the list re-renders. No Flip reflow on mobile (Flip is a desktop-only concern in this section). Tiles that re-enter the viewport after a filter change re-trigger their reveal from progress 0 (filter changes are infrequent and the re-reveal is part of the new state's entrance).
- **`PurposeGridDots`** — not rendered on mobile in the new layout. Vertical scroll position is its own indicator, and the dots were paired to the now-removed horizontal strip.

## Component architecture

Split `PurposeGrid.tsx` along the desktop/mobile boundary:

```
PurposeGrid (section, filter state, section-level reveals)
├─ FilterTabs                          (unchanged)
├─ DesktopMosaic                       (extracted from current grid/Flip logic)
└─ MobileParallaxList                  (new)
    └─ MobileProjectTile × N
        ├─ TextColumn  (eyebrow / title / scripture)
        └─ ImageColumn (img + scroll-driven clip-path/opacity)
```

- **Branching** — `useIsMobile()` hook (already in `src/hooks/use-mobile.ts`) decides which subtree mounts. Each branch pays only for its own effects (Flip, dots observer, hover state on desktop; per-tile `useScroll` on mobile).
- **`DesktopMosaic`** — receives `filteredProjects`, `onProjectClick`, plus the refs needed for the section-level grid reveal effect. All the existing `useLayoutEffect`s for the strip→grid morph and the filter-reflow Flip stay here.
- **`MobileParallaxList`** — receives `filteredProjects`, `onProjectClick`. Renders the tiles. No section-level animation logic of its own beyond the existing section fade.
- **`MobileProjectTile`** — owns its own `useScroll` / `useTransform` for the reveal. One local scroll target per tile; no shared timeline or central scrub state.
- **Section-level fades** (filter tabs reveal, watermark reveal, grid container reveal) — current behavior. On mobile the "grid container reveal" effect can either be skipped (the per-tile reveals subsume it) or kept; implementation keeps it gated by `useIsMobile()` so the mobile branch doesn't pay for that scrub.

## Files touched

- `src/components/sections/PurposeGrid.tsx` — render-split, extract `DesktopMosaic`, mount `MobileParallaxList`. The current top-level `PurposeGrid` keeps section ref, filter state, watermark/filter-tabs reveals; everything else moves.
- `src/components/sections/DesktopMosaic.tsx` — new file. Holds the extracted desktop grid (strip→grid morph, Flip filter reflow, `ProjectCard`, dots observer, `PurposeGridDots` mount).
- `src/components/sections/MobileParallaxList.tsx` — new file.
- `src/components/sections/MobileProjectTile.tsx` — new file.
- `src/components/sections/PurposeGridDots.tsx` — left in place; rendered only from `DesktopMosaic` going forward. (Today it only shows on mobile, so this is effectively a removal from mobile usage. Desktop never rendered it, so net result: it stops rendering. The file stays for now to allow a clean revert if the dot indicator is wanted back in some form. A follow-up can delete the file once the new mobile layout is validated.)
- `src/index.css` — minor utility additions if any tile-level styles can't be expressed in Tailwind classes. The reveal transforms live in component-level inline `style` driven by Framer Motion's `useTransform` (matching how the existing `ProjectCard` already uses Framer Motion).

## Tests

New / updated Vitest specs:

- **`MobileProjectTile.test.tsx`** (new)
  - Renders the eyebrow (`RESTORATION`) when category is `residential`, `SERENITY` when `hospitality`.
  - Renders the devotion title and scripture ref when the project id has a devotion entry.
  - Falls back to `overlayLabelById[project.id]` / `categoryLabel[project.category]` as the title and hides the scripture line when no devotion entry exists.
  - Tapping the tile fires `onProjectClick` with the project.
  - With `matchMedia('(prefers-reduced-motion: reduce)')` mocked to `true`, the rendered tile has no inline transform / clip-path / opacity (final state only).

- **`MobileParallaxList.test.tsx`** (new)
  - Renders one tile per project in the list.
  - Alternation: tile at index 0 has data attribute `data-tile-order="text-image"`, tile at index 1 has `data-tile-order="image-text"`, etc. (The data attribute is exposed for the test; the underlying mechanism is whichever Tailwind class flip the implementation uses.)

- **`PurposeGrid.test.tsx`** (extend if exists, create if not)
  - With `useIsMobile` mocked `true`, the rendered tree contains `MobileParallaxList` and does not contain `PurposeGridDots`.
  - With `useIsMobile` mocked `false`, the rendered tree contains `DesktopMosaic` and contains a strip-mode grid element.
  - Filter change updates `filteredProjects` and re-renders the corresponding branch.

Existing tests that touch `PurposeGrid` (if any) must continue to pass; the test for the mobile dots observer (if one exists) is replaced by the mobile branch test above.

## Accessibility

- The tile is a single `<button>` (or `<a>` if `onProjectClick` is replaced by a navigation in the future) so the tap target is keyboard-focusable and screen-reader-announceable.
- `aria-label` on the tile combines category + title + scripture: e.g. `Restoration of Peace — Beside Still Waters, Psalm 23:2–3`. This survives the visual styling and gives a screen-reader user the same content as the visual eyebrow/title/scripture.
- The image has `alt={project.name}` (current behavior).
- The eyebrow is decorative (also present in the `aria-label`); render it as `<span aria-hidden="true">` to avoid double-announcement.

## Out of scope (follow-ups, not in this design)

- Deleting `PurposeGridDots.tsx` once mobile validation completes.
- Any change to the desktop hover overlay vocabulary.
- Filter tab visual treatment on mobile (separate concern; current treatment carries forward).
- Devotion data restructure (the spec consumes `devotions[id]` as it exists today).
