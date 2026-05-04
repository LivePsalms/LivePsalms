# FaithGraph Phase 5 (Polish) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visual polish to the graph — node bloom animations, traveling light on new edges, fade-out transitions, and an inline scripture popover on click.

**Architecture:** All animation state is tracked via `birthTime`/`removeTime` timestamps on SimNode/SimLink. A `requestAnimationFrame` loop runs only while animations are active. The scripture popover is drawn on Canvas, reading verse data from new `scriptureText`/`scriptureTranslation` fields on GraphNode.

**Tech Stack:** Canvas 2D API, requestAnimationFrame, existing d3-force simulation

**Spec:** `docs/superpowers/specs/2026-05-03-graph-phase5-design.md`

---

## File Structure

### Modified Files

| File | Change |
|------|--------|
| `src/notepad/graph/types.ts` | Add `scriptureText` and `scriptureTranslation` to `GraphNode` |
| `src/notepad/graph/use-graph.ts` | Populate scripture text/translation on scripture GraphNodes |
| `src/components/sections/notepad/GraphPane.tsx` | Animation state on SimNode/SimLink, bloom/traveling-light/fade draw logic, popover state+rendering, animation loop |

---

## Task 1: Add Scripture Text Fields to GraphNode

**Files:**
- Modify: `src/notepad/graph/types.ts`
- Modify: `src/notepad/graph/use-graph.ts`

- [ ] **Step 1: Add fields to GraphNode in `types.ts`**

Add after the `tags: string[];` field in the `GraphNode` interface:

```typescript
  scriptureText: string;
  scriptureTranslation: string;
```

- [ ] **Step 2: Update use-graph.ts — note nodes**

In `src/notepad/graph/use-graph.ts`, in the `buildFullGraph` function where note GraphNodes are constructed (~line 72-78), add the two new fields:

```typescript
    const nodes: GraphNode[] = notes.map((note) => ({
      id: note.id,
      type: note.type,
      title: note.title,
      weight: weights.get(note.id) ?? 0,
      tags: note.tags,
      scriptureText: '',
      scriptureTranslation: '',
    }));
```

- [ ] **Step 3: Update use-graph.ts — scripture nodes**

In the scripture nodes loop (~line 80-89), add the fields:

```typescript
        nodes.push({
          id: sn.id,
          type: 'scripture',
          title: `${sn.book} ${sn.chapter}:${sn.verseStart}${sn.verseEnd ? `-${sn.verseEnd}` : ''}`,
          weight: weights.get(sn.id) ?? 0,
          tags: [],
          scriptureText: sn.text,
          scriptureTranslation: sn.translation,
        });
```

- [ ] **Step 4: Update GraphPane.tsx SimNode**

Add the two fields to the `SimNode` interface in `GraphPane.tsx` (after `tags: string[];`):

```typescript
  scriptureText: string;
  scriptureTranslation: string;
```

And update the `simNodes` construction to include them:

```typescript
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
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/types.ts src/notepad/graph/use-graph.ts src/components/sections/notepad/GraphPane.tsx && git commit -m "feat(graph): add scriptureText and scriptureTranslation to GraphNode"
```

---

## Task 2: Scripture Popover on Click

**Files:**
- Modify: `src/components/sections/notepad/GraphPane.tsx`

- [ ] **Step 1: Add popover state**

After the `hoveredNodeId` state declaration (~line 63), add:

```typescript
  const [popoverNodeId, setPopoverNodeId] = useState<string | null>(null);
```

- [ ] **Step 2: Add popover drawing function**

Add this function inside the component, before the `drawCanvas` callback (~before line 77):

```typescript
  const drawPopover = useCallback((ctx: CanvasRenderingContext2D, node: SimNode) => {
    if (node.x == null || node.y == null) return;

    const maxWidth = 250;
    const padding = 12;
    const lineHeight = 16;
    const headerFont = 'bold 12px Outfit, sans-serif';
    const bodyFont = '11px Outfit, sans-serif';
    const smallFont = '9px Outfit, sans-serif';

    // Measure text
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

    // Measure width to fit content
    ctx.font = headerFont;
    const headerWidth = ctx.measureText(node.title).width;
    ctx.font = bodyFont;
    const maxLineWidth = Math.max(...lines.map((l) => ctx.measureText(l).width), headerWidth);
    const boxWidth = Math.min(maxWidth, maxLineWidth + padding * 2);

    const boxX = node.x - boxWidth / 2;
    const boxY = node.y - node.radius - totalHeight - 12; // above the node

    // Background
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

    // Translation
    ctx.font = smallFont;
    ctx.fillStyle = 'rgba(62, 50, 40, 0.5)';
    ctx.fillText(node.scriptureTranslation || 'WEB', boxX + padding, boxY + padding + headerHeight + bodyHeight + translationHeight);
  }, []);
```

- [ ] **Step 3: Add popover rendering to drawCanvas**

In the `drawCanvas` callback, after the hover tooltip section (~after line 168, before `ctx.restore()`), add:

```typescript
    // Scripture popover
    if (popoverNodeId) {
      const pNode = nodesRef.current.find((n) => n.id === popoverNodeId);
      if (pNode && pNode.x != null && pNode.y != null) {
        drawPopover(ctx, pNode);
      }
    }
```

Also add `popoverNodeId` and `drawPopover` to the `drawCanvas` dependency array.

- [ ] **Step 4: Update click handler for scripture nodes**

In the `handleMouseUp` callback, change the click logic from:

```typescript
    const node = findNodeAt(x, y);
    if (node && node.type !== 'scripture') openNote(node.id);
```

To:

```typescript
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
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/components/sections/notepad/GraphPane.tsx && git commit -m "feat(graph): add scripture node popover with verse text on click"
```

---

## Task 3: Node Bloom and Edge Traveling Light Animations

**Files:**
- Modify: `src/components/sections/notepad/GraphPane.tsx`

- [ ] **Step 1: Add animation fields to SimNode and SimLink**

Update the `SimNode` interface to add:

```typescript
  birthTime?: number;
  removing?: boolean;
  removeTime?: number;
```

Update the `SimLink` interface to add:

```typescript
  birthTime?: number;
  removing?: boolean;
  removeTime?: number;
```

- [ ] **Step 2: Set birthTime on new nodes/links**

In the simulation setup effect, after building `simNodes` and `simLinks`, add birthTime for nodes that didn't exist in the previous frame. Find the section where `nodesRef.current = simNodes;` (~line 214) and replace it with:

```typescript
    // Track new nodes/links with birthTime for animations
    const prevNodeIds = new Set(nodesRef.current.map((n) => n.id));
    const now = Date.now();
    for (const node of simNodes) {
      if (!prevNodeIds.has(node.id)) {
        node.birthTime = now;
      }
    }

    const prevLinkKeys = new Set(
      linksRef.current.map((l) => {
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

    nodesRef.current = simNodes;
    linksRef.current = simLinks;
```

- [ ] **Step 3: Add bloom drawing to drawCanvas**

In the `drawCanvas` function, inside the node drawing loop, after the active note glow block (~after line 141) and before the node circle draw, add the bloom effect:

```typescript
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
```

- [ ] **Step 4: Add traveling light to drawCanvas**

In the `drawCanvas` function, after the edge drawing loop (~after line 121), add a second pass for traveling light effects:

```typescript
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
```

- [ ] **Step 5: Add animation loop**

Add a new `useEffect` after the resize observer effect, to run a `requestAnimationFrame` loop while animations are active:

```typescript
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

    // Start the loop whenever graph data changes (which might introduce new nodes/links)
    if (!graphLoading && graphNodes.length > 0) {
      if (!running && hasActiveAnimations()) {
        running = true;
        rafId = requestAnimationFrame(loop);
      }
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [graphNodes, graphEdges, graphLoading, drawCanvas]);
```

- [ ] **Step 6: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/components/sections/notepad/GraphPane.tsx && git commit -m "feat(graph): add node bloom, traveling light, and animation loop"
```

---

## Task 4: Fade-Out Transitions on Removal

**Files:**
- Modify: `src/components/sections/notepad/GraphPane.tsx`

- [ ] **Step 1: Track removing nodes/links in simulation setup**

In the simulation setup effect, before the line `nodesRef.current = simNodes;` (the block added in Task 3), add logic to detect removed nodes and keep them temporarily with a `removing` flag:

After the birthTime assignment block and before `nodesRef.current = simNodes;`, add:

```typescript
    // Detect removed nodes — keep them temporarily for fade-out
    const newNodeIds = new Set(simNodes.map((n) => n.id));
    const removingNodes: SimNode[] = [];
    for (const oldNode of nodesRef.current) {
      if (!newNodeIds.has(oldNode.id) && !oldNode.removing) {
        removingNodes.push({ ...oldNode, removing: true, removeTime: now });
      } else if (oldNode.removing && oldNode.removeTime && now - oldNode.removeTime < 200) {
        removingNodes.push(oldNode); // keep during fade
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
```

Remove the old `nodesRef.current = simNodes;` and `linksRef.current = simLinks;` lines (they're replaced by the spread above).

- [ ] **Step 2: Apply fade-out alpha in drawCanvas**

In the `drawCanvas` node drawing loop, modify the alpha calculation to account for removal. Change:

```typescript
      const isConnected = !hovered || connectedIds.has(node.id);
      const alpha = hovered ? (isConnected ? 1 : 0.15) : 0.85;
```

To:

```typescript
      const isConnected = !hovered || connectedIds.has(node.id);
      let alpha = hovered ? (isConnected ? 1 : 0.15) : 0.85;

      // Fade out removing nodes
      if (node.removing && node.removeTime) {
        const elapsed = Date.now() - node.removeTime;
        alpha *= Math.max(0, 1 - elapsed / 200);
        if (alpha <= 0) continue;
      }
```

Do the same for edges in the edge drawing loop. Change:

```typescript
      const isHighlighted = hovered && connectedIds.has(src.id) && connectedIds.has(tgt.id);
      const alpha = hovered ? (isHighlighted ? 0.8 : 0.08) : 0.3;
```

To:

```typescript
      const isHighlighted = hovered && connectedIds.has(src.id) && connectedIds.has(tgt.id);
      let alpha = hovered ? (isHighlighted ? 0.8 : 0.08) : 0.3;

      // Fade out removing edges
      if (link.removing && link.removeTime) {
        const elapsed = Date.now() - link.removeTime;
        alpha *= Math.max(0, 1 - elapsed / 200);
        if (alpha <= 0) continue;
      }
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/components/sections/notepad/GraphPane.tsx && git commit -m "feat(graph): add fade-out transitions for removed nodes and edges"
```

---

## Task 5: Integration Verification

Manual verification — open the app and confirm all Phase 5 features work.

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/newmac/Downloads/Psalms_app && npm run dev
```

- [ ] **Step 2: Test scripture popover**

1. Open the notepad and navigate to a note with verse references.
2. In the graph, click a scripture node (amber).
3. A popover should appear above the node showing the verse reference, text, and translation.
4. Click elsewhere on the canvas — the popover should dismiss.
5. Click the scripture node again — popover reappears.

- [ ] **Step 3: Test node bloom animation**

1. Create a new note and type a Bible verse reference (e.g., "Psalm 23:1").
2. After the debounce, a new scripture node should appear in the graph with an expanding glow ring that fades over ~600ms.

- [ ] **Step 4: Test traveling light on new edge**

When the new node/edge appears (from step 3), a bright dot should travel along the new edge from the note node to the scripture node over ~400ms.

- [ ] **Step 5: Test fade-out on removal**

1. Delete a verse reference from a note's text.
2. After the debounce, the corresponding edge should fade out over ~200ms rather than disappearing instantly.

- [ ] **Step 6: Fix any issues and commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add -A && git commit -m "fix(graph): address Phase 5 integration issues"
```

Only commit if fixes were needed.
