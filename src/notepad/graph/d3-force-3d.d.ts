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
    alphaDecay(n: number): this;
    velocityDecay(n: number): this;
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
