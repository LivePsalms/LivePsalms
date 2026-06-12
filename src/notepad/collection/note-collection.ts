import { Observable } from './observable';
import { loadLastNoteId, saveLastNoteId } from '../session/session-storage';
import type { StorageAdapter } from '../storage/adapter';
import type { Note, NoteType } from '../types';

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
    // Restore the last-open note only if it's present in the loaded set. The
    // signed-in (Supabase) and signed-out (local) id spaces never collide, so a
    // stored id from the other scope simply won't be found and we fall back to null.
    const restoredId = loadLastNoteId();
    const activeNoteId =
      restoredId && notes.some((n) => n.id === restoredId) ? restoredId : null;
    this.update((prev) => ({ ...prev, notes, activeNoteId }));
  }

  openNote = (id: string | null): void => {
    saveLastNoteId(id);
    this.update((prev) => ({ ...prev, activeNoteId: id }));
  };

  createNote = async (folderId: string, type: NoteType): Promise<Note> => {
    const created = await this.adapter.createNote({
      title: 'Untitled',
      content: '',
      folderId,
      type,
      tags: [],
      wordCount: 0,
    });
    saveLastNoteId(created.id);
    this.update((prev) => ({
      ...prev,
      notes: [...prev.notes, created],
      activeNoteId: created.id,
    }));
    return created;
  };

  updateNote = async (id: string, updates: Partial<Note>): Promise<Note> => {
    const updated = await this.adapter.updateNote(id, updates);
    this.update((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => (n.id === id ? updated : n)),
    }));
    return updated;
  };

  deleteNote = async (id: string): Promise<void> => {
    await this.adapter.deleteNote(id);
    if (this.getSnapshot().activeNoteId === id) saveLastNoteId(null);
    this.update((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== id),
      activeNoteId: prev.activeNoteId === id ? null : prev.activeNoteId,
    }));
  };

  renameNote = (id: string, title: string): Promise<Note> => this.updateNote(id, { title });

  moveNote = (id: string, folderId: string): Promise<Note> => this.updateNote(id, { folderId });

  duplicateNote = async (id: string): Promise<Note> => {
    const dup = await this.adapter.duplicateNote(id);
    this.update((prev) => ({ ...prev, notes: [...prev.notes, dup] }));
    return dup;
  };

  applyReparenting = (noteIds: string[], newFolderId: string): void => {
    const idSet = new Set(noteIds);
    this.update((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        idSet.has(n.id) ? { ...n, folderId: newFolderId } : n,
      ),
    }));
  };

  refetchAll = async (): Promise<void> => {
    const notes = await this.adapter.getNotes();
    this.update((prev) => ({ ...prev, notes }));
  };

  rebindAdapter(next: StorageAdapter): void {
    this.adapter = next;
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
