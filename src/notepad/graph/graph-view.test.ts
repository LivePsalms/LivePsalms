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
