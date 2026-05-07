import { Observable } from '../collection/observable';
import type { GraphEdge, GraphNode } from './types';

// Re-export so downstream tasks can pull these types alongside the GraphView
// public surface, and so `verbatimModuleSyntax` + `noUnusedLocals` stay happy
// while we have not yet wired them into class internals (Task 3+).
export type { GraphEdge, GraphNode };

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
    // Read once so `noUnusedLocals` is satisfied while ctx is still unused
    // by behavioral methods (filled in by Task 3+).
    void this.ctx;
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
