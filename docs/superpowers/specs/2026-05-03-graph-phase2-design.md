# FaithGraph — Phase 2 Design Spec

## Overview

Phase 2 adds two new connection mechanisms to the graph engine built in Phase 1:

1. **Mechanism 3: TSK Cross-References** — Automatic edges between scripture nodes based on the Treasury of Scripture Knowledge dataset.
2. **Mechanism 4: Shared Tag Forces** — Notes sharing tags are attracted toward each other via a custom d3 force (no visible tag nodes or edges).

**Out of scope:** Local graph view, graph settings sliders, real-time animations, unlinked mentions.

---

## 1. TSK Cross-References

### 1.1 Data Source

The Treasury of Scripture Knowledge (public domain, R.A. Torrey) is bundled as a JSON file in the app. The file maps each verse's canonical scripture ID to an array of cross-referenced verse IDs.

**File:** `src/notepad/graph/tsk-data.ts`

**Format:**
```typescript
// Keyed by canonical scripture ID (same format as edge-parser.ts generates)
// e.g., "rom-8-28" -> ["gen-50-20", "jer-29-11", "eph-1-4", ...]
const TSK_DATA: Record<string, string[]> = {
  "gen-1-1": ["ps-33-6", "ps-136-5", "isa-44-24", "jn-1-1", ...],
  "gen-1-2": ["job-26-7", "ps-33-6", "isa-40-13", ...],
  ...
};
export default TSK_DATA;
```

The raw TSK dataset will be sourced from a public GitHub repository (e.g., scrollmapper/bible_databases or OpenBible.info cross-references) and converted to a TypeScript module keyed by the canonical scripture ID format used by `edge-parser.ts` (e.g., `rom-8-28`).

**Note on file size:** The full TSK has ~344,000 entries. As a minified JSON/TS module this is approximately 2-5MB. This is acceptable for a bundled app. Vite will handle tree-shaking and lazy loading via dynamic `import()`.

### 1.2 Edge Creation Logic

When a `ScriptureNode` is created (in `syncNoteEdges` within `use-graph.ts`):

1. Load the TSK data (lazily via dynamic import on first use).
2. Look up the new scripture node's canonical ID (without the `scripture:` prefix) in the TSK data.
3. For each cross-referenced verse ID in the result:
   - Check if a `ScriptureNode` with ID `scripture:<verseId>` already exists in the user's graph.
   - If yes, create a `cross_reference` edge between the two scripture nodes (if one doesn't already exist).
4. Also check **all existing scripture nodes** to see if any of them list the new verse in their TSK cross-references. If so, create the reverse edge too.

This ensures that connections activate bidirectionally — both "new verse references old verse" and "old verse was waiting for new verse."

### 1.3 New Edge Type

```typescript
// Added to GraphEdge.type union
type: 'explicit' | 'scripture_reference' | 'cross_reference';
```

**Weight:** `0.5` (moderate — theologically valid but not user-initiated)

### 1.4 Visual Rendering

Cross-reference edges render the same as other edges in the Canvas renderer — line width and alpha scale with weight (0.5 = thinner, more subtle than explicit links). No special visual treatment needed beyond what the weight-based rendering already provides.

---

## 2. Shared Tag Forces

### 2.1 Approach

No new edge type, no tag nodes, no visible tag edges. Instead, a custom d3 force gently pulls notes that share tags toward each other during the physics simulation.

### 2.2 Custom Force Function

A new force function `forceSharedTags` is added to the simulation in `GraphPane.tsx`. On each tick:

1. Build a map of `tag -> [nodeIndices]` from the current simulation nodes.
2. For each tag group with 2+ nodes, apply a weak attractive force between all pairs.
3. The attraction strength scales with the number of shared tags between a pair of nodes.

**Force constant:** `0.3` per shared tag (matching the spec's weight 0.3 for shared_tag edges), applied as a gentle positional nudge per tick.

**Formula (per pair of nodes sharing N tags):**
```
dx = nodeB.x - nodeA.x
dy = nodeB.y - nodeA.y
strength = 0.0003 * N  // very weak — just enough to cluster
nodeA.vx += dx * strength
nodeA.vy += dy * strength
nodeB.vx -= dx * strength
nodeB.vy -= dy * strength
```

### 2.3 Data Source

The force reads tags from the `GraphNode` type. To support this, `GraphNode` needs a `tags` field:

```typescript
interface GraphNode {
  id: string;
  type: 'devotion' | 'sermon' | 'theme' | 'scripture';
  title: string;
  weight: number;
  tags: string[];  // NEW — populated from Note.tags, empty for scripture nodes
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}
```

The `useGraph` hook already has access to `Note.tags` when building `GraphNode[]` — it just needs to pass it through.

---

## 3. File Changes

### New Files

| File | Responsibility |
|------|---------------|
| `src/notepad/graph/tsk-data.ts` | Bundled TSK cross-reference lookup (canonical ID -> verse ID array) |
| `src/notepad/graph/cross-reference.ts` | Logic to check TSK and create cross-reference edges |
| `src/notepad/graph/force-shared-tags.ts` | Custom d3 force function for tag-based clustering |

### Modified Files

| File | Change |
|------|--------|
| `src/notepad/graph/types.ts` | Add `'cross_reference'` to edge type union, add `tags: string[]` to `GraphNode` |
| `src/notepad/graph/use-graph.ts` | Call cross-reference logic after scripture node creation, pass `tags` to GraphNode |
| `src/components/sections/notepad/GraphPane.tsx` | Add `forceSharedTags` to simulation, pass tags to SimNode |

### Build Script (One-Time)

A script to convert the raw TSK dataset into the `tsk-data.ts` format. This runs once during development, not at runtime. The output file is committed to the repo.

---

## 4. Performance

- **TSK data:** Loaded lazily via dynamic `import()` — only fetched when the first scripture node is created. Subsequent lookups are instant (module cached by the bundler).
- **Cross-reference check:** O(K) per new scripture node, where K is the number of cross-references for that verse (typically 5-30). The check against existing scripture nodes is O(K * S) where S is the number of existing scripture nodes — acceptable for hundreds of nodes.
- **Shared tag force:** O(T * P) per tick, where T is the number of unique tags and P is the average number of note pairs per tag. For hundreds of nodes with reasonable tag usage, this is negligible compared to the O(n²) charge force already running.

---

## 5. Dependencies

No new npm packages required. The TSK data is a static TypeScript module. The custom force function uses the d3-force API already installed.
