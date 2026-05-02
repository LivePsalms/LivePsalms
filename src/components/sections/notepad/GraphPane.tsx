import { useState } from 'react';
import { BookOpen, Mic, PenLine, Sparkles, Maximize2, Minimize2 } from 'lucide-react';

const graphNodes = [
  { id: 1, x: 55, y: 35, type: 'scripture' as const, label: 'Rom 8:28' },
  { id: 2, x: 40, y: 55, type: 'devotion' as const, label: 'Hard season' },
  { id: 3, x: 70, y: 58, type: 'sermon' as const, label: "Trusting God's Plan" },
  { id: 4, x: 30, y: 75, type: 'theme' as const, label: 'Sovereignty' },
  { id: 5, x: 60, y: 80, type: 'scripture' as const, label: 'Jer 29:11' },
  { id: 6, x: 80, y: 40, type: 'devotion' as const, label: 'Peace in the storm' },
  { id: 7, x: 45, y: 20, type: 'scripture' as const, label: 'Ps 46:10' },
  { id: 8, x: 75, y: 72, type: 'theme' as const, label: 'Trust' },
];

const graphEdges = [
  { from: 1, to: 2 }, { from: 1, to: 3 }, { from: 2, to: 4 },
  { from: 2, to: 5 }, { from: 3, to: 1 }, { from: 5, to: 4 },
  { from: 6, to: 7 }, { from: 6, to: 1 }, { from: 8, to: 5 }, { from: 8, to: 3 },
];

const nodeColors: Record<string, string> = {
  scripture: '#F59E0B', sermon: '#38BDF8', devotion: '#34D399', theme: '#A78BFA',
};

const nodeIcons: Record<string, typeof BookOpen> = {
  scripture: BookOpen, sermon: Mic, devotion: PenLine, theme: Sparkles,
};

export function GraphPane({ graphOpen, expanded = false, onToggleExpand }: { graphOpen: boolean; expanded?: boolean; onToggleExpand?: () => void }) {
  const [graphMode, setGraphMode] = useState<'global' | 'local'>('global');
  const [graphFilters, setGraphFilters] = useState({
    scripture: true, sermon: true, devotion: true, theme: true,
  });

  const toggleFilter = (key: keyof typeof graphFilters) => {
    setGraphFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredNodes = graphNodes.filter((n) => graphFilters[n.type]);
  const filteredEdges = graphEdges.filter(
    (e) => filteredNodes.some((n) => n.id === e.from) && filteredNodes.some((n) => n.id === e.to)
  );

  return (
    <aside
      className="overflow-hidden border-l flex-col hidden md:flex"
      style={{
        flex: expanded ? '1 1 0%' : (graphOpen ? '0 0 35%' : '0 0 0px'),
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
            onClick={() => setGraphMode('global')}
            className="px-3 py-1.5 text-[10px] font-medium tracking-wider transition-colors"
            style={{
              background: graphMode === 'global' ? 'rgba(188, 179, 163, 0.35)' : 'transparent',
              color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif',
            }}
          >
            Global
          </button>
          <button
            onClick={() => setGraphMode('local')}
            className="px-3 py-1.5 text-[10px] font-medium tracking-wider transition-colors"
            style={{
              background: graphMode === 'local' ? 'rgba(188, 179, 163, 0.35)' : 'transparent',
              color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif',
            }}
          >
            Local
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(graphFilters) as Array<keyof typeof graphFilters>).map((key) => {
            const Icon = nodeIcons[key];
            return (
              <button
                key={key}
                onClick={() => toggleFilter(key)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium tracking-wider transition-all"
                style={{
                  border: `1px solid ${graphFilters[key] ? nodeColors[key] : 'var(--pale-stone)'}`,
                  background: graphFilters[key] ? `${nodeColors[key]}15` : 'transparent',
                  color: graphFilters[key] ? nodeColors[key] : 'var(--silica)',
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

      <div className="flex-1 relative overflow-hidden">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="10 10 80 80"
          preserveAspectRatio="xMidYMid meet"
        >
          {filteredEdges.map((edge, i) => {
            const from = graphNodes.find((n) => n.id === edge.from);
            const to = graphNodes.find((n) => n.id === edge.to);
            if (!from || !to) return null;
            return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--warm-sand)" strokeWidth="0.3" opacity="0.6" />;
          })}
          {filteredNodes.map((node) => {
            const isActive = node.label === 'Hard season';
            return (
              <g key={node.id} className="cursor-pointer">
                {isActive && <circle cx={node.x} cy={node.y} r="4" fill={nodeColors[node.type]} opacity="0.15" />}
                <circle cx={node.x} cy={node.y} r={isActive ? 2.5 : 1.8} fill={nodeColors[node.type]} opacity={isActive ? 1 : 0.8} />
                <text x={node.x} y={node.y + 4.5} textAnchor="middle" fontSize="2.2" fill="var(--deep-umber)" opacity="0.7" fontFamily="Outfit, sans-serif">
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
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
