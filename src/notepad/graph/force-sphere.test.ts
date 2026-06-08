import { describe, it, expect } from 'vitest';
import { forceSphere } from './force-sphere';

interface N { x: number; y: number; z: number; vx: number; vy: number; vz: number; }

function mk(x: number, y: number, z: number): N {
  return { x, y, z, vx: 0, vy: 0, vz: 0 };
}

describe('forceSphere', () => {
  it('pushes a node that is too close to the centre outward (toward radius R)', () => {
    const node = mk(10, 0, 0); // well inside R=200
    const f = forceSphere<N>(200, 0.1);
    f.initialize!([node], Math.random, 3);
    f(1); // alpha = 1
    // velocity should point outward along +x (away from centre, toward the shell)
    expect(node.vx).toBeGreaterThan(0);
    expect(node.vy).toBeCloseTo(0, 6);
    expect(node.vz).toBeCloseTo(0, 6);
  });

  it('pulls a node that is too far inward (toward radius R)', () => {
    const node = mk(0, 500, 0); // outside R=200
    const f = forceSphere<N>(200, 0.1);
    f.initialize!([node], Math.random, 3);
    f(1);
    expect(node.vy).toBeLessThan(0); // pulled back toward centre
  });

  it('leaves a node already on the shell essentially unmoved', () => {
    const node = mk(200, 0, 0); // exactly on R=200
    const f = forceSphere<N>(200, 0.1);
    f.initialize!([node], Math.random, 3);
    f(1);
    expect(Math.abs(node.vx)).toBeLessThan(1e-9);
  });

  it('ignores a node sitting exactly at the origin (no defined direction)', () => {
    const node = mk(0, 0, 0);
    const f = forceSphere<N>(200, 0.1);
    f.initialize!([node], Math.random, 3);
    expect(() => f(1)).not.toThrow();
    expect(node.vx).toBe(0);
    expect(node.vy).toBe(0);
    expect(node.vz).toBe(0);
  });
});
