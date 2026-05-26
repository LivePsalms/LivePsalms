import { useEffect, useState, useCallback, useRef } from 'react';
import type { LamplightAdapter, LamplightTier } from '../storage/lamplight-adapter';

export type LamplightFeature = 'today' | 'weekly' | 'reflections' | 'inline';

export interface UseLamplightEntitlementArgs {
  adapter: LamplightAdapter;
  userId: string | null;
}

export interface UseLamplightEntitlementResult {
  isLoading: boolean;
  tier: LamplightTier;
  promoActive: boolean;
  hasAccess: (feature: LamplightFeature) => boolean;
}

export function useLamplightEntitlement({
  adapter,
  userId,
}: UseLamplightEntitlementArgs): UseLamplightEntitlementResult {
  const [tier, setTier] = useState<LamplightTier>('none');
  const [promoActive, setPromoActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const [promo, ent] = await Promise.all([
          adapter.getPromoConfig(),
          userId ? adapter.getEntitlement(userId) : Promise.resolve(null),
        ]);
        if (cancelled || !mountedRef.current) return;
        setPromoActive(promo.promoActive);
        setTier(ent?.tier ?? 'none');
      } catch (err) {
        console.error('[lamplight] entitlement load failed', err);
        if (cancelled || !mountedRef.current) return;
        // Leave previous state; fail closed (no access).
        setPromoActive(false);
        setTier('none');
      } finally {
        if (!cancelled && mountedRef.current) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, userId]);

  const hasAccess = useCallback(
    (feature: LamplightFeature) => {
      if (promoActive) return true;
      if (tier === 'plus') return true;
      if (tier === 'lite') return feature === 'today' || feature === 'weekly';
      return false;
    },
    [promoActive, tier]
  );

  return { isLoading, tier, promoActive, hasAccess };
}
