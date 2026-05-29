// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { HeaderMobile } from './HeaderMobile';

afterEach(cleanup);

describe('HeaderMobile', () => {
  it('renders a compact top bar with the LivePsalms icon and a menu button', () => {
    render(
      <MemoryRouter>
        <HeaderMobile onNavTrigger={vi.fn()} />
      </MemoryRouter>,
    );
    const logo = screen.getByAltText('LivePsalms');
    expect(logo).toBeInTheDocument();
    expect(logo.getAttribute('src')).toBe('/logo-icon.png');
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('opens the drawer when the menu button is tapped', () => {
    render(
      <MemoryRouter>
        <HeaderMobile onNavTrigger={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Purpose' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notepad' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Community' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact' })).toBeInTheDocument();
  });

  it('fires onNavTrigger when a nav link is tapped', () => {
    const onNavTrigger = vi.fn();
    render(
      <MemoryRouter>
        <HeaderMobile onNavTrigger={onNavTrigger} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    fireEvent.click(screen.getByRole('link', { name: 'Purpose' }));
    expect(onNavTrigger).toHaveBeenCalled();
  });

  it('inverts the logo when nav-theme is set to dark', async () => {
    const { setNavTheme } = await import('@/lib/nav-theme');
    setNavTheme(null); // start clean

    render(
      <MemoryRouter>
        <HeaderMobile onNavTrigger={vi.fn()} />
      </MemoryRouter>,
    );

    const logo = screen.getByAltText('LivePsalms');
    expect(logo.style.filter).toBe('invert(0)');

    setNavTheme('dark');
    // React batches state updates; flush a microtask so the listener sets state.
    await new Promise((r) => setTimeout(r, 0));
    expect(logo.style.filter).toBe('invert(1)');

    setNavTheme(null); // restore for other tests in the suite
  });
});
