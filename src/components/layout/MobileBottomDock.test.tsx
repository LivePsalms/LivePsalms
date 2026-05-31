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
    expect(screen.getByRole('button', { name: /^menu$/i })).toBeInTheDocument();
  });

  it('starts visible (data-visible="true")', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    const dock = screen.getByTestId('mobile-bottom-dock');
    expect(dock.getAttribute('data-visible')).toBe('true');
  });

  it('toggles data-panel-state and aria-expanded when the MENU button is clicked', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    const dock = screen.getByTestId('mobile-bottom-dock');
    const toggle = screen.getByRole('button', { name: /^menu$/i });
    expect(dock.getAttribute('data-panel-state')).toBe('closed');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('mobile-menu-panel');

    fireEvent.click(toggle);
    expect(dock.getAttribute('data-panel-state')).toBe('open');
    const closeToggle = screen.getByRole('button', { name: /close menu/i });
    expect(closeToggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(closeToggle);
    expect(dock.getAttribute('data-panel-state')).toBe('closed');
    expect(screen.getByRole('button', { name: /^menu$/i }).getAttribute('aria-expanded')).toBe('false');
  });

  it('renders the 4 nav links inside the panel and exposes them by accessible name', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));
    expect(screen.getByRole('link', { name: 'PURPOSE' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'NOTEPAD' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'COMMUNITY' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CONTACT' })).toBeInTheDocument();
  });

  it('fires onNavTrigger when a NAV_TRIGGER_LABELS link is tapped', async () => {
    vi.resetModules();
    const onNavTrigger = vi.fn();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock onNavTrigger={onNavTrigger} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));
    fireEvent.click(screen.getByRole('link', { name: 'PURPOSE' }));
    expect(onNavTrigger).toHaveBeenCalledTimes(1);
  });

  it('toggles the Instagram sub-row when SOCIAL is clicked inside an open panel', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));

    const socialBtn = screen.getByRole('button', { name: /^social$/i });
    expect(socialBtn.getAttribute('aria-expanded')).toBe('false');
    expect(socialBtn.getAttribute('aria-controls')).toBe('mobile-social-instagram');
    const socialRow = socialBtn.closest('.social-row') as HTMLElement;
    expect(socialRow.getAttribute('data-social-state')).toBe('closed');

    fireEvent.click(socialBtn);
    expect(socialBtn.getAttribute('aria-expanded')).toBe('true');
    expect(socialRow.getAttribute('data-social-state')).toBe('open');
    const instagram = screen.getByRole('link', { name: /instagram/i });
    expect(instagram.getAttribute('href')).toBe('https://instagram.com');
    expect(instagram.getAttribute('target')).toBe('_blank');
    expect(instagram.getAttribute('rel')).toContain('noopener');
    expect(instagram.id).toBe('mobile-social-instagram');

    fireEvent.click(socialBtn);
    expect(socialBtn.getAttribute('aria-expanded')).toBe('false');
    expect(socialRow.getAttribute('data-social-state')).toBe('closed');
  });

  it('collapses Social automatically when the panel closes, even after Social was expanded', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^social$/i }));
    expect(screen.getByRole('button', { name: /^social$/i }).getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /close menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));

    expect(screen.getByRole('button', { name: /^social$/i }).getAttribute('aria-expanded')).toBe('false');
  });

  it('does NOT fire onNavTrigger when SOCIAL is tapped (excluded from NAV_TRIGGER_LABELS)', async () => {
    vi.resetModules();
    const onNavTrigger = vi.fn();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock onNavTrigger={onNavTrigger} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^social$/i }));
    expect(onNavTrigger).not.toHaveBeenCalled();
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
