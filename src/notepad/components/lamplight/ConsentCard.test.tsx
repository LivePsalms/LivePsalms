// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConsentCard } from './ConsentCard';

afterEach(cleanup);

describe('ConsentCard', () => {
  it('renders the welcome copy and both CTAs in the initial step', () => {
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

  it('reveals voice + tradition questions when "Turn on Lamplight" is clicked', () => {
    render(<ConsentCard onTurnOn={vi.fn()} onMaybeLater={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /turn on lamplight/i }));
    expect(screen.getByText(/how would you like lamplight to refer to god/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lord/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/father/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/abba/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/jesus/i)).toBeInTheDocument();
    expect(screen.getByText(/optional/i)).toBeInTheDocument();
  });

  it('calls onTurnOn with selected voice + tradition on "Continue"', () => {
    const onTurnOn = vi.fn();
    render(<ConsentCard onTurnOn={onTurnOn} onMaybeLater={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /turn on lamplight/i }));
    fireEvent.click(screen.getByLabelText(/abba/i));
    fireEvent.click(screen.getByLabelText(/catholic/i));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onTurnOn).toHaveBeenCalledWith({ voicePreference: 'Abba', traditionHint: 'catholic' });
  });

  it('uses default Lord + unspecified when continue is pressed without changing selections', () => {
    const onTurnOn = vi.fn();
    render(<ConsentCard onTurnOn={onTurnOn} onMaybeLater={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /turn on lamplight/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onTurnOn).toHaveBeenCalledWith({ voicePreference: 'Lord', traditionHint: 'unspecified' });
  });
});
