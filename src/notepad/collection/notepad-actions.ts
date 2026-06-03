import type { StorageAdapter } from '../storage/adapter';
import type { Note } from '../types';
import { NoteCollection } from './note-collection';
import { FolderHierarchy } from './folder-hierarchy';
import { ReferenceGraph } from '../graph/reference-graph';

export class NotepadActions {
  private adapter: StorageAdapter;
  private notes: NoteCollection;
  private folders: FolderHierarchy;
  private referenceGraph: ReferenceGraph;

  constructor(
    adapter: StorageAdapter,
    notes: NoteCollection,
    folders: FolderHierarchy,
    referenceGraph: ReferenceGraph,
  ) {
    this.adapter = adapter;
    this.notes = notes;
    this.folders = folders;
    this.referenceGraph = referenceGraph;
  }

  async init(): Promise<void> {
    await Promise.all([this.notes.init(), this.folders.init()]);
    const noteList = this.notes.getSnapshot().notes;
    if (noteList.length > 0) {
      try {
        const { rewires } = this.referenceGraph.repairNoteLinks(noteList);
        // Persist each rewire through NoteCollection so canonical in-memory
        // state stays in sync — no refetchAll needed.
        for (const rewire of rewires) {
          await this.notes.updateNote(rewire.noteId, { content: rewire.content });
        }
      } catch (err) {
        console.warn('[NotepadActions] repair pass failed:', err);
      }
    }
    await this.referenceGraph.init(this.notes.getSnapshot().notes);
  }

  deleteFolder = async (id: string): Promise<void> => {
    const affectedIds = this.notes
      .getSnapshot()
      .notes.filter((n) => n.folderId === id)
      .map((n) => n.id);

    await this.folders.deleteFolder(id);
    this.notes.applyReparenting(affectedIds, 'root');
  };

  updateNote = async (id: string, updates: Partial<Note>): Promise<Note> => {
    const updated = await this.notes.updateNote(id, updates);
    // Only content changes affect references; skip sync for title/folder/tag updates.
    if (updates.content !== undefined) {
      await this.referenceGraph.syncNote(updated);
    }
    return updated;
  };

  deleteNote = async (id: string): Promise<void> => {
    await this.notes.deleteNote(id);
    this.referenceGraph.deleteReferencesFor(id);
  };

  importNotes = async (notes: Note[]): Promise<void> => {
    // Uses `importNote` (id-preserving) so client-generated ids in cross-link
    // marks resolve once the notes are synced into ReferenceGraph.
    for (const note of notes) {
      await this.adapter.importNote(note);
    }
    await this.notes.refetchAll();
    await this.referenceGraph.syncAll(this.notes.getSnapshot().notes);
  };

  async rebindAdapter(next: StorageAdapter): Promise<void> {
    this.adapter = next;
    this.notes.rebindAdapter(next);
    this.folders.rebindAdapter(next);
    this.referenceGraph.reset();
    await this.init();
  }
}
