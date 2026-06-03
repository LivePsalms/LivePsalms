import { describe, it, expect } from 'vitest';
import { normalizeUsername, validateUsername, RESERVED_USERNAMES } from './username-rules';

describe('normalizeUsername', () => {
  it('trims and lowercases', () => {
    expect(normalizeUsername('  Natalie  ')).toBe('natalie');
  });
});

describe('validateUsername', () => {
  it('accepts a simple valid name', () => {
    expect(validateUsername('natalie')).toEqual({ valid: true });
  });

  it('accepts letters, numbers, underscores within length', () => {
    expect(validateUsername('quiet_cedar_42')).toEqual({ valid: true });
  });

  it('normalizes case before validating', () => {
    expect(validateUsername('Natalie')).toEqual({ valid: true });
  });

  it('rejects fewer than 3 characters', () => {
    const r = validateUsername('ab');
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/at least 3/i);
  });

  it('rejects more than 30 characters', () => {
    const r = validateUsername('a'.repeat(31));
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/30 characters/i);
  });

  it('rejects disallowed characters', () => {
    const r = validateUsername('has space');
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/lowercase letters, numbers/i);
  });

  it('rejects hyphens', () => {
    expect(validateUsername('no-hyphens').valid).toBe(false);
  });

  it('rejects reserved words', () => {
    for (const word of RESERVED_USERNAMES) {
      expect(validateUsername(word).valid).toBe(false);
    }
  });

  it('accepts exactly 3 characters', () => {
    expect(validateUsername('abc')).toEqual({ valid: true });
  });

  it('accepts exactly 30 characters', () => {
    expect(validateUsername('a'.repeat(30))).toEqual({ valid: true });
  });

  it('rejects a known reserved word explicitly', () => {
    expect(validateUsername('admin').valid).toBe(false);
  });
});
