// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    div: ({ children, initial, animate, exit, transition, ...rest }: Record<string, unknown> & { children?: ReactNode }) =>
      <div {...rest}>{children}</div>,
  },
  useReducedMotion: () => false,
}));

const signUp = vi.fn().mockResolvedValue(undefined);
const signIn = vi.fn().mockResolvedValue(undefined);
vi.mock('./context/useAuthSession', () => ({
  useAuthSession: () => ({
    session: {
      signUp,
      signIn,
      resetPassword: vi.fn(),
      signInWithGoogle: vi.fn(),
      signInWithApple: vi.fn(),
    },
  }),
}));

import { AuthCard } from './AuthCard';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderLogin() {
  render(
    <MemoryRouter>
      <AuthCard />
    </MemoryRouter>,
  );
}

function renderSignup() {
  renderLogin();
  fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));
}

describe('AuthCard verify-password', () => {
  it('does not show the verify field until the password has text', () => {
    renderSignup();
    expect(screen.queryByLabelText('Verify Password')).not.toBeInTheDocument();
  });

  it('reveals the verify field once the user types a password', () => {
    renderSignup();
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret1' } });
    expect(screen.getByLabelText('Verify Password')).toBeInTheDocument();
  });

  it('shows a mismatch message and disables Create Account when the passwords differ', () => {
    renderSignup();
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret1' } });
    fireEvent.change(screen.getByLabelText('Verify Password'), { target: { value: 'secret2' } });
    expect(screen.getByText(/passwords don.t match/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
  });

  it('enables Create Account on a match and submits with signUp', async () => {
    renderSignup();
    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: 'Sarah' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'sarah@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret1' } });
    fireEvent.change(screen.getByLabelText('Verify Password'), { target: { value: 'secret1' } });
    expect(screen.getByText(/passwords match/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox'));
    const submit = screen.getByRole('button', { name: /create account/i });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith('sarah@example.com', 'secret1', 'Sarah'),
    );
  });

  it('never shows the verify field in login mode', () => {
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret1' } });
    expect(screen.queryByLabelText('Verify Password')).not.toBeInTheDocument();
  });
});
