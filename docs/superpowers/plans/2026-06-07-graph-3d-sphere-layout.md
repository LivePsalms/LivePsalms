# Graph 3D Sphere Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scattered 2D force-directed graph with a slowly rotating, drag-to-orbit pseudo-3D sphere of nodes, rendered in the existing Canvas 2D pipeline.

**Architecture:** Nodes get frozen 3D positions on a sphere (a 3D force layout via `d3-force-3d` + a custom radius-constraint force). A camera `{ yaw, pitch, scale }` rotates each frame; `draw()` projects the fixed 3D points orthographically to 2D, shades them by depth, and paints back-to-front. This mirrors the existing "render-only" philosophy: the layout stays frozen, only the drawing moves.

**Tech Stack:** TypeScript, Canvas 2D, `d3-force-3d` (new), Vitest. No WebGL.

**Reference spec:** `docs/superpowers/specs/2026-06-07-graph-3d-sphere-layout-design.md`

**Working conventions for this repo (ALL tasks):**
- Run every command from the project root. **Always prefix bash with `cd /Users/newmac/Downloads/Psalms_app &&`** — the shell cwd resets between calls and is NOT the project root; git fails with "fatal: not a git repository" otherwise.
- After each task run: `npx vitest run src/notepad/graph/` , `npx tsc --noEmit`, and `npx eslint <the source files you touched>`.
- Commit to `main`. **Do NOT stage** the ~130 unrelated `docs/superpowers/plans/*.md` deletions already in the working tree — `git add` only the exact files each task names. Never `git add -A` / `git add .`.
- The test file `graph-view.test.ts` has 4 PRE-EXISTING `_t`/`_depth` unused-parameter eslint errors and `GraphPane.tsx` has 2 PRE-EXISTING `react-hooks/refs` errors — both out of scope, do not "fix" them. Just don't add new lint errors in files you touch.

---

## Shared definitions (used across tasks — keep names/values identical everywhere)

These constants and signatures are introduced by the tasks below; this block is the single source of truth so later tasks stay consistent.

```ts
// Sphere sizing — radius grows with node count so nodes don't overcrowd the surface.
function sphereRadius(nodeCount: number): number {
  return Math.max(160, Math.sqrt(Math.max(1, nodeCount)) * 55);
}

// Camera + motion
const ROTATE_SPEED = 0.18;   // radians/sec auto-rotation (slow)
const PITCH_LIMIT = 1.3;     // clamp pitch to ±1.3 rad (~75°) so the globe can't flip
const ORBIT_SENSITIVITY = 0.01; // radians of camera rotation per pixel dragged

// sphere-math.ts pure API
interface Vec3 { x: number; y: number; z: number; }
interface SphereCamera { yaw: number; pitch: number; scale: number; }
interface Projected { sx: number; sy: number; depth: number; }
function rotatePoint(p: Vec3, yaw: number, pitch: number): Vec3;
function projectPoint(p: Vec3, cam: SphereCamera, cx: number, cy: number): Projected;
function depthNorm(depth: number, radius: number): number;  // back -> 0, front -> 1
function depthScale(dn: number): number;  // 0.55 (back) .. 1.20 (front)
function depthAlpha(dn: number): number;  // 0.30 (back) .. 1.00 (front)
```

Camera replaces the old `transform = { x, y, scale }`. The sphere is centred at the
world origin `(0,0,0)`; `cx, cy` are the viewport centre in CSS pixels.

---

### Task 1: Add the `d3-force-3d` dependency and a type shim

`d3-force-3d` has the same API as `d3-force` but in 3 dimensions. It ships without bundled TypeScript types, so we add a minimal local declaration for the few exports we use.

**Files:**
- Modify: `package.json` (dependencies)
- Create: `src/notepad/graph/d3-force-3d.d.ts`

- [ ] **Step 1: Install the package**

Run: `cd /Users/newmac/Downloads/Psalms_app && npm install d3-force-3d@^3.0.5`
Expected: `package.json` gains `"d3-force-3d": "^3.0.5"` under dependencies; install succeeds.

- [ ] **Step 2: Check whether real types exist**

Run: `cd /Users/newmac/Downloads/Psalms_app && ls node_modules/d3-force-3d/*.d.ts 2>/dev/null && echo HAS_TYPES || echo NO_TYPES`
Expected: `NO_TYPES` (the package is plain JS). If it prints `HAS_TYPES`, skip Step 3 (the shim is unnecessary) and note that in your report.

- [ ] **Step 3: Add a minimal module declaration**

Create `src/notepad/graph/d3-force-3d.d.ts` with exactly the surface we use:

```ts
// Minimal ambient types for d3-force-3d (ships without its own .d.ts).
// Only the surface this codebase uses is declared.
declare module 'd3-force-3d' {
  export interface Sim3Node {
    index?: number;
    x?: number; y?: number; z?: number;
    vx?: number; vy?: number; vz?: number;
    fx?: number | null; fy?: number | null; fz?: number | null;
  }

  export interface Force3<N> {
    (alpha: number): void;
    initialize?(nodes: N[], random: () => number, numDimensions: number): void;
  }

  export interface Simulation3<N, L> {
    nodes(): N[];
    nodes(nodes: N[]): this;
    force(name: string): Force3<N> | undefined;
    force(name: string, force: Force3<N> | null): this;
    alpha(): number;
    alpha(a: number): this;
    alphaMin(): number;
    tick(iterations?: number): this;
    stop(): this;
    restart(): this;
    numDimensions(n: number): this;
  }

  export interface LinkForce3<N, L> extends Force3<N> {
    links(links: L[]): this;
    id(fn: (node: N) => string): this;
    distance(fn: (link: L) => number): this;
    strength(fn: (link: L) => number): this;
  }

  export interface ManyBodyForce3<N> extends Force3<N> {
    strength(s: number): this;
  }

  export function forceSimulation<N, L = unknown>(nodes?: N[], numDimensions?: number): Simulation3<N, L>;
  export function forceLink<N, L>(links?: L[]): LinkForce3<N, L>;
  export function forceManyBody<N>(): ManyBodyForce3<N>;
  export function forceCenter<N>(x?: number, y?: number, z?: number): Force3<N>;
}
```

- [ ] **Step 4: Verify the project still typechecks and tests pass**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit`
Expected: no errors.
Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/`
Expected: all existing tests still pass (nothing wired up yet).

- [ ] **Step 5: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add package.json package-lock.json src/notepad/graph/d3-force-3d.d.ts && git commit -m "build(graph): add d3-force-3d dependency and type shim"
```

---

### Task 2: Pure 3D math — rotation and projection

A standalone, pure module for the camera math. No canvas, no state — trivially unit-testable.

**Files:**
- Create: `src/notepad/graph/sphere-math.ts`
- Test: `src/notepad/graph/sphere-math.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/notepad/graph/sphere-math.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rotatePoint, projectPoint } from './sphere-math';

describe('rotatePoint', () => {
  it('is identity at yaw=0, pitch=0', () => {
    const p = rotatePoint({ x: 3, y: 5, z: 7 }, 0, 0);
    expect(p.x).toBeCloseTo(3, 6);
    expect(p.y).toBeCloseTo(5, 6);
    expect(p.z).toBeCloseTo(7, 6);
  });

  it('yaw of PI/2 maps +x toward -z (rotation about the Y axis)', () => {
    const p = rotatePoint({ x: 1, y: 0, z: 0 }, Math.PI / 2, 0);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(-1, 6);
  });

  it('preserves vector length', () => {
    const p = rotatePoint({ x: 2, y: -3, z: 6 }, 0.7, -0.4); // |p| = 7
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(7, 6);
  });
});

describe('projectPoint', () => {
  it('places the rotated point at cx+scale*x, cy+scale*y and reports depth=z', () => {
    const r = projectPoint({ x: 2, y: 4, z: -1 }, { yaw: 0, pitch: 0, scale: 3 }, 100, 50);
    expect(r.sx).toBeCloseTo(100 + 3 * 2, 6);
    expect(r.sy).toBeCloseTo(50 + 3 * 4, 6);
    expect(r.depth).toBeCloseTo(-1, 6);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/sphere-math.test.ts`
Expected: FAIL — `./sphere-math` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/notepad/graph/sphere-math.ts`:

```ts
export interface Vec3 { x: number; y: number; z: number; }
export interface SphereCamera { yaw: number; pitch: number; scale: number; }
export interface Projected { sx: number; sy: number; depth: number; }

/**
 * Rotate a point around the Y axis (yaw) then the X axis (pitch). Pure, allocation
 * is a single object. Length-preserving (orthonormal rotation).
 */
export function rotatePoint(p: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;
  const y1 = p.y;
  const cx = Math.cos(pitch), sx = Math.sin(pitch);
  const y2 = y1 * cx - z1 * sx;
  const z2 = y1 * sx + z1 * cx;
  return { x: x1, y: y2, z: z2 };
}

/**
 * Orthographic projection: rotate by the camera, scale, and offset to the viewport
 * centre (cx, cy). `depth` is the rotated z (larger = nearer the viewer).
 */
export function projectPoint(p: Vec3, cam: SphereCamera, cx: number, cy: number): Projected {
  const r = rotatePoint(p, cam.yaw, cam.pitch);
  return { sx: cx + r.x * cam.scale, sy: cy + r.y * cam.scale, depth: r.z };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/sphere-math.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/sphere-math.ts src/notepad/graph/sphere-math.test.ts && git commit -m "feat(graph): pure 3D rotate + orthographic project helpers"
```

---

### Task 3: Pure 3D math — depth shading

Map a node's depth to a normalized 0..1 value and to draw-radius / opacity multipliers.

**Files:**
- Modify: `src/notepad/graph/sphere-math.ts`
- Test: `src/notepad/graph/sphere-math.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/notepad/graph/sphere-math.test.ts`:

```ts
import { depthNorm, depthScale, depthAlpha } from './sphere-math';

describe('depth shading', () => {
  it('normalizes depth from [-R, R] to [0, 1]', () => {
    expect(depthNorm(-200, 200)).toBeCloseTo(0, 6); // far back
    expect(depthNorm(0, 200)).toBeCloseTo(0.5, 6);  // equator
    expect(depthNorm(200, 200)).toBeCloseTo(1, 6);  // front
  });

  it('clamps depth outside [-R, R]', () => {
    expect(depthNorm(-9999, 200)).toBe(0);
    expect(depthNorm(9999, 200)).toBe(1);
  });

  it('front nodes draw larger and more opaque than back nodes', () => {
    expect(depthScale(1)).toBeGreaterThan(depthScale(0));
    expect(depthAlpha(1)).toBeGreaterThan(depthAlpha(0));
    expect(depthScale(0)).toBeCloseTo(0.55, 6);
    expect(depthScale(1)).toBeCloseTo(1.2, 6);
    expect(depthAlpha(0)).toBeCloseTo(0.3, 6);
    expect(depthAlpha(1)).toBeCloseTo(1.0, 6);
  });
});
```

Add the new symbols to the existing import line at the top of the file (or rely on the new `import` statement shown — Vitest allows multiple imports from the same module).

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/sphere-math.test.ts -t "depth shading"`
Expected: FAIL — `depthNorm`/`depthScale`/`depthAlpha` are not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/notepad/graph/sphere-math.ts`:

```ts
/** Normalize rotated z (depth) from [-radius, radius] to [0, 1], clamped. */
export function depthNorm(depth: number, radius: number): number {
  if (radius <= 0) return 0.5;
  const dn = (depth / radius + 1) / 2;
  return dn < 0 ? 0 : dn > 1 ? 1 : dn;
}

/** Draw-radius multiplier by depth: back nodes shrink, front nodes grow. */
export function depthScale(dn: number): number {
  return 0.55 + dn * 0.65;
}

/** Opacity by depth: back nodes fade, front nodes are solid. */
export function depthAlpha(dn: number): number {
  return 0.3 + dn * 0.7;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/sphere-math.test.ts`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/sphere-math.ts src/notepad/graph/sphere-math.test.ts && git commit -m "feat(graph): depth shading helpers for sphere rendering"
```

---

### Task 4: Custom `forceSphere` — pull nodes onto the sphere surface

A d3-force-3d-compatible force that nudges every node toward radius R from the origin. Mirrors the existing `force-shared-tags.ts` pattern (closure with `.initialize`).

**Files:**
- Create: `src/notepad/graph/force-sphere.ts`
- Test: `src/notepad/graph/force-sphere.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/notepad/graph/force-sphere.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { forceSphere } from './force-sphere';

interface N { x: number; y: number; z: number; vx: number; vy: number; vz: number; }

function mk(x: number, y: number, z: number): N {
  return { x, y, z, vx: 0, vy: 0, vz: 0 };
}

describe('forceSphere', () => {
  it('pushes a node that is too close to the centre outward (toward radius R)', () => {
    const node = mk(10, 0, 0); // well inside R=200
    const f = forceSphere<N>(200, 0.1);
    f.initialize!([node], Math.random, 3);
    f(1); // alpha = 1
    // velocity should point outward along +x (away from centre, toward the shell)
    expect(node.vx).toBeGreaterThan(0);
    expect(node.vy).toBeCloseTo(0, 6);
    expect(node.vz).toBeCloseTo(0, 6);
  });

  it('pulls a node that is too far inward (toward radius R)', () => {
    const node = mk(0, 500, 0); // outside R=200
    const f = forceSphere<N>(200, 0.1);
    f.initialize!([node], Math.random, 3);
    f(1);
    expect(node.vy).toBeLessThan(0); // pulled back toward centre
  });

  it('leaves a node already on the shell essentially unmoved', () => {
    const node = mk(200, 0, 0); // exactly on R=200
    const f = forceSphere<N>(200, 0.1);
    f.initialize!([node], Math.random, 3);
    f(1);
    expect(Math.abs(node.vx)).toBeLessThan(1e-9);
  });

  it('ignores a node sitting exactly at the origin (no defined direction)', () => {
    const node = mk(0, 0, 0);
    const f = forceSphere<N>(200, 0.1);
    f.initialize!([node], Math.random, 3);
    expect(() => f(1)).not.toThrow();
    expect(node.vx).toBe(0);
    expect(node.vy).toBe(0);
    expect(node.vz).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/force-sphere.test.ts`
Expected: FAIL — `./force-sphere` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/notepad/graph/force-sphere.ts`:

```ts
interface SphereNode {
  x?: number; y?: number; z?: number;
  vx?: number; vy?: number; vz?: number;
}

/**
 * A d3-force-3d-compatible force that pulls every node toward the surface of a
 * sphere of the given `radius`, centred at the origin. `strength` scales how
 * hard nodes are nudged each tick (multiplied by the simulation alpha). A node
 * exactly at the origin has no defined radial direction and is left untouched.
 */
export function forceSphere<N extends SphereNode>(radius: number, strength = 0.08) {
  let nodes: N[] = [];

  function force(alpha: number) {
    for (const n of nodes) {
      const x = n.x ?? 0, y = n.y ?? 0, z = n.z ?? 0;
      const dist = Math.sqrt(x * x + y * y + z * z);
      if (dist === 0) continue; // no direction at the centre
      const diff = radius - dist;          // >0: too close (push out); <0: too far (pull in)
      const f = (diff / dist) * strength * alpha;
      n.vx = (n.vx ?? 0) + x * f;
      n.vy = (n.vy ?? 0) + y * f;
      n.vz = (n.vz ?? 0) + z * f;
    }
  }

  force.initialize = function (_nodes: N[]) {
    nodes = _nodes;
  };

  return force;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/force-sphere.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/force-sphere.ts src/notepad/graph/force-sphere.test.ts && git commit -m "feat(graph): forceSphere — pull nodes onto a sphere surface"
```

---

### Task 5: Build the 3D layout — swap the simulation to `d3-force-3d` on a sphere

Replace the 2D simulation in `rebuild()` with a 3D one (link + charge + `forceSphere`), seed nodes on a Fibonacci sphere, and add `z` to `SimNode`. The settle step already runs the sim to stability; with 3D forces it now freezes a sphere.

**Files:**
- Modify: `src/notepad/graph/graph-view.ts`
  - imports (lines 3-16): switch the d3 import to `d3-force-3d`, import `forceSphere` and `sphereRadius`
  - `SimNode` interface (lines 125-135): add `z?: number`
  - module constants (after line 102): add `sphereRadius`
  - `rebuild()` (lines 680-733): seed 3D positions, build the 3D sim
- Test: `src/notepad/graph/graph-view.test.ts` (new `describe` block at end)

- [ ] **Step 1: Write the failing test**

Add at the end of `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — 3D sphere layout', () => {
  it('settles every node onto the sphere surface (≈ radius R from origin)', () => {
    const { view } = attached();
    view.setData(
      [
        node({ id: 'a', type: 'devotion' }),
        node({ id: 'b', type: 'sermon' }),
        node({ id: 'c', type: 'theme' }),
        node({ id: 'd', type: 'devotion' }),
        node({ id: 'e', type: 'sermon' }),
      ],
      [edge({ id: 'r1', source: 'a', target: 'b' }), edge({ id: 'r2', source: 'b', target: 'c' })],
      null,
    );
    view.settle();
    const sim = view.getSimNodes();
    const R = Math.max(160, Math.sqrt(5) * 55); // sphereRadius(5)
    for (const n of sim) {
      const d = Math.sqrt((n.x ?? 0) ** 2 + (n.y ?? 0) ** 2 + (n.z ?? 0) ** 2);
      // Within 35% of R — the constraint is soft, not a hard projection.
      expect(d).toBeGreaterThan(R * 0.65);
      expect(d).toBeLessThan(R * 1.35);
    }
  });

  it('gives every node a defined 3D position', () => {
    const { view } = attached();
    view.setData([node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' })], [], null);
    view.settle();
    for (const n of view.getSimNodes()) {
      expect(typeof n.x).toBe('number');
      expect(typeof n.y).toBe('number');
      expect(typeof n.z).toBe('number');
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/graph-view.test.ts -t "3D sphere layout"`
Expected: FAIL — nodes have no `z` and are laid out in 2D, so the radius assertion fails.

- [ ] **Step 3a: Swap the d3 import**

In `src/notepad/graph/graph-view.ts`, replace the import block (lines 3-16):

```ts
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
  type ForceLink,
  type ForceManyBody,
  type ForceCenter,
} from 'd3-force';
import { forceSharedTags } from './force-shared-tags';
```

with:

```ts
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  type Simulation3,
} from 'd3-force-3d';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import { forceSphere } from './force-sphere';
```

> The `LinkForce3` / `ManyBodyForce3` types are referenced only inside `setSettings`
> via inline `import('d3-force-3d').LinkForce3` casts (Step 5), so they are NOT imported
> at the top to avoid an unused-import error.

> Note: `SimulationNodeDatum`/`SimulationLinkDatum` are kept from `d3-force` purely as
> structural base interfaces (id/x/y/vx). We no longer use `forceCenter`,
> `forceCollide`, `forceSharedTags`, `ForceLink`, `ForceManyBody`, or `ForceCenter` —
> remove those usages (Task 5 + Task 9 cover every reference).

- [ ] **Step 3b: Add `z` to `SimNode` and the `sphereRadius` constant**

Add `z?: number;` to the `SimNode` interface (after `phase: number;`, line 134):

```ts
export interface SimNode extends SimulationNodeDatum {
  id: string;
  type: GraphNode['type'];
  title: string;
  weight: number;
  radius: number;
  tags: string[];
  scriptureText: string;
  scriptureTranslation: string;
  phase: number;
  z?: number;
}
```

Add this constant immediately after `AUTO_FIT_INITIAL_ZOOM` (line 102):

```ts
// Sphere radius (world units) grows with node count so the surface doesn't overcrowd.
function sphereRadius(nodeCount: number): number {
  return Math.max(160, Math.sqrt(Math.max(1, nodeCount)) * 55);
}
```

- [ ] **Step 3c: Change the simulation field type**

Change the field declaration (line 185) from:

```ts
  private sim: Simulation<SimNode, SimLink> | null = null;
```

to:

```ts
  private sim: Simulation3<SimNode, SimLink> | null = null;
```

- [ ] **Step 3d: Rebuild the layout in 3D**

In `rebuild()`, replace the node-map and simulation construction. Replace the block from `this.simNodes = filtered.map((n) => {` (line 690) through the end of the `forceSimulation(...)` chain (line 733) with:

```ts
    const R = sphereRadius(filtered.length);
    const golden = Math.PI * (3 - Math.sqrt(5));
    this.simNodes = filtered.map((n, i) => {
      const prev = prevPos.get(n.id);
      // Seed on a Fibonacci sphere so the sim starts near a good sphere and settles fast.
      const yUnit = filtered.length > 1 ? 1 - (i / (filtered.length - 1)) * 2 : 0;
      const rUnit = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
      const theta = golden * i;
      return {
        id: n.id, type: n.type, title: n.title, weight: n.weight,
        radius: computeRadius(n.type, n.weight, this.settings.nodeSize),
        tags: n.tags,
        scriptureText: n.scriptureText,
        scriptureTranslation: n.scriptureTranslation,
        phase: hashPhase(n.id),
        x: prev?.x ?? Math.cos(theta) * rUnit * R,
        y: prev?.y ?? yUnit * R,
        z: prev?.z ?? Math.sin(theta) * rUnit * R,
        vx: prev?.vx, vy: prev?.vy, vz: prev?.vz,
      };
    });

    const nodeMap = new Map(this.simNodes.map((n) => [n.id, n]));
    this.simLinks = this.currentEdges
      .filter((e) => filteredIds.has(e.source) && filteredIds.has(e.target))
      .map((e) => ({
        id: e.id,
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
        edgeType: e.type,
        weight: e.weight,
      }));

    if (this.sim) this.sim.stop();

    this.sim = forceSimulation<SimNode, SimLink>(this.simNodes, 3)
      .force('link', forceLink<SimNode, SimLink>(this.simLinks)
        .id((d) => d.id)
        .distance((d) => this.settings.linkDistance / d.weight)
        .strength((d) => this.settings.linkForce * d.weight))
      .force('charge', forceManyBody<SimNode>().strength(-this.settings.repelForce))
      .force('sphere', forceSphere<SimNode>(R, 0.08))
      .numDimensions(3);
```

> The `prevPos` map (lines 685-688) must also carry `z`/`vz`. Update its type and the
> loop that fills it:
>
> ```ts
>     const prevPos = new Map<string, { x: number; y: number; z: number; vx?: number; vy?: number; vz?: number }>();
>     for (const n of this.simNodes) {
>       if (n.x != null && n.y != null) {
>         prevPos.set(n.id, { x: n.x, y: n.y, z: n.z ?? 0, vx: n.vx, vy: n.vy, vz: (n as { vz?: number }).vz });
>       }
>     }
> ```
>
> Leave the lines below the simulation construction (`this.sim.stop()` at line 736,
> `tickCount`, `hasFit`, `needsSettle`) unchanged — `settle()` and the rAF loop still
> drive ticks exactly as before. Delete the now-unused local `width`/`height`
> computation (old lines 716-721) only if nothing else references it; if `runAutoFit`
> still needs canvas size it reads it itself (Task 10 rewrites `runAutoFit`).

> `alphaDecay`/`velocityDecay` were chained on the old sim; re-add them on the new one
> if present in your working copy: append `.alphaDecay(0.015).velocityDecay(0.15)` to
> the chain above (the `d3-force-3d` shim doesn't declare them, so cast:
> `(this.sim as unknown as { alphaDecay(n: number): typeof this.sim }).alphaDecay(0.015)`
> — OR add `alphaDecay`/`velocityDecay` to the `Simulation3` interface in the shim and
> chain normally). Prefer extending the shim for cleanliness.

- [ ] **Step 3e: Delete the now-obsolete 2D tests and fix the import**

Changing the layout to 3D invalidates the tests that assert 2D positions/scale. Delete
these describe blocks (and any test) from `src/notepad/graph/graph-view.test.ts` so the
suite stays green from here on:
- `describe('driftOffset', ...)`
- `describe('GraphView — node phase', ...)`
- `describe('GraphView — node drift animation', ...)`
- `describe('GraphView — edge drift follows nodes', ...)`
- `describe('GraphView — labels only on hover', ...)` (re-added as sphere behavior is covered by Task 6's hover label; delete the 2D version)
- In `describe('GraphView — auto-fit camera', ...)`: delete the 2D assertions
  `loads zoomed in to 1.25x…`, `clamps the loaded zoom…`, `changes the transform after
  tick 80…`, `only fires once…`, and `resets the auto-fit gate…` (all assert
  `getTransform()` / 2D scale). Delete the whole block.
- In `describe('GraphView — pan and wheel zoom', ...)`: delete any test asserting
  `transform.x`/`transform.y` (panning is replaced by orbit). Keep nothing that calls
  `getTransform()`.

Remove `driftOffset, DRIFT_AMPLITUDE, DRIFT_SPEED` from the import on line 2:

```ts
import { GraphView, DEFAULT_SETTINGS } from './graph-view';
```

(The `driftOffset`/`DRIFT_*` source exports stay for now — `draw()` still uses them until
Task 6 — but nothing in the test file imports them anymore.)

Run: `cd /Users/newmac/Downloads/Psalms_app && grep -n "getTransform\|driftOffset\|DRIFT_" src/notepad/graph/graph-view.test.ts`
Expected: no matches (every caller deleted).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/graph-view.test.ts`
Expected: PASS — the new 3D-layout tests pass and the obsolete 2D/drift tests are gone.
(`draw()` is still the 2D renderer here, projecting the sphere's x/y flat; that's an
acceptable intermediate — Task 6 makes it truly 3D.)

- [ ] **Step 5: Typecheck**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit`
Expected: errors ONLY for the not-yet-updated `draw()`/`runAutoFit()`/handlers referencing the removed `transform`/2D forces are acceptable mid-migration IF they don't block — but tsc must ultimately pass. If `setSettings` (lines 468-478) references removed `ForceLink`/`ForceManyBody`/`ForceCenter` types, update it now: replace those three `this.sim.force<...>(...)` blocks with:

```ts
    const link = this.sim.force('link') as import('d3-force-3d').LinkForce3<SimNode, SimLink> | undefined;
    if (link) {
      link.distance((d) => settings.linkDistance / d.weight);
      link.strength((d) => settings.linkForce * d.weight);
    }
    const charge = this.sim.force('charge') as import('d3-force-3d').ManyBodyForce3<SimNode> | undefined;
    if (charge) charge.strength(-settings.repelForce);
    // No center force in the sphere layout; the 'sphere' force owns global shape.
```

Keep the `this.sim.alpha(0.3)` re-warm line. Re-run `tsc` until clean.

- [ ] **Step 6: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts src/notepad/graph/d3-force-3d.d.ts && git commit -m "feat(graph): lay out nodes on a 3D sphere via d3-force-3d + forceSphere"
```

---

### Task 6: Render the sphere — camera, projection, depth shading, back-to-front paint

Replace the 2D `transform` with a `camera`, and rewrite the node-drawing portion of `draw()` to project each node, sort back-to-front, and shade by depth. (Edges handled in Task 7; hit-testing in Task 8.)

**Files:**
- Modify: `src/notepad/graph/graph-view.ts`
  - imports: add the sphere-math helpers
  - field (line 202): replace `transform` with `camera`
  - `draw()` (lines 340-438): rewrite node rendering
- Test: `src/notepad/graph/graph-view.test.ts`

- [ ] **Step 1: Write the failing test**

Add at the end of `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — sphere rendering', () => {
  // Pull the radius of the LAST node-circle arc drawn (front-most, painted last).
  function arcs(canvas: MockCanvas) {
    return canvas.ctx.calls.filter((c) => c.method === 'arc').map((c) => c.args as number[]);
  }

  it('paints nodes back-to-front (deeper nodes drawn earlier, so radii increase)', () => {
    const { view, canvas } = attached();
    view.setData(
      [node({ id: 'back', type: 'devotion' }), node({ id: 'mid', type: 'sermon' }), node({ id: 'front', type: 'theme' })],
      [], null,
    );
    const sim = view.getSimNodes();
    const pin = (id: string, z: number) => {
      const s = sim.find((n) => n.id === id)!;
      s.x = 0; s.y = 0; s.z = z; s.fx = 0; s.fy = 0; (s as { fz?: number }).fz = z;
    };
    // All non-scripture → identical base radius, so depthScale alone drives drawn size.
    pin('back', -200); pin('mid', 0); pin('front', 200);
    view.settle();
    const radii = arcs(canvas).map((a) => a[2]); // arc radius arg, in draw order
    expect(radii.length).toBe(3);
    expect(radii[0]).toBeLessThan(radii[1]); // back drawn first, smallest
    expect(radii[1]).toBeLessThan(radii[2]); // front drawn last, largest
  });

  it('a front-facing node is drawn larger than the same node facing away', () => {
    const { view, canvas } = attached();
    view.setData([node({ id: 'solo', type: 'devotion' })], [], null);
    const s = view.getSimNodes()[0];
    // Pin one node straight in front (+z) vs straight behind (-z); compare drawn radius.
    s.x = 0; s.y = 0; s.z = 200; s.fx = 0; s.fy = 0; (s as { fz?: number }).fz = 200;
    view.settle();
    const front = arcs(canvas).at(-1)![2]; // arc radius arg
    s.z = -200; (s as { fz?: number }).fz = -200;
    view.settle();
    const back = arcs(canvas).at(-1)![2];
    expect(front).toBeGreaterThan(back);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/graph-view.test.ts -t "sphere rendering"`
Expected: FAIL — nodes are still drawn with 2D drift positions, so the front/back radius comparison fails (or `camera` doesn't exist).

- [ ] **Step 3a: Add imports and the camera field**

Add to the import section of `graph-view.ts`:

```ts
import { projectPoint, depthNorm, depthScale, depthAlpha, type SphereCamera } from './sphere-math';
```

Replace the field (line 202):

```ts
  private transform = { x: 0, y: 0, scale: 1 };
```

with:

```ts
  private camera: SphereCamera = { yaw: 0, pitch: 0.35, scale: 1 };
```

Then replace the `getTransform()` test affordance (lines 675-678) with a camera reader,
so the file still compiles now that `transform` is gone:

```ts
  /** Test affordance — read the camera without subscribing. */
  getCamera(): SphereCamera {
    return { ...this.camera };
  }
```

(`getTransform()` had no remaining callers — Task 5 deleted every test that used it.)

- [ ] **Step 3b: Rewrite the node-rendering portion of `draw()`**

Replace the body of `draw()` (lines 340-438) with the following. This task handles the
node loop + hover label; the edge loop is left drawing nothing yet (a placeholder the
NEXT task fills) — to keep this step self-contained we draw edges with the OLD base
positions temporarily:

```ts
  private draw(): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    const dpr = this.deps.devicePixelRatio?.() ?? 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const cx = width / 2;
    const cy = height / 2;
    const cam = this.camera;
    const R = sphereRadius(this.simNodes.length);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS-pixel screen space

    const hovered = this.hoveredNodeId;
    const connectedIds = new Set<string>();
    if (hovered) {
      connectedIds.add(hovered);
      for (const link of this.simLinks) {
        const src = typeof link.source === 'object' ? (link.source as SimNode).id : String(link.source);
        const tgt = typeof link.target === 'object' ? (link.target as SimNode).id : String(link.target);
        if (src === hovered) connectedIds.add(tgt);
        if (tgt === hovered) connectedIds.add(src);
      }
    }

    // Project every node once; depth-sort back-to-front.
    const drawn = this.simNodes
      .filter((n) => n.x != null && n.y != null)
      .map((n) => {
        const p = projectPoint({ x: n.x ?? 0, y: n.y ?? 0, z: n.z ?? 0 }, cam, cx, cy);
        const dn = depthNorm(p.depth, R);
        return { n, p, dn };
      })
      .sort((a, b) => a.p.depth - b.p.depth);

    // Edges — placeholder using projected endpoints (depth fade added in Task 7).
    const screen = new Map<string, { sx: number; sy: number; dn: number }>();
    for (const d of drawn) screen.set(d.n.id, { sx: d.p.sx, sy: d.p.sy, dn: d.dn });
    for (const link of this.simLinks) {
      const src = link.source as SimNode;
      const tgt = link.target as SimNode;
      const a = screen.get(src.id);
      const b = screen.get(tgt.id);
      if (!a || !b) continue;
      const isHighlighted = hovered && connectedIds.has(src.id) && connectedIds.has(tgt.id);
      const alpha = hovered ? (isHighlighted ? 0.9 : 0.06) : 0.4;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.strokeStyle = `rgba(168, 160, 145, ${alpha})`;
      ctx.lineWidth = (5 + link.weight * 3.5) * this.settings.edgeThickness * cam.scale;
      ctx.stroke();
    }

    // Nodes — back-to-front, depth-scaled radius + depth-faded fill.
    const activeId = this.effectiveActiveId();
    for (const { n, p, dn } of drawn) {
      const drawR = n.radius * cam.scale * depthScale(dn);
      const isConnected = !hovered || connectedIds.has(n.id);
      const fade = depthAlpha(dn) * (hovered ? (isConnected ? 1 : 0.18) : 1);
      const color = NODE_COLORS[n.type] ?? '#999';

      if (n.id === activeId) {
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, drawR + 10 * cam.scale, 0, Math.PI * 2);
        ctx.fillStyle = `${color}30`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, drawR + 5 * cam.scale, 0, Math.PI * 2);
        ctx.fillStyle = `${color}20`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(p.sx, p.sy, drawR, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = fade;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Hover label — only the hovered node, at its projected position.
    if (hovered) {
      const d = drawn.find((x) => x.n.id === hovered);
      if (d) {
        const drawR = d.n.radius * cam.scale * depthScale(d.dn);
        ctx.beginPath();
        ctx.arc(d.p.sx, d.p.sy, drawR + 4 * cam.scale, 0, Math.PI * 2);
        ctx.strokeStyle = `${NODE_COLORS[d.n.type] ?? '#999'}80`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = `${d.n.radius > 38 ? '26px' : '23px'} Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(62, 50, 40, 0.85)';
        ctx.fillText(d.n.title, d.p.sx, d.p.sy + drawR + 18);
      }
    }

    ctx.restore();
  }
```

> This deletes the old `driftOffset`/`drawnPos` usage in `draw()`. Leave the exported
> `driftOffset`/`DRIFT_*` symbols in place for now — Task 12 removes them and their tests.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/graph-view.test.ts -t "sphere rendering"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts && git commit -m "feat(graph): project + depth-shade nodes, paint back-to-front"
```

---

### Task 7: Depth-fade the edges

Replace the placeholder edge loop so each edge's alpha is reduced by the depth of its endpoints (edges curving to the back are dimmer).

**Files:**
- Modify: `src/notepad/graph/graph-view.ts` (the edge loop inside `draw()`)
- Test: `src/notepad/graph/graph-view.test.ts`

- [ ] **Step 1a: Capture `strokeStyle` at stroke time in the mock**

The `MockContext` (top of `graph-view.test.ts`) records `stroke()` as a call but does
not capture the current `strokeStyle`. Change its `stroke()` method from:

```ts
  stroke() { this.rec('stroke', this.strokeStyle); }
```

(if it currently reads `stroke() { this.rec('stroke'); }`, add the `this.strokeStyle`
argument as shown). This records the alpha-bearing colour string for each stroked path
without changing any production code.

- [ ] **Step 1b: Write the failing test**

Add at the end of `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — edge depth fade', () => {
  function alphaOf(strokeStyle: string): number {
    const m = /rgba\([^)]*,\s*([\d.]+)\)/.exec(strokeStyle);
    return m ? parseFloat(m[1]) : NaN;
  }

  it('draws an edge between back-facing nodes fainter than one between front-facing nodes', () => {
    const { view, canvas } = attached();
    view.setData(
      [node({ id: 'fa', type: 'devotion' }), node({ id: 'fb', type: 'sermon' }),
       node({ id: 'ba', type: 'devotion' }), node({ id: 'bb', type: 'sermon' })],
      // 'front' edge first, 'back' edge second → strokes recorded in this order.
      [edge({ id: 'front', source: 'fa', target: 'fb' }),
       edge({ id: 'back', source: 'ba', target: 'bb' })],
      null,
    );
    const sim = view.getSimNodes();
    const pin = (id: string, x: number, y: number, z: number) => {
      const s = sim.find((n) => n.id === id)!;
      s.x = x; s.y = y; s.z = z; s.fx = x; s.fy = y; (s as { fz?: number }).fz = z;
    };
    // y=0 so depth ≈ z*cos(pitch). Front pair +z, back pair -z. No hover → 2 strokes total.
    pin('fa', -40, 0, 200); pin('fb', 40, 0, 200);
    pin('ba', -40, 0, -200); pin('bb', 40, 0, -200);
    view.settle();

    const strokes = canvas.ctx.calls.filter((c) => c.method === 'stroke').map((c) => String(c.args[0]));
    expect(strokes.length).toBe(2);
    expect(alphaOf(strokes[0])).toBeGreaterThan(alphaOf(strokes[1])); // front brighter than back
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/graph-view.test.ts -t "edge depth fade"`
Expected: FAIL — the placeholder edge loop from Task 6 uses a constant `0.4` alpha
(plus highlight logic), so front and back edges get the same alpha.

- [ ] **Step 3: Implement depth-faded edges**

In `draw()`, replace the edge loop from Task 6 with one that multiplies alpha by mean endpoint depth:

```ts
    // Edges — alpha reduced by endpoint depth so back edges recede.
    for (const link of this.simLinks) {
      const src = link.source as SimNode;
      const tgt = link.target as SimNode;
      const a = screen.get(src.id);
      const b = screen.get(tgt.id);
      if (!a || !b) continue;
      const meanDepth = (a.dn + b.dn) / 2;            // 0 back .. 1 front
      const depthFade = 0.2 + meanDepth * 0.8;        // never fully invisible
      const isHighlighted = hovered && connectedIds.has(src.id) && connectedIds.has(tgt.id);
      const base = hovered ? (isHighlighted ? 0.9 : 0.06) : 0.5;
      const alpha = base * depthFade;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.strokeStyle = `rgba(168, 160, 145, ${alpha})`;
      ctx.lineWidth = (5 + link.weight * 3.5) * this.settings.edgeThickness * cam.scale;
      ctx.stroke();
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/graph-view.test.ts -t "edge depth fade"`
Expected: PASS (front edge alpha strictly greater than back edge alpha).

- [ ] **Step 5: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts && git commit -m "feat(graph): fade sphere edges by depth"
```

---

### Task 8: Hit-testing via projection (front-most node wins)

Pointer hit-testing must use projected screen positions and prefer the node nearest the viewer when several overlap.

**Files:**
- Modify: `src/notepad/graph/graph-view.ts` — `findNodeAt` (lines 635-643) and `screenToWorld` usage
- Test: `src/notepad/graph/graph-view.test.ts`

- [ ] **Step 1: Write the failing test**

Add at the end of `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — sphere hit-testing', () => {
  it('returns the front-most node when two overlap in screen space', () => {
    const { view } = attached();
    view.setData([node({ id: 'front', type: 'devotion' }), node({ id: 'back', type: 'sermon' })], [], null);
    const sim = view.getSimNodes();
    const front = sim.find((n) => n.id === 'front')!;
    const back = sim.find((n) => n.id === 'back')!;
    // Same x/y (overlap on screen), different z. Pin so the sim can't move them.
    front.x = 0; front.y = 0; front.z = 150; front.fx = 0; front.fy = 0; (front as { fz?: number }).fz = 150;
    back.x = 0; back.y = 0; back.z = -150; back.fx = 0; back.fy = 0; (back as { fz?: number }).fz = -150;
    view.settle();
    // Flatten pitch to 0 so both nodes project to the exact screen centre and truly
    // overlap (with the default tilt they'd project to different screen Y).
    (view as unknown as { camera: { pitch: number } }).camera.pitch = 0;
    view.handleMouseMove({ clientX: 200, clientY: 200 }); // 400x400 canvas → centre
    expect(view.getHoveredNodeId()).toBe('front');
  });

  it('draws only the hovered node’s label', () => {
    const { view, canvas } = attached();
    view.setData(
      [node({ id: 'a', type: 'devotion', title: 'Alpha' }), node({ id: 'b', type: 'sermon', title: 'Beta' })],
      [], null,
    );
    const sim = view.getSimNodes();
    const a = sim.find((n) => n.id === 'a')!;
    const b = sim.find((n) => n.id === 'b')!;
    a.x = 0; a.y = 0; a.z = 0; a.fx = 0; a.fy = 0; (a as { fz?: number }).fz = 0;       // projects to centre
    b.x = 999; b.y = 999; b.z = 0; b.fx = 999; b.fy = 999; (b as { fz?: number }).fz = 0; // far off-screen
    view.settle();
    (view as unknown as { camera: { pitch: number } }).camera.pitch = 0;
    const before = canvas.ctx.calls.length;
    view.handleMouseMove({ clientX: 200, clientY: 200 }); // hover node 'a' at the centre
    expect(view.getHoveredNodeId()).toBe('a');
    const labels = canvas.ctx.calls.slice(before).filter((c) => c.method === 'fillText').map((c) => c.args[0]);
    expect(labels).toEqual(['Alpha']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/graph-view.test.ts -t "sphere hit-testing"`
Expected: FAIL — `findNodeAt` still uses 2D `n.x/n.y` world positions.

- [ ] **Step 3: Rewrite `findNodeAt` and the pointer→screen conversion**

Replace `findNodeAt` (lines 635-643) with a projected, front-most version. It takes
SCREEN (CSS-pixel) coordinates now, not world coordinates:

```ts
  private findNodeAt(sx: number, sy: number): SimNode | null {
    if (!this.canvas) return null;
    const dpr = this.deps.devicePixelRatio?.() ?? 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    const cx = width / 2, cy = height / 2;
    const cam = this.camera;
    const R = sphereRadius(this.simNodes.length);
    let best: SimNode | null = null;
    let bestDepth = -Infinity;
    for (const n of this.simNodes) {
      if (n.x == null || n.y == null) continue;
      const p = projectPoint({ x: n.x, y: n.y, z: n.z ?? 0 }, cam, cx, cy);
      const drawR = n.radius * cam.scale * depthScale(depthNorm(p.depth, R));
      const dx = sx - p.sx, dy = sy - p.sy;
      if (dx * dx + dy * dy <= (drawR + 4) ** 2 && p.depth > bestDepth) {
        best = n;
        bestDepth = p.depth;
      }
    }
    return best;
  }
```

Now replace every `this.screenToWorld(e.clientX, e.clientY)` + `findNodeAt(x, y)`
call-site so it passes SCREEN coordinates. Add a small helper and update the three
call sites (`handleMouseMove` line 543, `handleMouseDown` line 553, `handleMouseUp`
line 575):

```ts
  private toScreen(clientX: number, clientY: number): { sx: number; sy: number } {
    if (!this.canvas) return { sx: 0, sy: 0 };
    const rect = this.canvas.getBoundingClientRect();
    return { sx: clientX - rect.left, sy: clientY - rect.top };
  }
```

- In `handleMouseMove` hover branch:
  ```ts
    const { sx, sy } = this.toScreen(e.clientX, e.clientY);
    const id = this.findNodeAt(sx, sy)?.id ?? null;
  ```
- In `handleMouseDown`:
  ```ts
    const { sx, sy } = this.toScreen(e.clientX, e.clientY);
    if (!this.findNodeAt(sx, sy)) { /* begin orbit — Task 9 */ }
  ```
- In `handleMouseUp`:
  ```ts
    const { sx, sy } = this.toScreen(e.clientX, e.clientY);
    const node = this.findNodeAt(sx, sy);
  ```

> `screenToWorld` (lines 628-633) is now unused by hit-testing. The scripture popover
> still needs a node's screen position — Task 11 rewrites `syncPopoverScreen` to project.
> You may delete `screenToWorld` once Task 11 removes its last caller; for now leave it
> (unused-but-referenced is fine) or delete it and inline as Task 11 directs.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/graph-view.test.ts -t "sphere hit-testing"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts && git commit -m "feat(graph): project-based, front-most hit-testing"
```

---

### Task 9: Drag to orbit (replaces drag-to-pan)

Dragging empty space now rotates the camera (yaw from horizontal drag, pitch from vertical, clamped) instead of panning.

**Files:**
- Modify: `src/notepad/graph/graph-view.ts` — `dragState` (lines 206-208), `handleMouseDown` (552-564), `handleMouseMove` drag branch (533-542)
- Test: `src/notepad/graph/graph-view.test.ts`

- [ ] **Step 1: Write the failing test**

Add at the end of `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — drag to orbit', () => {
  it('horizontal drag changes yaw, vertical drag changes pitch (clamped)', () => {
    const { view } = attached();
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    view.settle();
    const before = view.getCamera();
    view.handleMouseDown({ clientX: 10, clientY: 10 });   // empty space (node is centred, away from 10,10)
    view.handleMouseMove({ clientX: 60, clientY: 40 });   // dragged +50x, +30y
    const after = view.getCamera();
    expect(after.yaw).not.toBeCloseTo(before.yaw, 6);
    expect(after.pitch).not.toBeCloseTo(before.pitch, 6);
    view.handleMouseUp({ clientX: 60, clientY: 40 });
  });

  it('clamps pitch within ±PITCH_LIMIT', () => {
    const { view } = attached();
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    view.settle();
    view.handleMouseDown({ clientX: 10, clientY: 10 });
    view.handleMouseMove({ clientX: 10, clientY: 100000 }); // huge vertical drag
    expect(Math.abs(view.getCamera().pitch)).toBeLessThanOrEqual(1.3 + 1e-9);
    view.handleMouseUp({ clientX: 10, clientY: 100000 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/graph-view.test.ts -t "drag to orbit"`
Expected: FAIL — `getCamera` doesn't exist and dragging still pans `transform`.

- [ ] **Step 3a: Add the orbit constants**

Add these constants near the other module constants (after `sphereRadius`). `ROTATE_SPEED`
is intentionally NOT added here — it is unused until Task 11, and an unused `const` trips
eslint; Task 11 adds it.

```ts
const PITCH_LIMIT = 1.3;          // clamp pitch (~75°) so the globe can't flip
const ORBIT_SENSITIVITY = 0.01;   // rad of camera rotation per pixel dragged
```

(`getCamera()` already exists — Task 6 added it when it removed `transform`.)

- [ ] **Step 3b: Change `dragState` to track camera origin**

Replace the `dragState` field (lines 206-208):

```ts
  private dragState = {
    active: false, moved: false, startX: 0, startY: 0, origYaw: 0, origPitch: 0,
  };
```

- [ ] **Step 3c: Orbit on drag**

In `handleMouseDown`, when the press is NOT on a node, begin an orbit:

```ts
  handleMouseDown = (e: { clientX: number; clientY: number }): void => {
    const { sx, sy } = this.toScreen(e.clientX, e.clientY);
    if (!this.findNodeAt(sx, sy)) {
      this.dragState = {
        active: true, moved: false,
        startX: e.clientX, startY: e.clientY,
        origYaw: this.camera.yaw, origPitch: this.camera.pitch,
      };
    }
  };
```

In `handleMouseMove`, replace the drag branch (lines 534-541) with orbit math:

```ts
    if (this.dragState.active) {
      this.dragState.moved = true;
      const dx = e.clientX - this.dragState.startX;
      const dy = e.clientY - this.dragState.startY;
      this.camera.yaw = this.dragState.origYaw + dx * ORBIT_SENSITIVITY;
      let pitch = this.dragState.origPitch - dy * ORBIT_SENSITIVITY;
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
      this.camera.pitch = pitch;
      this.syncPopoverScreen();
      this.updateCursor();
      this.draw();
      return;
    }
```

The `handleMouseUp` drag-end logic (lines 566-574) is unchanged — it already clears
`dragState.active`/`moved` and returns early when a drag occurred.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/graph-view.test.ts -t "drag to orbit"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts && git commit -m "feat(graph): drag to orbit the sphere (yaw/pitch, clamped)"
```

---

### Task 10: Wheel zoom + auto-fit the sphere

Wheel scales the camera; auto-fit centres the sphere and chooses a scale that fits it in the viewport.

**Files:**
- Modify: `src/notepad/graph/graph-view.ts` — `handleWheel` (645-661), `runAutoFit` (315-338)
- Test: `src/notepad/graph/graph-view.test.ts`

- [ ] **Step 1: Write the failing test**

Add at the end of `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — sphere zoom and auto-fit', () => {
  it('wheel up increases camera scale, wheel down decreases it', () => {
    const { view } = attached();
    view.setData([node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' })], [], null);
    view.settle();
    const base = view.getCamera().scale;
    view.handleWheel({ clientX: 0, clientY: 0, deltaY: -100 });
    expect(view.getCamera().scale).toBeGreaterThan(base);
    const up = view.getCamera().scale;
    view.handleWheel({ clientX: 0, clientY: 0, deltaY: 100 });
    expect(view.getCamera().scale).toBeLessThan(up);
  });

  it('auto-fit scales the sphere to fit the viewport', () => {
    const { view } = attached(); // 400x400
    view.setData(
      [node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' }), node({ id: 'c', type: 'theme' })],
      [], null,
    );
    view.settle(); // runs auto-fit
    const R = Math.max(160, Math.sqrt(3) * 55);
    const maxNodeR = Math.max(...view.getSimNodes().map((n) => n.radius));
    const expected = (Math.min(400, 400) - 2 * 30) / (2 * (R + maxNodeR));
    expect(view.getCamera().scale).toBeCloseTo(expected, 4);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/graph-view.test.ts -t "sphere zoom and auto-fit"`
Expected: FAIL — wheel still mutates `transform`; `runAutoFit` computes a 2D bounding box.

- [ ] **Step 3a: Wheel zoom on the camera**

Replace `handleWheel` (645-661):

```ts
  handleWheel = (e: { clientX: number; clientY: number; deltaY: number; preventDefault?: () => void }): void => {
    e.preventDefault?.();
    const factor = e.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR;
    this.camera.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.camera.scale * factor));
    this.syncPopoverScreen();
    this.draw();
  };
```

- [ ] **Step 3b: Auto-fit the sphere**

Replace `runAutoFit` (315-338):

```ts
  private runAutoFit(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    if (this.simNodes.length === 0) return;
    const dpr = this.deps.devicePixelRatio?.() ?? 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const R = sphereRadius(this.simNodes.length);
    const maxNodeR = Math.max(...this.simNodes.map((n) => n.radius));
    const fit = (Math.min(width, height) - 2 * AUTO_FIT_VIEWPORT_PADDING) / (2 * (R + maxNodeR));
    this.camera.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit));
    // Sphere is origin-centred; projection adds the viewport centre, so no x/y offset.
  }
```

> `AUTO_FIT_NODE_MARGIN`, `AUTO_FIT_MAX_SCALE`, and `AUTO_FIT_INITIAL_ZOOM` are no longer
> used. Remove those three constants (lines 97, 99-102). Keep `AUTO_FIT_TICK` and
> `AUTO_FIT_VIEWPORT_PADDING`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/graph-view.test.ts -t "sphere zoom and auto-fit"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts && git commit -m "feat(graph): wheel zoom + sphere auto-fit on the camera"
```

---

### Task 11: Auto-rotation (with reduced-motion, hover, and drag pauses) + popover follow

Advance the camera yaw each frame when idle. Pause while hovering, while dragging, and under `prefers-reduced-motion`. Make the scripture popover track the projected node position.

**Files:**
- Modify: `src/notepad/graph/graph-view.ts` — add `advanceRotation`, call it from `onTick` (306-313) and the rAF loop (280-300), rewrite `syncPopoverScreen` (663-673) and the popover open math in `handleMouseUp` (593-595)
- Test: `src/notepad/graph/graph-view.test.ts`

- [ ] **Step 1: Write the failing test**

Add at the end of `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — auto-rotation', () => {
  it('advances yaw over time when idle', () => {
    let clock = 0;
    const { deps } = makeDeps({ now: () => clock });
    const view = new GraphView(deps);
    const canvas = new MockCanvas();
    const container = new MockContainer(400, 400);
    view.attach(canvas as unknown as HTMLCanvasElement, container as unknown as HTMLElement);
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    view.settle();
    const before = view.getCamera().yaw;
    clock = 0; view.tickFor(1);      // establishes last-frame time
    clock = 1000; view.tickFor(1);   // +1s
    expect(view.getCamera().yaw).toBeGreaterThan(before);
  });

  it('does not advance yaw under prefers-reduced-motion', () => {
    let clock = 0;
    const { deps } = makeDeps({ now: () => clock, prefersReducedMotion: () => true });
    const view = new GraphView(deps);
    const canvas = new MockCanvas();
    const container = new MockContainer(400, 400);
    view.attach(canvas as unknown as HTMLCanvasElement, container as unknown as HTMLElement);
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    view.settle();
    const before = view.getCamera().yaw;
    clock = 0; view.tickFor(1);
    clock = 5000; view.tickFor(1);
    expect(view.getCamera().yaw).toBe(before);
  });

  it('does not advance yaw while a node is hovered', () => {
    let clock = 0;
    const { deps } = makeDeps({ now: () => clock });
    const view = new GraphView(deps);
    const canvas = new MockCanvas();
    const container = new MockContainer(400, 400);
    view.attach(canvas as unknown as HTMLCanvasElement, container as unknown as HTMLElement);
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    const s = view.getSimNodes()[0];
    s.x = 0; s.y = 0; s.z = 0; s.fx = 0; s.fy = 0; (s as { fz?: number }).fz = 0;
    view.settle();
    (view as unknown as { camera: { pitch: number } }).camera.pitch = 0; // project to centre
    view.handleMouseMove({ clientX: 200, clientY: 200 }); // hover the centred node
    expect(view.getHoveredNodeId()).toBe('a');
    const before = view.getCamera().yaw;
    clock = 0; view.tickFor(1);
    clock = 3000; view.tickFor(1);
    expect(view.getCamera().yaw).toBe(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/graph-view.test.ts -t "auto-rotation"`
Expected: FAIL — yaw never changes on tick.

- [ ] **Step 3a: Add rotation state + `advanceRotation`**

Add the auto-rotation speed constant near the other module constants (after
`ORBIT_SENSITIVITY` from Task 9):

```ts
const ROTATE_SPEED = 0.18;        // rad/sec auto-rotation (slow)
```

Add a field near `camera`:

```ts
  private lastRotateTime: number | null = null;
```

Add the method (place it just above `draw()`):

```ts
  private advanceRotation(): void {
    const now = this.deps.now?.() ?? (typeof performance !== 'undefined' ? performance.now() : 0);
    const last = this.lastRotateTime ?? now;
    const dt = (now - last) / 1000;
    this.lastRotateTime = now;
    const reduced = this.deps.prefersReducedMotion?.() ?? false;
    const idle = !this.dragState.active && this.hoveredNodeId === null;
    if (!reduced && idle && dt > 0) {
      this.camera.yaw += ROTATE_SPEED * dt;
    }
  }
```

- [ ] **Step 3b: Drive rotation from `onTick` and the rAF loop**

In `onTick` (306-313), call `advanceRotation()` before `draw()`:

```ts
  private onTick(): void {
    this.tickCount++;
    if (!this.hasFit && this.tickCount === AUTO_FIT_TICK) {
      this.runAutoFit();
      this.hasFit = true;
    }
    this.advanceRotation();
    this.draw();
  }
```

In the rAF loop (`startAutoTick`, 283-298), the post-settle branch should advance
rotation + draw WITHOUT re-ticking the now-stable sim:

```ts
        if (this.needsSettle) {
          this.needsSettle = false;
          this.settle();
        } else {
          this.advanceRotation();
          this.draw();
        }
```

> Removing the post-settle `sim.tick()` is intentional — the layout is frozen; only the
> camera moves. `settle()` already calls `runAutoFit` + `draw` once.

- [ ] **Step 3c: Popover follows the projected node**

Rewrite `syncPopoverScreen` (663-673) to project:

```ts
  private syncPopoverScreen(): void {
    const current = this.getSnapshot().popover;
    if (!current || !this.canvas) return;
    const n = this.simNodes.find((x) => x.id === current.nodeId);
    if (!n || n.x == null || n.y == null) return;
    const dpr = this.deps.devicePixelRatio?.() ?? 1;
    const width = this.canvas.width / dpr, height = this.canvas.height / dpr;
    const p = projectPoint({ x: n.x, y: n.y, z: n.z ?? 0 }, this.camera, width / 2, height / 2);
    if (p.sx === current.screenX && p.sy === current.screenY) return;
    this.setState((prev) => prev.popover ? { popover: { ...prev.popover, screenX: p.sx, screenY: p.sy } } : prev);
  }
```

And the popover-open math in `handleMouseUp` (593-595) — replace the screen calc:

```ts
        const dpr = this.deps.devicePixelRatio?.() ?? 1;
        const width = (this.canvas?.width ?? 0) / dpr, height = (this.canvas?.height ?? 0) / dpr;
        const p = projectPoint({ x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 }, this.camera, width / 2, height / 2);
        const screenX = p.sx;
        const screenY = p.sy;
```

> Now `screenToWorld` (628-633) has no callers — delete it. Verify with
> `grep -n screenToWorld src/notepad/graph/graph-view.ts` returning nothing after.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/graph-view.test.ts -t "auto-rotation"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts && git commit -m "feat(graph): auto-rotate the sphere (reduced-motion/hover/drag aware) + popover follow"
```

---

### Task 12: Retire the dead drift source code

Drift is superseded by rotation. The obsolete drift/2D *tests* were already deleted in
Task 5; this task removes the now-unused drift *source* exports.

**Files:**
- Modify: `src/notepad/graph/graph-view.ts` — delete `DRIFT_AMPLITUDE`, `DRIFT_SPEED`, `driftOffset`, and `hashPhase`/`SimNode.phase` ONLY IF unused (see note)

- [ ] **Step 1: Confirm nothing imports the drift exports**

Run: `cd /Users/newmac/Downloads/Psalms_app && grep -rn "driftOffset\|DRIFT_AMPLITUDE\|DRIFT_SPEED" src --include=*.ts --include=*.tsx`
Expected: matches ONLY inside `graph-view.ts` itself (the definitions). If any other file
imports them, stop and update that file first.

- [ ] **Step 2: Delete dead drift code in `graph-view.ts`**

Remove `DRIFT_AMPLITUDE`, `DRIFT_SPEED`, and `driftOffset` (the constants + function near
lines 104-123). Then check whether `hashPhase` and `SimNode.phase` still have any
reference:

Run: `cd /Users/newmac/Downloads/Psalms_app && grep -n "phase\|hashPhase" src/notepad/graph/graph-view.ts`

If the only remaining references are the `SimNode.phase` field, the `hashPhase`
definition, and its assignment in `rebuild()`, remove all three (the field, the helper,
and `phase: hashPhase(n.id),` in the node map). If anything else uses them, leave them.

- [ ] **Step 3: Verify the whole graph suite + types + lint**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/notepad/graph/`
Expected: PASS — only sphere-era tests remain.
Run: `cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit`
Expected: no errors.
Run: `cd /Users/newmac/Downloads/Psalms_app && npx eslint src/notepad/graph/graph-view.ts src/notepad/graph/sphere-math.ts src/notepad/graph/force-sphere.ts`
Expected: clean (no NEW errors; the 4 pre-existing `_t`/`_depth` errors in the test file are out of scope).

- [ ] **Step 4: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts && git commit -m "refactor(graph): retire drift animation, superseded by sphere rotation"
```

---

### Task 13: Verify the React shell and mobile pointer wiring

The sphere is internal to `GraphView`; `GraphPane.tsx` already forwards pointer events and the `prefersReducedMotion` dep. Confirm nothing references removed APIs and the mobile embed still drives the same handlers.

**Files:**
- Inspect/Modify (only if needed): `src/components/sections/notepad/GraphPane.tsx`, `src/components/sections/notepad/GraphPane.test.tsx`, and any mobile graph component
- No new product code expected; this task is a guard.

- [ ] **Step 1: Grep for removed/renamed APIs across the app**

Run: `cd /Users/newmac/Downloads/Psalms_app && grep -rn "getTransform\|driftOffset\|DRIFT_AMPLITUDE\|DRIFT_SPEED\|screenToWorld" src --include=*.ts --include=*.tsx`
Expected: NO matches outside deleted code. If a non-test file references any, update it
(e.g. a debug overlay reading `getTransform()` → `getCamera()`).

- [ ] **Step 2: Run the component tests**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run src/components/sections/notepad/`
Expected: PASS. `GraphPane.test.tsx` mocks `GraphView` with a stub class (it defines its
own `handleMouseMove`/`handleMouseDown`); if the stub references removed methods, leave
it — stubs need not match exactly. If a test imports a removed export from `graph-view`,
fix the import.

- [ ] **Step 3: Typecheck the whole project**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit (only if you changed files)**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add -- src/components/sections/notepad && git commit -m "chore(graph): align React shell with sphere GraphView API"
```

If nothing changed, skip the commit and note "no shell changes required" in your report.

---

### Task 14: Full verification and push

**Files:** none (verification only)

- [ ] **Step 1: Full test run**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx vitest run`
Expected: PASS across the whole suite.

- [ ] **Step 2: Typecheck**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint the files this feature touched**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx eslint src/notepad/graph/graph-view.ts src/notepad/graph/sphere-math.ts src/notepad/graph/force-sphere.ts src/notepad/graph/d3-force-3d.d.ts src/components/sections/notepad/GraphPane.tsx`
Expected: no NEW errors (pre-existing `react-hooks/refs` in GraphPane.tsx and `_t`/`_depth` in the test file are out of scope).

- [ ] **Step 4: Push**

```bash
cd /Users/newmac/Downloads/Psalms_app && git push origin main
```
Expected: all sphere commits land on `origin/main`.

---

## Self-Review Notes

- **Spec coverage:** pseudo-3D sphere look → Tasks 2,3,6 (project + depth shading, back-to-front paint). Relationship-aware layout → Tasks 4,5 (forceSphere + d3-force-3d link/charge). Auto-rotate + drag-orbit, hover/drag pause → Tasks 9,11. Edges depth-faded → Task 7. Front-most hit-testing → Task 8. Wheel zoom + sphere auto-fit → Task 10. Reduced-motion freeze → Task 11. Drift retires → Task 12. Replace (not toggle) → the layout/render/interaction are swapped wholesale, no toggle added. Desktop + mobile → Task 13 (shared pointer handlers; no separate path). Popover follows projection → Task 11. WebGL out of scope → never introduced. New dependency `d3-force-3d` → Task 1.
- **Type consistency:** `SphereCamera {yaw,pitch,scale}`, `projectPoint`, `depthNorm/Scale/Alpha`, `sphereRadius(n)`, `forceSphere(R, strength)`, `ROTATE_SPEED`, `PITCH_LIMIT`, `ORBIT_SENSITIVITY`, `getCamera()`, `SimNode.z`, `Simulation3` are referenced identically across tasks. `getTransform()`/`transform`/`driftOffset`/`screenToWorld` are removed in the tasks that stop using them.
- **No placeholders:** pure units (Tasks 2-4) ship complete code; integration tasks give full method bodies. The one adaptive spot is Task 7's assertion against the repo's `MockContext` — the task tells the implementer to read the mock and assert the real front>back alpha, with the concrete implementation provided.
- **Ordering:** pure/testable units first (1-4), then layout (5), render (6-7), interaction (8-11), cleanup (12), shell guard (13), verify+push (14). Each task leaves the suite green for the behavior it owns.
