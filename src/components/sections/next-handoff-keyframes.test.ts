import { describe, it, expect } from 'vitest';
import {
  actOneKeyframes,
  actTwoKeyframes,
  shouldAutoNavigate,
  AUTO_NAV_PROGRESS,
} from './next-handoff-keyframes';
import type { Keyframe } from './motion-keyframes';

// First keyframe matching target whose `to` carries `prop`.
const at = (kfs: Keyframe[], target: string, prop: string): Keyframe =>
  kfs.find((k) => k.target === target && prop in k.to)!;

describe('actOneKeyframes', () => {
  const kfs = actOneKeyframes();

  it('enters left -100 -> 0 and right 100 -> 0 (fromTo at 0)', () => {
    const left = at(kfs, 'left', 'yPercent');
    expect(left).toMatchObject({ at: 0, from: { yPercent: -100 }, to: { yPercent: 0 } });
    const right = at(kfs, 'right', 'yPercent');
    expect(right).toMatchObject({ at: 0, from: { yPercent: 100 }, to: { yPercent: 0 } });
  });

  it('fills scaleX 0 -> 1 carrying transformOrigin on both sides', () => {
    const fill = at(kfs, 'fill', 'scaleX');
    expect(fill.from).toEqual({ scaleX: 0, transformOrigin: '50% 50%' });
    expect(fill.to).toMatchObject({ scaleX: 1, transformOrigin: '50% 50%' });
  });

  it('fades content in with a `to` (no `from`) at 0.6', () => {
    const content = at(kfs, 'content', 'opacity');
    expect(content.from).toBeUndefined();
    expect(content).toMatchObject({ at: 0.6, to: { opacity: 1 } });
  });
});

describe('actTwoKeyframes', () => {
  const kfs = actTwoKeyframes();

  it('exits left/right/fill/content via fromTo at 0', () => {
    expect(at(kfs, 'left', 'yPercent')).toMatchObject({
      at: 0,
      from: { yPercent: 0 },
      to: { yPercent: -100 },
    });
    expect(at(kfs, 'right', 'yPercent')).toMatchObject({
      at: 0,
      from: { yPercent: 0 },
      to: { yPercent: 100 },
    });
    const fillExit = at(kfs, 'fill', 'scaleX');
    expect(fillExit.from).toEqual({ scaleX: 1, transformOrigin: '50% 50%' });
    expect(fillExit.to).toMatchObject({ scaleX: 0, transformOrigin: '50% 50%' });
    expect(at(kfs, 'content', 'opacity')).toMatchObject({
      at: 0,
      from: { opacity: 1 },
      to: { opacity: 0 },
    });
  });

  it('re-enters left and right via `to` (no `from`) at 0.6', () => {
    const leftReturn = kfs.filter((k) => k.target === 'left' && k.to.yPercent === 0);
    expect(leftReturn).toHaveLength(1);
    expect(leftReturn[0]).toMatchObject({ at: 0.6, to: { yPercent: 0 } });
    expect(leftReturn[0].from).toBeUndefined();

    const rightReturn = kfs.filter((k) => k.target === 'right' && k.to.yPercent === 0);
    expect(rightReturn).toHaveLength(1);
    expect(rightReturn[0]).toMatchObject({ at: 0.6, to: { yPercent: 0 } });
    expect(rightReturn[0].from).toBeUndefined();
  });

  it('every keyframe resolves to a known choreography target', () => {
    for (const kf of kfs) {
      expect(['left', 'right', 'fill', 'content']).toContain(kf.target);
    }
  });
});

describe('Act1 -> Act2 continuity invariant', () => {
  const one = actOneKeyframes();
  const two = actTwoKeyframes();

  // Act 1 leaves each target at its resting state; Act 2 must begin from that
  // exact resting state. Pins the handoff so no visual jump occurs at the seam.
  it('left resting state matches: act1 final yPercent === act2 first from yPercent', () => {
    expect(at(one, 'left', 'yPercent').to.yPercent).toBe(at(two, 'left', 'yPercent').from!.yPercent);
  });

  it('right resting state matches', () => {
    expect(at(one, 'right', 'yPercent').to.yPercent).toBe(
      at(two, 'right', 'yPercent').from!.yPercent,
    );
  });

  it('fill resting state matches (scaleX 1)', () => {
    expect(at(one, 'fill', 'scaleX').to.scaleX).toBe(at(two, 'fill', 'scaleX').from!.scaleX);
  });

  it('content resting state matches (opacity 1)', () => {
    expect(at(one, 'content', 'opacity').to.opacity).toBe(
      at(two, 'content', 'opacity').from!.opacity,
    );
  });
});

describe('shouldAutoNavigate', () => {
  it('AUTO_NAV_PROGRESS is 0.98', () => {
    expect(AUTO_NAV_PROGRESS).toBe(0.98);
  });

  it('is true only at/after the fence and only when not yet navigated', () => {
    expect(shouldAutoNavigate(0.98, false)).toBe(true);
    expect(shouldAutoNavigate(1.0, false)).toBe(true);
  });

  it('is false before the fence', () => {
    expect(shouldAutoNavigate(0.97, false)).toBe(false);
  });

  it('is false once already navigated, even at full progress', () => {
    expect(shouldAutoNavigate(1.0, true)).toBe(false);
    expect(shouldAutoNavigate(0.98, true)).toBe(false);
  });
});
