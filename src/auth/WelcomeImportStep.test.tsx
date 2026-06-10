// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { WelcomeImportStep } from './WelcomeImportStep';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);

function selectFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

describe('WelcomeImportStep', () => {
  it('disables Upload until a file is selected; Skip calls onSkip without importing', () => {
    const importNote = vi.fn(async (n) => n);
    const onSkip = vi.fn();
    const onDone = vi.fn();
    render(<WelcomeImportStep adapter={{ importNote }} onDone={onDone} onSkip={onSkip} />);

    expect(screen.getByRole('button', { name: /upload & continue/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(importNote).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('imports one note per selected file, then calls onDone', async () => {
    const importNote = vi.fn(async (n) => n);
    const onDone = vi.fn();
    const { container } = render(
      <WelcomeImportStep adapter={{ importNote }} onDone={onDone} onSkip={() => {}} />,
    );

    selectFile(container, new File(['Psalm 23 is my anchor.'], 'note.txt', { type: 'text/plain' }));
    await screen.findByText('note.txt');

    const upload = screen.getByRole('button', { name: /upload & continue/i });
    expect(upload).toBeEnabled();
    fireEvent.click(upload);

    await waitFor(() => expect(importNote).toHaveBeenCalledTimes(1));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('keeps the user on the step when an import fails (no onDone)', async () => {
    const importNote = vi.fn().mockRejectedValueOnce(new Error('network'));
    const onDone = vi.fn();
    const { container } = render(
      <WelcomeImportStep adapter={{ importNote }} onDone={onDone} onSkip={() => {}} />,
    );

    selectFile(container, new File(['hello'], 'a.txt', { type: 'text/plain' }));
    await screen.findByText('a.txt');
    fireEvent.click(screen.getByRole('button', { name: /upload & continue/i }));

    await waitFor(() => expect(importNote).toHaveBeenCalled());
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /upload & continue/i })).toBeInTheDocument();
  });
});
