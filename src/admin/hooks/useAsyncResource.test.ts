// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAsyncResource } from './useAsyncResource';

// A deferred promise we can resolve/reject on demand.
interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Flush pending microtasks (the async fetch + state updates).
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useAsyncResource', () => {
  it('initial fetch populates data and flips loading true→false; error stays null', async () => {
    const fetcher = vi.fn(async () => 'hello');
    const { result } = renderHook(() => useAsyncResource(fetcher, ''));

    // Synchronously, loading starts true.
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe('');

    await flush();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe('hello');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('error path: fetcher rejects → error set, data stays initial, loading false', async () => {
    const boom = new Error('boom');
    const fetcher = vi.fn(async () => {
      throw boom;
    });
    const { result } = renderHook(() => useAsyncResource(fetcher, 'init'));

    await flush();

    expect(result.current.error).toBe(boom);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBe('init');
    expect(result.current.loading).toBe(false);
  });

  it('refetch re-invokes the fetcher and updates data', async () => {
    let n = 0;
    const fetcher = vi.fn(async () => `v${++n}`);
    const { result } = renderHook(() => useAsyncResource(fetcher, ''));

    await flush();
    expect(result.current.data).toBe('v1');

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe('v2');
    expect(result.current.error).toBeNull();
  });

  it('RACE GUARD: a late first response does not clobber a newer one', async () => {
    // Queue of deferreds handed out in call order.
    const deferreds: Deferred<string>[] = [];
    const fetcher = vi.fn(() => {
      const d = defer<string>();
      deferreds.push(d);
      return d.promise;
    });

    const { result } = renderHook(() => useAsyncResource(fetcher, ''));

    // First fetch (from the mount effect) is now in flight — deferreds[0].
    expect(deferreds.length).toBe(1);

    // Start a second fetch via refetch — deferreds[1]. Do NOT await; it stays pending.
    let secondRefetch!: Promise<void>;
    act(() => {
      secondRefetch = result.current.refetch();
    });
    expect(deferreds.length).toBe(2);

    // Resolve the SECOND fetch first.
    await act(async () => {
      deferreds[1].resolve('result2');
      await secondRefetch;
    });
    expect(result.current.data).toBe('result2');

    // Now resolve the FIRST (older) fetch — it must be ignored by the generation guard.
    await act(async () => {
      deferreds[0].resolve('result1');
      await deferreds[0].promise;
      await Promise.resolve();
    });

    expect(result.current.data).toBe('result2');
    expect(result.current.loading).toBe(false);
  });

  it('UNMOUNT GUARD: resolving an in-flight fetch after unmount is a safe no-op', async () => {
    // The mount fetch stays pending until we resolve this deferred.
    const d = defer<string>();
    const fetcher = vi.fn(() => d.promise);

    const { unmount } = renderHook(() => useAsyncResource(fetcher, ''));

    // The mount effect kicked off a fetch that is now in flight.
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Watch for React's "state update on an unmounted component" warning.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // Unmount while the fetch is still pending; mountedRef flips to false.
      unmount();

      // Resolve the now-stale fetch — the mountedRef guard must short-circuit.
      await act(async () => {
        d.resolve('late');
        await d.promise;
        await Promise.resolve();
      });

      // No throw (reaching here proves that) and no React warning logged.
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('autoRefreshMs triggers an additional fetch after the interval', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn(async () => 'tick');
      renderHook(() => useAsyncResource(fetcher, '', { autoRefreshMs: 1000 }));

      await flush();
      expect(fetcher).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
