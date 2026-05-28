// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useIsAdmin } from './useIsAdmin';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));
vi.mock('@/auth/context/useAuthSession', () => ({
  useAuthSession: vi.fn(() => ({ user: { id: 'u1' }, loading: false, session: { user: { id: 'u1' } } })),
}));

import { supabase } from '@/lib/supabase';
import { useAuthSession } from '@/auth/context/useAuthSession';

describe('useIsAdmin', () => {
  it('returns null while loading, then true when RPC returns true', async () => {
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: true, error: null });
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current.isAdmin).toBeNull();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
  });

  it('returns false on RPC error', async () => {
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { result } = renderHook(() => useIsAdmin());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });

  it('returns false immediately when unauthenticated', async () => {
    (useAuthSession as ReturnType<typeof vi.fn>).mockReturnValueOnce({ user: null, loading: false, session: null });
    const { result } = renderHook(() => useIsAdmin());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });
});
