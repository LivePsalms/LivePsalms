import { describe, it, expect } from 'vitest';
import { rotatePoint, projectPoint, depthNorm, depthScale, depthAlpha } from './sphere-math';

describe('rotatePoint', () => {
  it('is identity at yaw=0, pitch=0', () => {
    const p = rotatePoint({ x: 3, y: 5, z: 7 }, 0, 0);
    expect(p.x).toBeCloseTo(3, 6);
    expect(p.y).toBeCloseTo(5, 6);
    expect(p.z).toBeCloseTo(7, 6);
  });

  it('yaw of PI/2 maps +x toward -z (rotation about the Y axis)', () => {
    const p = rotatePoint({ x: 1, y: 0, z: 0 }, Math.PI / 2, 0);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(-1, 6);
  });

  it('preserves vector length', () => {
    const p = rotatePoint({ x: 2, y: -3, z: 6 }, 0.7, -0.4); // |p| = 7
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(7, 6);
  });
});

describe('projectPoint', () => {
  it('places the rotated point at cx+scale*x, cy+scale*y and reports depth=z', () => {
    const r = projectPoint({ x: 2, y: 4, z: -1 }, { yaw: 0, pitch: 0, scale: 3 }, 100, 50);
    expect(r.sx).toBeCloseTo(100 + 3 * 2, 6);
    expect(r.sy).toBeCloseTo(50 + 3 * 4, 6);
    expect(r.depth).toBeCloseTo(-1, 6);
  });
});

describe('depth shading', () => {
  it('normalizes depth from [-R, R] to [0, 1]', () => {
    expect(depthNorm(-200, 200)).toBeCloseTo(0, 6); // far back
    expect(depthNorm(0, 200)).toBeCloseTo(0.5, 6);  // equator
    expect(depthNorm(200, 200)).toBeCloseTo(1, 6);  // front
  });

  it('clamps depth outside [-R, R]', () => {
    expect(depthNorm(-9999, 200)).toBe(0);
    expect(depthNorm(9999, 200)).toBe(1);
  });

  it('front nodes draw larger and more opaque than back nodes', () => {
    expect(depthScale(1)).toBeGreaterThan(depthScale(0));
    expect(depthAlpha(1)).toBeGreaterThan(depthAlpha(0));
    expect(depthScale(0)).toBeCloseTo(0.55, 6);
    expect(depthScale(1)).toBeCloseTo(1.2, 6);
    expect(depthAlpha(0)).toBeCloseTo(0.3, 6);
    expect(depthAlpha(1)).toBeCloseTo(1.0, 6);
  });
});
