# Mobile Tile — Natural Aspect Sizing

**Date:** 2026-05-29
**Component:** `src/components/sections/MobileProjectTile.tsx`, `src/components/sections/MobileParallaxList.tsx`
**Scope:** Replace the mobile tile's `min-h-screen` (100vh) sizing with a 3:4 aspect-ratio frame so the photograph displays at its natural proportions, and add a medium gap between tiles so the section background shows as deliberate breathing room.

## Goal

Stop the tile from consuming the entire viewport. Use a 3:4 portrait aspect ratio so each photograph fills the tile cleanly at its natural shape, sitting at roughly 62% of an iPhone 12 viewport height. Tiles stack vertically with a clean 40px gap between them; the section's app-background reads as intentional negative space rather than tile padding.

## Why

The 100vh full-bleed layout shipped at `2886ee3` gave the photograph commanding presence but at the cost of demanding the entire viewport per tile. Eleven tiles × 100vh = 1100vh of scroll for a single section. Browser verification confirmed the layout works, but the real-estate cost is too high — the user wants the full-bleed editorial *feel* without the section dominating the entire scroll. A 3:4 aspect ratio frame keeps the photo edge-to-edge horizontally, preserves the bottom-corner text overlay, and reduces total section scroll by ~38%. The 40px gap between tiles lets the warm app-background read as deliberate breathing room instead of awkward void.

## Layout

### Tile root
- `<button>` element unchanged in structure.
- Classes change:
  - Remove: `min-h-screen`
  - Add: `aspect-[3/4]`
- Keep: `relative block w-full overflow-hidden text-left`.
- Resulting box: `width: 100%` (390px on iPhone 12) × `height: width × 4/3` (520px on iPhone 12). About 62% of viewport on most phones.

### Image wrap (`tile-image`)
- Unchanged: `position: absolute; inset: 0;` — fills the tile, which is now 3:4 instead of 100vh.
- Image `<img>` keeps `object-cover w-full h-full loading="lazy"`. Most project images are portrait orientations close to 3:4, so cropping is minimal; the few images that aren't exactly 3:4 get a slight crop centered on the image — acceptable.
- Scrim child unchanged: bottom 40% of the image, gradient from `rgba(40,30,20,0.55)` to transparent.

### Text overlay (`tile-text`)
- Unchanged. Still `position: absolute; bottom: 24px;` with `left: 24px` or `right: 24px` per `data-text-anchor`, z-10, text shadows, etc.
- The overlay sits at the bottom of the (now shorter) image tile.

### Gap between tiles
In `MobileParallaxList.tsx`:
- Current root: `<div className="flex flex-col w-full">`
- New root: `<div className="flex flex-col w-full gap-10">` (40px gap, Tailwind `gap-10`).

The section's `var(--app-bg)` background shows in the gap, framing each tile as a discrete photograph.

## Motion (unchanged)

All Framer Motion choreography stays as it is at HEAD (`2886ee3`):
- Trigger range `['start 50%', 'end 50%']`.
- Curtain wipe `inset(0 100% 0 0) → inset(0 0% 0 0)` over progress `[0, 0.85]`.
- Text drops in from `-60px` above, blur `14px → 0` over progress `[0.2, 0.95]`.
- One-way latch via `useMotionValue`.
- `prefers-reduced-motion` short-circuit.

Note on scrub feel: tile is now smaller (~62vh vs 100vh), so the trigger range traverses a shorter absolute scroll distance. The motion will feel slightly quicker. This is acceptable — the cinematic feel comes from the choreography itself, not just from how much scroll it consumes. If the new pace feels off after seeing it in browser, motion timing can be adjusted in a follow-up.

## Component / interaction contract

Entirely unchanged:
- `MobileProjectTileProps` (project, index, onProjectClick).
- Click handler fires `onProjectClick(project)`.
- `aria-label` combines eyebrow + title + scripture.
- `data-testid="mobile-project-tile"`, `data-tile-order`, `data-text-anchor`, `tile-image`, `tile-text`, `tile-title`, `tile-scripture` all unchanged.
- Eyebrow `aria-hidden="true"` still set.
- Image `alt={project.name}` still set.

## Desktop & section chrome

Entirely untouched. `useIsMobile` branching in `PurposeGrid` continues to route desktop viewports to `DesktopMosaic`, which is unchanged. `Devotions` watermark and `FilterTabs` still sit above the tile list and are unchanged.

## Tests

`src/components/sections/MobileProjectTile.test.tsx`:
- All 11 existing tests stay valid as-is. None of the tests assert tile dimensions or list-level gap.
- No new tests required (the layout change is dimensional, not behavioral).

`src/components/sections/MobileParallaxList.test.tsx`:
- All 3 existing tests stay valid as-is. None assert the list's className.
- No new tests required.

## Files touched

- **Modified**: `src/components/sections/MobileProjectTile.tsx` (one className change — `min-h-screen` → `aspect-[3/4]`).
- **Modified**: `src/components/sections/MobileParallaxList.tsx` (one className change — add `gap-10`).

## Risk

Negligible. Two className edits in two files. Motion, content, accessibility, click handler, alternation logic, and reduced-motion fallback all untouched. The only behavioral change is that the trigger range now traverses a smaller box, which shortens the motion's absolute scroll distance but preserves the choreography.

## Out of scope

- Per-image aspect ratio (each project would need an `aspectRatio` field on `Project` to use its true ratio — defer until the cropping at 3:4 turns out to be problematic for specific images).
- Motion timing adjustments to compensate for shorter trigger area (defer to a follow-up if the new pace feels wrong).
- Any change to desktop, section chrome, or `MobileProjectTile` behavior.
