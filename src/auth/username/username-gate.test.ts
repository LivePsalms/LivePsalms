import { describe, it, expect } from 'vitest';
import { computeUsernameGate } from './username-gate';

describe('computeUsernameGate', () => {
  it('is loading while the session resolves', () => {
    expect(
      computeUsernameGate({ sessionLoading: true, hasUser: false, profileStatus: 'missing', username: null }),
    ).toEqual({ kind: 'loading' });
  });

  it('is signed-out when there is no user', () => {
    expect(
      computeUsernameGate({ sessionLoading: false, hasUser: false, profileStatus: 'missing', username: null }),
    ).toEqual({ kind: 'signed-out' });
  });

  it('is loading while the profile loads', () => {
    expect(
      computeUsernameGate({ sessionLoading: false, hasUser: true, profileStatus: 'loading', username: null }),
    ).toEqual({ kind: 'loading' });
  });

  it('needs-username when loaded with no username', () => {
    expect(
      computeUsernameGate({ sessionLoading: false, hasUser: true, profileStatus: 'loaded', username: null }),
    ).toEqual({ kind: 'needs-username' });
  });

  it('is ready when loaded with a username', () => {
    expect(
      computeUsernameGate({ sessionLoading: false, hasUser: true, profileStatus: 'loaded', username: 'natalie' }),
    ).toEqual({ kind: 'ready', username: 'natalie' });
  });

  it('treats a transient missing/error profile as loading (row exists via trigger)', () => {
    expect(
      computeUsernameGate({ sessionLoading: false, hasUser: true, profileStatus: 'missing', username: null }).kind,
    ).toBe('loading');
    expect(
      computeUsernameGate({ sessionLoading: false, hasUser: true, profileStatus: 'error', username: null }).kind,
    ).toBe('loading');
  });
});
