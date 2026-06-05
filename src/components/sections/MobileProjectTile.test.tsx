// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MobileProjectTile } from './MobileProjectTile';
import type { Project } from '@/types';

afterEach(cleanup);

const peaceProject: Project = {
  id: 'peace',
  name: 'Restoration 01',
  category: 'residential',
  thumbnail: '/mid_section/restoration1.png',
  images: ['/mid_section/restoration1.png'],
  overlayColor: '#8B8378',
};

const orphanProject: Project = {
  id: 'mystery',
  name: 'Mystery',
  category: 'hospitality',
  thumbnail: '/mid_section/mystery.png',
  images: ['/mid_section/mystery.png'],
  overlayColor: '#B08A6A',
};

const forgivenessProject: Project = {
  id: 'forgiveness',
  name: 'Serenity 02',
  category: 'hospitality',
  thumbnail: '/mid_section/serenity2.png',
  images: ['/mid_section/serenity2.png'],
  overlayColor: '#B08A6A',
};

describe('MobileProjectTile', () => {
  it('renders the category eyebrow as RESTORATION for residential projects', () => {
    render(<MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />);
    expect(screen.getByText('Restoration')).toBeInTheDocument();
  });

  it('renders the category eyebrow as SERENITY for hospitality projects', () => {
    render(<MobileProjectTile project={forgivenessProject} index={0} onProjectClick={vi.fn()} />);
    expect(screen.getByText('Serenity')).toBeInTheDocument();
  });

  it('renders the devotion title and scripture ref when a devotion exists', () => {
    render(<MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />);
    expect(screen.getByText('Beside Still Waters')).toBeInTheDocument();
    expect(screen.getByText('Psalm 23:2–3')).toBeInTheDocument();
  });

  it('falls back to overlay/category label and hides scripture when no devotion exists', () => {
    render(<MobileProjectTile project={orphanProject} index={0} onProjectClick={vi.fn()} />);
    expect(screen.getByTestId('tile-title')).toHaveTextContent('Serenity');
    expect(screen.queryByTestId('tile-scripture')).toBeNull();
  });

  it('fires onProjectClick when the tile is tapped', () => {
    const handleClick = vi.fn();
    render(<MobileProjectTile project={peaceProject} index={0} onProjectClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith(peaceProject);
  });

  it('alternates column order: index 0 → text-image, index 1 → image-text', () => {
    const { rerender, getByTestId } = render(
      <MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />
    );
    expect(getByTestId('mobile-project-tile').getAttribute('data-tile-order')).toBe('text-image');
    rerender(<MobileProjectTile project={peaceProject} index={1} onProjectClick={vi.fn()} />);
    expect(getByTestId('mobile-project-tile').getAttribute('data-tile-order')).toBe('image-text');
  });

  it('alternates text overlay anchor: index 0 → left, index 1 → right', () => {
    const { rerender, getByTestId } = render(
      <MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />
    );
    expect(getByTestId('tile-text').getAttribute('data-text-anchor')).toBe('left');
    rerender(<MobileProjectTile project={peaceProject} index={1} onProjectClick={vi.fn()} />);
    expect(getByTestId('tile-text').getAttribute('data-text-anchor')).toBe('right');
  });

  it('exposes an aria-label that combines category, title, and scripture', () => {
    render(<MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-label')).toBe('Restoration — Beside Still Waters, Psalm 23:2–3');
  });

  it('renders no clip-path or blur when prefers-reduced-motion is set', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    try {
      render(
        <MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />
      );
      const imageWrap = screen.getByTestId('tile-image');
      const textCol = screen.getByTestId('tile-text');

      // Reduced-motion: no inline clip-path on the image wrap, no blur on text.
      expect(imageWrap.style.clipPath).toBe('');
      expect(textCol.style.filter).toBe('');
      expect(textCol.style.opacity === '' || textCol.style.opacity === '1').toBe(true);
    } finally {
      window.matchMedia = original;
    }
  });

  it('applies an initial clip-path and blur when reduced motion is not set', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    try {
      render(
        <MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />
      );
      const imageWrap = screen.getByTestId('tile-image');
      const textCol = screen.getByTestId('tile-text');

      // Animated path: motion engaged means inline clip-path on image and
      // filter (blur) on text both exist.
      expect(imageWrap.style.clipPath).not.toBe('');
      expect(textCol.style.filter).not.toBe('');
    } finally {
      window.matchMedia = original;
    }
  });

  it('renders the initial (fully right-clipped) image state at index 0', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    try {
      render(
        <MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />
      );
      const imageWrap = screen.getByTestId('tile-image');
      // Index 0 → LTR wipe → starts fully clipped from the right.
      expect(imageWrap.style.clipPath).toBe('inset(0 100% 0 0)');
    } finally {
      window.matchMedia = original;
    }
  });

  it('renders the initial (fully left-clipped) image state at index 1', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    try {
      render(
        <MobileProjectTile project={peaceProject} index={1} onProjectClick={vi.fn()} />
      );
      const imageWrap = screen.getByTestId('tile-image');
      // Index 1 → RTL wipe → starts fully clipped from the left.
      expect(imageWrap.style.clipPath).toBe('inset(0 0 0 100%)');
    } finally {
      window.matchMedia = original;
    }
  });

  it('exposes data-wipe-direction reflecting per-index alternation', () => {
    const { rerender, getByTestId } = render(
      <MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />
    );
    expect(getByTestId('tile-image').getAttribute('data-wipe-direction')).toBe('ltr');
    rerender(<MobileProjectTile project={peaceProject} index={1} onProjectClick={vi.fn()} />);
    expect(getByTestId('tile-image').getAttribute('data-wipe-direction')).toBe('rtl');
  });
});
