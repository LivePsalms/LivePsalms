import { describe, it, expect } from 'vitest';
import { getPasswordCapability } from './passwordCapability';

describe('getPasswordCapability', () => {
  it('email-only account can change password', () => {
    expect(getPasswordCapability({ app_metadata: { providers: ['email'] } }))
      .toEqual({ canChange: true, managedBy: null });
  });

  it('google+email account can change password', () => {
    expect(getPasswordCapability({ app_metadata: { providers: ['email', 'google'] } }))
      .toEqual({ canChange: true, managedBy: null });
  });

  it('google-only account is managed by Google', () => {
    expect(getPasswordCapability({ app_metadata: { providers: ['google'] } }))
      .toEqual({ canChange: false, managedBy: 'Google' });
  });

  it('apple-only account is managed by Apple', () => {
    expect(getPasswordCapability({ app_metadata: { providers: ['apple'] } }))
      .toEqual({ canChange: false, managedBy: 'Apple' });
  });

  it('falls back to "your linked account" when no known provider', () => {
    expect(getPasswordCapability({ app_metadata: { providers: ['azure'] } }))
      .toEqual({ canChange: false, managedBy: 'your linked account' });
  });

  it('handles missing/empty metadata safely', () => {
    expect(getPasswordCapability(null)).toEqual({ canChange: false, managedBy: 'your linked account' });
    expect(getPasswordCapability({})).toEqual({ canChange: false, managedBy: 'your linked account' });
    expect(getPasswordCapability({ app_metadata: {} })).toEqual({ canChange: false, managedBy: 'your linked account' });
  });
});
