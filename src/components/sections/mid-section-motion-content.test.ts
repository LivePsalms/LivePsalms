import { describe, it, expect } from 'vitest';
import { BEATS } from './mid-section-motion-content';

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
