import { describe, it, expect } from 'vitest';
import { MOBILE_TIME_SCALE, scaleForMobile } from './motion-scale';

describe('motion-scale', () => {
  it('exposes MOBILE_TIME_SCALE = 0.7', () => {
    expect(MOBILE_TIME_SCALE).toBe(0.7);
  });

  it('scaleForMobile returns the desktop duration when isMobile is false', () => {
    expect(scaleForMobile(1.0, false)).toBe(1.0);
  });

  it('scaleForMobile multiplies the duration by MOBILE_TIME_SCALE when isMobile is true', () => {
    expect(scaleForMobile(1.0, true)).toBeCloseTo(0.7);
    expect(scaleForMobile(2.5, true)).toBeCloseTo(1.75);
  });
});
