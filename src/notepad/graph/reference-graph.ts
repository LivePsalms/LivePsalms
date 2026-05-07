/**
 * ReferenceGraph — owns the reference edge list and scripture-node cache.
 *
 * Constructor parameters:
 *   adapter      — storage back-end (swappable via rebindAdapter)
 *   fetchVerse   — async verse resolver; called by syncNote and refreshVerseText
 *   cacheStorage — a Pick<Storage, 'getItem'|'setItem'> impl so the class is
 *                  testable without a DOM.  Pass `localStorage` in production;
 *                  pass `createInMemoryStorage()` in tests.
 */
import { Observable } from '../collection/observable';
import type { StorageAdapter } from '../storage/adapter';
import type { Reference, ScriptureNode } from './types';
import { parseReferencesFromContent, parseVerseRef, walkMarks } from './reference-parser';
import type { ParsedEdge } from './reference-parser';
import type { Note } from '../types';

export type VerseFetcher = (ref: string) => Promise<{ text: string; translation: string } | null>;

export interface ReferenceGraphState {
  references: Reference[];
  scriptureNodes: ScriptureNode[];
}

const REFERENCES_KEY = 'notepad_graph_references';
// Key value matches the existing scripture-store cache (do not rename — would orphan cached data).
const SCRIPTURE_NODES_KEY = 'notepad_scripture_nodes';

const EMPTY_STATE: ReferenceGraphState = { references: [], scriptureNodes: [] };

// Module-level TSK cache (survives for the lifetime of the module).
let tskCache: Record<string, string[]> | null = null;

async function loadTskData(): Promise<Record<string, string[]>> {
  if (tskCache) return tskCache;
  const module = await import('./tsk-data.json');
  tskCache = module.default as Record<string, string[]>;
  return tskCache;
}

function stripScripturePrefix(id: string): string {
  return id.startsWith('scripture:') ? id.slice('scripture:'.length) : id;
}

// Map ParsedEdge underscore type to Reference hyphen type.
function mapParsedType(t: ParsedEdge['type']): Reference['type'] {
  if (t === 'scripture_reference') return 'scripture-reference';
  if (t === 'cross_reference') return 'cross-reference';
  return 'explicit';
}

export class ReferenceGraph extends Observable<ReferenceGraphState> {
  private fetchVerse: VerseFetcher;
  private cache: Pick<Storage, 'getItem' | 'setItem'>;

  // Constructor accepts an adapter for API symmetry with the other deep modules
  // (NoteCollection, FolderHierarchy), but the graph does not retain it — reads
  // flow through method parameters (e.g., repairNoteLinks(notes, adapter)).
  constructor(
    _adapter: StorageAdapter,
    fetchVerse: VerseFetcher,
    cacheStorage: Pick<Storage, 'getItem' | 'setItem'>,
  ) {
    super(EMPTY_STATE);
    this.fetchVerse = fetchVerse;
    this.cache = cacheStorage;
    this.hydrateFromCache();
  }

  // --- Read-only accessors (arrow form for stable React subscriber refs) ---

  getReferences = (): Reference[] => this.getSnapshot().references;

  getReferencesBy = (filter: { source?: string; target?: string }): Reference[] => {
    if (filter.source === undefined && filter.target === undefined) {
      return this.getReferences();
    }
    return this.getSnapshot().references.filter((ref) => {
      if (filter.source !== undefined && filter.target !== undefined) {
        return ref.source === filter.source && ref.target === filter.target;
      }
      if (filter.source !== undefined) return ref.source === filter.source;
      return ref.target === filter.target;
    });
  };

  getScriptureNode = (id: string): ScriptureNode | null =>
    this.getSnapshot().scriptureNodes.find((n) => n.id === id) ?? null;

  getScriptureNodes = (): ScriptureNode[] => this.getSnapshot().scriptureNodes;

  // --- Adapter rebinding (mirrors NoteCollection.rebindAdapter) ---

  rebindAdapter(_next: StorageAdapter): void {
    this.update(() => EMPTY_STATE);
  }

  // --- Public sync methods ---

  /**
   * Syncs a single note into the graph.
   * Parses references from the note content, creates any missing ScriptureNodes
   * (best-effort verse fetch), expands TSK cross-references for newly-created nodes,
   * and inserts all parsed references with deterministic ids.
   * Single emit at the end.
   */
  syncNote = async (note: Note): Promise<void> => {
    const prev = this.getSnapshot();
    const next = await this.computeSyncForNote(note, prev.references, prev.scriptureNodes);
    this.update(() => next);
  };

  /**
   * Syncs all notes into the graph. Iterates computeSyncForNote for each note,
   * accumulating state changes, and emits once at the end.
   */
  syncAll = async (notes: Note[]): Promise<void> => {
    let refs = this.getSnapshot().references;
    let nodes = this.getSnapshot().scriptureNodes;
    for (const note of notes) {
      const next = await this.computeSyncForNote(note, refs, nodes);
      refs = next.references;
      nodes = next.scriptureNodes;
    }
    this.update(() => ({ references: refs, scriptureNodes: nodes }));
  };

  /**
   * Drops every reference whose source or target is nodeId.
   * Does NOT remove scripture nodes — orphaned nodes are fine as cache.
   * Synchronous; emits once.
   */
  deleteReferencesFor = (nodeId: string): void => {
    this.update((prev) => ({
      ...prev,
      references: prev.references.filter(
        (r) => r.source !== nodeId && r.target !== nodeId,
      ),
    }));
  };

  /**
   * Post-construction trigger: if the graph is empty AND notes were provided,
   * runs syncAll to populate from scratch. Otherwise no-op (cache is trusted).
   */
  init = async (notes: Note[]): Promise<void> => {
    const state = this.getSnapshot();
    if (
      state.references.length === 0 &&
      state.scriptureNodes.length === 0 &&
      notes.length > 0
    ) {
      await this.syncAll(notes);
    }
  };

  /**
   * Re-fetches verse text for an existing ScriptureNode and patches it in place.
   * Best-effort: on failure, keeps existing text. Emits once on success.
   */
  refreshVerseText = async (scriptureId: string): Promise<void> => {
    const node = this.getScriptureNode(scriptureId);
    if (!node) return;
    // Reconstruct the human-readable ref to query the API.
    const ref = `${node.book} ${node.chapter}:${node.verseStart}${node.verseEnd ? `-${node.verseEnd}` : ''}`;
    let result: { text: string; translation: string } | null = null;
    try {
      result = await this.fetchVerse(ref);
    } catch {
      return; // Best-effort, keep existing.
    }
    if (!result) return; // null = API unavailable; keep existing, no emit.
    const { text, translation } = result;
    this.update((prev) => ({
      ...prev,
      scriptureNodes: prev.scriptureNodes.map((n) =>
        n.id === scriptureId ? { ...n, text, translation } : n,
      ),
    }));
  };

  /**
   * Scans all notes for `noteLink` marks whose `noteId` no longer points at an
   * existing note. When such a mark also carries a `noteTitle` that matches a
   * current note's title (case-insensitive, trimmed), rewrites `noteId` to the
   * matching note's id and persists via `adapter.updateNote`.
   *
   * Returns counts of repaired notes, rewired links, and unresolvable orphans.
   * Idempotent: a second run over already-healed data does nothing.
   *
   * Note: mutates note content via the adapter; the caller is expected to
   * refetch notes after this completes. Does NOT mutate ReferenceGraph state.
   */
  repairNoteLinks = async (
    notes: Note[],
    adapter: StorageAdapter,
  ): Promise<{ repairedNotes: number; rewiredLinks: number; orphans: number }> => {
    if (notes.length === 0) return { repairedNotes: 0, rewiredLinks: 0, orphans: 0 };

    const idSet = new Set(notes.map((n) => n.id));
    const titleToId = new Map<string, string>();
    for (const n of notes) {
      const key = n.title.trim().toLowerCase();
      // First note with a given title wins; collisions are unusual but possible.
      if (!titleToId.has(key)) titleToId.set(key, n.id);
    }

    let repairedNotes = 0;
    let rewiredLinks = 0;
    let orphans = 0;

    for (const note of notes) {
      let doc: unknown;
      try {
        doc = JSON.parse(note.content);
      } catch {
        continue;
      }

      const marks = walkMarks(doc, 'noteLink');
      if (marks.length === 0) continue;

      let changedThisNote = 0;
      for (const m of marks) {
        const attrs = m.attrs as { noteId?: string | null; noteTitle?: string | null } | undefined;
        const targetId = attrs?.noteId;
        if (typeof targetId === 'string' && idSet.has(targetId)) continue;

        const title = attrs?.noteTitle;
        if (typeof title !== 'string' || title.trim().length === 0) {
          orphans++;
          continue;
        }
        const newId = titleToId.get(title.trim().toLowerCase());
        if (!newId || newId === note.id) {
          orphans++;
          continue;
        }
        if (!m.attrs) m.attrs = {};
        (m.attrs as Record<string, unknown>).noteId = newId;
        changedThisNote++;
      }

      if (changedThisNote > 0) {
        const newContent = JSON.stringify(doc);
        try {
          await adapter.updateNote(note.id, { content: newContent });
          repairedNotes++;
          rewiredLinks += changedThisNote;
        } catch (err) {
          console.warn('[repairNoteLinks] failed to persist repair for', note.id, err);
        }
      }
    }

    return { repairedNotes, rewiredLinks, orphans };
  };

  /**
   * Returns the set of node ids reachable from nodeId within the given BFS depth.
   * Includes nodeId itself.
   */
  getNeighborhood = (nodeId: string, depth: number): Set<string> => {
    const adj = this.buildAdjacencyList(this.getSnapshot().references);
    return this.bfsNeighborhood(nodeId, depth, adj);
  };

  // --- Private helpers ---

  private hydrateFromCache(): void {
    try {
      const rawRefs = this.cache.getItem(REFERENCES_KEY);
      const rawNodes = this.cache.getItem(SCRIPTURE_NODES_KEY);

      const references: Reference[] = rawRefs ? (JSON.parse(rawRefs) as Reference[]) : [];
      const scriptureNodes: ScriptureNode[] = rawNodes
        ? (JSON.parse(rawNodes) as ScriptureNode[])
        : [];

      if (references.length === 0 && scriptureNodes.length === 0) return;

      this.update(() => ({ references, scriptureNodes }));
    } catch (err) {
      console.warn('[ReferenceGraph] malformed cache — starting from EMPTY_STATE', err);
    }
  }

  private writeCache(state: ReferenceGraphState): void {
    this.cache.setItem(REFERENCES_KEY, JSON.stringify(state.references));
    this.cache.setItem(SCRIPTURE_NODES_KEY, JSON.stringify(state.scriptureNodes));
  }

  private update(updater: (prev: ReferenceGraphState) => ReferenceGraphState): void {
    this.setState((prev) => {
      const next = updater(prev);
      if (next !== prev) this.writeCache(next);
      return next;
    });
  }

  /**
   * Core sync logic for a single note. Operates on passed-in base arrays and
   * returns the resulting arrays without emitting. Used by syncNote and syncAll.
   */
  private async computeSyncForNote(
    note: Note,
    baseRefs: Reference[],
    baseNodes: ScriptureNode[],
  ): Promise<{ references: Reference[]; scriptureNodes: ScriptureNode[] }> {
    const { edges: parsedEdges, scriptureRefs } = parseReferencesFromContent(
      note.id,
      note.content,
    );

    // 1. Drop all existing refs from this note.
    let nextRefs = baseRefs.filter((r) => r.source !== note.id);
    const nextNodes = baseNodes.slice();
    const knownIds = new Set(nextNodes.map((n) => n.id));
    const newlyCreatedScriptureIds: string[] = [];

    // 2. For each new scripture ref, create a ScriptureNode if missing (best-effort fetch).
    for (const sref of scriptureRefs) {
      if (knownIds.has(sref.id)) continue;
      const parsed = parseVerseRef(sref.ref);
      if (!parsed) continue;
      let text = '';
      let translation = 'WEB';
      try {
        const result = await this.fetchVerse(sref.ref);
        if (result) {
          text = result.text;
          translation = result.translation;
        }
      } catch {
        // Bible API failed — node created with empty text; refreshVerseText() can fix later.
      }
      const newNode: ScriptureNode = {
        id: sref.id,
        book: parsed.book,
        chapter: parsed.chapter,
        verseStart: parsed.verseStart,
        verseEnd: parsed.verseEnd,
        translation,
        text,
        createdAt: new Date().toISOString(),
      };
      nextNodes.push(newNode);
      knownIds.add(newNode.id);
      newlyCreatedScriptureIds.push(newNode.id);
    }

    // 3. For each newly-created scripture node, expand TSK cross-references.
    if (newlyCreatedScriptureIds.length > 0) {
      const tskEdges = await this.expandTskForNewNodes(
        newlyCreatedScriptureIds,
        nextRefs,
        nextNodes,
      );
      nextRefs = nextRefs.concat(tskEdges);
    }

    // 4. Insert parsed references for this note (preserve createdAt for stable ids).
    // existingById is keyed from baseRefs (before step 1 dropped this note's old refs),
    // so a re-synced reference with the same id reuses its original createdAt.
    const existingById = new Map(baseRefs.map((r) => [r.id, r] as const));
    for (const pe of parsedEdges) {
      const id = `${note.id}|${pe.target}|${mapParsedType(pe.type)}`;
      const existing = existingById.get(id);
      nextRefs.push({
        id,
        source: note.id,
        target: pe.target,
        type: mapParsedType(pe.type),
        weight: pe.weight,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      });
    }

    return { references: nextRefs, scriptureNodes: nextNodes };
  }

  /**
   * Expand TSK cross-references for a batch of newly-created scripture node ids.
   * Returns Reference[] of 'cross-reference' edges to add (with deterministic ids).
   * Does not add duplicates relative to the provided currentRefs.
   */
  private async expandTskForNewNodes(
    newIds: string[],
    currentRefs: Reference[],
    currentNodes: ScriptureNode[],
  ): Promise<Reference[]> {
    const tsk = await loadTskData();
    const allNodeIds = new Set(currentNodes.map((n) => n.id));
    const existingRefIds = new Set(currentRefs.map((r) => r.id));
    const toAdd: Reference[] = [];
    const addedIds = new Set<string>();

    const tryAdd = (source: string, target: string) => {
      const id = `${source}|${target}|cross-reference`;
      if (existingRefIds.has(id) || addedIds.has(id)) return;
      addedIds.add(id);
      toAdd.push({
        id,
        source,
        target,
        type: 'cross-reference',
        weight: 0.5,
        createdAt: new Date().toISOString(),
      });
    };

    for (const newId of newIds) {
      const newKey = stripScripturePrefix(newId);

      // New verse's TSK cross-refs → existing scripture nodes.
      const newCrossRefs = tsk[newKey] ?? [];
      for (const crossRef of newCrossRefs) {
        const targetId = `scripture:${crossRef}`;
        if (allNodeIds.has(targetId) && targetId !== newId) {
          tryAdd(newId, targetId);
        }
      }

      // Existing nodes' TSK cross-refs → new verse.
      for (const existingNode of currentNodes) {
        if (existingNode.id === newId) continue;
        const existingKey = stripScripturePrefix(existingNode.id);
        const existingCrossRefs = tsk[existingKey] ?? [];
        if (existingCrossRefs.includes(newKey)) {
          tryAdd(existingNode.id, newId);
        }
      }
    }

    return toAdd;
  }

  /**
   * Builds an adjacency list from a Reference array.
   */
  private buildAdjacencyList(
    refs: Reference[],
  ): Map<string, { outgoing: Reference[]; incoming: Reference[] }> {
    const list = new Map<string, { outgoing: Reference[]; incoming: Reference[] }>();

    const ensureNode = (id: string) => {
      if (!list.has(id)) {
        list.set(id, { outgoing: [], incoming: [] });
      }
    };

    for (const ref of refs) {
      ensureNode(ref.source);
      ensureNode(ref.target);
      list.get(ref.source)!.outgoing.push(ref);
      list.get(ref.target)!.incoming.push(ref);
    }

    return list;
  }

  /**
   * BFS from start node up to depth hops. Returns the set of all visited node ids
   * (including the start node).
   */
  private bfsNeighborhood(
    start: string,
    depth: number,
    adj: Map<string, { outgoing: Reference[]; incoming: Reference[] }>,
  ): Set<string> {
    const visited = new Set<string>([start]);
    let frontier = [start];

    for (let d = 0; d < depth; d++) {
      const nextFrontier: string[] = [];
      for (const nodeId of frontier) {
        const entry = adj.get(nodeId);
        if (!entry) continue;
        for (const ref of entry.outgoing) {
          if (!visited.has(ref.target)) {
            visited.add(ref.target);
            nextFrontier.push(ref.target);
          }
        }
        for (const ref of entry.incoming) {
          if (!visited.has(ref.source)) {
            visited.add(ref.source);
            nextFrontier.push(ref.source);
          }
        }
      }
      frontier = nextFrontier;
    }

    return visited;
  }
}
