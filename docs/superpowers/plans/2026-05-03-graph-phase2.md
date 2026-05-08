# FaithGraph Phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TSK cross-reference edges between scripture nodes and shared-tag clustering forces to the graph engine.

**Architecture:** A bundled TSK dataset (converted from OpenBible.info cross-references) powers automatic `cross_reference` edges (weight 0.5) between scripture nodes already in the user's graph. A custom d3 force function nudges notes sharing tags toward each other without visible tag nodes or edges.

**Tech Stack:** TypeScript, d3-force (existing), Node.js script for TSK data conversion

**Spec:** `docs/superpowers/specs/2026-05-03-graph-phase2-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `scripts/build-tsk-data.ts` | One-time build script: downloads OpenBible.info cross-refs TSV, converts to canonical ID lookup JSON |
| `src/notepad/graph/tsk-data.json` | Bundled TSK lookup: `{ "gen-1-1": ["prov-8-22", "zech-12-1", ...], ... }` |
| `src/notepad/graph/cross-reference.ts` | Logic to check TSK and create cross-reference edges for a scripture node |
| `src/notepad/graph/force-shared-tags.ts` | Custom d3 force function for tag-based note clustering |

### Modified Files

| File | Change |
|------|--------|
| `src/notepad/graph/types.ts` | Add `'cross_reference'` to edge type union, add `tags: string[]` to `GraphNode` |
| `src/notepad/graph/use-graph.ts` | Call cross-reference logic after scripture node creation, pass `tags` to GraphNode |
| `src/components/sections/notepad/GraphPane.tsx` | Add `tags` to `SimNode`, add shared-tag force to simulation, update `SimLink.edgeType` union |

---

## Task 1: Update Graph Types

**Files:**
- Modify: `src/notepad/graph/types.ts`

- [ ] **Step 1: Add `cross_reference` to edge type and `tags` to GraphNode**

In `src/notepad/graph/types.ts`, change the `GraphEdge.type` field and add `tags` to `GraphNode`:

```typescript
// Change line 16 from:
type: 'explicit' | 'scripture_reference';
// To:
type: 'explicit' | 'scripture_reference' | 'cross_reference';
```

```typescript
// Add tags field to GraphNode, after the weight field (line 25):
tags: string[];
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

This will produce errors in files that construct `GraphNode` without `tags` — that's expected and will be fixed in later tasks.

- [ ] **Step 3: Fix use-graph.ts to include tags**

In `src/notepad/graph/use-graph.ts`, update the two places where `GraphNode` objects are constructed:

At line 70-75 (note nodes), add `tags: note.tags`:
```typescript
    const nodes: GraphNode[] = notes.map((note) => ({
      id: note.id,
      type: note.type,
      title: note.title,
      weight: weights.get(note.id) ?? 0,
      tags: note.tags,
    }));
```

At line 79-84 (scripture nodes), add `tags: []`:
```typescript
        nodes.push({
          id: sn.id,
          type: 'scripture',
          title: `${sn.book} ${sn.chapter}:${sn.verseStart}${sn.verseEnd ? `-${sn.verseEnd}` : ''}`,
          weight: weights.get(sn.id) ?? 0,
          tags: [],
        });
```

- [ ] **Step 4: Fix GraphPane.tsx SimNode and SimLink types**

In `src/components/sections/notepad/GraphPane.tsx`:

Update `SimNode` interface (line 14-20) to add `tags`:
```typescript
interface SimNode extends SimulationNodeDatum {
  id: string;
  type: 'devotion' | 'sermon' | 'theme' | 'scripture';
  title: string;
  weight: number;
  radius: number;
  tags: string[];
}
```

Update `SimLink` interface (line 22-25) to add `cross_reference`:
```typescript
interface SimLink extends SimulationLinkDatum<SimNode> {
  edgeType: 'explicit' | 'scripture_reference' | 'cross_reference';
  weight: number;
}
```

Update the `simNodes` construction (~line 192) to include `tags`:
```typescript
    const simNodes: SimNode[] = filtered.map((n) => {
      const prev = prevPos.get(n.id);
      return {
        id: n.id, type: n.type, title: n.title, weight: n.weight,
        radius: computeRadius(n.type, n.weight),
        tags: n.tags,
        x: prev?.x, y: prev?.y,
      };
    });
```

- [ ] **Step 5: Update edge-parser.ts ParsedEdge type**

In `src/notepad/graph/edge-parser.ts`, update the `ParsedEdge` interface (line 4-7):
```typescript
interface ParsedEdge {
  target: string;
  type: 'explicit' | 'scripture_reference' | 'cross_reference';
  weight: number;
}
```

- [ ] **Step 6: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 7: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/types.ts src/notepad/graph/use-graph.ts src/notepad/graph/edge-parser.ts src/components/sections/notepad/GraphPane.tsx && git commit -m "feat(graph): add cross_reference edge type and tags field to GraphNode"
```

---

## Task 2: Build TSK Data Conversion Script and Generate Data File

**Files:**
- Create: `scripts/build-tsk-data.ts`
- Create: `src/notepad/graph/tsk-data.json`

This task downloads the OpenBible.info cross-reference TSV file, converts verse references to the canonical ID format used by `edge-parser.ts`, and outputs a JSON lookup file.

- [ ] **Step 1: Create `scripts/build-tsk-data.ts`**

```typescript
/**
 * One-time build script: converts OpenBible.info cross-references TSV
 * to a JSON lookup keyed by canonical scripture ID.
 *
 * Usage: npx tsx scripts/build-tsk-data.ts
 *
 * Input: downloads cross_references.txt from GitHub (scrollmapper/bible_databases)
 * Output: src/notepad/graph/tsk-data.json
 */

const BOOK_MAP: Record<string, string> = {
  'Gen': 'gen', 'Exod': 'ex', 'Lev': 'lev', 'Num': 'num', 'Deut': 'dt',
  'Josh': 'jos', 'Judg': 'jdg', 'Ruth': 'ruth',
  '1Sam': '1sa', '2Sam': '2sa', '1Kgs': '1ki', '2Kgs': '2ki',
  '1Chr': '1ch', '2Chr': '2ch', 'Ezra': 'ezra', 'Neh': 'neh', 'Esth': 'est',
  'Job': 'job', 'Ps': 'ps', 'Prov': 'pr', 'Eccl': 'ecc',
  'Song': 'ss', 'Isa': 'isa', 'Jer': 'jer', 'Lam': 'lam',
  'Ezek': 'eze', 'Dan': 'da', 'Hos': 'hos', 'Joel': 'joe',
  'Amos': 'amos', 'Obad': 'ob', 'Jonah': 'jon', 'Mic': 'mic',
  'Nah': 'nah', 'Hab': 'hab', 'Zeph': 'zep', 'Hag': 'hag',
  'Zech': 'zec', 'Mal': 'mal',
  'Matt': 'mt', 'Mark': 'mk', 'Luke': 'lk', 'John': 'jn',
  'Acts': 'acts', 'Rom': 'ro', '1Cor': '1co', '2Cor': '2co',
  'Gal': 'gal', 'Eph': 'eph', 'Phil': 'phil', 'Col': 'col',
  '1Thess': '1th', '2Thess': '2th', '1Tim': '1ti', '2Tim': '2ti',
  'Titus': 'tit', 'Phlm': 'phm', 'Heb': 'heb', 'Jas': 'jas',
  '1Pet': '1pe', '2Pet': '2pe', '1John': '1jn', '2John': '2jn', '3John': '3jn',
  'Jude': 'jude', 'Rev': 're',
};

function openBibleRefToCanonicalId(ref: string): string | null {
  // Format: "Gen.1.1" or "Prov.8.22"
  const parts = ref.split('.');
  if (parts.length < 3) return null;
  const book = parts[0];
  const chapter = parts[1];
  const verse = parts[2];
  const abbrev = BOOK_MAP[book];
  if (!abbrev) return null;
  return `${abbrev}-${chapter}-${verse}`;
}

async function main() {
  const url = 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/sources/extras/cross_references.txt';
  console.log('Downloading cross-references from OpenBible.info...');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  const text = await response.text();

  const lines = text.split('\n');
  const lookup: Record<string, string[]> = {};

  let processed = 0;
  let skipped = 0;

  for (const line of lines) {
    if (line.startsWith('From Verse') || line.startsWith('#') || !line.trim()) continue;

    const parts = line.split('\t');
    if (parts.length < 2) continue;

    const fromRef = parts[0].trim();
    const toRef = parts[1].trim();

    // Handle ranges: "Prov.8.22-Prov.8.30" -> just use start verse
    const fromClean = fromRef.includes('-') ? fromRef.split('-')[0] : fromRef;
    const toClean = toRef.includes('-') ? toRef.split('-')[0] : toRef;

    const fromId = openBibleRefToCanonicalId(fromClean);
    const toId = openBibleRefToCanonicalId(toClean);

    if (!fromId || !toId) {
      skipped++;
      continue;
    }

    if (!lookup[fromId]) lookup[fromId] = [];
    if (!lookup[fromId].includes(toId)) {
      lookup[fromId].push(toId);
    }

    processed++;
  }

  const outputPath = new URL('../src/notepad/graph/tsk-data.json', import.meta.url);
  const fs = await import('fs');
  fs.writeFileSync(new URL(outputPath), JSON.stringify(lookup));

  console.log(`Done! Processed ${processed} cross-references, skipped ${skipped}.`);
  console.log(`Output: src/notepad/graph/tsk-data.json`);
  console.log(`Unique source verses: ${Object.keys(lookup).length}`);
  console.log(`File size: ${(fs.statSync(new URL(outputPath)).size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(console.error);
```

- [ ] **Step 2: Install tsx for running TypeScript scripts**

```bash
cd /Users/newmac/Downloads/Psalms_app && npm install -D tsx
```

- [ ] **Step 3: Run the build script to generate the TSK data file**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsx scripts/build-tsk-data.ts
```

Expected output: A success message showing ~340,000+ cross-references processed and `src/notepad/graph/tsk-data.json` created.

- [ ] **Step 4: Verify the output file exists and looks correct**

```bash
cd /Users/newmac/Downloads/Psalms_app && ls -lh src/notepad/graph/tsk-data.json && node -e "const d = require('./src/notepad/graph/tsk-data.json'); console.log('Keys:', Object.keys(d).length); console.log('Sample:', JSON.stringify(d['rom-8-28']?.slice(0,5)))"
```

Expected: File exists (2-5MB), has thousands of keys, and `rom-8-28` has an array of cross-referenced verse IDs.

- [ ] **Step 5: Verify the BOOK_MAP abbreviations match edge-parser.ts**

The abbreviations in `BOOK_MAP` must produce the same canonical IDs as `toCanonicalScriptureId()` in `edge-parser.ts`. Spot-check a few:

```bash
cd /Users/newmac/Downloads/Psalms_app && node -e "const d = require('./src/notepad/graph/tsk-data.json'); console.log('gen-1-1:', d['gen-1-1']?.length, 'refs'); console.log('ps-23-1:', d['ps-23-1']?.length, 'refs'); console.log('jn-3-16:', d['jn-3-16']?.length, 'refs'); console.log('ro-8-28:', d['ro-8-28']?.length, 'refs');"
```

If any return `undefined`, the BOOK_MAP abbreviation for that book doesn't match what `edge-parser.ts` generates. Fix the mapping and re-run.

**Important:** The `edge-parser.ts` BOOK_ABBREVS map derives abbreviations from `BOOK_PATTERNS` by taking the shortest name. Cross-check that the BOOK_MAP values match. For example, if edge-parser produces `ro` for Romans but BOOK_MAP produces `rom`, that's a mismatch. Adjust BOOK_MAP to match.

- [ ] **Step 6: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add scripts/build-tsk-data.ts src/notepad/graph/tsk-data.json && git commit -m "feat(graph): add TSK cross-reference data (OpenBible.info, ~340k entries)"
```

---

## Task 3: Cross-Reference Edge Logic

**Files:**
- Create: `src/notepad/graph/cross-reference.ts`

- [ ] **Step 1: Create `src/notepad/graph/cross-reference.ts`**

```typescript
import { getAllScriptureNodes } from './scripture-store';
import { createEdge } from './edge-store';

let tskData: Record<string, string[]> | null = null;

/**
 * Lazily loads the TSK data on first use.
 */
async function loadTskData(): Promise<Record<string, string[]>> {
  if (tskData) return tskData;
  const module = await import('./tsk-data.json');
  tskData = module.default as Record<string, string[]>;
  return tskData;
}

/**
 * Strips the "scripture:" prefix from a canonical scripture ID.
 * e.g., "scripture:rom-8-28" -> "rom-8-28"
 */
function stripPrefix(id: string): string {
  return id.startsWith('scripture:') ? id.slice('scripture:'.length) : id;
}

/**
 * Creates cross-reference edges between a newly created scripture node
 * and any existing scripture nodes that share TSK cross-references.
 *
 * Checks both directions:
 * 1. New verse's cross-refs -> existing scripture nodes
 * 2. Existing scripture nodes' cross-refs -> new verse
 */
export async function createCrossReferenceEdges(newScriptureId: string): Promise<void> {
  const tsk = await loadTskData();
  const existingNodes = getAllScriptureNodes();
  const existingIds = new Set(existingNodes.map((n) => n.id));

  const newKey = stripPrefix(newScriptureId);

  // 1. Check new verse's cross-references against existing nodes
  const newCrossRefs = tsk[newKey] ?? [];
  for (const crossRef of newCrossRefs) {
    const targetId = `scripture:${crossRef}`;
    if (existingIds.has(targetId) && targetId !== newScriptureId) {
      createEdge({
        source: newScriptureId,
        target: targetId,
        type: 'cross_reference',
        weight: 0.5,
      });
    }
  }

  // 2. Check existing nodes' cross-references for the new verse
  for (const existing of existingNodes) {
    if (existing.id === newScriptureId) continue;
    const existingKey = stripPrefix(existing.id);
    const existingCrossRefs = tsk[existingKey] ?? [];
    if (existingCrossRefs.includes(newKey)) {
      createEdge({
        source: existing.id,
        target: newScriptureId,
        type: 'cross_reference',
        weight: 0.5,
      });
    }
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/cross-reference.ts && git commit -m "feat(graph): add cross-reference edge creation logic with lazy TSK loading"
```

---

## Task 4: Wire Cross-References into useGraph

**Files:**
- Modify: `src/notepad/graph/use-graph.ts`

- [ ] **Step 1: Add import**

Add after the existing imports at the top of `src/notepad/graph/use-graph.ts`:

```typescript
import { createCrossReferenceEdges } from './cross-reference';
```

- [ ] **Step 2: Call cross-reference logic after scripture node creation**

In the `syncNoteEdges` function, after the scripture node is created (after the `createScriptureNode(...)` call at ~line 34-43), add a call to create cross-reference edges:

Change the block inside `if (!scriptureNodeExists(ref.id))` from:

```typescript
    if (!scriptureNodeExists(ref.id)) {
      const parsed = parseVerseRef(ref.ref);
      if (parsed) {
        let text = '';
        try {
          const result = await fetchVerseText(ref.ref);
          if (result) text = result.text;
        } catch {
          // Bible API unavailable — node created with empty text
        }
        createScriptureNode({
          id: ref.id,
          book: parsed.book,
          chapter: parsed.chapter,
          verseStart: parsed.verseStart,
          verseEnd: parsed.verseEnd,
          translation: 'WEB',
          text,
        });
      }
    }
```

To:

```typescript
    if (!scriptureNodeExists(ref.id)) {
      const parsed = parseVerseRef(ref.ref);
      if (parsed) {
        let text = '';
        try {
          const result = await fetchVerseText(ref.ref);
          if (result) text = result.text;
        } catch {
          // Bible API unavailable — node created with empty text
        }
        createScriptureNode({
          id: ref.id,
          book: parsed.book,
          chapter: parsed.chapter,
          verseStart: parsed.verseStart,
          verseEnd: parsed.verseEnd,
          translation: 'WEB',
          text,
        });
        await createCrossReferenceEdges(ref.id);
      }
    }
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/use-graph.ts && git commit -m "feat(graph): wire TSK cross-reference edges into scripture node creation"
```

---

## Task 5: Shared Tag Force Function

**Files:**
- Create: `src/notepad/graph/force-shared-tags.ts`

- [ ] **Step 1: Create `src/notepad/graph/force-shared-tags.ts`**

```typescript
import type { SimulationNodeDatum } from 'd3-force';

interface TaggedNode extends SimulationNodeDatum {
  tags: string[];
}

/**
 * Custom d3 force that attracts nodes sharing tags toward each other.
 * No visible edges or tag nodes — just a gentle positional nudge.
 *
 * Strength scales with the number of shared tags between a pair.
 */
export function forceSharedTags<N extends TaggedNode>(strength: number = 0.0003) {
  let nodes: N[] = [];

  function force(alpha: number) {
    // Build tag -> node index map
    const tagMap = new Map<string, number[]>();
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      for (const tag of node.tags) {
        if (!tagMap.has(tag)) tagMap.set(tag, []);
        tagMap.get(tag)!.push(i);
      }
    }

    // For each tag group, attract pairs
    for (const indices of tagMap.values()) {
      if (indices.length < 2) continue;
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          const a = nodes[indices[i]];
          const b = nodes[indices[j]];
          if (a.x == null || a.y == null || b.x == null || b.y == null) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const f = strength * alpha;

          a.vx = (a.vx ?? 0) + dx * f;
          a.vy = (a.vy ?? 0) + dy * f;
          b.vx = (b.vx ?? 0) - dx * f;
          b.vy = (b.vy ?? 0) - dy * f;
        }
      }
    }
  }

  force.initialize = function (_nodes: N[]) {
    nodes = _nodes;
  };

  force.strength = function (s: number) {
    strength = s;
    return force;
  };

  return force;
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/force-shared-tags.ts && git commit -m "feat(graph): add custom d3 force for shared-tag note clustering"
```

---

## Task 6: Add Shared Tag Force to GraphPane

**Files:**
- Modify: `src/components/sections/notepad/GraphPane.tsx`

- [ ] **Step 1: Import the force function**

Add after the d3-force imports at the top of `GraphPane.tsx`:

```typescript
import { forceSharedTags } from '@/notepad/graph/force-shared-tags';
```

- [ ] **Step 2: Add the force to the simulation**

In the simulation setup effect, add the shared-tag force after the existing forces. Find the simulation creation block (~line 220-237) and add `.force('tags', forceSharedTags<SimNode>(0.0003))` after the collide force:

Change from:
```typescript
      .force('collide', forceCollide<SimNode>().radius((d) => d.radius + 2))
      .alphaDecay(0.02)
```

To:
```typescript
      .force('collide', forceCollide<SimNode>().radius((d) => d.radius + 2))
      .force('tags', forceSharedTags<SimNode>(0.0003))
      .alphaDecay(0.02)
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/components/sections/notepad/GraphPane.tsx && git commit -m "feat(graph): add shared-tag clustering force to graph simulation"
```

---

## Task 7: Integration Verification

Manual verification — open the app and confirm both new features work.

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/newmac/Downloads/Psalms_app && npm run dev
```

- [ ] **Step 2: Test cross-reference edges**

1. Open the Notepad and create a devotion note.
2. Type "Romans 8:28" — a scripture node should appear.
3. Type "Genesis 50:20" in the same or another note — another scripture node should appear.
4. If Romans 8:28 and Genesis 50:20 are cross-referenced in the TSK data, a thinner edge (weight 0.5) should connect the two scripture nodes directly.
5. Expand the graph to see the edges clearly.

- [ ] **Step 3: Test shared tag clustering**

1. Create two devotion notes.
2. In both notes, add the tag `#trust` (type `#trust` in the content).
3. Save both notes (wait for debounce).
4. In the graph, the two devotion nodes should be gently pulled toward each other compared to untagged notes.
5. Add a third note without the `#trust` tag — it should not cluster with the other two.

- [ ] **Step 4: Test filter toggles still work**

Toggle each node type filter on/off and verify nodes appear/disappear correctly.

- [ ] **Step 5: Fix any issues found and commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add -A && git commit -m "fix(graph): address Phase 2 integration issues"
```

Only commit if fixes were needed.
