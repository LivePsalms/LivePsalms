import { describe, it, expect } from 'vitest';
import { bearerToken, deriveUserId, type AuthClient } from './auth-identity';

const reqWith = (auth?: string) => ({ headers: { get: (n: string) => (n === 'Authorization' ? auth ?? null : null) } });
const clientReturning = (result: { data: { user: { id: string } | null }; error: unknown }): AuthClient =>
  ({ auth: { getUser: async () => result } });

describe('bearerToken', () => {
  it('strips the Bearer prefix (case-insensitive)', () => {
    expect(bearerToken(reqWith('Bearer abc.def'))).toBe('abc.def');
    expect(bearerToken(reqWith('bearer xyz'))).toBe('xyz');
  });
  it('returns empty string when no header', () => {
    expect(bearerToken(reqWith(undefined))).toBe('');
  });
});

describe('deriveUserId', () => {
  it('returns the user id for a valid token', async () => {
    const id = await deriveUserId(clientReturning({ data: { user: { id: 'u-123' } }, error: null }), 'tok');
    expect(id).toBe('u-123');
  });
  it('returns null on auth error', async () => {
    const id = await deriveUserId(clientReturning({ data: { user: null }, error: { message: 'bad jwt' } }), 'tok');
    expect(id).toBeNull();
  });
  it('returns null when token is empty (no auth call)', async () => {
    let called = false;
    const client: AuthClient = { auth: { getUser: async () => { called = true; return { data: { user: null }, error: null }; } } };
    const id = await deriveUserId(client, '');
    expect(id).toBeNull();
    expect(called).toBe(false);
  });
});
