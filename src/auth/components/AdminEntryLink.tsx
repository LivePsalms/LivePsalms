import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useIsAdmin } from '@/admin/hooks/useIsAdmin';

export function AdminEntryLink() {
  const { isAdmin, loading } = useIsAdmin();
  if (loading || !isAdmin) return null;

  return (
    <Link
      to="/admin/lamplight"
      className="flex items-center gap-3 px-5 py-4 rounded-xl transition-colors hover:bg-[color:var(--pale-stone)]"
      style={{ background: 'var(--alabaster)', border: '1px solid var(--pale-stone)' }}
      data-testid="admin-entry-link"
    >
      <div className="flex-1">
        <div
          className="text-sm"
          style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
        >
          Lamplight Ops
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: 'var(--silica)' }}>
          Job queue, usage, retries
        </div>
      </div>
      <ChevronRight size={16} aria-hidden style={{ color: 'var(--silica)' }} />
    </Link>
  );
}
