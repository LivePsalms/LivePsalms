// src/notepad-landing/sections/garden-scene/use-garden-scroll.test.ts
// @vitest-environment jsdom

import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGardenScroll } from './use-garden-scroll';
import { TOTAL_SPACER_VH } from './station-meta';

function setViewport(h: number) {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
}

function setSpacerHeight(h: number) {
  // The hook reads document.getElementById('garden-spacer').offsetHeight.
  const el = document.createElement('div');
  el.id = 'garden-spacer';
  Object.defineProperty(el, 'offsetHeight', { configurable: true, value: h });
  document.body.appendChild(el);
}

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  window.dispatchEvent(new Event('scroll'));
}

beforeEach(() => {
  document.body.innerHTML = '';
  setViewport(800);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('useGardenScroll', () => {
  it('starts at progress 0 and currentStation 0', () => {
    setSpacerHeight(9500);
    const { result } = renderHook(() => useGardenScroll());
    expect(result.current.scrollProgress.current).toBe(0);
    expect(result.current.currentStation).toBe(0);
  });

  it('reaches progress 1 and currentStation 6 at max scroll', () => {
    setSpacerHeight(9500);
    const { result } = renderHook(() => useGardenScroll());
    act(() => scrollTo(9500 - 800));
    expect(result.current.scrollProgress.current).toBeCloseTo(1, 4);
    expect(result.current.currentStation).toBe(6);
  });

  it('rounds to currentStation 3 at exact middle', () => {
    setSpacerHeight(9500);
    const { result } = renderHook(() => useGardenScroll());
    const max = 9500 - 800;
    act(() => scrollTo(max * 0.5));
    expect(result.current.currentStation).toBe(3);
  });

  it('clamps progress at scroll boundaries', () => {
    setSpacerHeight(9500);
    const { result } = renderHook(() => useGardenScroll());
    act(() => scrollTo(-100));
    expect(result.current.scrollProgress.current).toBe(0);
    act(() => scrollTo(99999));
    expect(result.current.scrollProgress.current).toBe(1);
  });

  it('jumpTo(n) calls window.scrollTo with the right top', () => {
    setSpacerHeight(9500);
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { result } = renderHook(() => useGardenScroll());
    act(() => result.current.jumpTo(3));
    expect(scrollSpy).toHaveBeenCalledWith({ top: (9500 - 800) * (3 / 6), behavior: 'smooth' });
  });

  it('TOTAL_SPACER_VH math is 950', () => {
    expect(TOTAL_SPACER_VH).toBe(950);
  });
});
