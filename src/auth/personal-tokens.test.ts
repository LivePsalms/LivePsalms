import { describe, it, expect, vi } from 'vitest';
import { hashToken, generateRawToken, createToken, revokeToken } from './personal-tokens';

describe('hashToken parity', () => {
  it('matches the shared known-answer vector (must equal the edge helper)', async () => {
    expect(await hashToken('psalms-pat-known-answer'))
      .toBe('68aa6ef08e25170d27d3c4eb88e5184308cb467ab708be62bdb503ad89c9d359');
  });
});

describe('generateRawToken', () => {
  it('has the psalms_pat_ prefix and a url-safe body', () => {
    const t = generateRawToken();
    expect(t.startsWith('psalms_pat_')).toBe(true);
    expect(t.slice('psalms_pat_'.length)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('is unique across calls', () => {
    expect(generateRawToken()).not.toBe(generateRawToken());
  });
});

describe('createToken', () => {
  it('stores only the hash and returns the raw token', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const client = { from: () => ({ insert }) } as never;
    const raw = await createToken(client, 'u-1', 'My Shortcut');
    expect(raw.startsWith('psalms_pat_')).toBe(true);
    const row = insert.mock.calls[0][0];
    expect(row.user_id).toBe('u-1');
    expect(row.token_hash).toBe(await hashToken(raw));
    expect(JSON.stringify(row)).not.toContain(raw); // raw never persisted
  });
});

describe('revokeToken', () => {
  it('sets revoked_at on the row', async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const client = { from: () => ({ update }) } as never;
    await revokeToken(client, 'tok-1');
    expect(update.mock.calls[0][0]).toHaveProperty('revoked_at');
    expect(eq).toHaveBeenCalledWith('id', 'tok-1');
  });
});
