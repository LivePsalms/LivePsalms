// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OptedOutCard } from './OptedOutCard';

afterEach(cleanup);

describe('OptedOutCard', () => {
  it('renders the off-state copy and a change-mind link', () => {
    render(<OptedOutCard onChangeMind={vi.fn()} />);
    expect(screen.getByText(/lamplight is off/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is being analyzed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change your mind\? turn on lamplight/i })).toBeInTheDocument();
  });

  it('calls onChangeMind when the change-mind button is clicked', () => {
    const onChangeMind = vi.fn();
    render(<OptedOutCard onChangeMind={onChangeMind} />);
    fireEvent.click(screen.getByRole('button', { name: /change your mind/i }));
    expect(onChangeMind).toHaveBeenCalledOnce();
  });
});
