import { useEffect, useRef, useState } from 'react';
import { getTierForCount, getNextTier } from '../gamification/tiers';
import type { Tier } from '../gamification/tiers';

interface UseUserTierResult {
  currentTier: Tier;
  nextTier: Tier | null;
  showLevelUp: boolean;
  levelUpTier: Tier | null;
  dismissLevelUp: () => void;
}

export function useUserTier(highestNoteCount: number): UseUserTierResult {
  const prevTierRef = useRef<Tier | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpTier, setLevelUpTier] = useState<Tier | null>(null);
  const initializedRef = useRef(false);

  const currentTier = getTierForCount(highestNoteCount);
  const nextTier = getNextTier(highestNoteCount);

  useEffect(() => {
    // Don't trigger level-up on initial load
    if (!initializedRef.current) {
      prevTierRef.current = currentTier;
      initializedRef.current = true;
      return;
    }

    // Check if tier changed upward
    const prevThreshold = prevTierRef.current?.threshold ?? 0;
    const currentThreshold = currentTier.threshold;

    if (currentThreshold > prevThreshold) {
      setLevelUpTier(currentTier);
      setShowLevelUp(true);
    }

    prevTierRef.current = currentTier;
  }, [currentTier]);

  const dismissLevelUp = () => {
    setShowLevelUp(false);
    setLevelUpTier(null);
  };

  return { currentTier, nextTier, showLevelUp, levelUpTier, dismissLevelUp };
}
