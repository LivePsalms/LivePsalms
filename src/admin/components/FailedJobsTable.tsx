import { useState } from 'react';
import type { AdminJobRow } from '@/notepad/storage/lamplight-adapter';

export interface FailedJobsTableProps {
  jobs: AdminJobRow[];
  loading: boolean;
  kindFilter: string;
  emailFilter: string;
  sinceDays: number;
  onKindChange: (k: string) => void;
  onEmailChange: (e: string) => void;
  onSinceDaysChange: (d: number) => void;
  onRetryOne: (jobId: string) => Promise<void>;
  onRetryAll: () => Promise<number>;
}

const KIND_OPTIONS = ['', 'embedding_refresh'];
const SINCE_OPTIONS = [
  { label: '24h', value: 1 },
  { label: '7d',  value: 7 },
  { label: '30d', value: 30 },
];

export function FailedJobsTable(props: FailedJobsTableProps) {
  const { jobs, loading, kindFilter, emailFilter, sinceDays,
    onKindChange, onEmailChange, onSinceDaysChange, onRetryOne, onRetryAll } = props;
  const [bulkBusy, setBulkBusy] = useState(false);

  return (
    <div className="rounded-md border" data-testid="failed-jobs-table">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b">
        <label className="text-xs flex items-center gap-1">
          Kind
          <select value={kindFilter} onChange={(e) => onKindChange(e.target.value)} className="border rounded px-2 py-1">
            {KIND_OPTIONS.map(k => <option key={k} value={k}>{k || 'any'}</option>)}
          </select>
        </label>
        <label className="text-xs flex items-center gap-1">
          Email
          <input
            type="text" value={emailFilter}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="user@…"
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="text-xs flex items-center gap-1">
          Since
          <select value={sinceDays} onChange={(e) => onSinceDaysChange(Number(e.target.value))} className="border rounded px-2 py-1">
            {SINCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="ml-auto text-xs border rounded px-3 py-1 disabled:opacity-50"
          disabled={bulkBusy || jobs.length === 0}
          onClick={async () => {
            if (jobs.length > 5 && !confirm(`Re-queue ${jobs.length} failed jobs?`)) return;
            setBulkBusy(true);
            try { await onRetryAll(); } finally { setBulkBusy(false); }
          }}
        >
          Retry all
        </button>
      </div>

      {loading ? (
        <div className="px-4 py-6 text-xs text-gray-500">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="px-4 py-6 text-xs text-gray-500">
          No failed jobs in the selected window — Lamplight is healthy.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">Kind</th>
              <th className="text-left px-3 py-2">User</th>
              <th className="text-left px-3 py-2">×</th>
              <th className="text-left px-3 py-2">Error</th>
              <th className="text-right px-3 py-2">Retry</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id} className="border-t">
                <td className="px-3 py-2">{(j.finishedAt ?? j.scheduledAt).slice(0, 16).replace('T', ' ')}</td>
                <td className="px-3 py-2 font-mono">{j.kind}</td>
                <td className="px-3 py-2">{j.email ?? j.userId.slice(0, 8)}</td>
                <td className="px-3 py-2">{j.attempts}</td>
                <td className="px-3 py-2 truncate max-w-[200px]" title={j.error ?? ''}>{j.error ?? ''}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    aria-label={`retry ${j.id}`}
                    className="border rounded px-2 py-1"
                    onClick={() => onRetryOne(j.id)}
                  >↻</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
