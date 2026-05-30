# Mobile Hero — Masked video at 88vw 5:3

**Date:** 2026-05-30
**Component:** `src/components/sections/HeroMobile.tsx`
**Scope:** Widen the mobile hero video from 60vw 16:9 to 88vw 5:3 and apply the desktop's silhouette clip-path mask to it. No motion, no scroll trigger — the video just sits inside the silhouette and loops.

## Goal

Bring the mobile hero into closer visual rhyme with the desktop's masked video moment. Currently mobile shows the looping `hero_main_video.mp4` inside a plain rectangular box at `w-[60vw] max-w-sm aspect-video`. Desktop applies a silhouette clip-path (`#hero-mask-clip`) to the same video and lets it grow on scroll. This change keeps mobile's no-scroll-animation simplicity but adopts the silhouette framing at a deliberate larger size.

## Why

The 60vw 16:9 rectangle reads as a generic embed — there's no signal that it belongs to the Psalms brand. The desktop's silhouette mask is the brand's signature framing for cinema-style imagery; mounting it on mobile too removes the visual-language mismatch between viewports. Widening to 88vw matches the wordmark's width and gives the silhouette enough surface area to register as a shape (at 60vw the silhouette's notches and ledges read as noise instead of structure).

## Layout change

Inside `HeroMobile.tsx`'s column wrapper, the third item (currently the bare `<video>`) is wrapped:

**Current (lines 124-134):**

```tsx
<video
  data-testid="hero-mobile-video"
  aria-hidden="true"
  src="/hero_main_video.mp4"
  poster="/tropical_jungle.png"
  autoPlay={!prefersReducedMotion}
  muted
  playsInline
  loop
  preload="auto"
  className="w-[60vw] max-w-sm aspect-video object-cover"
/>
```

**New:**

```tsx
<div
  data-testid="hero-mobile-video-mask"
  className="w-[88vw] max-w-md aspect-[5/3] overflow-hidden"
  style={{ clipPath: 'url(#hero-mask-clip)' }}
>
  <video
    data-testid="hero-mobile-video"
    aria-hidden="true"
    src="/hero_main_video.mp4"
    poster="/tropical_jungle.png"
    autoPlay={!prefersReducedMotion}
    muted
    playsInline
    loop
    preload="auto"
    className="w-full h-full object-cover"
  />
</div>
```

## Mask def mount

Add `<HeroMaskClipDef />` as a sibling just inside the root `<div data-testid="hero-mobile">` (top of the return, before the column wrapper). This mirrors the desktop placement.

Add the import to the top of the file:

```tsx
import { HeroMaskClipDef } from '@/components/ui-custom/HeroMaskClipDef';
```

The `HeroMaskClipDef` component is already used by `HeroDesktop.tsx` and `MoodBoard.tsx`. It is safe to mount in `HeroMobile.tsx` too because the `Hero.tsx` dispatcher renders exactly one of `HeroDesktop` or `HeroMobile` at a time — never both. The clipPath ID `hero-mask-clip` never appears twice in the same render tree.

## Sizing decisions

| Property | Value | Rationale |
|---|---|---|
| Width | `w-[88vw] max-w-md` | Matches the wordmark width (same 88vw) — visual rhyme. `max-w-md` (28rem ≈ 448px) caps it on tablet-edge phones. |
| Aspect | `aspect-[5/3]` | Closest mobile-readable approximation of the desktop mask's natural landscape framing. Tall enough to show the silhouette's vertical structure, short enough to leave the bridge copy room. |
| Inner fit | `w-full h-full object-cover` | Video fills the masked box. `object-cover` ensures no letterbox if the source asset ratio diverges from 5:3 (it currently does — 16:9 source crops slightly top/bottom to fit). |

## What does NOT change

- Quote position (still above the video).
- `<video>` attributes other than `className`: `src`, `poster`, `autoPlay={!prefersReducedMotion}`, `muted`, `playsInline`, `loop`, `preload="auto"`, `data-testid`, `aria-hidden` — all preserved.
- Reduced-motion behavior: poster image fills the masked silhouette when autoplay is off. The clip-path applies to both the poster and the playing video (one wraps both).
- Wordmark, scroll-collapse, bridge copy.
- Desktop hero, `Hero.tsx` dispatcher, `HeroMaskClipDef` component itself.

## Files touched

- **Modified:** `src/components/sections/HeroMobile.tsx`
  - Add `HeroMaskClipDef` import.
  - Add `<HeroMaskClipDef />` mount near the top of the return.
  - Wrap the `<video>` in a `<div>` with `clipPath: url(#hero-mask-clip)` style and the new sizing classes.
  - Move sizing classes from `<video>` to the wrapper; change `<video>` className to `w-full h-full object-cover`.
- **Modified:** `src/components/sections/HeroMobile.test.tsx`
  - Add test: `mounts the hero-mask-clip SVG def` — asserts a `clipPath#hero-mask-clip` exists in the rendered tree.
  - Add test: `wraps the video in a clip-pathed container at 88vw aspect-[5/3]` — asserts the video's parent has `clipPath: url(#hero-mask-clip)` style and matches the new className.
  - Update test: `renders a <video> with /hero_main_video.mp4 ...` — change the className assertion if it was checked (currently it isn't, so likely no change needed here — confirm in implementation).

## Risk

Low. Single component file, single test file. The clip-path is presentation-only — if the SVG def fails to mount the video still renders unmasked. The wrapper div has no behavioral side effects (no event handlers, no refs, no GSAP). Pre-existing tests for video presence, ordering, autoplay, and aria-hidden all continue to pass because the video element itself is unchanged.

## Out of scope

- Any change to `HeroDesktop.tsx` or the desktop's scroll-driven mask expansion.
- Adding scroll-triggered animation to the new mobile masked video.
- Editing the `hero-mask-clip` path shape — same silhouette as desktop.
- Performance changes (still `preload="auto"`).
- Mounting the def from `Hero.tsx` instead of the leaf components (cleaner refactor available but out of scope for this iteration).
