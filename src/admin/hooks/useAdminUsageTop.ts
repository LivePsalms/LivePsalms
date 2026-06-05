import { useEffect, useState, useCallback } from 'react';
import type { LamplightAdapter, AdminUsageRow } from '@/notepad/storage/lamplight-adapter';

export interface UseAdminUsageTopArgs {
  adapter: LamplightAdapter;
  windowDays: number;
  limit?: number;
}

export interface UseAdminUsageTopResult {
  rows: AdminUsageRow[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAdminUsageTop({
  adapter,
  windowDays,
  limit = 50,
}: UseAdminUsageTopArgs): UseAdminUsageTopResult {
  const [rows, setRows] = useState<AdminUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const next = await adapter.adminUsageTop(windowDays, limit);
      setRows(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [adapter, windowDays, limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { rows, loading, error, refetch: fetch };
}
