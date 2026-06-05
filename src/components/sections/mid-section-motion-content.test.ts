import { describe, it, expect } from 'vitest';
import { BEATS, MID_SECTION_PIN_TIMING, MID_SECTION_VIDEO_DURATION } from './mid-section-motion-content';

describe('BEATS', () => {
  it('exports exactly five beats', () => {
    expect(BEATS).toHaveLength(5);
  });

  it('beat 1 — release the weight', () => {
    expect(BEATS[0]).toBe(
      'This is a digital space to release the weight of the day, breathe, and reset before life asks anything more of you.',
    );
  });

  it('beat 2 — slow finding of your way back', () => {
    expect(BEATS[1]).toBe(
      'A slow finding of your way back to the wholeness — body, mind, spirit — that has been waiting for you the whole time.',
    );
  });

  it('beat 3 — a single thought long enough', () => {
    expect(BEATS[2]).toBe(
      'A space that holds a single thought long enough for it to become a prayer — and for the prayer to become a record of what God is teaching you.',
    );
  });

  it('beat 4 — reconnect', () => {
    expect(BEATS[3]).toBe(
      'Reconnect with yourself. With the One who has been waiting. The threshold between the noise and the sanctuary that has always lived inside you.',
    );
  });

  it('beat 5 — no matter what', () => {
    expect(BEATS[4]).toBe(
      "No matter what the day is doing. No matter what the news is doing. The peace you've been looking for isn't out there. It's a room inside you have the capability to return to, anytime.",
    );
  });
});

describe('MID_SECTION_PIN_TIMING', () => {
  describe('beat1', () => {
    it('enters at the start of the timeline', () => {
      expect(MID_SECTION_PIN_TIMING.beat1.enter).toBe(0);
    });
    it('reaches full opacity at 0.04', () => {
      expect(MID_SECTION_PIN_TIMING.beat1.holdStart).toBe(0.04);
    });
    it('begins exit fade at 0.16', () => {
      expect(MID_SECTION_PIN_TIMING.beat1.holdEnd).toBe(0.16);
    });
    it('completes exit at 0.20 (kiss handoff to beat2)', () => {
      expect(MID_SECTION_PIN_TIMING.beat1.exit).toBe(0.20);
    });
  });

  describe('beat2', () => {
    it('enters at 0.20 (kissing beat1 exit)', () => {
      expect(MID_SECTION_PIN_TIMING.beat2.enter).toBe(0.20);
    });
    it('reaches full opacity at 0.24', () => {
      expect(MID_SECTION_PIN_TIMING.beat2.holdStart).toBe(0.24);
    });
    it('begins exit fade at 0.36', () => {
      expect(MID_SECTION_PIN_TIMING.beat2.holdEnd).toBe(0.36);
    });
    it('completes exit at 0.40 (kiss handoff to beat3)', () => {
      expect(MID_SECTION_PIN_TIMING.beat2.exit).toBe(0.40);
    });
  });

  describe('beat3', () => {
    it('enters at 0.40 (kissing beat2 exit)', () => {
      expect(MID_SECTION_PIN_TIMING.beat3.enter).toBe(0.40);
    });
    it('reaches full opacity at 0.44', () => {
      expect(MID_SECTION_PIN_TIMING.beat3.holdStart).toBe(0.44);
    });
    it('begins exit fade at 0.56', () => {
      expect(MID_SECTION_PIN_TIMING.beat3.holdEnd).toBe(0.56);
    });
    it('completes exit at 0.60 (kiss handoff to beat4)', () => {
      expect(MID_SECTION_PIN_TIMING.beat3.exit).toBe(0.60);
    });
  });

  describe('beat4', () => {
    it('enters at 0.60 (kissing beat3 exit)', () => {
      expect(MID_SECTION_PIN_TIMING.beat4.enter).toBe(0.60);
    });
    it('reaches full opacity at 0.64', () => {
      expect(MID_SECTION_PIN_TIMING.beat4.holdStart).toBe(0.64);
    });
    it('begins exit fade at 0.76', () => {
      expect(MID_SECTION_PIN_TIMING.beat4.holdEnd).toBe(0.76);
    });
    it('completes exit at 0.80 (kiss handoff to beat5)', () => {
      expect(MID_SECTION_PIN_TIMING.beat4.exit).toBe(0.80);
    });
  });

  describe('beat5', () => {
    it('enters at 0.80 (kissing beat4 exit)', () => {
      expect(MID_SECTION_PIN_TIMING.beat5.enter).toBe(0.80);
    });
    it('reaches full opacity at 0.84', () => {
      expect(MID_SECTION_PIN_TIMING.beat5.holdStart).toBe(0.84);
    });
    it('begins exit fade at 0.96', () => {
      expect(MID_SECTION_PIN_TIMING.beat5.holdEnd).toBe(0.96);
    });
    it('completes exit at 1.0 (end of pin)', () => {
      expect(MID_SECTION_PIN_TIMING.beat5.exit).toBe(1.0);
    });
  });

  it('uses kiss-handoff: beat2 enters exactly where beat1 exits', () => {
    expect(MID_SECTION_PIN_TIMING.beat2.enter).toBe(MID_SECTION_PIN_TIMING.beat1.exit);
  });
  it('uses kiss-handoff: beat3 enters exactly where beat2 exits', () => {
    expect(MID_SECTION_PIN_TIMING.beat3.enter).toBe(MID_SECTION_PIN_TIMING.beat2.exit);
  });
  it('uses kiss-handoff: beat4 enters exactly where beat3 exits', () => {
    expect(MID_SECTION_PIN_TIMING.beat4.enter).toBe(MID_SECTION_PIN_TIMING.beat3.exit);
  });
  it('uses kiss-handoff: beat5 enters exactly where beat4 exits', () => {
    expect(MID_SECTION_PIN_TIMING.beat5.enter).toBe(MID_SECTION_PIN_TIMING.beat4.exit);
  });

  it('every beat has enter ≤ holdStart < holdEnd ≤ exit', () => {
    for (const key of ['beat1', 'beat2', 'beat3', 'beat4', 'beat5'] as const) {
      const b = MID_SECTION_PIN_TIMING[key];
      expect(b.enter).toBeLessThanOrEqual(b.holdStart);
      expect(b.holdStart).toBeLessThan(b.holdEnd);
      expect(b.holdEnd).toBeLessThanOrEqual(b.exit);
    }
  });

  it('first beat enter is 0; last beat exit is 1.0', () => {
    expect(MID_SECTION_PIN_TIMING.beat1.enter).toBe(0);
    expect(MID_SECTION_PIN_TIMING.beat5.exit).toBe(1.0);
  });
});

describe('MID_SECTION_VIDEO_DURATION', () => {
  it('matches the source video duration in seconds (from ffprobe)', () => {
    expect(MID_SECTION_VIDEO_DURATION).toBeCloseTo(10.041667, 5);
  });
});
