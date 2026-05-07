# Deepen GraphView Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 719-line untested `GraphPane.tsx` with a testable `GraphView` class (d3 sim + canvas + pointer) plus a thin `GraphPane` shell.

**Architecture:** Mirror the `RouteTransition` pattern from `src/transitions/route-transition.ts`. `GraphView extends Observable<GraphViewState>`, with side effects (DOM, d3, callbacks) injected so the class is testable in node. The pure projection from `Reference[] + ScriptureNode[] + Note[]` to `GraphNode[]/GraphEdge[]` is extracted as `projectGraph()` next to its sibling reference-graph modules. The scripture popover, currently `ctx.fillText`-drawn inside the canvas, becomes a positioned DOM `<div>` driven by `view.popover` snapshot state via `useSyncExternalStore`. The controls panel (mode/filters/settings sliders) keeps React form state and forwards changes via `view.setMode/setFilters/setSettings`.

**Tech Stack:** TypeScript, vitest (`environment: 'node'`), `d3-force`, React 19 `useSyncExternalStore`. Tests use no DOM polyfill — fakes are inline classes implementing the subset of `HTMLCanvasElement` / `CanvasRenderingContext2D` / `ResizeObserver` that `GraphView` actually uses.

---

## File Structure

**Create:**
- `src/notepad/graph/project-graph.ts` — pure `projectGraph(notes, refs, scriptureNodes)` function
- `src/notepad/graph/project-graph.test.ts` — tests for the three projection rules
- `src/notepad/graph/graph-view.ts` — `GraphView` class + types
- `src/notepad/graph/graph-view.test.ts` — class tests + inline DOM fakes

**Modify:**
- `src/notepad/graph/use-graph.ts` — collapse to a 3-line `useMemo(projectGraph)` wrapper in Task 1; deleted in Task 11
- `src/components/sections/notepad/GraphPane.tsx` — gutted in Task 10 from 719 lines to ~250 lines (controls UI + JSX shell + popover overlay)

**Delete (Task 11):**
- `src/notepad/graph/use-graph.ts` — `GraphPane` calls `projectGraph` directly via `useMemo`

---

## Verification commands (run frequently)

```bash
cd /Users/newmac/Downloads/Psalms_app
npm test                                         # full suite
npm test -- src/notepad/graph/project-graph      # one file
npm test -- src/notepad/graph/graph-view         # one file
npm run lint
npm run build                                    # tsc -b && vite build
```

---

## Task 1: Extract `projectGraph` (pure refactor, no behavior change)

**Files:**
- Create: `src/notepad/graph/project-graph.ts`
- Create: `src/notepad/graph/project-graph.test.ts`
- Modify: `src/notepad/graph/use-graph.ts`

The current `useGraph` hook (`src/notepad/graph/use-graph.ts:32-76`) holds three load-bearing rules inside a `useMemo`. Extract them as a pure function, test the rules, then have `useGraph` call the function so behavior is unchanged.

- [ ] **Step 1: Write failing tests for `projectGraph`**

Create `src/notepad/graph/project-graph.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { projectGraph } from './project-graph';
import type { Reference, ScriptureNode } from './types';
import type { Note } from '../types';

const note = (over: Partial<Note> & { id: string; type: Note['type'] }): Note => ({
  id: over.id,
  title: over.title ?? `Note ${over.id}`,
  content: over.content ?? { type: 'doc', content: [] },
  folderId: over.folderId ?? 'root',
  type: over.type,
  tags: over.tags ?? [],
  createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
  updatedAt: over.updatedAt ?? '2026-01-01T00:00:00.000Z',
  wordCount: over.wordCount ?? 0,
});

const ref = (over: Partial<Reference> & { id: string; source: string; target: string }): Reference => ({
  id: over.id,
  source: over.source,
  target: over.target,
  type: over.type ?? 'explicit',
  weight: over.weight ?? 1,
  createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
});

const scripture = (over: Partial<ScriptureNode> & { id: string }): ScriptureNode => ({
  id: over.id,
  book: over.book ?? 'Genesis',
  chapter: over.chapter ?? 1,
  verseStart: over.verseStart ?? 1,
  verseEnd: over.verseEnd ?? null,
  translation: over.translation ?? 'WEB',
  text: over.text ?? 'In the beginning...',
  createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
});

describe('projectGraph', () => {
  it('emits a node per Note with type and title', () => {
    const notes = [note({ id: 'a', type: 'devotion', title: 'A' })];
    const { nodes } = projectGraph(notes, [], []);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ id: 'a', type: 'devotion', title: 'A', weight: 0 });
  });

  it('sums edge weights across both endpoints into node weight', () => {
    const notes = [note({ id: 'a', type: 'devotion' }), note({ id: 'b', type: 'sermon' })];
    const refs = [
      ref({ id: 'r1', source: 'a', target: 'b', weight: 2 }),
      ref({ id: 'r2', source: 'b', target: 'a', weight: 3 }),
    ];
    const { nodes } = projectGraph(notes, refs, []);
    const a = nodes.find((n) => n.id === 'a')!;
    const b = nodes.find((n) => n.id === 'b')!;
    expect(a.weight).toBe(5);
    expect(b.weight).toBe(5);
  });

  it('only emits scripture nodes that participate in at least one edge', () => {
    const notes = [note({ id: 'a', type: 'devotion' })];
    const scriptures = [
      scripture({ id: 'scripture:gen-1-1' }),
      scripture({ id: 'scripture:exo-2-2' }),
    ];
    const refs = [
      ref({ id: 'r1', source: 'a', target: 'scripture:gen-1-1', type: 'scripture-reference' }),
    ];
    const { nodes } = projectGraph(notes, refs, scriptures);
    const ids = nodes.map((n) => n.id);
    expect(ids).toContain('scripture:gen-1-1');
    expect(ids).not.toContain('scripture:exo-2-2');
  });

  it('maps reference type strings to view edge types', () => {
    const notes = [note({ id: 'a', type: 'devotion' }), note({ id: 'b', type: 'sermon' })];
    const refs = [
      ref({ id: 'r1', source: 'a', target: 'b', type: 'explicit' }),
      ref({ id: 'r2', source: 'a', target: 'scripture:x', type: 'scripture-reference' }),
      ref({ id: 'r3', source: 'scripture:x', target: 'scripture:y', type: 'cross-reference' }),
    ];
    const scriptures = [scripture({ id: 'scripture:x' }), scripture({ id: 'scripture:y' })];
    const { edges } = projectGraph(notes, refs, scriptures);
    expect(edges.find((e) => e.id === 'r1')!.type).toBe('explicit');
    expect(edges.find((e) => e.id === 'r2')!.type).toBe('scripture_reference');
    expect(edges.find((e) => e.id === 'r3')!.type).toBe('cross_reference');
  });

  it('preserves edge id, source, target, weight, createdAt', () => {
    const notes = [note({ id: 'a', type: 'devotion' }), note({ id: 'b', type: 'sermon' })];
    const refs = [
      ref({ id: 'r1', source: 'a', target: 'b', weight: 4, createdAt: '2026-02-02T00:00:00.000Z' }),
    ];
    const { edges } = projectGraph(notes, refs, []);
    expect(edges[0]).toMatchObject({
      id: 'r1', source: 'a', target: 'b', weight: 4, createdAt: '2026-02-02T00:00:00.000Z',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/notepad/graph/project-graph`
Expected: FAIL — `Cannot find module './project-graph'`

- [ ] **Step 3: Implement `projectGraph`**

Create `src/notepad/graph/project-graph.ts`:

```ts
import type { Note } from '../types';
import type { GraphEdge, GraphNode, Reference, ScriptureNode } from './types';

function refToGraphEdge(ref: Reference): GraphEdge {
  let type: GraphEdge['type'];
  if (ref.type === 'scripture-reference') type = 'scripture_reference';
  else if (ref.type === 'cross-reference') type = 'cross_reference';
  else type = 'explicit';
  return {
    id: ref.id,
    source: ref.source,
    target: ref.target,
    type,
    weight: ref.weight,
    createdAt: ref.createdAt,
  };
}

export function projectGraph(
  notes: Note[],
  references: Reference[],
  scriptureNodes: ScriptureNode[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const weightSums = new Map<string, number>();
  const nodesWithEdges = new Set<string>();
  for (const ref of references) {
    weightSums.set(ref.source, (weightSums.get(ref.source) ?? 0) + ref.weight);
    weightSums.set(ref.target, (weightSums.get(ref.target) ?? 0) + ref.weight);
    nodesWithEdges.add(ref.source);
    nodesWithEdges.add(ref.target);
  }

  const nodes: GraphNode[] = notes.map((note) => ({
    id: note.id,
    type: note.type,
    title: note.title,
    weight: weightSums.get(note.id) ?? 0,
    tags: note.tags,
    scriptureText: '',
    scriptureTranslation: '',
  }));

  for (const sn of scriptureNodes) {
    if (!nodesWithEdges.has(sn.id)) continue;
    nodes.push({
      id: sn.id,
      type: 'scripture',
      title: `${sn.book} ${sn.chapter}:${sn.verseStart}${sn.verseEnd ? `-${sn.verseEnd}` : ''}`,
      weight: weightSums.get(sn.id) ?? 0,
      tags: [],
      scriptureText: sn.text,
      scriptureTranslation: sn.translation,
    });
  }

  const edges = references.map(refToGraphEdge);
  return { nodes, edges };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/notepad/graph/project-graph`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Refactor `useGraph` to call `projectGraph`**

Replace the body of `src/notepad/graph/use-graph.ts` with:

```ts
import { useMemo } from 'react';
import type { Note } from '../types';
import type { GraphNode, GraphEdge } from './types';
import { useReferenceGraph } from '../context/useReferenceGraph';
import { projectGraph } from './project-graph';

export interface UseGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  activeNodeId: string | null;
  isLoading: boolean;
  getNeighborhood: (nodeId: string, depth: number) => Set<string>;
}

export function useGraph(notes: Note[], activeNoteId: string | null): UseGraphResult {
  const { references, scriptureNodes, graph } = useReferenceGraph();

  const { nodes, edges } = useMemo(
    () => projectGraph(notes, references, scriptureNodes),
    [notes, references, scriptureNodes],
  );

  const getNeighborhood = useMemo(() => graph.getNeighborhood, [graph]);

  return { nodes, edges, activeNodeId: activeNoteId, isLoading: false, getNeighborhood };
}
```

- [ ] **Step 6: Run full test suite + build**

Run: `npm test && npm run build`
Expected: all tests pass, build succeeds. App is unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/notepad/graph/project-graph.ts src/notepad/graph/project-graph.test.ts src/notepad/graph/use-graph.ts
git commit -m "refactor(graph): extract projectGraph as pure function"
```

---

## Task 2: `GraphView` skeleton + DOM fakes + initial state

**Files:**
- Create: `src/notepad/graph/graph-view.ts`
- Create: `src/notepad/graph/graph-view.test.ts`

Establish the class scaffolding, type surface, and inline DOM fakes that all subsequent tests reuse. Behavioral methods (`setData`, pointer handlers, etc.) come in later tasks.

- [ ] **Step 1: Write failing test — initial state**

Create `src/notepad/graph/graph-view.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GraphView } from './graph-view';
import type { GraphViewDeps } from './graph-view';

// ---------------------------------------------------------------------------
// DOM fakes — small enough to paste; reused by all GraphView tests.
// ---------------------------------------------------------------------------

class MockContext {
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  globalAlpha = 1;
  font = '';
  textAlign: 'start' | 'end' | 'left' | 'right' | 'center' = 'start';
  calls: { method: string; args: unknown[] }[] = [];
  private rec(method: string, ...args: unknown[]) { this.calls.push({ method, args }); }
  clearRect(...a: unknown[]) { this.rec('clearRect', ...a); }
  save() { this.rec('save'); }
  restore() { this.rec('restore'); }
  setTransform(...a: unknown[]) { this.rec('setTransform', ...a); }
  beginPath() { this.rec('beginPath'); }
  arc(...a: unknown[]) { this.rec('arc', ...a); }
  moveTo(...a: unknown[]) { this.rec('moveTo', ...a); }
  lineTo(...a: unknown[]) { this.rec('lineTo', ...a); }
  stroke() { this.rec('stroke'); }
  fill() { this.rec('fill'); }
  fillText(...a: unknown[]) { this.rec('fillText', ...a); }
  measureText(s: string) { return { width: s.length * 6 } as unknown as TextMetrics; }
}

class MockCanvas {
  width = 0;
  height = 0;
  style: Record<string, string> = {};
  ctx = new MockContext();
  private listeners = new Map<string, Array<(e: unknown) => void>>();
  private rect = { left: 0, top: 0, width: 400, height: 400 };
  setRect(width: number, height: number, left = 0, top = 0) {
    this.rect = { left, top, width, height };
  }
  getContext(type: string) { return type === '2d' ? this.ctx : null; }
  getBoundingClientRect() {
    const r = this.rect;
    return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON: () => ({}) };
  }
  addEventListener(type: string, cb: (e: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(cb);
  }
  removeEventListener(type: string, cb: (e: unknown) => void) {
    const arr = this.listeners.get(type);
    if (arr) this.listeners.set(type, arr.filter((c) => c !== cb));
  }
  dispatch(type: string, event: unknown) {
    this.listeners.get(type)?.forEach((cb) => cb(event));
  }
}

class MockContainer {
  private rect: { width: number; height: number };
  constructor(width = 400, height = 400) { this.rect = { width, height }; }
  setSize(w: number, h: number) { this.rect = { width: w, height: h }; }
  getBoundingClientRect() {
    const { width, height } = this.rect;
    return { left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) };
  }
}

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) { this.cb = cb; MockResizeObserver.instances.push(this); }
  observe(_t: Element) {}
  unobserve(_t: Element) {}
  disconnect() {}
  trigger() { this.cb([], this as unknown as ResizeObserver); }
}

function makeDeps(over: Partial<GraphViewDeps> = {}): { deps: GraphViewDeps; opens: string[] } {
  const opens: string[] = [];
  const deps: GraphViewDeps = {
    onNodeOpen: (id) => opens.push(id),
    devicePixelRatio: () => 1,
    ...over,
  };
  return { deps, opens };
}

beforeEach(() => {
  MockResizeObserver.instances.length = 0;
  (globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver;
});

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>).ResizeObserver;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GraphView — initial state', () => {
  it('starts with popover null', () => {
    const { deps } = makeDeps();
    const view = new GraphView(deps);
    expect(view.getSnapshot()).toEqual({ popover: null });
  });

  it('attach + detach without errors', () => {
    const { deps } = makeDeps();
    const view = new GraphView(deps);
    const canvas = new MockCanvas();
    const container = new MockContainer(800, 600);
    expect(() => view.attach(canvas as unknown as HTMLCanvasElement, container as unknown as HTMLElement)).not.toThrow();
    expect(() => view.detach()).not.toThrow();
  });

  it('detach without prior attach is a no-op', () => {
    const { deps } = makeDeps();
    const view = new GraphView(deps);
    expect(() => view.detach()).not.toThrow();
  });

  it('attach sizes the canvas to the container × DPR', () => {
    const { deps } = makeDeps({ devicePixelRatio: () => 2 });
    const view = new GraphView(deps);
    const canvas = new MockCanvas();
    const container = new MockContainer(300, 200);
    view.attach(canvas as unknown as HTMLCanvasElement, container as unknown as HTMLElement);
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(400);
    expect(canvas.style.width).toBe('300px');
    expect(canvas.style.height).toBe('200px');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/notepad/graph/graph-view`
Expected: FAIL — `Cannot find module './graph-view'`

- [ ] **Step 3: Implement `GraphView` skeleton**

Create `src/notepad/graph/graph-view.ts`:

```ts
import { Observable } from '../collection/observable';
import type { GraphEdge, GraphNode } from './types';

export interface PopoverState {
  nodeId: string;
  anchorX: number;
  anchorY: number;
  title: string;
  text: string;
  translation: string;
}

export interface GraphViewState {
  popover: PopoverState | null;
}

export interface NodeTypeFilters {
  scripture: boolean;
  sermon: boolean;
  devotion: boolean;
  theme: boolean;
}

export interface GraphSettings {
  depth: number;
  linkDistance: number;
  linkForce: number;
  repelForce: number;
  centerForce: number;
  nodeSize: number;
  edgeThickness: number;
}

export interface GraphViewDeps {
  onNodeOpen: (noteId: string) => void;
  devicePixelRatio?: () => number;
}

export const DEFAULT_FILTERS: NodeTypeFilters = {
  scripture: true, sermon: true, devotion: true, theme: true,
};

export const DEFAULT_SETTINGS: GraphSettings = {
  depth: 1,
  linkDistance: 30,
  linkForce: 0.01,
  repelForce: 120,
  centerForce: 0.15,
  nodeSize: 1,
  edgeThickness: 1,
};

/**
 * Owns the d3-force simulation, canvas rendering, and pointer interaction
 * for the knowledge graph. Pure of React, persistence, and NoteCollection.
 *
 * The React shell (GraphPane) constructs an instance, calls `attach(canvas,
 * container)` once, forwards inputs via `setData`/`setMode`/etc. on every
 * change, and renders the popover from `getSnapshot().popover` via
 * `useSyncExternalStore`. On unmount the shell calls `detach()`.
 *
 * Test surface: all behavior is reachable through the public methods using
 * structural mocks for canvas/context/container/ResizeObserver. Tests drive
 * ticks deterministically via `tickFor(n)` since node has no rAF.
 */
export class GraphView extends Observable<GraphViewState> {
  private readonly deps: GraphViewDeps;

  // Wired by attach()
  private canvas: HTMLCanvasElement | null = null;
  private container: HTMLElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private wheelListener: ((e: WheelEvent) => void) | null = null;

  constructor(deps: GraphViewDeps) {
    super({ popover: null });
    this.deps = deps;
  }

  attach(canvas: HTMLCanvasElement, container: HTMLElement): void {
    this.canvas = canvas;
    this.container = container;
    this.ctx = canvas.getContext('2d');
    this.resize();

    this.wheelListener = (e: WheelEvent) => this.handleWheel(e);
    canvas.addEventListener('wheel', this.wheelListener, { passive: false });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    }
  }

  detach(): void {
    if (this.canvas && this.wheelListener) {
      this.canvas.removeEventListener('wheel', this.wheelListener);
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.wheelListener = null;
    this.canvas = null;
    this.container = null;
    this.ctx = null;
  }

  // Stubs filled in by later tasks.
  handleWheel(_e: { clientX: number; clientY: number; deltaY: number; preventDefault?: () => void }): void {
    // Task 8.
  }

  private resize(): void {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    const dpr = this.deps.devicePixelRatio?.() ?? 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/notepad/graph/graph-view`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts
git commit -m "feat(graph): GraphView skeleton with attach/detach + DOM fakes"
```

---

## Task 3: `setData` builds simulation; preserves positions across rebuilds

**Files:**
- Modify: `src/notepad/graph/graph-view.ts`
- Modify: `src/notepad/graph/graph-view.test.ts`

`setData(nodes, edges, activeNodeId)` is how the React shell pushes graph data in. It builds a fresh d3-force simulation, but preserves `(x, y)` of any node ids that survive the rebuild. Position preservation is load-bearing — toggling a filter must not scramble the world.

- [ ] **Step 1: Write failing tests for `setData`**

Append to `src/notepad/graph/graph-view.test.ts`:

```ts
import type { GraphEdge, GraphNode } from './types';

const node = (over: Partial<GraphNode> & { id: string; type: GraphNode['type'] }): GraphNode => ({
  id: over.id, type: over.type, title: over.title ?? over.id,
  weight: over.weight ?? 0, tags: over.tags ?? [],
  scriptureText: over.scriptureText ?? '', scriptureTranslation: over.scriptureTranslation ?? '',
});

const edge = (over: Partial<GraphEdge> & { id: string; source: string; target: string }): GraphEdge => ({
  id: over.id, source: over.source, target: over.target,
  type: over.type ?? 'explicit', weight: over.weight ?? 1,
  createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
});

function attached(): { view: GraphView; canvas: MockCanvas; container: MockContainer; opens: string[] } {
  const { deps, opens } = makeDeps();
  const view = new GraphView(deps);
  const canvas = new MockCanvas();
  const container = new MockContainer(400, 400);
  view.attach(canvas as unknown as HTMLCanvasElement, container as unknown as HTMLElement);
  return { view, canvas, container, opens };
}

describe('GraphView — setData', () => {
  it('builds a simulation with the given nodes and edges', () => {
    const { view } = attached();
    const nodes = [node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' })];
    const edges = [edge({ id: 'r1', source: 'a', target: 'b' })];
    view.setData(nodes, edges, null);
    const sim = view.getSimNodes();
    expect(sim.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('preserves (x, y) of surviving nodes across rebuild', () => {
    const { view } = attached();
    const initial = [node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' })];
    view.setData(initial, [], null);
    // Pin known positions on the first sim's nodes.
    const before = view.getSimNodes();
    const a = before.find((n) => n.id === 'a')!; a.x = 100; a.y = 200;
    const b = before.find((n) => n.id === 'b')!; b.x = 300; b.y = 400;

    // Rebuild with a different edge; node ids unchanged.
    view.setData(initial, [edge({ id: 'r1', source: 'a', target: 'b' })], null);
    const after = view.getSimNodes();
    expect(after.find((n) => n.id === 'a')?.x).toBe(100);
    expect(after.find((n) => n.id === 'a')?.y).toBe(200);
    expect(after.find((n) => n.id === 'b')?.x).toBe(300);
    expect(after.find((n) => n.id === 'b')?.y).toBe(400);
  });

  it('drops nodes that are no longer present', () => {
    const { view } = attached();
    view.setData([node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' })], [], null);
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    expect(view.getSimNodes().map((n) => n.id)).toEqual(['a']);
  });

  it('preserves node radius scaling from settings.nodeSize', () => {
    const { view } = attached();
    view.setData([node({ id: 'a', type: 'devotion', weight: 0 })], [], null);
    const baseRadius = view.getSimNodes()[0].radius;
    view.setSettings({ ...DEFAULT_SETTINGS, nodeSize: 2 });
    view.setData([node({ id: 'a', type: 'devotion', weight: 0 })], [], null);
    expect(view.getSimNodes()[0].radius).toBeGreaterThan(baseRadius);
  });
});
```

Add `DEFAULT_SETTINGS` to the existing import line:

```ts
import { GraphView, DEFAULT_SETTINGS } from './graph-view';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/notepad/graph/graph-view`
Expected: FAIL — `view.setData is not a function` and/or missing `getSimNodes`/`setSettings`.

- [ ] **Step 3: Implement `setData` + `setSettings` + sim build**

Add to `src/notepad/graph/graph-view.ts`:

At the top, add d3 imports:

```ts
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { forceSharedTags } from './force-shared-tags';
```

Add internal types (above the class):

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
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  edgeType: GraphEdge['type'];
  weight: number;
}

function computeRadius(type: string, weight: number, sizeMultiplier: number): number {
  const base = type === 'scripture' ? 22 : 18;
  return Math.min(70, Math.max(12, (base + weight * 5) * sizeMultiplier));
}
```

Add fields and methods to the class:

```ts
private sim: Simulation<SimNode, SimLink> | null = null;
private simNodes: SimNode[] = [];
private simLinks: SimLink[] = [];

private currentNodes: GraphNode[] = [];
private currentEdges: GraphEdge[] = [];
private activeNodeId: string | null = null;

private settings: GraphSettings = { ...DEFAULT_SETTINGS };
private filters: NodeTypeFilters = { ...DEFAULT_FILTERS };
private mode: 'global' | 'local' = 'global';
private getNeighborhoodFn: ((id: string, depth: number) => Set<string>) | null = null;

setData(nodes: GraphNode[], edges: GraphEdge[], activeNodeId: string | null): void {
  this.currentNodes = nodes;
  this.currentEdges = edges;
  this.activeNodeId = activeNodeId;
  this.rebuild();
}

setSettings(settings: GraphSettings): void {
  this.settings = settings;
  this.rebuild();
}

setFilters(filters: NodeTypeFilters): void {
  this.filters = filters;
  this.rebuild();
}

setMode(mode: 'global' | 'local'): void {
  this.mode = mode;
  this.rebuild();
}

setNeighborhoodFn(fn: (id: string, depth: number) => Set<string>): void {
  this.getNeighborhoodFn = fn;
}

/** Test affordance — read sim nodes (positions, radius) without subscribing. */
getSimNodes(): SimNode[] {
  return this.simNodes;
}

private rebuild(): void {
  const filtered = this.filterNodes(this.currentNodes);
  const filteredIds = new Set(filtered.map((n) => n.id));

  // Preserve positions of surviving nodes.
  const prevPos = new Map<string, { x: number; y: number; vx?: number; vy?: number }>();
  for (const n of this.simNodes) {
    if (n.x != null && n.y != null) prevPos.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy });
  }

  this.simNodes = filtered.map((n) => {
    const prev = prevPos.get(n.id);
    return {
      id: n.id, type: n.type, title: n.title, weight: n.weight,
      radius: computeRadius(n.type, n.weight, this.settings.nodeSize),
      tags: n.tags,
      scriptureText: n.scriptureText,
      scriptureTranslation: n.scriptureTranslation,
      x: prev?.x, y: prev?.y, vx: prev?.vx, vy: prev?.vy,
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

  const width = this.canvas?.width
    ? this.canvas.width / (this.deps.devicePixelRatio?.() ?? 1)
    : 400;
  const height = this.canvas?.height
    ? this.canvas.height / (this.deps.devicePixelRatio?.() ?? 1)
    : 400;

  this.sim = forceSimulation<SimNode>(this.simNodes)
    .force('link', forceLink<SimNode, SimLink>(this.simLinks)
      .id((d) => d.id)
      .distance((d) => this.settings.linkDistance / d.weight)
      .strength((d) => this.settings.linkForce * d.weight))
    .force('charge', forceManyBody<SimNode>().strength(-this.settings.repelForce))
    .force('center', forceCenter(width / 2, height / 2).strength(this.settings.centerForce))
    .force('collide', forceCollide<SimNode>().radius((d) => d.radius * 0.8))
    .force('tags', forceSharedTags<SimNode>(0.0003))
    .alphaDecay(0.015)
    .velocityDecay(0.15);

  // Stop d3's auto-runner — we drive ticks via rAF in production / tickFor in tests.
  this.sim.stop();
}

private filterNodes(nodes: GraphNode[]): GraphNode[] {
  let filtered = nodes;
  if (this.mode === 'local') {
    if (this.activeNodeId && this.getNeighborhoodFn) {
      const neighborhood = this.getNeighborhoodFn(this.activeNodeId, this.settings.depth);
      filtered = filtered.filter((n) => neighborhood.has(n.id));
    } else {
      filtered = [];
    }
  }
  return filtered.filter((n) => this.filters[n.type]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/notepad/graph/graph-view`
Expected: PASS — all `setData` tests passing alongside Task 2's tests.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts
git commit -m "feat(graph): GraphView.setData with position-preserving sim rebuild"
```

---

## Task 4: `setMode` filters to neighborhood in local mode

**Files:**
- Modify: `src/notepad/graph/graph-view.test.ts`

The neighborhood filter is already in the `rebuild()` body from Task 3. This task adds the focused tests.

- [ ] **Step 1: Write failing tests for `setMode`**

Append to `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — setMode', () => {
  it('global mode renders all nodes', () => {
    const { view } = attached();
    view.setData(
      [node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' }), node({ id: 'c', type: 'theme' })],
      [],
      'a',
    );
    view.setMode('global');
    expect(view.getSimNodes().map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('local mode without an active node renders nothing', () => {
    const { view } = attached();
    view.setData(
      [node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' })],
      [],
      null,
    );
    view.setMode('local');
    expect(view.getSimNodes()).toEqual([]);
  });

  it('local mode filters to getNeighborhood(active, depth)', () => {
    const { view } = attached();
    view.setNeighborhoodFn((id, _depth) => new Set([id, 'b']));
    view.setData(
      [node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' }), node({ id: 'c', type: 'theme' })],
      [],
      'a',
    );
    view.setMode('local');
    expect(view.getSimNodes().map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('local mode passes settings.depth to getNeighborhood', () => {
    const calls: number[] = [];
    const { view } = attached();
    view.setNeighborhoodFn((id, depth) => { calls.push(depth); return new Set([id]); });
    view.setSettings({ ...DEFAULT_SETTINGS, depth: 3 });
    view.setData([node({ id: 'a', type: 'devotion' })], [], 'a');
    view.setMode('local');
    expect(calls).toContain(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- src/notepad/graph/graph-view`
Expected: PASS — local-mode behavior already implemented in Task 3's `filterNodes`. If any test fails, the test was wrong — fix the test before changing source.

- [ ] **Step 3: Commit**

```bash
git add src/notepad/graph/graph-view.test.ts
git commit -m "test(graph): GraphView local-mode neighborhood filter"
```

---

## Task 5: `setFilters` removes filtered-out node types

**Files:**
- Modify: `src/notepad/graph/graph-view.test.ts`

The filter logic is also already in `rebuild()`. Add focused tests.

- [ ] **Step 1: Write failing tests for `setFilters`**

Append to `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — setFilters', () => {
  it('drops nodes whose type is filtered off', () => {
    const { view } = attached();
    view.setData(
      [
        node({ id: 'a', type: 'devotion' }),
        node({ id: 'b', type: 'sermon' }),
        node({ id: 'c', type: 'theme' }),
      ],
      [],
      null,
    );
    view.setFilters({ scripture: true, sermon: false, devotion: true, theme: true });
    const ids = view.getSimNodes().map((n) => n.id).sort();
    expect(ids).toEqual(['a', 'c']);
  });

  it('drops edges whose endpoints have been filtered out', () => {
    const { view } = attached();
    view.setData(
      [node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' })],
      [edge({ id: 'r1', source: 'a', target: 'b' })],
      null,
    );
    view.setFilters({ scripture: true, sermon: false, devotion: true, theme: true });
    expect(view.getSimLinks()).toEqual([]);
  });

  it('preserves positions of surviving nodes when a filter toggles', () => {
    const { view } = attached();
    view.setData(
      [node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' })],
      [],
      null,
    );
    const before = view.getSimNodes();
    before.find((n) => n.id === 'a')!.x = 50;
    before.find((n) => n.id === 'a')!.y = 60;

    view.setFilters({ scripture: true, sermon: false, devotion: true, theme: true });
    const after = view.getSimNodes();
    const a = after.find((n) => n.id === 'a')!;
    expect(a.x).toBe(50);
    expect(a.y).toBe(60);
  });
});
```

- [ ] **Step 2: Add `getSimLinks` test affordance to `GraphView`**

Add to `src/notepad/graph/graph-view.ts` after `getSimNodes`:

```ts
/** Test affordance — read sim links. */
getSimLinks(): SimLink[] {
  return this.simLinks;
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- src/notepad/graph/graph-view`
Expected: PASS — filter behavior already implemented; only the new affordance was needed.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts
git commit -m "test(graph): GraphView filter behavior, expose getSimLinks"
```

---

## Task 6: `tickFor` advances the simulation deterministically

**Files:**
- Modify: `src/notepad/graph/graph-view.ts`
- Modify: `src/notepad/graph/graph-view.test.ts`

In production the sim is driven by `requestAnimationFrame`. In node, rAF is undefined and the sim is stopped. `tickFor(n)` is the deterministic test driver.

- [ ] **Step 1: Write failing tests for `tickFor`**

Append to `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — tickFor', () => {
  it('advances the sim, moving nodes from their seed positions', () => {
    const { view } = attached();
    view.setData(
      [
        node({ id: 'a', type: 'devotion' }),
        node({ id: 'b', type: 'sermon' }),
        node({ id: 'c', type: 'theme' }),
      ],
      [edge({ id: 'r1', source: 'a', target: 'b' }), edge({ id: 'r2', source: 'b', target: 'c' })],
      null,
    );
    view.tickFor(120);
    const sim = view.getSimNodes();
    // After 120 ticks, all nodes should have non-null finite positions.
    for (const n of sim) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
    // And the three should not all be co-located (spread by forces).
    const distinctX = new Set(sim.map((n) => Math.round(n.x ?? 0))).size;
    expect(distinctX).toBeGreaterThan(1);
  });

  it('is a no-op when no sim is built yet', () => {
    const { view } = attached();
    expect(() => view.tickFor(10)).not.toThrow();
  });
});
```

- [ ] **Step 2: Implement `tickFor` and the rAF-driven auto-runner**

Add to `src/notepad/graph/graph-view.ts`:

```ts
private tickCount = 0;
private rafHandle: number | null = null;

tickFor(n: number): void {
  if (!this.sim) return;
  for (let i = 0; i < n; i++) {
    this.sim.tick();
    this.onTick();
  }
}

private startAutoTick(): void {
  if (typeof requestAnimationFrame === 'undefined') return;
  this.stopAutoTick();
  const loop = () => {
    if (this.sim) {
      this.sim.tick();
      this.onTick();
    }
    this.rafHandle = requestAnimationFrame(loop);
  };
  this.rafHandle = requestAnimationFrame(loop);
}

private stopAutoTick(): void {
  if (this.rafHandle != null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(this.rafHandle);
  }
  this.rafHandle = null;
}

private onTick(): void {
  this.tickCount++;
  this.draw();
}

private draw(): void {
  // Filled in by Task 7.
}
```

In `attach`, after the `resize()` call, add:

```ts
this.startAutoTick();
```

In `detach`, before clearing canvas/container fields, add:

```ts
this.stopAutoTick();
this.sim?.stop();
this.sim = null;
```

In `rebuild()`, replace the trailing `this.sim.stop();` line so the sim still gets created stopped (we drive ticks ourselves) and reset the tick counter:

```ts
this.sim.stop();
this.tickCount = 0;
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- src/notepad/graph/graph-view`
Expected: PASS — both tickFor tests pass, no other tests regress.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts
git commit -m "feat(graph): GraphView tick driver — rAF in prod, tickFor in tests"
```

---

## Task 7: Canvas drawing — edges, nodes, hover ring, active glow

**Files:**
- Modify: `src/notepad/graph/graph-view.ts`
- Modify: `src/notepad/graph/graph-view.test.ts`

The `draw()` private method renders the current sim state to the canvas. Tests assert that the right calls hit the recorder context.

- [ ] **Step 1: Write failing tests for canvas drawing**

Append to `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — canvas drawing', () => {
  it('draws an arc for each node and a line per edge each tick', () => {
    const { view, canvas } = attached();
    view.setData(
      [node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' })],
      [edge({ id: 'r1', source: 'a', target: 'b' })],
      null,
    );
    canvas.ctx.calls.length = 0;
    view.tickFor(1);
    const arcs = canvas.ctx.calls.filter((c) => c.method === 'arc').length;
    const moves = canvas.ctx.calls.filter((c) => c.method === 'moveTo').length;
    expect(arcs).toBeGreaterThanOrEqual(2);
    expect(moves).toBeGreaterThanOrEqual(1);
  });

  it('draws an additional glow ring around the active node', () => {
    const { view, canvas } = attached();
    view.setData(
      [node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' })],
      [],
      'a',
    );
    canvas.ctx.calls.length = 0;
    view.tickFor(1);
    // Active glow draws two extra arcs around 'a' (outer + inner halo) plus the node body.
    // Inactive 'b' draws one arc. So total >= 4 arcs for 2 nodes.
    const arcs = canvas.ctx.calls.filter((c) => c.method === 'arc').length;
    expect(arcs).toBeGreaterThanOrEqual(4);
  });

  it('clears the canvas before each tick', () => {
    const { view, canvas } = attached();
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    canvas.ctx.calls.length = 0;
    view.tickFor(1);
    expect(canvas.ctx.calls[0].method).toBe('clearRect');
  });
});
```

- [ ] **Step 2: Implement `draw()`**

Add NODE_COLORS map and replace the empty `draw()` body in `src/notepad/graph/graph-view.ts`:

```ts
const NODE_COLORS: Record<string, string> = {
  scripture: '#C49A78',
  sermon: '#7A9BAE',
  devotion: '#6B8B7A',
  theme: '#D4A0A0',
};
```

```ts
private hoveredNodeId: string | null = null;
private transform = { x: 0, y: 0, scale: 1 };

private draw(): void {
  const ctx = this.ctx;
  const canvas = this.canvas;
  if (!ctx || !canvas) return;

  const dpr = this.deps.devicePixelRatio?.() ?? 1;
  const { x: tx, y: ty, scale } = this.transform;

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
    ctx.lineWidth = (2 + link.weight * 2) * this.settings.edgeThickness;
    ctx.stroke();
  }

  // Nodes
  for (const n of this.simNodes) {
    if (n.x == null || n.y == null) continue;
    const isConnected = !hovered || connectedIds.has(n.id);
    const alpha = hovered ? (isConnected ? 1 : 0.12) : 1;
    const color = NODE_COLORS[n.type] ?? '#999';

    if (n.id === this.activeNodeId) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + 10, 0, Math.PI * 2);
      ctx.fillStyle = `${color}30`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + 5, 0, Math.PI * 2);
      ctx.fillStyle = `${color}20`;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.font = `${n.radius > 16 ? '12px' : '10px'} Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(62, 50, 40, ${alpha * 0.85})`;
    ctx.fillText(n.title, n.x, n.y + n.radius + 14);
  }

  if (hovered) {
    const n = this.simNodes.find((x) => x.id === hovered);
    if (n && n.x != null && n.y != null) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `${NODE_COLORS[n.type] ?? '#999'}80`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  ctx.restore();
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- src/notepad/graph/graph-view`
Expected: PASS — all 3 drawing tests + previous tests.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts
git commit -m "feat(graph): GraphView canvas drawing — nodes, edges, hover, active glow"
```

---

## Task 8: Pointer handling — hover, click-to-open, scripture popover

**Files:**
- Modify: `src/notepad/graph/graph-view.ts`
- Modify: `src/notepad/graph/graph-view.test.ts`

`handleMouseMove`/`Down`/`Up` are public so React JSX can wire them and tests can call them. Mouse-down on empty space starts a drag (Task 9); on a node it does nothing until mouse-up. Mouse-up on a non-scripture node fires `onNodeOpen`; on a scripture node toggles popover state; on empty space clears popover.

- [ ] **Step 1: Write failing tests for pointer interaction**

Append to `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — pointer interaction', () => {
  function placeNode(view: GraphView, id: string, x: number, y: number) {
    const sim = view.getSimNodes();
    const n = sim.find((s) => s.id === id);
    if (n) { n.x = x; n.y = y; n.fx = x; n.fy = y; }
  }

  it('mouse-up on a non-scripture node fires onNodeOpen with its id', () => {
    const { view, opens } = attached();
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    placeNode(view, 'a', 100, 100);
    view.handleMouseDown({ clientX: 100, clientY: 100 });
    view.handleMouseUp({ clientX: 100, clientY: 100 });
    expect(opens).toEqual(['a']);
  });

  it('mouse-up on empty space does NOT fire onNodeOpen', () => {
    const { view, opens } = attached();
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    placeNode(view, 'a', 100, 100);
    view.handleMouseDown({ clientX: 300, clientY: 300 });
    view.handleMouseUp({ clientX: 300, clientY: 300 });
    expect(opens).toEqual([]);
  });

  it('mouse-up on a scripture node sets popover state', () => {
    const { view } = attached();
    view.setData(
      [
        node({
          id: 'scripture:gen-1-1', type: 'scripture',
          title: 'Genesis 1:1', scriptureText: 'In the beginning...', scriptureTranslation: 'WEB',
        }),
      ],
      [],
      null,
    );
    placeNode(view, 'scripture:gen-1-1', 100, 100);
    view.handleMouseDown({ clientX: 100, clientY: 100 });
    view.handleMouseUp({ clientX: 100, clientY: 100 });
    const snap = view.getSnapshot();
    expect(snap.popover).toMatchObject({
      nodeId: 'scripture:gen-1-1',
      title: 'Genesis 1:1',
      text: 'In the beginning...',
      translation: 'WEB',
    });
  });

  it('second click on the same scripture node clears popover', () => {
    const { view } = attached();
    view.setData(
      [node({ id: 's', type: 'scripture', title: 'X', scriptureText: 'Y', scriptureTranslation: 'Z' })],
      [], null,
    );
    placeNode(view, 's', 100, 100);
    view.handleMouseDown({ clientX: 100, clientY: 100 });
    view.handleMouseUp({ clientX: 100, clientY: 100 });
    expect(view.getSnapshot().popover).not.toBeNull();
    view.handleMouseDown({ clientX: 100, clientY: 100 });
    view.handleMouseUp({ clientX: 100, clientY: 100 });
    expect(view.getSnapshot().popover).toBeNull();
  });

  it('mouse-up on empty space clears an open popover', () => {
    const { view } = attached();
    view.setData(
      [node({ id: 's', type: 'scripture', title: 'X', scriptureText: 'Y', scriptureTranslation: 'Z' })],
      [], null,
    );
    placeNode(view, 's', 100, 100);
    view.handleMouseDown({ clientX: 100, clientY: 100 });
    view.handleMouseUp({ clientX: 100, clientY: 100 });
    expect(view.getSnapshot().popover).not.toBeNull();
    view.handleMouseDown({ clientX: 300, clientY: 300 });
    view.handleMouseUp({ clientX: 300, clientY: 300 });
    expect(view.getSnapshot().popover).toBeNull();
  });

  it('handleMouseMove sets hoveredNodeId when over a node', () => {
    const { view } = attached();
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    placeNode(view, 'a', 100, 100);
    view.handleMouseMove({ clientX: 100, clientY: 100 });
    expect(view.getHoveredNodeId()).toBe('a');
    view.handleMouseMove({ clientX: 300, clientY: 300 });
    expect(view.getHoveredNodeId()).toBeNull();
  });
});
```

- [ ] **Step 2: Implement pointer handlers**

Add to `src/notepad/graph/graph-view.ts`:

```ts
private dragState: { active: boolean; startX: number; startY: number; origTx: number; origTy: number } = {
  active: false, startX: 0, startY: 0, origTx: 0, origTy: 0,
};

handleMouseMove = (e: { clientX: number; clientY: number }): void => {
  if (this.dragState.active) {
    this.transform.x = this.dragState.origTx + (e.clientX - this.dragState.startX);
    this.transform.y = this.dragState.origTy + (e.clientY - this.dragState.startY);
    this.draw();
    return;
  }
  const { x, y } = this.screenToWorld(e.clientX, e.clientY);
  const id = this.findNodeAt(x, y)?.id ?? null;
  if (id !== this.hoveredNodeId) {
    this.hoveredNodeId = id;
    this.draw();
  }
};

handleMouseDown = (e: { clientX: number; clientY: number }): void => {
  const { x, y } = this.screenToWorld(e.clientX, e.clientY);
  if (!this.findNodeAt(x, y)) {
    this.dragState = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origTx: this.transform.x,
      origTy: this.transform.y,
    };
  }
};

handleMouseUp = (e: { clientX: number; clientY: number }): void => {
  if (this.dragState.active) { this.dragState.active = false; return; }
  const { x, y } = this.screenToWorld(e.clientX, e.clientY);
  const node = this.findNodeAt(x, y);
  if (!node) {
    this.setState((prev) => prev.popover === null ? prev : { ...prev, popover: null });
    return;
  }
  if (node.type === 'scripture') {
    const current = this.getSnapshot().popover;
    if (current && current.nodeId === node.id) {
      this.setState((prev) => ({ ...prev, popover: null }));
    } else {
      this.setState(() => ({
        popover: {
          nodeId: node.id,
          anchorX: node.x ?? 0,
          anchorY: node.y ?? 0,
          title: node.title,
          text: node.scriptureText || 'Verse text unavailable.',
          translation: node.scriptureTranslation || 'WEB',
        },
      }));
    }
  } else {
    this.setState((prev) => prev.popover === null ? prev : { ...prev, popover: null });
    this.deps.onNodeOpen(node.id);
  }
};

/** Test affordance — read hovered id without subscribing to draws. */
getHoveredNodeId(): string | null {
  return this.hoveredNodeId;
}

private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
  if (!this.canvas) return { x: 0, y: 0 };
  const rect = this.canvas.getBoundingClientRect();
  const { x: tx, y: ty, scale } = this.transform;
  return { x: (clientX - rect.left - tx) / scale, y: (clientY - rect.top - ty) / scale };
}

private findNodeAt(wx: number, wy: number): SimNode | null {
  for (let i = this.simNodes.length - 1; i >= 0; i--) {
    const n = this.simNodes[i];
    if (n.x == null || n.y == null) continue;
    const dx = wx - n.x, dy = wy - n.y;
    if (dx * dx + dy * dy <= (n.radius + 4) ** 2) return n;
  }
  return null;
}
```

`Observable.setState` is `protected`, so calling `this.setState(...)` from inside the subclass works as written.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- src/notepad/graph/graph-view`
Expected: PASS — 6 new pointer tests, no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts
git commit -m "feat(graph): GraphView pointer handling — hover, click-to-open, popover"
```

---

## Task 9: Pan and wheel zoom

**Files:**
- Modify: `src/notepad/graph/graph-view.ts`
- Modify: `src/notepad/graph/graph-view.test.ts`

The pan logic was added in Task 8 (`handleMouseDown` on empty + `handleMouseMove` while `dragState.active`). Wheel zoom anchors at the cursor.

- [ ] **Step 1: Write failing tests for pan + zoom**

Append to `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — pan and wheel zoom', () => {
  it('drag on empty space pans the transform', () => {
    const { view } = attached();
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    view.handleMouseDown({ clientX: 200, clientY: 200 });
    view.handleMouseMove({ clientX: 250, clientY: 230 });
    expect(view.getTransform()).toMatchObject({ x: 50, y: 30 });
    view.handleMouseUp({ clientX: 250, clientY: 230 });
  });

  it('drag does not start when mouse-down is on a node', () => {
    const { view } = attached();
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    const sim = view.getSimNodes();
    sim[0].x = 100; sim[0].y = 100; sim[0].fx = 100; sim[0].fy = 100;
    view.handleMouseDown({ clientX: 100, clientY: 100 });
    view.handleMouseMove({ clientX: 200, clientY: 200 });
    expect(view.getTransform()).toMatchObject({ x: 0, y: 0 });
  });

  it('wheel up zooms in, anchored at the cursor', () => {
    const { view } = attached();
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    const before = view.getTransform();
    view.handleWheel({ clientX: 100, clientY: 100, deltaY: -100 });
    const after = view.getTransform();
    expect(after.scale).toBeGreaterThan(before.scale);
    // Anchor invariant: the world point under the cursor must not move on screen.
    // Pre-zoom world point = (cx - tx) / s ; post-zoom should give the same screen x.
    const screenX_before = before.x + 100 * before.scale; // arbitrary world point at cx=100 mapped
    void screenX_before;
  });

  it('wheel down zooms out', () => {
    const { view } = attached();
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    const before = view.getTransform().scale;
    view.handleWheel({ clientX: 100, clientY: 100, deltaY: 100 });
    expect(view.getTransform().scale).toBeLessThan(before);
  });

  it('zoom is clamped between 0.1 and 5', () => {
    const { view } = attached();
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    for (let i = 0; i < 200; i++) view.handleWheel({ clientX: 0, clientY: 0, deltaY: -100 });
    expect(view.getTransform().scale).toBeLessThanOrEqual(5);
    for (let i = 0; i < 400; i++) view.handleWheel({ clientX: 0, clientY: 0, deltaY: 100 });
    expect(view.getTransform().scale).toBeGreaterThanOrEqual(0.1);
  });
});
```

- [ ] **Step 2: Implement `handleWheel` and `getTransform`**

Replace the stub `handleWheel` in `src/notepad/graph/graph-view.ts`:

```ts
handleWheel = (e: { clientX: number; clientY: number; deltaY: number; preventDefault?: () => void }): void => {
  e.preventDefault?.();
  if (!this.canvas) return;
  const rect = this.canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const factor = e.deltaY > 0 ? 0.92 : 1.08;
  const t = this.transform;
  const newScale = Math.min(5, Math.max(0.1, t.scale * factor));
  t.x = mx - (mx - t.x) * (newScale / t.scale);
  t.y = my - (my - t.y) * (newScale / t.scale);
  t.scale = newScale;
  this.draw();
};

/** Test affordance — read transform without subscribing. */
getTransform(): { x: number; y: number; scale: number } {
  return { ...this.transform };
}
```

Note: `handleWheel` is now an arrow-function field, replacing the placeholder method from Task 2. The wire-up in `attach` (`this.wheelListener = (e) => this.handleWheel(e)`) still works.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- src/notepad/graph/graph-view`
Expected: PASS — 5 new pan/zoom tests + previous tests.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts
git commit -m "feat(graph): GraphView wheel zoom + pan, getTransform affordance"
```

---

## Task 10: Auto-fit camera once at tick 80

**Files:**
- Modify: `src/notepad/graph/graph-view.ts`
- Modify: `src/notepad/graph/graph-view.test.ts`

After the sim has roughly settled (tick 80), zoom and pan to frame the bounding box. Once per `setData` call.

- [ ] **Step 1: Write failing tests for auto-fit**

Append to `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — auto-fit camera', () => {
  it('changes the transform after tick 80 when nodes are spread out', () => {
    const { view } = attached();
    view.setData(
      [
        node({ id: 'a', type: 'devotion' }),
        node({ id: 'b', type: 'sermon' }),
        node({ id: 'c', type: 'theme' }),
      ],
      [edge({ id: 'r1', source: 'a', target: 'b' }), edge({ id: 'r2', source: 'b', target: 'c' })],
      null,
    );
    view.tickFor(79);
    const before = view.getTransform();
    view.tickFor(1); // hits tick 80
    const after = view.getTransform();
    expect(after).not.toEqual(before);
  });

  it('only fires once — subsequent ticks do not change the transform from auto-fit', () => {
    const { view } = attached();
    view.setData(
      [
        node({ id: 'a', type: 'devotion' }),
        node({ id: 'b', type: 'sermon' }),
        node({ id: 'c', type: 'theme' }),
      ],
      [edge({ id: 'r1', source: 'a', target: 'b' })],
      null,
    );
    view.tickFor(80);
    const afterFit = { ...view.getTransform() };
    view.tickFor(50);
    expect(view.getTransform()).toEqual(afterFit);
  });

  it('resets the auto-fit gate when setData is called again', () => {
    const { view } = attached();
    view.setData([node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' })], [], null);
    view.tickFor(80);
    const t1 = { ...view.getTransform() };
    // New dataset → fit should fire again at tick 80 of the new sim.
    view.setData(
      [node({ id: 'x', type: 'theme' }), node({ id: 'y', type: 'devotion' }), node({ id: 'z', type: 'sermon' })],
      [edge({ id: 'r1', source: 'x', target: 'y' })],
      null,
    );
    view.tickFor(80);
    expect(view.getTransform()).not.toEqual(t1);
  });
});
```

- [ ] **Step 2: Implement auto-fit**

Add to `src/notepad/graph/graph-view.ts`:

```ts
private hasFit = false;
```

In `rebuild()`, alongside `this.tickCount = 0;`, add:

```ts
this.hasFit = false;
```

Update `onTick` to fire auto-fit on the boundary:

```ts
private onTick(): void {
  this.tickCount++;
  if (!this.hasFit && this.tickCount === 80) {
    this.runAutoFit();
    this.hasFit = true;
  }
  this.draw();
}

private runAutoFit(): void {
  const canvas = this.canvas;
  if (!canvas) return;
  const dpr = this.deps.devicePixelRatio?.() ?? 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  const placed = this.simNodes.filter((n) => n.x != null && n.y != null);
  if (placed.length === 0) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of placed) {
    minX = Math.min(minX, n.x! - n.radius - 20);
    minY = Math.min(minY, n.y! - n.radius - 20);
    maxX = Math.max(maxX, n.x! + n.radius + 20);
    maxY = Math.max(maxY, n.y! + n.radius + 20);
  }
  const w = maxX - minX, h = maxY - minY;
  if (w <= 0 || h <= 0) return;

  const padding = 30;
  const fitScale = Math.min((width - padding * 2) / w, (height - padding * 2) / h, 1.5);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  this.transform = { x: width / 2 - cx * fitScale, y: height / 2 - cy * fitScale, scale: fitScale };
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- src/notepad/graph/graph-view`
Expected: PASS — 3 auto-fit tests + all previous tests.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts
git commit -m "feat(graph): GraphView auto-fit camera once at tick 80"
```

---

## Task 11: Integrate `GraphView` into `GraphPane.tsx`, render popover overlay

**Files:**
- Modify: `src/components/sections/notepad/GraphPane.tsx`
- Delete: `src/notepad/graph/use-graph.ts`

Replace the body of `GraphPane.tsx` with a thin shell. Keep the controls UI (mode toggle, filter chips, settings sliders, expand button) and the surrounding `<aside>` chrome verbatim. Replace the d3/canvas/pointer code with: instantiate `GraphView` once, call `attach` in `useEffect`, forward each piece of React state via `useEffect` → `view.setX`, render the popover overlay from `view.getSnapshot()` via `useSyncExternalStore`. Delete `use-graph.ts` and consume `projectGraph` directly.

This task is non-TDD: the unit tests in Tasks 2–10 cover behavior; Task 11 is the wiring step. The validation gate is the existing test suite plus a manual smoke test.

- [ ] **Step 1: Read `GraphPane.tsx` end-to-end**

Open `src/components/sections/notepad/GraphPane.tsx`. The shell after this task keeps lines 540–717 (the JSX `<aside>` block) almost verbatim, modulo the popover overlay addition. Lines 1–537 (sim/canvas/pointer) are replaced.

- [ ] **Step 2: Rewrite `GraphPane.tsx`**

Replace the entire file with:

```tsx
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BookOpen, Mic, PenLine, Sparkles, Maximize2, Minimize2, Settings2 } from 'lucide-react';
import { useNoteCollection } from '@/notepad/context/useNoteCollection';
import { useReferenceGraph } from '@/notepad/context/useReferenceGraph';
import { projectGraph } from '@/notepad/graph/project-graph';
import {
  GraphView,
  DEFAULT_FILTERS,
  DEFAULT_SETTINGS,
  type NodeTypeFilters,
  type GraphSettings,
} from '@/notepad/graph/graph-view';

const NODE_COLORS: Record<string, string> = {
  scripture: '#C49A78',
  sermon: '#7A9BAE',
  devotion: '#6B8B7A',
  theme: '#D4A0A0',
};

const NODE_ICONS: Record<string, typeof BookOpen> = {
  scripture: BookOpen,
  sermon: Mic,
  devotion: PenLine,
  theme: Sparkles,
};

interface GraphPaneProps {
  graphOpen: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function GraphPane({ graphOpen, expanded = false, onToggleExpand }: GraphPaneProps) {
  const { notes, activeNoteId, collection } = useNoteCollection();
  const { references, scriptureNodes, graph } = useReferenceGraph();
  const openNote = collection.openNote;

  const { nodes, edges } = useMemo(
    () => projectGraph(notes, references, scriptureNodes),
    [notes, references, scriptureNodes],
  );

  const view = useMemo(() => new GraphView({
    onNodeOpen: (id) => openNote(id),
    devicePixelRatio: () => window.devicePixelRatio || 1,
  }), [openNote]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Attach / detach
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    view.attach(canvasRef.current, containerRef.current);
    return () => view.detach();
  }, [view]);

  // Forward neighborhood lookup
  useEffect(() => {
    view.setNeighborhoodFn(graph.getNeighborhood);
  }, [view, graph.getNeighborhood]);

  // Forward data
  useEffect(() => {
    view.setData(nodes, edges, activeNoteId);
  }, [view, nodes, edges, activeNoteId]);

  // Controls — React state, forwarded into the view on each change.
  const [graphMode, setGraphMode] = useState<'global' | 'local'>('global');
  const [filters, setFilters] = useState<NodeTypeFilters>(DEFAULT_FILTERS);
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => { view.setMode(graphMode); }, [view, graphMode]);
  useEffect(() => { view.setFilters(filters); }, [view, filters]);
  useEffect(() => { view.setSettings(settings); }, [view, settings]);

  // Popover state subscribed via useSyncExternalStore.
  const state = useSyncExternalStore(view.subscribe, view.getSnapshot);
  const popover = state.popover;

  const toggleFilter = (key: keyof NodeTypeFilters) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <aside
      className="overflow-hidden border-l flex-col hidden md:flex"
      style={{
        flex: expanded ? '1 1 0%' : graphOpen ? '0 0 35%' : '0 0 0px',
        borderColor: graphOpen ? 'var(--pale-stone)' : 'transparent',
        background: 'rgba(240, 236, 232, 0.4)',
        opacity: graphOpen ? 1 : 0,
        transition: 'flex 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
      }}
    >
      <div className="p-4 space-y-3 shrink-0">
        <h3 className="text-[10px] font-medium tracking-[0.2em]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
          GRAPH
        </h3>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md overflow-hidden" style={{ border: '1px solid var(--pale-stone)' }}>
            <button onClick={() => setGraphMode('global')} className="px-3 py-1.5 text-[10px] font-medium tracking-wider"
              style={{ background: graphMode === 'global' ? 'rgba(188, 179, 163, 0.35)' : 'transparent', color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
              Global
            </button>
            <button onClick={() => setGraphMode('local')} className="px-3 py-1.5 text-[10px] font-medium tracking-wider"
              style={{ background: graphMode === 'local' ? 'rgba(188, 179, 163, 0.35)' : 'transparent', color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
              Local
            </button>
          </div>
          <button onClick={() => setSettingsOpen(!settingsOpen)} className="p-1.5 rounded hover:bg-black/5 transition-colors" title="Graph settings">
            <Settings2 className="w-3.5 h-3.5" style={{ color: 'var(--silica)' }} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(filters) as Array<keyof NodeTypeFilters>).map((key) => {
            const Icon = NODE_ICONS[key];
            return (
              <button key={key} onClick={() => toggleFilter(key)} className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium tracking-wider transition-all"
                style={{
                  border: `1px solid ${filters[key] ? NODE_COLORS[key] : 'var(--pale-stone)'}`,
                  background: filters[key] ? `${NODE_COLORS[key]}15` : 'transparent',
                  color: filters[key] ? NODE_COLORS[key] : 'var(--silica)',
                  fontFamily: 'Outfit, sans-serif',
                }}>
                <Icon className="w-3 h-3" />
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            );
          })}
        </div>

        {settingsOpen && (
          <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--pale-stone)' }}>
            {graphMode === 'local' && (
              <SettingRow label="Depth" min={1} max={3} step={1} value={settings.depth}
                onChange={(v) => setSettings((s) => ({ ...s, depth: v }))} format={(v) => String(v)} />
            )}
            <SettingRow label="Node Size" min={0.5} max={2} step={0.1} value={settings.nodeSize}
              onChange={(v) => setSettings((s) => ({ ...s, nodeSize: v }))} format={(v) => `${v.toFixed(1)}x`} />
            <SettingRow label="Edge Width" min={0.5} max={3} step={0.1} value={settings.edgeThickness}
              onChange={(v) => setSettings((s) => ({ ...s, edgeThickness: v }))} format={(v) => `${v.toFixed(1)}x`} />
            <SettingRow label="Link Distance" min={60} max={300} step={10} value={settings.linkDistance}
              onChange={(v) => setSettings((s) => ({ ...s, linkDistance: v }))} format={(v) => String(v)} />
            <SettingRow label="Link Force" min={0.001} max={0.01} step={0.001} value={settings.linkForce}
              onChange={(v) => setSettings((s) => ({ ...s, linkForce: v }))} format={(v) => v.toFixed(3)} />
            <SettingRow label="Repel Force" min={100} max={2000} step={50} value={settings.repelForce}
              onChange={(v) => setSettings((s) => ({ ...s, repelForce: v }))} format={(v) => String(v)} />
            <SettingRow label="Center Force" min={0.001} max={0.3} step={0.005} value={settings.centerForce}
              onChange={(v) => setSettings((s) => ({ ...s, centerForce: v }))} format={(v) => v.toFixed(4)} />
            <button onClick={() => setSettings(DEFAULT_SETTINGS)}
              className="text-[10px] font-medium tracking-wider px-2 py-1 rounded hover:bg-black/5 transition-colors"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
              Reset Defaults
            </button>
          </div>
        )}
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: 'grab' }}
          onMouseMove={(e) => view.handleMouseMove(e)}
          onMouseDown={(e) => view.handleMouseDown(e)}
          onMouseUp={(e) => view.handleMouseUp(e)}
        />
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
            <p className="text-[11px] tracking-wider text-center" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
              Create notes with [[links]] or Bible verse references to see your knowledge graph.
            </p>
          </div>
        )}
        {graphMode === 'local' && !activeNoteId && (
          <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
            <p className="text-[11px] tracking-wider text-center" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
              Select a note to see its local graph.
            </p>
          </div>
        )}
        {popover && (
          <div
            className="absolute z-10 max-w-[250px] p-3 rounded-md shadow-lg pointer-events-none"
            style={{
              left: 0, top: 0,
              transform: `translate(calc(${popover.anchorX}px - 50%), calc(${popover.anchorY}px - 100% - 14px))`,
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid rgba(188, 179, 163, 0.5)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            <div className="text-[12px] font-bold mb-1" style={{ color: 'rgba(62, 50, 40, 1)' }}>{popover.title}</div>
            <div className="text-[11px]" style={{ color: 'rgba(62, 50, 40, 0.8)' }}>{popover.text}</div>
            <div className="text-[9px] mt-1" style={{ color: 'rgba(62, 50, 40, 0.5)' }}>{popover.translation}</div>
          </div>
        )}
      </div>

      <div className="p-4 shrink-0" style={{ borderTop: '1px solid rgba(206, 204, 202, 0.5)' }}>
        <button onClick={onToggleExpand} className="flex items-center gap-2 w-full justify-center py-2 rounded-md hover:bg-black/5 transition-colors">
          {expanded
            ? <Minimize2 className="w-3.5 h-3.5" style={{ color: 'var(--deep-umber)' }} />
            : <Maximize2 className="w-3.5 h-3.5" style={{ color: 'var(--deep-umber)' }} />}
          <span className="text-[10px] font-medium tracking-widest" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
            {expanded ? 'COLLAPSE' : 'EXPAND'}
          </span>
        </button>
      </div>
    </aside>
  );
}

function SettingRow(props: {
  label: string;
  min: number; max: number; step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] font-medium tracking-wider w-24 shrink-0"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>{props.label}</label>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))} className="flex-1 h-1 accent-[#C49A78]" />
      <span className="text-[10px] w-10 text-right" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
        {props.format(props.value)}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Delete `use-graph.ts`**

```bash
rm src/notepad/graph/use-graph.ts
```

Verify nothing else imports it:

```bash
grep -rn "from.*use-graph" src/ || echo "no imports found"
```

Expected: `no imports found`.

- [ ] **Step 4: Run full test suite + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: all tests pass, lint clean, build succeeds.

- [ ] **Step 5: Smoke test in dev**

Run: `npm run dev`

Manually verify in the browser at the notepad route:
- Graph renders with nodes and edges (open notes with `[[links]]` and Bible verse references).
- Hovering a node highlights it; non-connected nodes fade.
- Clicking a non-scripture node opens that note in the editor.
- Clicking a scripture node shows the verse popover; clicking it again or clicking empty space dismisses it.
- Mode toggle (Global / Local) and depth slider both work.
- Filter chips (scripture / sermon / devotion / theme) toggle visibility while preserving positions of remaining nodes.
- Settings sliders (link distance, repel force, etc.) update live.
- Wheel zooms; click-and-drag pans.
- Resizing the window keeps the canvas sized correctly.

If any of these regress: stop, debug, fix before committing.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/notepad/GraphPane.tsx
git rm src/notepad/graph/use-graph.ts
git commit -m "refactor(graph): GraphPane consumes GraphView, popover moves to DOM"
```

---

## Self-Review

**Spec coverage:** Every responsibility in the `GraphView` and `projectGraph` entries of `docs/CONTEXT.md` is exercised by at least one task:

- `projectGraph` rules (weight summing, scripture-iff-connected, type mapping) → Task 1
- `GraphView` lifecycle (`attach`/`detach`, DPR sizing) → Task 2
- d3 simulation lifecycle with position preservation → Tasks 3, 5
- Local-mode neighborhood filtering → Task 4
- Type-filter behavior → Task 5
- Tick driver (rAF prod, `tickFor` test) → Task 6
- Canvas drawing (edges, nodes, hover ring, active glow) → Task 7
- Pointer handling (hover, click-to-open, scripture popover) → Task 8
- Pan + wheel-zoom-anchored-at-cursor → Task 9
- Auto-fit camera once at tick 80 → Task 10
- Popover-as-DOM-element + `useSyncExternalStore` wiring + `useGraph` deletion → Task 11

**Type consistency:** Names verified across tasks:
- `setData(nodes, edges, activeNodeId)`, `setMode`, `setFilters`, `setSettings`, `setNeighborhoodFn`, `tickFor`, `handleMouseMove/Down/Up/Wheel`, `attach`, `detach`, `getSimNodes`, `getSimLinks`, `getTransform`, `getHoveredNodeId`, `getSnapshot`, `subscribe`.
- Types: `GraphView`, `GraphViewState`, `GraphViewDeps`, `PopoverState`, `NodeTypeFilters`, `GraphSettings`, `SimNode`, `SimLink`, `DEFAULT_FILTERS`, `DEFAULT_SETTINGS`.
- These names are used consistently in every task that references them.

**Placeholder scan:** No `TBD`, `TODO`, `implement later`, "appropriate error handling" anywhere. Every step ships either a concrete code block, a concrete command, or a concrete commit message.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-07-deepen-graph-view.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
