import type { GraphEdge, AdjacencyList } from './types';

export function buildAdjacencyList(edges: GraphEdge[]): AdjacencyList {
  const list: AdjacencyList = new Map();

  function ensureNode(id: string) {
    if (!list.has(id)) {
      list.set(id, { outgoing: [], incoming: [] });
    }
  }

  for (const edge of edges) {
    ensureNode(edge.source);
    ensureNode(edge.target);
    list.get(edge.source)!.outgoing.push(edge);
    list.get(edge.target)!.incoming.push(edge);
  }

  return list;
}

export function computeNodeWeights(list: AdjacencyList): Map<string, number> {
  const weights = new Map<string, number>();

  for (const [id, entry] of list) {
    let total = 0;
    for (const edge of entry.outgoing) total += edge.weight;
    for (const edge of entry.incoming) total += edge.weight;
    weights.set(id, total);
  }

  return weights;
}
