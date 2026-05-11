import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLoadingState } from './loading-state';

describe('createLoadingState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initial active matches initialActive=false', () => {
    const onChange = vi.fn();
    const state = createLoadingState({ minMs: 1500, initialActive: false, onChange });
    expect(state.active).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    state.cleanup();
  });

  it('initial active matches initialActive=true and schedules deactivate', () => {
    const onChange = vi.fn();
    const state = createLoadingState({ minMs: 1500, initialActive: true, onChange });
    expect(state.active).toBe(true);
    vi.advanceTimersByTime(1499);
    expect(state.active).toBe(true);
    vi.advanceTimersByTime(1);
    expect(state.active).toBe(false);
    expect(onChange).toHaveBeenCalledWith(false);
    state.cleanup();
  });

  it('trigger() sets active=true and schedules deactivate', () => {
    const onChange = vi.fn();
    const state = createLoadingState({ minMs: 1500, initialActive: false, onChange });
    state.trigger();
    expect(state.active).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);
    vi.advanceTimersByTime(1500);
    expect(state.active).toBe(false);
    state.cleanup();
  });

  it('re-trigger before deactivate extends the timer', () => {
    const onChange = vi.fn();
    const state = createLoadingState({ minMs: 1500, initialActive: false, onChange });
    state.trigger();
    vi.advanceTimersByTime(1000);
    expect(state.active).toBe(true);
    state.trigger();
    vi.advanceTimersByTime(1000);
    expect(state.active).toBe(true);
    vi.advanceTimersByTime(500);
    expect(state.active).toBe(false);
    state.cleanup();
  });

  it('cleanup() cancels the pending deactivate timer', () => {
    const onChange = vi.fn();
    const state = createLoadingState({ minMs: 1500, initialActive: true, onChange });
    state.cleanup();
    onChange.mockClear();
    vi.advanceTimersByTime(2000);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses injected setTimeout/clearTimeout when provided', () => {
    const onChange = vi.fn();
    const setTimeoutSpy = vi.fn().mockReturnValue(42 as unknown as number);
    const clearTimeoutSpy = vi.fn();
    const state = createLoadingState({
      minMs: 1500,
      initialActive: true,
      onChange,
      setTimeoutFn: setTimeoutSpy,
      clearTimeoutFn: clearTimeoutSpy,
    });
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1500);
    state.cleanup();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(42);
  });
});
