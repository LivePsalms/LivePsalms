import { describe, it, expect, vi } from 'vitest';
import { Observable } from './observable';

class TestObservable extends Observable<{ count: number }> {
  constructor() { super({ count: 0 }); }
  increment() { this.setState((s) => ({ count: s.count + 1 })); }
  noop() { this.setState((s) => s); }
}

describe('Observable', () => {
  it('returns initial snapshot', () => {
    const obs = new TestObservable();
    expect(obs.getSnapshot()).toEqual({ count: 0 });
  });

  it('notifies subscribers on state change', () => {
    const obs = new TestObservable();
    const listener = vi.fn();
    obs.subscribe(listener);
    obs.increment();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(obs.getSnapshot()).toEqual({ count: 1 });
  });

  it('returns stable snapshot reference when unchanged', () => {
    const obs = new TestObservable();
    const before = obs.getSnapshot();
    obs.noop();
    const after = obs.getSnapshot();
    expect(after).toBe(before);
  });

  it('does not notify when setState returns the same reference', () => {
    const obs = new TestObservable();
    const listener = vi.fn();
    obs.subscribe(listener);
    obs.noop();
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribe stops further notifications', () => {
    const obs = new TestObservable();
    const listener = vi.fn();
    const unsubscribe = obs.subscribe(listener);
    obs.increment();
    unsubscribe();
    obs.increment();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('supports multiple independent subscribers', () => {
    const obs = new TestObservable();
    const a = vi.fn();
    const b = vi.fn();
    obs.subscribe(a);
    obs.subscribe(b);
    obs.increment();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
