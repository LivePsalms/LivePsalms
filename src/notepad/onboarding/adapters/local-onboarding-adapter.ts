import type { AccountProgress } from '../onboarding-types';
import type { OnboardingProgressAdapter } from './types';

const keyFor = (userId: string) => `onboarding_account_progress_${userId}`;

/** localStorage-backed account progress. Used offline, and as the retry cache
 *  when the Supabase write path is unavailable (spec: degrade silently). */
export class LocalOnboardingAdapter implements OnboardingProgressAdapter {
  #key: string;
  constructor(userId: string) {
    this.#key = keyFor(userId);
  }
  async getProgress(): Promise<AccountProgress | null> {
    try {
      const raw = localStorage.getItem(this.#key);
      return raw ? (JSON.parse(raw) as AccountProgress) : null;
    } catch {
      return null;
    }
  }
  async saveProgress(progress: AccountProgress): Promise<void> {
    try {
      localStorage.setItem(this.#key, JSON.stringify(progress));
    } catch {
      /* ignore */
    }
  }
}
