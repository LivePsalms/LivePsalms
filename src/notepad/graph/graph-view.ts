import { Observable } from '../collection/observable';
import type { GraphEdge, GraphNode } from './types';
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

  private sim: Simulation<SimNode, SimLink> | null = null;
  private simNodes: SimNode[] = [];
  private simLinks: SimLink[] = [];
  private tickCount = 0;
  private rafHandle: number | null = null;

  private currentNodes: GraphNode[] = [];
  private currentEdges: GraphEdge[] = [];
  private activeNodeId: string | null = null;

  private settings: GraphSettings = { ...DEFAULT_SETTINGS };
  private filters: NodeTypeFilters = { ...DEFAULT_FILTERS };
  private mode: 'global' | 'local' = 'global';
  private getNeighborhoodFn: ((id: string, depth: number) => Set<string>) | null = null;

  constructor(deps: GraphViewDeps) {
    super({ popover: null });
    this.deps = deps;
  }

  attach(canvas: HTMLCanvasElement, container: HTMLElement): void {
    this.canvas = canvas;
    this.container = container;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.startAutoTick();

    this.wheelListener = (e: WheelEvent) => this.handleWheel(e);
    canvas.addEventListener('wheel', this.wheelListener, { passive: false });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    }
  }

  detach(): void {
    this.stopAutoTick();
    this.sim?.stop();
    this.sim = null;
    if (this.canvas && this.wheelListener) {
      this.canvas.removeEventListener('wheel', this.wheelListener);
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.wheelListener = null;
    this.canvas = null;
    this.container = null;
    // Read once so `noUnusedLocals` is satisfied while ctx is still unused
    // by behavioral methods (filled in by Task 7).
    void this.ctx;
    this.ctx = null;
  }

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
    this.rebuild();
  }

  /** Test affordance — read sim nodes (positions, radius) without subscribing. */
  getSimNodes(): SimNode[] {
    return this.simNodes;
  }

  /** Test affordance — read sim links. */
  getSimLinks(): SimLink[] {
    return this.simLinks;
  }

  // Stubs filled in by later tasks.
  handleWheel(_e: { clientX: number; clientY: number; deltaY: number; preventDefault?: () => void }): void {
    // Task 8.
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
    this.tickCount = 0;
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
