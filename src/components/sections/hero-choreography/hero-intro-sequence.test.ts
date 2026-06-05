import { describe, it, expect } from 'vitest';
import { HeroIntroSequence } from './hero-intro-sequence';
import type { HeroIntroSequenceDeps } from './hero-intro-sequence';

interface Captured {
  playCalls: number;
  onHandoff: number;
  onIntroComplete: number;
  callbacks: { onHandoff: () => void; onComplete: () => void } | null;
}

function makeDeps(): { deps: HeroIntroSequenceDeps; cap: Captured } {
  const cap: Captured = { playCalls: 0, onHandoff: 0, onIntroComplete: 0, callbacks: null };
  const deps: HeroIntroSequenceDeps = {
    play: (callbacks) => {
      cap.playCalls++;
      cap.callbacks = callbacks;
    },
    onHandoff: () => {
      cap.onHandoff++;
    },
    onIntroComplete: () => {
      cap.onIntroComplete++;
    },
  };
  return { deps, cap };
}

describe('HeroIntroSequence — initial state', () => {
  it('starts idle', () => {
    const { deps } = makeDeps();
    expect(new HeroIntroSequence(deps).getSnapshot()).toEqual({ status: 'idle' });
  });
});

describe('HeroIntroSequence — start()', () => {
  it('moves idle → playing and invokes deps.play once', () => {
    const { deps, cap } = makeDeps();
    const r = new HeroIntroSequence(deps);
    r.start();
    expect(r.getSnapshot()).toEqual({ status: 'playing' });
    expect(cap.playCalls).toBe(1);
  });

  it('PLAY-ONCE GUARD: a second start() is a no-op', () => {
    const { deps, cap } = makeDeps();
    const r = new HeroIntroSequence(deps);
    r.start();
    r.start();
    expect(cap.playCalls).toBe(1);
  });
});

describe('HeroIntroSequence — reset()', () => {
  it('returns to idle so a subsequent start() replays (Strict Mode remount)', () => {
    const { deps, cap } = makeDeps();
    const r = new HeroIntroSequence(deps);
    r.start();
    expect(cap.playCalls).toBe(1);
    r.reset();
    expect(r.getSnapshot()).toEqual({ status: 'idle' });
    r.start();
    expect(cap.playCalls).toBe(2);
    expect(r.getSnapshot()).toEqual({ status: 'playing' });
  });
});

describe('HeroIntroSequence — handoff before complete', () => {
  it('handoff flips status → revealed and fires onHandoff', () => {
    const { deps, cap } = makeDeps();
    const r = new HeroIntroSequence(deps);
    r.start();
    cap.callbacks!.onHandoff();
    expect(r.getSnapshot()).toEqual({ status: 'revealed' });
    expect(cap.onHandoff).toBe(1);
    expect(cap.onIntroComplete).toBe(0);
  });

  it('complete fires onIntroComplete and leaves status revealed', () => {
    const { deps, cap } = makeDeps();
    const r = new HeroIntroSequence(deps);
    r.start();
    cap.callbacks!.onHandoff();
    cap.callbacks!.onComplete();
    expect(cap.onIntroComplete).toBe(1);
    expect(r.getSnapshot()).toEqual({ status: 'revealed' });
  });

  it('a repeated handoff callback does not double-fire onHandoff', () => {
    const { deps, cap } = makeDeps();
    const r = new HeroIntroSequence(deps);
    r.start();
    cap.callbacks!.onHandoff();
    cap.callbacks!.onHandoff();
    expect(cap.onHandoff).toBe(1);
  });
});
