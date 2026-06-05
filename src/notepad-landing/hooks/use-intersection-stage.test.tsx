// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIntersectionStage } from './use-intersection-stage';
import { useRef } from 'react';

type Cb = (entries: { isIntersecting: boolean }[]) => void;
let intersectionCb: Cb | null = null;

beforeEach(() => {
  intersectionCb = null;
  window.IntersectionObserver = vi.fn().mockImplementation(function (cb: Cb) {
    intersectionCb = cb;
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };
  }) as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  intersectionCb = null;
});

describe('useIntersectionStage', () => {
  it('returns false initially', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useIntersectionStage(ref);
    });
    expect(result.current).toBe(false);
  });

  it('returns true once the element intersects', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useIntersectionStage(ref);
    });
    act(() => {
      intersectionCb?.([{ isIntersecting: true }]);
    });
    expect(result.current).toBe(true);
  });

  it('stays true once it has intersected (one-shot)', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useIntersectionStage(ref);
    });
    act(() => {
      intersectionCb?.([{ isIntersecting: true }]);
    });
    act(() => {
      intersectionCb?.([{ isIntersecting: false }]);
    });
    expect(result.current).toBe(true);
  });
});
