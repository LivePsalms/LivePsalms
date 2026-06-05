import { describe, it, expect } from 'vitest';
import { decideHandoffEntrance } from './next-handoff-entrance-plan';

describe('decideHandoffEntrance', () => {
  // Full truth table over (reducedMotion, variant, inHorizontalTrack).
  // Precedence: inTrack-desktop snap > reducedFade > mobile snap > fullMotion.
  const cases: Array<{
    reducedMotion: boolean;
    variant: 'desktop' | 'mobile';
    inHorizontalTrack: boolean;
    expected: 'snap' | 'reducedFade' | 'fullMotion';
  }> = [
    { reducedMotion: false, variant: 'desktop', inHorizontalTrack: false, expected: 'fullMotion' },
    { reducedMotion: false, variant: 'desktop', inHorizontalTrack: true, expected: 'snap' },
    { reducedMotion: false, variant: 'mobile', inHorizontalTrack: false, expected: 'snap' },
    { reducedMotion: false, variant: 'mobile', inHorizontalTrack: true, expected: 'snap' },
    { reducedMotion: true, variant: 'desktop', inHorizontalTrack: false, expected: 'reducedFade' },
    { reducedMotion: true, variant: 'desktop', inHorizontalTrack: true, expected: 'snap' },
    { reducedMotion: true, variant: 'mobile', inHorizontalTrack: false, expected: 'reducedFade' },
    { reducedMotion: true, variant: 'mobile', inHorizontalTrack: true, expected: 'reducedFade' },
  ];

  it.each(cases)(
    'reducedMotion=$reducedMotion variant=$variant inHorizontalTrack=$inHorizontalTrack -> $expected',
    ({ reducedMotion, variant, inHorizontalTrack, expected }) => {
      expect(decideHandoffEntrance({ reducedMotion, variant, inHorizontalTrack })).toBe(expected);
    },
  );

  it('PRECEDENCE: desktop+inTrack+reducedMotion is snap, NOT reducedFade (branch A beats B)', () => {
    expect(
      decideHandoffEntrance({ reducedMotion: true, variant: 'desktop', inHorizontalTrack: true }),
    ).toBe('snap');
  });

  it('PRECEDENCE: mobile+reducedMotion is reducedFade, NOT snap (branch B beats C)', () => {
    expect(
      decideHandoffEntrance({ reducedMotion: true, variant: 'mobile', inHorizontalTrack: false }),
    ).toBe('reducedFade');
  });
});
