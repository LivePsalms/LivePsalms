# /purpose Pinned Split-Reveal Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `/purpose` stacked listing with a scroll-pinned, opposing-direction split-reveal mechanic that surfaces each devotion in Zone 8's visual language — a fixed center hero-mask pill whose four lines rise upward and color crossfades as the user scrolls.

**Architecture:** GSAP ScrollTrigger pins a wrapper section. N panels stack absolutely; each panel's left half tweens from `yPercent: 100` and right half from `yPercent: -100` to `0` in lockstep, both sides meeting at the midline. A fixed center pill (Zone 8's `hero-mask-clip` shape) lives within the pinned stage; at each panel's halfway threshold, the four text stacks each translate upward by 100% of their own line height and the pill background color crossfades. Pill click runs the same expand-to-fullscreen morph as Zone 8 (extracted into a shared hook) and routes to `/purpose/:id`. Mobile and reduced-motion paths skip the pin and render panels in flow with per-panel static pills.

**Tech Stack:** React 18, TypeScript, GSAP 3 + ScrollTrigger, react-router v6, Tailwind, Vitest. Tests use the project's dependency-injection pattern (pure modules tested in node, React wrappers verified manually in the browser).

**Spec:** [`docs/superpowers/specs/2026-05-21-purpose-page-pinned-split-reveal-design.md`](../specs/2026-05-21-purpose-page-pinned-split-reveal-design.md)

---

## Pre-flight

Verify you're on the `deepen-architecture` branch and the working tree has only the in-progress files listed in the spec.

```bash
git status -sb
```

Expected: branch `deepen-architecture`, the existing `M` and `??` entries (no clean tree required). Do not stash or revert anything.

Run the full test suite once at the start so you have a green baseline.

```bash
npm test
```

Expected: all tests pass. If anything fails before you touch a file, stop and ask.

---

## Task 1: Pure pill-data computation helper

**Why:** The mapping `(project, devotion?) → { label, title, category, scripture, pillColor }` is pure and used in 11 places (one per panel). Extract it so PurposeStack and PurposeStackPill both consume the same shape and the data flow can be unit-tested without rendering.

**Files:**
- Create: `src/components/sections/purpose-stack-data.ts`
- Create: `src/components/sections/purpose-stack-data.test.ts`

- [ ] **Step 1: Write the failing test**

Write the complete test file:

```ts
// src/components/sections/purpose-stack-data.test.ts
import { describe, it, expect } from 'vitest';
import { computePillData } from './purpose-stack-data';
import type { Project } from '@/types';
import type { Devotion } from '@/data/devotions';

const baseProject: Project = {
  id: 'strength',
  name: 'Restoration 03',
  category: 'residential',
  thumbnail: '/mid_section/restoration5.png',
  images: ['/mid_section/restoration5.png'],
  overlayColor: '#A09688',
};

const baseDevotion: Devotion = {
  id: 'strength',
  label: 'The Restoration of Strength',
  title: 'Wings Like Eagles',
  scriptureRef: 'Isaiah 40:31',
  monogram: 'ST',
  firstMoodboardImage: '/restoration5/img1.png',
};

describe('computePillData — with devotion attached', () => {
  it('uses devotion title, derives short category from label, includes scripture ref', () => {
    const data = computePillData(baseProject, baseDevotion);
    expect(data.label).toBe('Devotion');
    expect(data.title).toBe('Wings Like Eagles');
    expect(data.category).toBe('Strength');
    expect(data.scripture).toBe('Isaiah 40:31');
  });

  it('uses project.thumbnail as left image, devotion.firstMoodboardImage as right image', () => {
    const data = computePillData(baseProject, baseDevotion);
    expect(data.leftImage).toBe('/mid_section/restoration5.png');
    expect(data.rightImage).toBe('/restoration5/img1.png');
  });

  it('uses project.overlayColor as synchronous fallback pill color', () => {
    const data = computePillData(baseProject, baseDevotion);
    expect(data.pillColor).toBe('#A09688');
  });

  it('strips "The Restoration of" and "Serenity of" prefixes from category label', () => {
    expect(computePillData(baseProject, { ...baseDevotion, label: 'The Restoration of Strength' }).category).toBe('Strength');
    expect(computePillData(baseProject, { ...baseDevotion, label: 'Restoration of Hope' }).category).toBe('Hope');
    expect(computePillData(baseProject, { ...baseDevotion, label: 'The Serenity of Trust' }).category).toBe('Trust');
    expect(computePillData(baseProject, { ...baseDevotion, label: 'Serenity of Forgiveness' }).category).toBe('Forgiveness');
  });
});

describe('computePillData — without devotion (fallback)', () => {
  it('uses project.name as title, categoryLabel as category, empty scripture', () => {
    const data = computePillData(baseProject, undefined);
    expect(data.title).toBe('Restoration 03');
    expect(data.category).toBe('Restoration'); // residential → "Restoration"
    expect(data.scripture).toBe('');
  });

  it('uses project.images[1] as right image when available, else project.thumbnail', () => {
    const withSecond: Project = { ...baseProject, images: ['/a.png', '/b.png'] };
    expect(computePillData(withSecond, undefined).rightImage).toBe('/b.png');

    const withOnlyOne: Project = { ...baseProject, images: ['/a.png'] };
    expect(computePillData(withOnlyOne, undefined).rightImage).toBe('/mid_section/restoration5.png'); // thumbnail
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/components/sections/purpose-stack-data.test.ts
```

Expected: FAIL with module-not-found for `./purpose-stack-data`.

- [ ] **Step 3: Implement the helper**

Write the complete file:

```ts
// src/components/sections/purpose-stack-data.ts
import type { Project } from '@/types';
import type { Devotion } from '@/data/devotions';
import { categoryLabel } from '@/data/projects';

export interface PillData {
  label: string;
  title: string;
  category: string;
  scripture: string;
  leftImage: string;
  rightImage: string;
  pillColor: string;
}

const CATEGORY_PREFIX = /^(The )?(Restoration of |Serenity of )/;

export function computePillData(
  project: Project,
  devotion: Devotion | undefined
): PillData {
  if (devotion) {
    return {
      label: 'Devotion',
      title: devotion.title,
      category: devotion.label.replace(CATEGORY_PREFIX, ''),
      scripture: devotion.scriptureRef,
      leftImage: project.thumbnail,
      rightImage: devotion.firstMoodboardImage,
      pillColor: project.overlayColor,
    };
  }

  return {
    label: 'Devotion',
    title: project.name,
    category: categoryLabel[project.category],
    scripture: '',
    leftImage: project.thumbnail,
    rightImage: project.images[1] ?? project.thumbnail,
    pillColor: project.overlayColor,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/components/sections/purpose-stack-data.test.ts
```

Expected: 6 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/purpose-stack-data.ts src/components/sections/purpose-stack-data.test.ts
git commit -m "$(cat <<'EOF'
feat(purpose-stack): pure helper computing pill data per panel

Pure mapping from (project, devotion?) to the visible pill data. Used
by PurposeStack to feed the fixed center pill and (in a later task) by
PurposeStackPill to render the resting frame on first paint.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: PillExpandController — pure state machine for the expand-to-fullscreen morph

**Why:** The current `useClickToExpand` in `NextDevotionHandoff.tsx` mixes DOM manipulation, GSAP timeline construction, the `navigatedRef` guard, body-overflow lock, and the reduced-motion fast path. Extract the pure decisions (durations, timeline shape, when to mount/remove the cover, the guard) into a controller class with injected deps. Both Zone 8 and the new PurposeStack pill use it.

**Files:**
- Create: `src/transitions/pill-expand-controller.ts`
- Create: `src/transitions/pill-expand-controller.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/transitions/pill-expand-controller.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PillExpandController } from './pill-expand-controller';
import type { PillExpandDeps, ExpandTiming, RectLike } from './pill-expand-controller';

interface CreateCoverCall { rect: RectLike; pillColor: string; }
interface TimelineCall { timing: ExpandTiming; targetUrl: string; }

interface DepsRecord {
  coversCreated: CreateCoverCall[];
  coversRemoved: number;
  timelines: TimelineCall[];
  bodyOverflow: string[];
  existingCover: boolean;
}

function makeDeps(overrides: Partial<{ existingCover: boolean }> = {}): {
  deps: PillExpandDeps; rec: DepsRecord;
} {
  const rec: DepsRecord = {
    coversCreated: [],
    coversRemoved: 0,
    timelines: [],
    bodyOverflow: [],
    existingCover: overrides.existingCover ?? false,
  };
  const deps: PillExpandDeps = {
    createCover: (opts) => { rec.coversCreated.push(opts); },
    removeCover: () => { rec.coversRemoved += 1; },
    runExpandTimeline: (opts) => { rec.timelines.push(opts); },
    setBodyOverflow: (v) => { rec.bodyOverflow.push(v); },
    hasExistingCover: () => rec.existingCover,
  };
  return { deps, rec };
}

const RECT: RectLike = { top: 100, left: 200, width: 600, height: 175 };

describe('PillExpandController — initial state', () => {
  it('starts not-navigated', () => {
    const { deps } = makeDeps();
    const c = new PillExpandController(deps);
    expect(c.hasNavigated()).toBe(false);
  });
});

describe('PillExpandController — start (normal motion)', () => {
  let deps: PillExpandDeps;
  let rec: DepsRecord;
  let c: PillExpandController;

  beforeEach(() => {
    ({ deps, rec } = makeDeps());
    c = new PillExpandController(deps);
  });

  it('locks body overflow, creates cover with rect+color, runs timeline with targetUrl', () => {
    c.start({ pillRect: RECT, targetUrl: '/purpose/strength', pillColor: '#7d7565', reducedMotion: false });
    expect(rec.bodyOverflow).toEqual(['hidden']);
    expect(rec.coversCreated).toEqual([{ rect: RECT, pillColor: '#7d7565' }]);
    expect(rec.timelines).toHaveLength(1);
    expect(rec.timelines[0].targetUrl).toBe('/purpose/strength');
  });

  it('uses the cinematic timings (0.65s expand, 0.35s layer fade, 200ms hold, 400ms fade out)', () => {
    c.start({ pillRect: RECT, targetUrl: '/purpose/x', pillColor: '#000', reducedMotion: false });
    expect(rec.timelines[0].timing).toEqual({
      expandSeconds: 0.65,
      layerFadeSeconds: 0.35,
      layerFadeStartSeconds: 0.15,
      postNavHoldMs: 200,
      coverFadeMs: 400,
    });
  });

  it('marks hasNavigated true after start', () => {
    c.start({ pillRect: RECT, targetUrl: '/purpose/x', pillColor: '#000', reducedMotion: false });
    expect(c.hasNavigated()).toBe(true);
  });
});

describe('PillExpandController — start (reduced motion)', () => {
  it('collapses every duration to 0 / 50ms / 200ms', () => {
    const { deps, rec } = makeDeps();
    const c = new PillExpandController(deps);
    c.start({ pillRect: RECT, targetUrl: '/purpose/x', pillColor: '#000', reducedMotion: true });
    expect(rec.timelines[0].timing).toEqual({
      expandSeconds: 0,
      layerFadeSeconds: 0,
      layerFadeStartSeconds: 0,
      postNavHoldMs: 50,
      coverFadeMs: 200,
    });
  });
});

describe('PillExpandController — idempotency', () => {
  it('second start is a no-op (no second cover, no second timeline)', () => {
    const { deps, rec } = makeDeps();
    const c = new PillExpandController(deps);
    c.start({ pillRect: RECT, targetUrl: '/purpose/x', pillColor: '#000', reducedMotion: false });
    c.start({ pillRect: RECT, targetUrl: '/purpose/y', pillColor: '#fff', reducedMotion: false });
    expect(rec.coversCreated).toHaveLength(1);
    expect(rec.timelines).toHaveLength(1);
    expect(rec.timelines[0].targetUrl).toBe('/purpose/x');
  });

  it('refuses to start if hasExistingCover() returns true', () => {
    const { deps, rec } = makeDeps({ existingCover: true });
    const c = new PillExpandController(deps);
    c.start({ pillRect: RECT, targetUrl: '/purpose/x', pillColor: '#000', reducedMotion: false });
    expect(rec.coversCreated).toHaveLength(0);
    expect(rec.timelines).toHaveLength(0);
  });
});

describe('PillExpandController — cleanup', () => {
  it('removes any cover and resets body overflow on cleanup', () => {
    const { deps, rec } = makeDeps();
    const c = new PillExpandController(deps);
    c.start({ pillRect: RECT, targetUrl: '/purpose/x', pillColor: '#000', reducedMotion: false });
    c.cleanup();
    expect(rec.coversRemoved).toBe(1);
    expect(rec.bodyOverflow).toEqual(['hidden', '']);
  });

  it('cleanup is safe to call when start was never called', () => {
    const { deps, rec } = makeDeps();
    const c = new PillExpandController(deps);
    c.cleanup();
    expect(rec.coversRemoved).toBe(1); // unconditionally tries; deps decide if there's anything
    expect(rec.bodyOverflow).toEqual(['']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/transitions/pill-expand-controller.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the controller**

```ts
// src/transitions/pill-expand-controller.ts

export interface RectLike {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ExpandTiming {
  expandSeconds: number;
  layerFadeSeconds: number;
  layerFadeStartSeconds: number;
  postNavHoldMs: number;
  coverFadeMs: number;
}

export interface StartOptions {
  pillRect: RectLike;
  targetUrl: string;
  pillColor: string;
  reducedMotion: boolean;
}

export interface PillExpandDeps {
  /** Create the DOM cover element with initial styles. The impl owns DOM and ref tracking. */
  createCover: (opts: { rect: RectLike; pillColor: string }) => void;
  /** Remove any existing cover element. Safe to call when none exists. */
  removeCover: () => void;
  /** Execute the GSAP timeline that morphs the cover; the impl is responsible for navigating at the end and cleaning up. */
  runExpandTimeline: (opts: { timing: ExpandTiming; targetUrl: string }) => void;
  /** Lock or release document body scroll. Pass '' to release. */
  setBodyOverflow: (value: string) => void;
  /** True if a cover element is already in the DOM (e.g., leftover from a prior aborted morph). */
  hasExistingCover: () => boolean;
}

const NORMAL_TIMING: ExpandTiming = {
  expandSeconds: 0.65,
  layerFadeSeconds: 0.35,
  layerFadeStartSeconds: 0.15,
  postNavHoldMs: 200,
  coverFadeMs: 400,
};

const REDUCED_TIMING: ExpandTiming = {
  expandSeconds: 0,
  layerFadeSeconds: 0,
  layerFadeStartSeconds: 0,
  postNavHoldMs: 50,
  coverFadeMs: 200,
};

export class PillExpandController {
  private readonly deps: PillExpandDeps;
  private navigated = false;

  constructor(deps: PillExpandDeps) {
    this.deps = deps;
  }

  hasNavigated(): boolean {
    return this.navigated;
  }

  start = ({ pillRect, targetUrl, pillColor, reducedMotion }: StartOptions): void => {
    if (this.navigated) return;
    if (this.deps.hasExistingCover()) return;
    this.navigated = true;

    this.deps.setBodyOverflow('hidden');
    this.deps.createCover({ rect: pillRect, pillColor });
    this.deps.runExpandTimeline({
      timing: reducedMotion ? REDUCED_TIMING : NORMAL_TIMING,
      targetUrl,
    });
  };

  cleanup = (): void => {
    this.deps.removeCover();
    this.deps.setBodyOverflow('');
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/transitions/pill-expand-controller.test.ts
```

Expected: all tests in the file pass.

- [ ] **Step 5: Commit**

```bash
git add src/transitions/pill-expand-controller.ts src/transitions/pill-expand-controller.test.ts
git commit -m "$(cat <<'EOF'
feat(transitions): PillExpandController — pure state machine for pill morph

Extracts the click-to-expand decisions from NextDevotionHandoff's
private useClickToExpand into a testable controller: navigated guard,
reduced-motion timing collapse, body-overflow lock, cover lifecycle.
DOM and GSAP work moves into the deps (next task wires real impls).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: usePillExpandNavigation React hook (real DOM + GSAP wiring)

**Why:** Wrap the controller with the actual DOM cover construction, GSAP timeline, and react-router navigate. This is the consumer-facing hook both Zone 8 and PurposeStack will use.

**Files:**
- Create: `src/transitions/usePillExpandNavigation.ts`

- [ ] **Step 1: Implement the hook**

```ts
// src/transitions/usePillExpandNavigation.ts
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import gsap from 'gsap';
import { PillExpandController } from './pill-expand-controller';
import type { ExpandTiming, PillExpandDeps, RectLike } from './pill-expand-controller';

const COVER_ATTR = 'data-pill-cover';

interface StartFromPillArgs {
  pillEl: HTMLElement;
  pillColor: string;
  targetUrl: string;
  reducedMotion: boolean;
}

interface CoverHandle {
  cover: HTMLDivElement;
  clippedLayer: HTMLDivElement;
  unclippedLayer: HTMLDivElement;
}

/**
 * Drives the cinematic "pill expands to fullscreen, navigates, then fades
 * out" morph used by Zone 8 and the /purpose listing pill. The controller
 * owns the pure decisions; this hook supplies the real DOM and GSAP work.
 */
export function usePillExpandNavigation() {
  const navigate = useNavigate();
  const coverHandleRef = useRef<CoverHandle | null>(null);

  // Build the deps once; rebuild only if navigate identity changes.
  const controller = useMemo(() => {
    const deps: PillExpandDeps = {
      createCover: ({ rect, pillColor }) => {
        coverHandleRef.current = buildCoverDom(rect, pillColor);
      },
      removeCover: () => {
        const orphan = document.querySelector(`[${COVER_ATTR}]`);
        orphan?.remove();
        coverHandleRef.current = null;
      },
      runExpandTimeline: ({ timing, targetUrl }) => {
        const handle = coverHandleRef.current;
        if (!handle) return;
        runTimeline(handle, timing, targetUrl, navigate, coverHandleRef);
      },
      setBodyOverflow: (value) => { document.body.style.overflow = value; },
      hasExistingCover: () => !!document.querySelector(`[${COVER_ATTR}]`),
    };
    return new PillExpandController(deps);
  }, [navigate]);

  // Cleanup on unmount: remove orphaned cover and reset body overflow.
  useEffect(() => {
    return () => controller.cleanup();
  }, [controller]);

  const startFromPill = ({ pillEl, pillColor, targetUrl, reducedMotion }: StartFromPillArgs): void => {
    if (controller.hasNavigated()) return;
    const rect = pillEl.getBoundingClientRect();
    controller.start({
      pillRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      targetUrl,
      pillColor,
      reducedMotion,
    });
  };

  return { startFromPill };
}

function buildCoverDom(rect: RectLike, pillColor: string): CoverHandle {
  const cover = document.createElement('div');
  cover.setAttribute(COVER_ATTR, '');
  Object.assign(cover.style, {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: '100',
    pointerEvents: 'none',
    opacity: '1',
  } as Partial<CSSStyleDeclaration>);

  const clippedLayer = document.createElement('div');
  Object.assign(clippedLayer.style, {
    position: 'absolute', inset: '0',
    backgroundColor: pillColor,
    clipPath: 'url(#hero-mask-clip)',
  } as Partial<CSSStyleDeclaration>);

  const unclippedLayer = document.createElement('div');
  Object.assign(unclippedLayer.style, {
    position: 'absolute', inset: '0',
    backgroundColor: pillColor,
    opacity: '0',
  } as Partial<CSSStyleDeclaration>);

  cover.appendChild(clippedLayer);
  cover.appendChild(unclippedLayer);
  document.body.appendChild(cover);

  return { cover, clippedLayer, unclippedLayer };
}

function runTimeline(
  handle: CoverHandle,
  timing: ExpandTiming,
  targetUrl: string,
  navigate: NavigateFunction,
  coverHandleRef: React.RefObject<CoverHandle | null>,
): void {
  const { cover, clippedLayer, unclippedLayer } = handle;

  const tl = gsap.timeline();
  tl.to(
    cover,
    { top: 0, left: 0, width: '100vw', height: '100vh', duration: timing.expandSeconds, ease: 'power3.inOut' },
    0,
  );
  tl.to(clippedLayer,   { opacity: 0, duration: timing.layerFadeSeconds, ease: 'power2.out' }, timing.layerFadeStartSeconds);
  tl.to(unclippedLayer, { opacity: 1, duration: timing.layerFadeSeconds, ease: 'power2.in'  }, timing.layerFadeStartSeconds);

  tl.call(() => {
    navigate(targetUrl);
    window.setTimeout(() => {
      cover.style.transition = `opacity ${timing.coverFadeMs}ms ease-out`;
      cover.style.opacity = '0';
      window.setTimeout(() => {
        cover.remove();
        document.body.style.overflow = '';
        coverHandleRef.current = null;
      }, timing.coverFadeMs + 50);
    }, timing.postNavHoldMs);
  });
}
```

- [ ] **Step 2: Type-check the hook**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: no TypeScript errors. If the hook trips lint rules around `useMemo` deps, leave the `eslint-disable-next-line` comment — `navigate` is intentionally the only dep.

- [ ] **Step 3: Commit**

```bash
git add src/transitions/usePillExpandNavigation.ts
git commit -m "$(cat <<'EOF'
feat(transitions): usePillExpandNavigation hook wrapping the controller

Real DOM + GSAP + react-router wiring for the pill expand-to-fullscreen
morph. Cover construction lives here (uses the pill's bounding rect);
durations/timings come from PillExpandController. Shared by Zone 8 and
the upcoming /purpose listing pill.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Refactor NextDevotionHandoff to use the shared hook

**Why:** Acceptance criterion #8 requires Zone 8 behavior to be indistinguishable after the extraction. Swap the private `useClickToExpand` for the new hook and verify in browser.

**Files:**
- Modify: `src/components/sections/NextDevotionHandoff.tsx`

- [ ] **Step 1: Replace the import and the hook usage**

In `src/components/sections/NextDevotionHandoff.tsx`:

Replace this import line (currently around line 1-2):

```ts
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
```

with:

```ts
import { useEffect, useRef, useState } from 'react';
```

(Drop `useNavigate` — the hook now owns it.)

Add this import next to the other transition imports:

```ts
import { usePillExpandNavigation } from '@/transitions/usePillExpandNavigation';
```

Replace the body of `NextDevotionHandoff` where it currently calls `useClickToExpand` (around line 84):

```ts
const { startExpand } = useClickToExpand(pillRef, nextProject, reducedMotion, pillColor, navigatedRef);
```

with:

```ts
const { startFromPill } = usePillExpandNavigation();
const startExpand = () => {
  const pill = pillRef.current;
  if (!pill) return;
  startFromPill({
    pillEl: pill,
    pillColor,
    targetUrl: `/purpose/${nextProject.id}`,
    reducedMotion,
  });
};
```

Delete the entire `useClickToExpand` function definition (currently ~lines 558-670) and the `navigatedRef` declaration (currently ~line 73) — both are no longer used.

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: all tests pass (no NextDevotionHandoff-specific tests exist, but adjacent tests must stay green).

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: no errors.

- [ ] **Step 4: Browser verification — Zone 8 click flow unchanged**

```bash
npm run dev
```

In the browser:
1. Navigate to `/purpose/strength` (or any devotion).
2. Scroll all the way to the bottom — the Zone 8 NextDevotionHandoff appears with the pill.
3. Click the pill.
4. **Expected:** same morph as before (pill expands to fill viewport, color crossfades, page navigates to the next devotion, cover fades out).
5. Test with reduced motion: in DevTools rendering panel, force `prefers-reduced-motion: reduce`, reload, repeat. Morph should be near-instant but still navigate cleanly.
6. Click the pill twice quickly — only one navigation should happen.

If any step fails, stop and debug. Don't proceed to Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/NextDevotionHandoff.tsx
git commit -m "$(cat <<'EOF'
refactor(next-handoff): use shared usePillExpandNavigation hook

NextDevotionHandoff now consumes the extracted hook instead of its
private useClickToExpand. Behavior unchanged — verified the Zone 8
click → expand → navigate flow in browser, including reduced-motion
and double-click guards.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: PurposeStackPill component (the fixed center pill with imperative morph API)

**Why:** The pill is the focal element. It owns the hero-mask-clipped shape, the four text stacks, the color crossfade, and an imperative `morphTo(data)` method so PurposeStack can drive the rise on each midpoint trigger without re-rendering.

**Files:**
- Create: `src/components/sections/PurposeStackPill.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// src/components/sections/PurposeStackPill.tsx
import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { PillData } from './purpose-stack-data';

export interface PurposeStackPillHandle {
  /** Animate to a new devotion: rise four text stacks + crossfade color. */
  morphTo: (data: PillData) => void;
  /** Direct reset (no animation) — used for reduced motion and on remount. */
  setStatic: (data: PillData) => void;
  /** Underlying root element for click/expand morph. */
  getRoot: () => HTMLDivElement | null;
}

interface Props {
  /** Initial frame shown on first paint, before any morph. */
  initial: PillData;
  /** Click handler (fires when user clicks/keypresses the pill). */
  onActivate: () => void;
}

export const PurposeStackPill = forwardRef<PurposeStackPillHandle, Props>(function PurposeStackPill(
  { initial, onActivate },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const shapeRef = useRef<HTMLDivElement>(null);
  const stackLabelRef = useRef<HTMLDivElement>(null);
  const stackTitleRef = useRef<HTMLDivElement>(null);
  const stackCategoryRef = useRef<HTMLDivElement>(null);
  const stackScriptureRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getRoot: () => rootRef.current,
    setStatic: (data) => {
      if (shapeRef.current) shapeRef.current.style.backgroundColor = data.pillColor;
      resetStack(stackLabelRef.current,     `<span class="pl-lbl">${escapeHtml(data.label)}</span>`);
      resetStack(stackTitleRef.current,     `<span class="pl-title">${escapeHtml(data.title)}</span>`);
      resetStack(stackCategoryRef.current,  `<span class="pl-meta">${escapeHtml(data.category)}</span>`);
      resetStack(stackScriptureRef.current, `<span class="pl-meta">${escapeHtml(data.scripture)} ${data.scripture ? '↗' : ''}</span>`);
    },
    morphTo: (data) => {
      if (shapeRef.current) shapeRef.current.style.backgroundColor = data.pillColor;
      pushFrame(stackLabelRef.current,     `<span class="pl-lbl">${escapeHtml(data.label)}</span>`);
      pushFrame(stackTitleRef.current,     `<span class="pl-title">${escapeHtml(data.title)}</span>`);
      pushFrame(stackCategoryRef.current,  `<span class="pl-meta">${escapeHtml(data.category)}</span>`);
      pushFrame(stackScriptureRef.current, `<span class="pl-meta">${escapeHtml(data.scripture)} ${data.scripture ? '↗' : ''}</span>`);
    },
  }), []);

  const initialScripture = `${escapeHtml(initial.scripture)} ${initial.scripture ? '↗' : ''}`;

  return (
    <div
      ref={rootRef}
      role="link"
      tabIndex={0}
      aria-label={`Open devotion: ${initial.title}`}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); }
      }}
      className="ps-pill absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
      style={{
        width: 'min(62vw, 920px)',
        aspectRatio: '11 / 3.2',
        zIndex: 50,
      }}
    >
      <div
        ref={shapeRef}
        className="ps-pill-shape absolute inset-0"
        style={{
          backgroundColor: initial.pillColor,
          clipPath: 'url(#hero-mask-clip)',
          boxShadow: '0 25px 50px -20px rgba(0,0,0,0.55)',
          transition: 'background-color 0.55s cubic-bezier(0.65,0,0.25,1)',
        }}
      />
      <div
        className="ps-pill-content absolute inset-0 grid items-center text-white"
        style={{
          gridTemplateColumns: '1fr auto 1fr',
          padding: '0 10%',
          fontFamily: '"Cormorant Garamond", Georgia, serif',
        }}
      >
        <div className="flex flex-col gap-1 text-left">
          <Mask alignEnd={false}>
            <Stack ref={stackLabelRef} innerHtml={`<span class="pl-lbl">${escapeHtml(initial.label)}</span>`} />
          </Mask>
          <Mask alignEnd={false}>
            <Stack ref={stackTitleRef} innerHtml={`<span class="pl-title">${escapeHtml(initial.title)}</span>`} />
          </Mask>
        </div>
        <img
          src="/logo-icon.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="w-10 opacity-25 invert pointer-events-none"
          style={{ transform: 'translateY(22px)' }}
        />
        <div className="flex flex-col gap-1 text-right">
          <Mask alignEnd>
            <Stack ref={stackCategoryRef} innerHtml={`<span class="pl-meta">${escapeHtml(initial.category)}</span>`} />
          </Mask>
          <Mask alignEnd>
            <Stack ref={stackScriptureRef} innerHtml={`<span class="pl-meta">${initialScripture}</span>`} />
          </Mask>
        </div>
      </div>
      <style>{`
        .ps-pill .pl-lbl  { font-family: ui-sans-serif, system-ui; font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(255,255,255,0.6); }
        .ps-pill .pl-title{ font-style: italic; font-weight: 300; font-size: 28px; line-height: 1; color: rgba(255,255,255,0.95); }
        .ps-pill .pl-meta { font-family: ui-sans-serif, system-ui; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.7); display: block; }
        .ps-pill .ps-mask { position: relative; overflow: hidden; display: block; }
        .ps-pill .ps-mask.r { text-align: right; }
        .ps-pill .ps-stack { display: flex; flex-direction: column; will-change: transform; transition: transform 0.55s cubic-bezier(0.65,0,0.25,1); }
        .ps-pill .ps-stack > .frame { flex: 0 0 100%; }
      `}</style>
    </div>
  );
});

function Mask({ alignEnd, children }: { alignEnd: boolean; children: React.ReactNode }) {
  return <div className={`ps-mask ${alignEnd ? 'r' : ''}`}>{children}</div>;
}

const Stack = forwardRef<HTMLDivElement, { innerHtml: string }>(function Stack({ innerHtml }, ref) {
  return (
    <div ref={ref} className="ps-stack">
      <div className="frame" dangerouslySetInnerHTML={{ __html: innerHtml }} />
    </div>
  );
});

function pushFrame(stack: HTMLDivElement | null, html: string): void {
  if (!stack) return;
  const frame = document.createElement('div');
  frame.className = 'frame';
  frame.innerHTML = html;
  stack.appendChild(frame);

  requestAnimationFrame(() => {
    stack.style.transform = 'translateY(-100%)';
  });

  const onEnd = () => {
    if (stack.firstElementChild) stack.removeChild(stack.firstElementChild);
    stack.style.transition = 'none';
    stack.style.transform = 'translateY(0)';
    void stack.offsetHeight; // reflow
    stack.style.transition = '';
    stack.removeEventListener('transitionend', onEnd);
  };
  stack.addEventListener('transitionend', onEnd, { once: true });
}

function resetStack(stack: HTMLDivElement | null, html: string): void {
  if (!stack) return;
  stack.style.transition = 'none';
  stack.style.transform = 'translateY(0)';
  stack.innerHTML = `<div class="frame">${html}</div>`;
  void stack.offsetHeight;
  stack.style.transition = '';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/PurposeStackPill.tsx
git commit -m "$(cat <<'EOF'
feat(purpose-stack): PurposeStackPill — fixed center pill with morph API

Renders the hero-mask-clipped pill, four text stacks (label, title,
category, scripture), and an imperative ref API: setStatic for the
resting state and morphTo for the per-line upward rise + color
crossfade. Click/Enter activates a parent-provided onActivate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: PurposeStack desktop component (pinned wrapper + split reveal)

**Why:** The component that owns the pinned ScrollTrigger timeline, the opposing-direction split reveal per panel, the midpoint triggers that drive `pill.morphTo`, and the pill click handler that calls `usePillExpandNavigation`. Desktop only in this task; mobile and reduced-motion in the next.

**Files:**
- Create: `src/components/sections/PurposeStack.tsx`

- [ ] **Step 1: Implement the desktop path**

```tsx
// src/components/sections/PurposeStack.tsx
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import type { Project } from '@/types';
import { devotions } from '@/data/devotions';
import { computePillData, type PillData } from './purpose-stack-data';
import { PurposeStackPill, type PurposeStackPillHandle } from './PurposeStackPill';
import { HeroMaskClipDef } from '@/components/ui-custom/HeroMaskClipDef';
import { usePillExpandNavigation } from '@/transitions/usePillExpandNavigation';

gsap.registerPlugin(ScrollTrigger);

interface Props {
  projects: Project[];
}

export function PurposeStack({ projects }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<PurposeStackPillHandle>(null);
  const currentIndexRef = useRef<number>(0);

  const pillDataPerPanel = useMemo<PillData[]>(
    () => projects.map((p) => computePillData(p, devotions[p.id])),
    [projects],
  );

  const { startFromPill } = usePillExpandNavigation();

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Master pinned timeline. Skips work when reducedMotion or narrow viewport.
  useLayoutEffect(() => {
    if (reducedMotion) return;
    if (typeof window !== 'undefined' && window.innerWidth <= 768) return;

    const stage = stageRef.current;
    const wrapper = wrapperRef.current;
    if (!stage || !wrapper) return;

    const panels = Array.from(stage.querySelectorAll<HTMLDivElement>('[data-ps-panel]'));
    if (panels.length === 0) return;

    const ctx = gsap.context(() => {
      // Initial state for panels 2..N.
      panels.forEach((panel, i) => {
        if (i === 0) return;
        const l = panel.querySelector<HTMLDivElement>('[data-ps-half="l"]');
        const r = panel.querySelector<HTMLDivElement>('[data-ps-half="r"]');
        if (l) gsap.set(l, { yPercent: 100 });
        if (r) gsap.set(r, { yPercent: -100 });
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapper,
          start: 'top top',
          end: () => `+=${(panels.length - 1) * window.innerHeight}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });

      panels.forEach((panel, i) => {
        if (i === 0) return;
        const l = panel.querySelector<HTMLDivElement>('[data-ps-half="l"]');
        const r = panel.querySelector<HTMLDivElement>('[data-ps-half="r"]');
        if (l) tl.to(l, { yPercent: 0, ease: 'none' }, i - 1);
        if (r) tl.to(r, { yPercent: 0, ease: 'none' }, i - 1);
      });

      // Midpoint triggers — drive the pill morph and update currentIndexRef.
      panels.forEach((_, i) => {
        if (i === 0) return;
        ScrollTrigger.create({
          trigger: wrapper,
          start: () => `top -${(i - 0.5) * window.innerHeight}px`,
          onEnter: () => {
            currentIndexRef.current = i;
            pillRef.current?.morphTo(pillDataPerPanel[i]);
          },
          onLeaveBack: () => {
            currentIndexRef.current = i - 1;
            pillRef.current?.morphTo(pillDataPerPanel[i - 1]);
          },
        });
      });
    }, wrapper);

    return () => ctx.revert();
  }, [pillDataPerPanel, reducedMotion]);

  // Scroll to top on mount (parity with current PurposeGallery).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handlePillActivate = () => {
    const i = currentIndexRef.current;
    const project = projects[i];
    const data = pillDataPerPanel[i];
    const pillRoot = pillRef.current?.getRoot();
    if (!project || !pillRoot) return;
    startFromPill({
      pillEl: pillRoot,
      pillColor: data.pillColor,
      targetUrl: `/purpose/${project.id}`,
      reducedMotion,
    });
  };

  if (pillDataPerPanel.length === 0) return null;

  return (
    <div ref={wrapperRef} className="ps-wrap relative w-full bg-[var(--app-bg)] pt-20">
      <HeroMaskClipDef />
      <div ref={stageRef} className="ps-stage relative w-full h-screen overflow-hidden">
        {projects.map((project, i) => {
          const data = pillDataPerPanel[i];
          return (
            <div
              key={project.id}
              data-ps-panel
              className="absolute inset-0 grid grid-cols-2 overflow-hidden"
              style={{ zIndex: i + 1, backgroundColor: data.pillColor }}
            >
              <div
                data-ps-half="l"
                className="relative overflow-hidden will-change-transform"
                style={{
                  backgroundImage: `url(${data.leftImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div
                data-ps-half="r"
                className="relative overflow-hidden will-change-transform"
                style={{
                  backgroundImage: `url(${data.rightImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/15 pointer-events-none" />
            </div>
          );
        })}

        <PurposeStackPill
          ref={pillRef}
          initial={pillDataPerPanel[0]}
          onActivate={handlePillActivate}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: no errors. If `gsap/all` is not the project's existing import (it is — see `MoodBoard.tsx` and `PurposeGrid.tsx`), use whatever path the rest of the project uses for `ScrollTrigger`.

- [ ] **Step 3: Smoke test that the file imports cleanly**

```bash
node --input-type=module -e "import('./src/components/sections/PurposeStack.tsx').then(() => console.log('ok')).catch((e) => { console.error(e); process.exit(1); })" 2>&1 | head -5 || true
```

Expected: this will likely fail because of the TSX extension and Vite-only imports — that's fine, the real verification is in the browser in Task 8. Just confirm the TypeScript check passed in Step 2.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/PurposeStack.tsx
git commit -m "$(cat <<'EOF'
feat(purpose-stack): desktop component with pinned split-reveal timeline

PurposeStack pins the stage, stacks N panels absolutely, and drives the
opposing-direction split via a single scrubbed timeline. Midpoint
triggers call pillRef.morphTo to update the fixed center pill. Pill
click goes through usePillExpandNavigation. Mobile and reduced-motion
fall through (handled in next task).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: PurposeStack mobile + reduced-motion fallbacks

**Why:** Pinned scrub is poor on touch and outright wrong with reduced motion. Render the same panel content vertically with a per-panel pill and a one-shot entrance animation (no pin, no scrub).

**Files:**
- Modify: `src/components/sections/PurposeStack.tsx`

- [ ] **Step 1: Add the fallback render path**

Edit `src/components/sections/PurposeStack.tsx`. After the existing `if (pillDataPerPanel.length === 0) return null;` line, add a fallback branch BEFORE the existing `return` block. Modified region:

```tsx
  if (pillDataPerPanel.length === 0) return null;

  const useFallback =
    reducedMotion ||
    (typeof window !== 'undefined' && window.innerWidth <= 768);

  if (useFallback) {
    return (
      <FallbackStack
        projects={projects}
        pillDataPerPanel={pillDataPerPanel}
        onPillActivate={(i) => {
          const project = projects[i];
          const data = pillDataPerPanel[i];
          if (!project) return;
          // No shared pill in fallback; pass the activated panel's pill root.
          const root = document.querySelector<HTMLDivElement>(
            `[data-ps-fallback-panel="${i}"] [data-ps-fallback-pill]`,
          );
          if (!root) return;
          startFromPill({
            pillEl: root,
            pillColor: data.pillColor,
            targetUrl: `/purpose/${project.id}`,
            reducedMotion,
          });
        }}
      />
    );
  }

  return (
    /* …existing desktop JSX… */
  );
```

Then add the `FallbackStack` component at the bottom of the file, before the final closing brace of the module:

```tsx
function FallbackStack({
  projects,
  pillDataPerPanel,
  onPillActivate,
}: {
  projects: Project[];
  pillDataPerPanel: PillData[];
  onPillActivate: (index: number) => void;
}) {
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reducedMotion) return;

    const ctx = gsap.context(() => {
      const panels = gsap.utils.toArray<HTMLDivElement>('[data-ps-fallback-panel]');
      panels.forEach((panel) => {
        const l = panel.querySelector<HTMLDivElement>('[data-ps-half="l"]');
        const r = panel.querySelector<HTMLDivElement>('[data-ps-half="r"]');
        if (l) gsap.set(l, { yPercent: 100 });
        if (r) gsap.set(r, { yPercent: -100 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: panel,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        });
        if (l) tl.to(l, { yPercent: 0, duration: 1.0, ease: 'power3.out' }, 0);
        if (r) tl.to(r, { yPercent: 0, duration: 1.0, ease: 'power3.out' }, 0);
      });
    });

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <div className="ps-wrap relative w-full bg-[var(--app-bg)] pt-20">
      <HeroMaskClipDef />
      {projects.map((project, i) => {
        const data = pillDataPerPanel[i];
        return (
          <section
            key={project.id}
            data-ps-fallback-panel={i}
            className="relative w-full h-screen overflow-hidden grid grid-cols-2"
            style={{ backgroundColor: data.pillColor }}
          >
            <div
              data-ps-half="l"
              className="relative overflow-hidden will-change-transform"
              style={{
                backgroundImage: `url(${data.leftImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div
              data-ps-half="r"
              className="relative overflow-hidden will-change-transform"
              style={{
                backgroundImage: `url(${data.rightImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/15 pointer-events-none" />
            <div data-ps-fallback-pill>
              <PurposeStackPill
                initial={data}
                onActivate={() => onPillActivate(i)}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/PurposeStack.tsx
git commit -m "$(cat <<'EOF'
feat(purpose-stack): mobile + reduced-motion fallback

Skip the pin/scrub on viewports ≤768px or when prefers-reduced-motion
is set. Each panel renders vertically in flow with its own per-panel
static pill; the split entrance plays once per panel via a non-pinned
ScrollTrigger (reduced-motion skips that too).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Wire PurposeStack into /purpose, delete PurposeGallery, full verification

**Why:** Replace the route's component and remove the old file. This is the gate where the user-visible behavior changes.

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/sections/PurposeGallery.tsx`

- [ ] **Step 1: Swap the import and the route element**

Edit `src/App.tsx`. Change line 12:

```tsx
import { PurposeGallery } from '@/components/sections/PurposeGallery';
```

to:

```tsx
import { PurposeStack } from '@/components/sections/PurposeStack';
```

Change the `/purpose` route element (line 142-147) from:

```tsx
<Route
  path="/purpose"
  element={
    <PurposeGallery projects={projects} onProjectClick={handleProjectClick} />
  }
/>
```

to:

```tsx
<Route
  path="/purpose"
  element={<PurposeStack projects={projects} />}
/>
```

Note: `PurposeStack` does not take an `onProjectClick` prop — the pill click goes through `usePillExpandNavigation` directly, bypassing the standard `transition.beginNavigation` flow (matching Zone 8's behavior).

- [ ] **Step 2: Delete the old component**

```bash
git rm src/components/sections/PurposeGallery.tsx
```

- [ ] **Step 3: Verify no other references to PurposeGallery remain**

```bash
grep -r "PurposeGallery" src --include="*.ts" --include="*.tsx"
```

Expected: no matches. If anything appears, remove that reference.

- [ ] **Step 4: Type-check + full test suite**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm test
```

Expected: TypeScript clean, all tests pass.

- [ ] **Step 5: Browser verification — desktop**

```bash
npm run dev
```

In Chrome at desktop width (≥1024px), navigate to `/purpose` and verify each item below. If any fails, stop, fix, and re-verify.

1. **Resting state:** First panel fully visible, split image (left = restoration1 thumb, right = restoration1 firstMoodboardImage). Pill centered, color = first project's `overlayColor`, text reads `Devotion / Beside Still Waters / Peace / Psalm 23:2–3 ↗`. No animation plays on load.

2. **Scroll forward:** As you scroll, the page pins. The next panel's left half rises from below; the right half drops from above; they meet at the divider. At the halfway crossing, the pill's four lines all rise upward to the next devotion, and the pill background crossfades.

3. **Continue scrolling:** Pin holds across all 11 panels. Total pinned distance ≈ 10 × viewport height.

4. **Scroll backward:** Reverses cleanly. Pill content reverses too (frames rise back from above).

5. **Pill click:** Click the centered pill. The expand-to-fullscreen morph runs, page navigates to `/purpose/:id` of the currently centered devotion, cover fades.

6. **Keyboard:** Tab into the pill, press Enter — same morph runs.

7. **Pin cleanup:** After navigating away (and back via browser back button), no leftover pin/scroll-lock. Page scrolls normally elsewhere. Check the DevTools console for `ScrollTrigger` warnings — none expected.

- [ ] **Step 6: Browser verification — mobile fallback**

In Chrome DevTools, switch to a mobile viewport (≤768px wide). Reload `/purpose`.

1. No pin. Panels render vertically; user scrolls normally.
2. Each panel's split-reveal entrance plays once as it enters the viewport.
3. Each panel has its own pill in the center, with its own static content.
4. Pill click runs the same expand-to-fullscreen morph and navigates.

- [ ] **Step 7: Browser verification — reduced motion**

Back at desktop width, in DevTools Rendering panel, force `prefers-reduced-motion: reduce`. Reload `/purpose`.

1. No pin. Panels render vertically (same fallback layout).
2. No entrance animation. Panels are immediately visible.
3. Pill click navigates with near-instant cover morph.

- [ ] **Step 8: Verify Zone 8 still works (regression guard)**

Navigate to `/purpose/strength`, scroll to the bottom, click the Zone 8 pill. The cinematic morph should run exactly as before (visually unchanged from baseline).

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "$(cat <<'EOF'
feat(purpose): mount PurposeStack on /purpose, retire PurposeGallery

Replaces the /purpose route's stacked listing with the scroll-pinned
opposing-direction split-reveal mechanic. The fixed center pill morphs
its four lines upward and crossfades color at each panel's halfway
point; clicking the pill runs the same expand-to-fullscreen morph as
Zone 8 and routes to /purpose/:id of the centered devotion. Mobile and
reduced-motion fall through to a per-panel static stack.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review (post-implementation)

After Task 8 lands, sanity-check against the spec's acceptance criteria. None of these need code changes if everything went well; this is the gate before declaring done.

| Criterion | How to verify |
| --- | --- |
| 1. First panel resting state correct | Visual on `/purpose` load — first devotion's images + pill content + color. |
| 2. Split + pill morph at halfway | Slow scroll on desktop. |
| 3. Pin holds all 11 panels | Scroll counter or distance estimate. |
| 4. Pill click → expand → navigate | Click test. |
| 5. Reverse scroll reverses cleanly | Scroll up. |
| 6. Mobile fallback works | DevTools mobile viewport. |
| 7. Reduced motion bypasses | Force in DevTools Rendering. |
| 8. Zone 8 unchanged | Click Zone 8 pill on a devotion page. |
| 9. No console errors / no pin leak | DevTools console after route changes. |
| 10. No layout shift / no long tasks | DevTools Performance panel — compare to current baseline before merging. |

If any criterion fails, file a follow-up issue or open a fix commit on the same branch. Do not merge with criteria #1–#9 failing; #10 is advisory.

---

## Out of scope (do not implement here)

- "Return to Home" tail beat after the last panel.
- Hoisting `HeroMaskClipDef` to a layout root.
- Filter tabs on `/purpose`.
- The `TODO(handoff)` cleanup in `devotions.ts` and `PurposeDetail.tsx`.
- **Async dominant-color refinement for the pill.** The spec describes refining `pillColor` via `extractDominantColor(project.thumbnail)` with `project.overlayColor` as the sync fallback. This plan uses the sync `overlayColor` directly — the `restorationOverlays` palette in `data/projects.ts` was sampled per photo, so the visual difference is small. If the QA pass shows a noticeable mismatch on any panel, add the refinement in a follow-up: kick off `extractDominantColor` for each panel on mount, store the refined color in a ref-map, and have midpoint triggers consult the map before calling `pill.morphTo`.
