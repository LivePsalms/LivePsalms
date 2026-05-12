# Hero Mask Fullscreen Reveal — Design

**Date:** 2026-05-12
**Branch:** deepen-architecture
**File touched:** `src/components/sections/Hero.tsx` (only)

## Problem

The hero mask image expands on scroll, but at the end of the scroll animation:

1. The reveal is still constrained by the organic silhouette SVG clip-path — it never becomes a full rectangle filling the viewport.
2. The image inside the mask uses `object-cover`, so the user never sees the full image — only a center-crop of it.

The expansion motion itself ("expands on scroll which is great") is liked and preserved. The fix targets the **end state**.

## Goal

By the end of the scroll animation:

- The visible reveal is a full-viewport **rectangle** (cream color fills any aspect-ratio gaps).
- The full image (and video) is visible — `object-contain`, no cropping.

## Approach: Two stacked layers, crossfaded mid-scroll

CSS cannot interpolate between an arbitrary `path()` clip-path and a rectangle. Rather than morph the clip-path, we stack two layers and crossfade between them:

```
.maskScrollRef                                              (outer, 250vh, ScrollTrigger)
  .stickyViewport (sticky top-0, h-screen)
    ┌─ Layer 2: unclipped final layer (NEW)
    │    <img object-contain> + <video object-contain>
    │    starts opacity 0; fades in over progress 0.55 → 0.80
    │    background: hsl(var(--mersi-cream))  (fills aspect-ratio gaps)
    │
    └─ Layer 1: clipped silhouette layer (EXISTING)
         clipPath: url(#hero-mask-clip)
         <img object-cover scaled>  (no <video> here — see below)
         starts opacity 1; fades to 0 over progress 0.55 → 0.80
```

Layer 2 sits **above** Layer 1 in the stacking order. Layer 1 is visible during the expansion phase; Layer 2 is invisible. As scroll advances, Layer 2 fades in and covers Layer 1.

## Scroll timeline

The existing ScrollTrigger range (`top top` → `60% top` of `maskScrollRef`) is preserved. The 1.0 timeline range is split into three phases:

| Progress | Phase | Layer 1 (clipped) | Layer 2 (unclipped) |
|---|---|---|---|
| 0.00 → 0.55 | Expansion (unchanged) | container `75% × 45%` → `100% × 100%`; image `scale 1.15 → 1.0`; opacity 1.0 | opacity 0 |
| 0.55 → 0.80 | Crossfade (new) | container stays `100% × 100%`; opacity `1.0 → 0.0` | image/video at `object-contain`; opacity `0 → 1.0` |
| 0.80 → 1.00 | Settle (new) | hidden | held at opacity 1.0 |

### Video crossfade adjustment

The existing image→video crossfade currently lives at progress 0.70 → 0.90 on Layer 1. It moves entirely to Layer 2:

- Layer 1's `<video>` is **removed**. Layer 1 only needs to show the still image during the 0.0–0.55 expansion, after which it fades out.
- Layer 2 owns the **single** `<video>` element.
- The existing playback-start trigger (`if (self.progress >= 0.65 && videoEl.paused) videoEl.play()`) moves to Layer 2's video.
- The image→video opacity crossfade inside Layer 2 fires at progress 0.70 → 0.90, identical to current timing but applied to the Layer 2 video element.

Net behavior: one video file, fetched once, played once.

## Visual details

**Cream surround.** Layer 2's outermost element uses `background: hsl(var(--mersi-cream))` so any letterboxing space (top/bottom on portrait viewports; minimal on 16:9 desktop given the 2048×1152 source) blends with the page background.

**Source image dimensions.** The source `/tropical_jungle.png` is 2048×1152 (16:9). On 16:9 desktop viewports the contain letterboxing is negligible. On portrait/mobile viewports the image renders smaller with cream bands top and bottom. This is acceptable and matches the goal of "see the whole image."

**No new assets.** Reuses `/tropical_jungle.png` and `/hero_main_video.mp4`.

**Z-order.** Both layers live inside the existing `.stickyViewport`. Layer 2 has a higher z-index than Layer 1 (e.g. `zIndex: 2` vs `zIndex: 1`). This is independent of the wordmark/halo/ring stack (zIndex 2–5) above the hero, which lives in a separate sibling block (`collapseScrollRef`).

## Reduced motion

The existing mask-expand effect (Hero.tsx:104–165) does not currently check `prefers-reduced-motion`. A branch is added:

- When `prefers-reduced-motion: reduce` is set, the GSAP scroll timeline is skipped.
- Layer 1 is hidden (opacity 0).
- Layer 2 is rendered statically at full opacity, full viewport, `object-contain`, with the video playing on its existing autoplay attributes if present.
- The outer `maskScrollRef` height collapses from `250vh` to `100vh` so there is no orphan scroll distance.

This matches the existing reduced-motion philosophy in the same file (scroll-collapse already has a parallel branch).

## Out of scope

- The wordmark intro timeline (Hero.tsx:194–288)
- The scroll-collapse timeline (Hero.tsx:291–390)
- The quote fade-in (Hero.tsx:63–101)
- The `hero-mask-clip` clipPath itself — its shape is unchanged
- Any new image or video assets

## Files

- `src/components/sections/Hero.tsx` — only file modified
  - Refs: add `maskUnclippedRef`, `maskUnclippedImgRef`, `maskUnclippedVideoRef`. Remove the `<video>` inside the clipped layer (Layer 1 no longer has a video).
  - Effect at lines 104–165: extend the timeline with Layer 1 opacity fade and Layer 2 opacity + video crossfade. Move the video playback-start ScrollTrigger to target Layer 2's video.
  - Effect: add a `prefers-reduced-motion` early-return branch that statically renders Layer 2.
  - JSX at lines 597–641: add the Layer 2 sibling div with `<img>` + `<video>` both at `object-contain`, cream background.

No CSS file changes. No new tokens. No new assets.

## Risks

- **Double rendering during crossfade.** During progress 0.55–0.80 both layers are partially visible. Browsers handle two stacked images at differing opacities fine, but the cropped (cover) and contained versions will be slightly different sizes during the overlap. On 16:9 viewports this is barely perceptible. On portrait viewports the contain layer visibly shrinks as it fades in — this is acceptable per the goal (the user wants to see the full image).
- **Video element duplication risk.** If the implementer accidentally keeps Layer 1's video instead of removing it, the video is fetched twice. The spec is explicit: remove Layer 1's `<video>`.
- **Stacking inheritance.** Layer 2 must explicitly set its z-index higher than Layer 1; relying on DOM order alone is fine if both are `position: absolute` siblings, but if either becomes `position: relative` the stacking changes. Spec calls for explicit `zIndex`.
