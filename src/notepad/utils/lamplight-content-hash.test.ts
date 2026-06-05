import { describe, it, expect } from 'vitest';
import { lamplightContentHash } from './lamplight-content-hash';

describe('lamplightContentHash', () => {
  it('returns a 64-char hex sha256', () => {
    const h = lamplightContentHash('hello world');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });

  it('is deterministic across calls', () => {
    expect(lamplightContentHash('abc')).toBe(lamplightContentHash('abc'));
  });

  it('differs for differing inputs', () => {
    expect(lamplightContentHash('a')).not.toBe(lamplightContentHash('b'));
  });

  it('handles empty string', () => {
    expect(lamplightContentHash('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });
});
