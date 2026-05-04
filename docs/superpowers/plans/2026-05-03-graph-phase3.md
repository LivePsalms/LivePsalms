# FaithGraph Phase 3 (Local Graph + Settings) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the Local graph view (BFS neighborhood of active note with depth slider) and add a collapsible settings panel with 5 force/depth sliders.

**Architecture:** A new `local-graph.ts` module provides BFS neighborhood computation. The `useGraph` hook exposes a `getNeighborhood` function. GraphPane adds graph mode state (global/local), settings panel UI with sliders, and applies local filtering + configurable force parameters to the simulation.

**Tech Stack:** React 19, TypeScript, d3-force (existing), Canvas 2D

**Spec:** `docs/superpowers/specs/2026-05-03-graph-phase3-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/notepad/graph/local-graph.ts` | BFS neighborhood computation |

### Modified Files

| File | Change |
|------|--------|
| `src/notepad/graph/use-graph.ts` | Expose `getNeighborhood` on UseGraphResult |
| `src/notepad/context/NotepadProvider.tsx` | Pass `getNeighborhood` through context |
| `src/components/sections/notepad/GraphPane.tsx` | Local/Global mode, settings panel, depth filtering, configurable forces |

---

## Task 1: BFS Neighborhood Function

**Files:**
- Create: `src/notepad/graph/local-graph.ts`

- [ ] **Step 1: Create `src/notepad/graph/local-graph.ts`**

```typescript
import type { AdjacencyList } from './types';

/**
 * Computes the set of node IDs within `depth` hops of `activeNodeId`
 * using BFS on the adjacency list.
 */
export function getNeighborhoodNodeIds(
  activeNodeId: string,
  depth: number,
  adjacencyList: AdjacencyList
): Set<string> {
  const visited = new Set<string>([activeNodeId]);
  let frontier = [activeNodeId];

  for (let d = 0; d < depth; d++) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      const entry = adjacencyList.get(nodeId);
      if (!entry) continue;
      for (const edge of entry.outgoing) {
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          nextFrontier.push(edge.target);
        }
      }
      for (const edge of entry.incoming) {
        if (!visited.has(edge.source)) {
          visited.add(edge.source);
          nextFrontier.push(edge.source);
        }
      }
    }
    frontier = nextFrontier;
  }

  return visited;
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/local-graph.ts && git commit -m "feat(graph): add BFS neighborhood computation for local graph"
```

---

## Task 2: Expose getNeighborhood from useGraph

**Files:**
- Modify: `src/notepad/graph/use-graph.ts`
- Modify: `src/notepad/context/NotepadProvider.tsx`

- [ ] **Step 1: Add import and expose function in use-graph.ts**

Add import at top of `src/notepad/graph/use-graph.ts`:

```typescript
import { getNeighborhoodNodeIds } from './local-graph';
```

Add `getNeighborhood` to the `UseGraphResult` interface:

```typescript
export interface UseGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  activeNodeId: string | null;
  isLoading: boolean;
  rebuildGraph: () => void;
  getNeighborhood: (nodeId: string, depth: number) => Set<string>;
}
```

Inside the `useGraph` function, before the `return` statement, add:

```typescript
  const getNeighborhood = useCallback((nodeId: string, depth: number): Set<string> => {
    const allEdges = getAllEdges();
    const adjacency = buildAdjacencyList(allEdges);
    return getNeighborhoodNodeIds(nodeId, depth, adjacency);
  }, []);
```

Add `getNeighborhood` to the return object:

```typescript
  return {
    nodes: graphNodes,
    edges: graphEdges,
    activeNodeId: activeNoteId,
    isLoading,
    rebuildGraph: buildFullGraph,
    getNeighborhood,
  };
```

- [ ] **Step 2: Add to NotepadProvider context**

In `src/notepad/context/NotepadProvider.tsx`:

Add `getNeighborhood` to the `NotepadContextValue` interface, after `rebuildGraph`:

```typescript
  getNeighborhood: (nodeId: string, depth: number) => Set<string>;
```

Add to the value object, after `rebuildGraph: graph.rebuildGraph`:

```typescript
    getNeighborhood: graph.getNeighborhood,
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/use-graph.ts src/notepad/graph/local-graph.ts src/notepad/context/NotepadProvider.tsx && git commit -m "feat(graph): expose getNeighborhood function on graph context"
```

---

## Task 3: Local/Global Mode + Settings State in GraphPane

**Files:**
- Modify: `src/components/sections/notepad/GraphPane.tsx`

This task adds the mode switching, settings state, and settings panel UI. The next task wires the settings into the simulation.

- [ ] **Step 1: Add imports and state**

At the top of GraphPane.tsx, add to the lucide-react import:

```typescript
import { BookOpen, Mic, PenLine, Sparkles, Maximize2, Minimize2, Settings2 } from 'lucide-react';
```

Add `getNeighborhood` to the useNotepad destructuring:

```typescript
  const { graphNodes, graphEdges, graphActiveNodeId, graphLoading, openNote, getNeighborhood } = useNotepad();
```

After the `graphFilters` state, add:

```typescript
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
```

- [ ] **Step 2: Replace the Global/Local tab buttons**

Replace the current Global/Local button section (the `<div className="inline-flex rounded-md overflow-hidden"...>` block) with:

```typescript
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
```

- [ ] **Step 3: Add the settings panel**

After the type filters `<div className="flex flex-wrap gap-2">...</div>` block and before the closing `</div>` of the header section, add:

```typescript
        {settingsOpen && (
          <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--pale-stone)' }}>
            {graphMode === 'local' && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-medium tracking-wider w-24 shrink-0" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
                  Depth
                </label>
                <input
                  type="range" min={1} max={3} step={1}
                  value={graphSettings.depth}
                  onChange={(e) => setGraphSettings((s) => ({ ...s, depth: Number(e.target.value) }))}
                  className="flex-1 h-1 accent-[#C49A78]"
                />
                <span className="text-[10px] w-8 text-right" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
                  {graphSettings.depth}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-medium tracking-wider w-24 shrink-0" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
                Link Distance
              </label>
              <input
                type="range" min={60} max={300} step={10}
                value={graphSettings.linkDistance}
                onChange={(e) => setGraphSettings((s) => ({ ...s, linkDistance: Number(e.target.value) }))}
                className="flex-1 h-1 accent-[#C49A78]"
              />
              <span className="text-[10px] w-8 text-right" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
                {graphSettings.linkDistance}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-medium tracking-wider w-24 shrink-0" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
                Link Force
              </label>
              <input
                type="range" min={0.001} max={0.01} step={0.001}
                value={graphSettings.linkForce}
                onChange={(e) => setGraphSettings((s) => ({ ...s, linkForce: Number(e.target.value) }))}
                className="flex-1 h-1 accent-[#C49A78]"
              />
              <span className="text-[10px] w-10 text-right" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
                {graphSettings.linkForce.toFixed(3)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-medium tracking-wider w-24 shrink-0" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
                Repel Force
              </label>
              <input
                type="range" min={100} max={2000} step={50}
                value={graphSettings.repelForce}
                onChange={(e) => setGraphSettings((s) => ({ ...s, repelForce: Number(e.target.value) }))}
                className="flex-1 h-1 accent-[#C49A78]"
              />
              <span className="text-[10px] w-10 text-right" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
                {graphSettings.repelForce}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-medium tracking-wider w-24 shrink-0" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
                Center Force
              </label>
              <input
                type="range" min={0.0001} max={0.001} step={0.0001}
                value={graphSettings.centerForce}
                onChange={(e) => setGraphSettings((s) => ({ ...s, centerForce: Number(e.target.value) }))}
                className="flex-1 h-1 accent-[#C49A78]"
              />
              <span className="text-[10px] w-10 text-right" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
                {graphSettings.centerForce.toFixed(4)}
              </span>
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
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/components/sections/notepad/GraphPane.tsx && git commit -m "feat(graph): add local/global mode toggle and settings panel UI"
```

---

## Task 4: Wire Local Filtering + Configurable Forces

**Files:**
- Modify: `src/components/sections/notepad/GraphPane.tsx`

- [ ] **Step 1: Apply local graph filtering**

In the simulation setup effect, find the line:

```typescript
    const filtered = graphNodes.filter((n) => graphFilters[n.type]);
```

Replace it with:

```typescript
    // Apply local graph filtering first, then type filters
    let filtered = graphNodes;
    if (graphMode === 'local') {
      if (graphActiveNodeId) {
        const neighborhood = getNeighborhood(graphActiveNodeId, graphSettings.depth);
        filtered = filtered.filter((n) => neighborhood.has(n.id));
      } else {
        filtered = [];
      }
    }
    filtered = filtered.filter((n) => graphFilters[n.type]);
```

- [ ] **Step 2: Use configurable force parameters**

In the same effect, replace the simulation creation block:

```typescript
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
```

With:

```typescript
    const sim = forceSimulation<SimNode>(simNodes)
      .force('link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((d) => graphSettings.linkDistance / d.weight)
          .strength((d) => graphSettings.linkForce * d.weight)
      )
      .force('charge', forceManyBody<SimNode>().strength(-graphSettings.repelForce))
      .force('center', forceCenter(width / 2, height / 2).strength(graphSettings.centerForce))
      .force('collide', forceCollide<SimNode>().radius((d) => d.radius + 2))
      .force('tags', forceSharedTags<SimNode>(0.0003))
      .alphaDecay(0.02)
      .velocityDecay(0.1)
      .on('tick', drawCanvas);
```

- [ ] **Step 3: Add graphMode, graphSettings, and getNeighborhood to the effect dependencies**

Update the dependency array of the simulation setup effect from:

```typescript
  }, [graphNodes, graphEdges, graphLoading, graphFilters, drawCanvas]);
```

To:

```typescript
  }, [graphNodes, graphEdges, graphLoading, graphFilters, graphMode, graphSettings, graphActiveNodeId, getNeighborhood, drawCanvas]);
```

- [ ] **Step 4: Add empty state for local mode with no active note**

In the canvas area, find the empty state condition:

```typescript
        {!graphLoading && graphNodes.length === 0 && (
```

Replace with:

```typescript
        {!graphLoading && (graphNodes.length === 0 || (graphMode === 'local' && !graphActiveNodeId)) && (
```

And update the message to be context-aware. Replace the `<p>` text:

```typescript
            <p className="text-[11px] tracking-wider text-center" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
              {graphMode === 'local' && !graphActiveNodeId
                ? 'Select a note to see its local graph.'
                : 'Create notes with [[links]] or Bible verse references to see your knowledge graph.'}
            </p>
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/components/sections/notepad/GraphPane.tsx && git commit -m "feat(graph): wire local graph filtering and configurable force parameters"
```

---

## Task 5: Integration Verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/newmac/Downloads/Psalms_app && npm run dev
```

- [ ] **Step 2: Test Global/Local switching**

1. Open the notepad with existing notes.
2. Click a note in the sidebar to select it.
3. Click the "Local" tab — graph should filter to only nodes connected to the active note.
4. Click "Global" — all nodes return (with bloom animations on newly visible nodes).

- [ ] **Step 3: Test depth slider**

1. Switch to Local mode.
2. Open settings (gear icon).
3. Adjust the Depth slider from 1 to 2 to 3 — more nodes should appear at each level.

- [ ] **Step 4: Test force sliders**

1. In either mode, adjust Link Distance — nodes should spread out or cluster.
2. Adjust Repel Force — nodes push each other away more/less.
3. Adjust Center Force — nodes pull toward center more/less.
4. Adjust Link Force — connected nodes attract more/less strongly.
5. Click "Reset Defaults" — all sliders return to original values.

- [ ] **Step 5: Test local mode with no active note**

1. Switch to Local mode without selecting a note — should show "Select a note to see its local graph."

- [ ] **Step 6: Fix any issues and commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add -A && git commit -m "fix(graph): address Phase 3 integration issues"
```

Only commit if fixes were needed.
