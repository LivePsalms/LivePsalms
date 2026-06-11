import { describe, it, expect } from 'vitest';
import { generateUsername } from './username-generate';
import { validateUsername } from './username-rules';

describe('generateUsername', () => {
  it('always produces a name that passes validateUsername', () => {
    for (let i = 0; i < 500; i++) {
      const name = generateUsername();
      expect(validateUsername(name).valid, `invalid: ${name}`).toBe(true);
    }
  });

  it('matches the adjective_noun_digits shape', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateUsername()).toMatch(/^[a-z]+_[a-z]+_\d{4}$/);
    }
  });

  it('produces variety across calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(generateUsername());
    expect(seen.size).toBeGreaterThan(1);
  });
});
