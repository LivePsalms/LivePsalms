import { Observable } from '@/notepad/collection/observable';

export type DetailRevealStatus = 'idle' | 'entering' | 'revealed' | 'exiting' | 'exited';

export interface DetailRevealState {
  status: DetailRevealStatus;
  isVisible: boolean;
  textReady: boolean;
}

export interface ExitStyles {
  transition: string;
  opacity: string;
  transform?: string;
  filter?: string;
}

export interface DetailRevealDeps {
  applyExitStyles: (target: 'content' | 'image', styles: ExitStyles) => void;
  setTimer: (cb: () => void, ms: number) => number;
  clearTimer: (handle: number) => void;
  onExitComplete: () => void;
}

export const DETAIL_REVEAL_TIMELINE = {
  textReadyAt: 1400,
  exitCompleteAt: 650,
  easing: 'cubic-bezier(0.22,1,0.36,1)',
  contentExit: {
    transition:
      'opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1), filter 0.6s cubic-bezier(0.22,1,0.36,1)',
    opacity: '0',
    transform: 'translateY(40px)',
    filter: 'blur(8px)',
  },
  imageExit: {
    transition: 'opacity 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s',
    opacity: '0',
  },
} as const;

export class PurposeDetailReveal extends Observable<DetailRevealState> {
  private readonly deps: DetailRevealDeps;
  private textReadyHandle: number | null = null;
  private exitHandle: number | null = null;

  constructor(deps: DetailRevealDeps) {
    super({ status: 'idle', isVisible: false, textReady: false });
    this.deps = deps;
  }

  start = (): void => {
    if (this.getSnapshot().status !== 'idle') return;
    this.scheduleEntry();
  };

  reset = (): void => {
    this.cancelTextReadyTimer();
    this.scheduleEntry();
  };

  dispose = (): void => {
    this.cancelTextReadyTimer();
    if (this.exitHandle !== null) {
      this.deps.clearTimer(this.exitHandle);
      this.exitHandle = null;
    }
  };

  requestExit = (): void => {
    const { status } = this.getSnapshot();
    if (status !== 'entering' && status !== 'revealed') return;
    this.cancelTextReadyTimer();
    this.deps.applyExitStyles('content', DETAIL_REVEAL_TIMELINE.contentExit);
    this.deps.applyExitStyles('image', DETAIL_REVEAL_TIMELINE.imageExit);
    this.setStatus('exiting', { isVisible: true, textReady: true });
    this.exitHandle = this.deps.setTimer(() => {
      if (this.exitHandle === null) return;
      this.exitHandle = null;
      this.setStatus('exited', { isVisible: false, textReady: false });
      this.deps.onExitComplete();
    }, DETAIL_REVEAL_TIMELINE.exitCompleteAt);
  };

  private cancelTextReadyTimer(): void {
    if (this.textReadyHandle !== null) {
      this.deps.clearTimer(this.textReadyHandle);
      this.textReadyHandle = null;
    }
  }

  private scheduleEntry(): void {
    this.setStatus('entering', { isVisible: true, textReady: false });
    this.textReadyHandle = this.deps.setTimer(() => {
      if (this.textReadyHandle === null) return;
      this.textReadyHandle = null;
      this.setStatus('revealed', { isVisible: true, textReady: true });
    }, DETAIL_REVEAL_TIMELINE.textReadyAt);
  }

  private setStatus(
    status: DetailRevealStatus,
    flags: { isVisible: boolean; textReady: boolean },
  ): void {
    this.update(() => ({ status, ...flags }));
  }

  private update(updater: (prev: DetailRevealState) => DetailRevealState): void {
    (this as unknown as { setState: (u: typeof updater) => void }).setState(updater);
  }
}
