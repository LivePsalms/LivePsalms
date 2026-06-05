import { useEffect, useState, useCallback } from 'react';
import type { LamplightAdapter, AdminJobRow } from '@/notepad/storage/lamplight-adapter';

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
  const [jobs, setJobs] = useState<AdminJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000).toISOString();
      const next = await adapter.adminListJobs({
        status: ['failed'],
        kind: kind ? [kind] : undefined,
        userSearch: userSearch || undefined,
        since,
      });
      setJobs(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [adapter, sinceDays, kind, userSearch]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { jobs, loading, error, refetch: fetch };
}
