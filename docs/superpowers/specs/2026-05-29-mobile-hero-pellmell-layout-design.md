# Mobile Hero — Pellmell-style layout (quote above looping video)

**Date:** 2026-05-29
**Component:** `src/components/sections/HeroMobile.tsx`
**Scope:** Reorder mobile hero so the Psalm 23 verse sits directly under the PSALMS wordmark (above the imagery), and replace the static silhouette `<img>` with the same looping video the desktop crossfades into (`/hero_main_video.mp4`) sized down to ~60vw 16:9.

## Goal

Restructure mobile-only hero composition from:

```
PSALMS wordmark
[ static jungle image, 88vw, 4:5 portrait ]
quote
bridge copy
```

to:

```
PSALMS wordmark
quote
[ looping video, 60vw, 16:9 landscape ]
bridge copy
```

Inspired by Pellmell's mobile homepage — wordmark → descriptive line → smaller media — but using the Psalms wordmark, the existing Psalm 23:2-3 quote, and the same `hero_main_video.mp4` source asset that already powers the desktop crossfade.

## Why

The current mobile hero hides the verse below a large 88vw 4:5 portrait image. The image dominates the first viewport and pushes the quote off-screen on small phones. Moving the quote above the imagery puts the brand's core promise — "He leads me beside still waters. He restores my soul." — into the entry impression. Swapping the static image for the looping video brings the mobile hero into parity with desktop's tone (gentle ambient motion) without needing the desktop's elaborate scroll-triggered mask-expand. Shrinking the video to ~60vw lets the quote breathe and prevents the looping motion from pulling attention away from the verse.

## Layout change

In `HeroMobile.tsx`, reorder the JSX inside the centered column wrapper.

**Current order (lines 106-164):**

1. `<PsalmsWordmarkSvg>` — `w-[88vw] max-w-md`
2. `<img>` silhouette — `w-[88vw] max-w-md aspect-[4/5]`
3. `<div ref={quoteRef}>` — quote with intersection fade
4. `<div ref={bridgeRef}>` — bridge copy

**New order:**

1. `<PsalmsWordmarkSvg>` — unchanged (`w-[88vw] max-w-md`)
2. `<div ref={quoteRef}>` — quote, intersection fade
3. `<video>` — `w-[60vw] max-w-sm aspect-video`, `autoPlay muted playsInline loop preload="auto"`, `poster="/tropical_jungle.png"`
4. `<div ref={bridgeRef}>` — bridge copy, unchanged

## Video element

```tsx
<video
  data-testid="hero-mobile-video"
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

Notes:

- `autoPlay` is gated on `!prefersReducedMotion`. When the user prefers reduced motion, the `poster` image (`/tropical_jungle.png` — the existing silhouette) renders statically. Treats the looping video as decorative motion under WCAG 2.3.3.
- `muted` + `playsInline` is required for iOS Safari autoplay.
- `aspect-video` is Tailwind's `aspect-ratio: 16 / 9`.
- `object-cover` ensures the video fills the 16:9 box if the source is a different ratio (the source is already landscape; `object-cover` is a safety net).
- `poster="/tropical_jungle.png"` reuses the asset that's currently the static image, so on slow connections the user sees the same calm-jungle frame before the video swaps in.

## Spacing

The existing column wrapper is:

```tsx
<div className="relative w-full flex flex-col items-center justify-center pt-24 pb-12 px-5 gap-8">
```

`gap-8` (2rem) between siblings reads well with the current image at 88vw. With the smaller 60vw video and the quote moving above it, keep `gap-8` — the quote sits 2rem under the wordmark, the video sits 2rem under the quote, and the bridge copy is already separated by its own `mt-16` margin.

The current quote container has `mt-12` (lines 119-122) that was sized to separate the quote from the image above. Remove `mt-12` from the quote container so the parent `gap-8` is the sole spacing source between wordmark and quote. The bridge `mt-16` stays — it sets the wide-pause separation between hero and bridge.

## Wordmark scroll-collapse — unchanged

The GSAP-driven letter-collapse-toward-A timeline (lines 55-97) stays as-is. The ScrollTrigger uses `MOBILE_COLLAPSE_VH = 60` and is keyed to the SVG element, not to the imagery. Moving the quote and video below the wordmark does not affect the trigger geometry. `MOBILE_TIME_SCALE` and the scrub value (`1 * MOBILE_TIME_SCALE`) stay.

## Intersection-fade refs

The quote container's `quoteRef` + `useIntersectionStage(quoteRef, { threshold: 0.4 })` stays unchanged. The threshold still works at the new DOM position — the quote enters the viewport earlier (right after wordmark on a tall phone, or with the wordmark on a shorter one), but the intersection logic doesn't care about scroll order. Bridge ref and threshold (`0.3`) also unchanged.

## Files touched

- **Modified:** `src/components/sections/HeroMobile.tsx`
  - Remove `SILHOUETTE_SRC` / `SILHOUETTE_ALT` constants (`<img>` is gone; poster path is inline on the `<video>`).
  - Move quote JSX above the imagery JSX in the column.
  - Replace `<img>` with `<video>` as specified above.
  - Drop `mt-12` from the quote container.
- **Modified:** `src/components/sections/HeroMobile.test.tsx`
  - Update `'does NOT render a <video> element'` → `'renders a <video> with /hero_main_video.mp4 and /tropical_jungle.png poster'`.
  - Update `'renders the silhouette image as an <img>'` → `'does NOT render the silhouette as an <img>'` (asset is now a poster on the video, not a standalone `<img>`).
  - New test: `'renders quote DOM-before video DOM'` — uses `compareDocumentPosition` to assert the quote node precedes the video node.
  - New test: `'sets autoPlay on the video when prefers-reduced-motion is NOT set'` — checks the `autoplay` attribute is present on the rendered video element.
  - New test: `'does NOT set autoPlay when prefers-reduced-motion is set'` — uses the existing reduced-motion `setMatchMedia` setup to assert `autoplay` is absent.

## What does NOT change

- `src/components/sections/HeroDesktop.tsx` — desktop mask-expand + crossfade flow stays as it is.
- `src/components/sections/Hero.tsx` — viewport-based mobile/desktop dispatcher unchanged.
- `BRIDGE_COPY` content and the three-beat bridge layout below the hero.
- Wordmark intro / scroll-collapse animation.
- Root container `min-h-[100svh]` + `var(--app-bg)` background.
- The `/tropical_jungle.png` asset itself — same file, now used as `poster` rather than `<img src>`.

## Reduced-motion behavior

| State | Wordmark intro | Wordmark scroll-collapse | Video |
|---|---|---|---|
| `prefers-reduced-motion: no-preference` | runs (via `introActive`) | runs (GSAP timeline) | autoplays + loops |
| `prefers-reduced-motion: reduce` | runs (existing mobile shortcut: `onIntroComplete?.()` immediately) | skipped (existing early-return) | does not autoplay; static poster image renders |

The reduced-motion video path uses the browser's default behavior when `autoPlay={false}` and `controls` is absent: the poster image renders, no controls are shown, no playback begins. This is the desired calm fallback — no looping motion, the same jungle frame the static image used to show.

## Performance / asset cost

`hero_main_video.mp4` is already loaded for desktop users. Mobile users currently load `/tropical_jungle.png` only; the new behavior loads both the poster PNG (immediate) and the MP4 (preload="auto"). On a 4G connection the MP4 is on the order of a few MB and not blocking — it preloads while the user is reading the quote. If the project later wants to gate this on a connection-quality check, that's a separate enhancement and is out of scope.

## Risk

Low. One component file, reorder + element swap. The wordmark animation, intersection-fade infrastructure, bridge copy, and viewport dispatcher are all untouched. Desktop is untouched. The video asset is already in production for desktop, so no new asset is introduced — only a new consumer of an existing asset.

## Out of scope

- Any change to `HeroDesktop.tsx` (the desktop mask-expand stays).
- Any change to the wordmark scroll-collapse timeline (still triggers on the SVG element).
- Any change to the bridge copy text or its three-beat layout.
- Any new asset — `hero_main_video.mp4` and `tropical_jungle.png` are existing files.
- Connection-quality-gated video loading.
- Adding scroll-triggered animation to the new mobile video (no scale-up, no crossfade — it just loops).
- Updating any breakpoint other than the existing `useIsMobile` (< 768px).
