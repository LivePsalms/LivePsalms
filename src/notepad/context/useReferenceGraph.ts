import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ReferenceGraph, ReferenceGraphState } from '../graph/reference-graph';

export const ReferenceGraphContext = createContext<ReferenceGraph | null>(null);

export function useReferenceGraph(): ReferenceGraphState & { graph: ReferenceGraph } {
  const graph = useContext(ReferenceGraphContext);
  if (!graph) throw new Error('useReferenceGraph must be used within a NotepadProvider');
  const state = useSyncExternalStore(graph.subscribe, graph.getSnapshot);
  return { ...state, graph };
}
