import { Observable } from '@/notepad/collection/observable';

export type HeroIntroStatus = 'idle' | 'playing' | 'revealed';

export interface HeroIntroState {
  status: HeroIntroStatus;
}

export interface HeroIntroSequenceDeps {
  // Builds + plays the gsap intro timeline. Must invoke `onHandoff` at the
  // handoff beat (t≈6.40) and `onComplete` at timeline end. The aesthetic
  // tweens live here (imperative, preserved verbatim).
  play: (callbacks: { onHandoff: () => void; onComplete: () => void }) => void;
  onHandoff?: () => void;
  onIntroComplete?: () => void;
}

// Owns the play-once intro → handoff → reveal lifecycle. `revealed` is reached
// at the handoff beat (before complete), which is what gates the desktop nav /
// mask reveal. Mirrors PurposeDetailReveal: deps-injected, node-testable.
export class HeroIntroSequence extends Observable<HeroIntroState> {
  private readonly deps: HeroIntroSequenceDeps;

  constructor(deps: HeroIntroSequenceDeps) {
    super({ status: 'idle' });
    this.deps = deps;
  }

  start = (): void => {
    if (this.getSnapshot().status !== 'idle') return; // play-once guard
    this.set('playing');
    this.deps.play({
      onHandoff: () => {
        if (this.getSnapshot().status === 'revealed') return; // no double-fire
        this.set('revealed');
        this.deps.onHandoff?.();
      },
      onComplete: () => {
        this.deps.onIntroComplete?.();
      },
    });
  };

  // Returns the controller to `idle` so a subsequent `start()` rebuilds the
  // timeline. Required because the controller is created once and persists
  // across React Strict Mode's mount → cleanup → mount cycle: the cleanup tears
  // down the gsap timeline, so the remount must be able to replay. Mirrors the
  // reset()/dispose() lifecycle on PurposeDetailReveal. The gsap teardown itself
  // lives in the component (killIntroRef), so this only resets the status.
  reset = (): void => {
    this.set('idle');
  };

  private set(status: HeroIntroStatus): void {
    (this as unknown as { setState: (u: (p: HeroIntroState) => HeroIntroState) => void })
      .setState(() => ({ status }));
  }
}
