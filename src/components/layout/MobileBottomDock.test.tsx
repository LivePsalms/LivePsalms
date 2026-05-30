// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

function setMatchMedia(opts: { mobile: boolean; reducedMotion?: boolean }) {
  const { mobile, reducedMotion = false } = opts;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches:
      query.includes('reduce') ? reducedMotion :
      query.includes('max-width') ? mobile :
      false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function flushRaf() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
});

describe('MobileBottomDock', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
  });

  it('renders nothing when viewport is desktop', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    setMatchMedia({ mobile: false });
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    const { container } = render(
      <MemoryRouter><MobileBottomDock /></MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="mobile-bottom-dock"]')).toBeNull();
  });

  it('renders a logo link to "/" and a MENU button on mobile', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    const logo = screen.getByRole('link', { name: /home/i });
    expect(logo.getAttribute('href')).toBe('/');
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('starts visible (data-visible="true")', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    const dock = screen.getByTestId('mobile-bottom-dock');
    expect(dock.getAttribute('data-visible')).toBe('true');
  });

  it('opens the Sheet drawer when MENU is clicked', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Purpose' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notepad' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Community' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact' })).toBeInTheDocument();
  });

  it('fires onNavTrigger when a trigger-label nav link is tapped', async () => {
    vi.resetModules();
    const onNavTrigger = vi.fn();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock onNavTrigger={onNavTrigger} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    fireEvent.click(screen.getByRole('link', { name: 'Purpose' }));
    expect(onNavTrigger).toHaveBeenCalled();
  });

  it('hides on scroll-down past threshold (data-visible="false")', async () => {
    vi.resetModules();
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true, writable: true });
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 400, configurable: true, writable: true });
      window.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });
    const dock = screen.getByTestId('mobile-bottom-dock');
    expect(dock.getAttribute('data-visible')).toBe('false');
  });

  it('reveals on scroll-up past threshold (data-visible="true")', async () => {
    vi.resetModules();
    Object.defineProperty(window, 'scrollY', { value: 400, configurable: true, writable: true });
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    // First scroll down to set state to down, then scroll up.
    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 500, configurable: true, writable: true });
      window.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });
    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 300, configurable: true, writable: true });
      window.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });
    const dock = screen.getByTestId('mobile-bottom-dock');
    expect(dock.getAttribute('data-visible')).toBe('true');
  });

  it('forces visible when near the top of the page (scrollY < 80)', async () => {
    vi.resetModules();
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true, writable: true });
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 600, configurable: true, writable: true });
      window.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });
    expect(screen.getByTestId('mobile-bottom-dock').getAttribute('data-visible')).toBe('false');
    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 20, configurable: true, writable: true });
      window.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });
    expect(screen.getByTestId('mobile-bottom-dock').getAttribute('data-visible')).toBe('true');
  });

  it('renders the logo with a permanent invert(1) filter for white-on-dark on the pill', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    const logo = screen.getByAltText('');
    expect(logo.style.filter).toBe('invert(1)');
  });

  it('outer aside has motion-reduce class for reduced-motion users', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    const dock = screen.getByTestId('mobile-bottom-dock');
    expect(dock.className).toContain('motion-reduce:transition-none');
  });
});
