// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConnectionCardsEmpty } from './ConnectionCardsEmpty';

afterEach(cleanup);

describe('<ConnectionCardsEmpty />', () => {
  it('inactive: shows the checklist with depth done, vault not yet', () => {
    render(
      <ConnectionCardsEmpty
        state={{ phase: 'inactive', reason: 'vault_too_small', meetsDepth: true, meetsVault: false }}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText(/No connections lit yet/i)).toBeInTheDocument();
    const depth = screen.getByText(/Write more in-depth notes/i).closest('li')!;
    const vault = screen.getByText(/Keep a few more notes in your vault/i).closest('li')!;
    expect(depth).toHaveAttribute('data-done', 'true');
    expect(vault).toHaveAttribute('data-done', 'false');
  });

  it('inactive: depth not yet when meetsDepth=false', () => {
    render(
      <ConnectionCardsEmpty
        state={{ phase: 'inactive', reason: 'note_too_short', meetsDepth: false, meetsVault: true }}
        onRetry={() => {}}
      />,
    );
    const depth = screen.getByText(/Write more in-depth notes/i).closest('li')!;
    const vault = screen.getByText(/Keep a few more notes in your vault/i).closest('li')!;
    expect(depth).toHaveAttribute('data-done', 'false');
    expect(vault).toHaveAttribute('data-done', 'true');
  });

  it('waiting_for_embedding: shows reading message with a polite live region', () => {
    render(
      <ConnectionCardsEmpty state={{ phase: 'waiting_for_embedding' }} onRetry={() => {}} />,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText(/The lamp is reading/i)).toBeInTheDocument();
  });

  it('inactive: View criteria opens a modal listing the criteria in plain English', () => {
    render(
      <ConnectionCardsEmpty
        state={{ phase: 'inactive', reason: 'note_too_short', meetsDepth: false, meetsVault: true }}
        onRetry={() => {}}
      />,
    );
    // Closed by default — criteria not yet in the document.
    expect(screen.queryByText(/Another note echoes this one/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /View criteria/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/What lights a connection/i);
    expect(dialog).toHaveTextContent(/Your note has enough substance/i);
    expect(dialog).toHaveTextContent(/handful of notes in your vault/i);
    expect(dialog).toHaveTextContent(/finished reading your note/i);
    expect(dialog).toHaveTextContent(/Another note echoes this one/i);
  });

  it('no_connections: shows the nothing-echoes message and no View criteria link', () => {
    render(<ConnectionCardsEmpty state={{ phase: 'no_connections' }} onRetry={() => {}} />);
    expect(screen.getByText(/Nothing echoes yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View criteria/i })).toBeNull();
  });

  it('error: shows the message and Try again invokes onRetry', () => {
    const onRetry = vi.fn();
    render(<ConnectionCardsEmpty state={{ phase: 'error', reason: 'network' }} onRetry={onRetry} />);
    expect(screen.getByText(/Couldn't reach the lamp/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
