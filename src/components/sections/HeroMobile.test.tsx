// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

function setMatchMedia(opts: { mobile: boolean; reducedMotion?: boolean }) {
  const { mobile, reducedMotion = false } = opts;
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const matches =
      query.includes('reduce') ? reducedMotion :
      query.includes('max-width') ? mobile :
      false;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  }) as unknown as typeof window.matchMedia;
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
    setMatchMedia({ mobile: true });
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
    setMatchMedia({ mobile: false });
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
    setMatchMedia({ mobile: true });
  });

  it('renders the PSALMS wordmark', async () => {
    vi.resetModules();
    const { Hero } = await import('./Hero');
    render(<Hero introActive={false} />);
    expect(screen.getByLabelText(/psalms/i)).toBeInTheDocument();
  });

  it('renders a <video> with /hero_main_video.mp4 src and /tropical_jungle.png poster', async () => {
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    const video = container.querySelector<HTMLVideoElement>('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('/hero_main_video.mp4');
    expect(video?.getAttribute('poster')).toBe('/tropical_jungle.png');
    // Use DOM properties (not hasAttribute) — React may set these as
    // properties rather than attributes on the rendered element.
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.hasAttribute('playsinline')).toBe(true);
  });

  it('does NOT render the silhouette as an <img> (asset is now a video poster)', async () => {
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    expect(container.querySelector('img[src="/tropical_jungle.png"]')).toBeNull();
  });

  it('mounts and unmounts cleanly when prefers-reduced-motion is set', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true, reducedMotion: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { unmount } = render(<Hero introActive={false} />);
    expect(() => unmount()).not.toThrow();
  });

  it('renders the quote text and attribution', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    render(<Hero introActive={false} />);
    expect(screen.getByText(/He leads me beside still waters/)).toBeInTheDocument();
    expect(screen.getByText(/He restores my soul/)).toBeInTheDocument();
    expect(screen.getByText(/Psalm 23:2-3/)).toBeInTheDocument();
  });

  it('quote container starts hidden (data-visible="false") on mount', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    // IntersectionObserver does NOT fire (default jsdom: undefined). Stub a passive one.
    class PassiveIO {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn();
      root = null; rootMargin = ''; thresholds = [];
    }
    vi.stubGlobal('IntersectionObserver', PassiveIO);
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { getByTestId } = render(<Hero introActive={false} />);
    expect(getByTestId('hero-mobile-quote').getAttribute('data-visible')).toBe('false');
    vi.unstubAllGlobals();
  });

  it('renders all three BRIDGE_COPY lines', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { BRIDGE_COPY } = await import('./hero-bridge-content');
    const { Hero } = await import('./Hero');
    render(<Hero introActive={false} />);
    expect(screen.getByText(BRIDGE_COPY.invitation)).toBeInTheDocument();
    expect(screen.getByText(BRIDGE_COPY.thesis)).toBeInTheDocument();
    expect(screen.getByText(BRIDGE_COPY.assurance)).toBeInTheDocument();
  });

  it('applies var(--app-bg) as the root background color', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    render(<Hero introActive={false} />);
    const root = screen.getByTestId('hero-mobile');
    expect(root.style.backgroundColor).toBe('var(--app-bg)');
  });

  it('does NOT apply text-white to the root container', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    render(<Hero introActive={false} />);
    const root = screen.getByTestId('hero-mobile');
    expect(root.className).not.toMatch(/text-white/);
  });

  it('does NOT apply a dark umber background class to the root container', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    render(<Hero introActive={false} />);
    const root = screen.getByTestId('hero-mobile');
    expect(root.className).not.toMatch(/deep-umber/);
  });

  it('renders the quote DOM-before the video', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container, getByTestId } = render(<Hero introActive={false} />);
    const quote = getByTestId('hero-mobile-quote');
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    // DOCUMENT_POSITION_FOLLOWING (4) means video appears AFTER quote in the DOM.
    expect(quote.compareDocumentPosition(video!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('sets autoplay on the video when prefers-reduced-motion is NOT set', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    const video = container.querySelector<HTMLVideoElement>('video');
    expect(video).not.toBeNull();
    expect(video?.autoplay).toBe(true);
  });

  it('does NOT set autoplay on the video when prefers-reduced-motion IS set', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true, reducedMotion: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    const video = container.querySelector<HTMLVideoElement>('video');
    expect(video).not.toBeNull();
    expect(video?.autoplay).toBe(false);
  });

  it('marks the decorative video as aria-hidden', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    const video = container.querySelector<HTMLVideoElement>('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('aria-hidden')).toBe('true');
  });
});
