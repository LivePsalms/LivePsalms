import { describe, it, expect } from 'vitest';
import { highlightBackgroundStyle } from './style-highlight';

describe('highlightBackgroundStyle', () => {
  it('stretches the swatch display image behind the text', () => {
    const style = highlightBackgroundStyle('/styles/highlight/highlight-60.webp');
    expect(style).toContain('background-image:url(/styles/highlight/highlight-60.webp)');
    expect(style).toContain('background-size:100% 100%');
    expect(style).toContain('background-repeat:no-repeat');
  });

  it('returns an empty string for a missing url', () => {
    expect(highlightBackgroundStyle(undefined)).toBe('');
  });
});
