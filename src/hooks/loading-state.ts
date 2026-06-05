type TimerId = ReturnType<typeof setTimeout>;
type SetTimeoutFn = (handler: () => void, ms: number) => TimerId;
type ClearTimeoutFn = (id: TimerId) => void;

export interface LoadingStateMachine {
  /** Current active state. Read-only — mutate via trigger() or cleanup(). */
  readonly active: boolean;
  /** Set active=true and schedule auto-deactivate after minMs. Resets timer if already active. */
  trigger: () => void;
  /** Cancel any pending deactivate timer. Does not change active. */
  cleanup: () => void;
}

export interface CreateLoadingStateOptions {
  minMs: number;
  initialActive: boolean;
  onChange: (active: boolean) => void;
  setTimeoutFn?: SetTimeoutFn;
  clearTimeoutFn?: ClearTimeoutFn;
}

export function createLoadingState(opts: CreateLoadingStateOptions): LoadingStateMachine {
  const setTimeoutImpl = opts.setTimeoutFn ?? (setTimeout as unknown as SetTimeoutFn);
  const clearTimeoutImpl = opts.clearTimeoutFn ?? (clearTimeout as unknown as ClearTimeoutFn);

  let active = opts.initialActive;
  let timer: TimerId | null = null;

  const scheduleDeactivate = () => {
    if (timer !== null) clearTimeoutImpl(timer);
    timer = setTimeoutImpl(() => {
      active = false;
      timer = null;
      opts.onChange(false);
    }, opts.minMs);
  };

  if (opts.initialActive) {
    scheduleDeactivate();
  }

  return {
    get active() {
      return active;
    },
    trigger: () => {
      const wasInactive = !active;
      active = true;
      if (wasInactive) opts.onChange(true);
      scheduleDeactivate();
    },
    cleanup: () => {
      if (timer !== null) {
        clearTimeoutImpl(timer);
        timer = null;
      }
    },
  };
}
