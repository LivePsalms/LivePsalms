// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

// Stub window.matchMedia before any module loads (GSAP ScrollTrigger reads it
// at register time, which happens at the top of NextDevotionHandoff.tsx).
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock GSAP and ScrollTrigger so no DOM/browser APIs beyond matchMedia are hit.
vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    set: vi.fn(),
    to: vi.fn(),
    context: vi.fn(() => ({ revert: vi.fn() })),
    timeline: vi.fn(() => ({ scrollTrigger: null, fromTo: vi.fn(), to: vi.fn(), set: vi.fn(), kill: vi.fn() })),
  },
}));
vi.mock('gsap/all', () => ({ ScrollTrigger: {} }));

// Mock router and transition hooks — they're not exercised by the helper test.
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/transitions/usePillExpandNavigation', () => ({
  usePillExpandNavigation: () => ({ startFromPill: vi.fn() }),
}));
vi.mock('@/utils/extractDominantColor', () => ({
  extractDominantColor: () => Promise.resolve('#000'),
}));

import { applyCuratedBreak } from './NextDevotionHandoff';

describe('applyCuratedBreak', () => {
  it('returns the original title when breakAfter is undefined', () => {
    expect(applyCuratedBreak('Beside Still Waters', undefined)).toBe('Beside Still Waters');
  });

  it('returns the original title when breakAfter is 0', () => {
    expect(applyCuratedBreak('Beside Still Waters', 0)).toBe('Beside Still Waters');
  });

  it('splits at word index 2 into two segments', () => {
    expect(applyCuratedBreak('Beside Still Waters', 2)).toEqual(['Beside Still', 'Waters']);
  });

  it('splits at word index 1 (forces 2-line break on a 2-word title)', () => {
    expect(applyCuratedBreak('Brought Near', 1)).toEqual(['Brought', 'Near']);
  });

  it('splits a long title at word index 3', () => {
    expect(applyCuratedBreak('A Future You Cannot See Yet', 3)).toEqual([
      'A Future You',
      'Cannot See Yet',
    ]);
  });

  it('returns the original title when breakAfter equals word count', () => {
    expect(applyCuratedBreak('Beside Still Waters', 3)).toBe('Beside Still Waters');
  });

  it('returns the original title when breakAfter exceeds word count', () => {
    expect(applyCuratedBreak('Beside Still Waters', 99)).toBe('Beside Still Waters');
  });
});

import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach } from 'vitest';
import { NextDevotionHandoff } from './NextDevotionHandoff';
import type { Project } from '@/types';
import type { Devotion } from '@/data/devotions';

afterEach(cleanup);

const baseProject: Project = {
  id: 'peace',
  name: 'Peace',
  thumbnail: '/restoration1/image1.png',
  overlayColor: '#6b7370',
} as unknown as Project;

const peaceDevotion: Devotion = {
  id: 'peace',
  label: 'Restoration of Peace',
  title: 'Beside Still Waters',
  scriptureRef: 'Psalm 23:2–3',
  monogram: 'PE',
  firstMoodboardImage: '/restoration1/image1.png',
  mobileTitleBreak: 2,
};

function renderHandoff(devotion: Devotion = peaceDevotion) {
  return render(
    <MemoryRouter>
      <NextDevotionHandoff
        currentProject={baseProject}
        nextProject={baseProject}
        nextDevotion={devotion}
        variant="mobile"
      />
    </MemoryRouter>,
  );
}

describe('NextDevotionHandoff mobile pill — curated break', () => {
  it('renders the title as two segments split at the configured word index', () => {
    renderHandoff();
    // Both segments should appear separately in the DOM
    expect(screen.getByText('Beside Still')).toBeDefined();
    expect(screen.getByText('Waters')).toBeDefined();
    // And the un-split title should NOT appear as a single text node
    expect(screen.queryByText('Beside Still Waters')).toBeNull();
  });

  it('renders the title as one node when mobileTitleBreak is undefined', () => {
    renderHandoff({ ...peaceDevotion, mobileTitleBreak: undefined });
    expect(screen.getByText('Beside Still Waters')).toBeDefined();
  });
});
