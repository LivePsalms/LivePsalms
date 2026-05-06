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
