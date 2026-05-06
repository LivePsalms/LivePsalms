import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { StorageAdapter } from '../storage/adapter';
import { LocalStorageAdapter } from '../storage/local-storage';
import { NoteCollection, FolderHierarchy, NotepadActions } from '../collection';
import { NoteCollectionContext } from './useNoteCollection';
import { FolderHierarchyContext } from './useFolderHierarchy';
import { NotepadActionsContext } from './useNotepadActions';

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

  return (
    <NoteCollectionContext.Provider value={notes}>
      <FolderHierarchyContext.Provider value={folders}>
        <NotepadActionsContext.Provider value={actions}>
          {children}
        </NotepadActionsContext.Provider>
      </FolderHierarchyContext.Provider>
    </NoteCollectionContext.Provider>
  );
}
