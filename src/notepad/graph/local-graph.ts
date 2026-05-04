import type { AdjacencyList } from './types';

export function getNeighborhoodNodeIds(
  activeNodeId: string,
  depth: number,
  adjacencyList: AdjacencyList
): Set<string> {
  const visited = new Set<string>([activeNodeId]);
  let frontier = [activeNodeId];

  for (let d = 0; d < depth; d++) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      const entry = adjacencyList.get(nodeId);
      if (!entry) continue;
      for (const edge of entry.outgoing) {
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          nextFrontier.push(edge.target);
        }
      }
      for (const edge of entry.incoming) {
        if (!visited.has(edge.source)) {
          visited.add(edge.source);
          nextFrontier.push(edge.source);
        }
      }
    }
    frontier = nextFrontier;
  }

  return visited;
}
