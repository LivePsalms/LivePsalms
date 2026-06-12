import { describe, it, expect } from 'vitest';
import { appendStudyDate, hasThreeConsecutiveDays } from './streak';

describe('appendStudyDate', () => {
  it('adds a new date and keeps the list sorted ascending', () => {
    expect(appendStudyDate(['2026-06-10'], '2026-06-09')).toEqual(['2026-06-09', '2026-06-10']);
  });
  it('is idempotent for a date already present', () => {
    expect(appendStudyDate(['2026-06-10'], '2026-06-10')).toEqual(['2026-06-10']);
  });
  it('returns a new array (no mutation)', () => {
    const input = ['2026-06-10'];
    appendStudyDate(input, '2026-06-11');
    expect(input).toEqual(['2026-06-10']);
  });
});

describe('hasThreeConsecutiveDays', () => {
  it('true for three consecutive calendar days', () => {
    expect(hasThreeConsecutiveDays(['2026-06-09', '2026-06-10', '2026-06-11'])).toBe(true);
  });
  it('true when a 3-run exists with extra non-adjacent dates', () => {
    expect(hasThreeConsecutiveDays(['2026-06-01', '2026-06-09', '2026-06-10', '2026-06-11'])).toBe(true);
  });
  it('false for a gap inside the window', () => {
    expect(hasThreeConsecutiveDays(['2026-06-09', '2026-06-11', '2026-06-12'])).toBe(false);
  });
  it('false for fewer than three dates', () => {
    expect(hasThreeConsecutiveDays(['2026-06-10', '2026-06-11'])).toBe(false);
  });
  it('handles month/year boundary', () => {
    expect(hasThreeConsecutiveDays(['2026-12-30', '2026-12-31', '2027-01-01'])).toBe(true);
  });
  it('ignores duplicate dates when counting the run', () => {
    expect(hasThreeConsecutiveDays(['2026-06-09', '2026-06-09', '2026-06-10', '2026-06-11'])).toBe(true);
  });
});
