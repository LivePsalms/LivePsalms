import { useMemo } from 'react';
import type { Note } from '../types';
import type { GraphNode, GraphEdge, Reference } from './types';
import { useReferenceGraph } from '../context/useReferenceGraph';

export interface UseGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  activeNodeId: string | null;
  isLoading: boolean;
  getNeighborhood: (nodeId: string, depth: number) => Set<string>;
}

function refToGraphEdge(ref: Reference): GraphEdge {
  let type: GraphEdge['type'];
  if (ref.type === 'scripture-reference') type = 'scripture_reference';
  else if (ref.type === 'cross-reference') type = 'cross_reference';
  else type = 'explicit';
  return {
    id: ref.id,
    source: ref.source,
    target: ref.target,
    type,
    weight: ref.weight,
    createdAt: ref.createdAt,
  };
}

export function useGraph(notes: Note[], activeNoteId: string | null): UseGraphResult {
  const { references, scriptureNodes, graph } = useReferenceGraph();

  const { graphNodes, graphEdges } = useMemo(() => {
    // Sum edge weights per node id (matches the legacy computeNodeWeights behaviour).
    const weightSums = new Map<string, number>();
    for (const ref of references) {
      weightSums.set(ref.source, (weightSums.get(ref.source) ?? 0) + ref.weight);
      weightSums.set(ref.target, (weightSums.get(ref.target) ?? 0) + ref.weight);
    }

    // Set of node ids that actually participate in at least one edge.
    const nodesWithEdges = new Set<string>();
    for (const ref of references) {
      nodesWithEdges.add(ref.source);
      nodesWithEdges.add(ref.target);
    }

    const nodes: GraphNode[] = notes.map((note) => ({
      id: note.id,
      type: note.type,
      title: note.title,
      weight: weightSums.get(note.id) ?? 0,
      tags: note.tags,
      scriptureText: '',
      scriptureTranslation: '',
    }));

    // Only include scripture nodes that are connected to at least one edge
    // (mirrors the legacy `if (adjacency.has(sn.id))` guard).
    for (const sn of scriptureNodes) {
      if (nodesWithEdges.has(sn.id)) {
        nodes.push({
          id: sn.id,
          type: 'scripture',
          title: `${sn.book} ${sn.chapter}:${sn.verseStart}${sn.verseEnd ? `-${sn.verseEnd}` : ''}`,
          weight: weightSums.get(sn.id) ?? 0,
          tags: [],
          scriptureText: sn.text,
          scriptureTranslation: sn.translation,
        });
      }
    }

    const edges: GraphEdge[] = references.map(refToGraphEdge);

    return { graphNodes: nodes, graphEdges: edges };
  }, [notes, references, scriptureNodes]);

  // isLoading: the ReferenceGraph is always available (hydrated synchronously from
  // cache on construction); any in-flight syncAll runs in a useEffect at the
  // NotepadProvider level and doesn't gate graph data here.
  const isLoading = false;

  const getNeighborhood = useMemo(() => graph.getNeighborhood, [graph]);

  return {
    nodes: graphNodes,
    edges: graphEdges,
    activeNodeId,
    isLoading,
    getNeighborhood,
  };
}
