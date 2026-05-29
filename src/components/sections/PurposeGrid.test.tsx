// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

// Hoisted so the matchMedia stub is installed BEFORE the static imports
// below run — GSAP's plugin-registration code, triggered at import time
// inside DesktopMosaic.tsx, reads window.matchMedia synchronously.
vi.hoisted(() => {
  if (typeof window !== 'undefined') {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

vi.mock('@/hooks/use-mobile', async () => {
  return {
    MOBILE_BREAKPOINT: 768,
    useIsMobile: vi.fn(),
  };
});

import { render, screen, cleanup } from '@testing-library/react';
import type { Project } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { PurposeGrid } from './PurposeGrid';

afterEach(cleanup);

const projects: Project[] = [
  {
    id: 'peace',
    name: 'Restoration 01',
    category: 'residential',
    thumbnail: '/mid_section/restoration1.png',
    images: ['/mid_section/restoration1.png'],
    overlayColor: '#8B8378',
  },
  {
    id: 'forgiveness',
    name: 'Serenity 02',
    category: 'hospitality',
    thumbnail: '/mid_section/serenity2.png',
    images: ['/mid_section/serenity2.png'],
    overlayColor: '#B08A6A',
  },
];

beforeEach(() => {
  // Default matchMedia stub — reduced motion off.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

describe('PurposeGrid', () => {
  it('renders MobileParallaxList tiles on mobile', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    render(<PurposeGrid projects={projects} onProjectClick={vi.fn()} />);
    expect(screen.getAllByTestId('mobile-project-tile')).toHaveLength(2);
    expect(screen.queryByTestId('purpose-grid-dots')).toBeNull();
  });

  it('renders the desktop mosaic strip on desktop', () => {
    vi.mocked(useIsMobile).mockReturnValue(false);
    render(<PurposeGrid projects={projects} onProjectClick={vi.fn()} />);
    expect(document.querySelectorAll('[data-flip-id]').length).toBe(2);
    expect(screen.queryAllByTestId('mobile-project-tile')).toHaveLength(0);
  });
});
