import { describe, it, expect, beforeEach } from 'vitest';
import { NoteCollection } from './note-collection';
import { FolderHierarchy } from './folder-hierarchy';
import { NotepadActions } from './notepad-actions';
import { FakeStorageAdapter, resetFakeAdapterIds } from './fake-storage-adapter';

function seedNote(adapter: FakeStorageAdapter, id: string, folderId: string) {
  adapter.notes.push({
    id, title: id, content: '', folderId, type: 'note', tags: [], wordCount: 0,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });
}

function seedFolder(adapter: FakeStorageAdapter, id: string) {
  adapter.folders.push({ id, name: id, parentId: null, order: adapter.folders.length });
}

describe('NotepadActions', () => {
  let adapter: FakeStorageAdapter;
  let notes: NoteCollection;
  let folders: FolderHierarchy;
  let actions: NotepadActions;

  beforeEach(() => {
    resetFakeAdapterIds();
    adapter = new FakeStorageAdapter();
    notes = new NoteCollection(adapter);
    folders = new FolderHierarchy(adapter);
    actions = new NotepadActions(adapter, notes, folders);
  });

  it('init cascades to both modules', async () => {
    seedNote(adapter, 'n1', 'root');
    seedFolder(adapter, 'f1');
    await actions.init();
    expect(notes.getSnapshot().notes.map((n) => n.id)).toEqual(['n1']);
    expect(folders.getSnapshot().folders.map((f) => f.id)).toEqual(['f1']);
  });

  it('deleteFolder reparents child notes to root and removes the folder', async () => {
    seedFolder(adapter, 'f1');
    seedNote(adapter, 'a', 'f1');
    seedNote(adapter, 'b', 'f1');
    seedNote(adapter, 'c', 'root');
    await actions.init();

    await actions.deleteFolder('f1');

    expect(folders.getSnapshot().folders.map((f) => f.id)).toEqual([]);
    const notesAfter = notes.getSnapshot().notes;
    expect(notesAfter.find((n) => n.id === 'a')?.folderId).toBe('root');
    expect(notesAfter.find((n) => n.id === 'b')?.folderId).toBe('root');
    expect(notesAfter.find((n) => n.id === 'c')?.folderId).toBe('root');
  });

  it('deleteFolder computes affected ids BEFORE deleting the folder', async () => {
    seedFolder(adapter, 'f1');
    seedNote(adapter, 'a', 'f1');
    await actions.init();

    await actions.deleteFolder('f1');

    expect(notes.getSnapshot().notes.find((n) => n.id === 'a')?.folderId).toBe('root');
  });

  it('importNotes creates notes via the adapter and refetches', async () => {
    await actions.init();
    await actions.importNotes([
      { title: 'X', content: '', folderId: 'root', type: 'note', tags: [], wordCount: 0 },
      { title: 'Y', content: '', folderId: 'root', type: 'note', tags: [], wordCount: 0 },
    ]);
    expect(notes.getSnapshot().notes.map((n) => n.title)).toEqual(['X', 'Y']);
  });

  it('rebindAdapter rebinds both modules and re-inits', async () => {
    seedNote(adapter, 'old', 'root');
    await actions.init();
    expect(notes.getSnapshot().notes.map((n) => n.id)).toEqual(['old']);

    const next = new FakeStorageAdapter();
    seedNote(next, 'new', 'root');
    await actions.rebindAdapter(next);

    expect(notes.getSnapshot().notes.map((n) => n.id)).toEqual(['new']);
  });
});
