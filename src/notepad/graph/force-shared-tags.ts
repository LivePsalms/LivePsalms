import type { SimulationNodeDatum } from 'd3-force';

interface TaggedNode extends SimulationNodeDatum {
  tags: string[];
}

export function forceSharedTags<N extends TaggedNode>(strength: number = 0.0003) {
  let nodes: N[] = [];

  function force(alpha: number) {
    const tagMap = new Map<string, number[]>();
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      for (const tag of node.tags) {
        if (!tagMap.has(tag)) tagMap.set(tag, []);
        tagMap.get(tag)!.push(i);
      }
    }

    for (const indices of tagMap.values()) {
      if (indices.length < 2) continue;
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          const a = nodes[indices[i]];
          const b = nodes[indices[j]];
          if (a.x == null || a.y == null || b.x == null || b.y == null) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const f = strength * alpha;

          a.vx = (a.vx ?? 0) + dx * f;
          a.vy = (a.vy ?? 0) + dy * f;
          b.vx = (b.vx ?? 0) - dx * f;
          b.vy = (b.vy ?? 0) - dy * f;
        }
      }
    }
  }

  force.initialize = function (_nodes: N[]) {
    nodes = _nodes;
  };

  force.strength = function (s: number) {
    strength = s;
    return force;
  };

  return force;
}
