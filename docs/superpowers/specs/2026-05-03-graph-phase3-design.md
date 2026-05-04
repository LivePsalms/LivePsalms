# FaithGraph — Phase 3 Design Spec (Local Graph + Settings)

## Overview

Phase 3 activates the Local graph view and adds user-adjustable force settings via a collapsible panel.

**Two features:**
1. Local graph view — BFS neighborhood of the active note, controlled by a depth slider (1-3)
2. Graph settings panel — collapsible panel with 5 sliders (depth + 4 force parameters)

**Out of scope:** Unlinked mentions, additional animation effects.

---

## 1. Local Graph View

### 1.1 Behavior

The Local tab (currently disabled with "Coming Soon") becomes active and clickable. When selected, the graph shows only nodes within N hops of the currently active note.

- **Global mode:** All nodes and edges (existing behavior, unchanged)
- **Local mode:** Only the neighborhood of the active note, computed via BFS on the adjacency list

When no note is active in Local mode, the graph shows an empty state: "Select a note to see its local graph."

### 1.2 Neighborhood Algorithm

```
function getLocalGraph(activeNodeId, depth, adjacencyList):
  visited = Set([activeNodeId])
  frontier = [activeNodeId]

  for d = 0 to depth - 1:
    nextFrontier = []
    for nodeId in frontier:
      for edge in adjacencyList[nodeId].outgoing:
        if edge.target not in visited:
          visited.add(edge.target)
          nextFrontier.push(edge.target)
      for edge in adjacencyList[nodeId].incoming:
        if edge.source not in visited:
          visited.add(edge.source)
          nextFrontier.push(edge.source)
    frontier = nextFrontier

  return visited  // Set of node IDs to render
```

### 1.3 Depth Levels

- **Depth 1:** Only nodes directly connected to the active note (tightest view)
- **Depth 2:** Nodes connected to those nodes (second-order relationships)
- **Depth 3:** Three levels out (broader thematic clusters)

Default depth: 1.

### 1.4 Filtering

Local graph filtering is applied **before** the existing type filters. The pipeline is:
1. Compute neighborhood node IDs via BFS
2. Filter to only those nodes
3. Apply type filters (scripture/sermon/devotion/theme toggles)
4. Build simulation with remaining nodes and their connecting edges

### 1.5 Transitions

When switching between Global and Local (or changing depth), the Phase 5 animation system handles transitions:
- Nodes leaving the view get `removing: true` + `removeTime` (fade out over 200ms)
- Nodes entering the view get `birthTime` (bloom in over 600ms)
- The simulation re-runs with the new node set

### 1.6 Data Access

The `useGraph` hook already builds an adjacency list internally. To support local graph computation, it needs to expose the adjacency list (or a neighborhood computation function) to GraphPane.

**Approach:** Add a `getNeighborhood(nodeId: string, depth: number): Set<string>` function to `UseGraphResult`. This runs the BFS algorithm on the internal adjacency list.

---

## 2. Graph Settings Panel

### 2.1 UI

A gear icon (Settings2 from lucide-react) appears next to the "GRAPH" heading. Clicking it toggles a collapsible panel that appears below the type filters, above the canvas. The panel contains labeled sliders.

### 2.2 Sliders

| Slider | Label | Range | Default | Step | Shown |
|--------|-------|-------|---------|------|-------|
| Depth | Depth | 1-3 | 1 | 1 | Local mode only |
| Link Distance | Link Distance | 60-300 | 120 | 10 | Always |
| Link Force | Link Force | 0.001-0.01 | 0.004 | 0.001 | Always |
| Repel Force | Repel Force | 100-2000 | 600 | 50 | Always |
| Center Force | Center Force | 0.0001-0.001 | 0.0004 | 0.0001 | Always |

### 2.3 Behavior

- Changes take effect immediately — the simulation restarts with `alpha(1)` using the new parameter values
- Settings are stored in component state (not persisted to localStorage)
- A "Reset" button restores all sliders to defaults
- Slider values are passed to the simulation setup effect as dependencies

### 2.4 Slider Styling

Minimal styling matching the existing UI: small labels in the same `text-[10px] tracking-wider` style, native range inputs styled with the app's color palette. Each slider shows its current value next to the label.

---

## 3. File Changes

### New Files

| File | Responsibility |
|------|---------------|
| `src/notepad/graph/local-graph.ts` | BFS neighborhood computation function |

### Modified Files

| File | Change |
|------|--------|
| `src/notepad/graph/use-graph.ts` | Expose `getNeighborhood` function on UseGraphResult |
| `src/notepad/context/NotepadProvider.tsx` | Pass `getNeighborhood` through context |
| `src/components/sections/notepad/GraphPane.tsx` | Local/Global mode switching, settings panel UI, depth filtering, force parameter state |

---

## 4. Performance

- BFS neighborhood computation is O(V + E) where V = vertices and E = edges in the subgraph. For depth 1-3 on a typical graph, this visits tens of nodes — negligible.
- Neighborhood is recomputed when `activeNoteId` or `depth` changes, not on every render.
- Simulation restart on settings change uses `alpha(1)` which settles in ~2 seconds.
