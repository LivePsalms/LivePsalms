import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountProgress } from '../onboarding-types';
import type { OnboardingProgressAdapter } from './types';

export class SupabaseOnboardingAdapter implements OnboardingProgressAdapter {
  #client: SupabaseClient;
  #userId: string;
  constructor(client: SupabaseClient, userId: string) {
    this.#client = client;
    this.#userId = userId;
  }
  async getProgress(): Promise<AccountProgress | null> {
    const { data, error } = await this.#client
      .from('profiles')
      .select('onboarding_progress')
      .eq('id', this.#userId)
      .single();
    if (error) throw error;
    return (data?.onboarding_progress as AccountProgress | null) ?? null;
  }
  async saveProgress(progress: AccountProgress): Promise<void> {
    const { error } = await this.#client
      .from('profiles')
      .update({ onboarding_progress: progress })
      .eq('id', this.#userId);
    if (error) throw error;
  }
}
