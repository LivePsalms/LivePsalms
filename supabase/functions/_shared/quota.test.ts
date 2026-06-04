import { describe, it, expect } from 'vitest';
import { resolveQuotaLimits, checkQuota, type QuotaDeps, type QuotaLimits } from './quota';

const env = (map: Record<string, string>) => ({ get: (k: string) => map[k] });

describe('resolveQuotaLimits', () => {
  it('returns defaults when no env overrides are set', () => {
    const limits = resolveQuotaLimits(env({}));
    expect(limits).toEqual({ perUser: { none: 10, lite: 50, plus: 200 }, global: 2000 });
  });

  it('applies valid env overrides', () => {
    const limits = resolveQuotaLimits(env({ LAMPLIGHT_QUOTA_NONE: '5', LAMPLIGHT_QUOTA_GLOBAL: '1000' }));
    expect(limits.perUser.none).toBe(5);
    expect(limits.global).toBe(1000);
    expect(limits.perUser.plus).toBe(200);
  });

  it('ignores invalid (non-numeric / negative) overrides', () => {
    const limits = resolveQuotaLimits(env({ LAMPLIGHT_QUOTA_LITE: 'abc', LAMPLIGHT_QUOTA_PLUS: '-3' }));
    expect(limits.perUser.lite).toBe(50);
    expect(limits.perUser.plus).toBe(200);
  });

  it('treats 0 as a valid override (not a fallback)', () => {
    const limits = resolveQuotaLimits(env({ LAMPLIGHT_QUOTA_NONE: '0' }));
    expect(limits.perUser.none).toBe(0);
  });
});

const LIMITS: QuotaLimits = { perUser: { none: 10, lite: 50, plus: 200 }, global: 2000 };
const NOW = 1_700_000_000_000; // fixed epoch ms for deterministic sinceIso

function deps(over: Partial<QuotaDeps>): QuotaDeps {
  return {
    getTier: async () => 'none',
    countUserUsage: async () => 0,
    countGlobalUsage: async () => 0,
    ...over,
  };
}

describe('checkQuota', () => {
  it('allows when under both limits', async () => {
    const r = await checkQuota(deps({ countUserUsage: async () => 3 }), LIMITS, { userId: 'u1', nowMs: NOW });
    expect(r.ok).toBe(true);
  });

  it('blocks with user_quota at the tier limit', async () => {
    const r = await checkQuota(deps({ getTier: async () => 'none', countUserUsage: async () => 10 }), LIMITS, { userId: 'u1', nowMs: NOW });
    expect(r).toMatchObject({ ok: false, reason: 'user_quota', tier: 'none', userLimit: 10 });
  });

  it('uses the tier-specific limit', async () => {
    const r = await checkQuota(deps({ getTier: async () => 'plus', countUserUsage: async () => 150 }), LIMITS, { userId: 'u1', nowMs: NOW });
    expect(r.ok).toBe(true);
  });

  it('blocks with global_quota when the global ceiling is reached (user still under)', async () => {
    const r = await checkQuota(deps({ countUserUsage: async () => 1, countGlobalUsage: async () => 2000 }), LIMITS, { userId: 'u1', nowMs: NOW });
    expect(r).toMatchObject({ ok: false, reason: 'global_quota' });
  });

  it('passes a 24h-ago ISO string to the counters', async () => {
    let captured = '';
    await checkQuota(deps({ countUserUsage: async (_u, since) => { captured = since; return 0; } }), LIMITS, { userId: 'u1', nowMs: NOW });
    expect(captured).toBe(new Date(NOW - 24 * 60 * 60 * 1000).toISOString());
  });
});
