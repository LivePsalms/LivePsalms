// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ConnectionCardsLoading } from './ConnectionCardsLoading';

afterEach(cleanup);

describe('ConnectionCardsLoading', () => {
  it('renders the reading-this-note copy with status role', () => {
    render(<ConnectionCardsLoading />);
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/Lamplight is reading this note/i);
  });

  it('has motion-reduce class on the pulsing glyph', () => {
    const { container } = render(<ConnectionCardsLoading />);
    const glyph = container.querySelector('[aria-hidden]');
    expect(glyph?.className).toMatch(/motion-reduce:animate-none/);
  });
});
