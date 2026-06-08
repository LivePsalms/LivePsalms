import { Observable } from '../collection/observable';
import type { GraphEdge, GraphNode } from './types';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  type Simulation3,
} from 'd3-force-3d';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import { forceSphere } from './force-sphere';
import { projectPoint, depthNorm, depthScale, depthAlpha, type SphereCamera } from './sphere-math';

export interface PopoverState {
  nodeId: string;
  screenX: number;
  screenY: number;
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

const ZOOM_IN_FACTOR = 1.08;
const ZOOM_OUT_FACTOR = 0.92;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const AUTO_FIT_TICK = 80;
const AUTO_FIT_NODE_MARGIN = 20;
const AUTO_FIT_VIEWPORT_PADDING = 30;
const AUTO_FIT_MAX_SCALE = 3.0;
// On load, zoom in past pure fit-to-view so the graph lands more noticeable.
// Clamped by AUTO_FIT_MAX_SCALE so small graphs don't balloon.
const AUTO_FIT_INITIAL_ZOOM = 1.25;

// Sphere radius (world units) grows with node count so the surface doesn't overcrowd.
function sphereRadius(nodeCount: number): number {
  return Math.max(160, Math.sqrt(Math.max(1, nodeCount)) * 55);
}

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
    // `+ 0` normalizes a signed `-0` (e.g. when amplitude is 0) to `+0` so the
    // result compares equal under strict deep-equality.
    ox: amplitude * Math.sin(tSeconds * DRIFT_SPEED + phase) + 0,
    // `phase * 1.3` de-correlates the y phase from x so nodes don't sweep in
    // lockstep, giving more organic, non-uniform motion.
    oy: amplitude * Math.cos(tSeconds * DRIFT_SPEED * 0.78 + phase * 1.3) + 0,
  };
}

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

export interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  edgeType: GraphEdge['type'];
  weight: number;
}

function computeRadius(type: string, weight: number, sizeMultiplier: number): number {
  const base = type === 'scripture' ? 42 : 38;
  return Math.min(110, Math.max(26, (base + weight * 5) * sizeMultiplier));
}

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

  private sim: Simulation3<SimNode, SimLink> | null = null;
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
  private focusNodeId: string | null = null;
  private getNeighborhoodFn: ((id: string, depth: number) => Set<string>) | null = null;

  private hoveredNodeId: string | null = null;
  private camera: SphereCamera = { yaw: 0, pitch: 0.35, scale: 1 };
  // TEMPORARY SHIM (Tasks 8–11 replace each user):
  // • handleMouseDown/handleMouseMove — panning (Task 9 rewrites as orbit)
  // • handleMouseUp — popover screenX/Y (Task 11 rewrites via projectPoint)
  // • handleWheel — zoom (Task 10 rewrites as camera.scale)
  // • screenToWorld — hit-testing (Task 8 rewrites)
  // • syncPopoverScreen — popover follow (Task 11 rewrites)
  // • runAutoFit — fit-to-sphere (Task 10 rewrites)
  private _transform = { x: 0, y: 0, scale: 1 };
  private hasFit = false;
  private needsSettle = false;

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
    this.updateCursor();

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

  /**
   * Run the simulation to a stable layout and fit the camera in one shot,
   * WITHOUT painting intermediate frames. The production animation loop calls
   * this once per (re)build so the graph appears already settled and fitted —
   * no entrance motion and no resize, only the final state is ever drawn.
   * Tests drive ticks via tickFor instead and exercise this directly.
   */
  settle(): void {
    if (!this.sim) return;
    // d3 scales every force by alpha, so once alpha decays past alphaMin the
    // layout is visually stable. The cap bounds the worst case for large graphs.
    const MAX_SETTLE_TICKS = 500;
    let i = 0;
    while (i < MAX_SETTLE_TICKS && this.sim.alpha() > this.sim.alphaMin()) {
      this.sim.tick();
      i++;
    }
    this.tickCount = AUTO_FIT_TICK;
    if (!this.hasFit) {
      this.runAutoFit();
      this.hasFit = true;
    }
    this.draw();
  }

  private startAutoTick(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    this.stopAutoTick();
    const loop = () => {
      if (this.sim) {
        if (this.needsSettle) {
          // First frame after a (re)build: lay the graph out and fit the camera
          // in one shot so the user never sees the scale=1 → fit-scale jump that
          // resized every node, nor the spreading motion. Only the final,
          // already-fitted state is ever painted — no entrance motion, no resize.
          this.needsSettle = false;
          this.settle();
        } else {
          this.sim.tick();
          this.onTick();
        }
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
    if (!this.hasFit && this.tickCount === AUTO_FIT_TICK) {
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
      minX = Math.min(minX, n.x! - n.radius - AUTO_FIT_NODE_MARGIN);
      minY = Math.min(minY, n.y! - n.radius - AUTO_FIT_NODE_MARGIN);
      maxX = Math.max(maxX, n.x! + n.radius + AUTO_FIT_NODE_MARGIN);
      maxY = Math.max(maxY, n.y! + n.radius + AUTO_FIT_NODE_MARGIN);
    }
    const w = maxX - minX, h = maxY - minY;
    if (w <= 0 || h <= 0) return;

    const baseFit = Math.min((width - AUTO_FIT_VIEWPORT_PADDING * 2) / w, (height - AUTO_FIT_VIEWPORT_PADDING * 2) / h);
    const fitScale = Math.min(baseFit * AUTO_FIT_INITIAL_ZOOM, AUTO_FIT_MAX_SCALE);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    this._transform = { x: width / 2 - cx * fitScale, y: height / 2 - cy * fitScale, scale: fitScale };
  }

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

    // Edges — alpha reduced by endpoint depth so back edges recede.
    const screen = new Map<string, { sx: number; sy: number; dn: number }>();
    for (const d of drawn) screen.set(d.n.id, { sx: d.p.sx, sy: d.p.sy, dn: d.dn });
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

  setData(nodes: GraphNode[], edges: GraphEdge[], activeNodeId: string | null): void {
    this.currentNodes = nodes;
    this.currentEdges = edges;
    this.activeNodeId = activeNodeId;
    // focusNodeId is intentionally NOT cleared here — callers own focus lifetime
    // and clear it explicitly via setFocus(null). Focus persists across setData.
    this.rebuild();
  }

  setSettings(settings: GraphSettings): void {
    const prev = this.settings;
    this.settings = settings;

    // Depth only matters in local mode (changes the active node set).
    if (this.mode === 'local' && prev.depth !== settings.depth) {
      this.rebuild();
      return;
    }

    if (!this.sim) return;

    if (prev.nodeSize !== settings.nodeSize) {
      for (const n of this.simNodes) {
        n.radius = computeRadius(n.type, n.weight, settings.nodeSize);
      }
    }

    const link = this.sim.force('link') as import('d3-force-3d').LinkForce3<SimNode, SimLink> | undefined;
    if (link) {
      link.distance((d) => settings.linkDistance / d.weight);
      link.strength((d) => settings.linkForce * d.weight);
    }

    const charge = this.sim.force('charge') as import('d3-force-3d').ManyBodyForce3<SimNode> | undefined;
    if (charge) charge.strength(-settings.repelForce);
    // No center force in the sphere layout; the 'sphere' force owns global shape.

    // Re-warm alpha so the next external tick applies the new forces.
    // Do NOT call .restart() — d3's internal timer is intentionally stopped;
    // the rAF auto-runner (and tickFor in tests) drive ticks.
    this.sim.alpha(0.3);
    this.draw();
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

  /**
   * Overrides the "active" node used for local-mode neighborhood filtering and
   * the active-node highlight ring. Lets the embedded mobile graph center local
   * mode on an arbitrary node — including a scripture node, which never appears
   * as the collection's activeNoteId. Pass null to clear.
   */
  setFocus(id: string | null): void {
    if (this.focusNodeId === id) return;
    this.focusNodeId = id;
    this.rebuild();
  }

  private effectiveActiveId(): string | null {
    return this.focusNodeId ?? this.activeNodeId;
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
      this._transform.x = this.dragState.origTx + (e.clientX - this.dragState.startX);
      this._transform.y = this.dragState.origTy + (e.clientY - this.dragState.startY);
      this.syncPopoverScreen();
      this.updateCursor();
      this.draw();
      return;
    }
    const { x, y } = this.screenToWorld(e.clientX, e.clientY);
    const id = this.findNodeAt(x, y)?.id ?? null;
    if (id !== this.hoveredNodeId) {
      this.hoveredNodeId = id;
      this.updateCursor();
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
        origTx: this._transform.x,
        origTy: this._transform.y,
      };
    }
  };

  handleMouseUp = (e: { clientX: number; clientY: number }): void => {
    if (this.dragState.active && this.dragState.moved) {
      this.dragState.active = false;
      this.dragState.moved = false;
      this.updateCursor();
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
    if (this.deps.onNodeTap) {
      const handled = this.deps.onNodeTap({ id: node.id, type: node.type, title: node.title });
      if (handled) {
        this.setState((prev) => (prev.popover === null ? prev : { ...prev, popover: null }));
        return;
      }
    }
    if (node.type === 'scripture') {
      const current = this.getSnapshot().popover;
      if (current && current.nodeId === node.id) {
        this.setState((prev) => ({ ...prev, popover: null }));
      } else {
        const t = this._transform;
        const screenX = (node.x ?? 0) * t.scale + t.x;
        const screenY = (node.y ?? 0) * t.scale + t.y;
        this.setState(() => ({
          popover: {
            nodeId: node.id,
            screenX,
            screenY,
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

  private updateCursor(): void {
    if (!this.canvas) return;
    let next: string;
    if (this.dragState.active && this.dragState.moved) {
      next = 'grabbing';
    } else if (this.hoveredNodeId !== null) {
      next = 'pointer';
    } else {
      next = 'grab';
    }
    if (this.canvas.style.cursor !== next) {
      this.canvas.style.cursor = next;
    }
  }

  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    const { x: tx, y: ty, scale } = this._transform;
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
    const factor = e.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR;
    const t = this._transform;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * factor));
    // Anchor world-point under cursor: compute offset ratio with OLD scale before mutating it.
    const ratio = newScale / t.scale;
    t.x = mx - (mx - t.x) * ratio;
    t.y = my - (my - t.y) * ratio;
    t.scale = newScale;
    this.syncPopoverScreen();
    this.draw();
  };

  private syncPopoverScreen(): void {
    const current = this.getSnapshot().popover;
    if (!current) return;
    const node = this.simNodes.find((n) => n.id === current.nodeId);
    if (!node || node.x == null || node.y == null) return;
    const t = this._transform;
    const screenX = node.x * t.scale + t.x;
    const screenY = node.y * t.scale + t.y;
    if (screenX === current.screenX && screenY === current.screenY) return;
    this.setState((prev) => prev.popover ? { popover: { ...prev.popover, screenX, screenY } } : prev);
  }

  /** Test affordance — read the camera without subscribing. */
  getCamera(): SphereCamera {
    return { ...this.camera };
  }

  private rebuild(): void {
    const filtered = this.filterNodes(this.currentNodes);
    const filteredIds = new Set(filtered.map((n) => n.id));

    // Preserve positions of surviving nodes.
    const prevPos = new Map<string, { x: number; y: number; z: number; vx?: number; vy?: number; vz?: number }>();
    for (const n of this.simNodes) {
      if (n.x != null && n.y != null) {
        prevPos.set(n.id, { x: n.x, y: n.y, z: n.z ?? 0, vx: n.vx, vy: n.vy, vz: (n as { vz?: number }).vz });
      }
    }

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
      .numDimensions(3)
      .alphaDecay(0.015)
      .velocityDecay(0.15);

    // Stop d3's auto-runner — we drive ticks via rAF in production / tickFor in tests.
    this.sim.stop();
    this.tickCount = 0;
    this.hasFit = false;
    // Production rAF loop settles + fits this build on its next frame before any
    // paint. tickFor (tests) ignores this and ticks/fits incrementally instead.
    this.needsSettle = true;
  }

  private filterNodes(nodes: GraphNode[]): GraphNode[] {
    let filtered = nodes;
    if (this.mode === 'local') {
      const focusId = this.effectiveActiveId();
      if (focusId && this.getNeighborhoodFn) {
        const neighborhood = this.getNeighborhoodFn(focusId, this.settings.depth);
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
