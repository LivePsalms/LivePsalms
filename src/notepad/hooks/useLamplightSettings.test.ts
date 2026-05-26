// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { FakeLamplightAdapter } from '../storage/fake-lamplight-adapter';
import { useLamplightSettings } from './useLamplightSettings';

describe('useLamplightSettings', () => {
  let adapter: FakeLamplightAdapter;

  beforeEach(() => {
    adapter = new FakeLamplightAdapter();
  });

  it('returns isLoading=true initially then settings=null when no row', async () => {
    const { result } = renderHook(() => useLamplightSettings({ adapter, userId: 'user-1' }));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings).toBeNull();
  });

  it('returns existing settings when the row exists', async () => {
    await adapter.upsertSettings('user-1', { enabled: true, voicePreference: 'Father' });
    const { result } = renderHook(() => useLamplightSettings({ adapter, userId: 'user-1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings?.enabled).toBe(true);
    expect(result.current.settings?.voicePreference).toBe('Father');
  });

  it('upsert mutates the row and updates state', async () => {
    const { result } = renderHook(() => useLamplightSettings({ adapter, userId: 'user-1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.upsert({ enabled: true, voicePreference: 'Abba' });
    });
    expect(result.current.settings?.enabled).toBe(true);
    expect(result.current.settings?.voicePreference).toBe('Abba');
  });

  it('deleteAll removes the row and resets settings to null', async () => {
    await adapter.upsertSettings('user-1', { enabled: true });
    const { result } = renderHook(() => useLamplightSettings({ adapter, userId: 'user-1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.deleteAll();
    });
    expect(result.current.settings).toBeNull();
    expect(adapter.deleteAllUserDataCalls).toEqual(['user-1']);
  });

  it('returns settings=null + isLoading=false when userId is null (anonymous)', async () => {
    const { result } = renderHook(() => useLamplightSettings({ adapter, userId: null }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings).toBeNull();
  });
});
