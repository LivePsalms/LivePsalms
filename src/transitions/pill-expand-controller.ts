export interface RectLike {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ExpandTiming {
  expandSeconds: number;
  layerFadeSeconds: number;
  layerFadeStartSeconds: number;
  postNavHoldMs: number;
  coverFadeMs: number;
}

export interface StartOptions {
  pillRect: RectLike;
  targetUrl: string;
  pillColor: string;
  reducedMotion: boolean;
}

export interface PillExpandDeps {
  /** Create the DOM cover element with initial styles. The impl owns DOM and ref tracking. */
  createCover: (opts: { rect: RectLike; pillColor: string }) => void;
  /** Remove any existing cover element. Safe to call when none exists. */
  removeCover: () => void;
  /** Execute the GSAP timeline that morphs the cover; the impl is responsible for navigating at the end and cleaning up. */
  runExpandTimeline: (opts: { timing: ExpandTiming; targetUrl: string }) => void;
  /** Lock or release document body scroll. Pass '' to release. */
  setBodyOverflow: (value: string) => void;
  /** True if a cover element is already in the DOM (e.g., leftover from a prior aborted morph). */
  hasExistingCover: () => boolean;
}

const NORMAL_TIMING: ExpandTiming = {
  expandSeconds: 0.65,
  layerFadeSeconds: 0.35,
  layerFadeStartSeconds: 0.15,
  postNavHoldMs: 200,
  coverFadeMs: 400,
};

const REDUCED_TIMING: ExpandTiming = {
  expandSeconds: 0,
  layerFadeSeconds: 0,
  layerFadeStartSeconds: 0,
  postNavHoldMs: 50,
  coverFadeMs: 200,
};

export class PillExpandController {
  private readonly deps: PillExpandDeps;
  private navigated = false;

  constructor(deps: PillExpandDeps) {
    this.deps = deps;
  }

  hasNavigated(): boolean {
    return this.navigated;
  }

  start = ({ pillRect, targetUrl, pillColor, reducedMotion }: StartOptions): void => {
    if (this.navigated) return;
    if (this.deps.hasExistingCover()) return;
    this.navigated = true;

    this.deps.setBodyOverflow('hidden');
    this.deps.createCover({ rect: pillRect, pillColor });
    this.deps.runExpandTimeline({
      timing: reducedMotion ? REDUCED_TIMING : NORMAL_TIMING,
      targetUrl,
    });
  };

  cleanup = (): void => {
    this.deps.removeCover();
    this.deps.setBodyOverflow('');
  };
}
