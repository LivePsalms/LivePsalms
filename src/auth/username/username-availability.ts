import { Observable } from '../../notepad/collection/observable';

export type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export interface UsernameAvailabilityDeps {
  checkAvailable: (name: string) => Promise<boolean>;
  /** Test seam; production omits it and the controller uses real setTimeout. Returns a cancel fn. */
  setTimer?: (fn: () => void, ms: number) => () => void;
}

export interface UsernameAvailabilityInputs {
  name: string; // already-normalized username
  eligible: boolean; // format.valid from username-rules — when false, machine parks at 'idle'
  debounceMs: number;
}

const defaultSetTimer = (fn: () => void, ms: number): (() => void) => {
  const h = setTimeout(fn, ms);
  return () => clearTimeout(h);
};

export class UsernameAvailability extends Observable<AvailabilityStatus> {
  private readonly deps: UsernameAvailabilityDeps;
  private readonly setTimer: (fn: () => void, ms: number) => () => void;
  private generation = 0;
  private cancelTimer: (() => void) | null = null;

  constructor(deps: UsernameAvailabilityDeps) {
    super('idle');
    this.deps = deps;
    this.setTimer = deps.setTimer ?? defaultSetTimer;
  }

  setInputs(inputs: UsernameAvailabilityInputs): void {
    const gen = this.cancelAndBump();
    const { name, eligible, debounceMs } = inputs;

    if (!eligible) {
      // Reset stale availability when the input becomes invalid.
      this.emit(gen, 'idle');
      return;
    }

    this.emit(gen, 'checking');
    this.cancelTimer = this.setTimer(() => {
      this.cancelTimer = null;
      this.deps
        .checkAvailable(name)
        .then((ok) => {
          this.emit(gen, ok ? 'available' : 'taken');
        })
        .catch(() => {
          // Fail open — the submit-time unique constraint is the real guard.
          this.emit(gen, 'error');
        });
    }, debounceMs);
  }

  /** Submit-time reconciliation: force 'taken' so it sticks past any in-flight check. */
  markTaken(): void {
    // Synchronous write after cancelAndBump → no fence needed; bypassing emit is what makes it stick.
    this.cancelAndBump();
    this.setState(() => 'taken');
  }

  /** Bumps the generation + cancels any pending timer so late resolves are dropped. */
  dispose(): void {
    this.cancelAndBump();
  }

  private cancelAndBump(): number {
    if (this.cancelTimer) {
      this.cancelTimer();
      this.cancelTimer = null;
    }
    return ++this.generation;
  }

  private isStale(gen: number): boolean {
    return gen !== this.generation;
  }

  private emit(gen: number, next: AvailabilityStatus): void {
    if (this.isStale(gen)) return;
    this.setState(() => next);
  }
}
