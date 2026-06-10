// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const resendSignupEmail = vi.fn().mockResolvedValue(undefined);
let mockUser: unknown = null;
vi.mock('./context/useAuthSession', () => ({
  useAuthSession: () => ({ user: mockUser, session: { resendSignupEmail } }),
}));

import { VerifyEmailNotice } from './VerifyEmailNotice';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockUser = null;
});

describe('VerifyEmailNotice', () => {
  it('renders the email', () => {
    render(<VerifyEmailNotice email="sarah@example.com" onBack={() => {}} />);
    expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
  });

  it('resend calls resendSignupEmail then enters cooldown (button disabled, countdown shown)', async () => {
    render(<VerifyEmailNotice email="sarah@example.com" onBack={() => {}} cooldownSeconds={3} />);
    fireEvent.click(screen.getByRole('button', { name: /resend email/i }));
    await waitFor(() => expect(resendSignupEmail).toHaveBeenCalledWith('sarah@example.com'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /resend in/i })).toBeDisabled(),
    );
  });

  it('back calls onBack', () => {
    const onBack = vi.fn();
    render(<VerifyEmailNotice email="sarah@example.com" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('calls onVerified when a user session appears', () => {
    const onVerified = vi.fn();
    mockUser = { id: 'u1' };
    render(<VerifyEmailNotice email="sarah@example.com" onBack={() => {}} onVerified={onVerified} />);
    expect(onVerified).toHaveBeenCalled();
  });
});
