/**
 * ReferenceGraph — owns the reference edge list and scripture-node cache.
 *
 * Constructor takes three required parameters:
 *   adapter      — storage back-end (swappable via rebindAdapter)
 *   fetchVerse   — async verse resolver (used in Task 5 sync; unused here)
 *   cacheStorage — a Pick<Storage, 'getItem'|'setItem'> impl so the class is
 *                  testable without a DOM.  Pass `localStorage` in production;
 *                  pass `createInMemoryStorage()` in tests.
 *
 * Sync / fetchVerse logic is deferred to Task 5.
 */
import { Observable } from '../collection/observable';
import type { StorageAdapter } from '../storage/adapter';
import type { Reference, ScriptureNode } from './types';

export type VerseFetcher = (ref: string) => Promise<{ text: string; translation: string } | null>;

export interface ReferenceGraphState {
  references: Reference[];
  scriptureNodes: ScriptureNode[];
}

const REFERENCES_KEY = 'notepad_graph_references';
// Key value matches the existing scripture-store cache (do not rename — would orphan cached data).
const SCRIPTURE_NODES_KEY = 'notepad_scripture_nodes';

const EMPTY_STATE: ReferenceGraphState = { references: [], scriptureNodes: [] };

export class ReferenceGraph extends Observable<ReferenceGraphState> {
  private adapter: StorageAdapter;
  private fetchVerse: VerseFetcher;
  private cache: Pick<Storage, 'getItem' | 'setItem'>;

  constructor(
    adapter: StorageAdapter,
    fetchVerse: VerseFetcher,
    cacheStorage: Pick<Storage, 'getItem' | 'setItem'>,
  ) {
    super(EMPTY_STATE);
    this.adapter = adapter;
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

  rebindAdapter(next: StorageAdapter): void {
    this.adapter = next;
    this.update(() => EMPTY_STATE);
    // Note: cache is NOT rewritten here — Task 5's init() handles freshening.
  }

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
}
