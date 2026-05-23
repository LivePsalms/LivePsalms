// src/notepad-landing/sections/garden-scene/garden-progress.test.tsx
// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GardenProgress } from './garden-progress';

afterEach(cleanup);

describe('<GardenProgress />', () => {
  it('renders 7 buttons with Roman numerals I..VII', () => {
    render(<GardenProgress current={0} onJump={() => {}} />);
    expect(screen.getByRole('button', { name: /go to station 1: three voices/i })).toHaveTextContent('I');
    expect(screen.getByRole('button', { name: /go to station 7: yours, stays yours/i })).toHaveTextContent('VII');
    expect(screen.getAllByRole('button')).toHaveLength(7);
  });

  it('marks the active station with aria-current="true" and an active class', () => {
    render(<GardenProgress current={3} onJump={() => {}} />);
    const btn = screen.getByRole('button', { name: /go to station 4/i });
    expect(btn).toHaveAttribute('aria-current', 'true');
    expect(btn.className).toMatch(/active/);
  });

  it('clicking a button fires onJump(index)', () => {
    const onJump = vi.fn();
    render(<GardenProgress current={0} onJump={onJump} />);
    fireEvent.click(screen.getByRole('button', { name: /go to station 5/i }));
    expect(onJump).toHaveBeenCalledWith(4);
  });
});
