import { describe, it, expect } from 'vitest';
import { extractTags, formatTag } from './tags';

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
    // Documented: `#\\w+` matches `#1234` like a tag — preserved from prior
    // behavior. Alignment with the `tagMark` extension is a future deepening.
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
