import type { AccountProgress } from '../onboarding-types';

export interface OnboardingProgressAdapter {
  getProgress(): Promise<AccountProgress | null>;
  saveProgress(progress: AccountProgress): Promise<void>;
}
