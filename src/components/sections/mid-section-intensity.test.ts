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
  computeIntensityState,
  mapBeatProgressWebGPU,
} from './mid-section-intensity';
import { MID_SECTION_PIN_TIMING } from './mid-section-motion-content';

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

describe('computeIntensityState — intro band', () => {
  it('p=0: brightness/bloom at BRIGHT endpoints', () => {
    const s = computeIntensityState(0);
    expect(s.brightness).toBeCloseTo(INTENSITY_BRIGHT.brightness, 10);
    expect(s.bloomStrength).toBeCloseTo(INTENSITY_BRIGHT.bloomStrength, 10);
    expect(s.bloomThreshold).toBeCloseTo(INTENSITY_BRIGHT.bloomThreshold, 10);
  });

  it('p=0: simSpeed at FPS_FLOOR / 60', () => {
    const s = computeIntensityState(0);
    expect(s.simSpeed).toBeCloseTo(FPS_FLOOR / 60, 10);
  });

  it('p=INTRO_END: brightness/bloom at NORMAL endpoints', () => {
    const s = computeIntensityState(INTRO_END);
    expect(s.brightness).toBeCloseTo(INTENSITY_NORMAL.brightness, 10);
    expect(s.bloomStrength).toBeCloseTo(INTENSITY_NORMAL.bloomStrength, 10);
    expect(s.bloomThreshold).toBeCloseTo(INTENSITY_NORMAL.bloomThreshold, 10);
  });

  it('p=INTRO_END: simSpeed at FPS_STEADY / 60', () => {
    const s = computeIntensityState(INTRO_END);
    expect(s.simSpeed).toBeCloseTo(FPS_STEADY / 60, 10);
  });

  it('p=INTRO_END/2: dwells near BRIGHT (cubic ease-in — only 12.5% of transition done)', () => {
    const s = computeIntensityState(INTRO_END / 2);
    // brightness should be 12.5% of the way from BRIGHT toward NORMAL
    const expected = INTENSITY_BRIGHT.brightness
      + 0.125 * (INTENSITY_NORMAL.brightness - INTENSITY_BRIGHT.brightness);
    expect(s.brightness).toBeCloseTo(expected, 6);
    // simSpeed should be 12.5% of the way from FPS_FLOOR toward FPS_STEADY (then /60)
    const expectedFps = FPS_FLOOR + 0.125 * (FPS_STEADY - FPS_FLOOR);
    expect(s.simSpeed).toBeCloseTo(expectedFps / 60, 6);
  });
});

describe('computeIntensityState — reading band', () => {
  it('p just past INTRO_END: holds at NORMAL', () => {
    const s = computeIntensityState(INTRO_END + 0.001);
    expect(s.brightness).toBeCloseTo(INTENSITY_NORMAL.brightness, 10);
    expect(s.bloomStrength).toBeCloseTo(INTENSITY_NORMAL.bloomStrength, 10);
    expect(s.bloomThreshold).toBeCloseTo(INTENSITY_NORMAL.bloomThreshold, 10);
    expect(s.simSpeed).toBeCloseTo(FPS_STEADY / 60, 10);
  });

  it('p=0.5 (mid-reading): holds at NORMAL', () => {
    const s = computeIntensityState(0.5);
    expect(s.brightness).toBeCloseTo(INTENSITY_NORMAL.brightness, 10);
    expect(s.simSpeed).toBeCloseTo(FPS_STEADY / 60, 10);
  });

  it('p just before OUTRO_START: holds at NORMAL', () => {
    const s = computeIntensityState(OUTRO_START - 0.001);
    expect(s.brightness).toBeCloseTo(INTENSITY_NORMAL.brightness, 10);
    expect(s.simSpeed).toBeCloseTo(FPS_STEADY / 60, 10);
  });
});

describe('computeIntensityState — outro band', () => {
  it('p=OUTRO_START: brightness/bloom at NORMAL endpoints', () => {
    const s = computeIntensityState(OUTRO_START);
    expect(s.brightness).toBeCloseTo(INTENSITY_NORMAL.brightness, 10);
    expect(s.bloomStrength).toBeCloseTo(INTENSITY_NORMAL.bloomStrength, 10);
    expect(s.bloomThreshold).toBeCloseTo(INTENSITY_NORMAL.bloomThreshold, 10);
  });

  it('p=OUTRO_START: simSpeed at FPS_STEADY / 60', () => {
    const s = computeIntensityState(OUTRO_START);
    expect(s.simSpeed).toBeCloseTo(FPS_STEADY / 60, 10);
  });

  it('p=1: brightness/bloom at BRIGHT endpoints', () => {
    const s = computeIntensityState(1);
    expect(s.brightness).toBeCloseTo(INTENSITY_BRIGHT.brightness, 10);
    expect(s.bloomStrength).toBeCloseTo(INTENSITY_BRIGHT.bloomStrength, 10);
    expect(s.bloomThreshold).toBeCloseTo(INTENSITY_BRIGHT.bloomThreshold, 10);
  });

  it('p=1: simSpeed at FPS_FLOOR / 60', () => {
    const s = computeIntensityState(1);
    expect(s.simSpeed).toBeCloseTo(FPS_FLOOR / 60, 10);
  });

  it('p at midpoint of outro band: dwells near NORMAL (cubic ease-in)', () => {
    const midOutro = OUTRO_START + (1 - OUTRO_START) / 2;
    const s = computeIntensityState(midOutro);
    // brightness should be 12.5% of the way from NORMAL toward BRIGHT
    const expected = INTENSITY_NORMAL.brightness
      + 0.125 * (INTENSITY_BRIGHT.brightness - INTENSITY_NORMAL.brightness);
    expect(s.brightness).toBeCloseTo(expected, 6);
    // simSpeed should be 12.5% of the way from FPS_STEADY toward FPS_FLOOR (then /60)
    const expectedFps = FPS_STEADY + 0.125 * (FPS_FLOOR - FPS_STEADY);
    expect(s.simSpeed).toBeCloseTo(expectedFps / 60, 6);
  });
});

describe('mapBeatProgressWebGPU', () => {
  it('raw 0 maps to INTRO_END (beat 1 enters as intro ends)', () => {
    expect(mapBeatProgressWebGPU(0)).toBeCloseTo(INTRO_END, 10);
  });

  it('raw 1 maps to OUTRO_START (beat 5 exits as outro begins)', () => {
    expect(mapBeatProgressWebGPU(1)).toBeCloseTo(OUTRO_START, 10);
  });

  it('raw 0.5 maps to 0.5 (the symmetric bookends make timeline midpoint == reading midpoint)', () => {
    expect(mapBeatProgressWebGPU(0.5)).toBeCloseTo(INTRO_END + 0.5 * READING_SCALE, 10);
    expect(mapBeatProgressWebGPU(0.5)).toBeCloseTo(0.5, 10);
  });

  it('preserves the kiss handoff between beats (beat2 enter == beat1 exit, mapped)', () => {
    const beat1ExitMapped = mapBeatProgressWebGPU(MID_SECTION_PIN_TIMING.beat1.exit);
    const beat2EnterMapped = mapBeatProgressWebGPU(MID_SECTION_PIN_TIMING.beat2.enter);
    expect(beat1ExitMapped).toBeCloseTo(beat2EnterMapped, 10);
  });

  it('preserves the kiss handoff between every adjacent beat pair', () => {
    const pairs: Array<[keyof typeof MID_SECTION_PIN_TIMING, keyof typeof MID_SECTION_PIN_TIMING]> = [
      ['beat1', 'beat2'],
      ['beat2', 'beat3'],
      ['beat3', 'beat4'],
      ['beat4', 'beat5'],
    ];
    for (const [a, b] of pairs) {
      expect(mapBeatProgressWebGPU(MID_SECTION_PIN_TIMING[a].exit))
        .toBeCloseTo(mapBeatProgressWebGPU(MID_SECTION_PIN_TIMING[b].enter), 10);
    }
  });

  it('beat 1 hold-start lands at ~0.172 (matches spec example)', () => {
    expect(mapBeatProgressWebGPU(MID_SECTION_PIN_TIMING.beat1.holdStart)).toBeCloseTo(0.1714, 4);
  });
});
