# FaithGraph — Phase 1 Design Spec

## Overview

Phase 1 delivers a live, force-directed knowledge graph for the Psalms Notepad. It replaces the current static SVG mockup in `GraphPane.tsx` with a real Canvas 2D renderer powered by d3-force, backed by a new graph engine that builds an adjacency list from the user's notes.

**Scope:** Mechanism 1 (explicit `[[links]]`) and Mechanism 2 (auto-detected scripture references) only. Global graph view only. No TSK cross-references, shared tags, unlinked mentions, or local graph view.

---

## 1. Data Model

### 1.1 ScriptureNode

A lightweight, system-generated entity representing a Bible verse. Stored separately from user-authored notes in `notepad_scripture_nodes`.

```typescript
interface ScriptureNode {
  id: string;              // canonical: "scripture:rom-8-28"
  book: string;            // "Romans"
  chapter: number;         // 8
  verseStart: number;      // 28
  verseEnd: number | null; // null for single verse, number for range
  translation: string;     // default "ESV"
  text: string;            // verse text fetched from Bible API
  createdAt: string;       // ISO timestamp
}
```

**Canonical ID format:** `scripture:<abbrev>-<chapter>-<verse>` where `<abbrev>` is a lowercase short form (rom, gen, ps, 1pet, etc.). Ranges use the start verse only in the ID. The existing regex in `bible-verse-utils.ts` handles normalization of user input formats (e.g., "Rom. 8:28" → `scripture:rom-8-28`).

### 1.2 GraphEdge

An explicit connection between two nodes. Stored in `notepad_graph_edges`.

```typescript
interface GraphEdge {
  id: string;              // UUID
  source: string;          // node ID (Note.id or ScriptureNode.id)
  target: string;          // node ID
  type: 'explicit' | 'scripture_reference';
  weight: number;          // 1.0 for explicit, 0.9 for scripture_reference
  createdAt: string;       // ISO timestamp
}
```

### 1.3 GraphNode

A union type that normalizes `Note` and `ScriptureNode` into a common shape for the graph engine and renderer. Not persisted — computed at runtime.

```typescript
interface GraphNode {
  id: string;
  type: 'devotion' | 'sermon' | 'theme' | 'scripture';
  title: string;
  weight: number;          // sum of connected edge weights
  x?: number;              // set by d3-force
  y?: number;
  vx?: number;
  vy?: number;
}
```

### 1.4 AdjacencyList

```typescript
type AdjacencyList = Map<string, {
  outgoing: GraphEdge[];
  incoming: GraphEdge[];
}>;
```

---

## 2. File Structure

### New Files

```
src/notepad/graph/
├── types.ts              — ScriptureNode, GraphEdge, GraphNode, AdjacencyList types
├── edge-parser.ts        — Extract edges from TipTap JSON content
├── adjacency-list.ts     — Build and differentially update the adjacency list
├── scripture-store.ts    — CRUD for ScriptureNode (localStorage adapter)
├── edge-store.ts         — CRUD for GraphEdge (localStorage adapter)
├── use-graph.ts          — React hook: subscribes to note changes, exposes graph state
```

### Modified Files

```
src/notepad/types.ts                          — Re-export graph types
src/notepad/storage/adapter.ts                — Add scripture + edge methods to interface
src/notepad/storage/local-storage.ts          — Implement scripture + edge localStorage
src/notepad/context/NotepadProvider.tsx        — Wire use-graph hook, expose graph state
src/components/sections/notepad/GraphPane.tsx  — Full rewrite: Canvas 2D + d3-force
```

---

## 3. Graph Engine

### 3.1 Edge Parser (`edge-parser.ts`)

Given a note's TipTap JSON content string, extracts all connections:

**Inputs:** `noteId: string`, `content: string` (TipTap JSON)

**Outputs:** `GraphEdge[]`

**Logic:**
1. Parse the TipTap JSON content.
2. Walk the document tree looking for marks of type `noteLink` → produce edges with type `explicit`, weight `1.0`, source = noteId, target = linked note's ID.
3. Walk the document tree looking for text nodes, apply the Bible verse regex from `bible-verse-utils.ts` → for each match, normalize to canonical scripture ID, produce edges with type `scripture_reference`, weight `0.9`, source = noteId, target = scripture canonical ID.
4. Return the combined edge list.

**Scripture node auto-creation:** When a verse reference is found and no `ScriptureNode` with that canonical ID exists, the parser signals that one should be created. The `use-graph` hook handles the actual creation (fetching verse text from the Bible API).

### 3.2 Adjacency List Builder (`adjacency-list.ts`)

Maintains the full graph adjacency list.

**`buildAdjacencyList(edges: GraphEdge[]): AdjacencyList`**
- Iterates all edges, populates outgoing/incoming arrays per node.

**`updateAdjacencyList(list: AdjacencyList, noteId: string, oldEdges: GraphEdge[], newEdges: GraphEdge[]): AdjacencyList`**
- Differential update: removes old edges for `noteId`, inserts new edges.
- Only the changed note's edges are recalculated.

**`computeNodeWeights(list: AdjacencyList): Map<string, number>`**
- For each node, sums the weights of all connected edges (both incoming and outgoing).

### 3.3 Scripture Store (`scripture-store.ts`)

CRUD operations for `ScriptureNode` entities against `notepad_scripture_nodes` in localStorage.

- `getAll(): ScriptureNode[]`
- `getById(id: string): ScriptureNode | null`
- `create(node: Omit<ScriptureNode, 'createdAt'>): ScriptureNode`
- `delete(id: string): void`
- `exists(id: string): boolean`

### 3.4 Edge Store (`edge-store.ts`)

CRUD operations for `GraphEdge` entities against `notepad_graph_edges` in localStorage.

- `getAll(): GraphEdge[]`
- `getBySource(nodeId: string): GraphEdge[]`
- `getByTarget(nodeId: string): GraphEdge[]`
- `create(edge: Omit<GraphEdge, 'id' | 'createdAt'>): GraphEdge`
- `deleteBySource(nodeId: string): void`
- `delete(id: string): void`

---

## 4. React Integration

### 4.1 `use-graph.ts` Hook

The bridge between the notepad context and the graph engine.

**Subscribes to:**
- `notes` array from `NotepadProvider`
- `activeNoteId` from `NotepadProvider`

**On mount:**
1. Load all edges from edge store.
2. Load all scripture nodes from scripture store.
3. Build the full adjacency list.
4. Compute node weights.
5. Build the `GraphNode[]` array by merging notes + scripture nodes with their computed weights.

**On note change (content update):**
1. Re-parse the changed note's content via edge parser.
2. Diff against existing edges for that note (compare by source + target + type).
3. Remove stale edges, create new edges in edge store.
4. For any new scripture references, check if the `ScriptureNode` exists. If not, create it (verse text fetched from Bible API, same endpoint used by the existing `BibleVerse` extension hover tooltip).
5. Differentially update the adjacency list.
6. Recompute node weights.
7. Update the `GraphNode[]` and `GraphEdge[]` arrays exposed to the renderer.

**On note delete:**
1. Remove all edges where source or target matches the deleted note.
2. Update adjacency list and weights.

**Exposes:**
```typescript
{
  nodes: GraphNode[];
  edges: GraphEdge[];
  activeNodeId: string | null;
  isLoading: boolean;
}
```

### 4.2 NotepadProvider Changes

- Instantiate `use-graph` internally.
- Expose `graphNodes`, `graphEdges`, `activeNodeId` on the context value.
- No new props or providers needed — the graph state piggybacks on the existing context.

---

## 5. Physics Simulation (d3-force)

### 5.1 Setup

Install `d3-force` (and `@types/d3-force`). Create the simulation inside `GraphPane.tsx` using a ref to persist it across renders.

### 5.2 Forces

| Force | d3-force API | Configuration |
|-------|-------------|---------------|
| Link attraction | `d3.forceLink()` | `.id(d => d.id).distance(e => 120 / e.weight).strength(e => 0.004 * e.weight)` |
| Node repulsion | `d3.forceManyBody()` | `.strength(-600)` |
| Center gravity | `d3.forceCenter()` | `.strength(0.0004)` at canvas center |
| Collision | `d3.forceCollide()` | `.radius(d => d.radius + 2)` to prevent overlap |

### 5.3 Simulation Lifecycle

- On mount or when nodes/edges change: restart simulation with `alpha(1)`.
- On each tick: update node positions, trigger canvas redraw.
- Simulation decays naturally via `alphaDecay(0.02)` and `velocityDecay(0.1)` (equivalent to damping factor ~0.90).
- When simulation cools (`alpha < 0.01`), stop the tick loop to save CPU.

---

## 6. Canvas Renderer (`GraphPane.tsx`)

### 6.1 Rendering Pipeline (per frame)

1. Clear canvas.
2. Apply zoom/pan transform.
3. Draw all edges as lines (width = `1 + edge.weight`, alpha = 0.3; brighten to 0.8 if connected to hovered node).
4. Draw all nodes as circles (radius = `clamp(6 + weight * 2, 6, 24)`, scripture base = 8px).
5. Draw labels for nodes with radius > 10px.
6. Draw active note glow effect (animated ring).
7. Draw hover tooltip if a node is hovered.

### 6.2 Color Scheme

| Node Type | Fill Color | Matches existing app palette |
|-----------|-----------|------------------------------|
| Scripture | `#f59e0b` (amber) | Yes |
| Sermon | `#3b82f6` (blue) | Yes |
| Devotion | `#22c55e` (green) | Yes |
| Theme | `#a855f7` (purple) | Yes |

### 6.3 Interactions

**Pan:** mousedown on empty space → track drag delta → update transform offset.

**Zoom:** wheel event → scale transform, centered on cursor position. Clamp between 0.1x and 5x.

**Hover:** on mousemove, iterate nodes and check distance to cursor (hit testing). If within node radius:
- Highlight that node (full opacity, slight scale).
- Highlight its direct connections (edges brighten, connected nodes stay visible).
- Dim all other nodes and edges (alpha drops to 0.15).
- Show tooltip with node title.

**Click:** on mousedown on a node:
- If it's a `Note` (devotion/sermon/theme): call `openNote(node.id)` from notepad context.
- If it's a `ScriptureNode`: no action in Phase 1.

**Active note glow:** The node matching `activeNoteId` renders with an animated glow ring (pulsing opacity via `requestAnimationFrame`).

### 6.4 Header Controls

Keep the existing header UI pattern:
- **Global** tab (active, styled as selected)
- **Local** tab (grayed out, with "Coming Soon" text label beside it)
- **Node type filter toggles** (scripture, sermon, devotion, theme) — toggling a type hides/shows those nodes and their edges
- **Expand/collapse button** (existing behavior)

---

## 7. Performance

- **Differential edge parsing:** Only re-parse the note that changed, not all notes.
- **Debounced updates:** Content changes trigger graph updates on a 500ms debounce (matching existing editor save debounce).
- **Canvas rendering:** Only redraw when simulation is active (ticking) or on interaction (hover/pan/zoom). No continuous 60fps loop when graph is settled.
- **d3-force cooling:** Simulation auto-stops when alpha decays below threshold. Restarts on data changes.
- **Hit testing optimization:** For hover, iterate nodes array (O(n)). Acceptable for hundreds of nodes. If needed later, spatial indexing can be added.

---

## 8. Out of Scope (Phase 1)

These are explicitly deferred to later phases:

- **Mechanism 3:** TSK cross-reference edges
- **Mechanism 4:** Shared tag connection edges / tag nodes
- **Mechanism 5:** Unlinked mention suggestions
- **Local graph view:** Depth-based neighborhood traversal
- **Graph settings sliders:** User-adjustable force parameters
- **Real-time animations:** Traveling light on new edges, node bloom on creation
- **Scripture node click-through:** Opening a scripture node to view/annotate verse text

---

## 9. Dependencies

**New npm packages:**
- `d3-force` — force-directed simulation
- `@types/d3-force` — TypeScript definitions

No other new dependencies required. The Bible verse regex and API integration are reused from existing code.
