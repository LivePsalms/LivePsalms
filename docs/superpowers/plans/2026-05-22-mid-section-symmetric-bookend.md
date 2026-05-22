# Mid-Section Symmetric Bookend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mid-section's asymmetric overture + independent FPS wake-up with a matched 100vh intro / outro pair where brightness and FPS move together on the same cubic ease-in, framing a calm 500vh reading window.

**Architecture:** Extract intensity math (constants + easing + per-progress state computation + beat-position mapping) into a new pure module `mid-section-intensity.ts` to enable TDD with vitest, matching the existing pattern of `mid-section-motion-content.ts`. The React component [src/components/sections/MidSectionMotion.tsx](src/components/sections/MidSectionMotion.tsx) becomes a thin shell that wires the pure helpers to a single intensity ScrollTrigger. WebGPU wrapper height grows from 600vh → 700vh (intro 100 + reading 500 + outro 100); video and reduced-motion paths unchanged.

**Tech Stack:** TypeScript, React 19, GSAP 3 (ScrollTrigger), Three.js WebGPU, Vite, Vitest.

**Spec:** [docs/superpowers/specs/2026-05-22-mid-section-symmetric-bookend-design.md](docs/superpowers/specs/2026-05-22-mid-section-symmetric-bookend-design.md)

---

## File Structure

- **Create:** `src/components/sections/mid-section-intensity.ts` — pure module exporting the band-edge constants, intensity endpoint values, `easeInCubic`, `computeIntensityState`, and `mapBeatProgressWebGPU`. Single source of truth for the bookend math.
- **Create:** `src/components/sections/mid-section-intensity.test.ts` — vitest tests against the pure helpers, mirroring the style of `mid-section-motion-content.test.ts`.
- **Modify:** [src/components/sections/MidSectionMotion.tsx](src/components/sections/MidSectionMotion.tsx) — remove the in-file constants and `wakeUpFps` function, import everything from the new module, rewrite the intensity ScrollTrigger's `onUpdate` to call `computeIntensityState`, branch beat-tween positions on `renderMode` (WebGPU uses `mapBeatProgressWebGPU`, video uses raw), bump WebGPU wrapper height to 700vh.
- **Modify:** [src/components/sections/mid-section-motion-content.ts](src/components/sections/mid-section-motion-content.ts) — update the comment on `MID_SECTION_PIN_TIMING` to note that the WebGPU consumer offsets/scales these into the reading band.

The decomposition keeps three single-responsibility modules: **content** (what to say + reading-relative timing), **intensity** (how the canvas looks at each progress + how beats map into the reading band), **runtime** (React/GSAP/ScrollTrigger plumbing).

---

## Task 1: Create intensity module — constants, types, and `easeInCubic`

**Files:**
- Create: `src/components/sections/mid-section-intensity.ts`
- Test: `src/components/sections/mid-section-intensity.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/components/sections/mid-section-intensity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  INTRO_END,
  OUTRO_START,
  READING_SCALE,
  FPS_FLOOR,
  FPS_STEADY,
  INTENSITY_BRIGHT,
  INTENSITY_NORMAL,
  easeInCubic,
} from './mid-section-intensity';

describe('band-edge constants', () => {
  it('INTRO_END is 1/7 of the timeline', () => {
    expect(INTRO_END).toBeCloseTo(1 / 7, 10);
  });
  it('OUTRO_START is 6/7 of the timeline', () => {
    expect(OUTRO_START).toBeCloseTo(6 / 7, 10);
  });
  it('READING_SCALE equals OUTRO_START - INTRO_END (5/7)', () => {
    expect(READING_SCALE).toBeCloseTo(5 / 7, 10);
    expect(READING_SCALE).toBeCloseTo(OUTRO_START - INTRO_END, 10);
  });
  it('intro and outro bands are symmetric — same span on either side of reading', () => {
    expect(INTRO_END).toBeCloseTo(1 - OUTRO_START, 10);
  });
});

describe('FPS endpoints', () => {
  it('floor is 3 fps (matches the spec)', () => {
    expect(FPS_FLOOR).toBe(3);
  });
  it('steady is 39 fps (matches the spec)', () => {
    expect(FPS_STEADY).toBe(39);
  });
});

describe('INTENSITY_BRIGHT', () => {
  it('matches the spec endpoints', () => {
    expect(INTENSITY_BRIGHT).toEqual({
      brightness: 3.45,
      bloomStrength: 3.30,
      bloomThreshold: 0.14,
    });
  });
});

describe('INTENSITY_NORMAL', () => {
  it('matches the spec endpoints', () => {
    expect(INTENSITY_NORMAL).toEqual({
      brightness: 1.20,
      bloomStrength: 2.20,
      bloomThreshold: 0.15,
    });
  });
});

describe('easeInCubic', () => {
  it('returns 0 at t=0', () => {
    expect(easeInCubic(0)).toBe(0);
  });
  it('returns 1 at t=1', () => {
    expect(easeInCubic(1)).toBe(1);
  });
  it('returns 0.125 at t=0.5 (cubic ease-in dwells at start)', () => {
    expect(easeInCubic(0.5)).toBeCloseTo(0.125, 10);
  });
  it('is monotonically increasing', () => {
    let prev = easeInCubic(0);
    for (let i = 1; i <= 100; i++) {
      const curr = easeInCubic(i / 100);
      expect(curr).toBeGreaterThanOrEqual(prev);
      prev = curr;
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/sections/mid-section-intensity.test.ts`
Expected: FAIL with "Cannot find module './mid-section-intensity'"

- [ ] **Step 3: Create the module**

Create `src/components/sections/mid-section-intensity.ts`:

```ts
// Pure helpers + constants for the mid-section's symmetric bookend.
// The WebGPU pinned timeline is divided into three bands:
//   intro     p ∈ [0, INTRO_END]            — 100vh, bright + low-fps crawl
//   reading   p ∈ [INTRO_END, OUTRO_START]  — 500vh, normal + steady fps
//   outro    p ∈ [OUTRO_START, 1]           — 100vh, normal+steady → bright+crawl
// Brightness and sim-speed move on the same cubic ease-in within each band,
// so the dramatic end-state lingers and the resolution snaps near the boundary.

import type { CurlLinesIntensity } from './mid-section-webgpu-scene';

/** End of the intro band as a fraction of the pinned timeline (1/7 of 700vh = 100vh). */
export const INTRO_END = 1 / 7;
/** Start of the outro band as a fraction of the pinned timeline. */
export const OUTRO_START = 6 / 7;
/** Width of the reading band (5/7 of the timeline = 500vh). */
export const READING_SCALE = OUTRO_START - INTRO_END;

/** FPS the curl-noise simulation runs at during the bright/dramatic end-state. */
export const FPS_FLOOR = 3;
/** FPS the curl-noise simulation runs at during the calm reading window. */
export const FPS_STEADY = 39;

/** Intensity at the bright/dramatic end-state (pin engage; just before pin release). */
export const INTENSITY_BRIGHT = {
  brightness: 3.45,
  bloomStrength: 3.30,
  bloomThreshold: 0.14,
} as const;

/** Intensity during the calm reading window. */
export const INTENSITY_NORMAL = {
  brightness: 1.20,
  bloomStrength: 2.20,
  bloomThreshold: 0.15,
} as const;

/** Cubic ease-in: slow start, fast finish. Dwells at the start value before snapping. */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/** Field shape the React component assigns onto the live `CurlLinesIntensity` object. */
export type IntensityState = Pick<
  CurlLinesIntensity,
  'brightness' | 'bloomStrength' | 'bloomThreshold' | 'simSpeed'
>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/sections/mid-section-intensity.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/mid-section-intensity.ts src/components/sections/mid-section-intensity.test.ts
git commit -m "feat(mid-section): intensity module — band constants + easeInCubic"
```

---

## Task 2: TDD `computeIntensityState` — all three bands

**Files:**
- Modify: `src/components/sections/mid-section-intensity.ts`
- Modify: `src/components/sections/mid-section-intensity.test.ts`

- [ ] **Step 1: Append failing tests for all three bands**

Append to `src/components/sections/mid-section-intensity.test.ts`:

```ts
import { computeIntensityState } from './mid-section-intensity';

describe('computeIntensityState — intro band', () => {
  it('p=0: brightness/bloom at BRIGHT endpoints', () => {
    const s = computeIntensityState(0);
    expect(s.brightness).toBeCloseTo(INTENSITY_BRIGHT.brightness, 10);
    expect(s.bloomStrength).toBeCloseTo(INTENSITY_BRIGHT.bloomStrength, 10);
    expect(s.bloomThreshold).toBeCloseTo(INTENSITY_BRIGHT.bloomThreshold, 10);
  });

  it('p=0: simSpeed at FPS_FLOOR / 60', () => {
    const s = computeIntensityState(0);
    expect(s.simSpeed).toBeCloseTo(FPS_FLOOR / 60, 10);
  });

  it('p=INTRO_END: brightness/bloom at NORMAL endpoints', () => {
    const s = computeIntensityState(INTRO_END);
    expect(s.brightness).toBeCloseTo(INTENSITY_NORMAL.brightness, 10);
    expect(s.bloomStrength).toBeCloseTo(INTENSITY_NORMAL.bloomStrength, 10);
    expect(s.bloomThreshold).toBeCloseTo(INTENSITY_NORMAL.bloomThreshold, 10);
  });

  it('p=INTRO_END: simSpeed at FPS_STEADY / 60', () => {
    const s = computeIntensityState(INTRO_END);
    expect(s.simSpeed).toBeCloseTo(FPS_STEADY / 60, 10);
  });

  it('p=INTRO_END/2: dwells near BRIGHT (cubic ease-in — only 12.5% of transition done)', () => {
    const s = computeIntensityState(INTRO_END / 2);
    // brightness should be 12.5% of the way from BRIGHT toward NORMAL
    const expected = INTENSITY_BRIGHT.brightness
      + 0.125 * (INTENSITY_NORMAL.brightness - INTENSITY_BRIGHT.brightness);
    expect(s.brightness).toBeCloseTo(expected, 6);
    // simSpeed should be 12.5% of the way from FPS_FLOOR toward FPS_STEADY (then /60)
    const expectedFps = FPS_FLOOR + 0.125 * (FPS_STEADY - FPS_FLOOR);
    expect(s.simSpeed).toBeCloseTo(expectedFps / 60, 6);
  });
});

describe('computeIntensityState — reading band', () => {
  it('p just past INTRO_END: holds at NORMAL', () => {
    const s = computeIntensityState(INTRO_END + 0.001);
    expect(s.brightness).toBeCloseTo(INTENSITY_NORMAL.brightness, 10);
    expect(s.bloomStrength).toBeCloseTo(INTENSITY_NORMAL.bloomStrength, 10);
    expect(s.bloomThreshold).toBeCloseTo(INTENSITY_NORMAL.bloomThreshold, 10);
    expect(s.simSpeed).toBeCloseTo(FPS_STEADY / 60, 10);
  });

  it('p=0.5 (mid-reading): holds at NORMAL', () => {
    const s = computeIntensityState(0.5);
    expect(s.brightness).toBeCloseTo(INTENSITY_NORMAL.brightness, 10);
    expect(s.simSpeed).toBeCloseTo(FPS_STEADY / 60, 10);
  });

  it('p just before OUTRO_START: holds at NORMAL', () => {
    const s = computeIntensityState(OUTRO_START - 0.001);
    expect(s.brightness).toBeCloseTo(INTENSITY_NORMAL.brightness, 10);
    expect(s.simSpeed).toBeCloseTo(FPS_STEADY / 60, 10);
  });
});

describe('computeIntensityState — outro band', () => {
  it('p=OUTRO_START: brightness/bloom at NORMAL endpoints', () => {
    const s = computeIntensityState(OUTRO_START);
    expect(s.brightness).toBeCloseTo(INTENSITY_NORMAL.brightness, 10);
    expect(s.bloomStrength).toBeCloseTo(INTENSITY_NORMAL.bloomStrength, 10);
    expect(s.bloomThreshold).toBeCloseTo(INTENSITY_NORMAL.bloomThreshold, 10);
  });

  it('p=OUTRO_START: simSpeed at FPS_STEADY / 60', () => {
    const s = computeIntensityState(OUTRO_START);
    expect(s.simSpeed).toBeCloseTo(FPS_STEADY / 60, 10);
  });

  it('p=1: brightness/bloom at BRIGHT endpoints', () => {
    const s = computeIntensityState(1);
    expect(s.brightness).toBeCloseTo(INTENSITY_BRIGHT.brightness, 10);
    expect(s.bloomStrength).toBeCloseTo(INTENSITY_BRIGHT.bloomStrength, 10);
    expect(s.bloomThreshold).toBeCloseTo(INTENSITY_BRIGHT.bloomThreshold, 10);
  });

  it('p=1: simSpeed at FPS_FLOOR / 60', () => {
    const s = computeIntensityState(1);
    expect(s.simSpeed).toBeCloseTo(FPS_FLOOR / 60, 10);
  });

  it('p at midpoint of outro band: dwells near NORMAL (cubic ease-in)', () => {
    const midOutro = OUTRO_START + (1 - OUTRO_START) / 2;
    const s = computeIntensityState(midOutro);
    // brightness should be 12.5% of the way from NORMAL toward BRIGHT
    const expected = INTENSITY_NORMAL.brightness
      + 0.125 * (INTENSITY_BRIGHT.brightness - INTENSITY_NORMAL.brightness);
    expect(s.brightness).toBeCloseTo(expected, 6);
    // simSpeed should be 12.5% of the way from FPS_STEADY toward FPS_FLOOR (then /60)
    const expectedFps = FPS_STEADY + 0.125 * (FPS_FLOOR - FPS_STEADY);
    expect(s.simSpeed).toBeCloseTo(expectedFps / 60, 6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/sections/mid-section-intensity.test.ts`
Expected: All new `computeIntensityState` tests fail with "computeIntensityState is not a function" or similar.

- [ ] **Step 3: Implement `computeIntensityState` in the intensity module**

Append to `src/components/sections/mid-section-intensity.ts`:

```ts
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Returns the full canvas intensity state for a given timeline progress.
 *
 * Intro band  (p ∈ [0, INTRO_END])     bright/floor → normal/steady, cubic ease-in.
 * Reading     (p ∈ (INTRO_END, OUTRO_START))  held at normal/steady.
 * Outro band  (p ∈ [OUTRO_START, 1])   normal/steady → bright/floor, cubic ease-in.
 */
export function computeIntensityState(p: number): IntensityState {
  if (p <= INTRO_END) {
    const t = easeInCubic(p / INTRO_END);
    return {
      brightness: lerp(INTENSITY_BRIGHT.brightness, INTENSITY_NORMAL.brightness, t),
      bloomStrength: lerp(INTENSITY_BRIGHT.bloomStrength, INTENSITY_NORMAL.bloomStrength, t),
      bloomThreshold: lerp(INTENSITY_BRIGHT.bloomThreshold, INTENSITY_NORMAL.bloomThreshold, t),
      simSpeed: lerp(FPS_FLOOR, FPS_STEADY, t) / 60,
    };
  }
  if (p >= OUTRO_START) {
    const t = easeInCubic((p - OUTRO_START) / (1 - OUTRO_START));
    return {
      brightness: lerp(INTENSITY_NORMAL.brightness, INTENSITY_BRIGHT.brightness, t),
      bloomStrength: lerp(INTENSITY_NORMAL.bloomStrength, INTENSITY_BRIGHT.bloomStrength, t),
      bloomThreshold: lerp(INTENSITY_NORMAL.bloomThreshold, INTENSITY_BRIGHT.bloomThreshold, t),
      simSpeed: lerp(FPS_STEADY, FPS_FLOOR, t) / 60,
    };
  }
  return {
    brightness: INTENSITY_NORMAL.brightness,
    bloomStrength: INTENSITY_NORMAL.bloomStrength,
    bloomThreshold: INTENSITY_NORMAL.bloomThreshold,
    simSpeed: FPS_STEADY / 60,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/sections/mid-section-intensity.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/mid-section-intensity.ts src/components/sections/mid-section-intensity.test.ts
git commit -m "feat(mid-section): computeIntensityState — three-band brightness + fps from progress"
```

---

## Task 3: TDD `mapBeatProgressWebGPU` — offset/scale beat positions into the reading band

**Files:**
- Modify: `src/components/sections/mid-section-intensity.ts`
- Modify: `src/components/sections/mid-section-intensity.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `src/components/sections/mid-section-intensity.test.ts`:

```ts
import { mapBeatProgressWebGPU } from './mid-section-intensity';
import { MID_SECTION_PIN_TIMING } from './mid-section-motion-content';

describe('mapBeatProgressWebGPU', () => {
  it('raw 0 maps to INTRO_END (beat 1 enters as intro ends)', () => {
    expect(mapBeatProgressWebGPU(0)).toBeCloseTo(INTRO_END, 10);
  });

  it('raw 1 maps to OUTRO_START (beat 5 exits as outro begins)', () => {
    expect(mapBeatProgressWebGPU(1)).toBeCloseTo(OUTRO_START, 10);
  });

  it('raw 0.5 maps to the midpoint of the reading band (4/7)', () => {
    expect(mapBeatProgressWebGPU(0.5)).toBeCloseTo(INTRO_END + 0.5 * READING_SCALE, 10);
    expect(mapBeatProgressWebGPU(0.5)).toBeCloseTo(4 / 7, 10);
  });

  it('preserves the kiss handoff between beats (beat2 enter == beat1 exit, mapped)', () => {
    const beat1ExitMapped = mapBeatProgressWebGPU(MID_SECTION_PIN_TIMING.beat1.exit);
    const beat2EnterMapped = mapBeatProgressWebGPU(MID_SECTION_PIN_TIMING.beat2.enter);
    expect(beat1ExitMapped).toBeCloseTo(beat2EnterMapped, 10);
  });

  it('preserves the kiss handoff between every adjacent beat pair', () => {
    const pairs: Array<[keyof typeof MID_SECTION_PIN_TIMING, keyof typeof MID_SECTION_PIN_TIMING]> = [
      ['beat1', 'beat2'],
      ['beat2', 'beat3'],
      ['beat3', 'beat4'],
      ['beat4', 'beat5'],
    ];
    for (const [a, b] of pairs) {
      expect(mapBeatProgressWebGPU(MID_SECTION_PIN_TIMING[a].exit))
        .toBeCloseTo(mapBeatProgressWebGPU(MID_SECTION_PIN_TIMING[b].enter), 10);
    }
  });

  it('beat 1 hold-start lands at ~0.172 (matches spec example)', () => {
    expect(mapBeatProgressWebGPU(MID_SECTION_PIN_TIMING.beat1.holdStart)).toBeCloseTo(0.1714, 4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/sections/mid-section-intensity.test.ts`
Expected: New tests fail with "mapBeatProgressWebGPU is not a function".

- [ ] **Step 3: Implement `mapBeatProgressWebGPU`**

Append to `src/components/sections/mid-section-intensity.ts`:

```ts
/**
 * Maps a reading-relative beat progress (0 = first beat enters, 1 = last beat exits)
 * onto the full pinned timeline by offsetting into the intro band and scaling by
 * the reading band's width. WebGPU mode only — video mode uses raw beat positions.
 */
export function mapBeatProgressWebGPU(raw: number): number {
  return INTRO_END + raw * READING_SCALE;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/sections/mid-section-intensity.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/mid-section-intensity.ts src/components/sections/mid-section-intensity.test.ts
git commit -m "feat(mid-section): mapBeatProgressWebGPU — offset beats into reading band"
```

---

## Task 4: Wire `MidSectionMotion.tsx` to the new intensity module

This task replaces in-file constants and the wake-up function with imports from `mid-section-intensity`, rewrites the intensity ScrollTrigger's `onUpdate` to a single helper call, branches beat tween positions on render mode, and bumps the WebGPU wrapper height to 700vh.

**Files:**
- Modify: `src/components/sections/MidSectionMotion.tsx`

- [ ] **Step 1: Replace the imports block**

Edit `src/components/sections/MidSectionMotion.tsx` lines 1-13. Change:

```ts
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  BEATS,
  MID_SECTION_PIN_TIMING,
} from './mid-section-motion-content';
import {
  mountCurlLinesScene,
  type CurlLinesIntensity,
} from './mid-section-webgpu-scene';

gsap.registerPlugin(ScrollTrigger);
```

…to:

```ts
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  BEATS,
  MID_SECTION_PIN_TIMING,
} from './mid-section-motion-content';
import {
  mountCurlLinesScene,
  type CurlLinesIntensity,
} from './mid-section-webgpu-scene';
import {
  INTRO_END,
  OUTRO_START,
  computeIntensityState,
  mapBeatProgressWebGPU,
} from './mid-section-intensity';

gsap.registerPlugin(ScrollTrigger);
```

- [ ] **Step 2: Remove the in-file constants and `wakeUpFps` function**

Delete lines 15-52 of `src/components/sections/MidSectionMotion.tsx` — everything from `const TIMING = [` through the closing `}` of `wakeUpFps`. After deletion the block immediately following the imports should be:

```ts
type RenderMode = 'webgpu' | 'video' | 'reduced';

function initialRenderMode(): RenderMode {
```

Specifically remove:
- the `TIMING` array (replaced by inline indexing into `MID_SECTION_PIN_TIMING`)
- `WEBGPU_TEXT_SCALE`, `OVERTURE_END`, the in-file `OUTRO_START`, `INTENSITY_BRIGHT`, `INTENSITY_NORMAL`
- `WAKEUP_END`, `WAKEUP_FPS_WAYPOINTS`, `STEADY_FPS`, `wakeUpFps`

- [ ] **Step 3: Remove the now-unused `lerp` helper**

Delete the `lerp` function (currently at lines 63-65 of the original file — after `initialRenderMode`):

```ts
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
```

`computeIntensityState` brings its own lerp; no other call sites in the component need it.

- [ ] **Step 4: Rewrite the beat tween loop to branch on render mode**

In the second `useEffect` (the "Full-motion path" effect), find the block starting `const textScale = renderMode === 'webgpu' ? WEBGPU_TEXT_SCALE : 1;` and the `TIMING.forEach` loop below it. Replace with:

```ts
    const ctx = gsap.context(() => {
      // Initial states — beats hidden and offset below resting position.
      gsap.set(beatEls, { opacity: 0, y: 20 });

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

      // In webgpu mode the last text tween ends at timeline-position OUTRO_START
      // (≈ 0.857), but ScrollTrigger.scrub maps its 0..1 progress onto the timeline's
      // totalDuration. Without padding, scroll progress 1.0 would only reach timeline
      // position 0.857 — beat 5 would stay visible through the entire outro. Pad with
      // a phantom set at position 1 so timeline totalDuration matches the scroll range.
      if (renderMode === 'webgpu') {
        tl.set({}, {}, 1);
      }

      // Map a raw reading-relative position (0..1) onto the full pinned timeline.
      // WebGPU mode offsets/scales into the reading band; video mode uses raw.
      const mapPos = (raw: number) =>
        renderMode === 'webgpu' ? mapBeatProgressWebGPU(raw) : raw;

      const beatKeys = ['beat1', 'beat2', 'beat3', 'beat4', 'beat5'] as const;
      beatKeys.forEach((key, i) => {
        const beat = beatEls[i];
        if (!beat) return;
        const raw = MID_SECTION_PIN_TIMING[key];
        const enter = mapPos(raw.enter);
        const holdStart = mapPos(raw.holdStart);
        const holdEnd = mapPos(raw.holdEnd);
        const exit = mapPos(raw.exit);

        // Enter tween — fade in + rise from y:20 to y:0.
        if (enter < holdStart) {
          tl.to(
            beat,
            { opacity: 1, y: 0, ease: 'power2.out', duration: holdStart - enter },
            enter,
          );
        } else {
          tl.set(beat, { opacity: 1, y: 0 }, enter);
        }

        // Exit tween — fade out + lift to y:−20.
        if (holdEnd < exit) {
          tl.to(
            beat,
            { opacity: 0, y: -20, ease: 'power1.in', duration: exit - holdEnd },
            holdEnd,
          );
        }
      });
    }, wrapperEl);
```

- [ ] **Step 5: Rewrite the intensity ScrollTrigger's `onUpdate`**

In the third `useEffect` (the "WebGPU intensity ScrollTrigger" effect), replace the entire `onUpdate` callback. The new body is a single helper call plus four assignments:

```ts
      onUpdate: (self) => {
        const state = computeIntensityState(self.progress);
        intensity.brightness = state.brightness;
        intensity.bloomStrength = state.bloomStrength;
        intensity.bloomThreshold = state.bloomThreshold;
        intensity.simSpeed = state.simSpeed;
      },
```

The surrounding `ScrollTrigger.create({ trigger, start, end, scrub, invalidateOnRefresh, onUpdate })` configuration is unchanged.

- [ ] **Step 6: Bump WebGPU wrapper height to 700vh**

Find the line near the bottom of the component (currently around line 289):

```ts
  const wrapperHeight = renderMode === 'webgpu' ? '600vh' : '500vh';
```

Change to:

```ts
  const wrapperHeight = renderMode === 'webgpu' ? '700vh' : '500vh';
```

- [ ] **Step 7: Remove the now-unused `CurlLinesIntensity` type import if appropriate**

The `intensityRef` type annotation (`useRef<CurlLinesIntensity | null>(null)`) still uses `CurlLinesIntensity`, so **keep the import**. No change required for this step — verifying only.

- [ ] **Step 8: Run all unit tests**

Run: `npm test`
Expected: All tests pass (existing `mid-section-motion-content` tests + new `mid-section-intensity` tests). No regressions.

- [ ] **Step 9: Type-check the build**

Run: `npx tsc -b`
Expected: No errors. If the component still references any deleted symbol (`TIMING`, `WAKEUP_END`, `wakeUpFps`, etc.), `tsc` will catch it.

- [ ] **Step 10: Lint**

Run: `npm run lint`
Expected: No new errors in `MidSectionMotion.tsx` or `mid-section-intensity.ts`. Pre-existing warnings in the rest of the repo are not the concern of this task.

- [ ] **Step 11: Commit**

```bash
git add src/components/sections/MidSectionMotion.tsx
git commit -m "feat(mid-section): wire intensity module — 700vh wrapper, symmetric bookend"
```

---

## Task 5: Update content-file comment

**Files:**
- Modify: `src/components/sections/mid-section-motion-content.ts`

- [ ] **Step 1: Update the `MID_SECTION_PIN_TIMING` doc-block**

Edit the comment block immediately above `export const MID_SECTION_PIN_TIMING` (currently lines 12-19 of the file). Replace:

```ts
// GSAP timeline progress points for the pinned mid-section stage.
// Mirrors the BRIDGE_PIN_TIMING shape exactly. Each beat has:
//   enter      — when its enter tween starts (opacity 0→1, y 20→0)
//   holdStart  — when it reaches full opacity at resting position
//   holdEnd    — when its exit tween starts (opacity 1→0, y 0→−20)
//   exit       — when it has fully exited
// Kiss handoff: beatN.exit === beatN+1.enter, so beat N+1's enter tween
// starts exactly as beat N's exit tween finishes — back-to-back, never a gap.
```

…with:

```ts
// Reading-relative GSAP timeline progress points for the pinned mid-section stage.
// Values express positions within the 5-beat reading band as a 0..1 range, NOT
// positions on the full pinned timeline. Each beat has:
//   enter      — when its enter tween starts (opacity 0→1, y 20→0)
//   holdStart  — when it reaches full opacity at resting position
//   holdEnd    — when its exit tween starts (opacity 1→0, y 0→−20)
//   exit       — when it has fully exited
// Kiss handoff: beatN.exit === beatN+1.enter, so beat N+1's enter tween
// starts exactly as beat N's exit tween finishes — back-to-back, never a gap.
//
// WebGPU consumer offsets/scales these into the reading band via
// `mapBeatProgressWebGPU` from ./mid-section-intensity (intro/outro bookends).
// Video consumer uses the raw values (no bookends).
```

- [ ] **Step 2: Run the existing content tests to confirm no regression**

Run: `npx vitest run src/components/sections/mid-section-motion-content.test.ts`
Expected: All tests pass (the constants themselves are unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/mid-section-motion-content.ts
git commit -m "docs(mid-section): clarify pin-timing values are reading-relative"
```

---

## Task 6: Full verification — tests, build, lint

**Files:** none modified. This task is a green-build checkpoint.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass. Particular files to confirm green:
- `src/components/sections/mid-section-intensity.test.ts`
- `src/components/sections/mid-section-motion-content.test.ts`

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: Build completes with no TypeScript errors and no Vite errors. Bundle size for the `MidSectionMotion` chunk should be roughly the same as before (~the same minus the deleted constants, plus the small new module).

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No new errors introduced by this work. (Pre-existing lint warnings in unrelated files are not in scope.)

- [ ] **Step 4: If anything failed, stop and fix before proceeding**

Do not advance to Task 7 if any of Steps 1-3 failed. Fix the failures, re-run, then proceed.

---

## Task 7: Manual browser verification

**Files:** none modified.

The bookend animation cannot be unit-tested — it's driven by scroll position against the actual canvas. Verify visually before declaring done.

- [ ] **Step 1: Start the dev server**

Run (in a separate terminal): `npm run dev`
Expected: Vite starts and reports a local URL (typically `http://localhost:5173/`).

- [ ] **Step 2: Open the homepage in a WebGPU-capable browser**

In Chrome (recent stable) or Edge, navigate to the dev URL. The mid-section sits below the hero on the homepage (rendered from [src/App.tsx](src/App.tsx)).

- [ ] **Step 3: Verify pin-engage entry**

Scroll slowly until the mid-section reaches the top of the viewport (pin engages). Confirm:
- Canvas appears bright and streaky (high bloom, slow-moving lines) at pin engage — this is the intro band at progress 0.
- The bright/dramatic look **dwells** for the first ~50vh of pinned scroll (first half of the intro band).
- Brightness then drops and FPS catches up to steady within the second ~50vh, just as beat 1 begins fading in.

- [ ] **Step 4: Verify reading window**

Continue scrolling through all five beats. Confirm:
- Brightness and bloom hold steady at the calm "normal" level (1.20 / 2.20).
- The simulation runs visibly faster and smoother than during the intro crawl (≈39 fps).
- All five beats fire at the same cadence as before — no rushed or stretched feel.

- [ ] **Step 5: Verify outro**

Once beat 5 has fully exited, continue scrolling. Confirm:
- Canvas brightness/bloom stays near normal for the first ~50vh of the outro band.
- In the second ~50vh, brightness and bloom ramp up to the bright endpoint AND FPS drops back into the crawl — the look mirrors the intro, just in reverse.
- The bright/streaky outro look is recognizably the same character as the bright/streaky intro look (the whole point of the symmetric bookend).

- [ ] **Step 6: Verify video fallback path**

In Chrome DevTools Console, run:

```js
// Disable navigator.gpu to force the video fallback path
Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
location.reload();
```

After reload, scroll to the mid-section. Confirm:
- The wrapper is shorter than the WebGPU version (500vh vs 700vh — feels noticeably tighter).
- An MP4 plays underneath the beats; no canvas.
- All five beats fire and read at the same cadence as the original video-path experience. No regression.

- [ ] **Step 7: Verify reduced-motion path**

In Chrome DevTools (CMD/Ctrl+Shift+P → "Show Rendering") enable "Emulate CSS media feature prefers-reduced-motion: reduce", then reload. Confirm:
- The mid-section renders as five stacked static blocks with the poster image.
- Beats fade in via IntersectionObserver as you scroll past each block.
- No pinned animation, no canvas, no video. Unchanged from current behavior.

- [ ] **Step 8: If the intro/outro dwell feels wrong**

The cubic ease-in (`t^3`) was chosen as a starting point. If the dramatic dwell feels:
- **Too short** (resolves to normal too quickly): change `easeInCubic` to a quartic — return `t * t * t * t` and rerun Task 1's tests adjusting the midpoint expectation to `0.0625`.
- **Too long** (sits at bright/crawl for too much of the band): change to quadratic — return `t * t` and rerun Task 1's tests with midpoint expectation `0.25`.

This is a tuning step, not a bug fix; document the choice if changed.

- [ ] **Step 9: Final commit (if any tuning happened)**

If you changed the easing exponent in Step 8, update the tests and commit:

```bash
git add src/components/sections/mid-section-intensity.ts src/components/sections/mid-section-intensity.test.ts
git commit -m "tune(mid-section): adjust ease curve to <chosen exponent>"
```

If no tuning was needed, no final commit. The work is done.

---

## Self-Review Notes

**Spec coverage check:**
- Structure (700vh wrapper, 100/500/100 split): Task 4 step 6, Task 1 constants. ✓
- Brightness + FPS endpoints (bright 3.45/3.30/0.14, normal 1.20/2.20/0.15, FPS 3 → 39): Task 1 constants + Task 1 tests. ✓
- Cubic ease-in for both bands: Task 1 (`easeInCubic`) + Task 2 (used in both branches of `computeIntensityState`). ✓
- Brightness and FPS on the same eased progress: Task 2 — single function computes both from same `t`. ✓
- Single helper for `onUpdate`: Task 4 step 5. ✓
- Beat timing offset/scale via `INTRO_END + raw * READING_SCALE`: Task 3. ✓
- Phantom `tl.set({}, {}, 1)` padding preserved in WebGPU mode only: Task 4 step 4. ✓
- Video path unchanged (500vh, raw beat positions): Task 4 steps 4 and 6 (branch on `renderMode`). ✓
- Reduced-motion path unchanged: not touched. ✓
- Content file comment updated: Task 5. ✓

**Open-item risks from spec carried forward:**
- "Post-section state" risk (canvas left at FPS floor 3 after scroll past): not addressed in this plan. The spec marked this as "worth verifying live before committing to this fix." Task 7 step 5 is the live verification; if the issue manifests, add a follow-up plan with an `onLeave` snap-to-steady handler. Not in this plan's scope.
- Cubic ease tuning: Task 7 step 8.
- Pre-pin trigger deferred: not in this plan's scope per spec.
