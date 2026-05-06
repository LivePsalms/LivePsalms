import { createContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { Note, Folder, NoteType, FolderIcon } from '../types';
import type { StorageAdapter } from '../storage/adapter';
import { LocalStorageAdapter } from '../storage/local-storage';
import { NoteCollection, FolderHierarchy, NotepadActions } from '../collection';
import { NoteCollectionContext } from './useNoteCollection';
import { FolderHierarchyContext } from './useFolderHierarchy';
import { NotepadActionsContext } from './useNotepadActions';

export interface NotepadContextValue {
  notes: Note[];
  folders: Folder[];
  activeNoteId: string | null;
  activeNote: Note | null;
  openNote: (id: string | null) => void;
  createNote: (folderId: string, type: NoteType) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  duplicateNote: (id: string) => Promise<Note>;
  moveNote: (id: string, folderId: string) => Promise<Note>;
  renameNote: (id: string, title: string) => Promise<Note>;
  createFolder: (name: string, parentId: string | null, icon?: FolderIcon, color?: string) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<Folder>;
  deleteFolder: (id: string) => Promise<void>;
  importNotes: (items: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<void>;
  refresh: () => Promise<void>;
}

export const NotepadContext = createContext<NotepadContextValue | null>(null);

interface NotepadProviderProps {
  children: ReactNode;
  adapter?: StorageAdapter;
}

export function NotepadProvider({ children, adapter: adapterProp }: NotepadProviderProps) {
  const initialAdapter = useMemo(() => adapterProp ?? new LocalStorageAdapter(), []);

  const { notes, folders, actions } = useMemo(() => {
    const notesModule = new NoteCollection(initialAdapter);
    const foldersModule = new FolderHierarchy(initialAdapter);
    const actionsModule = new NotepadActions(initialAdapter, notesModule, foldersModule);
    return { notes: notesModule, folders: foldersModule, actions: actionsModule };
  }, [initialAdapter]);

  // Initial load + adapter rebinds.
  useEffect(() => {
    const run = async () => {
      if (adapterProp && adapterProp !== initialAdapter) {
        await actions.rebindAdapter(adapterProp);
      } else {
        await actions.init();
      }
    };
    run().catch((err) => console.error('[NotepadProvider] init failed:', err));
  }, [adapterProp, actions, initialAdapter]);

  const notesState = useSyncExternalStore(notes.subscribe, notes.getSnapshot);
  const foldersState = useSyncExternalStore(folders.subscribe, folders.getSnapshot);

  const value: NotepadContextValue = {
    notes: notesState.notes,
    folders: foldersState.folders,
    activeNoteId: notesState.activeNoteId,
    activeNote: notesState.activeNote,
    openNote: notes.openNote,
    createNote: notes.createNote.bind(notes),
    updateNote: notes.updateNote.bind(notes),
    deleteNote: notes.deleteNote.bind(notes),
    duplicateNote: notes.duplicateNote.bind(notes),
    moveNote: notes.moveNote.bind(notes),
    renameNote: notes.renameNote.bind(notes),
    createFolder: folders.createFolder.bind(folders),
    renameFolder: folders.renameFolder.bind(folders),
    deleteFolder: actions.deleteFolder.bind(actions),
    importNotes: actions.importNotes.bind(actions),
    refresh: () => actions.init(),
  };

  return (
    <NoteCollectionContext.Provider value={notes}>
      <FolderHierarchyContext.Provider value={folders}>
        <NotepadActionsContext.Provider value={actions}>
          <NotepadContext.Provider value={value}>{children}</NotepadContext.Provider>
        </NotepadActionsContext.Provider>
      </FolderHierarchyContext.Provider>
    </NoteCollectionContext.Provider>
  );
}
