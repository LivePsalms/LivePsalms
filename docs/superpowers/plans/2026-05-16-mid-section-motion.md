# Mid-Section Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pinned, scroll-scrubbed mid-section between the verse "Psalm 23:2-3" (inside Hero) and PurposeGrid, where a full-bleed video animation plays frame-by-frame as the user scrolls, with five poetic text beats sequenced as a slideshow on top via kiss-handoff transitions.

**Architecture:** One new component `MidSectionMotion.tsx` with a sticky 100vh stage inside a 500vh outer wrapper, driven by a single GSAP timeline whose `scrollTrigger` pins the stage and scrubs across `scrollTrigger.start = 'top top'` to `scrollTrigger.end = 'bottom bottom'`. The timeline drives `video.currentTime` linearly across all 241 frames and runs per-beat opacity/translateY tweens at positions defined by `MID_SECTION_PIN_TIMING`. Reduced-motion users get a static-poster + stacked beats path that never creates ScrollTrigger or downloads the video. Spec: `docs/superpowers/specs/2026-05-16-mid-section-motion-redesign.md`.

**Tech Stack:** React 18 + TypeScript, Vite, GSAP + ScrollTrigger (already in deps), Vitest for unit tests, ffmpeg (one-time, for poster extraction).

---

## Spec deviations (read before executing)

Two intentional deviations from the approved spec, both to match the codebase convention. Stop and flag with the user before proceeding if either is unwanted.

1. **GSAP timeline instead of raw `onUpdate` callback.** Spec YAGNI item said "no GSAP timeline; one `onUpdate` with arithmetic is simpler." But the Hero bridge (the closest analog in the same codebase) uses a GSAP timeline with `tl.to()` per beat. Using a different mechanism here would be inconsistency for inconsistency's sake. End behavior is identical; the plan uses the GSAP timeline pattern.
2. **Sequential kiss-handoff (Hero's literal pattern), not overlapping crossfade.** Spec described kiss-handoff as "both beats at 0.5 at the boundary midpoint." But Hero's actual pattern (see `hero-bridge-content.ts:14-18` and the "Kiss handoff" comment) is sequential: text N finishes its exit fade exactly when text N+1 begins its enter fade, so `text(N+1).enter === text(N).exit`. The plan uses Hero's exact convention. Visual difference is minimal at `scrub: 2` smoothing; consistency win is large.

If you want either deviation overridden, push back now and I'll rewrite the affected tasks.

---

## File Structure

**New files:**
- `src/components/sections/MidSectionMotion.tsx` — the component (full-motion path + reduced-motion fallback path in one file, picked by `prefersReducedMotion` flag at render time, mirroring Hero.tsx convention).
- `src/components/sections/mid-section-motion-content.ts` — content + timing constants: `BEATS` (the 5 strings), `MID_SECTION_PIN_TIMING` (5 beat windows), `MID_SECTION_VIDEO_DURATION` (10.041667 s).
- `src/components/sections/mid-section-motion-content.test.ts` — Vitest unit tests for the constants. Pure data, no DOM, no GSAP. (Parallel to `hero-bridge-content.test.ts`.)
- `public/mid-section-poster.jpg` — single static frame from the video for reduced-motion users (~30 KB target).

**Modified files:**
- `src/index.css` — add `--app-bg-rgb`, `--mid-section-scrim-opacity` to `:root`; add new rules `.mid-section-stage`, `.mid-section-video`, `.mid-section-scrim`, `.mid-section-beats`, `.mid-section-beat`, plus the reduced-motion stack rules.
- `src/App.tsx` — insert `<MidSectionMotion />` between `</WaterRipple>` and `<PurposeGrid />` on the home route.

**Untouched (by guarantee):** Hero.tsx, PurposeGrid.tsx, Footer, Header, WaterRipple, SplitTransition, grain overlay, route transitions, hooks. Anything not in the "Modified files" list above stays as-is.

---

### Task 1: Extract the static poster JPG

**Files:**
- Create: `public/mid-section-poster.jpg`

This is a one-time asset extraction. Output is committed to the repo.

- [ ] **Step 1: Verify ffmpeg is installed**

Run: `which ffmpeg && ffmpeg -version | head -1`
Expected: A path on stdout (e.g., `/opt/homebrew/bin/ffmpeg`) and a version line. If `ffmpeg` is not installed, run `brew install ffmpeg` first.

- [ ] **Step 2: Verify the source video exists**

Run: `ls -lh public/mid-section-video.mp4`
Expected: `~9.0M` file at that path.

- [ ] **Step 3: Extract frame at the 5-second mark (≈ frame 121 of 241)**

Run (from repo root):
```bash
ffmpeg -ss 5 -i public/mid-section-video.mp4 -vframes 1 -q:v 3 -y public/mid-section-poster.jpg
```

Flags:
- `-ss 5` seek to 5 s before decoding (fast)
- `-vframes 1` write exactly one frame
- `-q:v 3` JPEG quality scale (lower = better; 2-5 is the typical "high quality" band)
- `-y` overwrite without prompting

- [ ] **Step 4: Verify the output**

Run: `ls -lh public/mid-section-poster.jpg && file public/mid-section-poster.jpg`
Expected: A file `< 100 KB` (likely ~25-40 KB) of type "JPEG image data". If file is > 200 KB, retry with `-q:v 5` to bring it down.

- [ ] **Step 5: Commit**

```bash
git add public/mid-section-poster.jpg
git commit -m "chore(public): add mid-section poster JPG for reduced-motion fallback"
```

---

### Task 2: Add CSS custom properties for the scrim

**Files:**
- Modify: `src/index.css` (the `:root` block in `@layer base`, near line 72)

We need two new CSS variables: `--app-bg-rgb` (the RGB triplet of `--app-bg`'s `#988F80`, for use in `rgba()`), and `--mid-section-scrim-opacity` (single-knob tuning for the legibility scrim).

- [ ] **Step 1: Read the current `:root` block to find the right insertion point**

Read: `src/index.css` lines 70-85. Confirm `--app-bg: #988F80;` is at line 75.

- [ ] **Step 2: Add the two new variables immediately after `--app-bg`**

In `src/index.css`, after the line `--app-bg: #988F80;`, add:

```css
    --app-bg: #988F80;
    --app-bg-rgb: 152, 143, 128;   /* RGB triplet of --app-bg for use in rgba() */
    --mid-section-scrim-opacity: 1; /* Tunable knob for mid-section legibility scrim (0 = no scrim) */
```

(Keep the existing `--app-bg` line; only insert the two new lines after it.)

- [ ] **Step 3: Verify the build still compiles**

Run: `npm run build`
Expected: PASS — `vite build` succeeds with no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat(theme): add --app-bg-rgb and --mid-section-scrim-opacity custom properties"
```

---

### Task 3: Content module — TDD the BEATS strings

**Files:**
- Create: `src/components/sections/mid-section-motion-content.test.ts`
- Create: `src/components/sections/mid-section-motion-content.ts`

TDD cycle 1: get the five beat strings under test before writing them.

- [ ] **Step 1: Write the failing test file**

Create `src/components/sections/mid-section-motion-content.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { BEATS } from './mid-section-motion-content';

describe('BEATS', () => {
  it('exports exactly five beats', () => {
    expect(BEATS).toHaveLength(5);
  });

  it('beat 1 — release the weight', () => {
    expect(BEATS[0]).toBe(
      'This is a digital space to release the weight of the day, breathe, and reset before life asks anything more of you.',
    );
  });

  it('beat 2 — slow finding of your way back', () => {
    expect(BEATS[1]).toBe(
      'A slow finding of your way back to the wholeness — body, mind, spirit — that has been waiting for you the whole time.',
    );
  });

  it('beat 3 — a single thought long enough', () => {
    expect(BEATS[2]).toBe(
      'A space that holds a single thought long enough for it to become a prayer — and for the prayer to become a record of what God is teaching you.',
    );
  });

  it('beat 4 — reconnect', () => {
    expect(BEATS[3]).toBe(
      'Reconnect with yourself. With the One who has been waiting. The threshold between the noise and the sanctuary that has always lived inside you.',
    );
  });

  it('beat 5 — no matter what', () => {
    expect(BEATS[4]).toBe(
      "No matter what the day is doing. No matter what the news is doing. The peace you've been looking for isn't out there. It's a room inside you have the capability to return to, anytime.",
    );
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- mid-section-motion-content`
Expected: FAIL with a module-not-found error pointing at `./mid-section-motion-content`.

- [ ] **Step 3: Create the minimal content module to satisfy the BEATS tests**

Create `src/components/sections/mid-section-motion-content.ts`:

```ts
// Five-beat meditative slideshow shown over the scrubbed mid-section video.
// Same italic Cormorant voice as the Hero bridge and the Psalm 23:2-3 verse —
// this section is spiritually a continuation of the bridge, past the verse.
export const BEATS = [
  'This is a digital space to release the weight of the day, breathe, and reset before life asks anything more of you.',
  'A slow finding of your way back to the wholeness — body, mind, spirit — that has been waiting for you the whole time.',
  'A space that holds a single thought long enough for it to become a prayer — and for the prayer to become a record of what God is teaching you.',
  'Reconnect with yourself. With the One who has been waiting. The threshold between the noise and the sanctuary that has always lived inside you.',
  "No matter what the day is doing. No matter what the news is doing. The peace you've been looking for isn't out there. It's a room inside you have the capability to return to, anytime.",
] as const;
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- mid-section-motion-content`
Expected: PASS — 6 tests passing in the `BEATS` describe block.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/mid-section-motion-content.ts src/components/sections/mid-section-motion-content.test.ts
git commit -m "feat(mid-section): add BEATS content constant with unit tests"
```

---

### Task 4: Content module — TDD the timing constants

**Files:**
- Modify: `src/components/sections/mid-section-motion-content.test.ts`
- Modify: `src/components/sections/mid-section-motion-content.ts`

TDD cycle 2: lock down the five beats' timing windows + the kiss-handoff invariants. Shape mirrors `BRIDGE_PIN_TIMING` exactly. Beat windows divide [0,1] into five 0.20-wide slots; within each slot, 0.04 enter + 0.12 hold + 0.04 exit.

- [ ] **Step 1: Append the failing timing tests to the test file**

Add to `src/components/sections/mid-section-motion-content.test.ts`:

```ts
import { MID_SECTION_PIN_TIMING } from './mid-section-motion-content';

describe('MID_SECTION_PIN_TIMING', () => {
  describe('beat1', () => {
    it('enters at the start of the timeline', () => {
      expect(MID_SECTION_PIN_TIMING.beat1.enter).toBe(0);
    });
    it('reaches full opacity at 0.04', () => {
      expect(MID_SECTION_PIN_TIMING.beat1.holdStart).toBe(0.04);
    });
    it('begins exit fade at 0.16', () => {
      expect(MID_SECTION_PIN_TIMING.beat1.holdEnd).toBe(0.16);
    });
    it('completes exit at 0.20 (kiss handoff to beat2)', () => {
      expect(MID_SECTION_PIN_TIMING.beat1.exit).toBe(0.20);
    });
  });

  describe('beat2', () => {
    it('enters at 0.20 (kissing beat1 exit)', () => {
      expect(MID_SECTION_PIN_TIMING.beat2.enter).toBe(0.20);
    });
    it('reaches full opacity at 0.24', () => {
      expect(MID_SECTION_PIN_TIMING.beat2.holdStart).toBe(0.24);
    });
    it('begins exit fade at 0.36', () => {
      expect(MID_SECTION_PIN_TIMING.beat2.holdEnd).toBe(0.36);
    });
    it('completes exit at 0.40 (kiss handoff to beat3)', () => {
      expect(MID_SECTION_PIN_TIMING.beat2.exit).toBe(0.40);
    });
  });

  describe('beat3', () => {
    it('enters at 0.40 (kissing beat2 exit)', () => {
      expect(MID_SECTION_PIN_TIMING.beat3.enter).toBe(0.40);
    });
    it('reaches full opacity at 0.44', () => {
      expect(MID_SECTION_PIN_TIMING.beat3.holdStart).toBe(0.44);
    });
    it('begins exit fade at 0.56', () => {
      expect(MID_SECTION_PIN_TIMING.beat3.holdEnd).toBe(0.56);
    });
    it('completes exit at 0.60 (kiss handoff to beat4)', () => {
      expect(MID_SECTION_PIN_TIMING.beat3.exit).toBe(0.60);
    });
  });

  describe('beat4', () => {
    it('enters at 0.60 (kissing beat3 exit)', () => {
      expect(MID_SECTION_PIN_TIMING.beat4.enter).toBe(0.60);
    });
    it('reaches full opacity at 0.64', () => {
      expect(MID_SECTION_PIN_TIMING.beat4.holdStart).toBe(0.64);
    });
    it('begins exit fade at 0.76', () => {
      expect(MID_SECTION_PIN_TIMING.beat4.holdEnd).toBe(0.76);
    });
    it('completes exit at 0.80 (kiss handoff to beat5)', () => {
      expect(MID_SECTION_PIN_TIMING.beat4.exit).toBe(0.80);
    });
  });

  describe('beat5', () => {
    it('enters at 0.80 (kissing beat4 exit)', () => {
      expect(MID_SECTION_PIN_TIMING.beat5.enter).toBe(0.80);
    });
    it('reaches full opacity at 0.84', () => {
      expect(MID_SECTION_PIN_TIMING.beat5.holdStart).toBe(0.84);
    });
    it('begins exit fade at 0.96', () => {
      expect(MID_SECTION_PIN_TIMING.beat5.holdEnd).toBe(0.96);
    });
    it('completes exit at 1.0 (end of pin)', () => {
      expect(MID_SECTION_PIN_TIMING.beat5.exit).toBe(1.0);
    });
  });

  it('uses kiss-handoff: beat2 enters exactly where beat1 exits', () => {
    expect(MID_SECTION_PIN_TIMING.beat2.enter).toBe(MID_SECTION_PIN_TIMING.beat1.exit);
  });
  it('uses kiss-handoff: beat3 enters exactly where beat2 exits', () => {
    expect(MID_SECTION_PIN_TIMING.beat3.enter).toBe(MID_SECTION_PIN_TIMING.beat2.exit);
  });
  it('uses kiss-handoff: beat4 enters exactly where beat3 exits', () => {
    expect(MID_SECTION_PIN_TIMING.beat4.enter).toBe(MID_SECTION_PIN_TIMING.beat3.exit);
  });
  it('uses kiss-handoff: beat5 enters exactly where beat4 exits', () => {
    expect(MID_SECTION_PIN_TIMING.beat5.enter).toBe(MID_SECTION_PIN_TIMING.beat4.exit);
  });

  it('every beat has enter ≤ holdStart < holdEnd ≤ exit', () => {
    for (const key of ['beat1', 'beat2', 'beat3', 'beat4', 'beat5'] as const) {
      const b = MID_SECTION_PIN_TIMING[key];
      expect(b.enter).toBeLessThanOrEqual(b.holdStart);
      expect(b.holdStart).toBeLessThan(b.holdEnd);
      expect(b.holdEnd).toBeLessThanOrEqual(b.exit);
    }
  });

  it('first beat enter is 0; last beat exit is 1.0', () => {
    expect(MID_SECTION_PIN_TIMING.beat1.enter).toBe(0);
    expect(MID_SECTION_PIN_TIMING.beat5.exit).toBe(1.0);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- mid-section-motion-content`
Expected: FAIL — TypeScript error or runtime error on the `MID_SECTION_PIN_TIMING` import (the export does not exist yet).

- [ ] **Step 3: Add the timing constant to the content module**

Append to `src/components/sections/mid-section-motion-content.ts`:

```ts
// GSAP timeline progress points for the pinned mid-section stage.
// Mirrors the BRIDGE_PIN_TIMING shape exactly. Each beat has:
//   enter      — when its enter tween starts (opacity 0→1, y 20→0)
//   holdStart  — when it reaches full opacity at resting position
//   holdEnd    — when its exit tween starts (opacity 1→0, y 0→−20)
//   exit       — when it has fully exited
// Kiss handoff: beatN.exit === beatN+1.enter, so beat N+1's enter tween
// starts exactly as beat N's exit tween finishes — back-to-back, never a gap.
export const MID_SECTION_PIN_TIMING = {
  beat1: { enter: 0,    holdStart: 0.04, holdEnd: 0.16, exit: 0.20 },
  beat2: { enter: 0.20, holdStart: 0.24, holdEnd: 0.36, exit: 0.40 },
  beat3: { enter: 0.40, holdStart: 0.44, holdEnd: 0.56, exit: 0.60 },
  beat4: { enter: 0.60, holdStart: 0.64, holdEnd: 0.76, exit: 0.80 },
  beat5: { enter: 0.80, holdStart: 0.84, holdEnd: 0.96, exit: 1.00 },
} as const;
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- mid-section-motion-content`
Expected: PASS — all 30 tests (6 from Task 3 + 24 new) passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/mid-section-motion-content.ts src/components/sections/mid-section-motion-content.test.ts
git commit -m "feat(mid-section): add MID_SECTION_PIN_TIMING constant with kiss-handoff invariants"
```

---

### Task 5: Content module — TDD the video duration constant

**Files:**
- Modify: `src/components/sections/mid-section-motion-content.test.ts`
- Modify: `src/components/sections/mid-section-motion-content.ts`

TDD cycle 3: add the exact video duration so the timeline tween of `video.currentTime` matches the asset perfectly. Value is from `ffprobe` output (10.041667 s for the current asset).

- [ ] **Step 1: Append the failing duration test**

Add to `src/components/sections/mid-section-motion-content.test.ts`:

```ts
import { MID_SECTION_VIDEO_DURATION } from './mid-section-motion-content';

describe('MID_SECTION_VIDEO_DURATION', () => {
  it('matches the source video duration in seconds (from ffprobe)', () => {
    expect(MID_SECTION_VIDEO_DURATION).toBeCloseTo(10.041667, 5);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- mid-section-motion-content`
Expected: FAIL on the `MID_SECTION_VIDEO_DURATION` import.

- [ ] **Step 3: Add the constant**

Append to `src/components/sections/mid-section-motion-content.ts`:

```ts
// Exact duration in seconds of public/mid-section-video.mp4 per ffprobe.
// Used as the end-value for the GSAP currentTime tween so scroll progress
// 0..1 maps to a clean 0..duration scrub across all 241 frames at 24 fps.
// If the asset is re-encoded, update this value to match the new ffprobe output.
export const MID_SECTION_VIDEO_DURATION = 10.041667;
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- mid-section-motion-content`
Expected: PASS — 31 tests passing total.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/mid-section-motion-content.ts src/components/sections/mid-section-motion-content.test.ts
git commit -m "feat(mid-section): add MID_SECTION_VIDEO_DURATION constant"
```

---

### Task 6: Add CSS rules for stage, video, scrim, and beats

**Files:**
- Modify: `src/index.css` (append after the existing bridge typography block, near line 330)

All visual rules for the mid-section live in one block in the global stylesheet, alongside the bridge rules. No CSS modules.

- [ ] **Step 1: Find the insertion point**

Read `src/index.css` around line 326-340. Find the end of the bridge rules (`@media (min-width: 768px) { .bridge-beat-left { ... } .bridge-beat-right { ... } }`). The new block goes immediately after that closing `}`.

- [ ] **Step 2: Append the mid-section CSS block**

Add to `src/index.css` immediately after the bridge rules:

```css
/* ───── Mid-section motion (scroll-scrubbed video + 5 text beats) ─────
   Renders between the Psalm 23:2-3 verse and PurposeGrid on the home route.
   Architecture: 500vh outer wrapper defines pin distance; 100vh sticky stage
   stays glued to viewport during the pin; video and beats are positioned
   absolutely within the stage. */

.mid-section-wrapper {
  position: relative;
  height: 500vh;
  background: var(--app-bg);
}

.mid-section-stage {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
  background: var(--app-bg); /* shown until the video has its first frame */
}

.mid-section-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  pointer-events: none;
}

.mid-section-scrim {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    rgba(var(--app-bg-rgb), 0)    0%,
    rgba(var(--app-bg-rgb), 0.18) 60%,
    rgba(var(--app-bg-rgb), 0.32) 100%
  );
  opacity: var(--mid-section-scrim-opacity, 1);
  pointer-events: none;
}

.mid-section-beats {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.mid-section-beat {
  /* Family inherits from Hero bridge — same italic Cormorant voice. */
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-style: italic;
  color: var(--deep-umber);

  /* Departures from bridge type ramp for sustained prose reading. */
  font-size: clamp(22px, 3.4vw, 36px);
  line-height: 1.5;
  max-width: 680px;

  /* Absolute-center on the stage. GSAP tweens y and opacity from there. */
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  padding: 0 24px;
  margin: 0;

  /* Initial state — invisible until GSAP's first tick. */
  opacity: 0;
  will-change: opacity, transform;
}

/* ───── Reduced-motion fallback: no pin, no scrub, stacked beats ───── */
.mid-section-reduced {
  position: relative;
  background: var(--app-bg);
}

.mid-section-reduced-block {
  position: relative;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.mid-section-reduced-poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  pointer-events: none;
}

.mid-section-reduced-beat {
  position: relative;
  z-index: 1;
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-style: italic;
  color: var(--deep-umber);
  font-size: clamp(22px, 3.4vw, 36px);
  line-height: 1.5;
  max-width: 680px;
  text-align: center;
  padding: 0 24px;
  margin: 0;
  opacity: 0;
  transition: opacity 600ms ease-out;
}

.mid-section-reduced-beat[data-visible='true'] {
  opacity: 1;
}
```

- [ ] **Step 3: Build to verify CSS validity**

Run: `npm run build`
Expected: PASS — no CSS or TS errors.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat(mid-section): add CSS for pinned stage, video, scrim, beats, and reduced-motion fallback"
```

---

### Task 7: Create the MidSectionMotion component

**Files:**
- Create: `src/components/sections/MidSectionMotion.tsx`

The full component. Handles both the motion path (GSAP timeline + pin + scrub) and the reduced-motion fallback (static poster + IntersectionObserver fades) by switching on `prefersReducedMotion`. No unit test for the component itself — same convention as Hero.tsx (the testable logic lives in the content module, which already has full coverage).

The component's structure mirrors Hero's bridge cascade `useEffect` pattern (Hero.tsx:118-202) but with one timeline driving both video.currentTime and five beats, plus a reduced-motion early-return path.

- [ ] **Step 1: Create the component file**

Create `src/components/sections/MidSectionMotion.tsx`:

```tsx
import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  BEATS,
  MID_SECTION_PIN_TIMING,
  MID_SECTION_VIDEO_DURATION,
} from './mid-section-motion-content';

gsap.registerPlugin(ScrollTrigger);

const TIMING = [
  MID_SECTION_PIN_TIMING.beat1,
  MID_SECTION_PIN_TIMING.beat2,
  MID_SECTION_PIN_TIMING.beat3,
  MID_SECTION_PIN_TIMING.beat4,
  MID_SECTION_PIN_TIMING.beat5,
] as const;

export function MidSectionMotion() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const beatRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  // Reduced-motion path uses a separate set of refs to keep the two paths cleanly isolated.
  const reducedBeatRefs = useRef<Array<HTMLParagraphElement | null>>([]);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  /* ── Full-motion path: pinned, scrubbed video + 5-beat slideshow ── */
  useEffect(() => {
    if (prefersReducedMotion) return;

    const wrapperEl = wrapperRef.current;
    const stageEl = stageRef.current;
    const videoEl = videoRef.current;
    const beatEls = beatRefs.current.slice(0, 5);
    if (!wrapperEl || !stageEl || !videoEl || beatEls.some((b) => !b)) return;

    const ctx = gsap.context(() => {
      // Initial states — beats hidden and offset below resting position; video at frame 0.
      gsap.set(beatEls, { opacity: 0, y: 20 });
      videoEl.currentTime = 0;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapperEl,
          start: 'top top',
          end: 'bottom bottom',
          pin: stageEl,
          scrub: 2,
          invalidateOnRefresh: true,
        },
      });

      // Video scrub — single continuous tween of currentTime across the entire timeline.
      // GSAP tweens any numeric property; videoEl.currentTime ramps 0 → duration linearly.
      tl.to(
        videoEl,
        { currentTime: MID_SECTION_VIDEO_DURATION, ease: 'none', duration: 1 },
        0,
      );

      // Per-beat enter / exit tweens at MID_SECTION_PIN_TIMING positions.
      TIMING.forEach((t, i) => {
        const beat = beatEls[i];
        if (!beat) return;

        // Enter tween — fade in + rise from y:20 to y:0. Skip if enter === holdStart (no entry window).
        if (t.enter < t.holdStart) {
          tl.to(
            beat,
            { opacity: 1, y: 0, ease: 'power2.out', duration: t.holdStart - t.enter },
            t.enter,
          );
        } else {
          // No entry window — beat starts at full opacity at progress 0 (i.e., beat 1 only).
          tl.set(beat, { opacity: 1, y: 0 }, t.enter);
        }

        // Exit tween — fade out + lift to y:−20. Skip if holdEnd === exit (no exit window).
        if (t.holdEnd < t.exit) {
          tl.to(
            beat,
            { opacity: 0, y: -20, ease: 'power1.in', duration: t.exit - t.holdEnd },
            t.holdEnd,
          );
        }
      });
    }, wrapperEl);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  /* ── Reduced-motion fallback: IntersectionObserver fades on five stacked blocks ── */
  useEffect(() => {
    if (!prefersReducedMotion) return;

    const blocks = reducedBeatRefs.current.filter(
      (el): el is HTMLParagraphElement => el !== null,
    );
    if (blocks.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.visible = 'true';
          }
        }
      },
      { threshold: 0.4 },
    );

    for (const block of blocks) observer.observe(block);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  // ─── Reduced-motion JSX: five stacked blocks with poster + beat, no pin, no video element ───
  if (prefersReducedMotion) {
    return (
      <section className="mid-section-reduced" aria-label="Reflection">
        {BEATS.map((text, i) => (
          <div key={i} className="mid-section-reduced-block">
            <img
              src="/mid-section-poster.jpg"
              alt=""
              aria-hidden="true"
              className="mid-section-reduced-poster"
            />
            <p
              ref={(el) => {
                reducedBeatRefs.current[i] = el;
              }}
              className="mid-section-reduced-beat"
            >
              {text}
            </p>
          </div>
        ))}
      </section>
    );
  }

  // ─── Full-motion JSX: 500vh wrapper, sticky 100vh stage, full-bleed video + 5 absolute-centered beats ───
  return (
    <section
      ref={wrapperRef}
      className="mid-section-wrapper"
      aria-label="Reflection"
    >
      <div ref={stageRef} className="mid-section-stage">
        <video
          ref={videoRef}
          src="/mid-section-video.mp4"
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          disablePictureInPicture
          disableRemotePlayback
          className="mid-section-video"
        />
        <div className="mid-section-scrim" aria-hidden="true" />
        <div className="mid-section-beats">
          {BEATS.map((text, i) => (
            <p
              key={i}
              ref={(el) => {
                beatRefs.current[i] = el;
              }}
              className="mid-section-beat"
            >
              {text}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: PASS — `tsc -b` succeeds, `vite build` succeeds, no errors. Common issues to fix if they surface:
- If `disablePictureInPicture` or `disableRemotePlayback` aren't recognized as `<video>` attributes by your TS config, lowercase them (`disableremoteplayback`) or remove them — they're nice-to-have, not required.

- [ ] **Step 3: Verify all existing tests still pass**

Run: `npm test`
Expected: PASS — including all `mid-section-motion-content.test.ts` tests from Tasks 3-5.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/MidSectionMotion.tsx
git commit -m "feat(mid-section): add MidSectionMotion component with GSAP-driven scrub and reduced-motion fallback"
```

---

### Task 8: Wire MidSectionMotion into App.tsx

**Files:**
- Modify: `src/App.tsx` (lines 6-10 for the import; line 128-129 for the JSX insertion)

Insert the component into the home route only, between `</WaterRipple>` (which wraps Hero) and `<PurposeGrid />`. Mirrors the slot used by the reverted version.

- [ ] **Step 1: Add the import**

In `src/App.tsx`, in the existing imports block near line 8, add:

```tsx
import { PurposeGrid } from '@/components/sections/PurposeGrid';
import { MidSectionMotion } from '@/components/sections/MidSectionMotion';
import { PurposeGallery } from '@/components/sections/PurposeGallery';
```

(Keep the surrounding imports; only insert the `MidSectionMotion` line. Alphabetical order would put it before `PurposeGallery` and after `Hero`-block imports.)

- [ ] **Step 2: Render the component on the home route**

In `src/App.tsx`, find the home-route `element` (around lines 119-131). The current JSX is:

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

Change to:

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

- [ ] **Step 3: Verify TypeScript and build still pass**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Verify all tests still pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): render MidSectionMotion between Hero and PurposeGrid on home route"
```

---

### Task 9: Manual browser verification

**Files:** none modified — verification only.

Run the dev server and confirm the section behaves per the acceptance criteria in the spec. Fix any deviations before merging.

- [ ] **Step 1: Start the dev server**

Run (in a separate terminal you can leave running): `npm run dev`
Expected: Vite prints a local URL (typically `http://localhost:5173`).

- [ ] **Step 2: Open the home route in Chrome and visually verify the scroll sequence**

Open the URL printed by Vite. Skip past the Hero intro if it plays. Slowly scroll past the verse "Psalm 23:2-3" and into the new section. Verify each acceptance criterion from the spec:

1. **Beat 1 visible at the start of the pin.** As soon as the section pins, beat 1's text is on screen at full opacity.
2. **Each beat fully visible during its primary window.** Scroll roughly 1/5 of the pin distance at a time. Beats 1 → 2 → 3 → 4 → 5 appear in order, each crisply readable at its primary window.
3. **Sequential kiss-handoff between beats.** At each boundary (roughly 0.20, 0.40, 0.60, 0.80 of the pin), the previous beat finishes fading out exactly as the next beat begins fading in — back-to-back, never with a long empty stage.
4. **Video scrubs in lockstep with scroll.** Watch the video as you scroll; the frame should advance smoothly with no stuck frames or skipped jumps at trackpad speed. (If Safari is choppy, see Task 10.)
5. **Reverse scroll plays the video and beats backward.** Scroll up; both video frame and beat sequence reverse cleanly. No stuck states.
6. **Pin releases at the end and PurposeGrid flows in.** When beat 5 fully appears and you keep scrolling, the section unpins and PurposeGrid appears below with no jump.

- [ ] **Step 3: Verify reduced-motion in Chrome DevTools**

In Chrome DevTools → Command Menu (Cmd+Shift+P) → "Show Rendering" → set "Emulate CSS media feature prefers-reduced-motion" to "reduce". Reload the page. Verify:

1. Five stacked viewports each show the static poster image with one beat overlaid.
2. As you scroll each block into view, the beat text fades in.
3. **Open the Network tab and filter for `.mp4`.** Verify there is zero request for `mid-section-video.mp4` — the reduced-motion path must not download the video.
4. Inspect the DOM. The `<video>` element should not be in the tree on the reduced-motion path.

Reset the reduced-motion emulation to "No emulation" before continuing.

- [ ] **Step 4: Verify Safari scrub quality**

Open the same dev URL in Safari (desktop). Scroll through the section. Watch the video.

- If scrubbing is smooth (frame appears to advance smoothly with the scroll wheel), no further action — proceed to Step 5.
- If scrubbing is **choppy** (the frame snaps in chunks rather than advancing smoothly), continue to Task 10 to re-encode the video with denser keyframes.

- [ ] **Step 5: Verify iOS Safari scrub quality (real device)**

If you have an iPhone/iPad on the same network: visit the dev URL (something like `http://<your-mac's-local-IP>:5173`) in mobile Safari. Repeat the scrub check. Same disposition: smooth → proceed; choppy → Task 10.

- [ ] **Step 6: Verify keyboard accessibility**

With the dev URL open, press Tab repeatedly from the top of the page. Confirm that:
1. Focus moves through Header → through Hero's focusable elements → past the mid-section without trapping → into PurposeGrid links.
2. The mid-section does NOT capture focus (the video is `aria-hidden`, the beats are non-interactive `<p>` elements).

- [ ] **Step 7: Run Lighthouse accessibility audit (optional but recommended)**

In Chrome DevTools → Lighthouse → check "Accessibility" only → "Analyze page load".
Expected: Score remains in the same range it was before this change. No new accessibility issues flagged on the mid-section.

- [ ] **Step 8: Stop the dev server**

Stop the `npm run dev` process you started in Step 1 (Ctrl+C in that terminal).

(No commit for this task — it's verification only. Any bugs found here go back to the relevant Task as fixups.)

---

### Task 10 (contingent): Re-encode video for keyframe density

**Files:** Modify `public/mid-section-video.mp4` (in place).

**Run this task only if Task 9 Step 4 or Step 5 reported choppy scrub in Safari.** Default `ffmpeg` MP4 encoding places keyframes ~once per second. Safari can only seek to keyframes during `currentTime` updates, so non-keyframe seeks look like "ticks" rather than smooth scrub. Re-encoding with one keyframe per frame fixes it at the cost of ~30 % more file size.

- [ ] **Step 1: Re-encode in place via a temp file**

Run (from repo root):
```bash
ffmpeg -i public/mid-section-video.mp4 \
  -c:v libx264 -g 1 -keyint_min 1 -bf 0 -movflags +faststart \
  -an -y public/mid-section-video.scrub.mp4 \
  && mv public/mid-section-video.scrub.mp4 public/mid-section-video.mp4
```

Flags:
- `-c:v libx264` H.264 codec (matches original)
- `-g 1 -keyint_min 1` keyframe every frame
- `-bf 0` no B-frames (B-frames break scrub direction)
- `-movflags +faststart` move metadata to file head so streaming starts immediately
- `-an` strip audio (the source has no audio, but be explicit)

- [ ] **Step 2: Verify the new file**

Run: `ffprobe -v error -show_entries stream=width,height,r_frame_rate,nb_frames,duration -show_entries format=duration,size -of default=noprint_wrappers=1 public/mid-section-video.mp4`
Expected: Same dimensions (1928×1076), same frame rate (24/1), same `nb_frames` (241), same `duration` (~10.041667), file size ~12-13 MB (up from 9.35 MB).

- [ ] **Step 3: If duration changed, update the constant**

If ffprobe reports a duration that differs from `10.041667` by more than `0.001`, update `MID_SECTION_VIDEO_DURATION` in `src/components/sections/mid-section-motion-content.ts` to match, and update the matching test in `mid-section-motion-content.test.ts`. Run `npm test` to confirm.

- [ ] **Step 4: Re-verify scrub in Safari**

Repeat Task 9 Step 4 and Step 5 with the re-encoded asset. Confirm scrub is now smooth.

- [ ] **Step 5: Commit**

```bash
git add public/mid-section-video.mp4
git commit -m "chore(public): re-encode mid-section video with per-frame keyframes for Safari scrub"
```

(If Step 3 also required content-module changes, include them in the same commit.)

---

## Final verification

After all tasks above are committed and any contingent Task 10 work is done:

- [ ] Run the full test suite once more: `npm test` — all tests pass.
- [ ] Run `npm run build` — production build succeeds.
- [ ] Run `npm run lint` — no new lint errors.
- [ ] Inspect git log: confirm the commits land in a logical sequence (poster, CSS vars, content, CSS rules, component, app wiring, optional re-encode).
- [ ] Confirm no files were modified that weren't in the "Modified files" list at the top: `git diff main..HEAD --name-only` lists only the files in the File Structure section.
