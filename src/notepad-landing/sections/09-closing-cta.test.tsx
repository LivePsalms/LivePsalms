// src/notepad-landing/sections/09-closing-cta.test.tsx
// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClosingCTA } from './09-closing-cta';

// IntersectionObserver isn't implemented in jsdom; stub it so the staged
// effect never fires and the dynamic three.js particle import is skipped.
beforeEach(() => {
  window.IntersectionObserver = vi.fn().mockImplementation(function () {
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };
  }) as unknown as typeof IntersectionObserver;
});

afterEach(cleanup);

function renderCTA() {
  return render(
    <MemoryRouter>
      <ClosingCTA prm={true} />
    </MemoryRouter>,
  );
}

describe('<ClosingCTA />', () => {
  it('wraps the heading and subtitle in .closing-text-block', () => {
    renderCTA();
    const block = document.querySelector('.closing-text-block');
    expect(block).not.toBeNull();
    expect(block?.querySelector('#sec09-h2')).not.toBeNull();
    expect(block?.querySelector('.closing-sub')).not.toBeNull();
  });

  it('keeps both CTAs outside .closing-text-block (siblings, not children)', () => {
    renderCTA();
    const block = document.querySelector('.closing-text-block');
    const primary = document.querySelector('.closing-cta-primary');
    const secondary = document.querySelector('.closing-cta-secondary');
    expect(primary).not.toBeNull();
    expect(secondary).not.toBeNull();
    expect(block?.contains(primary!)).toBe(false);
    expect(block?.contains(secondary!)).toBe(false);
  });
});
