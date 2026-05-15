import { describe, it, expect } from 'vitest';
import { BRIDGE_COPY, BRIDGE_CASCADE_TIMING } from './hero-bridge-content';

describe('BRIDGE_COPY', () => {
  it('exports the invitation beat', () => {
    expect(BRIDGE_COPY.invitation).toBe(
      'Come here to pause. To refill. To reflect. To reconnect.',
    );
  });

  it('exports the thesis beat', () => {
    expect(BRIDGE_COPY.thesis).toBe('Restoration is a returning.');
  });

  it('exports the assurance beat', () => {
    expect(BRIDGE_COPY.assurance).toBe(
      'Your life with God is not slipping away. It is being kept.',
    );
  });
});

describe('BRIDGE_CASCADE_TIMING', () => {
  it('positions the invitation at the start of the timeline', () => {
    expect(BRIDGE_CASCADE_TIMING.invitation).toBe(0);
  });

  it('positions the thesis at 0.35 (matches Psalm 23 line-2 stagger)', () => {
    expect(BRIDGE_CASCADE_TIMING.thesis).toBe(0.35);
  });

  it('positions the assurance at 0.7 (matches Psalm 23 attribution stagger)', () => {
    expect(BRIDGE_CASCADE_TIMING.assurance).toBe(0.7);
  });
});
