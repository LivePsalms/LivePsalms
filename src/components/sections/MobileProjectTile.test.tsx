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

describe('MobileProjectTile', () => {
  it('renders the category eyebrow as RESTORATION for residential projects', () => {
    render(<MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />);
    expect(screen.getByText('Restoration')).toBeInTheDocument();
  });

  it('renders the category eyebrow as SERENITY for hospitality projects', () => {
    render(<MobileProjectTile project={orphanProject} index={0} onProjectClick={vi.fn()} />);
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

  it('exposes an aria-label that combines category, title, and scripture', () => {
    render(<MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-label')).toBe('Restoration — Beside Still Waters, Psalm 23:2–3');
  });
});
