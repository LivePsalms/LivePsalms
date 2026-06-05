// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/auth/context/useAuthSession', () => ({
  useAuthSession: vi.fn(() => ({ user: { id: 'u1' }, loading: false, session: { user: { id: 'u1' } } })),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from '@/lib/supabase';
import { AdminLamplightPage } from './AdminLamplightPage';

type MockRpc = { rpc: ReturnType<typeof vi.fn> };

beforeEach(() => {
  (supabase as unknown as MockRpc).rpc.mockReset();
});

describe('AdminLamplightPage', () => {
  it('redirects when useIsAdmin resolves false', async () => {
    (supabase as unknown as MockRpc).rpc.mockResolvedValue({ data: false, error: null });
    render(<MemoryRouter><AdminLamplightPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.queryByText(/Lamplight Ops/i)).not.toBeInTheDocument();
    });
  });

  it('renders all three panels when admin', async () => {
    (supabase as unknown as MockRpc).rpc.mockImplementation(async (fn: string) => {
      if (fn === 'is_lamplight_admin') return { data: true, error: null };
      if (fn === 'admin_lamplight_job_counts') return { data: { queued: 1, running: 0, done: 5, failed: 2, since: '' }, error: null };
      if (fn === 'admin_list_lamplight_jobs') return { data: [], error: null };
      if (fn === 'admin_lamplight_usage_top') return { data: [], error: null };
      return { data: null, error: null };
    });
    render(<MemoryRouter><AdminLamplightPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/Lamplight Ops/i)).toBeInTheDocument();
      expect(screen.getByTestId('job-counts-strip')).toBeInTheDocument();
      expect(screen.getByTestId('failed-jobs-table')).toBeInTheDocument();
      expect(screen.getByTestId('usage-leaderboard')).toBeInTheDocument();
    });
  });
});
