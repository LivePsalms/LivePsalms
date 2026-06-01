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
  default: { registerPlugin: vi.fn(), set: vi.fn(), to: vi.fn(), context: vi.fn(), timeline: vi.fn() },
}));
vi.mock('gsap/all', () => ({ ScrollTrigger: {} }));

// Mock router and transition hooks — they're not exercised by the helper test.
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
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
