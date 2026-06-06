import { describe, it, expect } from 'vitest';
import { categorize, slugify, IN_SCOPE_CATEGORIES, buildManifestEntry, renderManifestModule } from './style-assets-lib.mjs';

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

describe('buildManifestEntry', () => {
  it('builds a StyleAsset with public URLs and aspect ratio', () => {
    const entry = buildManifestEntry({
      id: 'arrow-12',
      category: 'arrow',
      width: 800,
      height: 400,
    });
    expect(entry).toEqual({
      id: 'arrow-12',
      category: 'arrow',
      thumbUrl: '/styles/arrow/arrow-12.thumb.webp',
      displayUrl: '/styles/arrow/arrow-12.webp',
      aspectRatio: 2,
    });
  });
});

describe('renderManifestModule', () => {
  it('emits a typed module exporting STYLE_ASSETS', () => {
    const src = renderManifestModule([
      { id: 'shape-01', category: 'shape', thumbUrl: '/styles/shape/shape-01.thumb.webp', displayUrl: '/styles/shape/shape-01.webp', aspectRatio: 1 },
    ]);
    expect(src).toContain('export type StyleCategory =');
    expect(src).toContain('export const STYLE_ASSETS: StyleAsset[] =');
    expect(src).toContain('"id": "shape-01"');
    expect(src).toContain("export function getStyleAsset(id: string)");
  });
});
