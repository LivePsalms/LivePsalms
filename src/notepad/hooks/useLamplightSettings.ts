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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
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
      const row = await adapter.getSettings(userId);
      if (cancelled || !mountedRef.current) return;
      setSettings(row);
      setIsLoading(false);
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
    const row = await adapter.getSettings(userId);
    if (mountedRef.current) {
      setSettings(row);
      setIsLoading(false);
    }
  }, [adapter, userId]);

  const upsert = useCallback(
    async (patch: Partial<Omit<LamplightSettings, 'userId' | 'createdAt' | 'updatedAt'>>) => {
      if (!userId) return;
      const next = await adapter.upsertSettings(userId, patch);
      if (mountedRef.current) setSettings(next);
    },
    [adapter, userId]
  );

  const deleteAll = useCallback(async () => {
    if (!userId) return;
    await adapter.deleteAllUserData(userId);
    if (mountedRef.current) setSettings(null);
  }, [adapter, userId]);

  return { isLoading, settings, refetch, upsert, deleteAll };
}
