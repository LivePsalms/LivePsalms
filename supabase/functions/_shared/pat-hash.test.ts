import { describe, it, expect } from 'vitest';
import { hashToken } from './pat-hash';

describe('hashToken', () => {
  it('produces the known SHA-256 hex (parity vector)', async () => {
    expect(await hashToken('psalms-pat-known-answer'))
      .toBe('68aa6ef08e25170d27d3c4eb88e5184308cb467ab708be62bdb503ad89c9d359');
  });

  it('is deterministic and differs by input', async () => {
    expect(await hashToken('a')).toBe(await hashToken('a'));
    expect(await hashToken('a')).not.toBe(await hashToken('b'));
  });
});
