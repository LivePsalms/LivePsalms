import { Observable } from '@/notepad/collection/observable';

/**
 * Status values for the route-transition state machine.
 *
 *   idle ──(beginNavigation)──> expanding ──(completePhase)──> revealing ──(completePhase)──> idle
 *   idle ──(beginExit)──────> exiting ──(completeExit)────> expanding (then as above)
 *
 * `exiting` exists only on the back-from-detail flow: PurposeDetail plays a
 * text-fade animation while the SplitTransition overlay is still hidden, then
 * calls `completeExit(target)` to start the overlay.
 */
export type RouteTransitionStatus = 'idle' | 'exiting' | 'expanding' | 'revealing';

export interface RouteTransitionState {
  status: RouteTransitionStatus;
  color: string;
}

/**
 * Imperative side effects the transition depends on. Injected so the class
 * stays pure-state and testable in node — fakes substitute for DOM, GSAP, and
 * react-router at test time.
 */
export interface RouteTransitionDeps {
  navigate: (target: string) => void;
  killScrollTriggers: () => void;
  setBodyOverflow: (value: string) => void;
  scrollWindow: (y: number) => void;
  getScrollY: () => number;
}

/**
 * Owns the canonical state for an in-flight route transition: phase, color,
 * pending target, back-nav flag, and saved scroll position. Side effects
 * (`navigate`, `killScrollTriggers`, `setBodyOverflow`, `scrollWindow`) fire
 * at the deterministic phase boundaries that drive them — never inline at
 * consumers.
 *
 * Does NOT own: the popstate listener, history.pushState back-button trap,
 * or knowledge of which paths are detail pages. Those live in
 * `useRouteTransition` (the React glue).
 */
export class RouteTransition extends Observable<RouteTransitionState> {
  private readonly deps: RouteTransitionDeps;
  private pendingTarget: string | null = null;
  private isBackNav = false;
  private savedScrollY: number | null = null;

  constructor(deps: RouteTransitionDeps, initialColor: string) {
    super({ status: 'idle', color: initialColor });
    this.deps = deps;
  }

  /** User clicked a project; start forward navigation. No-op if not idle. */
  beginNavigation = (target: string, color: string): void => {
    if (this.getSnapshot().status !== 'idle') return;
    this.savedScrollY = this.deps.getScrollY();
    this.pendingTarget = target;
    this.isBackNav = false;
    this.deps.setBodyOverflow('hidden');
    this.update(() => ({ status: 'expanding', color }));
  };

  /**
   * Browser back button intercepted on a detail page; play exit animation
   * before the overlay. No-op if not idle (defends against double popstate).
   */
  beginExit = (color: string): void => {
    if (this.getSnapshot().status !== 'idle') return;
    this.isBackNav = true;
    this.update(() => ({ status: 'exiting', color }));
  };

  /** Exit animation finished; start the overlay expansion. No-op if not exiting. */
  completeExit = (target: string): void => {
    if (this.getSnapshot().status !== 'exiting') return;
    this.pendingTarget = target;
    this.deps.setBodyOverflow('hidden');
    this.update((prev) => ({ ...prev, status: 'expanding' }));
  };

  /** SplitTransition phase finished. Drives `expanding → revealing → idle`. */
  completePhase = (): void => {
    const { status } = this.getSnapshot();
    if (status === 'expanding') {
      this.advanceFromExpanding();
    } else if (status === 'revealing') {
      this.deps.setBodyOverflow('auto');
      this.update((prev) => ({ ...prev, status: 'idle' }));
    }
  };

  /**
   * Belt-and-suspenders scroll reset on pathname change. Restores the saved
   * position on back navigation, scrolls to 0 otherwise. Clears scroll state.
   */
  handleLocationChanged = (): void => {
    if (this.isBackNav) {
      const y = this.savedScrollY ?? 0;
      this.deps.scrollWindow(y);
      this.savedScrollY = null;
      this.isBackNav = false;
    } else {
      this.deps.scrollWindow(0);
    }
  };

  private advanceFromExpanding(): void {
    if (this.pendingTarget) {
      this.deps.killScrollTriggers();
      this.deps.setBodyOverflow('');
      const restoreY = this.isBackNav ? (this.savedScrollY ?? 0) : 0;
      this.deps.scrollWindow(restoreY);
      this.deps.navigate(this.pendingTarget);
      this.pendingTarget = null;
    }
    this.update((prev) => ({ ...prev, status: 'revealing' }));
  }

  private update(updater: (prev: RouteTransitionState) => RouteTransitionState): void {
    this.setState(updater);
  }
}
