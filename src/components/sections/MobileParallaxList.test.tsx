// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MobileParallaxList } from './MobileParallaxList';
import type { Project } from '@/types';

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
    id: 'hope',
    name: 'Restoration 03',
    category: 'residential',
    thumbnail: '/mid_section/restoration3.jpg',
    images: ['/mid_section/restoration3.jpg'],
    overlayColor: '#7A7568',
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

describe('MobileParallaxList', () => {
  it('renders one tile per project', () => {
    render(<MobileParallaxList projects={projects} onProjectClick={vi.fn()} />);
    expect(screen.getAllByTestId('mobile-project-tile')).toHaveLength(3);
  });

  it('alternates tile order by index — 0 text-image, 1 image-text, 2 text-image', () => {
    render(<MobileParallaxList projects={projects} onProjectClick={vi.fn()} />);
    const tiles = screen.getAllByTestId('mobile-project-tile');
    expect(tiles[0].getAttribute('data-tile-order')).toBe('text-image');
    expect(tiles[1].getAttribute('data-tile-order')).toBe('image-text');
    expect(tiles[2].getAttribute('data-tile-order')).toBe('text-image');
  });

  it('renders nothing in the list when projects is empty', () => {
    render(<MobileParallaxList projects={[]} onProjectClick={vi.fn()} />);
    expect(screen.queryAllByTestId('mobile-project-tile')).toHaveLength(0);
  });
});
