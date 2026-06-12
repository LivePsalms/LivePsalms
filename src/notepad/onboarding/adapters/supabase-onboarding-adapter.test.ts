import { describe, it, expect, vi } from 'vitest';
import { SupabaseOnboardingAdapter } from './supabase-onboarding-adapter';
import { defaultAccountProgress } from '../onboarding-types';

function fakeClient(row: unknown) {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const eqSelect = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq: eqSelect }));
  const eqUpdate = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: eqUpdate }));
  const from = vi.fn(() => ({ select, update }));
  return { client: { from } as any, from, select, update, eqUpdate };
}

describe('SupabaseOnboardingAdapter', () => {
  it('reads onboarding_progress for the user', async () => {
    const p = { ...defaultAccountProgress(), guidedNote: 'skipped' as const };
    const f = fakeClient({ onboarding_progress: p });
    const a = new SupabaseOnboardingAdapter(f.client, 'u1');
    expect(await a.getProgress()).toEqual(p);
    expect(f.from).toHaveBeenCalledWith('profiles');
    expect(f.select).toHaveBeenCalledWith('onboarding_progress');
  });

  it('returns null when the column is empty', async () => {
    const f = fakeClient({ onboarding_progress: null });
    expect(await new SupabaseOnboardingAdapter(f.client, 'u1').getProgress()).toBeNull();
  });

  it('writes the column via update().eq(id)', async () => {
    const f = fakeClient({ onboarding_progress: null });
    const a = new SupabaseOnboardingAdapter(f.client, 'u1');
    const p = defaultAccountProgress();
    await a.saveProgress(p);
    expect(f.update).toHaveBeenCalledWith({ onboarding_progress: p });
    expect(f.eqUpdate).toHaveBeenCalledWith('id', 'u1');
  });
});
