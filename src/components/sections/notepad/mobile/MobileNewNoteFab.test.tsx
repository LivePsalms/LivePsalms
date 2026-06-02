// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileNewNoteFab } from './MobileNewNoteFab';

afterEach(cleanup);

describe('<MobileNewNoteFab />', () => {
  it('renders a button labeled "New note"', () => {
    render(<MobileNewNoteFab onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'New note' })).toBeInTheDocument();
  });

  it('calls onClick when tapped', () => {
    const onClick = vi.fn();
    render(<MobileNewNoteFab onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'New note' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
