import { describe, it, expect } from 'vitest';
import { ConnectionDiscovery } from './connection-discovery';
import type { ConnectionDiscoveryDeps, ConnectionDiscoveryInputs } from './connection-discovery';
import { FakeLamplightAdapter } from '../storage/fake-lamplight-adapter';
import type { ConnectionNeighbor } from '../storage/lamplight-adapter';
import type { Note } from '../types';

// A macrotask boundary; the microtask queue (all chained awaits) drains first.
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function makeContent(text: string): string {
  return JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
}

function fakeNote(over: Partial<Note>): Note {
  return {
    id: 'note-1', title: 'Untitled', content: makeContent('word '.repeat(150).trim()),
    folderId: 'folder-1', type: 'devotion', tags: [], wordCount: 150,
    createdAt: '2026-05-27T00:00:00.000Z', updatedAt: '2026-05-27T00:00:00.000Z', ...over,
  };
}

const INPUTS: ConnectionDiscoveryInputs = {
  activeNote: fakeNote({ id: 'note-1' }),
  totalNoteCount: 50, minWords: 10, minVaultSize: 2, minSimilarity: 0.78,
  maxRenderedCards: 3, neighborK: 5,
};

function depsFromAdapter(adapter: FakeLamplightAdapter): ConnectionDiscoveryDeps {
  return {
    hasNoteEmbedding: (id) => adapter.hasNoteEmbedding(id),
    getConnectionNeighbors: (id, k, sim) => adapter.getConnectionNeighbors(id, k, sim),
    loadNeighborNotes: async (ids) => ids.map((id) => fakeNote({ id, title: `Note ${id}` })),
  };
}

describe('ConnectionDiscovery', () => {
  it('emits inactive (note_too_short) without touching the adapter', async () => {
    const c = new ConnectionDiscovery(depsFromAdapter(new FakeLamplightAdapter()), 'full');
    c.setInputs({ ...INPUTS, activeNote: fakeNote({ content: makeContent('too short') }) });
    await tick();
    expect(c.getSnapshot()).toEqual({ phase: 'inactive', reason: 'note_too_short', meetsDepth: false, meetsVault: true });
  });

  it('emits waiting_for_embedding when the note has no embedding', async () => {
    const c = new ConnectionDiscovery(depsFromAdapter(new FakeLamplightAdapter()), 'full');
    c.setInputs(INPUTS);
    await tick();
    expect(c.getSnapshot()).toEqual({ phase: 'waiting_for_embedding' });
  });

  it('emits no_connections when the embedded note has zero neighbors', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    const c = new ConnectionDiscovery(depsFromAdapter(adapter), 'full');
    c.setInputs(INPUTS);
    await tick();
    expect(c.getSnapshot()).toEqual({ phase: 'no_connections' });
  });

  it('full mode assembles cards (title fallback + signal caps)', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [{ relatedNoteId: 'note-2', similarity: 0.95 }]);
    const c = new ConnectionDiscovery(depsFromAdapter(adapter), 'full');
    c.setInputs(INPUTS);
    await tick();
    const state = c.getSnapshot();
    expect(state.phase).toBe('ready');
    if (state.phase !== 'ready') throw new Error('expected ready');
    expect(state.cards).toEqual([
      { relatedNoteId: 'note-2', relatedNoteTitle: 'Note note-2', similarity: 0.95, sharedTags: [], sharedVerseRefs: [] },
    ]);
  });

  it('presence mode stops at the neighbor count without loading notes', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
      { relatedNoteId: 'note-3', similarity: 0.9 },
    ]);
    let loadCalls = 0;
    const deps: ConnectionDiscoveryDeps = {
      ...depsFromAdapter(adapter),
      loadNeighborNotes: async (ids) => { loadCalls++; return ids.map((id) => fakeNote({ id })); },
    };
    const c = new ConnectionDiscovery(deps, 'presence');
    c.setInputs(INPUTS);
    await tick();
    expect(c.getSnapshot()).toEqual({ phase: 'present', count: 2 });
    expect(loadCalls).toBe(0);
  });

  it('maps a neighbor-fetch failure to error/network', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__failNextGetConnectionNeighbors();
    const c = new ConnectionDiscovery(depsFromAdapter(adapter), 'full');
    c.setInputs(INPUTS);
    await tick();
    expect(c.getSnapshot()).toEqual({ phase: 'error', reason: 'network' });
  });

  it('fences a stale run: a second setInputs wins even if the first resolves later', async () => {
    let releaseFirst!: (v: ConnectionNeighbor[]) => void;
    const firstNeighbors = new Promise<ConnectionNeighbor[]>((res) => { releaseFirst = res; });
    let call = 0;
    const deps: ConnectionDiscoveryDeps = {
      hasNoteEmbedding: async () => true,
      getConnectionNeighbors: (_id, _k, _sim) => {
        call++;
        // First run blocks on the deferred promise; second run resolves immediately.
        return call === 1 ? firstNeighbors : Promise.resolve([{ relatedNoteId: 'fresh', similarity: 0.99 }]);
      },
      loadNeighborNotes: async (ids) => ids.map((id) => fakeNote({ id, title: `Note ${id}` })),
    };
    const c = new ConnectionDiscovery(deps, 'full');

    c.setInputs(INPUTS);                 // first run: blocks on firstNeighbors
    await tick();
    c.setInputs(INPUTS);                 // second run: bumps generation, resolves fast
    await tick();
    releaseFirst([{ relatedNoteId: 'stale', similarity: 0.1 }]); // late resolve from run 1
    await tick();

    const state = c.getSnapshot();
    if (state.phase !== 'ready') throw new Error('expected ready');
    expect(state.cards.map((card) => card.relatedNoteId)).toEqual(['fresh']);
  });

  it('parks inactive when the active note is null (nullable-adapter park)', async () => {
    const c = new ConnectionDiscovery(depsFromAdapter(new FakeLamplightAdapter()), 'presence');
    c.setInputs({ ...INPUTS, activeNote: null });
    await tick();
    expect(c.getSnapshot()).toEqual({ phase: 'inactive', reason: 'no_active_note', meetsDepth: false, meetsVault: true });
  });
});
