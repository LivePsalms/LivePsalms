# Mobile Tile Full-Bleed Layout — Design

**Date:** 2026-05-29
**Component:** `src/components/sections/MobileProjectTile.tsx`
**Scope:** Replace the mobile tile's side-by-side text+image layout with a full-bleed image and overlaid text. Tile height grows from `min-h-[70vh]` to `min-h-screen`. The alternating left/right rhythm is preserved — text now flips between bottom-left and bottom-right anchor positions per index.

## Goal

Give the photograph the entire mobile viewport. Move the eyebrow + title + scripture from a side column to a small overlay anchored at the bottom corner of the image, alternating left/right per tile. A soft dark gradient under the text ensures legibility without dominating the image.

## Why

The existing 45/55 side-by-side layout treats the photograph and the devotion title as peers. Three iterations of motion tuning have established that the moment we want is the **image as the focal beat**, with the devotion text settling in as caption. Shrinking the image to ~half the screen undercuts that goal — at phone widths it ends up around 200px wide and reads as a thumbnail. Full-bleed gives the photo the weight it deserves, and the overlay treatment is a common editorial pattern that frames a single dominant image with a quiet label.

## Layout

Each tile is a single `<button>` with `position: relative`, `min-h-screen`, and `overflow-hidden`. Inside:

```
<button> (tile root)
├─ <motion.div data-testid="tile-image">     ← position: absolute inset-0
│  ├─ <img />                                  ← w-full h-full object-cover
│  └─ <div class="scrim" />                    ← absolute bottom-0 inset-x-0, h-2/5
│                                                soft gradient 55%→0% alpha
└─ <motion.div data-testid="tile-text">      ← position: absolute, z-10
                                                bottom-6 + (left-6 OR right-6)
```

### Tile root
- `<button type="button">` with `data-testid="mobile-project-tile"`, `data-tile-order`, click handler, aria-label — all unchanged.
- Classes: `relative block w-full min-h-screen overflow-hidden text-left`.
- No `flex`, no `gap`, no `px`, no `items-center`, no `min-h-[70vh]`. These are gone.

### Image wrap (`tile-image`)
- `position: absolute; inset: 0;` — fills the entire tile.
- Hosts the motion-driven `clipPath` and `opacity` styles exactly as today.
- Drops the `flex-[1.15]`, `aspect-[3/4]`, `borderRadius: 2px`. The image is now edge-to-edge, no rounded corners.
- Contains a `<img>` with `w-full h-full object-cover loading="lazy"` and `alt={project.name}` — unchanged props.
- Contains a `<div>` for the scrim:
  - `position: absolute; left: 0; right: 0; bottom: 0;`
  - `height: 40%;` (Tailwind `h-2/5`)
  - `background: linear-gradient(0deg, rgba(40,30,20,0.55) 0%, rgba(40,30,20,0) 100%);`
  - `pointer-events: none;`
  - Inside the motion-driven `tile-image` wrap so it inherits the `clip-path` curtain and animates in lockstep with the photo.

### Text overlay (`tile-text`)
- `position: absolute; z-index: 10;`
- `bottom-6` (24px from bottom of tile).
- Side anchor:
  - When `order === 'text-image'` (current even-index meaning): `left-6` (24px from left edge), `text-align: left`.
  - When `order === 'image-text'` (odd-index meaning): `right-6` (24px from right edge), `text-align: right`.
- A new attribute `data-text-anchor="left" | "right"` is added to the text wrap for testing the alternation without coupling to Tailwind class names.
- Hosts the motion-driven `opacity`, `y`, `filter` styles exactly as today.
- Drops the `flex-1` and `flex flex-col gap-2`. Use `flex flex-col gap-2` still — but no flex-1 since it's positioned absolutely.
- Each line uses a subtle `text-shadow` on the title for extra legibility against busy lower halves of photos (the scrim handles the bulk of the work; the shadow is insurance):
  - Title: `text-shadow: 0 1px 12px rgba(0,0,0,0.45)`.
  - Eyebrow and scripture: `text-shadow: 0 1px 8px rgba(0,0,0,0.55)`.

### Internal content (eyebrow / title / scripture)
- Text strings and conditional render unchanged.
- Class names for typography unchanged:
  - Eyebrow: `text-[10px] tracking-[0.3em] uppercase text-white/60` + `aria-hidden="true"`.
  - Title: `text-[26px] leading-[1.05] italic text-white` + Cormorant Garamond inline.
  - Scripture: `text-[10px] tracking-[0.12em] uppercase text-white/70`.
- Testids `tile-title` and `tile-scripture` unchanged.

## Motion (unchanged from `0322bb1`)

Everything in the motion spec stays exactly as it is at HEAD:

- Trigger: `useScroll({ target: tileRef, offset: ['start 50%', 'end 50%'] })`.
- Image clip-path: `inset(0 100% 0 0) → inset(0 0% 0 0)` (left→right curtain) over progress `[0, 0.85]`.
- Image opacity: `0 → 1` over `[0, 0.85]`.
- Text: opacity `[0 → 1]`, y `[-60 → 0]`, blur `[14 → 0]` over `[0.2, 0.95]`.
- Easing: `cubicBezier(0.22, 1, 0.36, 1)`.
- One-way latch via `useMotionValue` + `useMotionValueEvent`.
- `prefers-reduced-motion`: short-circuit to final state with no inline motion styles.

The scrim is a child of `tile-image`, so the image's `clipPath` clips both photograph and scrim together — they curtain in as one element.

## Accessibility

- `<button type="button">` with `aria-label` (eyebrow + title + scripture) — unchanged.
- Eyebrow `aria-hidden="true"` (already in aria-label) — unchanged.
- Image `alt={project.name}` — unchanged.
- Scrim has `pointer-events: none` so it doesn't intercept taps (the whole button still fires the click).
- Reduced-motion fallback: full-bleed image + scrim + text overlay all render at their final visual state. Layout is identical to the animated end state.

## Tests

`src/components/sections/MobileProjectTile.test.tsx`:

- **Content tests** (eyebrow, title, scripture, fallback): unchanged. Same queries (`getByText`, `getByTestId('tile-title')`, etc.) still resolve.
- **Click + aria-label**: unchanged.
- **Alternation test**: the existing `data-tile-order` assertion stays. Add a NEW assertion in the same test (or a new test) that the text wrap has `data-text-anchor="left"` at index 0 and `data-text-anchor="right"` at index 1.
- **Motion tests** (clip-path presence/absence, blur, initial right-clip state): unchanged — motion is unchanged.

No new test files. No tests removed.

## Files touched

- **Modified**: `src/components/sections/MobileProjectTile.tsx` (single file — layout rewrite of the JSX return).
- **Modified**: `src/components/sections/MobileProjectTile.test.tsx` (add `data-text-anchor` assertion).

## Files NOT touched

- `MobileParallaxList.tsx` — no changes needed; it still maps projects to tiles and passes the index.
- `PurposeGrid.tsx`, `DesktopMosaic.tsx`, `FilterTabs.tsx` — entirely unaffected.
- Section chrome (`Devotions` watermark, `FilterTabs`) sits above the tile list and is untouched.

## Risk

Visual change is significant — every mobile user sees the new layout. Technical risk is contained to a single file. The motion machinery is unchanged, so no risk of breaking the cinematic reveal we just tuned. The one risk to flag: at `min-h-screen` per tile × 11 tiles, the section is now 11 viewport-heights of scroll. That's ~1100vh of devotions section, which is a lot but matches the user-approved 100vh tile decision.

Browser verification will confirm the scrim curtain wipes in with the image (not separately), the text lands at the correct corner per index, and the reduced-motion fallback shows the static end state correctly.

## Out of scope

- Any change to motion timing or choreography.
- Any change to the mobile filter tabs UI.
- Image cropping intelligence (the `object-cover` + center alignment may crop awkwardly on some photographs; that's a per-asset concern, not a layout concern).
- Performance optimization beyond what's already in place (`loading="lazy"` on `<img>`).
- Desktop mosaic: untouched.
