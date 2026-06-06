import { describe, it, expect } from 'vitest';
import { categorize, slugify, IN_SCOPE_CATEGORIES } from './style-assets-lib.mjs';

describe('categorize', () => {
  it('maps each in-scope source folder to its category', () => {
    expect(categorize('1. Large Shapes')).toBe('shape');
    expect(categorize('2. Highlights & Boxes')).toBe('highlight');
    expect(categorize('3. Squiggles & Lines/Squiggles ')).toBe('squiggle');
    expect(categorize('3. Squiggles & Lines/Lines & Dividers')).toBe('line');
    expect(categorize('4. Arrows')).toBe('arrow');
    expect(categorize('5. Speech Bubbles')).toBe('bubble');
  });

  it('returns null for out-of-scope folders', () => {
    expect(categorize('6. Backgrounds')).toBeNull();
    expect(categorize('7. Papers/PNG Files')).toBeNull();
  });

  it('is tolerant of a trailing slash and trailing spaces', () => {
    expect(categorize('3. Squiggles & Lines/Squiggles /')).toBe('squiggle');
  });
});

describe('slugify', () => {
  it('lowercases, strips extension, and hyphenates', () => {
    expect(slugify('Arrow 12.png')).toBe('arrow-12');
    expect(slugify('Speech_Bubble (3).PNG')).toBe('speech-bubble-3');
  });

  it('prefixes the category so ids are globally unique', () => {
    expect(slugify('01.png', 'shape')).toBe('shape-01');
  });
});

describe('IN_SCOPE_CATEGORIES', () => {
  it('lists the six in-scope categories', () => {
    expect(IN_SCOPE_CATEGORIES).toEqual([
      'highlight', 'shape', 'arrow', 'bubble', 'squiggle', 'line',
    ]);
  });
});
