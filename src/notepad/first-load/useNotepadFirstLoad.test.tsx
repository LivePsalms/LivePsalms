// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

const useAuthSession = vi.fn();
const useAccountProfile = vi.fn();
const navigate = vi.fn();
const getNotes = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('@/auth/context/useAuthSession', () => ({ useAuthSession: () => useAuthSession() }));
vi.mock('@/auth/context/useAccountProfile', () => ({ useAccountProfile: () => useAccountProfile() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('@/notepad/storage/local-storage', () => ({ localAdapter: { getNotes: () => getNotes() } }));
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import { useNotepadFirstLoad } from './useNotepadFirstLoad';

beforeEach(() => {
  localStorage.clear();
  useAuthSession.mockReturnValue({
    user: { id: 'u1', email: 'ada@ex.com', user_metadata: { full_name: 'Ada Lovelace' } },
    loading: false,
  });
  useAccountProfile.mockReturnValue({ profile: { fullName: 'Ada Lovelace' }, profileStatus: 'ready' });
  getNotes.mockResolvedValue([]);
  navigate.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});
afterEach(cleanup);

describe('useNotepadFirstLoad — one-time welcome', () => {
  it('fires "Welcome, {name}" exactly once on first load and persists the flag', async () => {
    renderHook(() => useNotepadFirstLoad());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(toastSuccess).toHaveBeenCalledWith('Welcome, Ada!');
    expect(localStorage.getItem('welcomed_once_u1')).not.toBeNull();
  });

  it('never says "Welcome back"', async () => {
    renderHook(() => useNotepadFirstLoad());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(String(toastSuccess.mock.calls[0][0])).not.toMatch(/welcome back/i);
  });

  it('does not greet again on a fresh mount once the welcomed-once flag is set', async () => {
    const first = renderHook(() => useNotepadFirstLoad());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    first.unmount();
    toastSuccess.mockClear();

    // Second mount: the flag is already in localStorage from the first mount.
    renderHook(() => useNotepadFirstLoad());
    // Let the async first-load effect settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('does not greet a brand-new (not-yet-welcomed) user — it redirects them instead', async () => {
    useAccountProfile.mockReturnValue({ profile: { fullName: '' }, profileStatus: 'ready' });
    renderHook(() => useNotepadFirstLoad());
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/welcome'));
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
