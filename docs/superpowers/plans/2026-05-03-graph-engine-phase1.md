# FaithGraph Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static graph mockup with a live, force-directed knowledge graph powered by real note data — supporting explicit `[[links]]` and auto-detected scripture references.

**Architecture:** New `src/notepad/graph/` module contains the graph engine (types, edge parser, adjacency list, stores). A `useGraph` hook bridges the engine to React. `GraphPane.tsx` is fully rewritten as a Canvas 2D renderer with d3-force physics. The existing `NotepadProvider` exposes graph state on its context.

**Tech Stack:** React 19, TypeScript, d3-force (new dep), Canvas 2D API, localStorage

**Spec:** `docs/superpowers/specs/2026-05-03-graph-engine-phase1-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/notepad/graph/types.ts` | `ScriptureNode`, `GraphEdge`, `GraphNode`, `AdjacencyList` types |
| `src/notepad/graph/scripture-store.ts` | CRUD for `ScriptureNode` in `notepad_scripture_nodes` localStorage |
| `src/notepad/graph/edge-store.ts` | CRUD for `GraphEdge` in `notepad_graph_edges` localStorage |
| `src/notepad/graph/edge-parser.ts` | Extract edges from TipTap JSON content (note links + verse refs) |
| `src/notepad/graph/adjacency-list.ts` | Build/update adjacency list, compute node weights |
| `src/notepad/graph/use-graph.ts` | React hook: subscribes to notes, manages graph state |

### Modified Files

| File | Change |
|------|--------|
| `src/notepad/types.ts` | Re-export graph types |
| `src/notepad/context/NotepadProvider.tsx` | Add graph state to context value |
| `src/components/sections/notepad/GraphPane.tsx` | Full rewrite: Canvas 2D + d3-force |

---

## Task 1: Install d3-force

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install d3-force and its type definitions**

```bash
cd /Users/newmac/Downloads/Psalms_app && npm install d3-force && npm install -D @types/d3-force
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/newmac/Downloads/Psalms_app && ls node_modules/d3-force/package.json && echo "d3-force installed"
```

Expected: `d3-force installed`

- [ ] **Step 3: Verify build still passes**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add package.json package-lock.json && git commit -m "chore: add d3-force dependency for graph engine"
```

---

## Task 2: Graph Types

**Files:**
- Create: `src/notepad/graph/types.ts`
- Modify: `src/notepad/types.ts`

- [ ] **Step 1: Create `src/notepad/graph/types.ts`**

```typescript
export interface ScriptureNode {
  id: string;              // canonical: "scripture:rom-8-28"
  book: string;            // "Romans"
  chapter: number;
  verseStart: number;
  verseEnd: number | null;
  translation: string;     // default "ESV"
  text: string;
  createdAt: string;
}

export interface GraphEdge {
  id: string;
  source: string;          // node ID (Note.id or ScriptureNode.id)
  target: string;
  type: 'explicit' | 'scripture_reference';
  weight: number;          // 1.0 for explicit, 0.9 for scripture_reference
  createdAt: string;
}

export interface GraphNode {
  id: string;
  type: 'devotion' | 'sermon' | 'theme' | 'scripture';
  title: string;
  weight: number;          // sum of connected edge weights
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export type AdjacencyList = Map<string, {
  outgoing: GraphEdge[];
  incoming: GraphEdge[];
}>;
```

- [ ] **Step 2: Re-export from `src/notepad/types.ts`**

Add this line at the end of `src/notepad/types.ts`:

```typescript
export type { ScriptureNode, GraphEdge, GraphNode, AdjacencyList } from './graph/types';
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/types.ts src/notepad/types.ts && git commit -m "feat(graph): add ScriptureNode, GraphEdge, GraphNode, and AdjacencyList types"
```

---

## Task 3: Scripture Store

**Files:**
- Create: `src/notepad/graph/scripture-store.ts`

- [ ] **Step 1: Create `src/notepad/graph/scripture-store.ts`**

```typescript
import type { ScriptureNode } from './types';

const STORAGE_KEY = 'notepad_scripture_nodes';

function read(): ScriptureNode[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function write(nodes: ScriptureNode[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
}

export function getAllScriptureNodes(): ScriptureNode[] {
  return read();
}

export function getScriptureNode(id: string): ScriptureNode | null {
  return read().find((n) => n.id === id) ?? null;
}

export function scriptureNodeExists(id: string): boolean {
  return read().some((n) => n.id === id);
}

export function createScriptureNode(node: Omit<ScriptureNode, 'createdAt'>): ScriptureNode {
  const nodes = read();
  if (nodes.some((n) => n.id === node.id)) return nodes.find((n) => n.id === node.id)!;
  const created: ScriptureNode = { ...node, createdAt: new Date().toISOString() };
  nodes.push(created);
  write(nodes);
  return created;
}

export function deleteScriptureNode(id: string): void {
  write(read().filter((n) => n.id !== id));
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/scripture-store.ts && git commit -m "feat(graph): add scripture node localStorage store"
```

---

## Task 4: Edge Store

**Files:**
- Create: `src/notepad/graph/edge-store.ts`

- [ ] **Step 1: Create `src/notepad/graph/edge-store.ts`**

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { GraphEdge } from './types';

const STORAGE_KEY = 'notepad_graph_edges';

function read(): GraphEdge[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function write(edges: GraphEdge[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(edges));
}

export function getAllEdges(): GraphEdge[] {
  return read();
}

export function getEdgesBySource(nodeId: string): GraphEdge[] {
  return read().filter((e) => e.source === nodeId);
}

export function getEdgesByTarget(nodeId: string): GraphEdge[] {
  return read().filter((e) => e.target === nodeId);
}

export function createEdge(edge: Omit<GraphEdge, 'id' | 'createdAt'>): GraphEdge {
  const edges = read();
  const existing = edges.find(
    (e) => e.source === edge.source && e.target === edge.target && e.type === edge.type
  );
  if (existing) return existing;

  const created: GraphEdge = { ...edge, id: uuidv4(), createdAt: new Date().toISOString() };
  edges.push(created);
  write(edges);
  return created;
}

export function deleteEdgesBySource(nodeId: string): void {
  write(read().filter((e) => e.source !== nodeId));
}

export function deleteEdge(id: string): void {
  write(read().filter((e) => e.id !== id));
}

export function deleteEdgesForNode(nodeId: string): void {
  write(read().filter((e) => e.source !== nodeId && e.target !== nodeId));
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/edge-store.ts && git commit -m "feat(graph): add graph edge localStorage store"
```

---

## Task 5: Edge Parser

**Files:**
- Create: `src/notepad/graph/edge-parser.ts`

This module parses TipTap JSON content and extracts edges. It reuses the existing `VERSE_REGEX` from `bible-verse-utils.ts` and reads `noteLink` marks from the TipTap document tree.

- [ ] **Step 1: Create `src/notepad/graph/edge-parser.ts`**

```typescript
import { VERSE_REGEX, BOOK_PATTERNS } from '../extensions/bible-verse-utils';

interface ParsedEdge {
  target: string;
  type: 'explicit' | 'scripture_reference';
  weight: number;
}

/**
 * Short abbreviation map for canonical scripture IDs.
 * Maps normalized book names (lowercase, no spaces/dots) to their shortest abbreviation.
 */
const BOOK_ABBREVS: Map<string, string> = new Map();
for (const pattern of BOOK_PATTERNS) {
  const names = pattern.split('|');
  const shortest = names.reduce((a, b) => (a.length <= b.length ? a : b));
  const abbrev = shortest.toLowerCase().replace(/[\s.]/g, '');
  for (const name of names) {
    BOOK_ABBREVS.set(name.toLowerCase().replace(/[\s.]/g, ''), abbrev);
  }
}

/**
 * Converts a verse reference string like "Romans 8:28" or "1 Pet 5:7"
 * to a canonical scripture ID like "scripture:rom-8-28" or "scripture:1pe-5-7".
 */
export function toCanonicalScriptureId(ref: string): string {
  const trimmed = ref.trim();
  const match = trimmed.match(/^(.+?)\s+(\d{1,3}):(\d{1,3})(?:\s*[-\u2013]\s*(\d{1,3}))?$/);
  if (!match) return `scripture:unknown`;

  const bookRaw = match[1];
  const chapter = match[2];
  const verseStart = match[3];

  const bookKey = bookRaw.toLowerCase().replace(/[\s.]/g, '');
  const abbrev = BOOK_ABBREVS.get(bookKey) ?? bookKey;

  return `scripture:${abbrev}-${chapter}-${verseStart}`;
}

/**
 * Extracts the book, chapter, and verse info from a reference string.
 */
export function parseVerseRef(ref: string): {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number | null;
} | null {
  const match = ref.trim().match(/^(.+?)\s+(\d{1,3}):(\d{1,3})(?:\s*[-\u2013]\s*(\d{1,3}))?$/);
  if (!match) return null;

  const bookKey = match[1].toLowerCase().replace(/[\s.]/g, '');
  let canonicalBook = match[1];
  for (const pattern of BOOK_PATTERNS) {
    const names = pattern.split('|');
    for (const name of names) {
      if (name.toLowerCase().replace(/[\s.]/g, '') === bookKey) {
        canonicalBook = names[0];
        break;
      }
    }
  }

  return {
    book: canonicalBook,
    chapter: parseInt(match[2], 10),
    verseStart: parseInt(match[3], 10),
    verseEnd: match[4] ? parseInt(match[4], 10) : null,
  };
}

/**
 * Walks a TipTap JSON document tree and extracts plain text.
 */
function extractPlainText(doc: unknown): string {
  const parts: string[] = [];
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n.type === 'text' && typeof n.text === 'string') {
      parts.push(n.text);
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }
  walk(doc);
  return parts.join(' ');
}

/**
 * Walks a TipTap JSON document tree and extracts all noteLink mark targets.
 */
function extractNoteLinks(doc: unknown): Array<{ noteId: string }> {
  const links: Array<{ noteId: string }> = [];
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n.type === 'text' && Array.isArray(n.marks)) {
      for (const mark of n.marks) {
        const m = mark as Record<string, unknown>;
        if (m.type === 'noteLink') {
          const attrs = m.attrs as Record<string, unknown> | undefined;
          if (attrs?.noteId && typeof attrs.noteId === 'string') {
            links.push({ noteId: attrs.noteId });
          }
        }
      }
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }
  walk(doc);
  return links;
}

/**
 * Parses a note's TipTap JSON content and returns all edges originating from it.
 * Also returns scripture references that may need ScriptureNode creation.
 */
export function parseEdgesFromContent(
  noteId: string,
  content: string
): { edges: ParsedEdge[]; scriptureRefs: Array<{ id: string; ref: string }> } {
  if (!content) return { edges: [], scriptureRefs: [] };

  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch {
    return { edges: [], scriptureRefs: [] };
  }

  const edges: ParsedEdge[] = [];
  const scriptureRefs: Array<{ id: string; ref: string }> = [];
  const seen = new Set<string>();

  // 1. Extract explicit [[noteLink]] edges
  const noteLinks = extractNoteLinks(doc);
  for (const link of noteLinks) {
    const key = `explicit:${link.noteId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ target: link.noteId, type: 'explicit', weight: 1.0 });
  }

  // 2. Extract auto-detected scripture reference edges
  const plainText = extractPlainText(doc);
  const verseRegex = new RegExp(VERSE_REGEX.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = verseRegex.exec(plainText)) !== null) {
    const ref = match[0];
    const scriptureId = toCanonicalScriptureId(ref);
    const key = `scripture_reference:${scriptureId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ target: scriptureId, type: 'scripture_reference', weight: 0.9 });
    scriptureRefs.push({ id: scriptureId, ref });
  }

  return { edges, scriptureRefs };
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/edge-parser.ts && git commit -m "feat(graph): add edge parser for note links and scripture references"
```

---

## Task 6: Adjacency List Builder

**Files:**
- Create: `src/notepad/graph/adjacency-list.ts`

- [ ] **Step 1: Create `src/notepad/graph/adjacency-list.ts`**

```typescript
import type { GraphEdge, AdjacencyList } from './types';

/**
 * Builds a complete adjacency list from a flat array of edges.
 */
export function buildAdjacencyList(edges: GraphEdge[]): AdjacencyList {
  const list: AdjacencyList = new Map();

  function ensureNode(id: string) {
    if (!list.has(id)) {
      list.set(id, { outgoing: [], incoming: [] });
    }
  }

  for (const edge of edges) {
    ensureNode(edge.source);
    ensureNode(edge.target);
    list.get(edge.source)!.outgoing.push(edge);
    list.get(edge.target)!.incoming.push(edge);
  }

  return list;
}

/**
 * Computes a weight for each node based on the sum of all connected edge weights.
 */
export function computeNodeWeights(list: AdjacencyList): Map<string, number> {
  const weights = new Map<string, number>();

  for (const [id, entry] of list) {
    let total = 0;
    for (const edge of entry.outgoing) total += edge.weight;
    for (const edge of entry.incoming) total += edge.weight;
    weights.set(id, total);
  }

  return weights;
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/adjacency-list.ts && git commit -m "feat(graph): add adjacency list builder with weight computation"
```

---

## Task 7: useGraph Hook

**Files:**
- Create: `src/notepad/graph/use-graph.ts`

- [ ] **Step 1: Create `src/notepad/graph/use-graph.ts`**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import type { Note } from '../types';
import type { GraphNode, GraphEdge } from './types';
import { parseEdgesFromContent, parseVerseRef } from './edge-parser';
import { getAllEdges, createEdge, deleteEdgesBySource, deleteEdgesForNode } from './edge-store';
import { getAllScriptureNodes, createScriptureNode, scriptureNodeExists } from './scripture-store';
import { buildAdjacencyList, computeNodeWeights } from './adjacency-list';
import { fetchVerseText } from '../extensions/bible-verse-utils';

export interface UseGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  activeNodeId: string | null;
  isLoading: boolean;
  rebuildGraph: () => void;
}

/**
 * Syncs edges for a single note: parses content, removes old edges,
 * creates scripture nodes and new edges as needed.
 */
async function syncNoteEdges(note: Note): Promise<void> {
  const { edges: parsedEdges, scriptureRefs } = parseEdgesFromContent(note.id, note.content);

  // Remove all existing edges from this note and recreate
  deleteEdgesBySource(note.id);

  // Create scripture nodes for any new verse references
  for (const ref of scriptureRefs) {
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
  }

  // Create edges
  for (const edge of parsedEdges) {
    createEdge({
      source: note.id,
      target: edge.target,
      type: edge.type,
      weight: edge.weight,
    });
  }
}

export function useGraph(notes: Note[], activeNoteId: string | null): UseGraphResult {
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const prevContentsRef = useRef<Map<string, string>>(new Map());
  const initializedRef = useRef(false);

  const buildFullGraph = useCallback(() => {
    const allEdges = getAllEdges();
    const scriptureNodes = getAllScriptureNodes();
    const adjacency = buildAdjacencyList(allEdges);
    const weights = computeNodeWeights(adjacency);

    const nodes: GraphNode[] = notes.map((note) => ({
      id: note.id,
      type: note.type,
      title: note.title,
      weight: weights.get(note.id) ?? 0,
    }));

    for (const sn of scriptureNodes) {
      if (adjacency.has(sn.id)) {
        nodes.push({
          id: sn.id,
          type: 'scripture',
          title: `${sn.book} ${sn.chapter}:${sn.verseStart}${sn.verseEnd ? `-${sn.verseEnd}` : ''}`,
          weight: weights.get(sn.id) ?? 0,
        });
      }
    }

    setGraphNodes(nodes);
    setGraphEdges(allEdges);
    setIsLoading(false);
  }, [notes]);

  // Full rebuild on first load with notes
  useEffect(() => {
    if (initializedRef.current || notes.length === 0) {
      if (notes.length === 0) setIsLoading(false);
      return;
    }
    initializedRef.current = true;

    async function initialBuild() {
      setIsLoading(true);
      for (const note of notes) {
        await syncNoteEdges(note);
      }
      // Snapshot current contents
      const map = new Map<string, string>();
      for (const note of notes) map.set(note.id, note.content);
      prevContentsRef.current = map;
      buildFullGraph();
    }

    initialBuild();
  }, [notes, buildFullGraph]);

  // Incremental updates when notes change after initialization
  useEffect(() => {
    if (!initializedRef.current || isLoading) return;

    const currentIds = new Set(notes.map((n) => n.id));

    // Find changed notes
    const changedNotes: Note[] = [];
    for (const note of notes) {
      const prev = prevContentsRef.current.get(note.id);
      if (prev !== note.content) {
        changedNotes.push(note);
      }
    }

    // Find deleted notes
    const deletedIds: string[] = [];
    for (const prevId of prevContentsRef.current.keys()) {
      if (!currentIds.has(prevId)) {
        deletedIds.push(prevId);
      }
    }

    // Update snapshot
    const map = new Map<string, string>();
    for (const note of notes) map.set(note.id, note.content);
    prevContentsRef.current = map;

    if (changedNotes.length === 0 && deletedIds.length === 0) return;

    async function syncChanges() {
      for (const id of deletedIds) {
        deleteEdgesForNode(id);
      }
      for (const note of changedNotes) {
        await syncNoteEdges(note);
      }
      buildFullGraph();
    }

    syncChanges();
  }, [notes, isLoading, buildFullGraph]);

  return {
    nodes: graphNodes,
    edges: graphEdges,
    activeNodeId,
    isLoading,
    rebuildGraph: buildFullGraph,
  };
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/graph/use-graph.ts && git commit -m "feat(graph): add useGraph hook bridging notepad context to graph engine"
```

---

## Task 8: Wire Graph State into NotepadProvider

**Files:**
- Modify: `src/notepad/context/NotepadProvider.tsx`

- [ ] **Step 1: Add imports**

Add after the existing imports at the top of `src/notepad/context/NotepadProvider.tsx`:

```typescript
import type { GraphNode, GraphEdge } from '../graph/types';
import { useGraph } from '../graph/use-graph';
```

- [ ] **Step 2: Extend NotepadContextValue interface**

Add these fields to the `NotepadContextValue` interface, after `refresh`:

```typescript
  // Graph
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  graphActiveNodeId: string | null;
  graphLoading: boolean;
  rebuildGraph: () => void;
```

- [ ] **Step 3: Instantiate useGraph in the provider**

Inside the `NotepadProvider` function, after the `activeNote` line (line 48), add:

```typescript
  const graph = useGraph(notes, activeNoteId);
```

- [ ] **Step 4: Add graph fields to the value object**

Add these fields to the `value` object, after `refresh`:

```typescript
    graphNodes: graph.nodes,
    graphEdges: graph.edges,
    graphActiveNodeId: graph.activeNodeId,
    graphLoading: graph.isLoading,
    rebuildGraph: graph.rebuildGraph,
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/notepad/context/NotepadProvider.tsx && git commit -m "feat(graph): expose graph state on NotepadProvider context"
```

---

## Task 9: Rewrite GraphPane with Canvas 2D + d3-force

**Files:**
- Modify: `src/components/sections/notepad/GraphPane.tsx` (full rewrite)

This is the largest task. Replace the entire file contents with the Canvas renderer.

- [ ] **Step 1: Rewrite `GraphPane.tsx`**

Replace the entire contents of `src/components/sections/notepad/GraphPane.tsx` with:

```typescript
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
import { BookOpen, Mic, PenLine, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import { useNotepad } from '@/notepad/context/useNotepad';

interface SimNode extends SimulationNodeDatum {
  id: string;
  type: 'devotion' | 'sermon' | 'theme' | 'scripture';
  title: string;
  weight: number;
  radius: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  edgeType: 'explicit' | 'scripture_reference';
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
        const src = typeof link.source === 'object' ? link.source.id : String(link.source);
        const tgt = typeof link.target === 'object' ? link.target.id : String(link.target);
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

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const t = transformRef.current;
    const newScale = Math.min(5, Math.max(0.1, t.scale * factor));
    t.x = mx - (mx - t.x) * (newScale / t.scale);
    t.y = my - (my - t.y) * (newScale / t.scale);
    t.scale = newScale;
    drawCanvas();
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
        {graphLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] tracking-wider" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
              Building graph...
            </span>
          </div>
        ) : graphNodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <p className="text-[11px] tracking-wider text-center" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
              Create notes with [[links]] or Bible verse references to see your knowledge graph.
            </p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ cursor: hoveredNodeId ? 'pointer' : 'grab' }}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
          />
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
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/components/sections/notepad/GraphPane.tsx && git commit -m "feat(graph): rewrite GraphPane with Canvas 2D renderer and d3-force physics"
```

---

## Task 10: Integration Verification

Manual verification — open the app and confirm everything works end-to-end.

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/newmac/Downloads/Psalms_app && npm run dev
```

- [ ] **Step 2: Verify graph renders with existing notes**

Open the app in browser. Navigate to Notepad. If notes with `[[links]]` or verse references exist, nodes and edges should appear in the graph pane. If no notes exist, the empty state message should display.

- [ ] **Step 3: Test creating connections**

1. Create a new devotion note.
2. Type text including "Romans 8:28" — an amber scripture node should appear in the graph after the save debounce.
3. Create a second note and use `[[` to link to the first — an edge should connect them.

- [ ] **Step 4: Test interactions**

1. Hover a node — it and its connections highlight, others dim.
2. Click a note node — editor opens that note.
3. Click-drag empty space — graph pans.
4. Scroll wheel — graph zooms.
5. Toggle type filters — nodes show/hide.
6. Expand/Collapse button works.

- [ ] **Step 5: Verify "Coming Soon" label on Local tab**

The Local tab should be grayed out and disabled with a "Coming Soon" badge.

- [ ] **Step 6: Fix any issues and commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add -A && git commit -m "fix(graph): address integration issues from verification"
```

Only commit if fixes were needed.
