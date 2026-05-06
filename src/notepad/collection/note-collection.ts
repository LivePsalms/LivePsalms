import { Observable } from './observable';
import type { StorageAdapter } from '../storage/adapter';
import type { Note } from '../types';
import { repairNoteLinks } from '../storage/repair-note-links';

export interface NoteCollectionState {
  notes: Note[];
  activeNoteId: string | null;
  activeNote: Note | null;
}

const EMPTY_STATE: NoteCollectionState = {
  notes: [],
  activeNoteId: null,
  activeNote: null,
};

export class NoteCollection extends Observable<NoteCollectionState> {
  private adapter: StorageAdapter;
  private repairAttempted = false;

  constructor(adapter: StorageAdapter) {
    super(EMPTY_STATE);
    this.adapter = adapter;
  }

  async init(): Promise<void> {
    let notes = await this.adapter.getNotes();

    if (!this.repairAttempted && notes.length > 0) {
      this.repairAttempted = true;
      try {
        const result = await repairNoteLinks(notes, this.adapter);
        if (result.rewiredLinks > 0) {
          notes = await this.adapter.getNotes();
        }
      } catch (err) {
        console.warn('[NoteCollection] repair pass failed:', err);
      }
    }

    this.update((prev) => ({ ...prev, notes }));
  }

  openNote = (id: string | null): void => {
    this.update((prev) => ({ ...prev, activeNoteId: id }));
  };

  async createNote(folderId: string, type: import('../types').NoteType): Promise<Note> {
    const created = await this.adapter.createNote({
      title: 'Untitled',
      content: '',
      folderId,
      type,
      tags: [],
      wordCount: 0,
    });
    this.update((prev) => ({
      ...prev,
      notes: [...prev.notes, created],
      activeNoteId: created.id,
    }));
    return created;
  }

  async updateNote(id: string, updates: Partial<Note>): Promise<Note> {
    const updated = await this.adapter.updateNote(id, updates);
    this.update((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => (n.id === id ? updated : n)),
    }));
    return updated;
  }

  async deleteNote(id: string): Promise<void> {
    await this.adapter.deleteNote(id);
    this.update((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== id),
      activeNoteId: prev.activeNoteId === id ? null : prev.activeNoteId,
    }));
  }

  renameNote(id: string, title: string): Promise<Note> {
    return this.updateNote(id, { title });
  }

  moveNote(id: string, folderId: string): Promise<Note> {
    return this.updateNote(id, { folderId });
  }

  async duplicateNote(id: string): Promise<Note> {
    const dup = await this.adapter.duplicateNote(id);
    this.update((prev) => ({ ...prev, notes: [...prev.notes, dup] }));
    return dup;
  }

  applyReparenting(noteIds: string[], newFolderId: string): void {
    const idSet = new Set(noteIds);
    this.update((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        idSet.has(n.id) ? { ...n, folderId: newFolderId } : n,
      ),
    }));
  }

  async refetchAll(): Promise<void> {
    const notes = await this.adapter.getNotes();
    this.update((prev) => ({ ...prev, notes }));
  }

  rebindAdapter(next: StorageAdapter): void {
    this.adapter = next;
    this.repairAttempted = false;
    this.update(() => EMPTY_STATE);
  }

  private update(updater: (prev: NoteCollectionState) => NoteCollectionState): void {
    this.setState((prev) => {
      const next = updater(prev);
      const activeNote = next.activeNoteId
        ? next.notes.find((n) => n.id === next.activeNoteId) ?? null
        : null;
      return { ...next, activeNote };
    });
  }
}
