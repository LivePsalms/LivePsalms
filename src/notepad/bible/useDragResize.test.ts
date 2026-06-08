// @vitest-environment jsdom
// src/notepad/bible/useDragResize.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import {
  clampFraction, fractionFromPointer, useDragResize,
  SPLIT_MIN, SPLIT_MAX, SPLIT_DEFAULT, SPLIT_STORAGE_KEY,
} from './useDragResize';

describe('clampFraction', () => {
  it('clamps below min and above max, passes through middle', () => {
    expect(clampFraction(0.05)).toBe(SPLIT_MIN);
    expect(clampFraction(0.95)).toBe(SPLIT_MAX);
    expect(clampFraction(0.5)).toBe(0.5);
  });

  it('falls back to the default for NaN', () => {
    expect(clampFraction(NaN)).toBe(SPLIT_DEFAULT);
  });
});

describe('fractionFromPointer', () => {
  it('grows the chat fraction as the pointer moves up (smaller Y)', () => {
    // container top=0, height=100; chat is the bottom pane → fraction = (bottom - y) / height
    expect(fractionFromPointer(30, 0, 100)).toBeCloseTo(0.7);
    expect(fractionFromPointer(70, 0, 100)).toBeCloseTo(0.3);
  });

  it('clamps to [min, max]', () => {
    expect(fractionFromPointer(5, 0, 100)).toBe(SPLIT_MAX);   // 0.95 → 0.8
    expect(fractionFromPointer(95, 0, 100)).toBe(SPLIT_MIN);  // 0.05 → 0.2
  });

  it('respects a non-zero container top', () => {
    expect(fractionFromPointer(130, 100, 100)).toBeCloseTo(0.7); // (200 - 130) / 100
  });

  it('returns the default when the container has no height', () => {
    expect(fractionFromPointer(10, 0, 0)).toBe(SPLIT_DEFAULT);
  });
});

function makeContainer(top: number, height: number): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON() {} }),
  });
  document.body.appendChild(el);
  return el;
}

describe('useDragResize', () => {
  beforeEach(() => { localStorage.clear(); document.body.innerHTML = ''; });

  it('seeds the initial fraction from localStorage', () => {
    localStorage.setItem(SPLIT_STORAGE_KEY, '0.65');
    const { result } = renderHook(() => useDragResize(useRef<HTMLDivElement | null>(null)));
    expect(result.current.fraction).toBeCloseTo(0.65);
  });

  it('defaults to 0.5 when nothing is stored', () => {
    const { result } = renderHook(() => useDragResize(useRef<HTMLDivElement | null>(null)));
    expect(result.current.fraction).toBe(SPLIT_DEFAULT);
  });

  it('updates the fraction while dragging and persists only on pointer up', () => {
    const el = makeContainer(0, 100);
    const { result } = renderHook(() => useDragResize(useRef<HTMLDivElement | null>(el)));

    act(() => { result.current.handleProps.onPointerDown({ preventDefault() {} } as never); });
    act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientY: 25 })); });
    expect(result.current.fraction).toBeCloseTo(0.75);          // (100 - 25) / 100
    expect(localStorage.getItem(SPLIT_STORAGE_KEY)).toBeNull(); // not persisted mid-drag

    act(() => { window.dispatchEvent(new MouseEvent('pointerup')); });
    expect(localStorage.getItem(SPLIT_STORAGE_KEY)).toBe(String(result.current.fraction));
  });

  it('reset() returns to the default and persists it', () => {
    localStorage.setItem(SPLIT_STORAGE_KEY, '0.7');
    const { result } = renderHook(() => useDragResize(useRef<HTMLDivElement | null>(null)));
    act(() => { result.current.reset(); });
    expect(result.current.fraction).toBe(SPLIT_DEFAULT);
    expect(localStorage.getItem(SPLIT_STORAGE_KEY)).toBe(String(SPLIT_DEFAULT));
  });
});
