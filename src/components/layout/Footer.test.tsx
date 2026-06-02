// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// jsdom does not implement window.matchMedia; stub it so GSAP / ScrollTrigger
// can register without throwing (same pattern used throughout this codebase).
function setMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  setMatchMedia();
});

afterEach(cleanup);

describe('Footer', () => {
  it('renders a Privacy link pointing to /privacy', async () => {
    vi.resetModules();
    const { Footer } = await import('./Footer');
    render(<MemoryRouter><Footer /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /^Privacy$/i });
    expect(link).toHaveAttribute('href', '/privacy');
  });

  it('renders a Terms link pointing to /terms', async () => {
    vi.resetModules();
    const { Footer } = await import('./Footer');
    render(<MemoryRouter><Footer /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /^Terms$/i });
    expect(link).toHaveAttribute('href', '/terms');
  });
});
