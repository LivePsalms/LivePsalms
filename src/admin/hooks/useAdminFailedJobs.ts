import { useCallback } from 'react';
import type { LamplightAdapter, AdminJobRow } from '@/notepad/storage/lamplight-adapter';
import { useAsyncResource } from './useAsyncResource';

export interface UseAdminFailedJobsArgs {
  adapter: LamplightAdapter;
  sinceDays: number;
  kind?: string;
  userSearch?: string;
}

export interface UseAdminFailedJobsResult {
  jobs: AdminJobRow[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAdminFailedJobs({
  adapter,
  sinceDays,
  kind,
  userSearch,
}: UseAdminFailedJobsArgs): UseAdminFailedJobsResult {
  const fetcher = useCallback(
    () => adapter.adminListJobs({
      status: ['failed'],
      kind: kind ? [kind] : undefined,
      userSearch: userSearch || undefined,
      since: new Date(Date.now() - sinceDays * 24 * 3600 * 1000).toISOString(),
    }),
    [adapter, sinceDays, kind, userSearch],
  );
  const { data, loading, error, refetch } = useAsyncResource<AdminJobRow[]>(fetcher, []);
  return { jobs: data, loading, error, refetch };
}
