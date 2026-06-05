// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TodaysLampLoading } from './TodaysLampLoading';

afterEach(cleanup);

describe('TodaysLampLoading', () => {
  it('renders step 0 copy', () => {
    render(<TodaysLampLoading step={0} firstName={null} />);
    expect(screen.getByText(/Reading your recent notes/i)).toBeInTheDocument();
  });

  it('renders step 1 copy', () => {
    render(<TodaysLampLoading step={1} firstName={null} />);
    expect(screen.getByText(/Searching Scripture/i)).toBeInTheDocument();
  });

  it('renders step 2 copy (no name)', () => {
    render(<TodaysLampLoading step={2} firstName={null} />);
    expect(screen.getByText(/Today's Lamp is on its way/i)).toBeInTheDocument();
  });

  it('renders step 2 copy with firstName prefix', () => {
    render(<TodaysLampLoading step={2} firstName="Natalie" />);
    expect(screen.getByText(/Natalie, Today's Lamp is on its way/i)).toBeInTheDocument();
  });

  it('sets aria-live=polite on the status text', () => {
    render(<TodaysLampLoading step={0} firstName={null} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
