import { describe, it, expect } from 'vitest';
import { extractTags, formatTag, matchTags } from './tags';

// ---------------------------------------------------------------------------
// matchTags
// ---------------------------------------------------------------------------

describe('matchTags', () => {
  it('returns [] for text with no hash tokens', () => {
    expect(matchTags('just some plain prose')).toEqual([]);
  });

  it('yields raw (#-prefixed), value (bare), and index for one match', () => {
    expect(matchTags('a thought about #hope')).toEqual([
      { raw: '#hope', value: 'hope', index: 16 },
    ]);
  });

  it('yields every occurrence in order, WITHOUT deduplicating', () => {
    expect(matchTags('#hope and again #hope')).toEqual([
      { raw: '#hope', value: 'hope', index: 0 },
      { raw: '#hope', value: 'hope', index: 16 },
    ]);
  });

  it('reports indices that map to the exact substring', () => {
    const text = '#faith and #love';
    for (const m of matchTags(text)) {
      expect(text.slice(m.index, m.index + m.raw.length)).toBe(m.raw);
    }
  });

  it('does not match a bare # with no word characters', () => {
    expect(matchTags('this # is alone')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractTags
// ---------------------------------------------------------------------------

describe('extractTags', () => {
  it('returns [] for plain text with no hash tokens', () => {
    expect(extractTags('just some plain prose')).toEqual([]);
  });

  it('returns [] for empty string', () => {
    expect(extractTags('')).toEqual([]);
  });

  it('extracts a single tag WITHOUT the leading #', () => {
    expect(extractTags('a thought about #hope')).toEqual(['hope']);
  });

  it('extracts multiple tags in order, all without the # marker', () => {
    expect(extractTags('#faith and #hope and #love')).toEqual([
      'faith',
      'hope',
      'love',
    ]);
  });

  it('deduplicates repeated tags', () => {
    expect(extractTags('#hope and again #hope')).toEqual(['hope']);
  });

  it('matches numeric word characters too', () => {
    // Documented: `#\\w+` matches `#1234` like a tag. The `tagMark` extension
    // now builds its RegExps from the same `TAG_PATTERN_SOURCE`, so decoration
    // and persistence share this behavior by construction.
    expect(extractTags('issue #1234 raised')).toEqual(['1234']);
  });

  it('does not match a bare # with no word characters', () => {
    expect(extractTags('this # is alone')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// formatTag
// ---------------------------------------------------------------------------

describe('formatTag', () => {
  it('prefixes a clean tag with #', () => {
    expect(formatTag('hope')).toBe('#hope');
  });

  it('does not double-prefix a legacy `#`-stored tag', () => {
    expect(formatTag('#hope')).toBe('#hope');
  });

  it('strips multiple leading #s defensively', () => {
    expect(formatTag('##hope')).toBe('#hope');
    expect(formatTag('###hope')).toBe('#hope');
  });

  it('preserves the rest of the value as-is (verse-ref tags, spaces, etc.)', () => {
    expect(formatTag('Romans 8:28')).toBe('#Romans 8:28');
    expect(formatTag('1 Peter 5:7')).toBe('#1 Peter 5:7');
  });

  it('handles an empty input', () => {
    expect(formatTag('')).toBe('#');
  });
});
