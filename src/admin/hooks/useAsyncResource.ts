import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAsyncResourceOptions {
  autoRefreshMs?: number;
}

export interface UseAsyncResourceResult<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  initial: T,
  options: UseAsyncResourceOptions = {},
): UseAsyncResourceResult<T> {
  const { autoRefreshMs } = options;
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const genRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refetch = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    try {
      const next = await fetcher();
      if (gen !== genRef.current || !mountedRef.current) return; // stale/unmounted: ignore
      setData(next);
      setError(null);
    } catch (e) {
      if (gen !== genRef.current || !mountedRef.current) return;
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (gen === genRef.current && mountedRef.current) setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    refetch();
    if (!autoRefreshMs) return;
    const t = setInterval(refetch, autoRefreshMs);
    return () => clearInterval(t);
  }, [refetch, autoRefreshMs]);

  return { data, loading, error, refetch };
}
