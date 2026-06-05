# Hero Mask Fullscreen Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End the hero mask scroll animation on a full-window rectangle showing the entire image (object-contain), instead of an organic-silhouette crop of the image.

**Architecture:** Two stacked layers inside the existing sticky viewport. Layer 1 (existing, silhouette clip-path, object-cover) handles progress 0.00 → 0.55 expansion. Layer 2 (new, no clip-path, object-contain, cream background) handles the final fullscreen-and-uncropped state. They crossfade over progress 0.55 → 0.80. The video element moves entirely to Layer 2.

**Tech Stack:** React, GSAP + ScrollTrigger, Tailwind, Vite. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-05-12-hero-mask-fullscreen-reveal-design.md](../specs/2026-05-12-hero-mask-fullscreen-reveal-design.md)

**Verification approach:** This is visual animation code. Unit tests have limited value here. Each task ends with a manual browser verification step using the dev server (`npm run dev`) at localhost:5173. The reduced-motion branch is verifiable via DevTools "Emulate CSS prefers-reduced-motion: reduce."

---

## File Structure

**Modified:**
- `src/components/sections/Hero.tsx` — only file touched. Adds three refs, adds Layer 2 JSX block, extends one useEffect, adds one new useEffect.

**No new files. No CSS changes. No new assets.**

---

## Task 1: Add Layer 2 JSX (invisible)

**Files:**
- Modify: `src/components/sections/Hero.tsx`

Goal: render Layer 2 in the DOM with opacity 0. No animation hooked up yet. Page should look identical to current state in the browser.

- [ ] **Step 1: Add three new refs**

In `Hero.tsx`, find the existing mask refs block (around line 49-53):

```tsx
  // Mask scroll-expand refs
  const maskScrollRef = useRef<HTMLDivElement>(null);
  const maskClipRef = useRef<HTMLDivElement>(null);
  const maskImgRef = useRef<HTMLImageElement>(null);
  const maskVideoRef = useRef<HTMLVideoElement>(null);
```

Add three new refs immediately below (do **not** touch the existing `maskVideoRef` yet — Task 2 cleans it up):

```tsx
  // Layer 2 (unclipped, object-contain) refs — see
  // docs/superpowers/specs/2026-05-12-hero-mask-fullscreen-reveal-design.md
  const maskUnclippedRef = useRef<HTMLDivElement>(null);
  const maskUnclippedImgRef = useRef<HTMLImageElement>(null);
  const maskUnclippedVideoRef = useRef<HTMLVideoElement>(null);
```

- [ ] **Step 2: Add Layer 2 JSX block as a new sibling**

Find the existing `maskClipRef` div inside the sticky viewport (around lines 613-639):

```tsx
          <div
            ref={maskClipRef}
            className="relative overflow-hidden"
            style={{
              clipPath: 'url(#hero-mask-clip)',
              width: '75%',
              height: '45%',
            }}
          >
            <img
              ref={maskImgRef}
              src="/tropical_jungle.png"
              alt=""
              className="w-full h-full object-cover"
              style={{ transform: 'scale(1.15)' }}
            />
            <video
              ref={maskVideoRef}
              src="/hero_main_video.mp4"
              muted
              playsInline
              loop
              preload="auto"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0 }}
            />
          </div>
```

Do **not** modify this block. Instead, add the Layer 2 sibling div **immediately after this closing `</div>` (still inside the sticky viewport's child container)**:

```tsx
          {/* Layer 2 — unclipped, object-contain, opacity 0 → 1 mid-scroll.
              Owns the final fullscreen frame and the video. Cream surround
              fills any aspect-ratio gap (16:9 source on portrait viewports).
              Will be the only owner of <video> after Task 2 removes Layer 1's video. */}
          <div
            ref={maskUnclippedRef}
            className="absolute inset-0 w-full h-full flex items-center justify-center"
            style={{
              backgroundColor: 'hsl(var(--mersi-cream))',
              opacity: 0,
              zIndex: 2,
              willChange: 'opacity',
            }}
          >
            <img
              ref={maskUnclippedImgRef}
              src="/tropical_jungle.png"
              alt=""
              className="w-full h-full object-contain"
            />
            <video
              ref={maskUnclippedVideoRef}
              src="/hero_main_video.mp4"
              muted
              playsInline
              loop
              preload="auto"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ opacity: 0 }}
            />
          </div>
```

Important: Layer 1's `<video>` element stays in place during Task 1. It's still referenced by `maskVideoRef` and animated by the existing useEffect — nothing breaks. Task 2 removes the Layer 1 video together with its ref and animation logic.

- [ ] **Step 3: Start the dev server and verify Layer 2 is invisible**

Run:

```bash
npm run dev
```

Open http://localhost:5173. Expected:
- Page loads without errors (no console errors about missing refs).
- Hero animation behaves exactly as before — silhouette grows on scroll, image visible, no visual change yet.
- Open DevTools Elements panel, locate the new Layer 2 div by ref/class. Confirm `opacity: 0` and it has the cream `background-color`.

**Stop and visually verify before continuing.**

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
feat(hero): add invisible Layer 2 unclipped mask scaffolding

Two-layer architecture for the mask scroll-reveal. Layer 2 (unclipped,
object-contain, cream background) sits above the existing clipped Layer
1 at opacity 0. Video moved to Layer 2 in preparation for the crossfade.
No animation wired yet — page renders identically.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Remove Layer 1's video element and animation logic

**Files:**
- Modify: `src/components/sections/Hero.tsx`

Goal: delete Layer 1's `<video>` JSX, delete the now-unused `maskVideoRef`, and trim the existing useEffect so it no longer references either. Layer 1 becomes image-only. Video orchestration returns on Layer 2 in Task 3.

- [ ] **Step 1: Remove the `<video>` element from Layer 1's JSX**

Find the existing `maskClipRef` block (around lines 613-639) and delete the `<video>` element inside it. The block becomes:

```tsx
          <div
            ref={maskClipRef}
            className="relative overflow-hidden"
            style={{
              clipPath: 'url(#hero-mask-clip)',
              width: '75%',
              height: '45%',
            }}
          >
            <img
              ref={maskImgRef}
              src="/tropical_jungle.png"
              alt=""
              className="w-full h-full object-cover"
              style={{ transform: 'scale(1.15)' }}
            />
          </div>
```

- [ ] **Step 2: Remove the Layer 1 video references from the useEffect**

Find the existing useEffect at line 104. Replace the entire useEffect body with a temporarily simplified version:

```tsx
  /* ── Mask-expand scroll animation ── */
  useEffect(() => {
    const scrollEl = maskScrollRef.current;
    const clipEl = maskClipRef.current;
    const imgEl = maskImgRef.current;
    if (!scrollEl || !clipEl || !imgEl) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: scrollEl,
          start: 'top top',
          end: '60% top',
          scrub: 1,
          pin: false,
          invalidateOnRefresh: true,
        },
      });

      // Layer 1: expand clipped container 75/45% → 100/100% over progress 0 → 0.55
      tl.fromTo(
        clipEl,
        { width: '75%', height: '45%' },
        { width: '100%', height: '100%', ease: 'none', duration: 0.55 },
        0
      );

      // Layer 1: subtle image zoom-out over same window
      tl.fromTo(
        imgEl,
        { scale: 1.15 },
        { scale: 1, ease: 'none', duration: 0.55 },
        0
      );
    }, scrollEl);

    return () => ctx.revert();
  }, []);
```

Key changes:
- Removed `maskVideoRef` reference and the entire video crossfade block.
- Removed the standalone `ScrollTrigger.create` for video playback.
- Expansion duration changed from `1` to `0.55` so Layer 1 finishes filling the viewport at progress 0.55 (where the crossfade begins in Task 3).

- [ ] **Step 3: Remove the now-unused `maskVideoRef`**

The ref no longer has any usage (JSX deleted in Step 1, useEffect rewritten in Step 2). Delete the declaration in the refs block:

```tsx
  const maskVideoRef = useRef<HTMLVideoElement>(null);
```

- [ ] **Step 4: Verify in browser**

In the running dev server, scroll the hero. Expected:
- Silhouette still expands from small to full viewport.
- No video plays at any scroll position (correct — video logic is gone, to be re-added in Task 3 on Layer 2).
- Image-only experience throughout the scroll range.
- No console errors.
- No TypeScript errors in the Vite dev output (`maskVideoRef` is fully removed).

**Stop and visually verify before continuing.**

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
refactor(hero): remove Layer 1 video logic ahead of crossfade rewrite

Trims the mask-expand timeline to image-only. Sets Layer 1 expansion to
complete at progress 0.55 to leave room for the Layer 1 → Layer 2
crossfade. Video logic returns on Layer 2 in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire Layer 1 → Layer 2 crossfade

**Files:**
- Modify: `src/components/sections/Hero.tsx` — the same useEffect

Goal: animate Layer 1 opacity 1.0 → 0.0 and Layer 2 opacity 0.0 → 1.0 over scroll progress 0.55 → 0.80. By scroll progress 0.80 Layer 2 is fully visible.

- [ ] **Step 1: Extend the useEffect with the crossfade**

Replace the useEffect body again with:

```tsx
  /* ── Mask-expand scroll animation ── */
  useEffect(() => {
    const scrollEl = maskScrollRef.current;
    const clipEl = maskClipRef.current;
    const imgEl = maskImgRef.current;
    const unclippedEl = maskUnclippedRef.current;
    if (!scrollEl || !clipEl || !imgEl || !unclippedEl) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: scrollEl,
          start: 'top top',
          end: '60% top',
          scrub: 1,
          pin: false,
          invalidateOnRefresh: true,
        },
      });

      // Phase 1 — Expansion (progress 0.00 → 0.55)
      // Layer 1 silhouette grows to fill the viewport. Image scales 1.15 → 1.
      tl.fromTo(
        clipEl,
        { width: '75%', height: '45%' },
        { width: '100%', height: '100%', ease: 'none', duration: 0.55 },
        0
      );
      tl.fromTo(
        imgEl,
        { scale: 1.15 },
        { scale: 1, ease: 'none', duration: 0.55 },
        0
      );

      // Phase 2 — Crossfade (progress 0.55 → 0.80)
      // Layer 1 fades out; Layer 2 (unclipped, object-contain) fades in.
      tl.to(
        clipEl,
        { opacity: 0, ease: 'power1.inOut', duration: 0.25 },
        0.55
      );
      tl.to(
        unclippedEl,
        { opacity: 1, ease: 'power1.inOut', duration: 0.25 },
        0.55
      );
    }, scrollEl);

    return () => ctx.revert();
  }, []);
```

- [ ] **Step 2: Verify the crossfade in the browser**

Reload http://localhost:5173 and scroll slowly through the hero section. Expected:
- 0% → ~55% scroll: silhouette grows to fill the viewport (unchanged from Task 2).
- ~55% → ~80% scroll: silhouette fades out while the cream-bordered, fully-contained image fades in. On a 16:9 desktop viewport, the contained image is nearly the same size as the cover image, so the crossfade looks like a clean transition. On a portrait viewport / narrow window, the contain version is visibly smaller with cream bands top/bottom.
- ~80% → 100% scroll: only Layer 2 visible, full image visible inside cream surround.

**Visually verify with browser-testing-with-devtools or manual inspection before continuing.**

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
feat(hero): crossfade clipped Layer 1 to unclipped Layer 2 on scroll

Progress 0.55 → 0.80 fades the silhouette out and the full-window
object-contain frame in. End state of the scroll animation is now a
complete, uncropped image inside a cream surround.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Move video crossfade and playback start to Layer 2

**Files:**
- Modify: `src/components/sections/Hero.tsx` — the same useEffect

Goal: the Layer 2 video element fades in over the Layer 2 image at progress 0.70 → 0.90, and starts playing at progress >= 0.65. End state is the video playing in full, contained in the viewport.

- [ ] **Step 1: Extend the useEffect with video logic**

Append to the timeline section (after the crossfade `to()` calls) and add the playback trigger outside the timeline. Final useEffect body:

```tsx
  /* ── Mask-expand scroll animation ── */
  useEffect(() => {
    const scrollEl = maskScrollRef.current;
    const clipEl = maskClipRef.current;
    const imgEl = maskImgRef.current;
    const unclippedEl = maskUnclippedRef.current;
    const videoEl = maskUnclippedVideoRef.current;
    if (!scrollEl || !clipEl || !imgEl || !unclippedEl) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: scrollEl,
          start: 'top top',
          end: '60% top',
          scrub: 1,
          pin: false,
          invalidateOnRefresh: true,
        },
      });

      // Phase 1 — Expansion (progress 0.00 → 0.55)
      tl.fromTo(
        clipEl,
        { width: '75%', height: '45%' },
        { width: '100%', height: '100%', ease: 'none', duration: 0.55 },
        0
      );
      tl.fromTo(
        imgEl,
        { scale: 1.15 },
        { scale: 1, ease: 'none', duration: 0.55 },
        0
      );

      // Phase 2 — Layer 1 → Layer 2 crossfade (progress 0.55 → 0.80)
      tl.to(
        clipEl,
        { opacity: 0, ease: 'power1.inOut', duration: 0.25 },
        0.55
      );
      tl.to(
        unclippedEl,
        { opacity: 1, ease: 'power1.inOut', duration: 0.25 },
        0.55
      );

      // Phase 3 — Image → video crossfade on Layer 2 (progress 0.70 → 0.90)
      if (videoEl) {
        gsap.set(videoEl, { opacity: 0 });
        tl.to(
          videoEl,
          { opacity: 1, ease: 'power1.inOut', duration: 0.2 },
          0.7
        );
      }
    }, scrollEl);

    // Playback start: kick the video off slightly before its visual crossfade.
    let playbackTrigger: ScrollTrigger | undefined;
    if (videoEl) {
      playbackTrigger = ScrollTrigger.create({
        trigger: scrollEl,
        start: 'top top',
        end: '60% top',
        onUpdate: (self) => {
          if (self.progress >= 0.65 && videoEl.paused) {
            videoEl.play().catch(() => {});
          }
        },
      });
    }

    return () => {
      ctx.revert();
      playbackTrigger?.kill();
    };
  }, []);
```

- [ ] **Step 2: Verify video plays and crossfades at end of scroll**

Reload and scroll through hero. Expected:
- 0% → ~55%: silhouette expansion (unchanged).
- ~55% → ~80%: silhouette → contained frame crossfade.
- ~65% scroll: video begins playing silently in the background of Layer 2 (still hidden behind the image at this point).
- ~70% → ~90%: image fades to video inside Layer 2's contained frame.
- ~90% → 100%: video playing full-frame inside cream surround.

Check Network tab: `/hero_main_video.mp4` should be fetched **once**, not twice.

**Visually verify before continuing.**

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
feat(hero): play and crossfade the video on Layer 2 at end of scroll

Image → video crossfade fires at progress 0.70 → 0.90 inside the
contained Layer 2 frame. Playback starts at progress 0.65 to prime the
first frame ahead of the visual crossfade. Single video element, single
fetch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add prefers-reduced-motion fallback

**Files:**
- Modify: `src/components/sections/Hero.tsx`

Goal: when `prefers-reduced-motion: reduce` is set, skip the GSAP scroll timeline entirely. Layer 1 stays hidden, Layer 2 renders statically at full opacity, and the outer scroll container collapses from 250vh to 100vh so there is no orphan scroll distance.

- [ ] **Step 1: Gate the existing useEffect on reduced motion**

Find the useEffect from Task 4 and add an early return at the top:

```tsx
  /* ── Mask-expand scroll animation ── */
  useEffect(() => {
    if (prefersReducedMotion) return;

    const scrollEl = maskScrollRef.current;
    // ... rest unchanged
```

`prefersReducedMotion` is already memoized at line 44 of the original file.

Also update the dependency array (the existing array is `[]`; add `prefersReducedMotion` so the effect re-runs if the value changes via media-query update — although in practice `prefersReducedMotion` is a memo of a one-time read, this keeps the effect honest):

```tsx
  }, [prefersReducedMotion]);
```

- [ ] **Step 2: Add reduced-motion static render effect**

Immediately after the existing useEffect (still inside the component), add:

```tsx
  /* ── Reduced-motion fallback for the mask-expand:
       no scroll animation; Layer 2 rendered statically at full opacity. ── */
  useEffect(() => {
    if (!prefersReducedMotion) return;

    const clipEl = maskClipRef.current;
    const unclippedEl = maskUnclippedRef.current;
    const videoEl = maskUnclippedVideoRef.current;
    if (!clipEl || !unclippedEl) return;

    // Hide Layer 1, show Layer 2 (and its video) immediately.
    gsap.set(clipEl, { opacity: 0 });
    gsap.set(unclippedEl, { opacity: 1 });
    if (videoEl) {
      gsap.set(videoEl, { opacity: 1 });
      videoEl.play().catch(() => {});
    }
  }, [prefersReducedMotion]);
```

- [ ] **Step 3: Collapse outer scroll height under reduced motion**

Find the JSX outer wrapper at the start of the masked-image block:

```tsx
      <div
        ref={maskScrollRef}
        className="relative"
        style={{ height: '250vh', marginTop: '-35vh' }}
      >
```

Change to:

```tsx
      <div
        ref={maskScrollRef}
        className="relative"
        style={{
          height: prefersReducedMotion ? '100vh' : '250vh',
          marginTop: '-35vh',
        }}
      >
```

- [ ] **Step 4: Verify in browser with DevTools emulation**

Open DevTools → Cmd+Shift+P → "Emulate CSS prefers-reduced-motion" → "reduce". Reload the page. Expected:
- Hero region scrolls past in a single viewport's worth of scroll (100vh, not 250vh).
- The masked image area shows the full contained image immediately with cream surround. No silhouette ever appears.
- Video plays automatically.
- No JS errors about `ScrollTrigger` (the GSAP effect early-returned).

Toggle the emulation back off and reload — the full scroll animation returns.

**Verify both states before continuing.**

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
feat(hero): reduced-motion fallback for mask fullscreen reveal

Under prefers-reduced-motion: reduce, the scroll-driven timeline is
skipped. Layer 2 renders statically at full opacity, video autoplays,
and the outer scroll container collapses from 250vh → 100vh so there
is no orphan scroll distance.

Matches the parallel reduced-motion branch on the scroll-collapse
timeline in the same file.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final verification pass

**Files:** none modified.

- [ ] **Step 1: Type-check and lint**

Run:

```bash
npm run build
```

Expected: TypeScript passes, Vite build succeeds. If TypeScript complains about an unused `maskVideoRef` (should have been deleted in Task 2 Step 3) or any other unused import, fix and commit before continuing.

```bash
npm run lint
```

Expected: no new ESLint errors introduced by this change.

- [ ] **Step 2: Run the existing unit test for hero-intro-gate**

The hero intro gate is a separate concern but lives in the same directory. Make sure nothing broke:

```bash
npm test
```

Expected: all tests pass (in particular `hero-intro-gate.test.ts`).

- [ ] **Step 3: Full manual run-through in the browser**

Hard-reload http://localhost:5173 with cache cleared. Walk through:
- Intro animation plays.
- Scroll into the masked image section: silhouette grows from small.
- Continue scrolling: silhouette reaches full viewport at ~55% scroll.
- Continue scrolling: silhouette crossfades to cream-bordered full-image (~55% → ~80% scroll).
- Continue scrolling: image crossfades to video (~70% → ~90% scroll).
- End of scroll range: video playing full-frame inside cream surround.
- Scroll back up: animation reverses smoothly (no jumps, no flicker).
- Resize the window while in the section: animation re-snaps cleanly (this is what `invalidateOnRefresh: true` is for).
- Quote section below the masked image still fades in correctly.

- [ ] **Step 4: Verify on a portrait viewport**

DevTools → device toolbar → portrait phone (e.g., iPhone 12 Pro). Reload. Expected:
- During expansion: silhouette grows. Image is cropped by `object-cover` (acceptable).
- After crossfade: Layer 2 shows the full 16:9 image centered with prominent cream bands top and bottom (acceptable per spec — goal was "see the whole image").

- [ ] **Step 5: No commit unless fixes are required**

If everything passes, this task is done. If any issue surfaces, fix inline, re-verify, commit with a clear fix message.

---

## Spec Coverage Checklist

- [x] Two stacked layers (Task 1)
- [x] Layer 2 has its own `<img>` and `<video>`, both `object-contain` (Task 1)
- [x] Layer 1's `<video>` removed (Task 1, 2)
- [x] Crossfade at progress 0.55 → 0.80 (Task 3)
- [x] Image → video crossfade on Layer 2 at progress 0.70 → 0.90 (Task 4)
- [x] Video playback trigger at progress 0.65 on Layer 2 video (Task 4)
- [x] Cream background on Layer 2 via `hsl(var(--mersi-cream))` (Task 1)
- [x] Z-order: Layer 2 above Layer 1 (Task 1 — Layer 2 has explicit `zIndex: 2`; Layer 1 is statically positioned, so default stacking keeps it below)
- [x] Single video element, single fetch (verified Task 4 Step 2)
- [x] Reduced-motion branch: timeline skipped, Layer 2 static, outer 100vh (Task 5)
- [x] No other Hero subsystems touched (intro, scroll-collapse, quote unchanged)
- [x] No CSS file changes; no new assets
