import { describe, it, expect } from 'vitest';
import {
  INTRO_END,
  OUTRO_START,
  READING_SCALE,
  FPS_FLOOR,
  FPS_STEADY,
  INTENSITY_BRIGHT,
  INTENSITY_NORMAL,
  easeInCubic,
} from './mid-section-intensity';

describe('band-edge constants', () => {
  it('INTRO_END is 1/7 of the timeline', () => {
    expect(INTRO_END).toBeCloseTo(1 / 7, 10);
  });
  it('OUTRO_START is 6/7 of the timeline', () => {
    expect(OUTRO_START).toBeCloseTo(6 / 7, 10);
  });
  it('READING_SCALE equals OUTRO_START - INTRO_END (5/7)', () => {
    expect(READING_SCALE).toBeCloseTo(5 / 7, 10);
    expect(READING_SCALE).toBeCloseTo(OUTRO_START - INTRO_END, 10);
  });
  it('intro and outro bands are symmetric — same span on either side of reading', () => {
    expect(INTRO_END).toBeCloseTo(1 - OUTRO_START, 10);
  });
});

describe('FPS endpoints', () => {
  it('floor is 3 fps (matches the spec)', () => {
    expect(FPS_FLOOR).toBe(3);
  });
  it('steady is 39 fps (matches the spec)', () => {
    expect(FPS_STEADY).toBe(39);
  });
});

describe('INTENSITY_BRIGHT', () => {
  it('matches the spec endpoints', () => {
    expect(INTENSITY_BRIGHT).toEqual({
      brightness: 3.45,
      bloomStrength: 3.30,
      bloomThreshold: 0.14,
    });
  });
});

describe('INTENSITY_NORMAL', () => {
  it('matches the spec endpoints', () => {
    expect(INTENSITY_NORMAL).toEqual({
      brightness: 1.20,
      bloomStrength: 2.20,
      bloomThreshold: 0.15,
    });
  });
});

describe('easeInCubic', () => {
  it('returns 0 at t=0', () => {
    expect(easeInCubic(0)).toBe(0);
  });
  it('returns 1 at t=1', () => {
    expect(easeInCubic(1)).toBe(1);
  });
  it('returns 0.125 at t=0.5 (cubic ease-in dwells at start)', () => {
    expect(easeInCubic(0.5)).toBeCloseTo(0.125, 10);
  });
  it('is monotonically increasing', () => {
    let prev = easeInCubic(0);
    for (let i = 1; i <= 100; i++) {
      const curr = easeInCubic(i / 100);
      expect(curr).toBeGreaterThanOrEqual(prev);
      prev = curr;
    }
  });
});
