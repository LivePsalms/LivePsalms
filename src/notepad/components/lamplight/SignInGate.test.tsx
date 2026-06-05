// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignInGate } from './SignInGate';

afterEach(cleanup);

describe('SignInGate', () => {
  it('renders the waiting line, sign-in + sign-up CTAs, and a Why-sign-in link', () => {
    render(<MemoryRouter><SignInGate /></MemoryRouter>);
    expect(screen.getByText(/today's lamp is waiting for you/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/login');
    expect(screen.getByText(/why sign in\?/i)).toBeInTheDocument();
  });
});
