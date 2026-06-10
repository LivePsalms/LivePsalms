// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke } } }));

// Keep the button's accessible name simple ("Submit") and avoid pulling in
// the animation internals of the real component.
vi.mock('@/components/ui/text-stagger-hover', () => ({
  TextStaggerHover: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TextStaggerHoverActive: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TextStaggerHoverHidden: () => null,
}));

import { Contact } from './Contact';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function fillForm() {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Sarah Lee' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sarah@example.com' } });
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'A prayer request' } });
}

describe('Contact', () => {
  it('on success invokes the function and shows a first-name thank-you, hiding the form', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    render(<Contact />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('contact-message', {
        body: { name: 'Sarah Lee', email: 'sarah@example.com', subject: 'A prayer request' },
      }),
    );
    expect(await screen.findByText(/thank you, sarah/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('on error keeps the form populated and shows an error message', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    render(<Contact />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Sarah Lee');
  });

  it('on a thrown network error also keeps the form and shows the error message', async () => {
    invoke.mockRejectedValueOnce(new Error('network'));
    render(<Contact />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('disables the submit button while submitting', async () => {
    let resolveInvoke: (v: unknown) => void = () => {};
    invoke.mockReturnValueOnce(new Promise((r) => { resolveInvoke = r; }));
    render(<Contact />);
    fillForm();
    const btn = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(btn);

    await waitFor(() => expect(btn).toBeDisabled());
    resolveInvoke({ data: { ok: true }, error: null });
    await screen.findByText(/thank you, sarah/i);
  });
});
