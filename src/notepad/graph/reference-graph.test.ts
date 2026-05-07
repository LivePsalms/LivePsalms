import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ReferenceGraph } from './reference-graph';
import type { ReferenceGraphState } from './reference-graph';
import { createInMemoryStorage } from './in-memory-storage';
import { createInMemoryVerseFetcher } from './in-memory-verse-fetcher';
import { FakeStorageAdapter } from '../collection/fake-storage-adapter';
import type { Reference, ScriptureNode } from './types';

// Storage cache key constants (match the production literals exactly).
const REFERENCES_KEY = 'notepad_graph_references';
const SCRIPTURE_NODES_KEY = 'notepad_scripture_nodes';

// --- Helpers ---

function makeRef(overrides: Partial<Reference> = {}): Reference {
  return {
    id: 'ref-1',
    source: 'a',
    target: 'b',
    type: 'explicit',
    weight: 1.0,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeNode(overrides: Partial<ScriptureNode> = {}): ScriptureNode {
  return {
    id: 'node-1',
    book: 'Psalms',
    chapter: 23,
    verseStart: 1,
    verseEnd: null,
    translation: 'ESV',
    text: 'The LORD is my shepherd.',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function seedCache(
  storage: ReturnType<typeof createInMemoryStorage>,
  state: Partial<ReferenceGraphState>,
): void {
  if (state.references !== undefined) {
    storage.setItem(REFERENCES_KEY, JSON.stringify(state.references));
  }
  if (state.scriptureNodes !== undefined) {
    storage.setItem(SCRIPTURE_NODES_KEY, JSON.stringify(state.scriptureNodes));
  }
}

// --- Tests ---

describe('ReferenceGraph — skeleton', () => {
  let adapter: FakeStorageAdapter;
  let fetchVerse: ReturnType<typeof createInMemoryVerseFetcher>;
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    adapter = new FakeStorageAdapter();
    fetchVerse = createInMemoryVerseFetcher({});
    storage = createInMemoryStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  describe('empty-state behavior on construction (no cached data)', () => {
    it('starts with empty references and scriptureNodes', () => {
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);
      const state = graph.getSnapshot();
      expect(state.references).toEqual([]);
      expect(state.scriptureNodes).toEqual([]);
    });

    it('getReferences() returns an empty array', () => {
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);
      expect(graph.getReferences()).toEqual([]);
    });

    it('getScriptureNodes() returns an empty array', () => {
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);
      expect(graph.getScriptureNodes()).toEqual([]);
    });

    it('getReferencesBy({}) returns an empty array', () => {
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);
      expect(graph.getReferencesBy({})).toEqual([]);
    });

    it('getReferencesBy({ source: "x" }) returns an empty array', () => {
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);
      expect(graph.getReferencesBy({ source: 'x' })).toEqual([]);
    });

    it('getScriptureNode("anything") returns null', () => {
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);
      expect(graph.getScriptureNode('anything')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  describe('hydration on construction (with seeded cached data)', () => {
    it('loads references and scriptureNodes from cache', () => {
      const ref = makeRef({ id: 'ref-seeded' });
      const node = makeNode({ id: 'node-seeded' });
      seedCache(storage, { references: [ref], scriptureNodes: [node] });

      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      expect(graph.getReferences()).toEqual([ref]);
      expect(graph.getScriptureNodes()).toEqual([node]);
    });

    it('getScriptureNode("seeded-id") returns the seeded node', () => {
      const node = makeNode({ id: 'seeded-id' });
      seedCache(storage, { references: [], scriptureNodes: [node] });

      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      expect(graph.getScriptureNode('seeded-id')).toEqual(node);
    });

    it('getScriptureNode returns null for an id not in the seeded set', () => {
      const node = makeNode({ id: 'seeded-id' });
      seedCache(storage, { references: [], scriptureNodes: [node] });

      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      expect(graph.getScriptureNode('missing-id')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  describe('hydration handles malformed cache gracefully', () => {
    it('does not throw when notepad_graph_references contains invalid JSON', () => {
      // Both keys are parsed inside one try/catch, so a bad references value
      // causes the whole block to be caught — both arrays stay empty.
      storage.setItem(REFERENCES_KEY, '{not json');
      storage.setItem(SCRIPTURE_NODES_KEY, JSON.stringify([makeNode()]));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => new ReferenceGraph(adapter, fetchVerse, storage)).not.toThrow();
    });

    it('emits a console.warn on malformed cache', () => {
      storage.setItem(REFERENCES_KEY, '{not json');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      new ReferenceGraph(adapter, fetchVerse, storage);

      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('state stays fully empty when notepad_graph_references is malformed', () => {
      // Because hydrateFromCache uses a single try/catch around both parses,
      // a bad references value skips the entire hydration — including any valid
      // scriptureNodes that were also seeded.
      storage.setItem(REFERENCES_KEY, '{not json');
      storage.setItem(SCRIPTURE_NODES_KEY, JSON.stringify([makeNode()]));

      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      expect(graph.getReferences()).toEqual([]);
      expect(graph.getScriptureNodes()).toEqual([]);
    });

    it('references are empty when only notepad_scripture_nodes is seeded', () => {
      // Seeding only one key is not malformed — the missing key returns null and
      // the absent parse branch defaults to []. Both arrays live in one try/catch
      // so this does NOT throw.
      seedCache(storage, { scriptureNodes: [makeNode({ id: 'n1' })] });

      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      expect(graph.getReferences()).toEqual([]);
      expect(graph.getScriptureNodes()).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  describe('getReferencesBy filter behavior', () => {
    let graph: ReferenceGraph;

    beforeEach(() => {
      const refs = [
        makeRef({ id: 'r1', source: 'a', target: 'b' }),
        makeRef({ id: 'r2', source: 'a', target: 'c' }),
        makeRef({ id: 'r3', source: 'x', target: 'b' }),
        makeRef({ id: 'r4', source: 'x', target: 'c' }),
      ];
      seedCache(storage, { references: refs, scriptureNodes: [] });
      graph = new ReferenceGraph(adapter, fetchVerse, storage);
    });

    it('getReferencesBy({}) returns all references', () => {
      expect(graph.getReferencesBy({})).toHaveLength(4);
    });

    it('getReferencesBy({ source: "a" }) returns only refs with source "a"', () => {
      const result = graph.getReferencesBy({ source: 'a' });
      expect(result).toHaveLength(2);
      expect(result.every((r) => r.source === 'a')).toBe(true);
    });

    it('getReferencesBy({ target: "b" }) returns only refs with target "b"', () => {
      const result = graph.getReferencesBy({ target: 'b' });
      expect(result).toHaveLength(2);
      expect(result.every((r) => r.target === 'b')).toBe(true);
    });

    it('getReferencesBy({ source: "a", target: "b" }) returns refs matching both', () => {
      const result = graph.getReferencesBy({ source: 'a', target: 'b' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('r1');
    });

    it('getReferencesBy({ source: "a", target: "b" }) excludes refs that only match one field', () => {
      const result = graph.getReferencesBy({ source: 'a', target: 'b' });
      expect(result.some((r) => r.id === 'r2')).toBe(false); // source matches, target doesn't
      expect(result.some((r) => r.id === 'r3')).toBe(false); // target matches, source doesn't
    });

    it('getReferencesBy with a non-existent source returns an empty array', () => {
      expect(graph.getReferencesBy({ source: 'no-such-source' })).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  describe('subscribe / getSnapshot mechanics', () => {
    it('getSnapshot() returns the current state object', () => {
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);
      const snap = graph.getSnapshot();
      expect(snap).toHaveProperty('references');
      expect(snap).toHaveProperty('scriptureNodes');
    });

    it('subscribe does not crash on empty graph', () => {
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);
      expect(() => graph.subscribe(() => {})).not.toThrow();
    });

    it('subscribe returns an unsubscribe function', () => {
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);
      const unsub = graph.subscribe(() => {});
      expect(typeof unsub).toBe('function');
      expect(() => unsub()).not.toThrow();
    });

    it('rebindAdapter notifies subscribers when state was non-empty', () => {
      const ref = makeRef({ id: 'r1' });
      seedCache(storage, { references: [ref], scriptureNodes: [] });
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const listener = vi.fn();
      graph.subscribe(listener);

      const nextAdapter = new FakeStorageAdapter();
      graph.rebindAdapter(nextAdapter);

      // State transitioned from non-empty → EMPTY_STATE, so listener fires once.
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  describe('rebindAdapter resets state', () => {
    it('transitions state to empty after rebindAdapter', () => {
      const ref = makeRef({ id: 'r1' });
      seedCache(storage, { references: [ref], scriptureNodes: [] });
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);
      expect(graph.getReferences()).toHaveLength(1);

      graph.rebindAdapter(new FakeStorageAdapter());

      expect(graph.getReferences()).toEqual([]);
      expect(graph.getScriptureNodes()).toEqual([]);
    });

    it('rewrites cache to empty arrays after rebindAdapter', () => {
      // update() → setState triggers writeCache(EMPTY_STATE) because
      // next (EMPTY_STATE) !== prev (hydrated state).
      const ref = makeRef({ id: 'r1' });
      seedCache(storage, { references: [ref], scriptureNodes: [] });
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      graph.rebindAdapter(new FakeStorageAdapter());

      expect(storage.getItem(REFERENCES_KEY)).toBe(JSON.stringify([]));
      expect(storage.getItem(SCRIPTURE_NODES_KEY)).toBe(JSON.stringify([]));
    });

    it('rebindAdapter on an already-empty graph does not notify subscribers', () => {
      // EMPTY_STATE === EMPTY_STATE (same object reference), so setState short-circuits.
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);
      const listener = vi.fn();
      graph.subscribe(listener);

      graph.rebindAdapter(new FakeStorageAdapter());

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
