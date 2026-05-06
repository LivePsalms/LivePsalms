export class Observable<T> {
  private snapshot: T;
  private listeners = new Set<() => void>();

  constructor(initial: T) {
    this.snapshot = initial;
  }

  getSnapshot = (): T => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  protected setState(updater: (prev: T) => T): void {
    const next = updater(this.snapshot);
    if (next === this.snapshot) return;
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
}
