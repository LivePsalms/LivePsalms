import { useMemo } from 'react';
import type { Note } from '../types';
import type { GraphNode, GraphEdge } from './types';
import { useReferenceGraph } from '../context/useReferenceGraph';
import { projectGraph } from './project-graph';

export interface UseGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  activeNodeId: string | null;
  isLoading: boolean;
  getNeighborhood: (nodeId: string, depth: number) => Set<string>;
}

export function useGraph(notes: Note[], activeNoteId: string | null): UseGraphResult {
  const { references, scriptureNodes, graph } = useReferenceGraph();

  const { nodes, edges } = useMemo(
    () => projectGraph(notes, references, scriptureNodes),
    [notes, references, scriptureNodes],
  );

  const getNeighborhood = useMemo(() => graph.getNeighborhood, [graph]);

  return { nodes, edges, activeNodeId: activeNoteId, isLoading: false, getNeighborhood };
}
