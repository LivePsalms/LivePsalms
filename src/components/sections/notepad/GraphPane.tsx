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
import { BookOpen, Mic, PenLine, Sparkles, Maximize2, Minimize2, Settings2 } from 'lucide-react';
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
  birthTime?: number;
  removing?: boolean;
  removeTime?: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  edgeType: 'explicit' | 'scripture_reference' | 'cross_reference';
  weight: number;
  birthTime?: number;
  removing?: boolean;
  removeTime?: number;
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
  const { graphNodes, graphEdges, graphActiveNodeId, graphLoading, openNote, getNeighborhood } = useNotepad();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [popoverNodeId, setPopoverNodeId] = useState<string | null>(null);
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

  const [graphMode, setGraphMode] = useState<'global' | 'local'>('global');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [graphSettings, setGraphSettings] = useState({
    depth: 1,
    linkDistance: 120,
    linkForce: 0.004,
    repelForce: 600,
    centerForce: 0.0004,
  });

  const defaultSettings = {
    depth: 1,
    linkDistance: 120,
    linkForce: 0.004,
    repelForce: 600,
    centerForce: 0.0004,
  };

  const drawPopover = useCallback((ctx: CanvasRenderingContext2D, node: SimNode) => {
    if (node.x == null || node.y == null) return;

    const maxWidth = 250;
    const padding = 12;
    const lineHeight = 16;
    const headerFont = 'bold 12px Outfit, sans-serif';
    const bodyFont = '11px Outfit, sans-serif';
    const smallFont = '9px Outfit, sans-serif';

    // Measure and wrap body text
    ctx.font = bodyFont;
    const bodyText = node.scriptureText || 'Verse text unavailable.';
    const words = bodyText.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth - padding * 2) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) lines.push(currentLine);

    const headerHeight = 20;
    const bodyHeight = lines.length * lineHeight;
    const translationHeight = 16;
    const totalHeight = padding + headerHeight + bodyHeight + translationHeight + padding;

    ctx.font = headerFont;
    const headerWidth = ctx.measureText(node.title).width;
    ctx.font = bodyFont;
    const maxLineWidth = Math.max(...lines.map((l) => ctx.measureText(l).width), headerWidth);
    const boxWidth = Math.min(maxWidth, maxLineWidth + padding * 2);

    const boxX = node.x - boxWidth / 2;
    const boxY = node.y - node.radius - totalHeight - 12;

    // Background rounded rect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = 'rgba(188, 179, 163, 0.5)';
    ctx.lineWidth = 1;
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(boxX + r, boxY);
    ctx.lineTo(boxX + boxWidth - r, boxY);
    ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + r);
    ctx.lineTo(boxX + boxWidth, boxY + totalHeight - r);
    ctx.quadraticCurveTo(boxX + boxWidth, boxY + totalHeight, boxX + boxWidth - r, boxY + totalHeight);
    ctx.lineTo(boxX + r, boxY + totalHeight);
    ctx.quadraticCurveTo(boxX, boxY + totalHeight, boxX, boxY + totalHeight - r);
    ctx.lineTo(boxX, boxY + r);
    ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pointer triangle
    ctx.beginPath();
    ctx.moveTo(node.x - 6, boxY + totalHeight);
    ctx.lineTo(node.x, boxY + totalHeight + 8);
    ctx.lineTo(node.x + 6, boxY + totalHeight);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(node.x - 6, boxY + totalHeight);
    ctx.lineTo(node.x, boxY + totalHeight + 8);
    ctx.lineTo(node.x + 6, boxY + totalHeight);
    ctx.strokeStyle = 'rgba(188, 179, 163, 0.5)';
    ctx.stroke();

    // Header
    ctx.font = headerFont;
    ctx.fillStyle = 'rgba(62, 50, 40, 1)';
    ctx.textAlign = 'left';
    ctx.fillText(node.title, boxX + padding, boxY + padding + 12);

    // Body lines
    ctx.font = bodyFont;
    ctx.fillStyle = 'rgba(62, 50, 40, 0.8)';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], boxX + padding, boxY + padding + headerHeight + (i + 1) * lineHeight);
    }

    // Translation label
    ctx.font = smallFont;
    ctx.fillStyle = 'rgba(62, 50, 40, 0.5)';
    ctx.fillText(node.scriptureTranslation || 'WEB', boxX + padding, boxY + padding + headerHeight + bodyHeight + translationHeight);
  }, []);

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
      let alpha = hovered ? (isHighlighted ? 0.8 : 0.08) : 0.3;

      // Fade out removing edges
      if (link.removing && link.removeTime) {
        const elapsed = Date.now() - link.removeTime;
        alpha *= Math.max(0, 1 - elapsed / 200);
        if (alpha <= 0) continue;
      }

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = `rgba(188, 179, 163, ${alpha})`;
      ctx.lineWidth = 1 + link.weight;
      ctx.stroke();
    }

    // Traveling light on new edges
    for (const link of linksRef.current) {
      if (!link.birthTime) continue;
      const src = link.source as SimNode;
      const tgt = link.target as SimNode;
      if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue;

      const elapsed = Date.now() - link.birthTime;
      if (elapsed < 400) {
        const progress = elapsed / 400;
        const dotX = src.x + (tgt.x - src.x) * progress;
        const dotY = src.y + (tgt.y - src.y) * progress;
        const dotAlpha = progress > 0.75 ? (1 - progress) / 0.25 : 1;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(188, 179, 163, 1)';
        ctx.globalAlpha = dotAlpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Draw nodes
    for (const node of nodesRef.current) {
      if (node.x == null || node.y == null) continue;

      const isConnected = !hovered || connectedIds.has(node.id);
      let alpha = hovered ? (isConnected ? 1 : 0.15) : 0.85;

      // Fade out removing nodes
      if (node.removing && node.removeTime) {
        const elapsed = Date.now() - node.removeTime;
        alpha *= Math.max(0, 1 - elapsed / 200);
        if (alpha <= 0) continue;
      }
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

      // Node bloom animation
      if (node.birthTime) {
        const elapsed = Date.now() - node.birthTime;
        if (elapsed < 600) {
          const progress = elapsed / 600;
          const ringRadius = node.radius * (1 + 2 * progress);
          const ringAlpha = 0.4 * (1 - progress);
          ctx.beginPath();
          ctx.arc(node.x, node.y, ringRadius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = ringAlpha;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
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

    // Scripture popover
    if (popoverNodeId) {
      const pNode = nodesRef.current.find((n) => n.id === popoverNodeId);
      if (pNode && pNode.x != null && pNode.y != null) {
        drawPopover(ctx, pNode);
      }
    }

    ctx.restore();
  }, [hoveredNodeId, graphActiveNodeId, popoverNodeId, drawPopover]);

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

    // Track new nodes with birthTime for bloom animation
    const prevNodeIds = new Set(nodesRef.current.filter(n => !n.removing).map((n) => n.id));
    const now = Date.now();
    for (const node of simNodes) {
      if (!prevNodeIds.has(node.id)) {
        node.birthTime = now;
      }
    }

    // Track new links with birthTime for traveling light animation
    const prevLinkKeys = new Set(
      linksRef.current.filter(l => !l.removing).map((l) => {
        const src = typeof l.source === 'object' ? l.source.id : String(l.source);
        const tgt = typeof l.target === 'object' ? l.target.id : String(l.target);
        return `${src}->${tgt}`;
      })
    );
    for (const link of simLinks) {
      const src = typeof link.source === 'object' ? link.source.id : String(link.source);
      const tgt = typeof link.target === 'object' ? link.target.id : String(link.target);
      if (!prevLinkKeys.has(`${src}->${tgt}`)) {
        link.birthTime = now;
      }
    }

    // Detect removed nodes — keep temporarily for fade-out
    const newNodeIds = new Set(simNodes.map((n) => n.id));
    const removingNodes: SimNode[] = [];
    for (const oldNode of nodesRef.current) {
      if (!newNodeIds.has(oldNode.id) && !oldNode.removing) {
        removingNodes.push({ ...oldNode, removing: true, removeTime: now });
      } else if (oldNode.removing && oldNode.removeTime && now - oldNode.removeTime < 200) {
        removingNodes.push(oldNode);
      }
    }

    const newLinkKeys = new Set(
      simLinks.map((l) => {
        const src = typeof l.source === 'object' ? l.source.id : String(l.source);
        const tgt = typeof l.target === 'object' ? l.target.id : String(l.target);
        return `${src}->${tgt}`;
      })
    );
    const removingLinks: SimLink[] = [];
    for (const oldLink of linksRef.current) {
      const src = typeof oldLink.source === 'object' ? oldLink.source.id : String(oldLink.source);
      const tgt = typeof oldLink.target === 'object' ? oldLink.target.id : String(oldLink.target);
      const key = `${src}->${tgt}`;
      if (!newLinkKeys.has(key) && !oldLink.removing) {
        removingLinks.push({ ...oldLink, removing: true, removeTime: now });
      } else if (oldLink.removing && oldLink.removeTime && now - oldLink.removeTime < 200) {
        removingLinks.push(oldLink);
      }
    }

    nodesRef.current = [...simNodes, ...removingNodes];
    linksRef.current = [...simLinks, ...removingLinks];

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

  // Animation loop — runs only while animations are active
  useEffect(() => {
    let rafId: number = 0;
    let running = false;

    function hasActiveAnimations(): boolean {
      const now = Date.now();
      for (const node of nodesRef.current) {
        if (node.birthTime && now - node.birthTime < 600) return true;
        if (node.removing && node.removeTime && now - node.removeTime < 200) return true;
      }
      for (const link of linksRef.current) {
        if (link.birthTime && now - link.birthTime < 400) return true;
        if (link.removing && link.removeTime && now - link.removeTime < 200) return true;
      }
      return false;
    }

    function loop() {
      if (hasActiveAnimations()) {
        drawCanvas();
        rafId = requestAnimationFrame(loop);
      } else {
        running = false;
      }
    }

    if (!graphLoading && graphNodes.length > 0 && hasActiveAnimations()) {
      running = true;
      rafId = requestAnimationFrame(loop);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [graphNodes, graphEdges, graphLoading, drawCanvas]);

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
    if (node) {
      if (node.type === 'scripture') {
        setPopoverNodeId((prev) => prev === node.id ? null : node.id);
      } else {
        setPopoverNodeId(null);
        openNote(node.id);
      }
    } else {
      setPopoverNodeId(null);
    }
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

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md overflow-hidden" style={{ border: '1px solid var(--pale-stone)' }}>
            <button
              onClick={() => setGraphMode('global')}
              className="px-3 py-1.5 text-[10px] font-medium tracking-wider"
              style={{
                background: graphMode === 'global' ? 'rgba(188, 179, 163, 0.35)' : 'transparent',
                color: 'var(--deep-umber)',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              Global
            </button>
            <button
              onClick={() => setGraphMode('local')}
              className="px-3 py-1.5 text-[10px] font-medium tracking-wider"
              style={{
                background: graphMode === 'local' ? 'rgba(188, 179, 163, 0.35)' : 'transparent',
                color: 'var(--deep-umber)',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              Local
            </button>
          </div>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="p-1.5 rounded hover:bg-black/5 transition-colors"
            title="Graph settings"
          >
            <Settings2 className="w-3.5 h-3.5" style={{ color: 'var(--silica)' }} />
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

        {settingsOpen && (
          <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--pale-stone)' }}>
            {graphMode === 'local' && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-medium tracking-wider w-24 shrink-0" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>Depth</label>
                <input type="range" min={1} max={3} step={1} value={graphSettings.depth}
                  onChange={(e) => setGraphSettings((s) => ({ ...s, depth: Number(e.target.value) }))}
                  className="flex-1 h-1 accent-[#C49A78]" />
                <span className="text-[10px] w-8 text-right" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>{graphSettings.depth}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-medium tracking-wider w-24 shrink-0" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>Link Distance</label>
              <input type="range" min={60} max={300} step={10} value={graphSettings.linkDistance}
                onChange={(e) => setGraphSettings((s) => ({ ...s, linkDistance: Number(e.target.value) }))}
                className="flex-1 h-1 accent-[#C49A78]" />
              <span className="text-[10px] w-8 text-right" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>{graphSettings.linkDistance}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-medium tracking-wider w-24 shrink-0" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>Link Force</label>
              <input type="range" min={0.001} max={0.01} step={0.001} value={graphSettings.linkForce}
                onChange={(e) => setGraphSettings((s) => ({ ...s, linkForce: Number(e.target.value) }))}
                className="flex-1 h-1 accent-[#C49A78]" />
              <span className="text-[10px] w-10 text-right" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>{graphSettings.linkForce.toFixed(3)}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-medium tracking-wider w-24 shrink-0" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>Repel Force</label>
              <input type="range" min={100} max={2000} step={50} value={graphSettings.repelForce}
                onChange={(e) => setGraphSettings((s) => ({ ...s, repelForce: Number(e.target.value) }))}
                className="flex-1 h-1 accent-[#C49A78]" />
              <span className="text-[10px] w-10 text-right" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>{graphSettings.repelForce}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-medium tracking-wider w-24 shrink-0" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>Center Force</label>
              <input type="range" min={0.0001} max={0.001} step={0.0001} value={graphSettings.centerForce}
                onChange={(e) => setGraphSettings((s) => ({ ...s, centerForce: Number(e.target.value) }))}
                className="flex-1 h-1 accent-[#C49A78]" />
              <span className="text-[10px] w-10 text-right" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>{graphSettings.centerForce.toFixed(4)}</span>
            </div>
            <button
              onClick={() => setGraphSettings(defaultSettings)}
              className="text-[10px] font-medium tracking-wider px-2 py-1 rounded hover:bg-black/5 transition-colors"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              Reset Defaults
            </button>
          </div>
        )}
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
