// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

const updatePassword = vi.fn().mockResolvedValue(undefined);
vi.mock('./context/useAuthSession', () => ({
  useAuthSession: () => ({ session: { updatePassword } }),
}));

import { UpdatePasswordPage } from './UpdatePasswordPage';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('UpdatePasswordPage', () => {
  it('disables Update for a weak password', () => {
    render(<UpdatePasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('New Password'), { target: { value: 'weak' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm New Password'), { target: { value: 'weak' } });
    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled();
  });

  it('updates with a compliant matching password', async () => {
    render(<UpdatePasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('New Password'), { target: { value: 'Secret1!' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm New Password'), { target: { value: 'Secret1!' } });
    const btn = screen.getByRole('button', { name: /update password/i });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith('Secret1!'));
  });
});
