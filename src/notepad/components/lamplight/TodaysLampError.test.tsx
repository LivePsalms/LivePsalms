// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TodaysLampError } from './TodaysLampError';

afterEach(cleanup);

describe('TodaysLampError', () => {
  it('renders validators_failed copy with retry button', () => {
    const onRetry = vi.fn();
    render(<TodaysLampError reason="validators_failed" firstName={null} onRetry={onRetry} />);
    expect(screen.getByText(/Lamplight had trouble/i)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /Try again/i });
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders network copy with retry button', () => {
    render(<TodaysLampError reason="network" firstName={null} onRetry={() => {}} />);
    expect(screen.getByText(/reach Lamplight just now/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
  });

  it('renders no_notes copy without retry button', () => {
    render(<TodaysLampError reason="no_notes" firstName={null} onRetry={() => {}} />);
    expect(screen.getByText(/needs your notes/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Try again/i })).toBeNull();
  });

  it('prefixes firstName on validators_failed body', () => {
    render(<TodaysLampError reason="validators_failed" firstName="Natalie" onRetry={() => {}} />);
    expect(screen.getByText(/Natalie, we couldn't generate/i)).toBeInTheDocument();
  });

  it('prefixes firstName on no_notes body', () => {
    render(<TodaysLampError reason="no_notes" firstName="Natalie" onRetry={() => {}} />);
    expect(screen.getByText(/Natalie, write a few more notes/i)).toBeInTheDocument();
  });
});
