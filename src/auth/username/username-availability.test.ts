import { describe, it, expect } from 'vitest';
import { UsernameAvailability } from './username-availability';
import type { UsernameAvailabilityDeps, UsernameAvailabilityInputs } from './username-availability';

// A macrotask boundary; the microtask queue (all chained awaits) drains first.
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/** Records the scheduled debounce callback so the test fires it deterministically. */
function fakeTimer() {
  let pending: (() => void) | null = null;
  let cancelled = 0;
  const setTimer = (fn: () => void, _ms: number) => {
    pending = fn;
    return () => {
      pending = null;
      cancelled++;
    };
  };
  return {
    setTimer,
    fire: () => {
      const p = pending;
      pending = null;
      p?.();
    },
    get pending() {
      return pending;
    },
    get cancelled() {
      return cancelled;
    },
  };
}

const INPUTS: UsernameAvailabilityInputs = { name: 'natalie', eligible: true, debounceMs: 300 };

function deps(over: Partial<UsernameAvailabilityDeps>, timer: ReturnType<typeof fakeTimer>): UsernameAvailabilityDeps {
  return {
    checkAvailable: async () => true,
    setTimer: timer.setTimer,
    ...over,
  };
}

describe('UsernameAvailability', () => {
  it('parks at idle for an ineligible input without checking or scheduling', () => {
    const timer = fakeTimer();
    let calls = 0;
    const c = new UsernameAvailability(deps({ checkAvailable: async () => { calls++; return true; } }, timer));
    c.setInputs({ name: 'nat', eligible: false, debounceMs: 300 });
    expect(c.getSnapshot()).toBe('idle');
    expect(calls).toBe(0);
    expect(timer.pending).toBeNull();
  });

  it('emits checking synchronously and defers the check until the timer fires', () => {
    const timer = fakeTimer();
    let calls = 0;
    const c = new UsernameAvailability(deps({ checkAvailable: async () => { calls++; return true; } }, timer));
    c.setInputs(INPUTS);
    expect(c.getSnapshot()).toBe('checking');
    expect(calls).toBe(0);
    expect(timer.pending).not.toBeNull();
  });

  it('resolves to available when the check returns true', async () => {
    const timer = fakeTimer();
    const c = new UsernameAvailability(deps({ checkAvailable: async () => true }, timer));
    c.setInputs(INPUTS);
    timer.fire();
    await tick();
    expect(c.getSnapshot()).toBe('available');
  });

  it('resolves to taken when the check returns false', async () => {
    const timer = fakeTimer();
    const c = new UsernameAvailability(deps({ checkAvailable: async () => false }, timer));
    c.setInputs(INPUTS);
    timer.fire();
    await tick();
    expect(c.getSnapshot()).toBe('taken');
  });

  it('cancels the prior timer when setInputs is called again before firing', async () => {
    const timer = fakeTimer();
    const names: string[] = [];
    const c = new UsernameAvailability(deps({ checkAvailable: async (n) => { names.push(n); return true; } }, timer));
    c.setInputs({ name: 'nat', eligible: true, debounceMs: 300 });
    c.setInputs({ name: 'nata', eligible: true, debounceMs: 300 });
    expect(timer.cancelled).toBe(1); // first timer's cancel ran
    timer.fire();
    await tick();
    expect(names).toEqual(['nata']);
  });

  it('drops a stale late response from a superseded input', async () => {
    const timer = fakeTimer();
    let resolveFirst!: (v: boolean) => void;
    let call = 0;
    const c = new UsernameAvailability(
      deps(
        {
          checkAvailable: (_n) => {
            call++;
            if (call === 1) return new Promise<boolean>((res) => { resolveFirst = res; });
            return Promise.resolve(false);
          },
        },
        timer,
      ),
    );
    c.setInputs({ name: 'nat', eligible: true, debounceMs: 300 });
    timer.fire(); // gen-1 check started, blocks on resolveFirst
    c.setInputs({ name: 'nata', eligible: true, debounceMs: 300 }); // gen-2, reschedules
    timer.fire(); // gen-2 check resolves to taken
    await tick();
    resolveFirst(true); // late gen-1 resolve
    await tick();
    expect(c.getSnapshot()).toBe('taken'); // gen-1 'available' was dropped
  });

  it('maps a rejected check to error (fail-open)', async () => {
    const timer = fakeTimer();
    const c = new UsernameAvailability(deps({ checkAvailable: async () => { throw new Error('boom'); } }, timer));
    c.setInputs(INPUTS);
    timer.fire();
    await tick();
    expect(c.getSnapshot()).toBe('error');
  });

  it('markTaken forces taken and an in-flight check cannot flip it back', async () => {
    const timer = fakeTimer();
    let resolveCheck!: (v: boolean) => void;
    const c = new UsernameAvailability(
      deps({ checkAvailable: () => new Promise<boolean>((res) => { resolveCheck = res; }) }, timer),
    );
    c.setInputs(INPUTS);
    timer.fire(); // check started, blocks
    c.markTaken();
    expect(c.getSnapshot()).toBe('taken');
    resolveCheck(true); // superseded check resolves available
    await tick();
    expect(c.getSnapshot()).toBe('taken');
  });

  it('markTaken cancels a pending (not-yet-fired) timer', () => {
    const timer = fakeTimer();
    const c = new UsernameAvailability(deps({}, timer));
    c.setInputs(INPUTS);
    expect(timer.pending).not.toBeNull();
    c.markTaken();
    expect(timer.cancelled).toBe(1);
    expect(timer.pending).toBeNull();
  });

  it('dispose cancels the pending timer and drops a late resolve', async () => {
    const timer = fakeTimer();
    let resolveCheck!: (v: boolean) => void;
    const c = new UsernameAvailability(
      deps({ checkAvailable: () => new Promise<boolean>((res) => { resolveCheck = res; }) }, timer),
    );
    c.setInputs(INPUTS);
    timer.fire(); // check started, blocks
    c.dispose();
    resolveCheck(true);
    await tick();
    expect(c.getSnapshot()).toBe('checking'); // late resolve dropped, state never advanced
  });

  it('dispose cancels a not-yet-fired timer', () => {
    const timer = fakeTimer();
    const c = new UsernameAvailability(deps({}, timer));
    c.setInputs(INPUTS);
    c.dispose();
    expect(timer.cancelled).toBe(1);
    expect(timer.pending).toBeNull();
  });
});
