// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { FakeLamplightAdapter } from '../storage/fake-lamplight-adapter';
import { useLamplightEntitlement } from './useLamplightEntitlement';

describe('useLamplightEntitlement', () => {
  let adapter: FakeLamplightAdapter;

  beforeEach(() => {
    adapter = new FakeLamplightAdapter();
    adapter.promo = { promoActive: true, promoEndsAt: null };
  });

  it('hasAccess() returns true for every feature while promo is active', async () => {
    const { result } = renderHook(() => useLamplightEntitlement({ adapter, userId: 'user-1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.promoActive).toBe(true);
    expect(result.current.hasAccess('today')).toBe(true);
    expect(result.current.hasAccess('weekly')).toBe(true);
    expect(result.current.hasAccess('reflections')).toBe(true);
    expect(result.current.hasAccess('inline')).toBe(true);
  });

  it('hasAccess() returns true for all features when tier=plus and promo off', async () => {
    adapter.promo = { promoActive: false, promoEndsAt: null };
    await adapter.upsertSettings('user-1', {});
    adapter.entitlements.set('user-1', {
      userId: 'user-1', tier: 'plus', source: 'subscription',
      grantedAt: '2026-05-25T00:00:00Z', expiresAt: null,
    });
    const { result } = renderHook(() => useLamplightEntitlement({ adapter, userId: 'user-1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasAccess('today')).toBe(true);
    expect(result.current.hasAccess('reflections')).toBe(true);
  });

  it('hasAccess() returns true only for today+weekly when tier=lite', async () => {
    adapter.promo = { promoActive: false, promoEndsAt: null };
    adapter.entitlements.set('user-1', {
      userId: 'user-1', tier: 'lite', source: 'subscription',
      grantedAt: '2026-05-25T00:00:00Z', expiresAt: null,
    });
    const { result } = renderHook(() => useLamplightEntitlement({ adapter, userId: 'user-1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasAccess('today')).toBe(true);
    expect(result.current.hasAccess('weekly')).toBe(true);
    expect(result.current.hasAccess('reflections')).toBe(false);
    expect(result.current.hasAccess('inline')).toBe(false);
  });

  it('hasAccess() returns false for every feature when tier=none and promo off', async () => {
    adapter.promo = { promoActive: false, promoEndsAt: null };
    const { result } = renderHook(() => useLamplightEntitlement({ adapter, userId: 'user-1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tier).toBe('none');
    expect(result.current.hasAccess('today')).toBe(false);
    expect(result.current.hasAccess('weekly')).toBe(false);
    expect(result.current.hasAccess('reflections')).toBe(false);
  });
});
