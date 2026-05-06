import { createContext, useContext, useSyncExternalStore } from 'react';
import type { NoteCollection, NoteCollectionState } from '../collection';

export const NoteCollectionContext = createContext<NoteCollection | null>(null);

export function useNoteCollection(): NoteCollectionState & { collection: NoteCollection } {
  const collection = useContext(NoteCollectionContext);
  if (!collection) throw new Error('useNoteCollection must be used within a NotepadProvider');
  const state = useSyncExternalStore(collection.subscribe, collection.getSnapshot);
  return { ...state, collection };
}
