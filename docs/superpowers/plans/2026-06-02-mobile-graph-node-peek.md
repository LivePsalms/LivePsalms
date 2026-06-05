# Mobile Graph Node-Peek Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On mobile, tapping a node in the knowledge graph (inside the "More" sheet) swaps the sheet to a read-only peek view for that node, with actions to open the note in the editor or re-focus the graph.

**Architecture:** `GraphView` gains a tap interceptor and a focus override; `GraphPane` exposes `onNodePeek`/`focusNodeId` props (embedded-only) and uses pointer events for touch. `MobileMoreSheet` holds the peek state, shapes peek data with a pure helper (`buildPeekData`), and renders a presentational `NodePeek`. Desktop behavior is untouched.

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library (jsdom), d3-force canvas graph, Tailwind + inline styles.

**Spec:** `docs/superpowers/specs/2026-06-02-mobile-graph-node-peek-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/notepad/graph/graph-view.ts` | Add `onNodeTap` dep (tap interceptor) + `setFocus()` override | Modify |
| `src/notepad/graph/graph-view.test.ts` | Tests for interception + focus | Modify |
| `src/components/sections/notepad/GraphPane.tsx` | `onNodePeek` + `focusNodeId` props (embedded); pointer/touch wiring | Modify |
| `src/components/sections/notepad/GraphPane.test.tsx` | Tests for peek wiring + focus | Modify |
| `src/components/sections/notepad/mobile/node-peek-data.ts` | Pure helper shaping peek data from notes + graph | Create |
| `src/components/sections/notepad/mobile/node-peek-data.test.ts` | Unit tests for the helper | Create |
| `src/components/sections/notepad/mobile/NodePeek.tsx` | Presentational peek view (note + verse) | Create |
| `src/components/sections/notepad/mobile/NodePeek.test.tsx` | Render + callback tests | Create |
| `src/components/sections/notepad/mobile/MobileMoreSheet.tsx` | Peek state + routing + `onOpenNote` prop | Modify |
| `src/components/sections/notepad/mobile/MobileMoreSheet.test.tsx` | Update + peek-flow tests | Modify |
| `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx` | Pass `onOpenNote={handleOpenNote}` to the sheet | Modify |

Run a single test file with: `npx vitest run <path>`. Full suite: `npx vitest run`. Type-check: `npx tsc --noEmit`.

> **Pre-existing failure (not ours):** `src/notepad-landing/sections/garden-scene/garden-scene.test.tsx` has 1 failing test on a clean tree. Ignore it; do not "fix" it as part of this work.

---

## Task 1: GraphView — tap interceptor (`onNodeTap`)

**Files:**
- Modify: `src/notepad/graph/graph-view.ts`
- Test: `src/notepad/graph/graph-view.test.ts`

- [ ] **Step 1: Write the failing tests**

Append this block to the end of `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — onNodeTap interception', () => {
  type Tap = { id: string; type: GraphNode['type']; title: string };
  function placeNode(view: GraphView, id: string, x: number, y: number) {
    const n = view.getSimNodes().find((s) => s.id === id);
    if (n) { n.x = x; n.y = y; n.fx = x; n.fy = y; }
  }
  function attachedWith(over: Partial<GraphViewDeps>) {
    const { deps, opens } = makeDeps(over);
    const view = new GraphView(deps);
    const canvas = new MockCanvas();
    const container = new MockContainer(400, 400);
    view.attach(canvas as unknown as HTMLCanvasElement, container as unknown as HTMLElement);
    return { view, opens };
  }

  it('routes a note-node tap to onNodeTap and suppresses onNodeOpen', () => {
    const taps: Tap[] = [];
    const { view, opens } = attachedWith({ onNodeTap: (n) => { taps.push(n); return true; } });
    view.setData([node({ id: 'a', type: 'devotion', title: 'A' })], [], null);
    placeNode(view, 'a', 100, 100);
    view.handleMouseDown({ clientX: 100, clientY: 100 });
    view.handleMouseUp({ clientX: 100, clientY: 100 });
    expect(taps).toEqual([{ id: 'a', type: 'devotion', title: 'A' }]);
    expect(opens).toEqual([]);
  });

  it('routes a scripture-node tap to onNodeTap and suppresses the popover', () => {
    const taps: Tap[] = [];
    const { view } = attachedWith({ onNodeTap: (n) => { taps.push(n); return true; } });
    view.setData(
      [node({ id: 'scripture:gen-1-1', type: 'scripture', title: 'Genesis 1:1', scriptureText: 'In the beginning...', scriptureTranslation: 'WEB' })],
      [],
      null,
    );
    placeNode(view, 'scripture:gen-1-1', 100, 100);
    view.handleMouseDown({ clientX: 100, clientY: 100 });
    view.handleMouseUp({ clientX: 100, clientY: 100 });
    expect(taps).toEqual([{ id: 'scripture:gen-1-1', type: 'scripture', title: 'Genesis 1:1' }]);
    expect(view.getSnapshot().popover).toBeNull();
  });

  it('falls back to default behavior when onNodeTap returns false', () => {
    const { view, opens } = attachedWith({ onNodeTap: () => false });
    view.setData([node({ id: 'a', type: 'devotion' })], [], null);
    placeNode(view, 'a', 100, 100);
    view.handleMouseDown({ clientX: 100, clientY: 100 });
    view.handleMouseUp({ clientX: 100, clientY: 100 });
    expect(opens).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/notepad/graph/graph-view.test.ts`
Expected: FAIL — `onNodeTap` is not a known property of `GraphViewDeps` (type error) and the first two tests fail.

- [ ] **Step 3: Add the `onNodeTap` dep to the type**

In `src/notepad/graph/graph-view.ts`, replace the `GraphViewDeps` interface (currently lines ~48-51):

```ts
export interface GraphViewDeps {
  onNodeOpen: (noteId: string) => void;
  devicePixelRatio?: () => number;
  /**
   * Optional tap interceptor. When provided AND it returns true, the view
   * suppresses its default tap behavior (onNodeOpen for note nodes, popover for
   * scripture nodes). Used by the embedded mobile graph to route taps to a peek
   * view. Desktop omits it, so default behavior is preserved.
   */
  onNodeTap?: (node: { id: string; type: GraphNode['type']; title: string }) => boolean;
}
```

(`GraphNode` is already imported at the top: `import type { GraphEdge, GraphNode } from './types';`.)

- [ ] **Step 4: Intercept in `handleMouseUp`**

In `src/notepad/graph/graph-view.ts`, find the `handleMouseUp` body. After the empty-space early return:

```ts
    const node = this.findNodeAt(x, y);
    if (!node) {
      this.setState((prev) => prev.popover === null ? prev : { ...prev, popover: null });
      return;
    }
```

insert this block immediately after (before `if (node.type === 'scripture')`):

```ts
    if (this.deps.onNodeTap) {
      const handled = this.deps.onNodeTap({ id: node.id, type: node.type, title: node.title });
      if (handled) {
        this.setState((prev) => (prev.popover === null ? prev : { ...prev, popover: null }));
        return;
      }
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/notepad/graph/graph-view.test.ts`
Expected: PASS (all GraphView tests, including the 3 new ones).

- [ ] **Step 6: Commit**

```bash
git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts
git commit -m "feat(graph): add onNodeTap interceptor to GraphView"
```

---

## Task 2: GraphView — focus override (`setFocus`)

**Files:**
- Modify: `src/notepad/graph/graph-view.ts`
- Test: `src/notepad/graph/graph-view.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/notepad/graph/graph-view.test.ts`:

```ts
describe('GraphView — setFocus', () => {
  it('local mode centers on the focus id instead of the active id', () => {
    const { view } = attached();
    view.setNeighborhoodFn((id) => new Set([id])); // neighborhood = just the focused node
    view.setData(
      [node({ id: 'a', type: 'devotion' }), node({ id: 'scripture:x', type: 'scripture' })],
      [],
      'a', // activeNodeId = 'a'
    );
    view.setFocus('scripture:x'); // override to the scripture node
    view.setMode('local');
    expect(view.getSimNodes().map((n) => n.id)).toEqual(['scripture:x']);
  });

  it('clearing focus falls back to the active id', () => {
    const { view } = attached();
    view.setNeighborhoodFn((id) => new Set([id]));
    view.setData([node({ id: 'a', type: 'devotion' }), node({ id: 'b', type: 'sermon' })], [], 'a');
    view.setMode('local');
    view.setFocus('b');
    expect(view.getSimNodes().map((n) => n.id)).toEqual(['b']);
    view.setFocus(null);
    expect(view.getSimNodes().map((n) => n.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/notepad/graph/graph-view.test.ts`
Expected: FAIL — `view.setFocus` is not a function (type error + runtime).

- [ ] **Step 3: Add the focus field, method, and helper**

In `src/notepad/graph/graph-view.ts`, add a field next to `private mode` (~line 140):

```ts
  private focusNodeId: string | null = null;
```

Add this method next to `setMode` (after the `setMode` method, ~line 386):

```ts
  /**
   * Overrides the "active" node used for local-mode neighborhood filtering and
   * the active-node highlight ring. Lets the embedded mobile graph center local
   * mode on an arbitrary node — including a scripture node, which never appears
   * as the collection's activeNoteId. Pass null to clear.
   */
  setFocus(id: string | null): void {
    if (this.focusNodeId === id) return;
    this.focusNodeId = id;
    this.rebuild();
  }

  private effectiveActiveId(): string | null {
    return this.focusNodeId ?? this.activeNodeId;
  }
```

- [ ] **Step 4: Use `effectiveActiveId()` in `filterNodes`**

In `filterNodes` (~line 608), replace:

```ts
    if (this.mode === 'local') {
      if (this.activeNodeId && this.getNeighborhoodFn) {
        const neighborhood = this.getNeighborhoodFn(this.activeNodeId, this.settings.depth);
        filtered = filtered.filter((n) => neighborhood.has(n.id));
      } else {
        filtered = [];
      }
    }
```

with:

```ts
    if (this.mode === 'local') {
      const focusId = this.effectiveActiveId();
      if (focusId && this.getNeighborhoodFn) {
        const neighborhood = this.getNeighborhoodFn(focusId, this.settings.depth);
        filtered = filtered.filter((n) => neighborhood.has(n.id));
      } else {
        filtered = [];
      }
    }
```

- [ ] **Step 5: Use `effectiveActiveId()` for the highlight ring in `draw`**

In `draw`, find the `// Nodes` comment and the loop start (~line 289-290):

```ts
    // Nodes
    for (const n of this.simNodes) {
```

Change to compute the active id once:

```ts
    // Nodes
    const activeId = this.effectiveActiveId();
    for (const n of this.simNodes) {
```

Then a few lines below, replace `if (n.id === this.activeNodeId) {` with `if (n.id === activeId) {`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/notepad/graph/graph-view.test.ts`
Expected: PASS (all GraphView tests).

- [ ] **Step 7: Commit**

```bash
git add src/notepad/graph/graph-view.ts src/notepad/graph/graph-view.test.ts
git commit -m "feat(graph): add setFocus override for local-mode centering"
```

---

## Task 3: GraphPane — peek wiring, focus, and pointer/touch input

**Files:**
- Modify: `src/components/sections/notepad/GraphPane.tsx`
- Test: `src/components/sections/notepad/GraphPane.test.tsx`

- [ ] **Step 1: Rewrite the test file's GraphView mock + add wiring tests**

Replace the entire contents of `src/components/sections/notepad/GraphPane.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

afterEach(cleanup);

const spy = vi.hoisted(() => ({
  deps: null as null | { onNodeTap: (n: { id: string; type: string; title: string }) => boolean },
  focusCalls: [] as Array<string | null>,
  modeCalls: [] as string[],
}));

beforeEach(() => {
  spy.deps = null;
  spy.focusCalls = [];
  spy.modeCalls = [];
});

vi.mock('@/notepad/context/useNoteCollection', () => ({
  useNoteCollection: () => ({ notes: [], activeNoteId: null, collection: { openNote: vi.fn() } }),
}));

vi.mock('@/notepad/context/useReferenceGraph', () => ({
  useReferenceGraph: () => ({ references: [], scriptureNodes: [], graph: { getNeighborhood: vi.fn() } }),
}));

vi.mock('@/notepad/graph/project-graph', () => ({
  projectGraph: () => ({ nodes: [], edges: [] }),
}));

vi.mock('@/notepad/graph/graph-view', () => {
  const SNAPSHOT = { popover: null };
  class GraphView {
    constructor(deps: never) { spy.deps = deps; }
    subscribe = () => () => {};
    getSnapshot = () => SNAPSHOT;
    attach() {}
    detach() {}
    setNeighborhoodFn() {}
    setData() {}
    setMode(m: string) { spy.modeCalls.push(m); }
    setFilters() {}
    setSettings() {}
    setFocus(id: string | null) { spy.focusCalls.push(id); }
    handleMouseMove() {}
    handleMouseDown() {}
    handleMouseUp() {}
  }
  return {
    GraphView,
    DEFAULT_FILTERS: { scripture: true, sermon: true, devotion: true, theme: true },
    DEFAULT_SETTINGS: { depth: 1, nodeSize: 1, edgeThickness: 1, linkDistance: 100, linkForce: 0.005, repelForce: 500, centerForce: 0.05 },
  };
});

import { GraphPane } from './GraphPane';

describe('GraphPane', () => {
  it('hides itself below the md breakpoint in the desktop sidebar context', () => {
    render(<GraphPane graphOpen />);
    expect(screen.getByRole('complementary').classList.contains('hidden')).toBe(true);
  });

  it('renders visibly (no md-hide) when embedded, e.g. the mobile More sheet', () => {
    render(<GraphPane graphOpen embedded />);
    const aside = screen.getByRole('complementary');
    expect(aside.classList.contains('hidden')).toBe(false);
    expect(aside.classList.contains('flex')).toBe(true);
  });

  it('embedded: a node tap is routed to onNodePeek and reports handled', () => {
    const onNodePeek = vi.fn();
    render(<GraphPane graphOpen embedded onNodePeek={onNodePeek} />);
    const handled = spy.deps!.onNodeTap({ id: 'a', type: 'devotion', title: 'A' });
    expect(onNodePeek).toHaveBeenCalledWith({ id: 'a', type: 'devotion', title: 'A' });
    expect(handled).toBe(true);
  });

  it('non-embedded: onNodeTap returns false so default behavior runs', () => {
    render(<GraphPane graphOpen />);
    expect(spy.deps!.onNodeTap({ id: 'a', type: 'devotion', title: 'A' })).toBe(false);
  });

  it('embedded: focusNodeId drives setFocus + local mode', () => {
    const { rerender } = render(<GraphPane graphOpen embedded focusNodeId={null} />);
    rerender(<GraphPane graphOpen embedded focusNodeId="scripture:x" />);
    expect(spy.focusCalls).toContain('scripture:x');
    expect(spy.modeCalls).toContain('local');
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run src/components/sections/notepad/GraphPane.test.tsx`
Expected: FAIL — the three new tests fail (`onNodePeek`/`focusNodeId` not props yet; `spy.deps.onNodeTap` is undefined).

- [ ] **Step 3: Add the type import and the props**

In `src/components/sections/notepad/GraphPane.tsx`, add this import near the other imports:

```ts
import type { GraphNode } from '@/notepad/graph/types';
```

Extend the `GraphPaneProps` interface (it currently ends with `embedded?: boolean;`):

```ts
  /** Mobile/embedded only: route node taps to a peek view instead of opening the note / popover. */
  onNodePeek?: (node: { id: string; type: GraphNode['type']; title: string }) => void;
  /** Mobile/embedded only: center local mode on this node id (e.g. from a peek "Focus" action). */
  focusNodeId?: string | null;
```

Update the destructured signature:

```ts
export function GraphPane({ graphOpen, expanded = false, onToggleExpand, embedded = false, onNodePeek, focusNodeId = null }: GraphPaneProps) {
```

- [ ] **Step 4: Wire the tap interceptor via a ref, and add the focus effect**

In `GraphPane.tsx`, replace the existing `view` memo:

```ts
  const view = useMemo(() => new GraphView({
    onNodeOpen: (id) => openNote(id),
    devicePixelRatio: () => window.devicePixelRatio || 1,
  }), [openNote]);
```

with (note the new `onNodePeekRef` above it):

```ts
  // Kept in a ref so the memoized GraphView stays stable while always seeing the
  // latest callback. onNodeTap returns true (handled) only when a peek handler exists.
  const onNodePeekRef = useRef(onNodePeek);
  onNodePeekRef.current = onNodePeek;

  const view = useMemo(() => new GraphView({
    onNodeOpen: (id) => openNote(id),
    devicePixelRatio: () => window.devicePixelRatio || 1,
    onNodeTap: (n) => {
      const cb = onNodePeekRef.current;
      if (cb) { cb(n); return true; }
      return false;
    },
  }), [openNote]);
```

Then add this effect alongside the other `view.*` effects (e.g. right after the `view.setMode(graphMode)` effect):

```ts
  useEffect(() => {
    view.setFocus(focusNodeId);
    if (focusNodeId) setGraphMode('local');
  }, [view, focusNodeId]);
```

- [ ] **Step 5: Switch the canvas to pointer events + touch-action none**

In `GraphPane.tsx`, replace the `<canvas>` element:

```tsx
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          onMouseMove={(e) => view.handleMouseMove(e)}
          onMouseDown={(e) => view.handleMouseDown(e)}
          onMouseUp={(e) => view.handleMouseUp(e)}
        />
```

with:

```tsx
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => view.handleMouseDown(e)}
          onPointerMove={(e) => view.handleMouseMove(e)}
          onPointerUp={(e) => view.handleMouseUp(e)}
        />
```

(Pointer events unify mouse + touch + pen; `touch-action: none` stops the sheet from scrolling while panning/tapping the canvas. `handleMouseDown/Move/Up` accept `{ clientX, clientY }`, which `PointerEvent` satisfies.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/sections/notepad/GraphPane.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/sections/notepad/GraphPane.tsx src/components/sections/notepad/GraphPane.test.tsx
git commit -m "feat(graph): GraphPane onNodePeek + focusNodeId + pointer/touch input"
```

---

## Task 4: `buildPeekData` pure helper

**Files:**
- Create: `src/components/sections/notepad/mobile/node-peek-data.ts`
- Test: `src/components/sections/notepad/mobile/node-peek-data.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/components/sections/notepad/mobile/node-peek-data.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildPeekData } from './node-peek-data';
import type { ReferenceGraph } from '../../../../notepad/graph/reference-graph';
import type { Note } from '../../../../notepad/types';
import type { Reference } from '../../../../notepad/graph/types';

function makeNote(over: Partial<Note> & { id: string }): Note {
  return {
    id: over.id,
    title: over.title ?? over.id,
    content: over.content ?? JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello world' }] }] }),
    folderId: over.folderId ?? 'root',
    type: over.type ?? 'devotion',
    tags: over.tags ?? [],
    wordCount: over.wordCount ?? 2,
    createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: over.updatedAt ?? '2026-01-01T00:00:00.000Z',
  };
}

function makeGraph(opts: {
  references?: Reference[];
  scripture?: Record<string, { book: string; chapter: number; verseStart: number; verseEnd: number | null; translation: string; text: string }>;
}): ReferenceGraph {
  const references = opts.references ?? [];
  const scripture = opts.scripture ?? {};
  // Structural stub — only the two methods buildPeekData uses.
  return {
    getReferencesBy: ({ source, target }: { source?: string; target?: string }) =>
      references.filter((r) => (source === undefined || r.source === source) && (target === undefined || r.target === target)),
    getScriptureNode: (id: string) => {
      const s = scripture[id];
      return s ? { id, createdAt: '2026-01-01T00:00:00.000Z', ...s } : null;
    },
  } as unknown as ReferenceGraph;
}

const ref = (over: Partial<Reference> & { id: string; source: string; target: string }): Reference => ({
  id: over.id, source: over.source, target: over.target,
  type: over.type ?? 'explicit', weight: over.weight ?? 1, createdAt: over.createdAt ?? 'x',
});

describe('buildPeekData', () => {
  it('returns null for a missing note', () => {
    expect(buildPeekData({ id: 'nope', kind: 'note' }, [], makeGraph({}))).toBeNull();
  });

  it('returns null for a missing scripture node', () => {
    expect(buildPeekData({ id: 'scripture:nope', kind: 'scripture' }, [], makeGraph({}))).toBeNull();
  });

  it('builds a note peek with connection count, preview, and linked verses', () => {
    const notes = [makeNote({ id: 'n1', title: 'Shepherd', type: 'devotion' })];
    const graph = makeGraph({
      references: [
        ref({ id: 'e1', source: 'n1', target: 'scripture:ps-23-1', type: 'scripture-reference' }),
        ref({ id: 'e2', source: 'n1', target: 'n2', type: 'explicit' }),
      ],
      scripture: { 'scripture:ps-23-1': { book: 'Psalm', chapter: 23, verseStart: 1, verseEnd: null, translation: 'WEB', text: '...' } },
    });
    expect(buildPeekData({ id: 'n1', kind: 'note' }, notes, graph)).toEqual({
      kind: 'note',
      id: 'n1',
      title: 'Shepherd',
      noteType: 'devotion',
      connectionCount: 2,
      preview: 'hello world',
      linkedVerses: [{ id: 'scripture:ps-23-1', label: 'Psalm 23:1' }],
    });
  });

  it('builds a scripture peek with deduped referenced-by notes', () => {
    const notes = [
      makeNote({ id: 'n1', title: 'Shepherd', type: 'devotion' }),
      makeNote({ id: 'n2', title: 'Sermon', type: 'sermon' }),
    ];
    const graph = makeGraph({
      references: [
        ref({ id: 'e1', source: 'n1', target: 'scripture:ps-23-1', type: 'scripture-reference' }),
        ref({ id: 'e2', source: 'n2', target: 'scripture:ps-23-1', type: 'scripture-reference' }),
      ],
      scripture: { 'scripture:ps-23-1': { book: 'Psalm', chapter: 23, verseStart: 1, verseEnd: 4, translation: 'WEB', text: 'The Lord is my shepherd' } },
    });
    expect(buildPeekData({ id: 'scripture:ps-23-1', kind: 'scripture' }, notes, graph)).toEqual({
      kind: 'scripture',
      id: 'scripture:ps-23-1',
      reference: 'Psalm 23:1-4',
      translation: 'WEB',
      text: 'The Lord is my shepherd',
      referencedBy: [
        { id: 'n1', title: 'Shepherd', type: 'devotion' },
        { id: 'n2', title: 'Sermon', type: 'sermon' },
      ],
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/sections/notepad/mobile/node-peek-data.test.ts`
Expected: FAIL — module `./node-peek-data` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/components/sections/notepad/mobile/node-peek-data.ts`:

```ts
import type { Note, NoteType } from '../../../../notepad/types';
import type { ReferenceGraph } from '../../../../notepad/graph/reference-graph';
import { extractTextFromNote } from '../../../../notepad/utils/tiptap-text';

export interface PeekTarget {
  id: string;
  kind: 'note' | 'scripture';
}

export interface LinkedVerse {
  id: string;
  label: string;
}

export interface PeekNoteData {
  kind: 'note';
  id: string;
  title: string;
  noteType: NoteType;
  connectionCount: number;
  preview: string;
  linkedVerses: LinkedVerse[];
}

export interface ReferencingNote {
  id: string;
  title: string;
  type: NoteType;
}

export interface PeekScriptureData {
  kind: 'scripture';
  id: string;
  reference: string;
  translation: string;
  text: string;
  referencedBy: ReferencingNote[];
}

export type PeekData = PeekNoteData | PeekScriptureData;

function verseLabel(graph: ReferenceGraph, scriptureId: string): string {
  const sn = graph.getScriptureNode(scriptureId);
  if (!sn) return scriptureId;
  return `${sn.book} ${sn.chapter}:${sn.verseStart}${sn.verseEnd ? `-${sn.verseEnd}` : ''}`;
}

export function buildPeekData(
  target: PeekTarget,
  notes: Note[],
  graph: ReferenceGraph,
): PeekData | null {
  if (target.kind === 'note') {
    const note = notes.find((n) => n.id === target.id);
    if (!note) return null;

    const outgoing = graph.getReferencesBy({ source: note.id });
    const incoming = graph.getReferencesBy({ target: note.id });

    const seen = new Set<string>();
    const linkedVerses: LinkedVerse[] = [];
    for (const r of outgoing) {
      if (r.type !== 'scripture-reference' || seen.has(r.target)) continue;
      seen.add(r.target);
      linkedVerses.push({ id: r.target, label: verseLabel(graph, r.target) });
    }

    return {
      kind: 'note',
      id: note.id,
      title: note.title,
      noteType: note.type,
      connectionCount: outgoing.length + incoming.length,
      preview: extractTextFromNote(note),
      linkedVerses,
    };
  }

  const sn = graph.getScriptureNode(target.id);
  if (!sn) return null;

  const seen = new Set<string>();
  const referencedBy: ReferencingNote[] = [];
  for (const r of graph.getReferencesBy({ target: target.id })) {
    const note = notes.find((n) => n.id === r.source);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    referencedBy.push({ id: note.id, title: note.title, type: note.type });
  }

  return {
    kind: 'scripture',
    id: target.id,
    reference: `${sn.book} ${sn.chapter}:${sn.verseStart}${sn.verseEnd ? `-${sn.verseEnd}` : ''}`,
    translation: sn.translation,
    text: sn.text,
    referencedBy,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/sections/notepad/mobile/node-peek-data.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/node-peek-data.ts src/components/sections/notepad/mobile/node-peek-data.test.ts
git commit -m "feat(notepad): buildPeekData helper for mobile node peek"
```

---

## Task 5: `NodePeek` presentational view

**Files:**
- Create: `src/components/sections/notepad/mobile/NodePeek.tsx`
- Test: `src/components/sections/notepad/mobile/NodePeek.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/sections/notepad/mobile/NodePeek.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { NodePeek } from './NodePeek';
import type { PeekData } from './node-peek-data';

afterEach(cleanup);

const noteData: PeekData = {
  kind: 'note',
  id: 'n1',
  title: 'Shepherd',
  noteType: 'devotion',
  connectionCount: 3,
  preview: 'The Lord is my shepherd',
  linkedVerses: [{ id: 'scripture:ps-23-1', label: 'Psalm 23:1' }],
};

const scriptureData: PeekData = {
  kind: 'scripture',
  id: 'scripture:ps-23-1',
  reference: 'Psalm 23:1',
  translation: 'WEB',
  text: 'Yahweh is my shepherd; I shall lack nothing.',
  referencedBy: [{ id: 'n1', title: 'Shepherd', type: 'devotion' }],
};

function setup(data: PeekData) {
  const onBack = vi.fn(), onOpenInEditor = vi.fn(), onFocus = vi.fn(), onPeekNote = vi.fn();
  render(<NodePeek data={data} onBack={onBack} onOpenInEditor={onOpenInEditor} onFocus={onFocus} onPeekNote={onPeekNote} />);
  return { onBack, onOpenInEditor, onFocus, onPeekNote };
}

describe('<NodePeek /> — note', () => {
  it('shows title, preview, and a linked verse', () => {
    setup(noteData);
    expect(screen.getByText('Shepherd')).toBeTruthy();
    expect(screen.getByText('The Lord is my shepherd')).toBeTruthy();
    expect(screen.getByText('Psalm 23:1')).toBeTruthy();
  });

  it('Open in Editor fires onOpenInEditor with the note id', () => {
    const { onOpenInEditor } = setup(noteData);
    fireEvent.click(screen.getByRole('button', { name: /open in editor/i }));
    expect(onOpenInEditor).toHaveBeenCalledWith('n1');
  });

  it('Focus fires onFocus with the note id; Back fires onBack', () => {
    const { onFocus, onBack } = setup(noteData);
    fireEvent.click(screen.getByRole('button', { name: /focus in graph/i }));
    expect(onFocus).toHaveBeenCalledWith('n1');
    fireEvent.click(screen.getByRole('button', { name: /back to graph/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('<NodePeek /> — scripture', () => {
  it('shows reference, translation, verse text, and referenced-by notes', () => {
    setup(scriptureData);
    expect(screen.getByText('Psalm 23:1')).toBeTruthy();
    expect(screen.getByText(/WEB/)).toBeTruthy();
    expect(screen.getByText(/Yahweh is my shepherd/)).toBeTruthy();
    expect(screen.getByText('Shepherd')).toBeTruthy();
  });

  it('tapping a referenced note fires onPeekNote; no Open in Editor button', () => {
    const { onPeekNote } = setup(scriptureData);
    expect(screen.queryByRole('button', { name: /open in editor/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Shepherd/ }));
    expect(onPeekNote).toHaveBeenCalledWith('n1');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/sections/notepad/mobile/NodePeek.test.tsx`
Expected: FAIL — module `./NodePeek` does not exist.

- [ ] **Step 3: Implement `NodePeek`**

Create `src/components/sections/notepad/mobile/NodePeek.tsx`:

```tsx
import { ChevronLeft, BookOpen, Crosshair } from 'lucide-react';
import type { PeekData } from './node-peek-data';

export interface NodePeekProps {
  data: PeekData;
  onBack: () => void;
  onOpenInEditor: (id: string) => void;
  onFocus: (id: string) => void;
  onPeekNote: (id: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  scripture: '#C49A78',
  sermon: '#7A9BAE',
  devotion: '#6B8B7A',
  theme: '#D4A0A0',
};

export function NodePeek({ data, onBack, onOpenInEditor, onFocus, onPeekNote }: NodePeekProps) {
  return (
    <div className="flex flex-col h-full min-h-0" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--deep-umber)' }}>
      {/* Header — back only; "Open in Editor" lives in the footer (single instance). */}
      <div className="flex items-center px-4 py-3 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[12px] font-semibold"
          style={{ color: 'var(--deep-umber)' }}
        >
          <ChevronLeft className="w-4 h-4" />
          Back to graph
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2">
        {data.kind === 'note' ? (
          <>
            <h2 className="text-[18px] font-bold mb-2">{data.title}</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              <Chip color={TYPE_COLORS[data.noteType]}>{data.noteType}</Chip>
              <Chip color="#9a8f7f">{data.connectionCount} connections</Chip>
            </div>
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(62,50,40,0.85)' }}>
              {data.preview || 'This note is empty.'}
            </p>
            {data.linkedVerses.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] tracking-[0.1em] uppercase mb-2" style={{ color: 'var(--silica)' }}>
                  Linked verses
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.linkedVerses.map((v) => (
                    <span
                      key={v.id}
                      className="text-[11px] px-2 py-1 rounded"
                      style={{ background: 'rgba(196,154,120,0.15)', color: '#9a6f3a' }}
                    >
                      {v.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-[18px] font-bold mb-1" style={{ color: '#9a6f3a' }}>{data.reference}</h2>
            <div className="text-[10px] tracking-[0.08em] mb-3" style={{ color: 'var(--silica)' }}>
              {data.translation}
            </div>
            <p className="text-[14px] italic leading-relaxed mb-5" style={{ color: 'rgba(62,50,40,0.9)' }}>
              {data.text || 'Verse text unavailable.'}
            </p>
            <div className="text-[10px] tracking-[0.1em] uppercase mb-2" style={{ color: 'var(--silica)' }}>
              Referenced by
            </div>
            {data.referencedBy.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--silica)' }}>No notes reference this verse yet.</p>
            ) : (
              <div className="flex flex-col">
                {data.referencedBy.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => onPeekNote(n.id)}
                    className="flex items-center gap-2 py-2 text-left"
                    style={{ borderTop: '1px solid var(--pale-stone)' }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TYPE_COLORS[n.type] }} />
                    <span className="text-[13px]">{n.title}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 flex gap-2" style={{ borderTop: '1px solid rgba(206,204,202,0.5)' }}>
        <button
          onClick={() => onFocus(data.id)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[12px] font-semibold"
          style={{ border: '1px solid var(--deep-umber)', color: 'var(--deep-umber)' }}
        >
          <Crosshair className="w-3.5 h-3.5" />
          Focus in graph
        </button>
        {data.kind === 'note' && (
          <button
            onClick={() => onOpenInEditor(data.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[12px] font-semibold"
            style={{ background: 'var(--deep-umber)', color: 'var(--plaster)' }}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Open in Editor
          </button>
        )}
      </div>
    </div>
  );
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-2 py-1 rounded-full" style={{ border: `1px solid ${color}`, color }}>
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/sections/notepad/mobile/NodePeek.test.tsx`
Expected: PASS (5 tests). The note variant has exactly one "Open in Editor" button (footer) and the scripture variant has none, so `getByRole('button', { name: /open in editor/i })` is unambiguous.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/NodePeek.tsx src/components/sections/notepad/mobile/NodePeek.test.tsx
git commit -m "feat(notepad): NodePeek mobile peek view (note + verse)"
```

---

## Task 6: MobileMoreSheet — peek state, routing, and `onOpenNote`

**Files:**
- Modify: `src/components/sections/notepad/mobile/MobileMoreSheet.tsx`
- Test: `src/components/sections/notepad/mobile/MobileMoreSheet.test.tsx`

- [ ] **Step 1: Update the test file (mocks + new flow tests)**

Replace the contents of `src/components/sections/notepad/mobile/MobileMoreSheet.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../notepad/components/BacklinksPanel', () => ({ BacklinksPanel: () => <div data-testid="backlinks" /> }));
vi.mock('../../../../notepad/components/InfoPanel', () => ({ InfoPanel: () => <div data-testid="info" /> }));
vi.mock('../../../../notepad/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
vi.mock('../../../../notepad/context/useNoteCollection', () => ({ useNoteCollection: () => ({ notes: [] }) }));
vi.mock('../../../../notepad/context/useReferenceGraph', () => ({ useReferenceGraph: () => ({ graph: {} }) }));

// GraphPane mock exposes a button that fires onNodePeek (simulating a node tap).
vi.mock('../GraphPane', () => ({
  GraphPane: (props: { onNodePeek: (n: { id: string; type: string; title: string }) => void }) => (
    <button data-testid="graph" onClick={() => props.onNodePeek({ id: 'n1', type: 'devotion', title: 'N1' })}>graph</button>
  ),
}));

// buildPeekData mock returns a minimal PeekData for the tapped target.
vi.mock('./node-peek-data', () => ({
  buildPeekData: (t: { id: string; kind: 'note' | 'scripture' }) => ({
    kind: t.kind, id: t.id, title: 'N1', noteType: 'devotion', connectionCount: 0,
    preview: '', linkedVerses: [], reference: '', translation: '', text: '', referencedBy: [],
  }),
}));

// NodePeek mock surfaces the callbacks as buttons.
vi.mock('./NodePeek', () => ({
  NodePeek: (props: { data: { id: string }; onBack: () => void; onOpenInEditor: (id: string) => void; onFocus: (id: string) => void }) => (
    <div data-testid="peek">
      <button data-testid="peek-open" onClick={() => props.onOpenInEditor(props.data.id)}>open</button>
      <button data-testid="peek-focus" onClick={() => props.onFocus(props.data.id)}>focus</button>
      <button data-testid="peek-back" onClick={props.onBack}>back</button>
    </div>
  ),
}));

import { MobileMoreSheet } from './MobileMoreSheet';

afterEach(cleanup);

function open(extra: Partial<{ onClose: () => void; onOpenNote: (id: string) => void }> = {}) {
  return render(<MobileMoreSheet open onClose={extra.onClose ?? vi.fn()} onOpenNote={extra.onOpenNote ?? vi.fn()} />);
}

describe('<MobileMoreSheet />', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<MobileMoreSheet open={false} onClose={vi.fn()} onOpenNote={vi.fn()} />);
    expect(container.querySelector('[data-testid="backlinks"]')).toBeNull();
  });

  it('shows Backlinks by default and switches panels via the segmented control', () => {
    const { getByTestId, queryByTestId, getByRole } = open();
    expect(getByTestId('backlinks')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Graph' }));
    expect(getByTestId('graph')).toBeTruthy();
    expect(queryByTestId('backlinks')).toBeNull();
  });

  it('calls onClose when the backdrop is tapped', () => {
    const onClose = vi.fn();
    const { getByLabelText } = open({ onClose });
    fireEvent.click(getByLabelText('Close details'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('routes a graph node tap to the peek; Back returns to the graph', () => {
    const { getByRole, getByTestId, queryByTestId } = open();
    fireEvent.click(getByRole('button', { name: 'Graph' }));
    fireEvent.click(getByTestId('graph'));
    expect(getByTestId('peek')).toBeTruthy();
    expect(queryByTestId('graph')).toBeNull();
    fireEvent.click(getByTestId('peek-back'));
    expect(getByTestId('graph')).toBeTruthy();
  });

  it('Open in Editor calls onOpenNote and closes the sheet', () => {
    const onOpenNote = vi.fn(); const onClose = vi.fn();
    const { getByRole, getByTestId } = open({ onOpenNote, onClose });
    fireEvent.click(getByRole('button', { name: 'Graph' }));
    fireEvent.click(getByTestId('graph'));
    fireEvent.click(getByTestId('peek-open'));
    expect(onOpenNote).toHaveBeenCalledWith('n1');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Focus dismisses the peek back to the graph', () => {
    const { getByRole, getByTestId, queryByTestId } = open();
    fireEvent.click(getByRole('button', { name: 'Graph' }));
    fireEvent.click(getByTestId('graph'));
    fireEvent.click(getByTestId('peek-focus'));
    expect(getByTestId('graph')).toBeTruthy();
    expect(queryByTestId('peek')).toBeNull();
  });

  it('switching segments away from Graph clears an open peek', () => {
    const { getByRole, getByTestId, queryByTestId } = open();
    fireEvent.click(getByRole('button', { name: 'Graph' }));
    fireEvent.click(getByTestId('graph'));
    expect(getByTestId('peek')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Info' }));
    fireEvent.click(getByRole('button', { name: 'Graph' }));
    expect(queryByTestId('peek')).toBeNull();
    expect(getByTestId('graph')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileMoreSheet.test.tsx`
Expected: FAIL — `onOpenNote` not used / peek not implemented; the new flow tests fail.

- [ ] **Step 3: Implement the peek state + routing**

Replace the contents of `src/components/sections/notepad/mobile/MobileMoreSheet.tsx` with:

```tsx
// src/components/sections/notepad/mobile/MobileMoreSheet.tsx
import { useEffect, useMemo, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { BacklinksPanel } from '../../../../notepad/components/BacklinksPanel';
import { InfoPanel } from '../../../../notepad/components/InfoPanel';
import { GraphPane } from '../GraphPane';
import { NodePeek } from './NodePeek';
import { buildPeekData, type PeekTarget } from './node-peek-data';
import { useNoteCollection } from '../../../../notepad/context/useNoteCollection';
import { useReferenceGraph } from '../../../../notepad/context/useReferenceGraph';
import { useOnlineStatus } from '../../../../notepad/hooks/useOnlineStatus';
import { Segmented } from './Segmented';

type DetailSegment = 'backlinks' | 'info' | 'graph';

export interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenNote: (id: string) => void;
}

export function MobileMoreSheet({ open, onClose, onOpenNote }: MobileMoreSheetProps) {
  const [segment, setSegment] = useState<DetailSegment>('backlinks');
  const [peeked, setPeeked] = useState<PeekTarget | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  const { notes } = useNoteCollection();
  const { graph } = useReferenceGraph();
  const peekData = useMemo(
    () => (peeked ? buildPeekData(peeked, notes, graph) : null),
    [peeked, notes, graph],
  );

  // Reset any open peek when the sheet closes so it doesn't linger on reopen.
  useEffect(() => {
    if (!open) setPeeked(null);
  }, [open]);

  const handleSegment = (next: DetailSegment) => {
    setPeeked(null);
    setSegment(next);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ fontFamily: 'Outfit, sans-serif' }}>
      <button
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.35)' }}
      />
      <div
        className="relative rounded-t-2xl flex flex-col"
        style={{
          background: 'var(--plaster)',
          maxHeight: '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -8px 28px rgba(0,0,0,0.18)',
        }}
      >
        <div className="flex justify-center pt-2">
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--pale-stone)' }} />
        </div>

        <div className="px-4 pt-3 pb-2">
          <Segmented<DetailSegment>
            options={[
              { value: 'backlinks', label: 'Backlinks' },
              { value: 'info', label: 'Info' },
              { value: 'graph', label: 'Graph' },
            ]}
            value={segment}
            onChange={handleSegment}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {segment === 'backlinks' && <BacklinksPanel />}
          {segment === 'info' && <InfoPanel />}
          {segment === 'graph' && (
            peekData ? (
              <NodePeek
                data={peekData}
                onBack={() => setPeeked(null)}
                onOpenInEditor={(id) => { onOpenNote(id); onClose(); }}
                onFocus={(id) => { setFocusId(id); setPeeked(null); }}
                onPeekNote={(id) => setPeeked({ id, kind: 'note' })}
              />
            ) : (
              <GraphPane
                graphOpen
                embedded
                focusNodeId={focusId}
                expanded={false}
                onToggleExpand={() => {}}
                onNodePeek={(n) => setPeeked({ id: n.id, kind: n.type === 'scripture' ? 'scripture' : 'note' })}
              />
            )
          )}
        </div>

        <footer
          className="shrink-0 flex items-center gap-2 px-4 py-2 text-[11px]"
          style={{ borderTop: '1px solid var(--pale-stone)', color: 'var(--silica)' }}
        >
          {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
          {isOnline ? 'Synced' : 'Offline — changes saved locally'}
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileMoreSheet.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileMoreSheet.tsx src/components/sections/notepad/mobile/MobileMoreSheet.test.tsx
git commit -m "feat(notepad): MobileMoreSheet peek routing + onOpenNote"
```

---

## Task 7: Wire `onOpenNote` from the workspace

**Files:**
- Modify: `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`

- [ ] **Step 1: Pass `handleOpenNote` to the sheet**

In `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`, find:

```tsx
      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
```

Replace with:

```tsx
      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} onOpenNote={handleOpenNote} />
```

(`handleOpenNote` already exists in this component: it calls `openNote(id)` then `setTab('editor')`. After it runs, `onClose` from the sheet closes the overlay, revealing the Editor tab.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). If `MobileMoreSheet` is referenced elsewhere without `onOpenNote`, tsc will flag it — there are no other usages (`grep -rn "MobileMoreSheet" src` shows only this file and the test).

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx
git commit -m "feat(notepad): wire mobile peek Open-in-Editor to the workspace"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS for everything except the known pre-existing `garden-scene.test.tsx` failure (1 failed). Confirm the count of newly added passing tests (GraphView +5, GraphPane +3, node-peek-data 4, NodePeek 5, MobileMoreSheet +4). If any OTHER test fails, fix it before continuing.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Lint the touched files (if the project lints in CI)**

Run: `npx eslint src/components/sections/notepad/mobile/NodePeek.tsx src/components/sections/notepad/mobile/node-peek-data.ts src/components/sections/notepad/mobile/MobileMoreSheet.tsx src/components/sections/notepad/GraphPane.tsx src/notepad/graph/graph-view.ts`
Expected: no errors. (Skip if the repo has no eslint script.)

- [ ] **Step 4: Manual browser smoke (mobile viewport)**

Start the dev server (`npm run dev`) and open the notes page at a 390×844 viewport. To exercise the graph you need at least one note containing a Bible verse reference or a `[[link]]` (create one in the Editor tab). Then:
1. Tap **More → Graph** → the graph renders.
2. Tap a **note** node → the peek appears (title, type, connections, preview).
3. Tap **Open in Editor** → the sheet closes and the Editor tab shows that note.
4. Reopen **More → Graph**, tap a **scripture** node → the verse peek appears with "Referenced by".
5. Tap **Focus in graph** → returns to the graph (local mode, centered).
6. Confirm a tap registers via touch (not just mouse) by using the browser's device emulation / touch mode.

Expected: each step behaves as described. If tapping doesn't register under touch emulation, re-check the canvas `touch-action: none` + pointer handlers from Task 3.

- [ ] **Step 5: Final commit (only if Step 1/3 required fixes)**

```bash
git add -A
git commit -m "test(notepad): fixups from mobile node-peek verification"
```

---

## Notes for the implementer

- **Do not** change desktop graph behavior. `GraphPane` non-embedded must keep `onNodeOpen` + the in-canvas popover (Task 3's non-embedded test guards this).
- The earlier graph-display bug fix (`GraphPane.tsx` `hidden md:flex` / `embedded` variant, `MobileMoreSheet` `embedded` prop, `GraphPane.test.tsx`) is already in the working tree on branch `feat/mobile-graph-node-peek` but **uncommitted**. Task 3 replaces `GraphPane.test.tsx` wholesale (keeping its two original assertions) and edits `GraphPane.tsx`/`MobileMoreSheet.tsx` further — so those uncommitted edits get folded into this branch as you commit each task. Verify `git status` is clean after Task 8.
- `Segmented` is generic: `Segmented<DetailSegment>` — keep the explicit type argument when editing MobileMoreSheet.
```
