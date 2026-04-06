# Seamless Layout Redesign — Psalms App

## Goal

Convert the Psalms app from a stacked-section layout into a seamless, borderless, free-flowing composition. Eliminate hard horizontal dividers, distinct background bands, and rigid grid boxes. Everything shares one continuous plaster background; elements flow into each other organically with subtle radial washes acting as the only "transitions."

## Approach

**Intensity:** Medium — break the existing grid and let sections bleed into each other, while preserving the four conceptual sections (Hero, PinnedImageSection, GalleryStrip, ProjectsGrid) and their core animations.

**Decoration:** Subtle radial gradient washes only (no visible blob shapes).

**Projects layout:** Editorial mosaic (varying-size cards on a 12-column grid, full-bleed, asymmetric).

## Foundation Changes

### Unified background
- Move `background: var(--plaster)` to the single page-level wrapper in [src/App.tsx](src/App.tsx) (the existing `WaterRipple` container already has `bg-mersi-beige`; replace with plaster).
- Remove the per-section `background: var(--plaster)` declarations from:
  - [src/components/sections/Hero.tsx](src/components/sections/Hero.tsx#L11)
  - [src/components/sections/PinnedImageSection.tsx](src/components/sections/PinnedImageSection.tsx#L66)
  - [src/components/sections/GalleryStrip.tsx](src/components/sections/GalleryStrip.tsx#L33)
  - [src/components/sections/ProjectsGrid.tsx](src/components/sections/ProjectsGrid.tsx#L27)

### New `OrganicBackdrop` component
- New file: `src/components/ui-custom/OrganicBackdrop.tsx`.
- Renders 2–3 absolutely positioned radial-gradient washes at fixed page positions (e.g., ~95vh, ~180vh, ~280vh) with very low opacity (`rgba(255,255,255,0.06–0.10)` whites and `rgba(188,179,163,0.06–0.10)` warm sands).
- Mounted once at the root of `App.tsx`, behind all content (`z-index: 0`, content sits at `z-index: 1`).
- The first wash absorbs the role of the existing Hero "mist glow" — that block (lines 33–69 in Hero.tsx) gets deleted from Hero and recreated as the first entry in `OrganicBackdrop`.
- `pointer-events: none` on all washes.

### Section height enforcement
- `Hero` keeps `min-h-screen` (intentional entry).
- `PinnedImageSection` keeps `h-screen` (required by GSAP ScrollTrigger pin).
- `GalleryStrip` and `ProjectsGrid` lose any explicit min-height; height is content-driven.

## Per-Section Changes

### Hero ([src/components/sections/Hero.tsx](src/components/sections/Hero.tsx))
- Delete the `style={{ background: 'var(--plaster)' }}` on the section.
- Delete the entire "Mist Glow" block (lines 33–69) — its responsibility moves to `OrganicBackdrop`.
- Keep: outline PSALMS logo, scroll indicator, `min-h-screen`, `overflow-visible`.

### PinnedImageSection ([src/components/sections/PinnedImageSection.tsx](src/components/sections/PinnedImageSection.tsx))
- Delete the section's `background: var(--plaster)`.
- Delete the explicit decorative circle div (lines 69–82) — duplicates `OrganicBackdrop`.
- Keep the GSAP pin, scroll snap, frame-scale animation, and verse fade.
- Add `marginBottom: '-30vh'` (or equivalent negative margin via inline style/className) to the section so the released frame's bottom shadow visually overlaps the start of `GalleryStrip`. The pin still releases at its current scroll position; only the post-pin layout flow changes.

### GalleryStrip ([src/components/sections/GalleryStrip.tsx](src/components/sections/GalleryStrip.tsx))
- Delete the wrapper's `background: var(--plaster)`.
- Delete both gradient fade overlays (lines 36–43).
- Delete `borderRadius: '8px'` on each thumbnail (line 55) — replace with `borderRadius: '2px'` (gentlest possible) or remove entirely.
- Vary thumbnail heights: instead of fixed `h-40 md:h-52`, alternate by index — e.g., `[h-40, h-52, h-44, h-56, h-48]` cycling through the loop, and matching widths so aspect ratios stay reasonable.
- Move vertical breathing room (`py-12 md:py-16`) **off** the strip and into a wrapper above it (or just leave the strip's own padding but reduce horizontal padding to zero so it stays edge-to-edge).
- Keep: marquee duplication trick, IntersectionObserver fade-in, hover scale.

### ProjectsGrid ([src/components/sections/ProjectsGrid.tsx](src/components/sections/ProjectsGrid.tsx))

**Container:**
- Delete the section's `background: var(--plaster)`.
- Replace `px-4 md:px-8 lg:px-16` with `px-0` — fully edge-to-edge.
- Keep `py-16 md:py-24` for vertical breathing room.

**Layout:**
- Replace the current two grids (`grid-cols-1 md:grid-cols-3` and `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`) with a single 12-column CSS Grid: `grid-cols-12 gap-2 md:gap-3`.
- Each `ProjectCard` is wrapped in a div with classes that vary by **index in the filtered list**. Pattern (looped):
  - Index 0: `col-span-7`, aspect `4/3`
  - Index 1: `col-span-5`, aspect `3/4`
  - Index 2: `col-span-5`, aspect `1/1`
  - Index 3: `col-span-7`, aspect `16/9`
  - Index 4: `col-span-6`, aspect `4/3`
  - Index 5: `col-span-6`, aspect `3/4`
  - Index 6: `col-span-8`, aspect `16/9`
  - Index 7: `col-span-4`, aspect `1/1`
  - (Repeat from index 0 for additional projects.)
- Each row's spans always sum to 12.
- Define this pattern as a const array `MOSAIC_PATTERN` at the top of the file: `[{cols: 7, ratio: '4/3'}, {cols: 5, ratio: '3/4'}, ...]`. Lookup is `MOSAIC_PATTERN[index % MOSAIC_PATTERN.length]`.

**Section title:**
- Move the "Selected Works" label out of the centered top header. Place it inside the grid as its own grid cell on row 1: e.g., `col-span-3` taking visual space alongside the first project card. Bottom-align it within the cell. Remove the centered wrapper.

**Filter tabs:**
- Stay in their current position above the grid.
- On filter change, animate card reflow using **GSAP Flip plugin** (already available via the existing `gsap` dependency — `import { Flip } from 'gsap/Flip'` and `gsap.registerPlugin(Flip)`).
- Implementation: capture state before `setActiveFilter` with `Flip.getState('.project-card')`, then in a `useEffect` triggered by `filteredProjects`, call `Flip.from(state, { duration: 0.6, ease: 'power2.inOut', absolute: true, stagger: 0.02 })`.

**Mobile (below `md`):**
- Mosaic collapses to single full-bleed column (`grid-cols-1`).
- Aspect ratios still alternate via the same `MOSAIC_PATTERN.ratio`.
- No horizontal padding.

### ProjectCard ([src/components/ui-custom/ProjectCard.tsx](src/components/ui-custom/ProjectCard.tsx))
- Remove rounded corners, border, and any box shadow on the card container.
- Image fills the entire card container at the aspect ratio passed in via prop (new `aspectRatio?: string` prop).
- Title/year metadata sits **below** the image as plain text — no card chrome, no padding box. Subtle uppercase tracking-wide treatment matching the existing typographic system.
- On hover: image scales `scale-[1.02]` over 700ms. No box highlight, no border change.
- Add `data-flip-id={project.id}` (or className `project-card`) so GSAP Flip can track it.

## Component Structure

```
App.tsx
├── VideoIntro
└── WaterRipple (now bg-plaster)
    ├── OrganicBackdrop          ← NEW (radial washes, z-0)
    ├── Header
    └── main (z-1)
        ├── Hero                 (no bg, no mist glow)
        ├── PinnedImageSection   (no bg, -30vh margin-bottom)
        ├── GalleryStrip         (no bg, no fades, varied heights)
        └── ProjectsGrid         (no bg, edge-to-edge, mosaic, GSAP Flip)
```

## Risks & Considerations

- **GSAP Flip animation cost:** First-time imports add ~10kb. Acceptable since GSAP is already loaded.
- **Filter reshuffle on small screens:** Single-column means Flip animation still works but is less visually impactful. Acceptable.
- **Negative margin overlap on PinnedImageSection:** Must be tested against the GSAP ScrollTrigger pin to ensure the trigger boundaries don't break. If they do, fall back to a positive margin on `GalleryStrip` instead and use a slight `translateY(-30vh)` on the strip.
- **Mosaic with filtered counts < 8:** Pattern array still works with modulo lookup; rows just terminate early. No special-casing needed.
- **No new dependencies.** Everything uses existing `gsap` and `tailwindcss`.

## Out of Scope

- ProjectDetail page (the modal-style detail view) — unchanged.
- Header — unchanged.
- VideoIntro — unchanged.
- Color tokens — unchanged.
- Typography system — unchanged.
- The marquee mechanic itself in `GalleryStrip` — only its visual treatment changes.
