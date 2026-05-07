import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NoteCollection } from './note-collection';
import { FolderHierarchy } from './folder-hierarchy';
import { NotepadActions } from './notepad-actions';
import { FakeStorageAdapter, resetFakeAdapterIds } from './fake-storage-adapter';
import { ReferenceGraph } from '../graph/reference-graph';
import { createInMemoryStorage } from '../graph/in-memory-storage';
import { createInMemoryVerseFetcher } from '../graph/in-memory-verse-fetcher';

function seedNote(adapter: FakeStorageAdapter, id: string, folderId: string) {
  adapter.notes.push({
    id, title: id, content: '', folderId, type: 'devotion', tags: [], wordCount: 0,
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
  let referenceGraph: ReferenceGraph;
  let actions: NotepadActions;

  beforeEach(() => {
    resetFakeAdapterIds();
    adapter = new FakeStorageAdapter();
    notes = new NoteCollection(adapter);
    folders = new FolderHierarchy(adapter);
    referenceGraph = new ReferenceGraph(adapter, createInMemoryVerseFetcher({}), createInMemoryStorage());
    actions = new NotepadActions(adapter, notes, folders, referenceGraph);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      { title: 'X', content: '', folderId: 'root', type: 'devotion', tags: [], wordCount: 0 },
      { title: 'Y', content: '', folderId: 'root', type: 'devotion', tags: [], wordCount: 0 },
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

  // ---------------------------------------------------------------------------
  describe('updateNote', () => {
    it('triggers referenceGraph.syncNote when content is updated', async () => {
      seedNote(adapter, 'n1', 'root');
      await actions.init();

      const syncSpy = vi.spyOn(referenceGraph, 'syncNote').mockResolvedValue(undefined);

      await actions.updateNote('n1', { content: '{"type":"doc"}' });

      expect(syncSpy).toHaveBeenCalledTimes(1);
      expect(syncSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }));
    });

    it('does NOT trigger referenceGraph.syncNote when only title is updated', async () => {
      seedNote(adapter, 'n1', 'root');
      await actions.init();

      const syncSpy = vi.spyOn(referenceGraph, 'syncNote').mockResolvedValue(undefined);

      await actions.updateNote('n1', { title: 'New Title' });

      expect(syncSpy).not.toHaveBeenCalled();
    });

    it('does NOT trigger referenceGraph.syncNote when only folderId is updated', async () => {
      seedNote(adapter, 'n1', 'root');
      await actions.init();

      const syncSpy = vi.spyOn(referenceGraph, 'syncNote').mockResolvedValue(undefined);

      await actions.updateNote('n1', { folderId: 'other-folder' });

      expect(syncSpy).not.toHaveBeenCalled();
    });

    it('does NOT trigger referenceGraph.syncNote when only tags are updated', async () => {
      seedNote(adapter, 'n1', 'root');
      await actions.init();

      const syncSpy = vi.spyOn(referenceGraph, 'syncNote').mockResolvedValue(undefined);

      await actions.updateNote('n1', { tags: ['faith'] });

      expect(syncSpy).not.toHaveBeenCalled();
    });

    it('triggers referenceGraph.syncNote when content is updated alongside other fields', async () => {
      seedNote(adapter, 'n1', 'root');
      await actions.init();

      const syncSpy = vi.spyOn(referenceGraph, 'syncNote').mockResolvedValue(undefined);

      await actions.updateNote('n1', { content: '{"type":"doc"}', title: 'Updated Title' });

      expect(syncSpy).toHaveBeenCalledTimes(1);
    });

    it('triggers referenceGraph.syncNote even when content is an empty string', async () => {
      seedNote(adapter, 'n1', 'root');
      await actions.init();

      const syncSpy = vi.spyOn(referenceGraph, 'syncNote').mockResolvedValue(undefined);

      await actions.updateNote('n1', { content: '' });

      // content !== undefined is true for '', so sync IS triggered
      expect(syncSpy).toHaveBeenCalledTimes(1);
    });

    it('returns the updated note', async () => {
      seedNote(adapter, 'n1', 'root');
      await actions.init();

      vi.spyOn(referenceGraph, 'syncNote').mockResolvedValue(undefined);

      const result = await actions.updateNote('n1', { title: 'Fresh Title' });

      expect(result.id).toBe('n1');
      expect(result.title).toBe('Fresh Title');
    });
  });

  // ---------------------------------------------------------------------------
  describe('deleteNote', () => {
    it('triggers referenceGraph.deleteReferencesFor with the note id', async () => {
      seedNote(adapter, 'n1', 'root');
      await actions.init();

      const deleteSpy = vi.spyOn(referenceGraph, 'deleteReferencesFor');

      await actions.deleteNote('n1');

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith('n1');
    });

    it('removes the note from the collection after deletion', async () => {
      seedNote(adapter, 'n1', 'root');
      seedNote(adapter, 'n2', 'root');
      await actions.init();

      vi.spyOn(referenceGraph, 'deleteReferencesFor');

      await actions.deleteNote('n1');

      expect(notes.getSnapshot().notes.map((n) => n.id)).not.toContain('n1');
      expect(notes.getSnapshot().notes.map((n) => n.id)).toContain('n2');
    });
  });

  // ---------------------------------------------------------------------------
  describe('init', () => {
    it('does NOT call repairNoteLinks when the notes array is empty', async () => {
      // No notes seeded — notes list will be empty after notes.init()
      const repairSpy = vi.spyOn(referenceGraph, 'repairNoteLinks').mockResolvedValue({
        repairedNotes: 0, rewiredLinks: 0, orphans: 0,
      });

      await actions.init();

      expect(repairSpy).not.toHaveBeenCalled();
    });

    it('calls repairNoteLinks before referenceGraph.init when notes exist (rewiredLinks === 0)', async () => {
      seedNote(adapter, 'n1', 'root');

      const callOrder: string[] = [];

      const repairSpy = vi.spyOn(referenceGraph, 'repairNoteLinks').mockImplementation(async () => {
        callOrder.push('repair');
        return { repairedNotes: 0, rewiredLinks: 0, orphans: 0 };
      });

      const graphInitSpy = vi.spyOn(referenceGraph, 'init').mockImplementation(async () => {
        callOrder.push('graphInit');
      });

      await actions.init();

      expect(repairSpy).toHaveBeenCalledTimes(1);
      expect(graphInitSpy).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual(['repair', 'graphInit']);
    });

    it('does NOT call notes.refetchAll when repairNoteLinks returns rewiredLinks === 0', async () => {
      seedNote(adapter, 'n1', 'root');

      vi.spyOn(referenceGraph, 'repairNoteLinks').mockResolvedValue({
        repairedNotes: 0, rewiredLinks: 0, orphans: 0,
      });
      vi.spyOn(referenceGraph, 'init').mockResolvedValue(undefined);

      const refetchSpy = vi.spyOn(notes, 'refetchAll');

      await actions.init();

      expect(refetchSpy).not.toHaveBeenCalled();
    });

    it('calls notes.refetchAll when repairNoteLinks returns rewiredLinks > 0', async () => {
      seedNote(adapter, 'n1', 'root');

      vi.spyOn(referenceGraph, 'repairNoteLinks').mockResolvedValue({
        repairedNotes: 1, rewiredLinks: 3, orphans: 0,
      });
      vi.spyOn(referenceGraph, 'init').mockResolvedValue(undefined);

      const refetchSpy = vi.spyOn(notes, 'refetchAll');

      await actions.init();

      expect(refetchSpy).toHaveBeenCalledTimes(1);
    });

    it('calls referenceGraph.init with the current note list', async () => {
      seedNote(adapter, 'n1', 'root');
      seedNote(adapter, 'n2', 'root');

      vi.spyOn(referenceGraph, 'repairNoteLinks').mockResolvedValue({
        repairedNotes: 0, rewiredLinks: 0, orphans: 0,
      });

      const graphInitSpy = vi.spyOn(referenceGraph, 'init').mockResolvedValue(undefined);

      await actions.init();

      expect(graphInitSpy).toHaveBeenCalledTimes(1);
      const passedNotes = graphInitSpy.mock.calls[0][0];
      expect(passedNotes.map((n: { id: string }) => n.id)).toEqual(['n1', 'n2']);
    });
  });

  // ---------------------------------------------------------------------------
  describe('importNotes', () => {
    it('calls referenceGraph.syncAll after the bulk insert', async () => {
      await actions.init();

      const syncAllSpy = vi.spyOn(referenceGraph, 'syncAll').mockResolvedValue(undefined);

      await actions.importNotes([
        { title: 'A', content: '', folderId: 'root', type: 'devotion', tags: [], wordCount: 0 },
        { title: 'B', content: '', folderId: 'root', type: 'devotion', tags: [], wordCount: 0 },
      ]);

      expect(syncAllSpy).toHaveBeenCalledTimes(1);
    });

    it('calls referenceGraph.syncAll with the post-refetch note list', async () => {
      await actions.init();

      const syncAllSpy = vi.spyOn(referenceGraph, 'syncAll').mockResolvedValue(undefined);

      await actions.importNotes([
        { title: 'A', content: '', folderId: 'root', type: 'devotion', tags: [], wordCount: 0 },
      ]);

      const passedNotes = syncAllSpy.mock.calls[0][0];
      expect(passedNotes).toHaveLength(1);
      expect(passedNotes[0].title).toBe('A');
    });
  });

  // ---------------------------------------------------------------------------
  describe('rebindAdapter', () => {
    it('cascades rebindAdapter to notes, folders, and referenceGraph', async () => {
      seedNote(adapter, 'old', 'root');
      await actions.init();

      const notesRebindSpy = vi.spyOn(notes, 'rebindAdapter');
      const foldersRebindSpy = vi.spyOn(folders, 'rebindAdapter');
      const graphRebindSpy = vi.spyOn(referenceGraph, 'rebindAdapter');

      const next = new FakeStorageAdapter();
      await actions.rebindAdapter(next);

      expect(notesRebindSpy).toHaveBeenCalledWith(next);
      expect(foldersRebindSpy).toHaveBeenCalledWith(next);
      expect(graphRebindSpy).toHaveBeenCalledWith(next);
    });

    it('re-runs init after rebinding (notes are refreshed from the new adapter)', async () => {
      seedNote(adapter, 'old', 'root');
      await actions.init();

      // notes.init is called during the first init and again after rebind.
      const notesInitSpy = vi.spyOn(notes, 'init');

      const next = new FakeStorageAdapter();
      seedNote(next, 'new', 'root');
      await actions.rebindAdapter(next);

      // init() is called once more after rebind
      expect(notesInitSpy).toHaveBeenCalledTimes(1);
      expect(notes.getSnapshot().notes.map((n) => n.id)).toEqual(['new']);
    });

    it('re-runs init: folders are refreshed from the new adapter', async () => {
      seedFolder(adapter, 'old-folder');
      seedNote(adapter, 'n1', 'root');
      await actions.init();
      expect(folders.getSnapshot().folders.map((f) => f.id)).toContain('old-folder');

      const next = new FakeStorageAdapter();
      seedFolder(next, 'new-folder');
      await actions.rebindAdapter(next);

      expect(folders.getSnapshot().folders.map((f) => f.id)).toEqual(['new-folder']);
    });
  });
});
