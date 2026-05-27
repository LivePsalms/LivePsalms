// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TodaysLampLoading } from './TodaysLampLoading';

afterEach(cleanup);

describe('TodaysLampLoading', () => {
  it('renders step 0 copy', () => {
    render(<TodaysLampLoading step={0} />);
    expect(screen.getByText(/Reading your recent notes/i)).toBeInTheDocument();
  });

  it('renders step 1 copy', () => {
    render(<TodaysLampLoading step={1} />);
    expect(screen.getByText(/Searching Scripture/i)).toBeInTheDocument();
  });

  it('renders step 2 copy', () => {
    render(<TodaysLampLoading step={2} />);
    expect(screen.getByText(/Bringing them into conversation/i)).toBeInTheDocument();
  });

  it('sets aria-live=polite on the status text', () => {
    render(<TodaysLampLoading step={0} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
