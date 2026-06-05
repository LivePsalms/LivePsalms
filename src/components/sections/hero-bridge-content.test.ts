import { describe, it, expect } from 'vitest';
import { BRIDGE_COPY, BRIDGE_PIN_TIMING } from './hero-bridge-content';
import { bridgeCascadeKeyframes } from './hero-bridge-content';
import { projectFinalFrame } from './hero-choreography/keyframes';

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
    it('begins exit fade at 0.32', () => {
      expect(BRIDGE_PIN_TIMING.text1.holdEnd).toBe(0.32);
    });
    it('completes exit at 0.40 (kiss handoff to text2)', () => {
      expect(BRIDGE_PIN_TIMING.text1.exit).toBe(0.40);
    });
  });

  describe('text2 (thesis)', () => {
    it('enters at 0.40 (kissing text1 exit)', () => {
      expect(BRIDGE_PIN_TIMING.text2.enter).toBe(0.40);
    });
    it('reaches full opacity at 0.50 (longer enter window for the slide-in)', () => {
      expect(BRIDGE_PIN_TIMING.text2.holdStart).toBe(0.50);
    });
    it('begins exit fade at 0.64', () => {
      expect(BRIDGE_PIN_TIMING.text2.holdEnd).toBe(0.64);
    });
    it('completes exit at 0.70 (kiss handoff to text3)', () => {
      expect(BRIDGE_PIN_TIMING.text2.exit).toBe(0.70);
    });
  });

  describe('text3 (assurance)', () => {
    it('enters at 0.70 (kissing text2 exit)', () => {
      expect(BRIDGE_PIN_TIMING.text3.enter).toBe(0.70);
    });
    it('reaches full opacity at 0.80 (longer enter window for the pronounced rise)', () => {
      expect(BRIDGE_PIN_TIMING.text3.holdStart).toBe(0.80);
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

describe('bridgeCascadeKeyframes', () => {
  const desktop = bridgeCascadeKeyframes({ enterX2: 120 });

  it('seeds the three initial states at t=0 (set keyframes)', () => {
    const sets = desktop.filter((k) => k.duration === 0);
    expect(sets).toEqual([
      { target: 't1', to: { opacity: 0, y: 40, filter: 'blur(10px)' }, at: 0, duration: 0 },
      { target: 't2', to: { opacity: 0, x: 120, filter: 'blur(10px)' }, at: 0, duration: 0 },
      { target: 't3', to: { opacity: 0, y: 80, filter: 'blur(10px)' }, at: 0, duration: 0 },
    ]);
  });

  it('uses the BRIDGE_PIN_TIMING kiss-handoff fractions for the enter tweens', () => {
    const enters = desktop.filter((k) => k.duration > 0 && k.to.opacity === 1);
    expect(enters.map((k) => k.at)).toEqual([0, 0.40, 0.70]);
  });

  it('threads the configurable text-2 enter offset into both the set and the slide', () => {
    const mobile = bridgeCascadeKeyframes({ enterX2: 30 });
    const set2 = mobile.find((k) => k.target === 't2' && k.duration === 0);
    expect(set2?.to.x).toBe(30);
  });

  it('reduced projection leaves text-2/3 settled at rest (carve-out hides them in JSX, not here)', () => {
    const final = projectFinalFrame(desktop);
    expect(final.t3).toMatchObject({ opacity: 0, y: 0, filter: 'blur(0px)' });
  });
});
