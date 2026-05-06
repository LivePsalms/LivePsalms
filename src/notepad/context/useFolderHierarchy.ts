import { createContext, useContext, useSyncExternalStore } from 'react';
import type { FolderHierarchy, FolderHierarchyState } from '../collection';

export const FolderHierarchyContext = createContext<FolderHierarchy | null>(null);

export function useFolderHierarchy(): FolderHierarchyState & { hierarchy: FolderHierarchy } {
  const hierarchy = useContext(FolderHierarchyContext);
  if (!hierarchy) throw new Error('useFolderHierarchy must be used within a NotepadProvider');
  const state = useSyncExternalStore(hierarchy.subscribe, hierarchy.getSnapshot);
  return { ...state, hierarchy };
}
