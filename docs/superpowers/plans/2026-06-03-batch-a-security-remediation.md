# Batch A Security Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two worst security holes in Psalms_app — self-promotion to admin via an unguarded `profiles` UPDATE, and unbounded AI spend on `lamplight-generate` — by adding a privileged-column trigger, JWT-derived identity, and a per-user/global daily quota.

**Architecture:** One Postgres `BEFORE UPDATE` trigger blocks client writes to privileged `profiles` columns (gated on `current_user`, so the SECURITY DEFINER `update_note_count()` path still works). `lamplight-generate` derives the caller from the verified JWT instead of trusting `body.user_id`, then enforces a quota that counts `lamplight_usage` rows in a rolling 24h window (per-user-by-tier plus a global ceiling). Security-critical logic lives in pure, dependency-injected modules (`_shared/quota.ts`, `_shared/auth-identity.ts`) tested with faked clients; the trigger is covered by an env-gated integration test.

**Tech Stack:** Supabase Postgres (SQL migrations), Deno Edge Functions (TypeScript), supabase-js, Vitest (node env), existing `SUPABASE_TEST_*` integration harness.

**Spec:** [docs/superpowers/specs/2026-06-03-batch-a-security-remediation-design.md](../specs/2026-06-03-batch-a-security-remediation-design.md)

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `supabase/migrations/021_protect_privileged_profile_columns.sql` | Trigger blocking client writes to `is_admin`/`note_count`/`highest_note_count`/`last_acknowledged_tier_threshold` | Create |
| `src/notepad/storage/profiles-privileged-columns.test.ts` | Integration test for the trigger (env-gated) | Create |
| `supabase/functions/_shared/quota.ts` | Pure quota decision + limit resolution + Supabase adapter | Create |
| `supabase/functions/_shared/quota.test.ts` | Unit tests for quota logic (faked deps) | Create |
| `supabase/functions/_shared/auth-identity.ts` | Derive user id from Bearer JWT | Create |
| `supabase/functions/_shared/auth-identity.test.ts` | Unit tests for identity derivation (faked client) | Create |
| `supabase/functions/lamplight-generate/index.ts` | Wire JWT identity + quota + smoke_test usage row | Modify |

---

## Task 1: Privileged-column trigger (Findings #1, #6)

**Files:**
- Create: `supabase/migrations/021_protect_privileged_profile_columns.sql`
- Test: `src/notepad/storage/profiles-privileged-columns.test.ts`

> **Integration-test note (project convention):** Tests gate on `SUPABASE_TEST_*` env vars and
> `describe.skip` when absent — skipping is not a failure (see
> [todays-lamp plan](2026-05-27-todays-lamp.md) line ~1966). With env configured against a test
> project that has migration 021 applied, the assertions below pass; without 021 they fail
> (the impersonation update succeeds). Validate by inspection that the shape matches the existing
> `userA`/service-client pattern in `src/notepad/storage/lamplight-rls.test.ts`.

- [ ] **Step 1: Write the failing integration test**

Create `src/notepad/storage/profiles-privileged-columns.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };

const SUPABASE_URL = process.env.SUPABASE_TEST_URL;
const SUPABASE_ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SUPABASE_SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const USER_A_EMAIL = process.env.SUPABASE_TEST_USER_A_EMAIL;
const USER_A_PASS = process.env.SUPABASE_TEST_USER_A_PASS;

const haveEnv =
  SUPABASE_URL && SUPABASE_ANON && SUPABASE_SERVICE && USER_A_EMAIL && USER_A_PASS;
const maybeDescribe = haveEnv ? describe : describe.skip;

async function signedClient(email: string, password: string) {
  const client = createClient(SUPABASE_URL!, SUPABASE_ANON!);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client, userId: data.user!.id };
}
const serviceClient = (): SupabaseClient => createClient(SUPABASE_URL!, SUPABASE_SERVICE!);

maybeDescribe('profiles privileged-column guard (integration)', () => {
  let userA: { client: SupabaseClient; userId: string };

  beforeAll(async () => {
    userA = await signedClient(USER_A_EMAIL!, USER_A_PASS!);
    await serviceClient().from('profiles').update({ is_admin: false }).eq('id', userA.userId);
  });

  it('blocks an authenticated client from setting is_admin', async () => {
    const { error } = await userA.client
      .from('profiles').update({ is_admin: true }).eq('id', userA.userId);
    expect(error).not.toBeNull();

    const { data } = await serviceClient()
      .from('profiles').select('is_admin').eq('id', userA.userId).single();
    expect(data?.is_admin).toBe(false);
  });

  it('blocks an authenticated client from setting note_count', async () => {
    const { error } = await userA.client
      .from('profiles').update({ note_count: 999999 }).eq('id', userA.userId);
    expect(error).not.toBeNull();
  });

  it('still allows a normal field update (username)', async () => {
    const uniq = `rls_${Date.now().toString(36)}`.slice(0, 20);
    const { error } = await userA.client
      .from('profiles').update({ username: uniq }).eq('id', userA.userId);
    expect(error).toBeNull();
  });

  it('regression: a qualifying note insert still bumps note_count via the trigger', async () => {
    const svc = serviceClient();
    const before = await svc.from('profiles').select('note_count').eq('id', userA.userId).single();
    const longText = Array.from({ length: 25 }, (_, i) => `word${i}`).join(' ');
    const content = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: longText }] }],
    });
    const { data: note, error: insErr } = await userA.client
      .from('notes').insert({ user_id: userA.userId, title: 'guard-test', content, word_count: 25 })
      .select('id').single();
    expect(insErr).toBeNull();

    const after = await svc.from('profiles').select('note_count').eq('id', userA.userId).single();
    expect((after.data?.note_count ?? 0)).toBeGreaterThan(before.data?.note_count ?? 0);

    await userA.client.from('notes').delete().eq('id', note!.id);
  });

  it('allows the service role to set is_admin', async () => {
    const svc = serviceClient();
    const { error } = await svc.from('profiles').update({ is_admin: true }).eq('id', userA.userId);
    expect(error).toBeNull();
    await svc.from('profiles').update({ is_admin: false }).eq('id', userA.userId);
  });
});
```

- [ ] **Step 2: Run the test to confirm current behavior**

Run: `npm run test -- src/notepad/storage/profiles-privileged-columns.test.ts`
Expected (with `SUPABASE_TEST_*` configured, migration 021 NOT yet applied): the first two tests
FAIL — `error` is `null` and `is_admin` becomes `true`, proving the hole. (Without env: suite is
skipped — proceed and rely on Step 4.)

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/021_protect_privileged_profile_columns.sql`:

```sql
-- 021_protect_privileged_profile_columns.sql
-- Batch A security remediation, Finding #1 (+ #6).
--
-- The profiles UPDATE policy is `using (auth.uid() = id)` with no column guard,
-- so any authenticated user could `update({ is_admin: true })` on their own row
-- and unlock every admin RPC. RLS can't express column-level restrictions, so a
-- BEFORE UPDATE trigger blocks privileged-column changes that originate from a
-- client role.
--
-- Gate on current_user (the executing DB role), NOT auth.role(): auth.role() is
-- JWT-scoped and stays 'authenticated' even inside SECURITY DEFINER functions,
-- so it would falsely block update_note_count() (003_triggers.sql), which writes
-- note_count during ordinary authenticated note inserts. Inside that SECURITY
-- DEFINER function current_user becomes the function owner, so it passes; a
-- direct browser UPDATE runs as 'authenticated'/'anon' and is blocked.
--
-- Intentionally SECURITY INVOKER (the default — do NOT add `security definer`).
-- A SECURITY DEFINER function executes as its owner, so current_user would be
-- the owner and the guard below would never match, rendering the trigger inert.

create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.is_admin is distinct from old.is_admin
       or new.note_count is distinct from old.note_count
       or new.highest_note_count is distinct from old.highest_note_count
       or new.last_acknowledged_tier_threshold is distinct from old.last_acknowledged_tier_threshold then
      raise exception 'cannot modify privileged profile columns';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileged
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_columns();
```

- [ ] **Step 4: Apply the migration and re-run the test**

Run (local stack): `supabase db reset`
Then (against the configured test project, if separate): apply migration 021 there too.
Run: `npm run test -- src/notepad/storage/profiles-privileged-columns.test.ts`
Expected (env configured): all 5 tests PASS. (Env absent: suite skips — confirm by inspection that
the test shape matches `lamplight-rls.test.ts`.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/021_protect_privileged_profile_columns.sql \
        src/notepad/storage/profiles-privileged-columns.test.ts
git commit -m "fix(security): block client writes to privileged profile columns (#1,#6)"
```

---

## Task 2: Quota module — limit resolution (Finding #4, part 1)

**Files:**
- Create: `supabase/functions/_shared/quota.ts`
- Test: `supabase/functions/_shared/quota.test.ts`

- [ ] **Step 1: Write the failing test for `resolveQuotaLimits`**

Create `supabase/functions/_shared/quota.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveQuotaLimits } from './quota';

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
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- supabase/functions/_shared/quota.test.ts`
Expected: FAIL — `Cannot find module './quota'`.

- [ ] **Step 3: Create `quota.ts` with limit resolution**

Create `supabase/functions/_shared/quota.ts`:

```ts
// supabase/functions/_shared/quota.ts
//
// Per-user (by tier) + global daily quota for billable Lamplight AI calls.
// Approach A from the Batch A security spec: count lamplight_usage rows in a
// rolling 24h window. No new infra. Accepts a small race-window overage under
// concurrency (documented in the spec) — acceptable for a spend cap.

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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- supabase/functions/_shared/quota.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/quota.ts supabase/functions/_shared/quota.test.ts
git commit -m "feat(security): add quota limit resolution for Lamplight AI"
```

---

## Task 3: Quota module — decision logic (Finding #4, part 2)

**Files:**
- Modify: `supabase/functions/_shared/quota.ts`
- Test: `supabase/functions/_shared/quota.test.ts`

- [ ] **Step 1: Add failing tests for `checkQuota`**

Append to `supabase/functions/_shared/quota.test.ts`:

```ts
import { checkQuota, type QuotaDeps, type QuotaLimits } from './quota';

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- supabase/functions/_shared/quota.test.ts`
Expected: FAIL — `checkQuota`/`QuotaDeps` not exported.

- [ ] **Step 3: Implement `checkQuota` + `QuotaDeps` + the Supabase adapter**

Append to `supabase/functions/_shared/quota.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

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
      const { count } = await client
        .from('lamplight_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', sinceIso);
      return count ?? 0;
    },
    async countGlobalUsage(sinceIso) {
      const { count } = await client
        .from('lamplight_usage')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sinceIso);
      return count ?? 0;
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- supabase/functions/_shared/quota.test.ts`
Expected: PASS (all 8 tests across Tasks 2–3).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/quota.ts supabase/functions/_shared/quota.test.ts
git commit -m "feat(security): add per-user + global quota decision logic (#4)"
```

---

## Task 4: JWT-derived identity helper (Finding #2 slice)

**Files:**
- Create: `supabase/functions/_shared/auth-identity.ts`
- Test: `supabase/functions/_shared/auth-identity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/_shared/auth-identity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { bearerToken, deriveUserId, type AuthClient } from './auth-identity';

const reqWith = (auth?: string) => ({ headers: { get: (n: string) => (n === 'Authorization' ? auth ?? null : null) } });
const clientReturning = (result: { data: { user: { id: string } | null }; error: unknown }): AuthClient =>
  ({ auth: { getUser: async () => result } });

describe('bearerToken', () => {
  it('strips the Bearer prefix (case-insensitive)', () => {
    expect(bearerToken(reqWith('Bearer abc.def'))).toBe('abc.def');
    expect(bearerToken(reqWith('bearer xyz'))).toBe('xyz');
  });
  it('returns empty string when no header', () => {
    expect(bearerToken(reqWith(undefined))).toBe('');
  });
});

describe('deriveUserId', () => {
  it('returns the user id for a valid token', async () => {
    const id = await deriveUserId(clientReturning({ data: { user: { id: 'u-123' } }, error: null }), 'tok');
    expect(id).toBe('u-123');
  });
  it('returns null on auth error', async () => {
    const id = await deriveUserId(clientReturning({ data: { user: null }, error: { message: 'bad jwt' } }), 'tok');
    expect(id).toBeNull();
  });
  it('returns null when token is empty (no auth call)', async () => {
    let called = false;
    const client: AuthClient = { auth: { getUser: async () => { called = true; return { data: { user: null }, error: null }; } } };
    const id = await deriveUserId(client, '');
    expect(id).toBeNull();
    expect(called).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- supabase/functions/_shared/auth-identity.test.ts`
Expected: FAIL — `Cannot find module './auth-identity'`.

- [ ] **Step 3: Implement `auth-identity.ts`**

Create `supabase/functions/_shared/auth-identity.ts`:

```ts
// supabase/functions/_shared/auth-identity.ts
//
// Identity must come from the verified Bearer JWT, never from a client-supplied
// body field. Used by lamplight-generate to replace the spoofable body.user_id.

export interface AuthClient {
  auth: {
    getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };
}

export function bearerToken(req: { headers: { get(name: string): string | null } }): string {
  return (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
}

export async function deriveUserId(client: AuthClient, token: string): Promise<string | null> {
  if (!token) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- supabase/functions/_shared/auth-identity.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/auth-identity.ts supabase/functions/_shared/auth-identity.test.ts
git commit -m "feat(security): add JWT-derived identity helper (#2 slice)"
```

---

## Task 5: Wire identity + quota + smoke_test usage into `lamplight-generate`

**Files:**
- Modify: `supabase/functions/lamplight-generate/index.ts`

Current relevant code ([index.ts:65-100](../../../supabase/functions/lamplight-generate/index.ts)):
`handleGenerate` reads `body.user_id`, rejects if it isn't a string, queries
`lamplight_settings` by `body.user_id`, then dispatches on `body.kind`. `smoke_test` success
records no `lamplight_usage` row (the count gap); `daily_devotion` and `connection_card_why`
already record on success and error inside their pipelines.

- [ ] **Step 1: Add imports**

In `supabase/functions/lamplight-generate/index.ts`, after the existing `recordLamplightUsage`
import, add:

```ts
import { bearerToken, deriveUserId } from '../_shared/auth-identity.ts';
import { resolveQuotaLimits, checkQuota, supabaseQuotaDeps } from '../_shared/quota.ts';
```

- [ ] **Step 2: Replace body.user_id parsing with JWT-derived identity**

In `handleGenerate`, find:

```ts
  try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }
  if (typeof body.user_id !== 'string') return jsonResp({ error: 'bad payload' }, 400);

  const supabase = serviceClient();
  const { data: settings, error: sErr } = await supabase
    .from('lamplight_settings')
    .select('enabled')
    .eq('user_id', body.user_id)
    .maybeSingle();
  if (sErr) return jsonResp({ error: sErr.message }, 500);
  if (!settings?.enabled) return jsonResp({ error: 'not opted in' }, 403);
```

Replace with:

```ts
  try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }

  const supabase = serviceClient();

  // Identity comes from the verified JWT, never from body.user_id.
  const userId = await deriveUserId(supabase, bearerToken(req));
  if (!userId) return jsonResp({ error: 'unauthorized' }, 401);

  const { data: settings, error: sErr } = await supabase
    .from('lamplight_settings')
    .select('enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (sErr) return jsonResp({ error: sErr.message }, 500);
  if (!settings?.enabled) return jsonResp({ error: 'not opted in' }, 403);

  // Quota: per-user (by tier) + global daily ceiling. Counts lamplight_usage
  // rows in a rolling 24h window. Runs before any model/context work.
  const quota = await checkQuota(
    supabaseQuotaDeps(supabase),
    resolveQuotaLimits(Deno.env),
    { userId, nowMs: Date.now() },
  );
  if (!quota.ok) return jsonResp({ error: 'quota_exceeded', reason: quota.reason }, 429);
```

- [ ] **Step 3: Replace remaining `body.user_id` uses with `userId`**

In the same function, update the three dispatch branches to use the derived `userId`:

- `smoke_test`: change `userId: body.user_id` to `userId` in the `buildSmokeTestContext` call.
- `daily_devotion`: delete the line `const userId = body.user_id;` (now shadowed/defined above) and keep the rest; it already references `userId`.
- `connection_card_why`: delete the line `const userId = body.user_id;` and keep the rest.

Verify with: `grep -n "body.user_id" supabase/functions/lamplight-generate/index.ts`
Expected: no matches.

- [ ] **Step 4: Record a usage row for `smoke_test` (close the count gap)**

In the `smoke_test` branch, replace:

```ts
  if (body.kind === 'smoke_test') {
    const ctx = await buildSmokeTestContext(supabase, {
      userId, voyageDeps, rerankEnabled,
    });
    const result = await runSmokeTestPipeline({ llm, ctx });
    return jsonResp(result);
  }
```

with:

```ts
  if (body.kind === 'smoke_test') {
    try {
      const ctx = await buildSmokeTestContext(supabase, { userId, voyageDeps, rerankEnabled });
      const result = await runSmokeTestPipeline({ llm, ctx });
      void recordLamplightUsage(supabase, {
        user_id: userId,
        model: 'claude-haiku-4-5-20251001',
        artifact_kind: 'smoke_test',
        tokens_in: 0,
        tokens_out: 0,
        status: 'ok',
      }).catch(() => {});
      return jsonResp(result);
    } catch (err) {
      void recordLamplightUsage(supabase, {
        user_id: userId,
        model: 'claude-haiku-4-5-20251001',
        artifact_kind: 'smoke_test',
        tokens_in: 0,
        tokens_out: 0,
        status: 'error',
        error_code: classifyGenerateError(err),
      }).catch(() => {});
      throw err;
    }
  }
```

- [ ] **Step 5: Typecheck and run the existing function test suite**

Run: `npm run build`
Expected: PASS (no TypeScript errors; `body.user_id` removed, `userId` defined before all uses).

Run: `npm run test -- supabase/functions/lamplight-generate`
Expected: PASS — the existing pipeline tests still pass (they pass `userId` in directly and are
unaffected by the wrapper changes).

- [ ] **Step 6: Manual verification (no deployed-function test harness exists)**

These confirm the wiring end-to-end against a deployed function (or `supabase functions serve`).
Record the outcomes; do not skip.

1. **Identity not spoofable:** invoke `lamplight-generate` with user A's `Authorization` JWT and a
   body containing `user_id: "<user B uuid>"`, `kind: "smoke_test"`. Expected: response reflects
   user A's data (or `not opted in` for A), never user B's. Pre-fix this returned B's data.
2. **Unauthorized:** invoke with no `Authorization` header (call the function directly, bypassing
   the client). Expected: `401 unauthorized`.
3. **Quota:** with a `none`-tier opted-in test user, invoke `smoke_test` 11 times in under 24h.
   Expected: the 11th returns `429 quota_exceeded` with `reason: "user_quota"`. Confirm a
   `lamplight_usage` row was written for each successful call:
   `select count(*) from lamplight_usage where user_id = '<A>' and created_at >= now() - interval '24 hours';`

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/lamplight-generate/index.ts
git commit -m "fix(security): JWT identity + quota enforcement on lamplight-generate (#2,#4)"
```

---

## Operational follow-up (not code)

- [ ] Set hard budget caps + alerts in the **Anthropic** and **Voyage** dashboards as an absolute
  backstop independent of app-level quota. Note the configured caps in the Batch A PR description.

---

## Deferred to later batches (out of scope here)

- `transcribe-note` / `embed-note`: JWT identity, `image_key` IDOR guard, and their own quota → **Batch B**.
- Explicit per-function `verify_jwt = true` in `config.toml` → **Batch C**.
- CORS allow-origin lockdown + Voyage-key hygiene → **Batch D**.

---

## Self-Review

- **Spec coverage:** #1 → Task 1 (trigger). #6 → Task 1 (same trigger guards the gamification
  columns). #2 slice (JWT identity for lamplight-generate) → Tasks 4 + 5. #4 (per-user + global
  quota, 24h window, defaults none=10/lite=50/plus=200/global=2000, env-overridable, one-row-per-
  request reliability via smoke_test fix) → Tasks 2, 3, 5. Operational budget-cap note → follow-up
  checklist. All Batch A spec sections map to a task.
- **Reliability requirement:** spec asks every billable request to write ≥1 usage row; verified that
  `daily_devotion` and `connection_card_why` already record on success and error, and Task 5 Step 4
  adds the missing `smoke_test` rows — closing the only gap.
- **Type consistency:** `Tier`, `QuotaLimits`, `QuotaDeps`, `QuotaResult`, `checkQuota`,
  `resolveQuotaLimits`, `supabaseQuotaDeps` used identically across `quota.ts`/`quota.test.ts`/
  `index.ts`. `AuthClient`, `bearerToken`, `deriveUserId` consistent across
  `auth-identity.ts`/`auth-identity.test.ts`/`index.ts`. `recordLamplightUsage` signature matches
  existing `UsageRow` usage.
- **Placeholders:** none — every code/test step contains complete content.
