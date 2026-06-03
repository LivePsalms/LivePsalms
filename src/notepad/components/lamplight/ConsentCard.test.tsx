// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConsentCard } from './ConsentCard';

afterEach(cleanup);

describe('ConsentCard', () => {
  it('renders the welcome copy and both CTAs', () => {
    render(<ConsentCard onTurnOn={vi.fn()} onMaybeLater={vi.fn()} />);
    expect(screen.getByText(/welcome the lamp/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /turn on lamplight/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /maybe later/i })).toBeInTheDocument();
  });

  it('calls onMaybeLater immediately when "Maybe later" is clicked', () => {
    const onMaybeLater = vi.fn();
    render(<ConsentCard onTurnOn={vi.fn()} onMaybeLater={onMaybeLater} />);
    fireEvent.click(screen.getByRole('button', { name: /maybe later/i }));
    expect(onMaybeLater).toHaveBeenCalledOnce();
  });

  it('calls onTurnOn when "Turn on Lamplight" is clicked', () => {
    const onTurnOn = vi.fn();
    render(<ConsentCard onTurnOn={onTurnOn} onMaybeLater={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /turn on lamplight/i }));
    expect(onTurnOn).toHaveBeenCalledTimes(1);
  });
});
