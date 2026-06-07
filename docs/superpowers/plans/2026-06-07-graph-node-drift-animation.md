# Graph Node Drift Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the knowledge graph a subtle, continuous "alive" feel by floating each node along its own small elliptical path at draw time only.

**Architecture:** A render-only effect. The d3-force layout is never touched — `draw()` adds a tiny per-node offset derived from a wall clock and a per-node phase. Because drift is not part of the layout, it cannot cause overlap or fight auto-fit. The production rAF loop already repaints every frame after the layout settles, so no new animation loop is needed. Two injectable deps (`now`, `prefersReducedMotion`) make the effect deterministic in tests and accessible to motion-sensitive users.

**Tech Stack:** TypeScript, Canvas 2D, d3-force, Vitest. No new dependencies.

**Reference spec:** `docs/superpowers/specs/2026-06-07-graph-node-drift-animation-design.md`

**Tuning (validated in the visual companion):** "Gentle" — amplitude ≈ 4.5 world units, speed ≈ 0.8 rad/s, elliptical (y frequency = 0.78× x).

**Working conventions for this repo:** commit to `main`; after each task run the full graph test file, `npx tsc --noEmit`, and `npx eslint src/notepad/graph/graph-view.ts`; all commands run from `/Users/newmac/Downloads/Psalms_app`. Do NOT stage the unrelated `docs/superpowers/plans/` deletions already present in the working tree — stage only the files each task names.

---

### Task 1: Drift math primitives (pure, exported)

Add the tuning constants and a pure offset function. Exported so it can be unit-tested directly and reused by the draw code and the tests.

**Files:**
- Modify: `src/notepad/graph/graph-view.ts` (add constants + function near the other module constants, after line 88 `const AUTO_FIT_MAX_SCALE = 2.2;`)
- Test: `src/notepad/graph/graph-view.test.ts` (new `describe` block at end of file)

- [ ] **Step 1: Write the failing test**

Add at the end of `src/notepad/graph/graph-view.test.ts`:

```ts
describe('driftOffset', () => {
  it('returns zero offset when amplitude is zero', () => {
    expect(driftOffset(1.234, 5, 0)).toEqual({ ox: 0, oy: 0 });
  });

  it('is elliptical: x and y use different frequencies', () => {
    const phase = 0;
    // At t such that DRIFT_SPEED*t = PI/2, sin term is at max, cos term is not.
    const t = Math.PI / 2 / DRIFT_SPEED;
    const { ox, oy } = driftOffset(phase, t, DRIFT_AMPLITUDE);
    expect(ox).toBeCloseTo(DRIFT_AMPLITUDE, 5);
    expect(Math.abs(oy)).toBeLessThan(DRIFT_AMPLITUDE); // y runs at 0.78x => not at its peak
  });

  it('different phases produce different offsets at the same time', () => {
    const a = driftOffset(0, 3, DRIFT_AMPLITUDE);
    const b = driftOffset(2.0, 3, DRIFT_AMPLITUDE);
    expect(a).not.toEqual(b);
  });
});
```

Update the import at the top of the test file (line 2) from:

```ts
import { GraphView, DEFAULT_SETTINGS } from './graph-view';
```
to:
```ts
import { GraphView, DEFAULT_SETTINGS, driftOffset, DRIFT_AMPLITUDE, DRIFT_SPEED } from './graph-view';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/graph/graph-view.test.ts -t driftOffset`
Expected: FAIL — `driftOffset`/`DRIFT_AMPLITUDE`/`DRIFT_SPEED` are not exported (TypeScript/runtime error).

- [ ] **Step 3: Write minimal implementation**

In `src/notepad/graph/graph-view.ts`, immediately after `const AUTO_FIT_MAX_SCALE = 2.2;` (line 88), add:

```ts
// Subtle render-only "alive" motion. Amplitude is in WORLD units, so it scales
// with zoom alongside the nodes. The y axis runs at 0.78x the x frequency, which
// makes each node trace a slow ellipse rather than a circle.
export const DRIFT_AMPLITUDE = 4.5;
export const DRIFT_SPEED = 0.8;

/**
 * Per-node draw-time offset for the drift animation. Pure: no state, no clock of
 * its own. Pass amplitude 0 to freeze (used for prefers-reduced-motion).
 */
export function driftOffset(phase: number, tSeconds: number, amplitude: number): { ox: number; oy: number } {
  return {
    ox: amplitude * Math.sin(tSeconds * DRIFT_SPEED + phase),
    oy: amplitude * Math.cos(tSeconds * DRIFT_SPEED * 0.78 + phase * 1.3),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notepad/graph/graph-view.test.ts -t driftOffset`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts
git commit -m "feat(graph): add pure drift-offset math for node animation"
```

---

### Task 2: Per-node phase on SimNode

Give each node a fixed, distinct phase derived deterministically from its id, so the graph shimmers organically and the phase is stable across rebuilds.

**Files:**
- Modify: `src/notepad/graph/graph-view.ts`
  - `SimNode` interface (lines 90-99): add `phase: number;`
  - Add `hashPhase` helper near `computeRadius` (after line 110)
  - `rebuild()` node map (lines 627-637): assign `phase`
- Test: `src/notepad/graph/graph-view.test.ts` (new `describe` block at end)

- [ ] **Step 1: Write the failing test**

Add at the end of `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — node phase', () => {
  it('assigns a phase in [0, 2*PI) to every node', () => {
    const { view } = attached();
    view.setData([node({ id: 'alpha', type: 'devotion' }), node({ id: 'beta', type: 'sermon' })], [], null);
    for (const n of view.getSimNodes()) {
      expect(n.phase).toBeGreaterThanOrEqual(0);
      expect(n.phase).toBeLessThan(Math.PI * 2);
    }
  });

  it('gives different ids different phases', () => {
    const { view } = attached();
    view.setData([node({ id: 'alpha', type: 'devotion' }), node({ id: 'beta', type: 'sermon' })], [], null);
    const [a, b] = view.getSimNodes();
    expect(a.phase).not.toBe(b.phase);
  });

  it('keeps a node phase stable across a rebuild', () => {
    const { view } = attached();
    view.setData([node({ id: 'alpha', type: 'devotion' })], [], null);
    const first = view.getSimNodes()[0].phase;
    view.setData([node({ id: 'alpha', type: 'devotion' })], [], null);
    const second = view.getSimNodes()[0].phase;
    expect(second).toBe(first);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/graph/graph-view.test.ts -t "node phase"`
Expected: FAIL — `n.phase` is `undefined` (TS error `Property 'phase' does not exist on type 'SimNode'`, and the range/stability assertions fail).

- [ ] **Step 3: Write minimal implementation**

In `src/notepad/graph/graph-view.ts`:

a) Add `phase` to the `SimNode` interface (inside the `export interface SimNode` block, lines 90-99):

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
}
```

b) Add the helper immediately after `computeRadius` (after line 110):

```ts
/**
 * Deterministic per-node animation phase in [0, 2*PI), derived from the node id.
 * Stable across rebuilds (no per-frame randomness, no popping) and well spread
 * across distinct ids.
 */
function hashPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  const positive = ((h % 1000) + 1000) % 1000;
  return (positive / 1000) * Math.PI * 2;
}
```

c) In `rebuild()`, assign `phase` in the node map (the object returned at lines 629-636):

```ts
    this.simNodes = filtered.map((n) => {
      const prev = prevPos.get(n.id);
      return {
        id: n.id, type: n.type, title: n.title, weight: n.weight,
        radius: computeRadius(n.type, n.weight, this.settings.nodeSize),
        tags: n.tags,
        scriptureText: n.scriptureText,
        scriptureTranslation: n.scriptureTranslation,
        phase: hashPhase(n.id),
        x: prev?.x, y: prev?.y, vx: prev?.vx, vy: prev?.vy,
      };
    });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notepad/graph/graph-view.test.ts -t "node phase"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts
git commit -m "feat(graph): assign deterministic per-node animation phase"
```

---

### Task 3: Apply drift to nodes (deps + draw)

Add the `now` and `prefersReducedMotion` deps and apply the offset to every node-anchored element: the node circle, its label, the active-node glow rings, and the hover ring.

**Files:**
- Modify: `src/notepad/graph/graph-view.ts`
  - `GraphViewDeps` interface (lines 48-58): add `now` and `prefersReducedMotion`
  - `draw()` (lines 293-376): compute clock + amplitude + a `drawnPos` helper, and use drawn positions for nodes, labels, active glow, and hover ring (edges handled in Task 4)
- Test: `src/notepad/graph/graph-view.test.ts` (new `describe` block at end)

- [ ] **Step 1: Write the failing test**

Add at the end of `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — node drift animation', () => {
  // Returns the [x, y] centre of the last arc drawn (the node circle for a
  // single, non-active, non-hovered node).
  function lastArcCentre(canvas: MockCanvas): [number, number] {
    const arcs = canvas.ctx.calls.filter((c) => c.method === 'arc');
    const args = arcs[arcs.length - 1].args as number[];
    return [args[0], args[1]];
  }

  function pinnedSingleNode(over: Partial<GraphViewDeps>) {
    const { deps, opens } = makeDeps(over);
    const view = new GraphView(deps);
    const canvas = new MockCanvas();
    const container = new MockContainer(400, 400);
    view.attach(canvas as unknown as HTMLCanvasElement, container as unknown as HTMLElement);
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    // Pin position so the d3 simulation cannot move the node; only drift can.
    const s = view.getSimNodes()[0];
    s.fx = 100; s.fy = 200;
    return { view, canvas, opens, phase: s.phase };
  }

  it('moves a node draw position as the clock advances', () => {
    let clock = 0;
    const { view, canvas, phase } = pinnedSingleNode({ now: () => clock });
    view.tickFor(1); // draws at clock = 0
    expect(lastArcCentre(canvas)).toEqual([
      100 + driftOffset(phase, 0, DRIFT_AMPLITUDE).ox,
      200 + driftOffset(phase, 0, DRIFT_AMPLITUDE).oy,
    ]);

    clock = 1500; // 1.5 seconds later
    view.tickFor(1); // draws at clock = 1500
    const t = 1.5;
    expect(lastArcCentre(canvas)).toEqual([
      100 + driftOffset(phase, t, DRIFT_AMPLITUDE).ox,
      200 + driftOffset(phase, t, DRIFT_AMPLITUDE).oy,
    ]);
  });

  it('freezes when prefers-reduced-motion is set', () => {
    let clock = 0;
    const { view, canvas } = pinnedSingleNode({ now: () => clock, prefersReducedMotion: () => true });
    view.tickFor(1);
    expect(lastArcCentre(canvas)).toEqual([100, 200]);
    clock = 9999;
    view.tickFor(1);
    expect(lastArcCentre(canvas)).toEqual([100, 200]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/graph/graph-view.test.ts -t "node drift animation"`
Expected: FAIL — `now`/`prefersReducedMotion` are not on `GraphViewDeps` (TS error) and the arc centre is the un-offset `[100, 200]` for the moving test.

- [ ] **Step 3: Write minimal implementation**

a) In `src/notepad/graph/graph-view.ts`, extend `GraphViewDeps` (add the two optional fields to the interface ending at line 58):

```ts
export interface GraphViewDeps {
  onNodeOpen: (noteId: string) => void;
  devicePixelRatio?: () => number;
  /**
   * Wall clock in milliseconds for the drift animation. Defaults to
   * performance.now(). Injected so tests can drive the animation deterministically.
   */
  now?: () => number;
  /**
   * When this returns true, the drift animation is disabled and the graph renders
   * perfectly static (respects the user's prefers-reduced-motion setting).
   * Defaults to false (animate).
   */
  prefersReducedMotion?: () => boolean;
  /**
   * Optional tap interceptor. When provided AND it returns true, the view
   * suppresses its default tap behavior (onNodeOpen for note nodes, popover for
   * scripture nodes). Used by the embedded mobile graph to route taps to a peek
   * view. Desktop omits it, so default behavior is preserved.
   */
  onNodeTap?: (node: { id: string; type: GraphNode['type']; title: string }) => boolean;
}
```

b) Rewrite `draw()` (lines 293-376). Add the clock/amplitude/`drawnPos` helper near the top and use `drawnPos(...)` for every node-anchored element. **Leave the edges loop using base positions for now — Task 4 changes it.** Replace the whole method with:

```ts
  private draw(): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    const dpr = this.deps.devicePixelRatio?.() ?? 1;
    const { x: tx, y: ty, scale } = this.transform;

    const t = (this.deps.now?.() ?? performance.now()) / 1000;
    const amp = this.deps.prefersReducedMotion?.() ? 0 : DRIFT_AMPLITUDE;
    const drawnPos = (n: SimNode): { x: number; y: number } => {
      const { ox, oy } = driftOffset(n.phase, t, amp);
      return { x: (n.x ?? 0) + ox, y: (n.y ?? 0) + oy };
    };

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, tx * dpr, ty * dpr);

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

    // Edges
    for (const link of this.simLinks) {
      const src = link.source as SimNode;
      const tgt = link.target as SimNode;
      if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue;
      const isHighlighted = hovered && connectedIds.has(src.id) && connectedIds.has(tgt.id);
      const alpha = hovered ? (isHighlighted ? 0.9 : 0.06) : 0.55;
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = `rgba(168, 160, 145, ${alpha})`;
      ctx.lineWidth = (5 + link.weight * 3.5) * this.settings.edgeThickness;
      ctx.stroke();
    }

    // Nodes
    const activeId = this.effectiveActiveId();
    for (const n of this.simNodes) {
      if (n.x == null || n.y == null) continue;
      const d = drawnPos(n);
      const isConnected = !hovered || connectedIds.has(n.id);
      const alpha = hovered ? (isConnected ? 1 : 0.12) : 1;
      const color = NODE_COLORS[n.type] ?? '#999';

      if (n.id === activeId) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, n.radius + 10, 0, Math.PI * 2);
        ctx.fillStyle = `${color}30`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(d.x, d.y, n.radius + 5, 0, Math.PI * 2);
        ctx.fillStyle = `${color}20`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(d.x, d.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.font = `${n.radius > 38 ? '26px' : '23px'} Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(62, 50, 40, ${alpha * 0.85})`;
      ctx.fillText(n.title, d.x, d.y + n.radius + 22);
    }

    if (hovered) {
      const n = this.simNodes.find((x) => x.id === hovered);
      if (n && n.x != null && n.y != null) {
        const d = drawnPos(n);
        ctx.beginPath();
        ctx.arc(d.x, d.y, n.radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = `${NODE_COLORS[n.type] ?? '#999'}80`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    ctx.restore();
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notepad/graph/graph-view.test.ts -t "node drift animation"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts
git commit -m "feat(graph): drift node circles, labels, and rings at draw time"
```

---

### Task 4: Apply drift to edge endpoints

Make each edge's endpoints follow its source/target nodes' drifted positions so lines stay visually attached.

**Files:**
- Modify: `src/notepad/graph/graph-view.ts` — the edges loop inside `draw()`
- Test: `src/notepad/graph/graph-view.test.ts` (new `describe` block at end)

- [ ] **Step 1: Write the failing test**

Add at the end of `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — edge drift follows nodes', () => {
  it('draws edge endpoints at the drifted node positions', () => {
    let clock = 4000; // 4 seconds
    const { deps } = makeDeps({ now: () => clock });
    const view = new GraphView(deps);
    const canvas = new MockCanvas();
    const container = new MockContainer(400, 400);
    view.attach(canvas as unknown as HTMLCanvasElement, container as unknown as HTMLElement);
    view.setData(
      [node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' })],
      [edge({ id: 'r1', source: 'a', target: 'b' })],
      null,
    );
    const a = view.getSimNodes().find((n) => n.id === 'a')!;
    const b = view.getSimNodes().find((n) => n.id === 'b')!;
    a.fx = 100; a.fy = 100;
    b.fx = 300; b.fy = 300;

    view.tickFor(1); // pins x=fx, y=fy, then draws

    const t = 4;
    const oa = driftOffset(a.phase, t, DRIFT_AMPLITUDE);
    const ob = driftOffset(b.phase, t, DRIFT_AMPLITUDE);

    const moveTo = canvas.ctx.calls.find((c) => c.method === 'moveTo')!.args as number[];
    const lineTo = canvas.ctx.calls.find((c) => c.method === 'lineTo')!.args as number[];
    expect(moveTo).toEqual([100 + oa.ox, 100 + oa.oy]);
    expect(lineTo).toEqual([300 + ob.ox, 300 + ob.oy]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/graph/graph-view.test.ts -t "edge drift follows nodes"`
Expected: FAIL — `moveTo`/`lineTo` are still the un-offset `[100,100]`/`[300,300]` because the edges loop uses base positions.

- [ ] **Step 3: Write minimal implementation**

In `src/notepad/graph/graph-view.ts`, change the edges loop inside `draw()` to use `drawnPos`. Replace:

```ts
    // Edges
    for (const link of this.simLinks) {
      const src = link.source as SimNode;
      const tgt = link.target as SimNode;
      if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue;
      const isHighlighted = hovered && connectedIds.has(src.id) && connectedIds.has(tgt.id);
      const alpha = hovered ? (isHighlighted ? 0.9 : 0.06) : 0.55;
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = `rgba(168, 160, 145, ${alpha})`;
      ctx.lineWidth = (5 + link.weight * 3.5) * this.settings.edgeThickness;
      ctx.stroke();
    }
```

with:

```ts
    // Edges
    for (const link of this.simLinks) {
      const src = link.source as SimNode;
      const tgt = link.target as SimNode;
      if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue;
      const a = drawnPos(src);
      const b = drawnPos(tgt);
      const isHighlighted = hovered && connectedIds.has(src.id) && connectedIds.has(tgt.id);
      const alpha = hovered ? (isHighlighted ? 0.9 : 0.06) : 0.55;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(168, 160, 145, ${alpha})`;
      ctx.lineWidth = (5 + link.weight * 3.5) * this.settings.edgeThickness;
      ctx.stroke();
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notepad/graph/graph-view.test.ts -t "edge drift follows nodes"`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts
git commit -m "feat(graph): keep edge endpoints attached to drifting nodes"
```

---

### Task 5: Wire prefers-reduced-motion in the React shell

So the effect actually respects the OS setting in production. (`now` correctly defaults to `performance.now()`, so no wiring is needed for it.)

**Files:**
- Modify: `src/components/sections/notepad/GraphPane.tsx:60-68`

- [ ] **Step 1: Implement the wiring**

In `src/components/sections/notepad/GraphPane.tsx`, add the `prefersReducedMotion` dep to the `new GraphView({ ... })` call. Replace:

```tsx
  const view = useMemo(() => new GraphView({
    onNodeOpen: (id) => openNote(id),
    devicePixelRatio: () => window.devicePixelRatio || 1,
    onNodeTap: (n) => {
      const cb = onNodePeekRef.current;
      if (cb) { cb(n); return true; }
      return false;
    },
  }), [openNote]);
```

with:

```tsx
  const view = useMemo(() => new GraphView({
    onNodeOpen: (id) => openNote(id),
    devicePixelRatio: () => window.devicePixelRatio || 1,
    prefersReducedMotion: () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    onNodeTap: (n) => {
      const cb = onNodePeekRef.current;
      if (cb) { cb(n); return true; }
      return false;
    },
  }), [openNote]);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/notepad/GraphPane.tsx
git commit -m "feat(graph): respect prefers-reduced-motion for node drift"
```

---

### Task 6: Full verification and push

**Files:** none (verification only)

- [ ] **Step 1: Run the full graph test file**

Run: `npx vitest run src/notepad/graph/graph-view.test.ts`
Expected: PASS — all prior tests plus the new `driftOffset` (3), `node phase` (3), `node drift animation` (2), and `edge drift follows nodes` (1) tests. Total: 65 passed.

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint the changed source files**

Run: `npx eslint src/notepad/graph/graph-view.ts src/components/sections/notepad/GraphPane.tsx`
Expected: clean (no new errors). Note: four pre-existing `_t`/`_depth` unused-parameter lint errors live in `graph-view.test.ts` on committed `main` and are out of scope — do not "fix" unrelated code. Do not introduce any new lint errors in the files you touched.

- [ ] **Step 4: Push**

```bash
git push origin main
```
Expected: the six commits land on `origin/main`.

---

## Self-Review Notes

- **Spec coverage:** chosen behaviour (drift/Gentle) → Tasks 1+3+4; render-only/no-layout-touch → Task 3/4 (only `draw()` changes; simulation forces untouched); world-unit amplitude scaling → Task 1 constant + Task 3 (`drawnPos` adds offset before `setTransform`); per-node deterministic phase → Task 2; hit-testing unchanged → no interaction code is modified in any task; `prefers-reduced-motion` → Task 3 (amplitude 0) + Task 5 (production wiring); injectable `now`/`prefersReducedMotion` → Task 3; all four spec test-plan items → Tasks 1-4. Rejected alternative (re-heating the sim) is not implemented.
- **Type consistency:** `driftOffset(phase, tSeconds, amplitude)`, `DRIFT_AMPLITUDE`, `DRIFT_SPEED`, `hashPhase(id)`, `SimNode.phase`, and deps `now`/`prefersReducedMotion` are referenced identically across tasks and tests.
- **No placeholders:** every code and test step is complete and runnable.
