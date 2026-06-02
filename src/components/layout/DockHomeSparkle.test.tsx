// @vitest-environment jsdom
import { createRef } from 'react';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { DockHomeSparkle, type DockHomeSparkleHandle } from './DockHomeSparkle';

function setReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('reduce') ? reduced : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => cleanup());

describe('DockHomeSparkle', () => {
  beforeEach(() => setReducedMotion(false));

  it('renders an aria-hidden layer with no particles initially', () => {
    const { container } = render(<DockHomeSparkle />);
    const layer = container.querySelector('[data-testid="dock-home-sparkle"]');
    expect(layer).not.toBeNull();
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('[data-particle]')).toHaveLength(0);
  });

  it('spawns one ring + 8 embers when burst() is called', () => {
    const ref = createRef<DockHomeSparkleHandle>();
    const { container } = render(<DockHomeSparkle ref={ref} />);
    act(() => ref.current?.burst());
    expect(container.querySelector('[data-particle="ring"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-particle="ember"]')).toHaveLength(8);
  });

  it('spawns no particles under prefers-reduced-motion', () => {
    setReducedMotion(true);
    const ref = createRef<DockHomeSparkleHandle>();
    const { container } = render(<DockHomeSparkle ref={ref} />);
    act(() => ref.current?.burst());
    expect(container.querySelectorAll('[data-particle]')).toHaveLength(0);
  });

  it('removes a particle when its animation ends', () => {
    const ref = createRef<DockHomeSparkleHandle>();
    const { container } = render(<DockHomeSparkle ref={ref} />);
    act(() => ref.current?.burst());
    const before = container.querySelectorAll('[data-particle]').length;
    const first = container.querySelector('[data-particle]') as HTMLElement;
    act(() => fireEvent.animationEnd(first));
    expect(container.querySelectorAll('[data-particle]').length).toBe(before - 1);
  });
});
