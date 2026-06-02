// @vitest-environment jsdom
import { render, cleanup, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useKeyboardInset } from './useKeyboardInset';

afterEach(cleanup);

function Probe() {
  const inset = useKeyboardInset();
  return <div data-testid="inset">{inset}</div>;
}

describe('useKeyboardInset', () => {
  let listeners: Record<string, () => void>;
  beforeEach(() => {
    listeners = {};
    // window.innerHeight is 768 in jsdom by default; set explicitly.
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    // Fake visualViewport.
    (window as unknown as { visualViewport: unknown }).visualViewport = {
      height: 800,
      offsetTop: 0,
      addEventListener: (ev: string, cb: () => void) => {
        listeners[ev] = cb;
      },
      removeEventListener: () => {},
    };
  });

  it('returns 0 when the keyboard is closed', () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('inset').textContent).toBe('0');
  });

  it('returns the covered height when the viewport shrinks (keyboard open)', () => {
    const { getByTestId } = render(<Probe />);
    act(() => {
      (window as unknown as { visualViewport: { height: number } }).visualViewport.height = 500;
      listeners['resize']?.();
    });
    expect(getByTestId('inset').textContent).toBe('300');
  });
});
