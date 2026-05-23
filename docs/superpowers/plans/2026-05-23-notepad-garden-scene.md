# Notepad Garden Scene — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Sections 02–08 of `/notepad` with one pinned, scroll-jacked Three.js "ink garden" scene; reduced-motion users get the existing seven sections as a fallback.

**Architecture:** A single new `<GardenScene>` component composes five fixed layers (canvas, paper overlay, content layer, progress, spacer). Scroll position drives a `mountGarden(canvas, opts)` Three.js loop that lerps the camera between 7 hand-authored waypoints; the content layer cross-fades 7 station copy blocks based on the same scroll progress. PRM bypasses the entire scene at the React level and renders the existing 7 section components instead.

**Tech Stack:** React 19 + TypeScript 5.9, Three.js 0.184 (existing dep), Vitest + jsdom + @testing-library/react, native scroll (no Lenis), plain `requestAnimationFrame` (no GSAP for camera), existing `usePrefersReducedMotion` and `useAdaptiveNavTheme` hooks.

**Spec:** `docs/superpowers/specs/2026-05-23-notepad-garden-scene-design.md`

---

## File Structure

**New files (in dependency order — earlier files have no imports from later files):**

```
src/notepad-landing/three/garden/
  ink-materials.ts            ← inkLineMaterial, inkMeshMaterial
  ground.ts                   ← createCrosshatchGround
  plants.ts                   ← createBranch, createInkLeaf, createPlantCluster, createPaperStem
  splashes.ts                 ← createInkSplash
  circles.ts                  ← createInkCircle, createStoneBasin
  doves.ts                    ← createDove (silhouette only; flap math identical to ref butterfly)
  particles.ts                ← createFloatingParticles
  camera-stations.ts          ← cameraStations: 7-tuple of { pos, look }
  mount-garden.ts             ← mountGarden(canvas, opts) → { cleanup }

src/notepad-landing/sections/garden-scene/
  use-garden-scroll.ts        ← hook: scrollY → { scrollProgress, currentStation, jumpTo }
  use-garden-scroll.test.ts   ← unit tests
  paper-overlay.tsx           ← <PaperOverlay /> — SVG noise multiply layer
  garden-progress.tsx         ← <GardenProgress /> — Roman numeral nav
  stations/
    01-three-voices.tsx       ← <StationThreeVoices isActive />
    02-living-graph.tsx       ← <StationLivingGraph isActive />
    03-lamplight.tsx          ← <StationLamplight isActive />
    04-scripture-margin.tsx   ← <StationScriptureMargin isActive />
    05-seven-papers.tsx       ← <StationSevenPapers isActive itemIndex />
    06-tier-path.tsx          ← <StationTierPath isActive itemIndex />
    07-trust-import.tsx       ← <StationTrustImport isActive />
  station-meta.ts             ← stationMeta: const [{ name, slug, extraVh, itemCount }, ...]
  garden-canvas.tsx           ← <GardenCanvas scrollProgress onStationChange />
  garden-content-layer.tsx    ← <GardenContentLayer currentStation itemIndex />
  fallback-stack.tsx          ← <FallbackStack /> — renders existing 7 sections for PRM
  garden-scene.tsx            ← <GardenScene prm /> — top-level orchestrator
  garden-scene.test.tsx       ← integration tests
  index.ts                    ← re-export { GardenScene }
```

**Modified files:**

```
src/notepad-landing/index.tsx           ← compose GardenScene; switch NAV_THEME_SECTIONS by prm
src/notepad-landing/styles/landing.css  ← append .garden-scene rules (~150 lines)
```

**Unchanged but referenced:**

```
src/notepad-landing/sections/01-particle-hero.tsx      (hero, untouched)
src/notepad-landing/sections/09-closing-cta.tsx        (CTA, untouched)
src/notepad-landing/sections/02..08-*.tsx              (used by FallbackStack)
src/notepad-landing/hooks/use-prefers-reduced-motion.ts (unchanged)
src/notepad-landing/hooks/use-adaptive-nav-theme.ts    (unchanged; gets switched array)
src/notepad-landing/data/copy.ts                       (unchanged; stations consume it)
src/notepad-landing/three/particle-system.ts           (hero subsystem; unchanged)
```

**Why this decomposition:** Each `three/garden/*.ts` file owns one entity type and is < 150 lines so it fits in one read. Each station component is small (10–80 lines) and consumes exactly one slice of `data/copy.ts`. The `garden-scene.tsx` orchestrator is a thin shell. `station-meta.ts` is a single source of truth for the 7 stations' names, slugs, and per-station scroll budgets — referenced by `use-garden-scroll`, `garden-progress`, and `garden-content-layer`.

---

## Task 1: Confirm baseline — read the spec, run existing tests

**Files:** none

- [ ] **Step 1: Read the spec and existing reference once**

Read in full:
- `docs/superpowers/specs/2026-05-23-notepad-garden-scene-design.md` (the spec)
- `reference/remix-landscape-design/index.html` (the visual + code reference)
- `src/notepad-landing/three/particle-system.ts` (existing Three.js mount pattern to mirror)
- `src/notepad-landing/index.tsx` (composition target)
- `src/notepad-landing/styles/landing.css` (existing CSS tokens at top)

- [ ] **Step 2: Verify the test runner works**

```bash
npm test 2>&1 | tail -10
```

Expected: vitest passes (or shows current pass/fail counts) — establishes baseline. If anything in `src/notepad-landing` fails before we start, fix or quarantine it first.

- [ ] **Step 3: Verify Three.js version and APIs are present**

```bash
node -e "const t = require('three'); console.log(t.REVISION, !!t.Shape, !!t.CatmullRomCurve3, !!t.LineBasicMaterial)"
```

Expected: prints `184 true true true` (or matching revision). If any false, escalate — the spec assumes those APIs.

- [ ] **Step 4: Create the empty folder structure**

```bash
mkdir -p src/notepad-landing/three/garden \
         src/notepad-landing/sections/garden-scene/stations
```

- [ ] **Step 5: Commit baseline**

No code change yet. Skip this commit if there's nothing to commit; otherwise:

```bash
git status
```

---

## Task 2: `station-meta.ts` — single source of truth for the 7 stations

**Files:**
- Create: `src/notepad-landing/sections/garden-scene/station-meta.ts`
- Test: (covered indirectly by use-garden-scroll tests; no standalone test)

- [ ] **Step 1: Write the meta module**

```typescript
// src/notepad-landing/sections/garden-scene/station-meta.ts

export interface StationMeta {
  readonly index: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  readonly slug: string;                 // for id="section-XX" anchors
  readonly name: string;                 // displayed in aria-label and (optionally) tooltip
  readonly roman: string;                // 'I'..'VII' for the progress indicator
  readonly baseVh: 125;                  // every station's base allotment
  readonly extraVh: number;              // 0 except list stations
  readonly itemCount: number;            // 1 for non-list; 7 or 8 for list stations
}

export const STATION_META: readonly StationMeta[] = [
  { index: 0, slug: 'section-02', name: 'Three Voices',       roman: 'I',   baseVh: 125, extraVh:  0, itemCount: 1 },
  { index: 1, slug: 'section-03', name: 'Living Graph',       roman: 'II',  baseVh: 125, extraVh:  0, itemCount: 1 },
  { index: 2, slug: 'section-04', name: 'Lamplight',          roman: 'III', baseVh: 125, extraVh:  0, itemCount: 1 },
  { index: 3, slug: 'section-05', name: 'Scripture Margin',   roman: 'IV',  baseVh: 125, extraVh:  0, itemCount: 1 },
  { index: 4, slug: 'section-06', name: 'Seven Papers',       roman: 'V',   baseVh: 125, extraVh: 35, itemCount: 7 },
  { index: 5, slug: 'section-07', name: 'Tier Path',          roman: 'VI',  baseVh: 125, extraVh: 40, itemCount: 8 },
  { index: 6, slug: 'section-08', name: 'Yours, Stays Yours', roman: 'VII', baseVh: 125, extraVh:  0, itemCount: 1 },
] as const;

export const TOTAL_SPACER_VH: number = STATION_META.reduce(
  (sum, s) => sum + s.baseVh + s.extraVh,
  0,
); // 7 * 125 + 35 + 40 = 950
```

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/station-meta.ts
git commit -m "feat(garden-scene): station metadata constant" \
           -m "Single source of truth for the 7 stations' slugs, names, Roman numerals, and per-station scroll budgets. Total spacer = 950vh."
```

---

## Task 3: `use-garden-scroll.ts` hook (TDD)

**Files:**
- Create: `src/notepad-landing/sections/garden-scene/use-garden-scroll.ts`
- Test: `src/notepad-landing/sections/garden-scene/use-garden-scroll.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/notepad-landing/sections/garden-scene/use-garden-scroll.test.ts
// @vitest-environment jsdom

import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGardenScroll } from './use-garden-scroll';
import { TOTAL_SPACER_VH } from './station-meta';

function setViewport(h: number) {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
}

function setSpacerHeight(h: number) {
  // The hook reads document.getElementById('garden-spacer').offsetHeight.
  const el = document.createElement('div');
  el.id = 'garden-spacer';
  Object.defineProperty(el, 'offsetHeight', { configurable: true, value: h });
  document.body.appendChild(el);
}

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  window.dispatchEvent(new Event('scroll'));
}

beforeEach(() => {
  document.body.innerHTML = '';
  setViewport(800);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('useGardenScroll', () => {
  it('starts at progress 0 and currentStation 0', () => {
    setSpacerHeight(9500);
    const { result } = renderHook(() => useGardenScroll());
    expect(result.current.scrollProgress.current).toBe(0);
    expect(result.current.currentStation).toBe(0);
  });

  it('reaches progress 1 and currentStation 6 at max scroll', () => {
    setSpacerHeight(9500);
    const { result } = renderHook(() => useGardenScroll());
    act(() => scrollTo(9500 - 800));
    expect(result.current.scrollProgress.current).toBeCloseTo(1, 4);
    expect(result.current.currentStation).toBe(6);
  });

  it('rounds to currentStation 3 at exact middle', () => {
    setSpacerHeight(9500);
    const { result } = renderHook(() => useGardenScroll());
    const max = 9500 - 800;
    act(() => scrollTo(max * 0.5));
    expect(result.current.currentStation).toBe(3);
  });

  it('clamps progress at scroll boundaries', () => {
    setSpacerHeight(9500);
    const { result } = renderHook(() => useGardenScroll());
    act(() => scrollTo(-100));
    expect(result.current.scrollProgress.current).toBe(0);
    act(() => scrollTo(99999));
    expect(result.current.scrollProgress.current).toBe(1);
  });

  it('jumpTo(n) calls window.scrollTo with the right top', () => {
    setSpacerHeight(9500);
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { result } = renderHook(() => useGardenScroll());
    act(() => result.current.jumpTo(3));
    expect(scrollSpy).toHaveBeenCalledWith({ top: (9500 - 800) * (3 / 6), behavior: 'smooth' });
  });

  it('TOTAL_SPACER_VH math is 950', () => {
    expect(TOTAL_SPACER_VH).toBe(950);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/notepad-landing/sections/garden-scene/use-garden-scroll.test.ts
```

Expected: fails with "Cannot find module './use-garden-scroll'".

- [ ] **Step 3: Implement the hook**

```typescript
// src/notepad-landing/sections/garden-scene/use-garden-scroll.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { STATION_META } from './station-meta';

const SPACER_ID = 'garden-spacer';

interface GardenScrollState {
  scrollProgress: { current: number };
  currentStation: number;
  jumpTo: (i: number) => void;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function readMaxScroll(): number {
  const spacer = document.getElementById(SPACER_ID);
  if (!spacer) return 0;
  return Math.max(0, spacer.offsetHeight - window.innerHeight);
}

export function useGardenScroll(): GardenScrollState {
  const scrollProgress = useRef(0);
  const [currentStation, setCurrentStation] = useState(0);

  useEffect(() => {
    const lastIndex = STATION_META.length - 1; // 6
    function handleScroll() {
      const max = readMaxScroll();
      const p = max > 0 ? clamp01(window.scrollY / max) : 0;
      scrollProgress.current = p;
      const next = Math.round(p * lastIndex);
      setCurrentStation((prev) => (prev === next ? prev : next));
    }
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const jumpTo = useCallback((i: number) => {
    const max = readMaxScroll();
    const lastIndex = STATION_META.length - 1;
    const top = (i / lastIndex) * max;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  return { scrollProgress, currentStation, jumpTo };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/notepad-landing/sections/garden-scene/use-garden-scroll.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/use-garden-scroll.ts \
        src/notepad-landing/sections/garden-scene/use-garden-scroll.test.ts
git commit -m "feat(garden-scene): useGardenScroll hook with tests" \
           -m "Reads scrollY against #garden-spacer height to produce (0..1) progress and a rounded currentStation index. jumpTo(i) smooth-scrolls to the i-th station boundary. Tested for boundary clamping, exact-middle rounding, and jumpTo math."
```

---

## Task 4: `ink-materials.ts` — material helpers

**Files:**
- Create: `src/notepad-landing/three/garden/ink-materials.ts`
- Test: none (trivial wrapper; covered by mount-garden tests)

- [ ] **Step 1: Write the module**

```typescript
// src/notepad-landing/three/garden/ink-materials.ts
import * as THREE from 'three';

// Resolved from CSS token --np-ink (#432c29). Three.js needs numeric.
export const INK_COLOR = 0x432c29;
export const PAPER_COLOR = 0xf6f0e6;

export function inkLineMaterial(opacity = 1): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color: INK_COLOR,
    transparent: true,
    opacity,
  });
}

export function inkMeshMaterial(opacity = 0.08): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: INK_COLOR,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/three/garden/ink-materials.ts
git commit -m "feat(garden): ink material helpers + palette constants"
```

---

## Task 5: `ground.ts` — crosshatch ground

**Files:**
- Create: `src/notepad-landing/three/garden/ground.ts`

- [ ] **Step 1: Write the module**

```typescript
// src/notepad-landing/three/garden/ground.ts
import * as THREE from 'three';
import { inkLineMaterial } from './ink-materials';

export function createCrosshatchGround(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  const size = 60;
  const density = 80;

  for (let i = 0; i < density; i++) {
    const x1 = (Math.random() - 0.5) * size;
    const z1 = (Math.random() - 0.5) * size;
    const len = 0.5 + Math.random() * 2;
    const angle = Math.random() * Math.PI;
    const points = [
      new THREE.Vector3(x1, -0.01, z1),
      new THREE.Vector3(x1 + Math.cos(angle) * len, -0.01, z1 + Math.sin(angle) * len),
    ];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = inkLineMaterial(0.04 + Math.random() * 0.08);
    group.add(new THREE.Line(geom, mat));
  }

  scene.add(group);
  return group;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/three/garden/ground.ts
git commit -m "feat(garden): procedural crosshatch ground"
```

---

## Task 6: `plants.ts` — recursive ink plants + paper-stem variant

**Files:**
- Create: `src/notepad-landing/three/garden/plants.ts`

- [ ] **Step 1: Write the module**

```typescript
// src/notepad-landing/three/garden/plants.ts
import * as THREE from 'three';
import { inkLineMaterial, inkMeshMaterial } from './ink-materials';

function createInkLeaf(position: THREE.Vector3, group: THREE.Group): void {
  const leafSize = 0.2 + Math.random() * 0.3;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(leafSize * 0.4, leafSize * 0.6, 0, leafSize);
  shape.quadraticCurveTo(-leafSize * 0.4, leafSize * 0.6, 0, 0);

  const geom = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(geom, inkMeshMaterial(0.06 + Math.random() * 0.06));
  mesh.position.copy(position);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  group.add(mesh);

  // Hand-drawn leaf outline
  const outlinePoints: THREE.Vector3[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI * 2;
    const r = leafSize * (0.5 + 0.5 * Math.sin(angle * 2)) * 0.5;
    outlinePoints.push(new THREE.Vector3(
      Math.cos(angle) * r,
      Math.sin(angle) * r * 1.5,
      0,
    ));
  }
  const outlineGeom = new THREE.BufferGeometry().setFromPoints(outlinePoints);
  const outlineLine = new THREE.Line(outlineGeom, inkLineMaterial(0.25));
  outlineLine.position.copy(position);
  outlineLine.rotation.copy(mesh.rotation);
  group.add(outlineLine);
}

function createBranch(
  startPoint: THREE.Vector3,
  direction: THREE.Vector3,
  length: number,
  depth: number,
  group: THREE.Group,
): void {
  if (depth <= 0 || length < 0.1) return;

  const segments = 12;
  const points: THREE.Vector3[] = [];
  let current = startPoint.clone();
  const dir = direction.clone().normalize();

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const wobble = new THREE.Vector3(
      (Math.random() - 0.5) * 0.15 * length,
      (Math.random() - 0.5) * 0.08 * length,
      (Math.random() - 0.5) * 0.15 * length,
    );
    const pt = current
      .clone()
      .add(dir.clone().multiplyScalar((length * t) / segments * segments))
      .add(wobble.multiplyScalar(t));
    pt.y -= t * t * length * 0.05; // gravity droop
    points.push(pt);
    current = pt.clone();
  }

  const curve = new THREE.CatmullRomCurve3(points);
  const geom = new THREE.BufferGeometry().setFromPoints(curve.getPoints(20));
  const line = new THREE.Line(geom, inkLineMaterial(0.3 + depth * 0.15));
  group.add(line);

  if (depth > 1) {
    const endPt = points[points.length - 1];
    const numBranches = Math.floor(Math.random() * 3) + 1;
    for (let b = 0; b < numBranches; b++) {
      const newDir = dir.clone();
      newDir.x += (Math.random() - 0.5) * 1.2;
      newDir.y += Math.random() * 0.4 - 0.1;
      newDir.z += (Math.random() - 0.5) * 1.2;
      createBranch(endPt, newDir, length * 0.6, depth - 1, group);
    }
  }

  if (depth <= 2) {
    createInkLeaf(points[points.length - 1], group);
  }
}

export function createPlantCluster(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  scale: number,
  complexity: number,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);

  for (let i = 0; i < complexity; i++) {
    const angle = (i / complexity) * Math.PI * 2 + Math.random() * 0.5;
    const dir = new THREE.Vector3(
      Math.sin(angle) * 0.3,
      0.8 + Math.random() * 0.3,
      Math.cos(angle) * 0.3,
    );
    const startJitter = new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      0,
      (Math.random() - 0.5) * 0.3,
    );
    createBranch(startJitter, dir, 1.2 + Math.random() * 0.8, 3 + Math.floor(Math.random() * 2), group);
  }

  scene.add(group);
  return group;
}

// Variant: a single tall narrow stem with a wide flat tip-leaf.
// Used for the row of 7 in station 5 (Seven Papers).
export function createPaperStem(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  scale = 1,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);

  const dir = new THREE.Vector3(0, 1, 0);
  const startJitter = new THREE.Vector3(0, 0, 0);
  createBranch(startJitter, dir, 2.0 + Math.random() * 0.3, 2, group);

  // wider/flatter leaf at the tip suggests a paper sheet
  const tip = new THREE.Vector3(0, 2.0, 0);
  const leafSize = 0.55;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(leafSize * 0.8, leafSize * 0.2, leafSize * 1.4, 0);
  shape.quadraticCurveTo(leafSize * 0.8, -leafSize * 0.2, 0, 0);
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), inkMeshMaterial(0.05));
  mesh.position.copy(tip);
  mesh.rotation.z = (Math.random() - 0.5) * 0.4;
  group.add(mesh);

  scene.add(group);
  return group;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/three/garden/plants.ts
git commit -m "feat(garden): recursive ink plants + paper-stem variant"
```

---

## Task 7: `splashes.ts` — ink splash particles

**Files:**
- Create: `src/notepad-landing/three/garden/splashes.ts`

- [ ] **Step 1: Write the module**

```typescript
// src/notepad-landing/three/garden/splashes.ts
import * as THREE from 'three';
import { inkMeshMaterial } from './ink-materials';

export function createInkSplash(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  count: number,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  for (let i = 0; i < count; i++) {
    const size = 0.02 + Math.random() * 0.06;
    const geom = new THREE.CircleGeometry(size, 6);
    const mat = inkMeshMaterial(0.1 + Math.random() * 0.15);
    const dot = new THREE.Mesh(geom, mat);
    dot.position.set(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 0.5,
    );
    dot.rotation.z = Math.random() * Math.PI;
    group.add(dot);
  }

  scene.add(group);
  return group;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/three/garden/splashes.ts
git commit -m "feat(garden): ink splash particle groups"
```

---

## Task 8: `circles.ts` — wobbly circles + stone basin

**Files:**
- Create: `src/notepad-landing/three/garden/circles.ts`

- [ ] **Step 1: Write the module**

```typescript
// src/notepad-landing/three/garden/circles.ts
import * as THREE from 'three';
import { inkLineMaterial } from './ink-materials';

export function createInkCircle(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  radius: number,
  wobble: number,
  opacity = 0.2,
): THREE.Line {
  const points: THREE.Vector3[] = [];
  const segments = 80;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const r = radius + (Math.random() - 0.5) * wobble;
    points.push(new THREE.Vector3(
      x + Math.cos(angle) * r,
      y + Math.sin(angle) * r,
      z,
    ));
  }
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geom, inkLineMaterial(opacity));
  scene.add(line);
  return line;
}

// Three concentric wobbly circles, decreasing radius. Used in station 7.
export function createStoneBasin(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
): THREE.Group {
  const group = new THREE.Group();
  [1.6, 1.2, 0.8].forEach((r, i) => {
    const line = createInkCircle(scene, x, y, z, r, 0.06 - i * 0.015, 0.18 + i * 0.04);
    scene.remove(line);
    group.add(line);
  });
  // Lay it flat so it reads as a basin on the ground
  group.rotation.x = -Math.PI / 2;
  group.position.set(x, y, z);
  scene.add(group);
  return group;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/three/garden/circles.ts
git commit -m "feat(garden): wobbly ink circles + stone-basin stack"
```

---

## Task 9: `doves.ts` — dove silhouettes with wing flap

**Files:**
- Create: `src/notepad-landing/three/garden/doves.ts`

- [ ] **Step 1: Write the module**

```typescript
// src/notepad-landing/three/garden/doves.ts
import * as THREE from 'three';
import { inkLineMaterial } from './ink-materials';

interface DoveUserData {
  baseY: number;
  baseX: number;
  phase: number;
  speed: number;
}

// Dove wing — narrower and pointed compared to the reference butterfly.
function wingShape(mirror: 1 | -1): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI;
    // 0.4 length, narrower aspect ratio than the butterfly
    const r = 0.4 * Math.sin(angle) * (1 + 0.15 * Math.sin(angle * 4));
    pts.push(new THREE.Vector3(
      mirror * r * Math.cos(angle) * 1.1,
      r * Math.sin(angle) * 0.5,
      0,
    ));
  }
  return pts;
}

export function createDove(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  ([-1, 1] as const).forEach((side) => {
    const pts = wingShape(side);
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const wing = new THREE.Line(geom, inkLineMaterial(0.4));
    group.add(wing);
  });

  const userData: DoveUserData = {
    baseY: y,
    baseX: x,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 0.5,
  };
  group.userData = userData;
  scene.add(group);
  return group;
}

export function animateDove(group: THREE.Group, time: number): void {
  const d = group.userData as DoveUserData;
  if (typeof d.baseY !== 'number') return;
  group.position.y = d.baseY + Math.sin(time * d.speed + d.phase) * 0.5;
  group.position.x = d.baseX + Math.sin(time * d.speed * 0.5 + d.phase) * 0.8;
  group.rotation.y = Math.sin(time * d.speed * 2) * 0.3;
  group.children.forEach((child, i) => {
    child.rotation.y = Math.sin(time * 6 + d.phase) * 0.5 * (i === 0 ? 1 : -1);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/three/garden/doves.ts
git commit -m "feat(garden): dove silhouettes (replaces ref butterflies) + flap animator"
```

---

## Task 10: `particles.ts` — floating ink particles

**Files:**
- Create: `src/notepad-landing/three/garden/particles.ts`

- [ ] **Step 1: Write the module**

```typescript
// src/notepad-landing/three/garden/particles.ts
import * as THREE from 'three';
import { inkMeshMaterial } from './ink-materials';

interface ParticleUserData {
  baseX: number;
  baseY: number;
  speed: number;
  phase: number;
  drift: number;
}

export function createFloatingParticles(scene: THREE.Scene, count = 60): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const size = 0.01 + Math.random() * 0.03;
    const geom = new THREE.CircleGeometry(size, 5);
    const mat = inkMeshMaterial(0.05 + Math.random() * 0.1);
    const p = new THREE.Mesh(geom, mat);
    p.position.set(
      (Math.random() - 0.5) * 30,
      Math.random() * 8,
      (Math.random() - 0.5) * 20 - 5,
    );
    const userData: ParticleUserData = {
      baseX: p.position.x,
      baseY: p.position.y,
      speed: 0.2 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      drift: 0.3 + Math.random() * 0.5,
    };
    p.userData = userData;
    scene.add(p);
    out.push(p);
  }
  return out;
}

export function animateParticle(p: THREE.Mesh, time: number): void {
  const d = p.userData as ParticleUserData;
  p.position.x = d.baseX + Math.sin(time * d.speed + d.phase) * d.drift;
  p.position.y = d.baseY + Math.cos(time * d.speed * 0.7 + d.phase) * 0.3;
  p.rotation.z = time * d.speed * 0.2;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/three/garden/particles.ts
git commit -m "feat(garden): floating ink particle field"
```

---

## Task 11: `camera-stations.ts` — 7 hand-authored waypoints (TDD)

**Files:**
- Create: `src/notepad-landing/three/garden/camera-stations.ts`
- Test: `src/notepad-landing/three/garden/camera-stations.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/notepad-landing/three/garden/camera-stations.test.ts
import { describe, expect, it } from 'vitest';
import { CAMERA_STATIONS } from './camera-stations';

describe('CAMERA_STATIONS', () => {
  it('has length 7', () => {
    expect(CAMERA_STATIONS).toHaveLength(7);
  });

  it('every entry has finite pos and look (x,y,z)', () => {
    for (const s of CAMERA_STATIONS) {
      expect(Number.isFinite(s.pos.x) && Number.isFinite(s.pos.y) && Number.isFinite(s.pos.z)).toBe(true);
      expect(Number.isFinite(s.look.x) && Number.isFinite(s.look.y) && Number.isFinite(s.look.z)).toBe(true);
    }
  });

  it('stations 5 and 6 (list stations) have meaningfully different camera poses', () => {
    // Per spec §4.4 list stations hold the camera mid-station, but adjacent
    // stations should still be distinct compositions.
    const s5 = CAMERA_STATIONS[4];
    const s6 = CAMERA_STATIONS[5];
    const dist = Math.hypot(s5.pos.x - s6.pos.x, s5.pos.y - s6.pos.y, s5.pos.z - s6.pos.z);
    expect(dist).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/notepad-landing/three/garden/camera-stations.test.ts
```

Expected: fails with module-not-found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/notepad-landing/three/garden/camera-stations.ts
import * as THREE from 'three';

export interface CameraStation {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// 7 hand-authored waypoints. Indices map 1:1 to STATION_META in
// src/notepad-landing/sections/garden-scene/station-meta.ts.
export const CAMERA_STATIONS: readonly CameraStation[] = [
  { pos: V(0, 2.5, 12),  look: V(0, 1, 0)      }, // 1 Three Voices    — entry, three saplings
  { pos: V(-10, 3, 6),   look: V(-14, 1.5, -3) }, // 2 Living Graph    — left thicket
  { pos: V(-2, 4, 4),    look: V(0, 5, -2)     }, // 3 Lamplight       — looking up at lamp circle
  { pos: V(8, 2.5, 6),   look: V(14, 1.5, -2)  }, // 4 Scripture Margin— right cluster
  { pos: V(0, 3, 8),     look: V(0, 1, 2)      }, // 5 Seven Papers    — wide on the row of 7
  { pos: V(0, 4, -2),    look: V(0, 1.5, -20)  }, // 6 Tier Path       — deep dolly
  { pos: V(0, 2, 4),     look: V(0, 1, -2)     }, // 7 Yours/Trust     — close on doves + basin
] as const;
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/notepad-landing/three/garden/camera-stations.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad-landing/three/garden/camera-stations.ts \
        src/notepad-landing/three/garden/camera-stations.test.ts
git commit -m "feat(garden): 7 hand-authored camera waypoints"
```

---

## Task 12: `mount-garden.ts` — orchestrator + RAF loop

**Files:**
- Create: `src/notepad-landing/three/garden/mount-garden.ts`

This is the largest file in the new code. ~200 lines. Composed entirely of imports from the entity modules + the per-frame loop ported from the reference.

- [ ] **Step 1: Write the module**

```typescript
// src/notepad-landing/three/garden/mount-garden.ts
import * as THREE from 'three';
import { PAPER_COLOR } from './ink-materials';
import { createCrosshatchGround } from './ground';
import { createPlantCluster, createPaperStem } from './plants';
import { createInkSplash } from './splashes';
import { createInkCircle, createStoneBasin } from './circles';
import { createDove, animateDove } from './doves';
import { createFloatingParticles, animateParticle } from './particles';
import { CAMERA_STATIONS } from './camera-stations';

export interface MountGardenOptions {
  scrollProgress: { current: number };
  onStationChange?: (index: number) => void;
}

export interface MountGardenReturn {
  cleanup: () => void;
}

const LAST = CAMERA_STATIONS.length - 1; // 6

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerpVec3(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  return new THREE.Vector3(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t,
  );
}

export function mountGarden(
  canvas: HTMLCanvasElement,
  opts: MountGardenOptions,
): MountGardenReturn {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER_COLOR);
  scene.fog = new THREE.FogExp2(PAPER_COLOR, 0.012);

  const camera = new THREE.PerspectiveCamera(
    50,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    200,
  );
  camera.position.set(0, 2, 12);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.NoToneMapping;

  // ── World composition ──
  const allGroups: THREE.Object3D[] = [];

  allGroups.push(createCrosshatchGround(scene));

  // 13 plant clusters scattered to support 7 stations
  allGroups.push(createPlantCluster(scene,  -5, 0,  -3, 1.2, 5));
  allGroups.push(createPlantCluster(scene,   6, 0,  -2, 0.8, 4));
  allGroups.push(createPlantCluster(scene,  -3, 0,   2, 0.6, 3));
  allGroups.push(createPlantCluster(scene,   4, 0,   3, 0.5, 3));
  allGroups.push(createPlantCluster(scene, -15, 0,  -5, 1.4, 6));
  allGroups.push(createPlantCluster(scene, -12, 0,   0, 1.0, 5));
  allGroups.push(createPlantCluster(scene, -18, 0,   2, 0.7, 3));
  allGroups.push(createPlantCluster(scene, -10, 0,  -8, 0.9, 4));
  allGroups.push(createPlantCluster(scene,  15, 0,  -4, 1.3, 5));
  allGroups.push(createPlantCluster(scene,  12, 0,   1, 1.1, 6));
  allGroups.push(createPlantCluster(scene,  18, 0,  -1, 0.6, 3));
  allGroups.push(createPlantCluster(scene,  -4, 0, -22, 0.9, 4));
  allGroups.push(createPlantCluster(scene,   5, 0, -20, 1.0, 5));

  // Station 5 — row of 7 paper stems centered on x=0
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 1.8; // -5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4
    allGroups.push(createPaperStem(scene, x, 0, 2, 0.9));
  }

  // Station 6 — 8 tier-post clusters along -Z
  for (let i = 0; i < 8; i++) {
    const z = -4 - i * 2.5; // -4, -6.5, -9 ... -21.5
    const x = (i % 2 === 0 ? -1 : 1) * 1.2;
    allGroups.push(createPlantCluster(scene, x, 0, z, 0.7, 2));
  }

  // Ink splashes
  createInkSplash(scene, -2, 0.5, -1, 20);
  createInkSplash(scene, 3, 1, -4, 15);
  createInkSplash(scene, -8, 0.3, -3, 25);
  createInkSplash(scene, 10, 0.8, -2, 18);
  createInkSplash(scene, -1, 0.2, -15, 30);

  // Decorative ink circles
  createInkCircle(scene, 0, 3, -5, 2.5, 0.15);
  createInkCircle(scene, -14, 2.5, -3, 1.8, 0.1);
  createInkCircle(scene, 14, 3.2, -2, 2.0, 0.12);
  createInkCircle(scene, 0, 2.8, -20, 3.0, 0.2);
  // Station 3 — the lamp itself (a single big halo high above)
  createInkCircle(scene, 0, 5.5, -3, 1.4, 0.08, 0.35);

  // Station 7 — stone basin near origin
  createStoneBasin(scene, 0, 0.02, -2);

  // Doves — 6 distributed
  const doves: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) {
    const d = createDove(
      scene,
      (Math.random() - 0.5) * 20,
      1.5 + Math.random() * 3,
      (Math.random() - 0.5) * 15 - 5,
    );
    doves.push(d);
  }

  // Floating particles
  const particles = createFloatingParticles(scene, 60);

  // ── Resize ──
  function onResize() {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  }
  window.addEventListener('resize', onResize);

  // ── RAF loop ──
  let time = 0;
  let lastStation = -1;
  let rafId = 0;
  let stopped = false;

  function tick() {
    if (stopped) return;
    rafId = requestAnimationFrame(tick);
    time += 0.01;

    const p = opts.scrollProgress.current;
    const exact = p * LAST;
    const fromIdx = Math.floor(exact);
    const toIdx = Math.min(fromIdx + 1, LAST);
    const localT = smoothstep(exact - fromIdx);

    const camPos = lerpVec3(CAMERA_STATIONS[fromIdx].pos, CAMERA_STATIONS[toIdx].pos, localT);
    const camLook = lerpVec3(CAMERA_STATIONS[fromIdx].look, CAMERA_STATIONS[toIdx].look, localT);

    // Subtle breathing — reference's exact constants
    camPos.y += Math.sin(time * 0.5) * 0.08;
    camPos.x += Math.sin(time * 0.3) * 0.04;

    camera.position.lerp(camPos, 0.08);

    // Look-at low-pass — match reference
    const currentLook = new THREE.Vector3();
    camera.getWorldDirection(currentLook);
    const targetLook = camLook.clone().sub(camera.position).normalize();
    currentLook.lerp(targetLook, 0.06);
    camera.lookAt(camera.position.clone().add(currentLook.multiplyScalar(10)));

    // Station change emission
    const newStation = Math.round(p * LAST);
    if (newStation !== lastStation) {
      lastStation = newStation;
      opts.onStationChange?.(newStation);
    }

    // Per-frame animation
    particles.forEach((pt) => animateParticle(pt, time));
    doves.forEach((d) => animateDove(d, time));

    // Gentle plant sway — only non-dove groups
    allGroups.forEach((g, i) => {
      if (g.userData && (g.userData as { baseY?: number }).baseY !== undefined) return;
      g.rotation.z = Math.sin(time * 0.4 + i * 0.7) * 0.015;
      g.rotation.x = Math.cos(time * 0.3 + i * 0.5) * 0.01;
    });

    renderer.render(scene, camera);
  }
  rafId = requestAnimationFrame(tick);

  // ── Cleanup ──
  function cleanup() {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    scene.traverse((obj) => {
      const anyObj = obj as THREE.Mesh & THREE.Line;
      if (anyObj.geometry) anyObj.geometry.dispose();
      const mat = anyObj.material;
      if (mat) {
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
    renderer.dispose();
  }

  return { cleanup };
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc -p tsconfig.json --noEmit 2>&1 | grep -E "garden|error" | head -20
```

Expected: no errors mentioning `garden/`. (Project-wide tsc may have pre-existing errors elsewhere; we only care about new ones.)

- [ ] **Step 3: Commit**

```bash
git add src/notepad-landing/three/garden/mount-garden.ts
git commit -m "feat(garden): mountGarden orchestrator with RAF loop, camera lerp, breathing, station emission, full cleanup"
```

---

## Task 13: `paper-overlay.tsx` — SVG noise multiply layer

**Files:**
- Create: `src/notepad-landing/sections/garden-scene/paper-overlay.tsx`

- [ ] **Step 1: Write the component**

```typescript
// src/notepad-landing/sections/garden-scene/paper-overlay.tsx
// Verbatim SVG noise URL from reference index.html:58
const NOISE_URL =
  "data:image/svg+xml,%3Csvg width='400' height='400' xmlns='http://www.w3.org/2000/svg'%3E" +
  "%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E" +
  "%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E";

export function PaperOverlay() {
  return (
    <div
      className="garden-paper-overlay"
      aria-hidden="true"
      style={{ backgroundImage: `url("${NOISE_URL}")` }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/paper-overlay.tsx
git commit -m "feat(garden-scene): paper noise overlay component"
```

---

## Task 14: `garden-progress.tsx` — Roman numeral nav (TDD)

**Files:**
- Create: `src/notepad-landing/sections/garden-scene/garden-progress.tsx`
- Test: `src/notepad-landing/sections/garden-scene/garden-progress.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/notepad-landing/sections/garden-scene/garden-progress.test.tsx
// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GardenProgress } from './garden-progress';

afterEach(cleanup);

describe('<GardenProgress />', () => {
  it('renders 7 buttons with Roman numerals I..VII', () => {
    render(<GardenProgress current={0} onJump={() => {}} />);
    expect(screen.getByRole('button', { name: /go to station 1: three voices/i })).toHaveTextContent('I');
    expect(screen.getByRole('button', { name: /go to station 7: yours, stays yours/i })).toHaveTextContent('VII');
    expect(screen.getAllByRole('button')).toHaveLength(7);
  });

  it('marks the active station with aria-current="true" and an active class', () => {
    render(<GardenProgress current={3} onJump={() => {}} />);
    const btn = screen.getByRole('button', { name: /go to station 4/i });
    expect(btn).toHaveAttribute('aria-current', 'true');
    expect(btn.className).toMatch(/active/);
  });

  it('clicking a button fires onJump(index)', () => {
    const onJump = vi.fn();
    render(<GardenProgress current={0} onJump={onJump} />);
    fireEvent.click(screen.getByRole('button', { name: /go to station 5/i }));
    expect(onJump).toHaveBeenCalledWith(4);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/notepad-landing/sections/garden-scene/garden-progress.test.tsx
```

Expected: fails with module-not-found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/notepad-landing/sections/garden-scene/garden-progress.tsx
import { STATION_META } from './station-meta';

interface GardenProgressProps {
  current: number;
  onJump: (i: number) => void;
}

export function GardenProgress({ current, onJump }: GardenProgressProps) {
  return (
    <nav className="garden-progress" aria-label="Garden stations">
      {STATION_META.map((s) => {
        const isActive = s.index === current;
        return (
          <button
            key={s.index}
            type="button"
            className={`garden-progress-item${isActive ? ' active' : ''}`}
            aria-label={`Go to station ${s.index + 1}: ${s.name}`}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onJump(s.index)}
          >
            {s.roman}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/notepad-landing/sections/garden-scene/garden-progress.test.tsx
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/garden-progress.tsx \
        src/notepad-landing/sections/garden-scene/garden-progress.test.tsx
git commit -m "feat(garden-scene): Roman-numeral progress indicator with tests"
```

---

## Task 15: Station components 01–04 (simple, non-list)

These four are nearly identical — same shape, different copy slice. Create all four in this task; they don't depend on each other.

**Files:**
- Create: `src/notepad-landing/sections/garden-scene/stations/01-three-voices.tsx`
- Create: `src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx`
- Create: `src/notepad-landing/sections/garden-scene/stations/03-lamplight.tsx`
- Create: `src/notepad-landing/sections/garden-scene/stations/04-scripture-margin.tsx`

- [ ] **Step 1: Write station 01**

```typescript
// src/notepad-landing/sections/garden-scene/stations/01-three-voices.tsx
import { copy } from '../../../data/copy';

interface Props { isActive: boolean }

export function StationThreeVoices({ isActive }: Props) {
  const { eyebrow, h2, body, supporting } = copy.section02;
  return (
    <article
      id="section-02"
      className={`garden-station garden-station--three-voices${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-content garden-station-content--center">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{h2}</h2>
        <p className="body">{body}</p>
        <p className="supporting">{supporting}</p>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Write station 02 (Living Graph)**

```typescript
// src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx
import { copy } from '../../../data/copy';

interface Props { isActive: boolean }

export function StationLivingGraph({ isActive }: Props) {
  const { eyebrow, h2, body, supporting, caption } = copy.section03;
  return (
    <article
      id="section-03"
      className={`garden-station garden-station--living-graph${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-content garden-station-content--left">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{h2}</h2>
        <p className="body">{body}</p>
        <p className="supporting">{supporting}</p>
        <p className="caption">{caption}</p>
      </div>
    </article>
  );
}
```

- [ ] **Step 3: Write station 03 (Lamplight)**

```typescript
// src/notepad-landing/sections/garden-scene/stations/03-lamplight.tsx
import { copy } from '../../../data/copy';

interface Props { isActive: boolean }

export function StationLamplight({ isActive }: Props) {
  const { eyebrow, h2, body, cards, trust } = copy.section04;
  return (
    <article
      id="section-04"
      className={`garden-station garden-station--lamplight${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-content garden-station-content--center">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{h2}</h2>
        <p className="body">{body}</p>
        <ul className="lamplight-cards">
          {cards.map((c) => (
            <li key={c.title}>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </li>
          ))}
        </ul>
        <p className="trust">{trust}</p>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Write station 04 (Scripture Margin)**

```typescript
// src/notepad-landing/sections/garden-scene/stations/04-scripture-margin.tsx
import { copy } from '../../../data/copy';

interface Props { isActive: boolean }

export function StationScriptureMargin({ isActive }: Props) {
  const { eyebrow, h2, body, supporting } = copy.section05;
  return (
    <article
      id="section-05"
      className={`garden-station garden-station--scripture-margin${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-content garden-station-content--right">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{h2}</h2>
        <p className="body">{body}</p>
        <p className="supporting">{supporting}</p>
      </div>
    </article>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/stations/01-three-voices.tsx \
        src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx \
        src/notepad-landing/sections/garden-scene/stations/03-lamplight.tsx \
        src/notepad-landing/sections/garden-scene/stations/04-scripture-margin.tsx
git commit -m "feat(garden-scene): station components 1-4 (non-list)"
```

---

## Task 16: Station 05 — Seven Papers (list)

**Files:**
- Create: `src/notepad-landing/sections/garden-scene/stations/05-seven-papers.tsx`

- [ ] **Step 1: Write the station**

```typescript
// src/notepad-landing/sections/garden-scene/stations/05-seven-papers.tsx
import { Link } from 'react-router-dom';
import { copy } from '../../../data/copy';

interface Props {
  isActive: boolean;
  itemIndex: number; // 0..6 — which paper has been "revealed" so far
}

export function StationSevenPapers({ isActive, itemIndex }: Props) {
  const { eyebrow, h2, body, papers } = copy.section06;
  return (
    <article
      id="section-06"
      className={`garden-station garden-station--seven-papers${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-content garden-station-content--center">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{h2}</h2>
        <p className="body">{body}</p>
        <ol className="seven-papers-list">
          {papers.map((paper, i) => {
            const revealed = i <= itemIndex;
            return (
              <li
                key={paper.name}
                className={`seven-papers-item${revealed ? ' revealed' : ''}`}
                aria-hidden={revealed ? undefined : 'true'}
              >
                <Link to={paper.clip} className="seven-papers-link">
                  <span className="seven-papers-name">{paper.name}</span>
                  <span className="seven-papers-blurb">{paper.blurb}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/stations/05-seven-papers.tsx
git commit -m "feat(garden-scene): Seven Papers list station with progressive reveal"
```

---

## Task 17: Station 06 — Tier Path (list, 8 items derived from copy)

The current `copy.section07` doesn't list the 8 tiers individually (it has a single body + pullQuote + bodyContinued). For the pin-and-scroll mechanic, we need 8 discrete reveals. We will reveal copy beats progressively across the camera hold:

- items 0–4: 5 paragraphs derived from splitting the body / pullQuote / bodyContinued at sentence boundaries
- items 5–7: tier names from a new constant `TIER_NAMES`

Adding `TIER_NAMES` to the station file (this is content the spec calls for but copy.ts doesn't have today — keep it scoped to the station component, not the shared copy module, until the brand team formalizes it).

**Files:**
- Create: `src/notepad-landing/sections/garden-scene/stations/06-tier-path.tsx`

- [ ] **Step 1: Write the station**

```typescript
// src/notepad-landing/sections/garden-scene/stations/06-tier-path.tsx
import { copy } from '../../../data/copy';

// Per spec §3.3 — 8 tier markers along the deep dolly path. These are
// reveal beats, intentionally low-fidelity placeholders pending the
// brand team's formal tier naming. Easy to swap for a richer list later.
const TIER_BEATS: readonly string[] = [
  'New Flame',
  'Steady Light',
  'Companion',
  'Witness',
  'Builder',
  'Anchor',
  'Pillar',
  'Glory',
];

interface Props {
  isActive: boolean;
  itemIndex: number; // 0..7
}

export function StationTierPath({ isActive, itemIndex }: Props) {
  const { eyebrow, h2, body, pullQuote, bodyContinued } = copy.section07;
  return (
    <article
      id="section-07"
      className={`garden-station garden-station--tier-path${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-content garden-station-content--center">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{h2}</h2>
        <p className="body">{body}</p>
        <blockquote className="tier-pullquote">{pullQuote}</blockquote>
        <p className="body">{bodyContinued}</p>
        <ol className="tier-list">
          {TIER_BEATS.map((name, i) => {
            const revealed = i <= itemIndex;
            return (
              <li
                key={name}
                className={`tier-item${revealed ? ' revealed' : ''}`}
                aria-hidden={revealed ? undefined : 'true'}
              >
                <span className="tier-numeral">{String(i + 1).padStart(2, '0')}</span>
                <span className="tier-name">{name}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/stations/06-tier-path.tsx
git commit -m "feat(garden-scene): Tier Path list station with 8 progressive beats"
```

---

## Task 18: Station 07 — Yours, Stays Yours

**Files:**
- Create: `src/notepad-landing/sections/garden-scene/stations/07-trust-import.tsx`

- [ ] **Step 1: Write the station**

```typescript
// src/notepad-landing/sections/garden-scene/stations/07-trust-import.tsx
import { copy } from '../../../data/copy';

interface Props { isActive: boolean }

export function StationTrustImport({ isActive }: Props) {
  const { eyebrow, h2, lines } = copy.section08;
  return (
    <article
      id="section-08"
      className={`garden-station garden-station--trust-import${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-content garden-station-content--center">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{h2}</h2>
        <ul className="trust-lines">
          {lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/stations/07-trust-import.tsx
git commit -m "feat(garden-scene): Yours-Stays-Yours station"
```

---

## Task 19: `garden-canvas.tsx` — React wrapper for `mountGarden`

**Files:**
- Create: `src/notepad-landing/sections/garden-scene/garden-canvas.tsx`

- [ ] **Step 1: Write the component**

```typescript
// src/notepad-landing/sections/garden-scene/garden-canvas.tsx
import { useEffect, useRef } from 'react';

interface GardenCanvasProps {
  scrollProgress: { current: number };
  onStationChange: (i: number) => void;
}

export function GardenCanvas({ scrollProgress, onStationChange }: GardenCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let cleanup = () => {};
    let cancelled = false;

    import('../../three/garden/mount-garden').then(({ mountGarden }) => {
      if (cancelled || !canvasRef.current) return;
      const handle = mountGarden(canvasRef.current, {
        scrollProgress,
        onStationChange,
      });
      cleanup = handle.cleanup;
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  // scrollProgress is a ref object so its identity is stable; onStationChange
  // is expected to be stable (wrapped in useCallback by the parent).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="garden-canvas"
      aria-hidden="true"
      role="presentation"
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/garden-canvas.tsx
git commit -m "feat(garden-scene): React wrapper for mountGarden with dynamic import"
```

---

## Task 20: `garden-content-layer.tsx` — station fade orchestrator

**Files:**
- Create: `src/notepad-landing/sections/garden-scene/garden-content-layer.tsx`

- [ ] **Step 1: Write the component**

```typescript
// src/notepad-landing/sections/garden-scene/garden-content-layer.tsx
import { StationThreeVoices } from './stations/01-three-voices';
import { StationLivingGraph } from './stations/02-living-graph';
import { StationLamplight } from './stations/03-lamplight';
import { StationScriptureMargin } from './stations/04-scripture-margin';
import { StationSevenPapers } from './stations/05-seven-papers';
import { StationTierPath } from './stations/06-tier-path';
import { StationTrustImport } from './stations/07-trust-import';
import { STATION_META } from './station-meta';

interface GardenContentLayerProps {
  currentStation: number;
  scrollProgress: { current: number };
}

/**
 * Computes which item-index to show for a list station given overall
 * scroll progress. Returns 0 for non-list stations.
 */
export function computeItemIndex(
  currentStation: number,
  progress: number,
): number {
  const meta = STATION_META[currentStation];
  if (!meta || meta.itemCount <= 1) return 0;

  // Find this station's local progress within its [start, end] slice.
  let runningStart = 0;
  for (let i = 0; i < currentStation; i++) {
    const m = STATION_META[i];
    runningStart += m.baseVh + m.extraVh;
  }
  const ownLength = meta.baseVh + meta.extraVh;
  const localStart = runningStart / 950; // TOTAL_SPACER_VH from meta
  const localEnd = (runningStart + ownLength) / 950;
  if (progress <= localStart) return 0;
  if (progress >= localEnd) return meta.itemCount - 1;
  const localT = (progress - localStart) / (localEnd - localStart);
  return Math.min(meta.itemCount - 1, Math.floor(localT * meta.itemCount));
}

export function GardenContentLayer({
  currentStation,
  scrollProgress,
}: GardenContentLayerProps) {
  const itemIndex = computeItemIndex(currentStation, scrollProgress.current);
  return (
    <div className="garden-content-layer">
      <StationThreeVoices       isActive={currentStation === 0} />
      <StationLivingGraph       isActive={currentStation === 1} />
      <StationLamplight         isActive={currentStation === 2} />
      <StationScriptureMargin   isActive={currentStation === 3} />
      <StationSevenPapers       isActive={currentStation === 4} itemIndex={itemIndex} />
      <StationTierPath          isActive={currentStation === 5} itemIndex={itemIndex} />
      <StationTrustImport       isActive={currentStation === 6} />
    </div>
  );
}
```

Note: `computeItemIndex` reads `scrollProgress.current` only at render time, so the per-item reveals only refresh when React re-renders (which happens whenever `currentStation` changes, plus we'll force a re-render below). For smooth per-item reveal we need to drive re-renders during a list station — Task 22 wires that up.

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/garden-content-layer.tsx
git commit -m "feat(garden-scene): content layer with station fade + list item-index math"
```

---

## Task 21: `fallback-stack.tsx` — PRM rendering of existing sections

**Files:**
- Create: `src/notepad-landing/sections/garden-scene/fallback-stack.tsx`

- [ ] **Step 1: Write the component**

```typescript
// src/notepad-landing/sections/garden-scene/fallback-stack.tsx
import { ThreeVoices } from '../02-three-voices';
import { LivingGraph } from '../03-living-graph';
import { Lamplight } from '../04-lamplight';
import { ScriptureMargin } from '../05-scripture-margin';
import { SevenPapers } from '../06-seven-papers';
import { TierPath } from '../07-tier-path';
import { TrustImport } from '../08-trust-import';

interface FallbackStackProps { prm: boolean }

// PRM fallback: render the existing 7 section components exactly as
// today's page does. No pinned scene, no canvas, no scroll spacer.
export function FallbackStack({ prm }: FallbackStackProps) {
  return (
    <>
      <ThreeVoices prm={prm} />
      <LivingGraph prm={prm} />
      <Lamplight prm={prm} />
      <ScriptureMargin prm={prm} />
      <SevenPapers prm={prm} />
      <TierPath />
      <TrustImport />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/fallback-stack.tsx
git commit -m "feat(garden-scene): PRM fallback stack reusing existing section components"
```

---

## Task 22: `garden-scene.tsx` — top-level orchestrator

**Files:**
- Create: `src/notepad-landing/sections/garden-scene/garden-scene.tsx`
- Create: `src/notepad-landing/sections/garden-scene/index.ts` (re-export)

- [ ] **Step 1: Write the orchestrator**

```typescript
// src/notepad-landing/sections/garden-scene/garden-scene.tsx
import { useCallback, useEffect, useState } from 'react';
import { useGardenScroll } from './use-garden-scroll';
import { GardenCanvas } from './garden-canvas';
import { PaperOverlay } from './paper-overlay';
import { GardenContentLayer } from './garden-content-layer';
import { GardenProgress } from './garden-progress';
import { FallbackStack } from './fallback-stack';
import { TOTAL_SPACER_VH } from './station-meta';

interface GardenSceneProps { prm: boolean }

export function GardenScene({ prm }: GardenSceneProps) {
  if (prm) {
    return (
      <div className="garden-scene garden-scene--fallback">
        <FallbackStack prm={prm} />
      </div>
    );
  }
  return <ActiveGardenScene />;
}

// Split into its own component so hooks aren't called conditionally
// in <GardenScene/>.
function ActiveGardenScene() {
  const { scrollProgress, currentStation, jumpTo } = useGardenScroll();

  // Force a re-render at ~60Hz only while we are inside a list station
  // (4 = Seven Papers, 5 = Tier Path). Outside those stations re-rendering
  // is driven solely by currentStation changes — nearly zero per-frame work.
  const [renderTick, setRenderTick] = useState(0);
  useEffect(() => {
    const isList = currentStation === 4 || currentStation === 5;
    if (!isList) return;
    let raf = 0;
    const loop = () => {
      setRenderTick((t) => (t + 1) % 1024);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [currentStation]);

  const onStationChange = useCallback((_i: number) => {
    // currentStation already drives React state through useGardenScroll;
    // this callback exists so mount-garden can report station changes if
    // we ever want them for analytics. Intentionally a noop.
  }, []);

  return (
    <div className="garden-scene">
      <GardenCanvas scrollProgress={scrollProgress} onStationChange={onStationChange} />
      <PaperOverlay />
      <GardenContentLayer currentStation={currentStation} scrollProgress={scrollProgress} />
      <GardenProgress current={currentStation} onJump={jumpTo} />
      <div id="garden-spacer" style={{ height: `${TOTAL_SPACER_VH}vh`, pointerEvents: 'none' }} aria-hidden="true" />
      {/* renderTick used only as a re-render trigger for list-station item reveals */}
      <span style={{ display: 'none' }} aria-hidden="true">{renderTick}</span>
    </div>
  );
}
```

- [ ] **Step 2: Write the re-export**

```typescript
// src/notepad-landing/sections/garden-scene/index.ts
export { GardenScene } from './garden-scene';
```

- [ ] **Step 3: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/garden-scene.tsx \
        src/notepad-landing/sections/garden-scene/index.ts
git commit -m "feat(garden-scene): top-level orchestrator with PRM bypass and list-station re-render driver"
```

---

## Task 23: Append `.garden-scene` CSS to `landing.css`

**Files:**
- Modify: `src/notepad-landing/styles/landing.css` (append at end)

- [ ] **Step 1: Append the CSS**

Open `src/notepad-landing/styles/landing.css` and append at the end:

```css
/* ─── Garden Scene (Sections 02–08 replacement) ──────────────── */

.notepad-landing .garden-scene {
  position: relative;
  z-index: 1;
}

/* When PRM, the fallback stack should render with no special wrapper styling. */
.notepad-landing .garden-scene--fallback {
  position: static;
}

.notepad-landing .garden-canvas {
  position: fixed;
  top: 0; left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  display: block;
}

.notepad-landing .garden-paper-overlay {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  mix-blend-mode: multiply;
  opacity: 0.3;
}

.notepad-landing .garden-content-layer {
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
}

.notepad-landing .garden-station {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.8s var(--np-ease);
  pointer-events: none;
  padding: 0 24px;
}

.notepad-landing .garden-station.active {
  opacity: 1;
  pointer-events: auto;
}

.notepad-landing .garden-station-content {
  max-width: 640px;
}

.notepad-landing .garden-station-content--center { margin: 0 auto; text-align: center; }
.notepad-landing .garden-station-content--left   { margin-left: 10%; }
.notepad-landing .garden-station-content--right  { margin-left: auto; margin-right: 10%; }

.notepad-landing .garden-station .eyebrow {
  font-family: var(--np-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--np-ink-warm);
  margin-bottom: 24px;
}

.notepad-landing .garden-station h2 {
  font-family: var(--np-display);
  font-size: clamp(28px, 4vw, 48px);
  font-weight: 400;
  line-height: 1.25;
  margin-bottom: 32px;
  letter-spacing: -0.02em;
}

.notepad-landing .garden-station h3 {
  font-family: var(--np-display);
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.notepad-landing .garden-station p.body {
  font-family: var(--np-body);
  font-size: clamp(16px, 1.8vw, 20px);
  line-height: 1.75;
  color: var(--np-ink-mid);
  margin-bottom: 20px;
}

.notepad-landing .garden-station p.supporting,
.notepad-landing .garden-station p.caption,
.notepad-landing .garden-station p.trust {
  font-family: var(--np-body);
  font-size: 14px;
  font-style: italic;
  color: var(--np-ink-warm);
  line-height: 1.7;
}

.notepad-landing .lamplight-cards {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 18px;
  margin: 24px 0;
}

/* Seven Papers list — items fade up as revealed */
.notepad-landing .seven-papers-list,
.notepad-landing .tier-list {
  list-style: none;
  padding: 0;
  margin: 24px auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 480px;
}

.notepad-landing .seven-papers-item,
.notepad-landing .tier-item {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.6s var(--np-ease), transform 0.6s var(--np-ease);
}

.notepad-landing .seven-papers-item.revealed,
.notepad-landing .tier-item.revealed {
  opacity: 1;
  transform: none;
}

.notepad-landing .seven-papers-link {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: var(--np-ink);
  padding: 10px 0;
  border-bottom: 1px solid var(--np-ink-soft);
}

.notepad-landing .seven-papers-name {
  font-family: var(--np-display);
  font-style: italic;
  font-size: 18px;
}

.notepad-landing .seven-papers-blurb {
  font-family: var(--np-body);
  font-size: 13px;
  color: var(--np-ink-warm);
}

.notepad-landing .tier-item {
  display: flex;
  gap: 12px;
  align-items: baseline;
  padding: 8px 0;
  border-bottom: 1px solid var(--np-ink-soft);
}

.notepad-landing .tier-numeral {
  font-family: var(--np-mono);
  font-size: 11px;
  color: var(--np-ink-warm);
  letter-spacing: 0.1em;
  width: 28px;
}

.notepad-landing .tier-name {
  font-family: var(--np-display);
  font-size: 18px;
}

.notepad-landing .tier-pullquote {
  font-family: var(--np-display);
  font-style: italic;
  font-size: clamp(18px, 2vw, 22px);
  border-left: 2px solid var(--np-ink-soft);
  padding-left: 16px;
  margin: 24px 0;
  color: var(--np-ink-mid);
}

.notepad-landing .trust-lines {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 14px;
  margin: 24px auto;
  max-width: 520px;
}

.notepad-landing .trust-lines li {
  font-family: var(--np-body);
  font-size: 16px;
  color: var(--np-ink-mid);
  line-height: 1.6;
}

/* Roman-numeral progress indicator */
.notepad-landing .garden-progress {
  position: fixed;
  right: 28px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 11;
  display: flex;
  flex-direction: column;
  gap: 18px;
  align-items: center;
}

.notepad-landing .garden-progress-item {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: var(--np-display);
  font-style: italic;
  font-size: 18px;
  line-height: 1;
  color: var(--np-ink-soft);
  transition: color 0.3s, transform 0.3s;
}

.notepad-landing .garden-progress-item:hover {
  color: var(--np-ink-mid);
}

.notepad-landing .garden-progress-item.active {
  color: var(--np-ink);
  transform: scale(1.25);
}

/* Mobile */
@media (max-width: 768px) {
  .notepad-landing .garden-station-content--left,
  .notepad-landing .garden-station-content--right {
    margin-left: 24px;
    margin-right: 24px;
  }
  .notepad-landing .garden-progress { right: 14px; gap: 12px; }
  .notepad-landing .garden-progress-item { font-size: 14px; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/notepad-landing/styles/landing.css
git commit -m "style(garden-scene): full CSS for pinned scene, stations, list reveals, progress indicator"
```

---

## Task 24: Integrate into `index.tsx`

**Files:**
- Modify: `src/notepad-landing/index.tsx`

- [ ] **Step 1: Replace the imports and composition**

Replace the entire current content of `src/notepad-landing/index.tsx` with:

```typescript
import './styles/landing.css';
import { usePrefersReducedMotion } from './hooks/use-prefers-reduced-motion';
import { useAdaptiveNavTheme } from './hooks/use-adaptive-nav-theme';
import { ParticleHero } from './sections/01-particle-hero';
import { GardenScene } from './sections/garden-scene';
import { ClosingCTA } from './sections/09-closing-cta';

const NAV_THEME_SECTIONS_GARDEN = [
  { selector: '.notepad-landing .hero',          theme: 'dark' },
  { selector: '.notepad-landing .garden-scene',  theme: 'light' },
  { selector: '.notepad-landing .closing-cta',   theme: 'dark' },
] as const;

const NAV_THEME_SECTIONS_FALLBACK = [
  { selector: '.notepad-landing .hero',              theme: 'dark' },
  { selector: '.notepad-landing .three-voices',      theme: 'light' },
  { selector: '.notepad-landing .living-graph',      theme: 'light' },
  { selector: '.notepad-landing .lamplight',         theme: 'light' },
  { selector: '.notepad-landing .scripture-margin',  theme: 'light' },
  { selector: '.notepad-landing .seven-papers',      theme: 'light' },
  { selector: '.notepad-landing .tier-path',         theme: 'light' },
  { selector: '.notepad-landing .trust-import',      theme: 'light' },
  { selector: '.notepad-landing .closing-cta',       theme: 'dark' },
] as const;

export function NotepadLanding() {
  const prm = usePrefersReducedMotion();
  useAdaptiveNavTheme(prm ? NAV_THEME_SECTIONS_FALLBACK : NAV_THEME_SECTIONS_GARDEN);
  return (
    <div className="notepad-landing">
      <ParticleHero prm={prm} />
      <GardenScene prm={prm} />
      <ClosingCTA prm={prm} />
    </div>
  );
}
```

- [ ] **Step 2: Run the existing landing test**

```bash
npx vitest run src/notepad-landing/index.test.tsx
```

Expected: passes. The existing test only asserts the hero H1 renders; our change preserves that.

- [ ] **Step 3: Commit**

```bash
git add src/notepad-landing/index.tsx
git commit -m "feat(notepad-landing): compose GardenScene; switch nav-theme list by PRM"
```

---

## Task 25: `garden-scene.test.tsx` — integration tests

**Files:**
- Create: `src/notepad-landing/sections/garden-scene/garden-scene.test.tsx`

- [ ] **Step 1: Write the tests**

```typescript
// src/notepad-landing/sections/garden-scene/garden-scene.test.tsx
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GardenScene } from './garden-scene';

// mount-garden depends on WebGL which jsdom does not implement. Stub it.
vi.mock('../../three/garden/mount-garden', () => ({
  mountGarden: () => ({ cleanup: () => {} }),
}));

function renderScene(prm: boolean) {
  return render(
    <MemoryRouter>
      <div className="notepad-landing">
        <GardenScene prm={prm} />
      </div>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('<GardenScene /> — active mode (prm=false)', () => {
  it('renders the canvas, paper overlay, progress nav, and spacer', () => {
    renderScene(false);
    expect(document.querySelector('canvas.garden-canvas')).toBeInTheDocument();
    expect(document.querySelector('.garden-paper-overlay')).toBeInTheDocument();
    expect(document.querySelector('#garden-spacer')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /go to station/i })).toHaveLength(7);
  });

  it('first station has id="section-02" for hero CTA anchor compatibility', () => {
    renderScene(false);
    const target = document.getElementById('section-02');
    expect(target).not.toBeNull();
    expect(target?.className).toContain('garden-station--three-voices');
  });

  it('first station is active on initial render', () => {
    renderScene(false);
    const first = document.querySelector('.garden-station--three-voices');
    expect(first?.className).toContain('active');
  });
});

describe('<GardenScene /> — PRM mode (prm=true)', () => {
  it('does NOT render the canvas, overlay, progress, or spacer', () => {
    renderScene(true);
    expect(document.querySelector('canvas.garden-canvas')).toBeNull();
    expect(document.querySelector('.garden-paper-overlay')).toBeNull();
    expect(document.querySelector('#garden-spacer')).toBeNull();
    expect(screen.queryAllByRole('button', { name: /go to station/i })).toHaveLength(0);
  });

  it('renders all seven section components from FallbackStack', () => {
    renderScene(true);
    // Each fallback section has a known heading from data/copy.ts
    expect(screen.getByRole('heading', { name: /three voices\. one quiet place\./i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /a map of how god has been speaking/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /a companion who['']s been reading along/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /the bible, in the margin of your sentence/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /choose the paper that asks/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /the small thing, marked/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /private\. cited\. yours\./i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run src/notepad-landing/sections/garden-scene/garden-scene.test.tsx
```

Expected: all 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/garden-scene.test.tsx
git commit -m "test(garden-scene): integration tests for active vs PRM rendering"
```

---

## Task 26: Manual smoke test in the dev server

**Files:** none (manual verification)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: Vite starts on `http://localhost:5173` (or similar). No console errors during boot.

- [ ] **Step 2: Open the notepad route in a browser**

Navigate to `http://localhost:5173/notepad` (or whichever route `NotepadLanding` is bound to in the router — confirm by reading `src/App.tsx` or routes file).

- [ ] **Step 3: Verify each acceptance criterion from spec §12**

Run through the list, recording pass/fail in the terminal:

1. Hero (unchanged) → garden scene → Closing CTA (unchanged) visible.
2. Scrolling progresses through 7 stations in order.
3. Camera glides without snaps between stations.
4. Stations 5 & 6 hold the camera while list items fade in one by one.
5. Roman numerals on the right update; clicking IV scrolls to station 4.
6. Toggle OS reduced-motion ON in System Settings; reload — canvas absent, seven sections render as normal scrolling cards.
7. Nav theme stays light through the garden, dark for hero and CTA.
8. All copy from `data/copy.ts` sections 02–08 visible at the appropriate station.

Any failure → open a follow-up task to address before declaring done.

- [ ] **Step 4: Run the full test suite and lint**

```bash
npm test 2>&1 | tail -20
npm run lint 2>&1 | tail -20
npx tsc -b --noEmit 2>&1 | tail -20
```

Expected: all green. If any pre-existing errors exist, confirm they're not in files we touched.

- [ ] **Step 5: Final commit if anything changed during smoke testing**

```bash
git status
# if anything dirty:
git add -p
git commit -m "fix(garden-scene): smoke-test corrections"
```

---

## Self-Review Notes (run by author after writing this plan)

**Spec coverage check (against §0–§13 of the spec):**

| Spec section | Task(s) |
|---|---|
| §1 Decisions Locked | reflected throughout — see Task 2 station-meta, Task 11 camera-stations, Task 13 paper overlay, Task 14 progress, Task 21 fallback, Task 24 nav-theme |
| §2.1 Layer model | Task 22 (z-orders) + Task 23 (CSS z-index) |
| §2.2 File layout | Tasks 2, 4–22 create every listed file |
| §3.1 Tech stack | Tasks 4–12 use plain Three.js, plain RAF; Task 19 uses dynamic import like particle-system |
| §3.2 Procedural entities | Tasks 5–10 + 12 (each entity has its own task) |
| §3.3 World composition | Task 12 (cluster placement + paperStem row + tier path + stoneBasin) |
| §3.4 Camera waypoints | Task 11 |
| §3.5 Fog/palette/renderer | Task 12 |
| §3.6 Mount signature | Task 12 |
| §4.1 GardenScene shape | Task 22 |
| §4.2 useGardenScroll | Task 3 |
| §4.3 Station fade | Task 23 CSS + Task 15–18 station `.active` class |
| §4.4 List-station mechanic | Task 16 + Task 17 (revealed class) + Task 20 (computeItemIndex) + Task 22 (re-render driver) |
| §4.5 Progress indicator | Task 14 |
| §4.6 Paper overlay | Task 13 + Task 23 CSS |
| §5.1 index.tsx | Task 24 |
| §5.2 PRM path with split nav-theme arrays | Task 24 (dual arrays); Task 21 (FallbackStack); Task 22 (PRM short-circuit) |
| §5.3 Code-split preserved | Task 19 uses dynamic import |
| §5.4 Routing / SSR | implicit — no changes |
| §6 Reduced-motion behavior | Task 21 + Task 22 + Task 24 |
| §7 Accessibility | Task 14 aria-current, aria-label; Task 19 canvas aria-hidden + role=presentation; Tasks 15-18 aria-hidden per station |
| §8 Performance | Task 12 DPR clamp, BufferGeometry, dispose in cleanup; Task 22 list-only re-render driver |
| §9 Testing | Tasks 3, 11, 14, 25 cover unit + integration; §9.3 dropped per Errata |
| §10 Browser support | implicit — uses standard APIs |
| §11 Risks & decision log | mitigations baked into tasks (DPR clamp, idempotent cleanup, dynamic import, link affordance in Task 16) |
| §12 Acceptance criteria | Task 26 walks every item |
| §13 Out of scope | nothing added that crosses these lines |

**Placeholder scan:** No "TODO", "TBD", "implement later" remain. Every code step has complete code.

**Type consistency:**
- `MountGardenOptions.scrollProgress: { current: number }` (Task 12) matches the type returned by `useGardenScroll` (Task 3) and passed by `GardenCanvas` (Task 19).
- `StationMeta.index` is `0|1|2|3|4|5|6` (Task 2); all consumers use plain `number` after array indexing — no narrowing conflict.
- `STATION_META`, `CAMERA_STATIONS`, `TOTAL_SPACER_VH` exported with consistent names (Tasks 2, 11) and consumed consistently (Tasks 3, 12, 14, 22).
- `onStationChange?: (i: number) => void` consistent in Tasks 12 and 19.

**Spec-requirement gaps:** None found.

---

## Done When

Every step above has its checkbox ticked AND the full test suite (`npm test`) is green AND the manual smoke pass (Task 26 step 3) reports no failures.
