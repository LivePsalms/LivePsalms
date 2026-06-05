import { useCallback } from 'react';
import type { LamplightAdapter, AdminJobCounts } from '@/notepad/storage/lamplight-adapter';
import { useAsyncResource } from './useAsyncResource';

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
  const fetcher = useCallback(
    () => adapter.adminJobCounts(new Date(Date.now() - windowHours * HOUR_MS).toISOString()),
    [adapter, windowHours],
  );
  const { data, loading, error, refetch } = useAsyncResource<AdminJobCounts | null>(fetcher, null, { autoRefreshMs });
  return { counts: data, loading, error, refetch };
}
