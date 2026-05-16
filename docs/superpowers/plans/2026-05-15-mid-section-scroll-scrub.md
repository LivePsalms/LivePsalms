# Mid-section scroll-scrub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a full-bleed, pinned section between Hero and PurposeGrid on `/` that scrubs the rendered HyperFrames MP4 against 200vh of scroll, with a static-poster fallback for reduced-motion users.

**Architecture:** A single React component (`MidSectionMotion`) renders a 200vh outer `<section>` containing a sticky-pinned 100vh `<div>` with a full-bleed `<video>`. A GSAP ScrollTrigger pins the inner div and drives `video.currentTime` from scroll progress 0→1. When `prefers-reduced-motion: reduce` is set, the component renders a different 100vh branch with a poster `<img>` only — no video element, no ScrollTrigger.

**Tech Stack:** React 18 + TypeScript, GSAP 3.14.2 + ScrollTrigger (already in project, registered the same way as in `Hero.tsx`), Tailwind CSS classes, ffmpeg for one-time asset prep.

**Verification approach:** This project does not write automated tests for pure motion components (see [the spec's "out of scope" note](../specs/2026-05-15-mid-section-scroll-scrub-design.md) and the precedent set by [2026-05-15-bridge-directional-entries.md](../specs/2026-05-15-bridge-directional-entries.md)). Verification is `npm run build` (typecheck) + `npm run lint` + manual browser QA on Chrome and Safari.

**Spec reference:** [docs/superpowers/specs/2026-05-15-mid-section-scroll-scrub-design.md](../specs/2026-05-15-mid-section-scroll-scrub-design.md)

---

### Task 1: Produce the scrub-friendly MP4 derivative

Re-encode the rendered HyperFrames MP4 so every frame is a keyframe. The source `mid-section-motion_2026-05-16_18-58-17.mp4` has GOP-based keyframes (~1 every few seconds), which makes per-frame seeking expensive. After this re-encode, `video.currentTime = X` lands on the exact frame instantly.

**Files:**
- Create: `public/mid-section-motion.mp4`
- Source (read-only): `public/Mid_section motion/mid-section-motion/renders/mid-section-motion_2026-05-16_18-58-17.mp4`

- [ ] **Step 1: Confirm ffmpeg is installed**

Run: `ffmpeg -version | head -1`
Expected: a line starting with `ffmpeg version`. If it fails, install via `brew install ffmpeg` first.

- [ ] **Step 2: Run the re-encode**

Run from the project root:

```bash
ffmpeg -i "public/Mid_section motion/mid-section-motion/renders/mid-section-motion_2026-05-16_18-58-17.mp4" \
  -an -c:v libx264 -preset slow -crf 20 \
  -g 1 -keyint_min 1 -sc_threshold 0 \
  -pix_fmt yuv420p -movflags +faststart \
  public/mid-section-motion.mp4
```

Expected: ffmpeg runs for 10–30 seconds, prints `video:XXXXkB audio:0kB`, exits 0.

- [ ] **Step 3: Verify the output**

Run:

```bash
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,duration -show_entries format=size -of default=noprint_wrappers=0 public/mid-section-motion.mp4
```

Expected output (the size will vary, the others are exact):
- `codec_name=h264`
- `width=1920`
- `height=1080`
- `r_frame_rate=30/1`
- `nb_frames=288`
- `duration=9.600000`
- `size=` between **12000000 and 20000000** (12–20 MB)

If `nb_frames` is not 288 or `duration` is not 9.6, the re-encode is wrong — re-run Step 2.

- [ ] **Step 4: Spot-check seeking is instant**

Run:

```bash
ffprobe -v error -select_streams v -show_entries packet=pts_time,flags -of csv=p=0 public/mid-section-motion.mp4 | head -5
```

Expected: every line should end with `K_` (keyframe flag). If only the first line is `K_` and the rest are not, the `-g 1` flag was not applied — re-run Step 2.

- [ ] **Step 5: Commit**

```bash
git add public/mid-section-motion.mp4
git commit -m "$(cat <<'EOF'
chore(public): add scrub-friendly mid-section animation MP4

Re-encoded from public/Mid_section motion/mid-section-motion/renders/mid-section-motion_2026-05-16_18-58-17.mp4
with -g 1 -keyint_min 1 so every frame is a keyframe, making scroll-driven
currentTime seeks instant. Audio stream dropped (source has none).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Produce the last-frame poster JPG

Extract the final frame as a still image for use as the video's `poster` attribute and as the reduced-motion fallback.

**Files:**
- Create: `public/mid-section-motion-last-frame.jpg`

- [ ] **Step 1: Run the extract**

Run from the project root:

```bash
ffmpeg -sseof -0.1 -i "public/Mid_section motion/mid-section-motion/renders/mid-section-motion_2026-05-16_18-58-17.mp4" \
  -vframes 1 -q:v 3 \
  public/mid-section-motion-last-frame.jpg
```

`-sseof -0.1` seeks 0.1 seconds before end-of-file. At 30 fps that's the last 3 frames; ffmpeg takes the first one it decodes after the seek, which is the final frame. `-q:v 3` is high JPEG quality.

Expected: ffmpeg runs in under a second, prints `video:XXXkB`, exits 0.

- [ ] **Step 2: Verify the output**

Run:

```bash
ffprobe -v error -show_entries stream=codec_name,width,height -show_entries format=size -of default=noprint_wrappers=0 public/mid-section-motion-last-frame.jpg
```

Expected:
- `codec_name=mjpeg`
- `width=1920`
- `height=1080`
- `size=` between **100000 and 400000** (100–400 KB)

- [ ] **Step 3: Visual sanity check**

Open the file in Preview (macOS) and confirm it shows the final frame of the animation (not a black frame, not the first frame, not a transition frame):

```bash
open public/mid-section-motion-last-frame.jpg
```

If it shows something that looks like an intermediate frame or a black frame, increase the seek window by trying `-sseof -0.2` or `-sseof -0.05` and re-run Step 1.

- [ ] **Step 4: Commit**

```bash
git add public/mid-section-motion-last-frame.jpg
git commit -m "$(cat <<'EOF'
chore(public): add mid-section last-frame poster

Final frame extracted as JPG for use as the video poster and as the
reduced-motion fallback image.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Create the MidSectionMotion component

A single component that branches on `prefers-reduced-motion` at mount and renders either the scrubbed-video path or the static-poster path. Follows the same GSAP + ScrollTrigger pattern as [src/components/sections/Hero.tsx](../../../src/components/sections/Hero.tsx).

**Files:**
- Create: `src/components/sections/MidSectionMotion.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/sections/MidSectionMotion.tsx` with exactly this content:

```tsx
import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const VIDEO_SRC = '/mid-section-motion.mp4';
const POSTER_SRC = '/mid-section-motion-last-frame.jpg';

export function MidSectionMotion() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const sectionEl = sectionRef.current;
    const pinEl = pinRef.current;
    const videoEl = videoRef.current;
    if (!sectionEl || !pinEl || !videoEl) return;

    const ctx = gsap.context(() => {
      let duration = 0;
      let ready = false;

      const onMeta = () => {
        duration = videoEl.duration;
        ready = Number.isFinite(duration) && duration > 0;
      };
      if (videoEl.readyState >= 1) {
        onMeta();
      } else {
        videoEl.addEventListener('loadedmetadata', onMeta);
      }

      const setTime = gsap.quickSetter(videoEl, 'currentTime') as (value: number) => void;

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

      return () => {
        videoEl.removeEventListener('loadedmetadata', onMeta);
      };
    }, sectionEl);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <section
        ref={sectionRef}
        className="relative w-full overflow-hidden"
        style={{ height: '100vh' }}
        aria-hidden="true"
      >
        <img
          src={POSTER_SRC}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{ height: '200vh' }}
      aria-hidden="true"
    >
      <div ref={pinRef} className="relative h-screen w-full overflow-hidden">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </section>
  );
}
```

Key implementation notes (for the engineer reading this):

- `gsap.registerPlugin(ScrollTrigger)` at module scope is safe to call multiple times across files (GSAP guards it) and matches [src/components/sections/Hero.tsx:8](../../../src/components/sections/Hero.tsx#L8).
- `useMemo(() => ..., [])` snapshots `prefers-reduced-motion` at mount. This matches the pattern in [src/App.tsx:35-55](../../../src/App.tsx#L35-L55) — we intentionally do NOT react to runtime changes of the media query.
- The `if (videoEl.readyState >= 1)` check handles the race where metadata is already loaded by the time the effect runs (e.g., on fast cache hits). `HAVE_METADATA = 1`.
- `gsap.quickSetter` collapses redundant `currentTime` writes into one per animation frame, avoiding overdraw.
- `scrub: true` (boolean, not a number) ties scroll position 1:1 to currentTime with no inertia — per spec, this is what "frame by frame" requires.
- `gsap.context()` scoped to `sectionEl` ensures the ScrollTrigger is killed on unmount. The function returned from the inner callback is invoked by `ctx.revert()` and cleans up the metadata listener.
- `aria-hidden="true"` is appropriate: this is decorative motion content with no semantic information.

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: compiles cleanly. No new TypeScript errors. (The `npm run build` script runs `tsc -b` before `vite build` — see `package.json` `"build"`.)

If `gsap.quickSetter` complains about the cast type, the cast `as (value: number) => void` should silence it; if it still complains, fall back to `setTime: (v: number) => { videoEl.currentTime = v; }` and remove the `gsap.quickSetter` call.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors in `src/components/sections/MidSectionMotion.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/MidSectionMotion.tsx
git commit -m "$(cat <<'EOF'
feat(mid-section): add MidSectionMotion scroll-scrubbed component

Full-bleed pinned section that scrubs /mid-section-motion.mp4 frame-by-frame
against 200vh of scroll via GSAP ScrollTrigger. Renders a static-poster
fallback at 100vh for prefers-reduced-motion users — no video download,
no ScrollTrigger. Not yet wired into App.tsx.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire MidSectionMotion into App.tsx

Insert the component between `</WaterRipple>` (which closes after `<Hero/>`) and `<PurposeGrid/>` on the `/` route. Other routes are unaffected.

**Files:**
- Modify: `src/App.tsx` (add import; insert one JSX element inside the `/` route element)

- [ ] **Step 1: Add the import**

In `src/App.tsx`, add this import alongside the other `@/components/sections` imports (around line 8):

```tsx
import { MidSectionMotion } from '@/components/sections/MidSectionMotion';
```

The grouped section imports after the change should read:

```tsx
import { Hero } from '@/components/sections/Hero';
import { HeroLoadingOverlay } from '@/components/sections/HeroLoadingOverlay';
import { MidSectionMotion } from '@/components/sections/MidSectionMotion';
import { PurposeGrid } from '@/components/sections/PurposeGrid';
import { PurposeGallery } from '@/components/sections/PurposeGallery';
import { PurposeDetail } from '@/components/sections/PurposeDetail';
```

- [ ] **Step 2: Insert the element in the `/` route**

Find this block (currently around [src/App.tsx:120-130](../../../src/App.tsx#L120-L130)):

```tsx
<main>
  <WaterRipple
    rippleColor="rgba(40, 35, 30, 0.12)"
    rippleDuration={1800}
    maxRipples={6}
    disabled={introActive}
  >
    <Hero introActive={introActive} onIntroComplete={handleIntroComplete} onHandoff={handleIntroHandoff} />
  </WaterRipple>
  <PurposeGrid projects={projects} onProjectClick={handleProjectClick} />
</main>
```

Insert `<MidSectionMotion />` on its own line between `</WaterRipple>` and `<PurposeGrid ...>` so the block becomes:

```tsx
<main>
  <WaterRipple
    rippleColor="rgba(40, 35, 30, 0.12)"
    rippleDuration={1800}
    maxRipples={6}
    disabled={introActive}
  >
    <Hero introActive={introActive} onIntroComplete={handleIntroComplete} onHandoff={handleIntroHandoff} />
  </WaterRipple>
  <MidSectionMotion />
  <PurposeGrid projects={projects} onProjectClick={handleProjectClick} />
</main>
```

The component takes no props and is unconditional — it renders on `/` only by virtue of being inside that route's element.

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: compiles cleanly.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "$(cat <<'EOF'
feat(app): render MidSectionMotion between Hero and PurposeGrid

Inserts the scroll-scrubbed mid-section animation into the home route only,
sitting between the closing of WaterRipple (which wraps the Hero) and the
PurposeGrid.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Manual QA pass

Verify the feature in a real browser. The project pattern for motion components is manual QA — no automated tests are written for pure visual motion (per the spec and the precedent from the bridge work).

**Files:** none modified in this task.

- [ ] **Step 1: Start the dev server in the background**

Run: `npm run dev` with `run_in_background: true`.

Note the URL it prints (typically `http://localhost:5173/`).

- [ ] **Step 2: Verify the scrub path (default motion preferences)**

Open the URL in Chrome (or any browser without `prefers-reduced-motion` enabled). Then in order:

1. Confirm the page loads with the existing Hero behavior unchanged.
2. Scroll past the Hero and through the verse "Psalm 23:2-3" until the new section engages.
3. Confirm the page **pins** — scrolling continues to register but the visible element no longer moves; the video frame advances instead.
4. Slow-scroll through the entire pinned section. The video frames should advance smoothly and 1:1 with scroll position, with no inertia or lag at the end of each scroll input.
5. Confirm there is **no fade-in or fade-out** — the video appears the instant the pin engages and disappears the instant it releases.
6. After the pin releases, confirm the page continues into the PurposeGrid normally.
7. Scroll back up: the video should scrub in reverse and the pin should release upward exactly where it engaged downward.

If any of the above fails, see the troubleshooting notes in Step 5 below.

- [ ] **Step 3: Verify the reduced-motion path**

Enable `prefers-reduced-motion: reduce` for the test page:
- **macOS Chrome DevTools:** open DevTools → Command Menu (⌘⇧P) → type "reduced motion" → "Emulate CSS prefers-reduced-motion: reduce". Reload the page.
- Or: System Settings → Accessibility → Display → "Reduce motion" ON, then reload.

Then:

1. Confirm a single full-bleed still image appears in place of the animated section.
2. Confirm scrolling past it is normal page scrolling (no pin, one viewport tall).
3. In DevTools Network tab, filter for `mid-section-motion` and confirm `mid-section-motion.mp4` is **not** requested. Only `mid-section-motion-last-frame.jpg` should appear.
4. Disable the emulation when done.

- [ ] **Step 4: Verify in Safari**

Open the same URL in Safari and repeat Step 2. Pay particular attention to:
- Whether scrubbing is smooth (no visible frame-skip or stutter)
- Whether the video appears immediately on pin engagement (no black flash before the first frame paints)

If scrubbing stutters on Safari, the keyframe-per-frame encode from Task 1 should have prevented it; first re-verify Task 1 Step 4 shows every packet flagged `K_`. If it does and Safari still stutters, file a follow-up note in the spec — but do not block this plan.

- [ ] **Step 5: Verify build + lint one more time**

Run in parallel:
- `npm run build`
- `npm run lint`

Expected: both pass with no new errors.

- [ ] **Step 6: Stop the dev server**

Kill the background dev process. Per project memory, **only kill processes for this project** — don't run a broad `pkill node` or `pkill vite` that would touch other projects.

- [ ] **Step 7: No commit needed**

Task 5 makes no file changes. If a fix was needed during QA, that fix is its own commit on top of Tasks 1–4.

---

## Self-review

**Spec coverage:**
- Placement: Task 4 ✓
- Asset prep (`mid-section-motion.mp4`): Task 1 ✓
- Asset prep (`mid-section-motion-last-frame.jpg`): Task 2 ✓
- Component structure (200vh outer, 100vh pinned inner, full-bleed video): Task 3 Step 1 ✓
- Scroll mechanics (ScrollTrigger pin + scrub + currentTime): Task 3 Step 1 ✓
- `loadedmetadata` gating: Task 3 Step 1 ✓ (with `readyState` race handling)
- `gsap.context()` cleanup: Task 3 Step 1 ✓
- Reduced-motion fallback (100vh, poster img, no video loaded, no ScrollTrigger): Task 3 Step 1 ✓
- Cross-browser verification: Task 5 Steps 2 & 4 ✓
- No automated tests (per spec): explicit in plan header & Task 5 ✓
- Hard-cut transitions: implicit (no fade tweens in the code, verified in Task 5 Step 2 item 5) ✓

**Placeholder scan:** No "TBD", no "TODO", no "add appropriate X", no "similar to Task N". Every code block is complete. Every command shows expected output where applicable.

**Type consistency:** `VIDEO_SRC`, `POSTER_SRC`, `sectionRef`, `pinRef`, `videoRef`, and `MidSectionMotion` are used consistently. The import path in Task 4 (`@/components/sections/MidSectionMotion`) matches the file created in Task 3 (`src/components/sections/MidSectionMotion.tsx`). The named export `MidSectionMotion` from Task 3 matches the named import in Task 4.
