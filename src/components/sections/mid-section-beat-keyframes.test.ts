import { describe, it, expect } from 'vitest';
import { buildMidSectionBeatKeyframes } from './mid-section-beat-keyframes';
import { INTRO_END, OUTRO_START } from './mid-section-intensity';
import type { Keyframe } from './motion-keyframes';

// Find a beat's enter keyframe (the one folding the initial hidden state via `from`).
const enterKf = (kfs: Keyframe[], target: string): Keyframe =>
  kfs.find((k) => k.target === target && k.from !== undefined)!;
// Find a beat's exit keyframe (no `from`, lifts to y:-20).
const exitKf = (kfs: Keyframe[], target: string): Keyframe =>
  kfs.find((k) => k.target === target && k.from === undefined && k.to.y === -20)!;

describe('buildMidSectionBeatKeyframes', () => {
  const webgpu = buildMidSectionBeatKeyframes('webgpu');
  const video = buildMidSectionBeatKeyframes('video');

  it('folds the initial hidden state into each beat enter keyframe', () => {
    for (const target of ['beat1', 'beat2', 'beat3', 'beat4', 'beat5']) {
      const enter = enterKf(webgpu, target);
      expect(enter.from).toEqual({ opacity: 0, y: 20 });
      expect(enter.to).toEqual({ opacity: 1, y: 0 });
      expect(enter.ease).toBe('power2.out');
    }
  });

  it('OUTRO_START invariant: beat5 exit ends at OUTRO_START in webgpu mode', () => {
    const exit = exitKf(webgpu, 'beat5');
    expect(exit.at + exit.duration).toBeCloseTo(OUTRO_START);
  });

  it('beat5 exit ends at 1.0 in video mode', () => {
    const exit = exitKf(video, 'beat5');
    expect(exit.at + exit.duration).toBeCloseTo(1.0);
  });

  it('webgpu mode offsets beat1 enter to INTRO_END (1/7), not 0', () => {
    expect(enterKf(webgpu, 'beat1').at).toBeCloseTo(INTRO_END);
    expect(enterKf(video, 'beat1').at).toBeCloseTo(0);
  });

  it('KISS-HANDOFF INVARIANT: beatN exit end === beatN+1 enter at (both modes)', () => {
    for (const kfs of [webgpu, video]) {
      for (let n = 1; n <= 4; n++) {
        const exit = exitKf(kfs, `beat${n}`);
        const nextEnter = enterKf(kfs, `beat${n + 1}`);
        expect(exit.at + exit.duration).toBeCloseTo(nextEnter.at);
      }
    }
  });

  it('exit keyframes lift to y:-20 with power1.in and no from', () => {
    const exit = exitKf(webgpu, 'beat1');
    expect(exit.to).toEqual({ opacity: 0, y: -20 });
    expect(exit.ease).toBe('power1.in');
    expect(exit.from).toBeUndefined();
  });
});
