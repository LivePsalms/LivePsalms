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

describe('mid-section-intensity', () => {
  // Constants: band edges
  describe('band edges', () => {
    it('exports INTRO_END as 0.3', () => {
      expect(INTRO_END).toBe(0.3);
    });

    it('exports OUTRO_START as 0.7', () => {
      expect(OUTRO_START).toBe(0.7);
    });
  });

  // Constants: reading scale
  describe('reading scale', () => {
    it('exports READING_SCALE as 0.85', () => {
      expect(READING_SCALE).toBe(0.85);
    });
  });

  // Constants: FPS endpoints
  describe('FPS endpoints', () => {
    it('exports FPS_FLOOR as 24', () => {
      expect(FPS_FLOOR).toBe(24);
    });

    it('exports FPS_STEADY as 30', () => {
      expect(FPS_STEADY).toBe(30);
    });
  });

  // Constants: intensity states
  describe('intensity states', () => {
    it('exports INTENSITY_BRIGHT as 1.4', () => {
      expect(INTENSITY_BRIGHT).toBe(1.4);
    });

    it('exports INTENSITY_NORMAL as 1.0', () => {
      expect(INTENSITY_NORMAL).toBe(1.0);
    });
  });

  // Function: easeInCubic
  describe('easeInCubic', () => {
    it('returns 0 at t=0', () => {
      expect(easeInCubic(0)).toBe(0);
    });

    it('returns 1 at t=1', () => {
      expect(easeInCubic(1)).toBe(1);
    });

    it('returns t³ for any t in [0,1]', () => {
      expect(easeInCubic(0.5)).toBe(0.125); // 0.5^3 = 0.125
      expect(easeInCubic(0.25)).toBe(0.015625); // 0.25^3
      expect(easeInCubic(0.75)).toBe(0.421875); // 0.75^3
    });

    it('is a cubic function', () => {
      const t = 0.6;
      expect(easeInCubic(t)).toBeCloseTo(t * t * t);
    });
  });
});
