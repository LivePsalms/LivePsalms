import { Observable } from './observable';
import type { StorageAdapter } from '../storage/adapter';
import type { Note } from '../types';

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

  constructor(adapter: StorageAdapter) {
    super(EMPTY_STATE);
    this.adapter = adapter;
  }

  async init(): Promise<void> {
    const notes = await this.adapter.getNotes();
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
