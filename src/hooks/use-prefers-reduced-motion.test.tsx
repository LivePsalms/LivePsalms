// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePrefersReducedMotion } from './use-prefers-reduced-motion';

type Listener = (event: { matches: boolean }) => void;

function installMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();

  const mediaQueryList = {
    get matches() {
      return matches;
    },
    addEventListener: (_event: 'change', listener: Listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_event: 'change', listener: Listener) => {
      listeners.delete(listener);
    },
  };

  window.matchMedia = vi.fn().mockReturnValue(mediaQueryList);

  return {
    fire: (next: boolean) => {
      matches = next;
      listeners.forEach((l) => l({ matches: next }));
    },
  };
}

describe('usePrefersReducedMotion', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('returns false when the user has not requested reduced motion', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when the user has requested reduced motion', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes', () => {
    const mm = installMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    act(() => {
      mm.fire(true);
    });
    expect(result.current).toBe(true);
  });
});
