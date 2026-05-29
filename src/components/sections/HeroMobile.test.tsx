// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

function setMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

// jsdom does not provide ResizeObserver; stub it so HeroDesktop can mount.
if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  (window as unknown as Record<string, unknown>).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(cleanup);

describe('Hero dispatcher', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia(true);
  });

  it('renders HeroMobile below 768px', async () => {
    const { Hero } = await import('./Hero');
    render(<Hero introActive={false} />);
    expect(screen.getByTestId('hero-mobile')).toBeInTheDocument();
    expect(screen.queryByTestId('hero-desktop')).not.toBeInTheDocument();
  });

  it('renders HeroDesktop at or above 768px', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    setMatchMedia(false);
    vi.resetModules();
    const { Hero } = await import('./Hero');
    render(<Hero introActive={false} />);
    expect(screen.getByTestId('hero-desktop')).toBeInTheDocument();
    expect(screen.queryByTestId('hero-mobile')).not.toBeInTheDocument();
  });
});
