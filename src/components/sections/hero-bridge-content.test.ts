import { describe, it, expect } from 'vitest';
import { BRIDGE_COPY, BRIDGE_PIN_TIMING } from './hero-bridge-content';

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

describe('BRIDGE_PIN_TIMING', () => {
  describe('text1 (invitation)', () => {
    it('enters at the start of the timeline', () => {
      expect(BRIDGE_PIN_TIMING.text1.enter).toBe(0);
    });
    it('reaches full opacity at 0.10', () => {
      expect(BRIDGE_PIN_TIMING.text1.holdStart).toBe(0.10);
    });
    it('begins exit fade at 0.28', () => {
      expect(BRIDGE_PIN_TIMING.text1.holdEnd).toBe(0.28);
    });
    it('completes exit at 0.34 (kiss handoff to text2)', () => {
      expect(BRIDGE_PIN_TIMING.text1.exit).toBe(0.34);
    });
  });

  describe('text2 (thesis)', () => {
    it('enters at 0.34 (kissing text1 exit)', () => {
      expect(BRIDGE_PIN_TIMING.text2.enter).toBe(0.34);
    });
    it('reaches full opacity at 0.44 (longer enter window for the slide-in)', () => {
      expect(BRIDGE_PIN_TIMING.text2.holdStart).toBe(0.44);
    });
    it('begins exit fade at 0.60', () => {
      expect(BRIDGE_PIN_TIMING.text2.holdEnd).toBe(0.60);
    });
    it('completes exit at 0.66 (kiss handoff to text3)', () => {
      expect(BRIDGE_PIN_TIMING.text2.exit).toBe(0.66);
    });
  });

  describe('text3 (assurance)', () => {
    it('enters at 0.66 (kissing text2 exit)', () => {
      expect(BRIDGE_PIN_TIMING.text3.enter).toBe(0.66);
    });
    it('reaches full opacity at 0.76 (longer enter window for the pronounced rise)', () => {
      expect(BRIDGE_PIN_TIMING.text3.holdStart).toBe(0.76);
    });
    it('begins exit fade at 0.95 (long hold)', () => {
      expect(BRIDGE_PIN_TIMING.text3.holdEnd).toBe(0.95);
    });
    it('completes exit at 1.0 (end of pin)', () => {
      expect(BRIDGE_PIN_TIMING.text3.exit).toBe(1.0);
    });
  });

  it('uses kiss-handoff: text2 enters exactly where text1 exits', () => {
    expect(BRIDGE_PIN_TIMING.text2.enter).toBe(BRIDGE_PIN_TIMING.text1.exit);
  });

  it('uses kiss-handoff: text3 enters exactly where text2 exits', () => {
    expect(BRIDGE_PIN_TIMING.text3.enter).toBe(BRIDGE_PIN_TIMING.text2.exit);
  });
});
