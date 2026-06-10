// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const resendSignupEmail = vi.fn().mockResolvedValue(undefined);
let mockUser: unknown = null;
vi.mock('./context/useAuthSession', () => ({
  useAuthSession: () => ({ user: mockUser, session: { resendSignupEmail } }),
}));

import { VerifyEmailPage } from './VerifyEmailPage';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
  mockUser = null;
});

describe('VerifyEmailPage', () => {
  it('renders the stashed email', () => {
    sessionStorage.setItem('lp.verifyEmail', 'sarah@example.com');
    render(<VerifyEmailPage />);
    expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
  });

  it('navigates to /login when there is no stashed email', () => {
    render(<VerifyEmailPage />);
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('resend calls resendSignupEmail then enters cooldown (button disabled, countdown shown)', async () => {
    sessionStorage.setItem('lp.verifyEmail', 'sarah@example.com');
    render(<VerifyEmailPage cooldownSeconds={3} />);
    fireEvent.click(screen.getByRole('button', { name: /resend email/i }));
    await waitFor(() => expect(resendSignupEmail).toHaveBeenCalledWith('sarah@example.com'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /resend in/i })).toBeDisabled(),
    );
  });

  it('back to sign in navigates to /login', () => {
    sessionStorage.setItem('lp.verifyEmail', 'sarah@example.com');
    render(<VerifyEmailPage />);
    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('auto-advances to the notepad when a user session appears', () => {
    sessionStorage.setItem('lp.verifyEmail', 'sarah@example.com');
    mockUser = { id: 'u1' };
    render(<VerifyEmailPage />);
    expect(navigate).toHaveBeenCalledWith('/notepad/notes', { replace: true });
  });
});
