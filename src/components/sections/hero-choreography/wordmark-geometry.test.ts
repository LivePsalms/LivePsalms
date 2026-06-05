import { describe, it, expect } from 'vitest';
import { WORDMARK_COLLAPSE, wordmarkAuraSizes } from './wordmark-geometry';

describe('WORDMARK_COLLAPSE', () => {
  it('carries the five SVG-userspace letter offsets verbatim', () => {
    expect(WORDMARK_COLLAPSE).toEqual({
      P: 653.3,
      S1: 339.8,
      L: -313.9,
      M: -690.5,
      S2: -1076.4,
    });
  });
});

describe('wordmarkAuraSizes', () => {
  it('derives aura/ring sizes from the measured wordmark width', () => {
    expect(wordmarkAuraSizes(1100)).toEqual({
      aura: 1100 * 0.6545,
      ringInitial: 1100 * 0.2364,
      ringFinal: 1100 * 2.5455,
    });
  });

  it('scales linearly with width', () => {
    expect(wordmarkAuraSizes(550).aura).toBeCloseTo(wordmarkAuraSizes(1100).aura / 2, 6);
  });
});
