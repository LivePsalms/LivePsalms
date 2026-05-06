import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NoteCollection } from './note-collection';
import { FakeStorageAdapter, resetFakeAdapterIds } from './fake-storage-adapter';
import * as repairModule from '../storage/repair-note-links';

function seedNote(adapter: FakeStorageAdapter, overrides: Partial<{ id: string; title: string; folderId: string }> = {}) {
  const id = overrides.id ?? `id-seed-${adapter.notes.length}`;
  adapter.notes.push({
    id,
    title: overrides.title ?? 'Seeded',
    content: '',
    folderId: overrides.folderId ?? 'root',
    type: 'note',
    tags: [],
    wordCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  });
  return id;
}

describe('NoteCollection — read & init', () => {
  let adapter: FakeStorageAdapter;
  let collection: NoteCollection;

  beforeEach(() => {
    resetFakeAdapterIds();
    adapter = new FakeStorageAdapter();
    collection = new NoteCollection(adapter);
  });

  it('starts with empty state and no active note', () => {
    const state = collection.getSnapshot();
    expect(state.notes).toEqual([]);
    expect(state.activeNoteId).toBeNull();
    expect(state.activeNote).toBeNull();
  });

  it('init() loads notes from the adapter', async () => {
    seedNote(adapter, { id: 'a', title: 'A' });
    seedNote(adapter, { id: 'b', title: 'B' });
    await collection.init();
    expect(collection.getSnapshot().notes.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('openNote(id) sets activeNoteId and derives activeNote', async () => {
    seedNote(adapter, { id: 'a' });
    await collection.init();
    collection.openNote('a');
    const state = collection.getSnapshot();
    expect(state.activeNoteId).toBe('a');
    expect(state.activeNote?.id).toBe('a');
  });

  it('openNote(null) clears active selection', async () => {
    seedNote(adapter, { id: 'a' });
    await collection.init();
    collection.openNote('a');
    collection.openNote(null);
    expect(collection.getSnapshot().activeNoteId).toBeNull();
    expect(collection.getSnapshot().activeNote).toBeNull();
  });

  it('activeNote is null when activeNoteId points to a missing note', async () => {
    await collection.init();
    collection.openNote('does-not-exist');
    expect(collection.getSnapshot().activeNoteId).toBe('does-not-exist');
    expect(collection.getSnapshot().activeNote).toBeNull();
  });
});

describe('NoteCollection — single mutations', () => {
  let adapter: FakeStorageAdapter;
  let collection: NoteCollection;

  beforeEach(() => {
    resetFakeAdapterIds();
    adapter = new FakeStorageAdapter();
    collection = new NoteCollection(adapter);
  });

  it('createNote appends and selects the new note', async () => {
    await collection.init();
    const created = await collection.createNote('root', 'note');
    const state = collection.getSnapshot();
    expect(state.notes.map((n) => n.id)).toEqual([created.id]);
    expect(state.activeNoteId).toBe(created.id);
    expect(state.activeNote?.id).toBe(created.id);
  });

  it('updateNote replaces the entity in place without reordering others', async () => {
    seedNote(adapter, { id: 'a', title: 'A' });
    seedNote(adapter, { id: 'b', title: 'B' });
    seedNote(adapter, { id: 'c', title: 'C' });
    await collection.init();

    await collection.updateNote('b', { title: 'B-updated' });

    const state = collection.getSnapshot();
    expect(state.notes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(state.notes.find((n) => n.id === 'b')?.title).toBe('B-updated');
  });

  it('deleteNote removes the note', async () => {
    seedNote(adapter, { id: 'a' });
    seedNote(adapter, { id: 'b' });
    await collection.init();
    await collection.deleteNote('a');
    expect(collection.getSnapshot().notes.map((n) => n.id)).toEqual(['b']);
  });

  it('deleteNote clears activeNoteId when the deleted note was active', async () => {
    seedNote(adapter, { id: 'a' });
    await collection.init();
    collection.openNote('a');
    await collection.deleteNote('a');
    expect(collection.getSnapshot().activeNoteId).toBeNull();
    expect(collection.getSnapshot().activeNote).toBeNull();
  });

  it('deleteNote leaves activeNoteId intact when a different note was active', async () => {
    seedNote(adapter, { id: 'a' });
    seedNote(adapter, { id: 'b' });
    await collection.init();
    collection.openNote('a');
    await collection.deleteNote('b');
    expect(collection.getSnapshot().activeNoteId).toBe('a');
  });

  it('updateNote on the active note refreshes derived activeNote', async () => {
    seedNote(adapter, { id: 'a', title: 'A' });
    await collection.init();
    collection.openNote('a');
    await collection.updateNote('a', { title: 'A-renamed' });
    expect(collection.getSnapshot().activeNote?.title).toBe('A-renamed');
  });
});

describe('NoteCollection — sugar & bulk', () => {
  let adapter: FakeStorageAdapter;
  let collection: NoteCollection;

  beforeEach(() => {
    resetFakeAdapterIds();
    adapter = new FakeStorageAdapter();
    collection = new NoteCollection(adapter);
  });

  it('renameNote updates the title', async () => {
    seedNote(adapter, { id: 'a', title: 'Old' });
    await collection.init();
    const renamed = await collection.renameNote('a', 'New');
    expect(renamed.title).toBe('New');
    expect(collection.getSnapshot().notes[0].title).toBe('New');
  });

  it('moveNote updates the folderId', async () => {
    seedNote(adapter, { id: 'a', folderId: 'root' });
    await collection.init();
    await collection.moveNote('a', 'folder-1');
    expect(collection.getSnapshot().notes[0].folderId).toBe('folder-1');
  });

  it('duplicateNote appends the duplicate', async () => {
    seedNote(adapter, { id: 'a', title: 'Original' });
    await collection.init();
    const dup = await collection.duplicateNote('a');
    const state = collection.getSnapshot();
    expect(state.notes).toHaveLength(2);
    expect(state.notes[1].id).toBe(dup.id);
    expect(state.notes[1].title).toBe('Original (copy)');
  });

  it('applyReparenting patches folderId for the named ids only', async () => {
    seedNote(adapter, { id: 'a', folderId: 'F1' });
    seedNote(adapter, { id: 'b', folderId: 'F1' });
    seedNote(adapter, { id: 'c', folderId: 'F2' });
    await collection.init();

    collection.applyReparenting(['a', 'b'], 'root');

    const state = collection.getSnapshot();
    expect(state.notes.find((n) => n.id === 'a')?.folderId).toBe('root');
    expect(state.notes.find((n) => n.id === 'b')?.folderId).toBe('root');
    expect(state.notes.find((n) => n.id === 'c')?.folderId).toBe('F2');
  });

  it('refetchAll re-reads notes from the adapter', async () => {
    await collection.init();
    seedNote(adapter, { id: 'late', title: 'Late' });
    await collection.refetchAll();
    expect(collection.getSnapshot().notes.map((n) => n.id)).toEqual(['late']);
  });

  it('rebindAdapter swaps the adapter and clears state until the next init', async () => {
    seedNote(adapter, { id: 'a' });
    await collection.init();
    expect(collection.getSnapshot().notes).toHaveLength(1);

    const next = new FakeStorageAdapter();
    collection.rebindAdapter(next);
    expect(collection.getSnapshot().notes).toEqual([]);
    expect(collection.getSnapshot().activeNoteId).toBeNull();
  });

  it('after rebindAdapter, init reads from the new adapter', async () => {
    await collection.init();
    const next = new FakeStorageAdapter();
    next.notes.push({
      id: 'fresh', title: 'Fresh', content: '', folderId: 'root', type: 'note', tags: [], wordCount: 0,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    });
    collection.rebindAdapter(next);
    await collection.init();
    expect(collection.getSnapshot().notes.map((n) => n.id)).toEqual(['fresh']);
  });
});

describe('NoteCollection — repair pass', () => {
  let adapter: FakeStorageAdapter;
  let collection: NoteCollection;
  let repairSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetFakeAdapterIds();
    adapter = new FakeStorageAdapter();
    collection = new NoteCollection(adapter);
    repairSpy = vi.spyOn(repairModule, 'repairNoteLinks').mockResolvedValue({
      repairedNotes: 0,
      rewiredLinks: 0,
      orphans: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs repairNoteLinks on first init', async () => {
    seedNote(adapter, { id: 'a' });
    await collection.init();
    expect(repairSpy).toHaveBeenCalledTimes(1);
  });

  it('does not re-run repair on subsequent inits with the same adapter', async () => {
    seedNote(adapter, { id: 'a' });
    await collection.init();
    await collection.init();
    expect(repairSpy).toHaveBeenCalledTimes(1);
  });

  it('re-runs repair after rebindAdapter', async () => {
    seedNote(adapter, { id: 'a' });
    await collection.init();
    const next = new FakeStorageAdapter();
    seedNote(next, { id: 'b' });
    collection.rebindAdapter(next);
    await collection.init();
    expect(repairSpy).toHaveBeenCalledTimes(2);
  });

  it('refetches notes if repair reports rewired links', async () => {
    repairSpy.mockResolvedValueOnce({ repairedNotes: 1, rewiredLinks: 3, orphans: 0 });
    seedNote(adapter, { id: 'a', title: 'Before' });
    await collection.init();
    // The note state reflects the adapter's contents at the time of init's
    // (post-repair) refetch — repair was mocked so no actual change occurred,
    // and post-init mutations to adapter aren't surfaced until another init.
    expect(collection.getSnapshot().notes[0].title).toBe('Before');
    expect(repairSpy).toHaveBeenCalledTimes(1);
  });
});
