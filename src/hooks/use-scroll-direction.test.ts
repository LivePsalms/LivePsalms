// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useScrollDirection } from './use-scroll-direction';

function setScroll(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
  window.dispatchEvent(new Event('scroll'));
}

// rAF in jsdom fires asynchronously. Flush it manually.
function flushRaf() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

afterEach(() => {
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
});

describe('useScrollDirection', () => {
  it('returns "idle" on initial mount', () => {
    const { result } = renderHook(() => useScrollDirection());
    expect(result.current).toBe('idle');
  });

  it('returns "down" after a downward scroll past threshold', async () => {
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true, writable: true });
    const { result } = renderHook(() => useScrollDirection());
    await act(async () => {
      setScroll(400);
      await flushRaf();
    });
    expect(result.current).toBe('down');
  });

  it('returns "up" after an upward scroll past threshold', async () => {
    Object.defineProperty(window, 'scrollY', { value: 400, configurable: true, writable: true });
    const { result } = renderHook(() => useScrollDirection());
    await act(async () => {
      setScroll(200);
      await flushRaf();
    });
    expect(result.current).toBe('up');
  });

  it('ignores deltas smaller than the threshold', async () => {
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true, writable: true });
    const { result } = renderHook(() => useScrollDirection(20));
    await act(async () => {
      setScroll(310); // delta 10, below threshold 20
      await flushRaf();
    });
    expect(result.current).toBe('idle');
  });

  it('forces "idle" when scrollY < 80, regardless of prior direction', async () => {
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true, writable: true });
    const { result } = renderHook(() => useScrollDirection());
    await act(async () => {
      setScroll(400);
      await flushRaf();
    });
    expect(result.current).toBe('down');
    await act(async () => {
      setScroll(20);
      await flushRaf();
    });
    expect(result.current).toBe('idle');
  });

  it('removes the scroll listener on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useScrollDirection());
    unmount();
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    remove.mockRestore();
  });
});
