import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { OnboardingProgressAdapter } from './adapters/types';
import { LocalOnboardingAdapter } from './adapters/local-onboarding-adapter';
import { SupabaseOnboardingAdapter } from './adapters/supabase-onboarding-adapter';

/** Account-progress adapter selection, mirroring useBibleHighlights.
 *  Returns null when there is no signed-in user (anonymous lane uses localStorage helpers). */
export function useOnboardingAdapter(userId: string | null): OnboardingProgressAdapter | null {
  return useMemo(() => {
    if (!userId) return null;
    if (supabase) return new SupabaseOnboardingAdapter(supabase, userId);
    return new LocalOnboardingAdapter(userId);
  }, [userId]);
}
