// src/notepad-landing/sections/garden-scene/use-garden-scroll.test.ts
// @vitest-environment jsdom

import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGardenScroll } from './use-garden-scroll';
import { TOTAL_SPACER_VH } from './station-meta';

const VIEWPORT_H = 800;
const SPACER_H = 9500;
const SPACER_TOP_DOC = 1000; // garden starts 1000px below document top (i.e. after a hero)

function setViewport(h: number) {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
}

function installSpacer() {
  // The hook reads document.getElementById('garden-spacer').offsetHeight
  // and getBoundingClientRect().top to compute progress relative to scroll.
  const el = document.createElement('div');
  el.id = 'garden-spacer';
  Object.defineProperty(el, 'offsetHeight', { configurable: true, value: SPACER_H });
  el.getBoundingClientRect = () => {
    // top in viewport coords = spacer's document top minus current scrollY
    const top = SPACER_TOP_DOC - window.scrollY;
    return { top, left: 0, right: 0, bottom: top + SPACER_H, width: 0, height: SPACER_H, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  };
  document.body.appendChild(el);
}

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  window.dispatchEvent(new Event('scroll'));
}

beforeEach(() => {
  document.body.innerHTML = '';
  setViewport(VIEWPORT_H);
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('useGardenScroll', () => {
  it('starts at progress 0 and currentStation 0 when the garden has not been reached', () => {
    installSpacer();
    const { result } = renderHook(() => useGardenScroll());
    expect(result.current.scrollProgress.current).toBe(0);
    expect(result.current.currentStation).toBe(0);
  });

  it('reaches progress 1 and currentStation 6 once user scrolls to the bottom of the garden', () => {
    installSpacer();
    const { result } = renderHook(() => useGardenScroll());
    const max = SPACER_TOP_DOC + (SPACER_H - VIEWPORT_H);
    act(() => scrollTo(max));
    expect(result.current.scrollProgress.current).toBeCloseTo(1, 4);
    expect(result.current.currentStation).toBe(6);
  });

  it('rounds to currentStation 3 at the exact middle of the garden', () => {
    installSpacer();
    const { result } = renderHook(() => useGardenScroll());
    const max = SPACER_TOP_DOC + (SPACER_H - VIEWPORT_H);
    act(() => scrollTo((SPACER_TOP_DOC + max) / 2));
    expect(result.current.currentStation).toBe(3);
  });

  it('clamps progress at scroll boundaries', () => {
    installSpacer();
    const { result } = renderHook(() => useGardenScroll());
    act(() => scrollTo(-100));
    expect(result.current.scrollProgress.current).toBe(0);
    act(() => scrollTo(99999));
    expect(result.current.scrollProgress.current).toBe(1);
  });

  it('progress stays at 0 while the user is still in the hero (above the garden)', () => {
    installSpacer();
    const { result } = renderHook(() => useGardenScroll());
    act(() => scrollTo(SPACER_TOP_DOC - 200)); // 200px above garden top
    expect(result.current.scrollProgress.current).toBe(0);
    expect(result.current.currentStation).toBe(0);
  });

  it('jumpTo(n) calls window.scrollTo with the garden top + nth-fraction-of-range', () => {
    installSpacer();
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { result } = renderHook(() => useGardenScroll());
    act(() => result.current.jumpTo(3));
    const expectedTop = SPACER_TOP_DOC + (SPACER_H - VIEWPORT_H) * (3 / 6);
    expect(scrollSpy).toHaveBeenCalledWith({ top: expectedTop, behavior: 'smooth' });
  });

  it('TOTAL_SPACER_VH math is 950', () => {
    expect(TOTAL_SPACER_VH).toBe(950);
  });
});
