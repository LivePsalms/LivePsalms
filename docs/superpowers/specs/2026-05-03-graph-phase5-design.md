# FaithGraph — Phase 5 Design Spec (Polish)

## Overview

Phase 5 adds visual polish to the graph: real-time animations for node/edge lifecycle events, and an inline popover for scripture nodes.

**Two features:**
1. Scripture node click-through — inline popover showing verse text
2. Real-time animations — node bloom, traveling light on edges, fade transitions

**Out of scope:** Local graph view, graph settings sliders, unlinked mentions.

---

## 1. Scripture Node Click-Through (Inline Popover)

### 1.1 Behavior

When a user clicks a scripture node in the graph, a popover card appears anchored to the node. Clicking anywhere else on the canvas dismisses the popover.

Currently, clicking a scripture node does nothing (Phase 1 explicitly skipped it). This changes the click handler to show the popover instead.

### 1.2 Popover Content

The popover displays:
- **Verse reference** as header text (e.g., "Romans 8:28")
- **Verse text** body (from `ScriptureNode.text`)
- **Translation** label in small text (e.g., "WEB")

If `ScriptureNode.text` is empty (Bible API was unavailable during creation), the body shows "Verse text unavailable."

### 1.3 Rendering

The popover is drawn directly on the Canvas — no DOM overlay. It renders as:
- A rounded rectangle with a subtle fill (`rgba(255, 255, 255, 0.95)`) and border (`rgba(188, 179, 163, 0.5)`)
- Max width of 250px, text wrapping within
- Positioned above the node if there's space, below otherwise
- Small triangle pointer connecting the popover to the node

### 1.4 Data Access

The popover needs the `ScriptureNode` data (text, translation) which isn't currently on `GraphNode`. Two options:

**Approach:** Add a `scriptureText` and `scriptureTranslation` field to `GraphNode` (populated only for scripture-type nodes, empty string for others). This avoids a separate lookup at render time.

### 1.5 State

- `popoverNodeId: string | null` — tracked in component state
- Set on scripture node click, cleared on canvas click elsewhere
- The popover renders in the `drawCanvas` function after all nodes/edges

---

## 2. Real-Time Animations

### 2.1 Node Bloom

When a node is first added to the simulation, it renders with an expanding glow ring:
- Ring starts at node radius, expands to 3x radius over 600ms
- Alpha fades from 0.4 to 0
- Color matches the node's type color
- Tracked via a `birthTime: number` field on `SimNode` (set to `Date.now()` on creation)

**Draw logic (per frame):**
```
elapsed = now - node.birthTime
if elapsed < 600:
  progress = elapsed / 600
  ringRadius = node.radius * (1 + 2 * progress)
  ringAlpha = 0.4 * (1 - progress)
  draw circle at (node.x, node.y, ringRadius) with alpha ringAlpha
```

### 2.2 Traveling Light (New Edge)

When a new edge first appears, a bright dot travels from source to target:
- Duration: 400ms
- Dot is a small circle (radius 3px) with the same color as the edge but full opacity
- Follows the edge line from source position to target position
- Fades out over the final 100ms
- Tracked via a `birthTime: number` field on `SimLink`

**Draw logic (per frame):**
```
elapsed = now - link.birthTime
if elapsed < 400:
  progress = elapsed / 400
  dotX = src.x + (tgt.x - src.x) * progress
  dotY = src.y + (tgt.y - src.y) * progress
  dotAlpha = progress > 0.75 ? (1 - progress) / 0.25 : 1
  draw circle at (dotX, dotY, 3) with alpha dotAlpha
```

### 2.3 Fade Transitions (Removal)

When nodes/edges are removed from the graph data, they don't disappear instantly. Instead:
- They are marked with `removing: true` and `removeTime: number` on the SimNode/SimLink
- Over 200ms, their alpha fades from current to 0
- After 200ms, they are removed from the simulation arrays

**Implementation:** When the simulation rebuilds (on data change), compare old nodes/links with new ones. Nodes/links present in old but not in new get the `removing` flag instead of being dropped immediately.

### 2.4 Animation Loop

Currently the canvas redraws only on simulation ticks and user interactions. Animations require continuous rendering.

**Approach:** Track whether any animation is active (`hasActiveAnimations`). When true, run a `requestAnimationFrame` loop that calls `drawCanvas`. When all animations complete, stop the loop.

An animation is "active" when:
- Any node has `birthTime` within the last 600ms
- Any link has `birthTime` within the last 400ms
- Any node/link has `removing: true` with `removeTime` within the last 200ms

---

## 3. File Changes

### Modified Files

| File | Change |
|------|--------|
| `src/notepad/graph/types.ts` | Add `scriptureText` and `scriptureTranslation` to `GraphNode` |
| `src/notepad/graph/use-graph.ts` | Populate `scriptureText`/`scriptureTranslation` on scripture GraphNodes |
| `src/components/sections/notepad/GraphPane.tsx` | Add `birthTime`/`removing`/`removeTime` to SimNode/SimLink, popover state+rendering, animation loop, fade logic, bloom/traveling light draw calls |

No new files — all changes are in existing modules.

---

## 4. Performance

- Animation loop only runs when animations are active (not continuously)
- `birthTime` comparisons are O(n) per frame — negligible for hundreds of nodes
- Popover text wrapping is computed once on open, not per frame
- Canvas text rendering is the most expensive part of the popover — limited to one popover at a time
