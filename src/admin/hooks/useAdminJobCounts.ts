import { useEffect, useState, useCallback } from 'react';
import type { LamplightAdapter, AdminJobCounts } from '@/notepad/storage/lamplight-adapter';

const HOUR_MS = 3600 * 1000;

export interface UseAdminJobCountsArgs {
  adapter: LamplightAdapter;
  windowHours: number;
  autoRefreshMs?: number;
}

export interface UseAdminJobCountsResult {
  counts: AdminJobCounts | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAdminJobCounts({
  adapter,
  windowHours,
  autoRefreshMs = 30_000,
}: UseAdminJobCountsArgs): UseAdminJobCountsResult {
  const [counts, setCounts] = useState<AdminJobCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - windowHours * HOUR_MS).toISOString();
      const next = await adapter.adminJobCounts(since);
      setCounts(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [adapter, windowHours]);

  useEffect(() => {
    fetch();
    if (!autoRefreshMs) return;
    const t = setInterval(fetch, autoRefreshMs);
    return () => clearInterval(t);
  }, [fetch, autoRefreshMs]);

  return { counts, loading, error, refetch: fetch };
}
