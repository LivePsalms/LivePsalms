import type { StorageAdapter } from '../storage/adapter';
import type { Note } from '../types';
import { NoteCollection } from './note-collection';
import { FolderHierarchy } from './folder-hierarchy';

export class NotepadActions {
  private adapter: StorageAdapter;
  private notes: NoteCollection;
  private folders: FolderHierarchy;

  constructor(adapter: StorageAdapter, notes: NoteCollection, folders: FolderHierarchy) {
    this.adapter = adapter;
    this.notes = notes;
    this.folders = folders;
  }

  async init(): Promise<void> {
    await Promise.all([this.notes.init(), this.folders.init()]);
  }

  async deleteFolder(id: string): Promise<void> {
    const affectedIds = this.notes
      .getSnapshot()
      .notes.filter((n) => n.folderId === id)
      .map((n) => n.id);

    await this.folders.deleteFolder(id);
    this.notes.applyReparenting(affectedIds, 'root');
  }

  async importNotes(items: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    for (const item of items) {
      await this.adapter.createNote(item);
    }
    await this.notes.refetchAll();
  }

  async rebindAdapter(next: StorageAdapter): Promise<void> {
    this.adapter = next;
    this.notes.rebindAdapter(next);
    this.folders.rebindAdapter(next);
    await this.init();
  }
}
