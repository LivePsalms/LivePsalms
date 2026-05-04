import { useEffect, useRef, useState, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { forceSharedTags } from '@/notepad/graph/force-shared-tags';
import { BookOpen, Mic, PenLine, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import { useNotepad } from '@/notepad/context/useNotepad';

interface SimNode extends SimulationNodeDatum {
  id: string;
  type: 'devotion' | 'sermon' | 'theme' | 'scripture';
  title: string;
  weight: number;
  radius: number;
  tags: string[];
  scriptureText: string;
  scriptureTranslation: string;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  edgeType: 'explicit' | 'scripture_reference' | 'cross_reference';
  weight: number;
}

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

function computeRadius(type: string, weight: number): number {
  const base = type === 'scripture' ? 8 : 6;
  return Math.min(24, Math.max(6, base + weight * 2));
}

interface GraphPaneProps {
  graphOpen: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function GraphPane({ graphOpen, expanded = false, onToggleExpand }: GraphPaneProps) {
  const { graphNodes, graphEdges, graphActiveNodeId, graphLoading, openNote } = useNotepad();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef({
    dragging: false, startX: 0, startY: 0, origTx: 0, origTy: 0,
  });

  const [graphFilters, setGraphFilters] = useState({
    scripture: true, sermon: true, devotion: true, theme: true,
  });

  const toggleFilter = (key: keyof typeof graphFilters) => {
    setGraphFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // --- Drawing ---
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { x: tx, y: ty, scale } = transformRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, tx * dpr, ty * dpr);

    const hovered = hoveredNodeId;
    const activeId = graphActiveNodeId;

    // Connected IDs for hover highlight
    const connectedIds = new Set<string>();
    if (hovered) {
      connectedIds.add(hovered);
      for (const link of linksRef.current) {
        const src = typeof link.source === 'object' ? (link.source as SimNode).id : String(link.source);
        const tgt = typeof link.target === 'object' ? (link.target as SimNode).id : String(link.target);
        if (src === hovered) connectedIds.add(tgt);
        if (tgt === hovered) connectedIds.add(src);
      }
    }

    // Draw edges
    for (const link of linksRef.current) {
      const src = link.source as SimNode;
      const tgt = link.target as SimNode;
      if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue;

      const isHighlighted = hovered && connectedIds.has(src.id) && connectedIds.has(tgt.id);
      const alpha = hovered ? (isHighlighted ? 0.8 : 0.08) : 0.3;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = `rgba(188, 179, 163, ${alpha})`;
      ctx.lineWidth = 1 + link.weight;
      ctx.stroke();
    }

    // Draw nodes
    for (const node of nodesRef.current) {
      if (node.x == null || node.y == null) continue;

      const isConnected = !hovered || connectedIds.has(node.id);
      const alpha = hovered ? (isConnected ? 1 : 0.15) : 0.85;
      const color = NODE_COLORS[node.type] ?? '#999';

      // Active note glow
      if (node.id === activeId) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = `${color}25`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2);
        ctx.fillStyle = `${color}15`;
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Label
      if (node.radius > 10 || node.id === hovered || node.id === activeId) {
        ctx.font = '11px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(62, 50, 40, ${alpha})`;
        ctx.fillText(node.title, node.x, node.y + node.radius + 14);
      }
    }

    // Hover tooltip for small nodes
    if (hovered) {
      const node = nodesRef.current.find((n) => n.id === hovered);
      if (node && node.x != null && node.y != null && node.radius <= 10 && node.id !== activeId) {
        ctx.font = '11px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(62, 50, 40, 0.9)';
        ctx.fillText(node.title, node.x, node.y - node.radius - 8);
      }
    }

    ctx.restore();
  }, [hoveredNodeId, graphActiveNodeId]);

  // Redraw on hover change
  useEffect(() => {
    drawCanvas();
  }, [hoveredNodeId, drawCanvas]);

  // --- Build simulation from graph data ---
  useEffect(() => {
    if (graphLoading) return;

    const filtered = graphNodes.filter((n) => graphFilters[n.type]);
    const filteredIds = new Set(filtered.map((n) => n.id));

    // Preserve positions
    const prevPos = new Map<string, { x: number; y: number }>();
    for (const node of nodesRef.current) {
      if (node.x != null && node.y != null) prevPos.set(node.id, { x: node.x, y: node.y });
    }

    const simNodes: SimNode[] = filtered.map((n) => {
      const prev = prevPos.get(n.id);
      return {
        id: n.id, type: n.type, title: n.title, weight: n.weight,
        radius: computeRadius(n.type, n.weight),
        tags: n.tags,
        scriptureText: n.scriptureText,
        scriptureTranslation: n.scriptureTranslation,
        x: prev?.x, y: prev?.y,
      };
    });

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    const simLinks: SimLink[] = graphEdges
      .filter((e) => filteredIds.has(e.source) && filteredIds.has(e.target))
      .map((e) => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
        edgeType: e.type,
        weight: e.weight,
      }))
      .filter((l) => l.source && l.target);

    nodesRef.current = simNodes;
    linksRef.current = simLinks;

    if (simRef.current) simRef.current.stop();

    const canvas = canvasRef.current;
    const container = containerRef.current;

    // Ensure canvas is sized to container before creating simulation
    if (canvas && container) {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width === 300 && canvas.height === 150) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
    }

    const width = canvas?.width ? canvas.width / (window.devicePixelRatio || 1) : 400;
    const height = canvas?.height ? canvas.height / (window.devicePixelRatio || 1) : 400;

    const sim = forceSimulation<SimNode>(simNodes)
      .force('link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((d) => 120 / d.weight)
          .strength((d) => 0.004 * d.weight)
      )
      .force('charge', forceManyBody<SimNode>().strength(-600))
      .force('center', forceCenter(width / 2, height / 2).strength(0.0004))
      .force('collide', forceCollide<SimNode>().radius((d) => d.radius + 2))
      .force('tags', forceSharedTags<SimNode>(0.0003))
      .alphaDecay(0.02)
      .velocityDecay(0.1)
      .on('tick', drawCanvas);

    simRef.current = sim;

    return () => { sim.stop(); };
  }, [graphNodes, graphEdges, graphLoading, graphFilters, drawCanvas]);

  // --- Canvas resize ---
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      if (simRef.current) {
        const cf = simRef.current.force('center') as ReturnType<typeof forceCenter> | undefined;
        if (cf) cf.x(rect.width / 2).y(rect.height / 2);
        simRef.current.alpha(0.3).restart();
      }
      drawCanvas();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [drawCanvas]);

  // --- Mouse interactions ---
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const { x: tx, y: ty, scale } = transformRef.current;
    return { x: (clientX - rect.left - tx) / scale, y: (clientY - rect.top - ty) / scale };
  }, []);

  const findNodeAt = useCallback((wx: number, wy: number): SimNode | null => {
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const node = nodesRef.current[i];
      if (node.x == null || node.y == null) continue;
      const dx = wx - node.x, dy = wy - node.y;
      if (dx * dx + dy * dy <= (node.radius + 4) ** 2) return node;
    }
    return null;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current.dragging) {
      transformRef.current.x = dragRef.current.origTx + (e.clientX - dragRef.current.startX);
      transformRef.current.y = dragRef.current.origTy + (e.clientY - dragRef.current.startY);
      drawCanvas();
      return;
    }
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    setHoveredNodeId(findNodeAt(x, y)?.id ?? null);
  }, [screenToWorld, findNodeAt, drawCanvas]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    if (!findNodeAt(x, y)) {
      dragRef.current = {
        dragging: true, startX: e.clientX, startY: e.clientY,
        origTx: transformRef.current.x, origTy: transformRef.current.y,
      };
    }
  }, [screenToWorld, findNodeAt]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragRef.current.dragging) { dragRef.current.dragging = false; return; }
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    const node = findNodeAt(x, y);
    if (node && node.type !== 'scripture') openNote(node.id);
  }, [screenToWorld, findNodeAt, openNote]);

  // Attach wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const t = transformRef.current;
      const newScale = Math.min(5, Math.max(0.1, t.scale * factor));
      t.x = mx - (mx - t.x) * (newScale / t.scale);
      t.y = my - (my - t.y) * (newScale / t.scale);
      t.scale = newScale;
      drawCanvas();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [drawCanvas]);

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

        <div className="inline-flex rounded-md overflow-hidden" style={{ border: '1px solid var(--pale-stone)' }}>
          <button
            className="px-3 py-1.5 text-[10px] font-medium tracking-wider"
            style={{ background: 'rgba(188, 179, 163, 0.35)', color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
          >
            Global
          </button>
          <button
            disabled
            className="px-3 py-1.5 text-[10px] font-medium tracking-wider flex items-center gap-1.5"
            style={{ background: 'transparent', color: 'var(--silica)', fontFamily: 'Outfit, sans-serif', opacity: 0.5, cursor: 'default' }}
          >
            Local
            <span className="text-[8px] tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(188, 179, 163, 0.3)', color: 'var(--silica)' }}>
              Coming Soon
            </span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(graphFilters) as Array<keyof typeof graphFilters>).map((key) => {
            const Icon = NODE_ICONS[key];
            return (
              <button
                key={key}
                onClick={() => toggleFilter(key)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium tracking-wider transition-all"
                style={{
                  border: `1px solid ${graphFilters[key] ? NODE_COLORS[key] : 'var(--pale-stone)'}`,
                  background: graphFilters[key] ? `${NODE_COLORS[key]}15` : 'transparent',
                  color: graphFilters[key] ? NODE_COLORS[key] : 'var(--silica)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                <Icon className="w-3 h-3" />
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: hoveredNodeId ? 'pointer' : 'grab' }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        />
        {graphLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[11px] tracking-wider" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
              Building graph...
            </span>
          </div>
        )}
        {!graphLoading && graphNodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
            <p className="text-[11px] tracking-wider text-center" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
              Create notes with [[links]] or Bible verse references to see your knowledge graph.
            </p>
          </div>
        )}
      </div>

      <div className="p-4 shrink-0" style={{ borderTop: '1px solid rgba(206, 204, 202, 0.5)' }}>
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 w-full justify-center py-2 rounded-md hover:bg-black/5 transition-colors"
        >
          {expanded ? (
            <Minimize2 className="w-3.5 h-3.5" style={{ color: 'var(--deep-umber)' }} />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" style={{ color: 'var(--deep-umber)' }} />
          )}
          <span className="text-[10px] font-medium tracking-widest" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
            {expanded ? 'COLLAPSE' : 'EXPAND'}
          </span>
        </button>
      </div>
    </aside>
  );
}
