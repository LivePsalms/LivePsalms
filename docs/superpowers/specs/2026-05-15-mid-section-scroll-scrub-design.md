# Mid-section scroll-scrubbed animation

A new pinned, full-bleed section that plays the rendered HyperFrames mid-section animation by scrubbing video playback against scroll progress. Sits between the Hero (which ends with the Psalm 23:2-3 verse) and the PurposeGrid on the home route. The page pins for 200vh of scroll while the user advances through the animation frame-by-frame; the section enters and exits with a hard cut because another animated section is planned to follow directly after.

## Placement

- New component: `src/components/sections/MidSectionMotion.tsx`.
- Rendered in [src/App.tsx](src/App.tsx) inside the existing `<main>` for the `/` route, between `<Hero/>` and `<PurposeGrid/>`. No wrapping component, no portal.
- Only on `/`. Not on `/purpose`, `/purpose/:id`, `/notepad`, `/login`, `/welcome`, or `/profile`.

## Asset prep (one-time, manual)

Source render (do not modify):
`public/Mid_section motion/mid-section-motion/renders/mid-section-motion_2026-05-16_18-58-17.mp4`
— 1920×1080, 30 fps, 9.6 s, 288 frames, H.264, ~7.1 MB, no audio track.

Produce two shipped derivatives at the `public/` root (clean URL paths, no spaces):

1. **`public/mid-section-motion.mp4`** — re-encoded so every frame is a keyframe, eliminating scrub-seek latency.
   ```bash
   ffmpeg -i "public/Mid_section motion/mid-section-motion/renders/mid-section-motion_2026-05-16_18-58-17.mp4" \
     -an -c:v libx264 -preset slow -crf 20 \
     -g 1 -keyint_min 1 -sc_threshold 0 \
     -pix_fmt yuv420p -movflags +faststart \
     public/mid-section-motion.mp4
   ```
   Expected output: 12–18 MB. Resolution unchanged. `-an` drops the (already empty) audio stream so the file is unambiguously video-only.

2. **`public/mid-section-motion-last-frame.jpg`** — final frame, used as poster image and as the reduced-motion fallback.
   ```bash
   ffmpeg -sseof -0.04 -i "public/Mid_section motion/mid-section-motion/renders/mid-section-motion_2026-05-16_18-58-17.mp4" \
     -frames:v 1 -q:v 3 \
     public/mid-section-motion-last-frame.jpg
   ```
   Expected output: ~150–250 KB.

Both files are committed. The original source folder stays intact.

## Component structure

```
<section>                                        // height: 200vh, the scrub track
  <div>                                          // sticky inner, height: 100vh, the pinned stage
    <video poster="..." muted playsInline />     // object-fit: cover, fills 100vw × 100vh
  </div>
</section>
```

- The video element: `src="/mid-section-motion.mp4"`, `poster="/mid-section-motion-last-frame.jpg"`, `muted`, `playsInline`, `preload="auto"`. No `autoplay`, no `controls`, no `loop`.
- Inner div is the pin target. ScrollTrigger pins it for the duration of the outer section.
- Section background is irrelevant since the video covers it fully during the entire pinned moment. Body/page background showing above and below is the existing `var(--app-bg)` from surrounding sections.

## Scroll mechanics

Mirror the GSAP pattern already established in [src/components/sections/Hero.tsx](src/components/sections/Hero.tsx):

```ts
gsap.registerPlugin(ScrollTrigger);

useEffect(() => {
  const sectionEl = sectionRef.current;
  const pinEl = pinRef.current;
  const videoEl = videoRef.current;
  if (!sectionEl || !pinEl || !videoEl) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return; // reduced-motion path renders a poster-only branch in JSX

  const ctx = gsap.context(() => {
    let duration = 0;
    let ready = false;

    const onMeta = () => {
      duration = videoEl.duration;
      ready = Number.isFinite(duration) && duration > 0;
    };
    videoEl.addEventListener('loadedmetadata', onMeta);

    const setTime = gsap.quickSetter(videoEl, 'currentTime'); // throttles to rAF

    ScrollTrigger.create({
      trigger: sectionEl,
      start: 'top top',
      end: 'bottom bottom',
      pin: pinEl,
      scrub: true,
      onUpdate: (self) => {
        if (!ready) return;
        setTime(self.progress * duration);
      },
    });
  }, sectionEl);

  return () => ctx.revert();
}, []);
```

Notes:
- `scrub: true` (not a numeric smoothing value) ties currentTime 1:1 to scroll position with no inertia, matching the "frame by frame" requirement.
- `gsap.quickSetter` collapses multiple per-frame writes into a single one, preventing redundant `currentTime` assignments.
- Until `loadedmetadata` fires we skip writes; the browser shows the `poster` attribute (the last frame) so there is never a black flash.
- `gsap.context()` scoped to the section ensures the ScrollTrigger, the metadata listener, and the quickSetter are all cleaned up on unmount.

## Reduced-motion fallback

When `window.matchMedia('(prefers-reduced-motion: reduce)').matches` is true, render a different JSX branch entirely — do not register the ScrollTrigger and do not load the video:

```
<section style={{ height: '100vh' }}>           // no scrub distance; one viewport tall
  <img src="/mid-section-motion-last-frame.jpg"  // full-bleed last frame
       alt="" class="..." />                     // object-fit: cover
</section>
```

The user scrolls past it normally in one viewport height. No pinning, no animation, no video download. The decision is made once at mount; we do not react to runtime changes of the media-query (consistent with how [App.tsx](src/App.tsx) handles reduced-motion for the hero intro gate).

## What's intentionally not in scope

- No fade-in or fade-out — hard cut at both ends per the design decision (another animated section is planned to follow directly).
- No audio handling — source has no audio track.
- No looping or auto-replay — scroll is the only driver.
- No automated tests — pure visual motion code; verified by manual QA in a browser, consistent with the project's pattern for animation components (e.g., the hero bridge timelines).
- No edits to the HyperFrames composition under `public/Mid_section motion/mid-section-motion/`. We consume the rendered MP4 only.
- No mobile-specific re-encode. The same MP4 plays on mobile; 1920×1080 at this bitrate is acceptable on modern phones. If QA reveals stutter on real devices, a follow-up spec can add a 720p mobile variant.
- No image-sequence fallback. The keyframe-per-frame encode is expected to be reliable across modern browsers; if QA proves otherwise, a follow-up spec can introduce one.
