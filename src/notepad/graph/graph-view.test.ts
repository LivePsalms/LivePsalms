import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GraphView, DEFAULT_SETTINGS } from './graph-view';
import type { GraphViewDeps } from './graph-view';
import type { GraphEdge, GraphNode } from './types';

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
    const before = view.getSimNodes();
    const a = before.find((n) => n.id === 'a')!; a.x = 100; a.y = 200;
    const b = before.find((n) => n.id === 'b')!; b.x = 300; b.y = 400;

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
    for (const n of sim) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
    const distinctX = new Set(sim.map((n) => Math.round(n.x ?? 0))).size;
    expect(distinctX).toBeGreaterThan(1);
  });

  it('is a no-op when no sim is built yet', () => {
    const { view } = attached();
    expect(() => view.tickFor(10)).not.toThrow();
  });
});

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
    view.setData(
      [node({ id: 'x', type: 'theme' }), node({ id: 'y', type: 'devotion' }), node({ id: 'z', type: 'sermon' })],
      [edge({ id: 'r1', source: 'x', target: 'y' })],
      null,
    );
    view.tickFor(80);
    expect(view.getTransform()).not.toEqual(t1);
  });
});
