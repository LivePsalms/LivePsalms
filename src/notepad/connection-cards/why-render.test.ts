import { describe, it, expect } from 'vitest';
import { prefixWhyWithName } from './why-render';

describe('prefixWhyWithName', () => {
  it('prepends "<First> — " when firstName is non-null', () => {
    expect(prefixWhyWithName('both notes circle the question of rest.', 'Sarah'))
      .toBe('Sarah — both notes circle the question of rest.');
  });

  it('returns the bare why when firstName is null', () => {
    expect(prefixWhyWithName('both notes circle the question of rest.', null))
      .toBe('both notes circle the question of rest.');
  });

  it('handles empty why string (returns prefix only when name present)', () => {
    expect(prefixWhyWithName('', 'Sarah')).toBe('Sarah — ');
  });

  it('handles empty why string with null name', () => {
    expect(prefixWhyWithName('', null)).toBe('');
  });
});
