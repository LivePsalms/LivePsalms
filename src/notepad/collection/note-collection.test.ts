import { describe, it, expect, beforeEach } from 'vitest';
import { NoteCollection } from './note-collection';
import { FakeStorageAdapter, resetFakeAdapterIds } from './fake-storage-adapter';

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
