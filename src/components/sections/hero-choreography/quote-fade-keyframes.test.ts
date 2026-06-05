import { describe, it, expect } from 'vitest';
import { quoteFadeKeyframes } from './quote-fade-keyframes';
import { projectFinalFrame } from './keyframes';

describe('quoteFadeKeyframes', () => {
  const kfs = quoteFadeKeyframes();

  it('seeds all three lines hidden + offset + blurred at t=0', () => {
    const sets = kfs.filter((k) => k.duration === 0);
    expect(sets).toHaveLength(3);
    sets.forEach((s) => expect(s.to).toEqual({ opacity: 0, y: 40, filter: 'blur(10px)' }));
  });

  it('staggers the three reveals at 0, 0.35, 0.70', () => {
    const reveals = kfs.filter((k) => k.duration > 0);
    expect(reveals.map((k) => k.at)).toEqual([0, 0.35, 0.70]);
  });

  it('REDUCED == LAST FRAME: every line ends fully visible at rest', () => {
    const final = projectFinalFrame(kfs);
    Object.values(final).forEach((vars) =>
      expect(vars).toEqual({ opacity: 1, y: 0, filter: 'blur(0px)' }),
    );
  });
});
