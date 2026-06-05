import { describe, it, expect } from 'vitest';
import { applyKeyframes } from './keyframes';
import type { Keyframe, KeyframeTimeline } from './keyframes';

interface Call {
  method: 'set' | 'to' | 'fromTo';
  target: unknown;
  args: unknown[];
}

function makeFakeTimeline(): { tl: KeyframeTimeline; calls: Call[] } {
  const calls: Call[] = [];
  const tl: KeyframeTimeline = {
    set: (target, vars, at) => {
      calls.push({ method: 'set', target, args: [vars, at] });
      return tl;
    },
    to: (target, vars, at) => {
      calls.push({ method: 'to', target, args: [vars, at] });
      return tl;
    },
    fromTo: (target, from, to, at) => {
      calls.push({ method: 'fromTo', target, args: [from, to, at] });
      return tl;
    },
  };
  return { tl, calls };
}

describe('applyKeyframes', () => {
  it('emits tl.set for a zero-duration keyframe with no `from`', () => {
    const { tl, calls } = makeFakeTimeline();
    const kfs: Keyframe[] = [{ target: 'a', to: { opacity: 0 }, at: 0, duration: 0 }];
    applyKeyframes(tl, kfs, { a: 'EL_A' });
    expect(calls).toEqual([{ method: 'set', target: 'EL_A', args: [{ opacity: 0 }, 0] }]);
  });

  it('emits tl.to with duration+ease folded into the vars', () => {
    const { tl, calls } = makeFakeTimeline();
    const kfs: Keyframe[] = [
      { target: 'a', to: { x: 0 }, at: 0.221, duration: 0.227, ease: 'power3.out' },
    ];
    applyKeyframes(tl, kfs, { a: 'EL_A' });
    expect(calls).toEqual([
      { method: 'to', target: 'EL_A', args: [{ x: 0, duration: 0.227, ease: 'power3.out' }, 0.221] },
    ]);
  });

  it('emits tl.fromTo when a `from` is present', () => {
    const { tl, calls } = makeFakeTimeline();
    const kfs: Keyframe[] = [
      { target: 'clip', from: { width: '75%' }, to: { width: '100%' }, at: 0, duration: 0.55, ease: 'none' },
    ];
    applyKeyframes(tl, kfs, { clip: 'EL_CLIP' });
    expect(calls).toEqual([
      {
        method: 'fromTo',
        target: 'EL_CLIP',
        args: [{ width: '75%' }, { width: '100%', duration: 0.55, ease: 'none' }, 0],
      },
    ]);
  });

  it('skips keyframes whose target is missing from the map (null-safe)', () => {
    const { tl, calls } = makeFakeTimeline();
    const kfs: Keyframe[] = [{ target: 'ghost', to: { opacity: 1 }, at: 0, duration: 1 }];
    applyKeyframes(tl, kfs, { ghost: null });
    expect(calls).toEqual([]);
  });

  it('omits ease from the vars when the keyframe has none', () => {
    const { tl, calls } = makeFakeTimeline();
    const kfs: Keyframe[] = [{ target: 'a', to: { opacity: 1 }, at: 0, duration: 1 }];
    applyKeyframes(tl, kfs, { a: 'EL_A' });
    expect(calls[0].args[0]).toEqual({ opacity: 1, duration: 1 });
  });
});
