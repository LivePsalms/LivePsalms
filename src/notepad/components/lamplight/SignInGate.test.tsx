// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignInGate } from './SignInGate';

afterEach(cleanup);

function renderGate() {
  render(<MemoryRouter><SignInGate /></MemoryRouter>);
}

describe('SignInGate', () => {
  it('renders the waiting line and sign-in + sign-up CTAs', () => {
    renderGate();
    expect(screen.getByText(/today's lamp is waiting for you/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/login');
  });

  it('exposes "Why sign in?" as a collapsed toggle button by default', () => {
    renderGate();
    const toggle = screen.getByRole('button', { name: /why sign in\?/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/reflective chat/i)).not.toBeInTheDocument();
  });

  it('reveals the benefits when the toggle is clicked', () => {
    renderGate();
    fireEvent.click(screen.getByRole('button', { name: /why sign in\?/i }));
    expect(screen.getByRole('button', { name: /why sign in\?/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/reflective chat/i)).toBeInTheDocument();
    expect(screen.getByText(/connection cards/i)).toBeInTheDocument();
  });

  it('hides the benefits again when the toggle is clicked twice', () => {
    renderGate();
    const toggle = screen.getByRole('button', { name: /why sign in\?/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/reflective chat/i)).not.toBeInTheDocument();
  });

  it('no longer links out to the privacy policy', () => {
    renderGate();
    expect(document.querySelector('a[href*="privacy"]')).toBeNull();
  });
});
