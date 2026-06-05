import type { AdminJobCounts } from '@/notepad/storage/lamplight-adapter';

export interface JobCountsStripProps {
  counts: AdminJobCounts | null;
  loading: boolean;
  windowHours: number;
  onWindowChange: (hours: number) => void;
}

const WINDOW_OPTIONS = [
  { label: 'Last 1h',  value: 1 },
  { label: 'Last 24h', value: 24 },
  { label: 'Last 7d',  value: 24 * 7 },
  { label: 'Last 30d', value: 24 * 30 },
];

export function JobCountsStrip({ counts, loading, windowHours, onWindowChange }: JobCountsStripProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-md border" data-testid="job-counts-strip">
      <CountCell label="Queued"  value={counts?.queued}  loading={loading} />
      <CountCell label="Running" value={counts?.running} loading={loading} />
      <CountCell label="Done"    value={counts?.done}    loading={loading} />
      <CountCell label="Failed"  value={counts?.failed}  loading={loading} />
      <div className="ml-auto">
        <select
          aria-label="Window"
          value={windowHours}
          onChange={(e) => onWindowChange(Number(e.target.value))}
          className="text-xs border rounded px-2 py-1"
        >
          {WINDOW_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function CountCell({ label, value, loading }: { label: string; value: number | undefined; loading: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--deep-umber)' }}>{label}</span>
      <span className="text-lg font-medium">
        {loading ? '…' : (value ?? 0)}
      </span>
    </div>
  );
}
