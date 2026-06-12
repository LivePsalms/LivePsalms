// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalOnboardingAdapter } from './local-onboarding-adapter';
import { defaultAccountProgress } from '../onboarding-types';

describe('LocalOnboardingAdapter', () => {
  beforeEach(() => localStorage.clear());

  it('returns null before anything is saved', async () => {
    const a = new LocalOnboardingAdapter('u1');
    expect(await a.getProgress()).toBeNull();
  });

  it('saves and reloads progress scoped by user id', async () => {
    const a = new LocalOnboardingAdapter('u1');
    const p = { ...defaultAccountProgress(), guidedNote: 'done' as const };
    await a.saveProgress(p);
    expect(await a.getProgress()).toEqual(p);
    // different user is isolated
    expect(await new LocalOnboardingAdapter('u2').getProgress()).toBeNull();
  });
});
