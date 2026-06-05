import { useCallback } from 'react';
import type { LamplightAdapter, AdminUsageRow } from '@/notepad/storage/lamplight-adapter';
import { useAsyncResource } from './useAsyncResource';

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
  const fetcher = useCallback(
    () => adapter.adminUsageTop(windowDays, limit),
    [adapter, windowDays, limit],
  );
  const { data, loading, error, refetch } = useAsyncResource<AdminUsageRow[]>(fetcher, []);
  return { rows: data, loading, error, refetch };
}
