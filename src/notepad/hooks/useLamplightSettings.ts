import { useEffect, useState, useCallback, useRef } from 'react';
import type { LamplightAdapter, LamplightSettings } from '../storage/lamplight-adapter';

export interface UseLamplightSettingsArgs {
  adapter: LamplightAdapter;
  userId: string | null;
}

export interface UseLamplightSettingsResult {
  isLoading: boolean;
  settings: LamplightSettings | null;
  refetch: () => Promise<void>;
  upsert: (patch: Partial<Omit<LamplightSettings, 'userId' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteAll: () => Promise<void>;
}

export function useLamplightSettings({
  adapter,
  userId,
}: UseLamplightSettingsArgs): UseLamplightSettingsResult {
  const [settings, setSettings] = useState<LamplightSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) {
        if (!cancelled) {
          setSettings(null);
          setIsLoading(false);
        }
        return;
      }
      try {
        const row = await adapter.getSettings(userId);
        if (cancelled || !mountedRef.current) return;
        setSettings(row);
      } catch (err) {
        console.error('[lamplight] getSettings failed', err);
        if (cancelled || !mountedRef.current) return;
        // Leave settings at its current value (null on first load, or stale on refetch).
      } finally {
        if (!cancelled && mountedRef.current) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, userId]);

  const refetch = useCallback(async () => {
    if (!userId) {
      setSettings(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const row = await adapter.getSettings(userId);
      if (mountedRef.current) setSettings(row);
    } catch (err) {
      console.error('[lamplight] getSettings failed', err);
      // Leave settings at its current value (null on first load, or stale on refetch).
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [adapter, userId]);

  const upsert = useCallback(
    async (patch: Partial<Omit<LamplightSettings, 'userId' | 'createdAt' | 'updatedAt'>>) => {
      if (!userId) return;
      try {
        const next = await adapter.upsertSettings(userId, patch);
        if (mountedRef.current) setSettings(next);
      } catch (err) {
        console.error('[lamplight] upsertSettings failed', err);
        throw err;
      }
    },
    [adapter, userId]
  );

  const deleteAll = useCallback(async () => {
    if (!userId) return;
    try {
      await adapter.deleteAllUserData(userId);
      if (mountedRef.current) setSettings(null);
    } catch (err) {
      console.error('[lamplight] deleteAllUserData failed', err);
      throw err;
    }
  }, [adapter, userId]);

  return { isLoading, settings, refetch, upsert, deleteAll };
}
