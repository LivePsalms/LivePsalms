// supabase/functions/_shared/quota.ts
//
// Per-user (by tier) + global daily quota for billable Lamplight AI calls.
// Approach A from the Batch A security spec: count lamplight_usage rows in a
// rolling 24h window. No new infra. Accepts a small race-window overage under
// concurrency (documented in the spec) — acceptable for a spend cap.

import type { SupabaseClient } from '@supabase/supabase-js';

export type Tier = 'none' | 'lite' | 'plus';

export interface QuotaLimits {
  perUser: Record<Tier, number>;
  global: number;
}

const DEFAULT_LIMITS: QuotaLimits = {
  perUser: { none: 10, lite: 50, plus: 200 },
  global: 2000,
};

// Per-environment overrides without a code change. Invalid/missing → default.
export function resolveQuotaLimits(env: { get(key: string): string | undefined }): QuotaLimits {
  // A value of 0 is a valid, intentional override (disables a tier / sets a hard
  // zero ceiling). Only non-numeric or negative values fall back to the default.
  const num = (key: string, fallback: number): number => {
    const raw = env.get(key);
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    perUser: {
      none: num('LAMPLIGHT_QUOTA_NONE', DEFAULT_LIMITS.perUser.none),
      lite: num('LAMPLIGHT_QUOTA_LITE', DEFAULT_LIMITS.perUser.lite),
      plus: num('LAMPLIGHT_QUOTA_PLUS', DEFAULT_LIMITS.perUser.plus),
    },
    global: num('LAMPLIGHT_QUOTA_GLOBAL', DEFAULT_LIMITS.global),
  };
}

export interface QuotaDeps {
  getTier(userId: string): Promise<Tier>;
  countUserUsage(userId: string, sinceIso: string): Promise<number>;
  countGlobalUsage(sinceIso: string): Promise<number>;
}

export type QuotaResult =
  | { ok: true; tier: Tier; userUsed: number; userLimit: number }
  | { ok: false; reason: 'user_quota' | 'global_quota'; tier: Tier; userUsed: number; userLimit: number };

const DAY_MS = 24 * 60 * 60 * 1000;

export async function checkQuota(
  deps: QuotaDeps,
  limits: QuotaLimits,
  args: { userId: string; nowMs: number },
): Promise<QuotaResult> {
  const sinceIso = new Date(args.nowMs - DAY_MS).toISOString();
  const tier = await deps.getTier(args.userId);
  const userLimit = limits.perUser[tier];

  const userUsed = await deps.countUserUsage(args.userId, sinceIso);
  if (userUsed >= userLimit) {
    return { ok: false, reason: 'user_quota', tier, userUsed, userLimit };
  }

  const globalUsed = await deps.countGlobalUsage(sinceIso);
  if (globalUsed >= limits.global) {
    return { ok: false, reason: 'global_quota', tier, userUsed, userLimit };
  }

  return { ok: true, tier, userUsed, userLimit };
}

// Thin adapter from a Supabase client to QuotaDeps. Glue (not unit-tested),
// mirrors serviceClient()/VoyageDeps construction elsewhere in _shared.
export function supabaseQuotaDeps(client: SupabaseClient): QuotaDeps {
  return {
    async getTier(userId) {
      const { data } = await client
        .from('lamplight_entitlements')
        .select('tier')
        .eq('user_id', userId)
        .maybeSingle();
      const tier = data?.tier;
      return tier === 'lite' || tier === 'plus' ? tier : 'none';
    },
    async countUserUsage(userId, sinceIso) {
      const { count, error } = await client
        .from('lamplight_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', sinceIso);
      // Fail closed: a broken quota check must block, never silently allow.
      if (error) throw new Error(`quota countUserUsage failed: ${error.message}`);
      return count ?? 0;
    },
    async countGlobalUsage(sinceIso) {
      const { count, error } = await client
        .from('lamplight_usage')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sinceIso);
      // Fail closed: a broken quota check must block, never silently allow.
      if (error) throw new Error(`quota countGlobalUsage failed: ${error.message}`);
      return count ?? 0;
    },
  };
}
