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

const NODE_COLORS: Record<string, string> = {
  scripture: '#C49A78',
  sermon: '#7A9BAE',
  devotion: '#6B8B7A',
  theme: '#D4A0A0',
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

  private hoveredNodeId: string | null = null;
  private transform = { x: 0, y: 0, scale: 1 };

  private dragState: { active: boolean; moved: boolean; startX: number; startY: number; origTx: number; origTy: number } = {
    active: false, moved: false, startX: 0, startY: 0, origTx: 0, origTy: 0,
  };

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

  /** Test affordance — read hovered id without subscribing to draws. */
  getHoveredNodeId(): string | null {
    return this.hoveredNodeId;
  }

  handleMouseMove = (e: { clientX: number; clientY: number }): void => {
    if (this.dragState.active) {
      this.dragState.moved = true;
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
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        origTx: this.transform.x,
        origTy: this.transform.y,
      };
    }
  };

  handleMouseUp = (e: { clientX: number; clientY: number }): void => {
    if (this.dragState.active && this.dragState.moved) {
      this.dragState.active = false;
      this.dragState.moved = false;
      return;
    }
    this.dragState.active = false;
    this.dragState.moved = false;
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
