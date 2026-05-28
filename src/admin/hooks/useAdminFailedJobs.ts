import { useEffect, useState, useCallback } from 'react';
import type { LamplightAdapter, AdminJobRow, AdminJobFilters } from '@/notepad/storage/lamplight-adapter';

export interface UseAdminFailedJobsArgs {
  adapter: LamplightAdapter;
  filters: AdminJobFilters;
}

export interface UseAdminFailedJobsResult {
  jobs: AdminJobRow[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAdminFailedJobs({
  adapter,
  filters,
}: UseAdminFailedJobsArgs): UseAdminFailedJobsResult {
  const [jobs, setJobs] = useState<AdminJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const filtersKey = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const next = await adapter.adminListJobs({ status: ['failed'], ...filters });
      setJobs(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [adapter, filtersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { jobs, loading, error, refetch: fetch };
}
