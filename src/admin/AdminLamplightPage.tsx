import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useIsAdmin } from './hooks/useIsAdmin';
import { useAdminJobCounts } from './hooks/useAdminJobCounts';
import { useAdminFailedJobs } from './hooks/useAdminFailedJobs';
import { useAdminUsageTop } from './hooks/useAdminUsageTop';
import { JobCountsStrip } from './components/JobCountsStrip';
import { FailedJobsTable } from './components/FailedJobsTable';
import { UsageLeaderboard } from './components/UsageLeaderboard';
import { SupabaseLamplightAdapter } from '@/notepad/storage/supabase-lamplight-adapter';
import type { LamplightAdapter } from '@/notepad/storage/lamplight-adapter';
import { supabase as supabaseClient } from '@/lib/supabase';

// No-op shim used when supabase client is unavailable (non-Supabase envs / tests
// that don't mock the adapter). Ensures hooks can be called unconditionally.
const noopAdapter: LamplightAdapter = {
  adminJobCounts: async () => ({ queued: 0, running: 0, done: 0, failed: 0, since: '' }),
  adminListJobs: async () => [],
  adminUsageTop: async () => [],
  adminRequeueJob: async () => { throw new Error('no adapter'); },
  adminRequeueAllFailed: async () => 0,
} as unknown as LamplightAdapter;

export function AdminLamplightPage() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const adapter = useMemo<LamplightAdapter>(
    () => (supabaseClient ? new SupabaseLamplightAdapter(supabaseClient) : noopAdapter),
    [],
  );

  const [windowHours, setWindowHours] = useState(24);
  const [kindFilter, setKindFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [sinceDays, setSinceDays] = useState(7);
  const [usageWindowDays, setUsageWindowDays] = useState(7);

  const sinceIso = useMemo(
    // eslint-disable-next-line react-hooks/purity
    () => new Date(Date.now() - sinceDays * 24 * 3600 * 1000).toISOString(),
    [sinceDays],
  );

  // Hooks must be called unconditionally per React rules-of-hooks.
  // When no real adapter is available, noopAdapter is used above.
  const counts = useAdminJobCounts({
    adapter,
    windowHours,
  });
  const failed = useAdminFailedJobs({
    adapter,
    filters: {
      status: ['failed'],
      kind: kindFilter ? [kindFilter] : undefined,
      userSearch: emailFilter || undefined,
      since: sinceIso,
    },
  });
  const usage = useAdminUsageTop({
    adapter,
    windowDays: usageWindowDays,
  });

  if (adminLoading) {
    return <div className="p-6 text-xs" style={{ color: 'var(--deep-umber)' }}>Loading…</div>;
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  if (!supabaseClient) {
    return <div className="p-6 text-xs text-red-600">Supabase client unavailable.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Lamplight Ops</h1>
      </header>

      <JobCountsStrip
        counts={counts.counts}
        loading={counts.loading}
        windowHours={windowHours}
        onWindowChange={setWindowHours}
      />

      <FailedJobsTable
        jobs={failed.jobs}
        loading={failed.loading}
        kindFilter={kindFilter}
        emailFilter={emailFilter}
        sinceDays={sinceDays}
        onKindChange={setKindFilter}
        onEmailChange={setEmailFilter}
        onSinceDaysChange={setSinceDays}
        onRetryOne={async (jobId) => {
          await adapter.adminRequeueJob(jobId);
          if (supabaseClient) {
            supabaseClient.functions.invoke('embed-note', { body: { job_id: jobId } }).catch(() => {});
          }
          toast.success('Job re-queued');
          await failed.refetch();
          await counts.refetch();
        }}
        onRetryAll={async () => {
          const n = await adapter.adminRequeueAllFailed(kindFilter || undefined);
          toast.success(`Re-queued ${n} failed job${n === 1 ? '' : 's'}`);
          await failed.refetch();
          await counts.refetch();
          return n;
        }}
      />

      <UsageLeaderboard
        rows={usage.rows}
        loading={usage.loading}
        windowDays={usageWindowDays}
        onWindowChange={setUsageWindowDays}
      />
    </div>
  );
}
