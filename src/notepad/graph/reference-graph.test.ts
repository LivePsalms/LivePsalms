import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ReferenceGraph } from './reference-graph';
import type { ReferenceGraphState, VerseFetcher } from './reference-graph';
import { createInMemoryStorage } from './in-memory-storage';
import { createInMemoryVerseFetcher } from './in-memory-verse-fetcher';
import { FakeStorageAdapter } from '../collection/fake-storage-adapter';
import type { Reference, ScriptureNode } from './types';
import type { Note } from '../types';

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

      vi.spyOn(console, 'warn').mockImplementation(() => {});

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

// ---------------------------------------------------------------------------
// Helpers for sync-behavior tests
// ---------------------------------------------------------------------------

/**
 * Builds a minimal Note object. Pass `content` as a JSON-stringified TipTap
 * doc, or omit it for an empty note.
 */
function makeNote(overrides: Partial<Note> & Pick<Note, 'id'>): Note {
  return {
    title: 'Test Note',
    content: '',
    folderId: 'root',
    type: 'devotion',
    tags: [],
    wordCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Builds a TipTap doc (JSON-stringified) containing a single paragraph whose
 * text node carries a `noteLink` mark targeting `targetNoteId`.
 */
function makeNoteLinkContent(targetNoteId: string): string {
  return JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'See also',
            marks: [
              {
                type: 'noteLink',
                attrs: { noteId: targetNoteId },
              },
            ],
          },
        ],
      },
    ],
  });
}

/**
 * Builds a TipTap doc (JSON-stringified) containing a single paragraph whose
 * text contains the given plain string (e.g. a verse reference).
 */
function makePlainTextContent(text: string): string {
  return JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Main sync-behavior suite
// ---------------------------------------------------------------------------

describe('ReferenceGraph — sync behavior', () => {
  let adapter: FakeStorageAdapter;
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    adapter = new FakeStorageAdapter();
    storage = createInMemoryStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  describe('a. syncNote idempotency', () => {
    it('calling syncNote twice with the same content produces identical references (same ids and createdAt)', async () => {
      const fetchVerse = createInMemoryVerseFetcher({});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const note = makeNote({
        id: 'note-1',
        content: makeNoteLinkContent('note-2'),
      });

      await graph.syncNote(note);
      // Deep-clone the snapshot to protect against mutation.
      const snapshotAfterFirst = JSON.parse(JSON.stringify(graph.getReferences())) as Reference[];

      await graph.syncNote(note);
      const snapshotAfterSecond = graph.getReferences();

      expect(snapshotAfterSecond).toEqual(snapshotAfterFirst);
    });

    it('syncNote twice does not duplicate references', async () => {
      const fetchVerse = createInMemoryVerseFetcher({});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const note = makeNote({
        id: 'note-1',
        content: makeNoteLinkContent('note-2'),
      });

      await graph.syncNote(note);
      const countAfterFirst = graph.getReferences().length;

      await graph.syncNote(note);
      expect(graph.getReferences()).toHaveLength(countAfterFirst);
    });
  });

  // -------------------------------------------------------------------------
  describe('b. removing a noteLink from content removes the Reference on next sync', () => {
    it('after removing a noteLink the explicit reference is gone', async () => {
      const fetchVerse = createInMemoryVerseFetcher({});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const noteV1 = makeNote({
        id: 'note-1',
        content: makeNoteLinkContent('note-2'),
      });

      await graph.syncNote(noteV1);
      // Confirm the ref exists.
      expect(graph.getReferencesBy({ source: 'note-1' })).toHaveLength(1);

      // Version 2: same id, noteLink removed.
      const noteV2 = makeNote({
        id: 'note-1',
        content: makePlainTextContent('No links here.'),
      });

      await graph.syncNote(noteV2);

      const refs = graph.getReferencesBy({ source: 'note-1' });
      const explicitRefs = refs.filter((r) => r.type === 'explicit');
      expect(explicitRefs).toHaveLength(0);
    });

    it('other notes\' references are unaffected when a noteLink is removed from one note', async () => {
      const fetchVerse = createInMemoryVerseFetcher({});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const noteA = makeNote({ id: 'note-A', content: makeNoteLinkContent('note-B') });
      const noteC = makeNote({ id: 'note-C', content: makeNoteLinkContent('note-B') });

      await graph.syncNote(noteA);
      await graph.syncNote(noteC);

      // Remove link from noteA.
      const noteAv2 = makeNote({ id: 'note-A', content: makePlainTextContent('no link') });
      await graph.syncNote(noteAv2);

      // noteC's ref to note-B should still exist.
      expect(graph.getReferencesBy({ source: 'note-C' })).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('c. new verse reference creates a ScriptureNode and triggers TSK expansion', () => {
    it('syncing a note with "Romans 8:28" creates a scripture node with fetched text', async () => {
      const fetchVerse = createInMemoryVerseFetcher({
        'Romans 8:28': { text: 'For we know that all things work together for good', translation: 'WEB' },
      });
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const note = makeNote({
        id: 'note-1',
        content: makePlainTextContent('Romans 8:28'),
      });

      await graph.syncNote(note);

      const node = graph.getScriptureNode('scripture:ro-8-28');
      expect(node).not.toBeNull();
      expect(node!.text).toBe('For we know that all things work together for good');
      expect(node!.translation).toBe('WEB');
    });

    it('syncing a note with "Romans 8:28" creates a scripture-reference Reference', async () => {
      const fetchVerse = createInMemoryVerseFetcher({
        'Romans 8:28': { text: 'For we know...', translation: 'WEB' },
      });
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const note = makeNote({
        id: 'note-1',
        content: makePlainTextContent('Romans 8:28'),
      });

      await graph.syncNote(note);

      const refs = graph.getReferencesBy({ source: 'note-1' });
      const scriptureRef = refs.find(
        (r) => r.type === 'scripture-reference' && r.target === 'scripture:ro-8-28',
      );
      expect(scriptureRef).toBeDefined();
      expect(scriptureRef!.id).toBe('note-1|scripture:ro-8-28|scripture-reference');
    });

    it('TSK expansion: pre-seeding scripture:1jn-4-19 then syncing Romans 8:28 creates a cross-reference', async () => {
      // TSK pairing used: tsk-data.json has "ro-8-28": [..., "1jn-4-19", ...]
      // meaning ro-8-28 cross-references 1jn-4-19.
      // Strategy: seed scripture:1jn-4-19 in the cache, then sync a note containing
      // "Romans 8:28". The newly-created scripture:ro-8-28 node will check its TSK
      // entries for existing nodes and find scripture:1jn-4-19 → creates:
      //   cross-reference: scripture:ro-8-28 → scripture:1jn-4-19
      const existingNode = makeNode({
        id: 'scripture:1jn-4-19',
        book: '1 John',
        chapter: 4,
        verseStart: 19,
        verseEnd: null,
        translation: 'WEB',
        text: 'We love him because he first loved us.',
      });
      seedCache(storage, { references: [], scriptureNodes: [existingNode] });

      const fetchVerse = createInMemoryVerseFetcher({
        'Romans 8:28': { text: 'For we know...', translation: 'WEB' },
      });
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const note = makeNote({ id: 'note-1', content: makePlainTextContent('Romans 8:28') });
      await graph.syncNote(note);

      const crossRef = graph
        .getReferences()
        .find(
          (r) =>
            r.type === 'cross-reference' &&
            r.source === 'scripture:ro-8-28' &&
            r.target === 'scripture:1jn-4-19',
        );
      expect(crossRef).toBeDefined();
      expect(crossRef!.id).toBe('scripture:ro-8-28|scripture:1jn-4-19|cross-reference');
    });

    it('TSK expansion (bidirectional): pre-seeding scripture:eph-1-9 and syncing Romans 8:28 produces cross-refs in both directions', async () => {
      // TSK pairing used: "ro-8-28" includes "eph-1-9" AND "eph-1-9" includes "ro-8-28"
      // (confirmed bidirectional in tsk-data.json)
      const existingNode = makeNode({
        id: 'scripture:eph-1-9',
        book: 'Ephesians',
        chapter: 1,
        verseStart: 9,
        verseEnd: null,
        translation: 'WEB',
        text: 'having made known to us the mystery of his will',
      });
      seedCache(storage, { references: [], scriptureNodes: [existingNode] });

      const fetchVerse = createInMemoryVerseFetcher({
        'Romans 8:28': { text: 'For we know...', translation: 'WEB' },
      });
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const note = makeNote({ id: 'note-1', content: makePlainTextContent('Romans 8:28') });
      await graph.syncNote(note);

      const refs = graph.getReferences();
      // ro-8-28's TSK contains eph-1-9 → forward cross-ref
      const forward = refs.find(
        (r) =>
          r.type === 'cross-reference' &&
          r.source === 'scripture:ro-8-28' &&
          r.target === 'scripture:eph-1-9',
      );
      // eph-1-9's TSK contains ro-8-28 → existing node points to new node
      const reverse = refs.find(
        (r) =>
          r.type === 'cross-reference' &&
          r.source === 'scripture:eph-1-9' &&
          r.target === 'scripture:ro-8-28',
      );

      expect(forward).toBeDefined();
      expect(reverse).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  describe('d. fetchVerse failure produces empty-text ScriptureNode (no thrown error)', () => {
    it('an empty fetcher map produces a ScriptureNode with empty text', async () => {
      const fetchVerse = createInMemoryVerseFetcher({});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const note = makeNote({ id: 'note-1', content: makePlainTextContent('Romans 8:28') });

      await expect(graph.syncNote(note)).resolves.toBeUndefined();

      const node = graph.getScriptureNode('scripture:ro-8-28');
      expect(node).not.toBeNull();
      expect(node!.text).toBe('');
    });

    it('a fetcher that throws creates an empty-text ScriptureNode and does not throw', async () => {
      const throwingFetcher: VerseFetcher = vi.fn().mockRejectedValue(new Error('Network error'));
      const graph = new ReferenceGraph(adapter, throwingFetcher, storage);

      const note = makeNote({ id: 'note-1', content: makePlainTextContent('Romans 8:28') });

      await expect(graph.syncNote(note)).resolves.toBeUndefined();

      const node = graph.getScriptureNode('scripture:ro-8-28');
      expect(node).not.toBeNull();
      expect(node!.text).toBe('');
    });

    it('sync still creates the scripture-reference edge even when fetch fails', async () => {
      const fetchVerse = createInMemoryVerseFetcher({});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const note = makeNote({ id: 'note-1', content: makePlainTextContent('Romans 8:28') });
      await graph.syncNote(note);

      const refs = graph.getReferencesBy({ source: 'note-1' });
      expect(refs.some((r) => r.type === 'scripture-reference')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('e. refreshVerseText populates text retroactively for an empty-text node', () => {
    it('refreshVerseText fills in text on a previously empty ScriptureNode', async () => {
      // Setup: seed an empty-text node into the cache so the graph loads it.
      const emptyNode = makeNode({
        id: 'scripture:ro-8-28',
        book: 'Romans',
        chapter: 8,
        verseStart: 28,
        verseEnd: null,
        translation: 'WEB',
        text: '',
      });
      seedCache(storage, { references: [], scriptureNodes: [emptyNode] });

      // Fetcher that now returns text.
      const fetchVerse = createInMemoryVerseFetcher({
        'Romans 8:28': { text: 'For we know that all things work together for good', translation: 'WEB' },
      });
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      // Pre-check: text is empty.
      expect(graph.getScriptureNode('scripture:ro-8-28')!.text).toBe('');

      await graph.refreshVerseText('scripture:ro-8-28');

      expect(graph.getScriptureNode('scripture:ro-8-28')!.text).toBe(
        'For we know that all things work together for good',
      );
    });

    it('refreshVerseText is a no-op when the node does not exist', async () => {
      const fetchVerse = createInMemoryVerseFetcher({
        'Romans 8:28': { text: 'For we know...', translation: 'WEB' },
      });
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      // Should not throw.
      await expect(graph.refreshVerseText('scripture:ro-8-28')).resolves.toBeUndefined();
    });

    it('refreshVerseText keeps existing text if fetcher returns null', async () => {
      const existingNode = makeNode({
        id: 'scripture:ro-8-28',
        book: 'Romans',
        chapter: 8,
        verseStart: 28,
        verseEnd: null,
        translation: 'WEB',
        text: 'existing text',
      });
      seedCache(storage, { references: [], scriptureNodes: [existingNode] });

      const fetchVerse = createInMemoryVerseFetcher({});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      await graph.refreshVerseText('scripture:ro-8-28');

      expect(graph.getScriptureNode('scripture:ro-8-28')!.text).toBe('existing text');
    });

    it('refreshVerseText does not emit when fetcher returns null', async () => {
      const existingNode = makeNode({
        id: 'scripture:ro-8-28',
        book: 'Romans',
        chapter: 8,
        verseStart: 28,
        verseEnd: null,
        translation: 'WEB',
        text: '',
      });
      seedCache(storage, { references: [], scriptureNodes: [existingNode] });

      const fetchVerse = createInMemoryVerseFetcher({});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const listener = vi.fn();
      graph.subscribe(listener);

      await graph.refreshVerseText('scripture:ro-8-28');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('f. deleteReferencesFor removes both incoming and outgoing references', () => {
    it('deleteReferencesFor removes outgoing references from the deleted node', async () => {
      const fetchVerse = createInMemoryVerseFetcher({});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      // A → B and B → A so both directions exist.
      const noteA = makeNote({ id: 'note-A', content: makeNoteLinkContent('note-B') });
      const noteB = makeNote({ id: 'note-B', content: makeNoteLinkContent('note-A') });

      await graph.syncNote(noteA);
      await graph.syncNote(noteB);

      // Confirm both refs are present before deletion.
      expect(graph.getReferencesBy({ source: 'note-A' })).toHaveLength(1);
      expect(graph.getReferencesBy({ source: 'note-B' })).toHaveLength(1);

      graph.deleteReferencesFor('note-A');

      // Outgoing ref from note-A is gone.
      expect(graph.getReferencesBy({ source: 'note-A' })).toHaveLength(0);
    });

    it('deleteReferencesFor removes incoming references targeting the deleted node', async () => {
      const fetchVerse = createInMemoryVerseFetcher({});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const noteA = makeNote({ id: 'note-A', content: makeNoteLinkContent('note-B') });
      const noteB = makeNote({ id: 'note-B', content: makeNoteLinkContent('note-A') });

      await graph.syncNote(noteA);
      await graph.syncNote(noteB);

      graph.deleteReferencesFor('note-A');

      // Incoming ref from note-B targeting note-A is also gone.
      expect(graph.getReferencesBy({ target: 'note-A' })).toHaveLength(0);
    });

    it('deleteReferencesFor leaves unrelated references intact', async () => {
      const fetchVerse = createInMemoryVerseFetcher({});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const noteA = makeNote({ id: 'note-A', content: makeNoteLinkContent('note-B') });
      const noteB = makeNote({ id: 'note-B', content: makeNoteLinkContent('note-A') });
      const noteC = makeNote({ id: 'note-C', content: makeNoteLinkContent('note-D') });

      await graph.syncNote(noteA);
      await graph.syncNote(noteB);
      await graph.syncNote(noteC);

      graph.deleteReferencesFor('note-A');

      // C → D reference is unrelated and should survive.
      expect(graph.getReferencesBy({ source: 'note-C' })).toHaveLength(1);
    });

    it('deleteReferencesFor is synchronous and emits once', async () => {
      const fetchVerse = createInMemoryVerseFetcher({});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const noteA = makeNote({ id: 'note-A', content: makeNoteLinkContent('note-B') });
      await graph.syncNote(noteA);

      const listener = vi.fn();
      graph.subscribe(listener);

      graph.deleteReferencesFor('note-A');

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('g. syncAll emits exactly once for the whole batch', () => {
    it('syncAll([noteA, noteB, noteC]) emits exactly once', async () => {
      const fetchVerse = createInMemoryVerseFetcher({});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const listener = vi.fn();
      graph.subscribe(listener);

      const noteA = makeNote({ id: 'note-A', content: makeNoteLinkContent('note-B') });
      const noteB = makeNote({ id: 'note-B', content: makeNoteLinkContent('note-C') });
      const noteC = makeNote({ id: 'note-C', content: makeNoteLinkContent('note-A') });

      await graph.syncAll([noteA, noteB, noteC]);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('syncAll processes all notes and accumulates references', async () => {
      const fetchVerse = createInMemoryVerseFetcher({});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      const noteA = makeNote({ id: 'note-A', content: makeNoteLinkContent('note-B') });
      const noteB = makeNote({ id: 'note-B', content: makeNoteLinkContent('note-C') });
      const noteC = makeNote({ id: 'note-C', content: makeNoteLinkContent('note-A') });

      await graph.syncAll([noteA, noteB, noteC]);

      // Three explicit note→note refs should exist.
      expect(graph.getReferences().filter((r) => r.type === 'explicit')).toHaveLength(3);
    });

    it('syncAll with an empty array does not throw', async () => {
      const fetchVerse = createInMemoryVerseFetcher({});
      const graph = new ReferenceGraph(adapter, fetchVerse, storage);

      await expect(graph.syncAll([])).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  describe('h. getNeighborhood depth-1 vs depth-2', () => {
    /**
     * Build a chain: A→B, B→C, C→D via seeded references in the cache.
     * Note: getNeighborhood uses BFS on both incoming and outgoing edges,
     * so direction from a chain still satisfies depth requirements.
     */
    let chainGraph: ReferenceGraph;

    beforeEach(() => {
      const refs: Reference[] = [
        makeRef({ id: 'A|B|explicit', source: 'A', target: 'B', type: 'explicit' }),
        makeRef({ id: 'B|C|explicit', source: 'B', target: 'C', type: 'explicit' }),
        makeRef({ id: 'C|D|explicit', source: 'C', target: 'D', type: 'explicit' }),
      ];
      const chainStorage = createInMemoryStorage();
      seedCache(chainStorage, { references: refs, scriptureNodes: [] });
      chainGraph = new ReferenceGraph(adapter, createInMemoryVerseFetcher({}), chainStorage);
    });

    it('getNeighborhood("A", 1) returns {A, B}', () => {
      const result = chainGraph.getNeighborhood('A', 1);
      expect(result).toEqual(new Set(['A', 'B']));
    });

    it('getNeighborhood("A", 2) returns {A, B, C}', () => {
      const result = chainGraph.getNeighborhood('A', 2);
      expect(result).toEqual(new Set(['A', 'B', 'C']));
    });

    it('getNeighborhood("A", 3) returns {A, B, C, D}', () => {
      const result = chainGraph.getNeighborhood('A', 3);
      expect(result).toEqual(new Set(['A', 'B', 'C', 'D']));
    });

    it('getNeighborhood("B", 1) returns {A, B, C} (bidirectional BFS)', () => {
      // B has both an incoming edge from A and an outgoing edge to C.
      const result = chainGraph.getNeighborhood('B', 1);
      expect(result).toEqual(new Set(['A', 'B', 'C']));
    });

    it('getNeighborhood of an isolated node returns a set containing only that node', () => {
      const result = chainGraph.getNeighborhood('isolated', 1);
      expect(result).toEqual(new Set(['isolated']));
    });

    it('getNeighborhood("A", 0) returns {A} only', () => {
      const result = chainGraph.getNeighborhood('A', 0);
      expect(result).toEqual(new Set(['A']));
    });
  });
});
