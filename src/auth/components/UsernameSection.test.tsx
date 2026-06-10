// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { UsernameSection } from './UsernameSection';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from 'sonner';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderSection(
  overrides: Partial<React.ComponentProps<typeof UsernameSection>> = {},
) {
  const checkAvailable = overrides.checkAvailable ?? vi.fn().mockResolvedValue(true);
  const setUsername = overrides.setUsername ?? vi.fn().mockResolvedValue({ ok: true });
  render(
    <UsernameSection
      currentUsername="sarah"
      checkAvailable={checkAvailable}
      setUsername={setUsername}
      sectionStyle={{}}
      labelStyle={{}}
      inputStyle={{}}
      debounceMs={0}
      {...overrides}
    />,
  );
  return { checkAvailable, setUsername };
}

describe('UsernameSection', () => {
  it('pre-fills the current username and disables Save when unchanged', () => {
    const { checkAvailable } = renderSection();
    expect(screen.getByLabelText('Username')).toHaveValue('sarah');
    expect(screen.getByText(/your current username/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save username/i })).toBeDisabled();
    expect(checkAvailable).not.toHaveBeenCalled();
  });

  it('shows Available and enables Save for a free changed name; Save calls setUsername + toasts', async () => {
    const { checkAvailable, setUsername } = renderSection({
      checkAvailable: vi.fn().mockResolvedValue(true),
    });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'natalie' } });
    await waitFor(() => expect(checkAvailable).toHaveBeenCalledWith('natalie'));
    expect(await screen.findByText(/available/i)).toBeInTheDocument();

    const save = screen.getByRole('button', { name: /save username/i });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(setUsername).toHaveBeenCalledWith('natalie'));
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows Taken and disables Save when the name is unavailable', async () => {
    renderSection({ checkAvailable: vi.fn().mockResolvedValue(false) });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'natalie' } });
    expect(await screen.findByText(/^taken$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save username/i })).toBeDisabled();
  });

  it('shows the format reason and disables Save for an invalid name (no availability check)', () => {
    const checkAvailable = vi.fn();
    renderSection({ checkAvailable });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'ab' } });
    expect(screen.getByText(/at least 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save username/i })).toBeDisabled();
    expect(checkAvailable).not.toHaveBeenCalled();
  });

  it('surfaces an inline error when the name is taken at save time', async () => {
    const setUsername = vi.fn().mockResolvedValue({ ok: false, reason: 'taken' });
    renderSection({ checkAvailable: vi.fn().mockResolvedValue(true), setUsername });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'natalie' } });
    await screen.findByText(/available/i);
    fireEvent.click(screen.getByRole('button', { name: /save username/i }));
    await waitFor(() => expect(screen.getByText(/just taken/i)).toBeInTheDocument());
    expect(toast.success).not.toHaveBeenCalled();
  });
});
