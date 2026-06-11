// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppShellLock } from './useAppShellLock';

const LOCK_CLASS = 'app-shell-locked';

afterEach(() => {
  document.documentElement.classList.remove(LOCK_CLASS);
});

describe('useAppShellLock', () => {
  it('adds the lock class when locked is true', () => {
    renderHook(() => useAppShellLock(true));
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(true);
  });

  it('does not add the class when locked is false', () => {
    renderHook(() => useAppShellLock(false));
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(false);
  });

  it('removes the class on unmount', () => {
    const { unmount } = renderHook(() => useAppShellLock(true));
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(false);
  });

  it('removes the class when locked flips to false', () => {
    const { rerender } = renderHook(({ locked }) => useAppShellLock(locked), {
      initialProps: { locked: true },
    });
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(true);
    rerender({ locked: false });
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(false);
  });

  it('adds the class when locked flips from false to true', () => {
    const { rerender } = renderHook(({ locked }) => useAppShellLock(locked), {
      initialProps: { locked: false },
    });
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(false);
    rerender({ locked: true });
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(true);
  });
});
