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
    vi.resetModules();
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

describe('HeroMobile content', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia(true);
  });

  it('renders the PSALMS wordmark', async () => {
    vi.resetModules();
    const { Hero } = await import('./Hero');
    render(<Hero introActive={false} />);
    expect(screen.getByLabelText(/psalms/i)).toBeInTheDocument();
  });

  it('does NOT render a <video> element', async () => {
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    expect(container.querySelector('video')).toBeNull();
  });

  it('renders the silhouette image as an <img>', async () => {
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/tropical_jungle.png');
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('mounts and unmounts cleanly when prefers-reduced-motion is set', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduce') || query.includes('max-width'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { unmount } = render(<Hero introActive={false} />);
    expect(() => unmount()).not.toThrow();
  });
});
