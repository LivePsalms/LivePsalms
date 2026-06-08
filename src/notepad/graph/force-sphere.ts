interface SphereNode {
  x?: number; y?: number; z?: number;
  vx?: number; vy?: number; vz?: number;
}

/**
 * A d3-force-3d-compatible force that pulls every node toward the surface of a
 * sphere of the given `radius`, centred at the origin. `strength` scales how
 * hard nodes are nudged each tick (multiplied by the simulation alpha). A node
 * exactly at the origin has no defined radial direction and is left untouched.
 */
export function forceSphere<N extends SphereNode>(radius: number, strength = 0.08) {
  let nodes: N[] = [];

  function force(alpha: number) {
    for (const n of nodes) {
      const x = n.x ?? 0, y = n.y ?? 0, z = n.z ?? 0;
      const dist = Math.sqrt(x * x + y * y + z * z);
      if (dist === 0) continue; // no direction at the centre
      const diff = radius - dist;          // >0: too close (push out); <0: too far (pull in)
      const f = (diff / dist) * strength * alpha;
      n.vx = (n.vx ?? 0) + x * f;
      n.vy = (n.vy ?? 0) + y * f;
      n.vz = (n.vz ?? 0) + z * f;
    }
  }

  force.initialize = function (_nodes: N[]) {
    nodes = _nodes;
  };

  return force;
}
