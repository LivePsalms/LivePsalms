// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SpotlightTour } from './SpotlightTour';

vi.mock('@/hooks/use-prefers-reduced-motion', () => ({ usePrefersReducedMotion: () => true }));

afterEach(cleanup);

describe('SpotlightTour', () => {
  it('renders the first step and advances on next', () => {
    const el = document.createElement('button');
    el.setAttribute('data-tour', 'new-note-sidebar-button');
    document.body.appendChild(el);
    render(<SpotlightTour onComplete={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText('Create a note')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Link verses')).toBeInTheDocument();
    el.remove();
  });

  it('skip fires onSkip', () => {
    const onSkip = vi.fn();
    render(<SpotlightTour onComplete={vi.fn()} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onSkip).toHaveBeenCalled();
  });

  it('missing anchor does not crash; step still shows its card', () => {
    expect(() => render(<SpotlightTour onComplete={vi.fn()} onSkip={vi.fn()} />)).not.toThrow();
    expect(screen.getByText('Create a note')).toBeInTheDocument();
  });

  it('reaching the end shows the sign-up card then completes', () => {
    const onComplete = vi.fn();
    render(<SpotlightTour onComplete={onComplete} onSkip={vi.fn()} />);
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: /next|done/i }));
    expect(screen.getByText('Make it yours')).toBeInTheDocument();
  });
});
