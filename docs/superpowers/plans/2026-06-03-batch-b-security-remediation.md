# Batch B Security Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the `transcribe-note` storage IDOR and identity-spoofing holes by deriving identity from the verified JWT (making the existing path-aware `image_key` guard enforceable), and add a separate transcription quota — refactoring the shared quota module to independent, kind-scoped buckets.

**Architecture:** Generalize `_shared/quota.ts` from one combined per-user bucket to kind-scoped buckets (`generation` vs `transcription`) plus a shared global ceiling. Update the merged Batch A call site (`lamplight-generate`) to the generation scope. In `transcribe-note`, derive `userId` from the JWT (reusing `_shared/auth-identity.ts`), enforce the transcription quota, and pass the trusted `userId` into the handler so its IDOR guard validates against the JWT user instead of a client-supplied field.

**Tech Stack:** Deno Edge Functions (TypeScript), supabase-js, Vitest (node env). Reuses Batch A's `_shared/auth-identity.ts` and `_shared/quota.ts`.

**Spec:** [docs/superpowers/specs/2026-06-03-batch-b-security-remediation-design.md](../specs/2026-06-03-batch-b-security-remediation-design.md)

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `supabase/functions/_shared/quota.ts` | Kind-scoped quota buckets (generation/transcription) + global ceiling | Modify |
| `supabase/functions/_shared/quota.test.ts` | Unit tests for the new scope-based API | Modify |
| `supabase/functions/lamplight-generate/index.ts` | Use the generation scope at the existing call site | Modify |
| `supabase/functions/transcribe-note/handler.ts` | Take trusted `userId` param; IDOR guard vs JWT user; drop body identity | Modify |
| `supabase/functions/transcribe-note/handler.test.ts` | Update calls to new signature | Modify |
| `supabase/functions/transcribe-note/index.ts` | JWT identity + transcription quota + pass `userId` to handler | Modify |

---

## Task 1: Refactor `quota.ts` to kind-scoped buckets

**Files:**
- Modify: `supabase/functions/_shared/quota.ts`
- Test: `supabase/functions/_shared/quota.test.ts`

- [ ] **Step 1: Replace the test file with the new scope-based API tests (red)**

Overwrite `supabase/functions/_shared/quota.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { resolveQuotaLimits, checkQuota, type QuotaDeps, type QuotaScope } from './quota';

const env = (map: Record<string, string>) => ({ get: (k: string) => map[k] });

describe('resolveQuotaLimits', () => {
  it('returns the default config when no env overrides are set', () => {
    const cfg = resolveQuotaLimits(env({}));
    expect(cfg.generation.kinds).toEqual(['smoke_test', 'daily_devotion', 'connection_card_why']);
    expect(cfg.generation.perUser).toEqual({ none: 10, lite: 50, plus: 200 });
    expect(cfg.transcription.kinds).toEqual(['note_transcription']);
    expect(cfg.transcription.perUser).toEqual({ none: 5, lite: 20, plus: 50 });
    expect(cfg.global).toBe(2000);
  });

  it('applies valid generation + global overrides (Batch A key names preserved)', () => {
    const cfg = resolveQuotaLimits(env({ LAMPLIGHT_QUOTA_NONE: '3', LAMPLIGHT_QUOTA_GLOBAL: '1000' }));
    expect(cfg.generation.perUser.none).toBe(3);
    expect(cfg.global).toBe(1000);
    expect(cfg.generation.perUser.plus).toBe(200);
  });

  it('applies transcription-specific overrides', () => {
    const cfg = resolveQuotaLimits(env({ LAMPLIGHT_QUOTA_TRANSCRIPTION_NONE: '2', LAMPLIGHT_QUOTA_TRANSCRIPTION_PLUS: '99' }));
    expect(cfg.transcription.perUser.none).toBe(2);
    expect(cfg.transcription.perUser.plus).toBe(99);
    expect(cfg.transcription.perUser.lite).toBe(20);
  });

  it('ignores invalid/negative overrides; 0 is valid', () => {
    const cfg = resolveQuotaLimits(env({
      LAMPLIGHT_QUOTA_TRANSCRIPTION_LITE: 'abc',
      LAMPLIGHT_QUOTA_TRANSCRIPTION_PLUS: '-3',
      LAMPLIGHT_QUOTA_TRANSCRIPTION_NONE: '0',
    }));
    expect(cfg.transcription.perUser.lite).toBe(20);
    expect(cfg.transcription.perUser.plus).toBe(50);
    expect(cfg.transcription.perUser.none).toBe(0);
  });
});

const GEN: QuotaScope = { kinds: ['smoke_test', 'daily_devotion', 'connection_card_why'], perUser: { none: 10, lite: 50, plus: 200 } };
const TRANSCRIPTION: QuotaScope = { kinds: ['note_transcription'], perUser: { none: 5, lite: 20, plus: 50 } };
const GLOBAL = 2000;
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
    const r = await checkQuota(deps({ countUserUsage: async () => 3 }), GEN, GLOBAL, { userId: 'u1', nowMs: NOW });
    expect(r.ok).toBe(true);
  });

  it('blocks with user_quota at the scope tier limit', async () => {
    const r = await checkQuota(deps({ getTier: async () => 'none', countUserUsage: async () => 10 }), GEN, GLOBAL, { userId: 'u1', nowMs: NOW });
    expect(r).toMatchObject({ ok: false, reason: 'user_quota', tier: 'none', userLimit: 10 });
  });

  it('uses the transcription scope limit independently of generation', async () => {
    // 6 transcriptions for a none-tier user (limit 5) → blocked, even though the
    // generation limit (10) would have allowed it.
    const r = await checkQuota(deps({ getTier: async () => 'none', countUserUsage: async () => 6 }), TRANSCRIPTION, GLOBAL, { userId: 'u1', nowMs: NOW });
    expect(r).toMatchObject({ ok: false, reason: 'user_quota', userLimit: 5 });
  });

  it('passes the scope kinds to the user counter', async () => {
    let capturedKinds: string[] = [];
    await checkQuota(deps({ countUserUsage: async (_u, _since, kinds) => { capturedKinds = kinds; return 0; } }), TRANSCRIPTION, GLOBAL, { userId: 'u1', nowMs: NOW });
    expect(capturedKinds).toEqual(['note_transcription']);
  });

  it('blocks with global_quota when the ceiling is reached (user under)', async () => {
    const r = await checkQuota(deps({ countUserUsage: async () => 1, countGlobalUsage: async () => 2000 }), GEN, GLOBAL, { userId: 'u1', nowMs: NOW });
    expect(r).toMatchObject({ ok: false, reason: 'global_quota' });
  });

  it('passes a 24h-ago ISO string to the counters', async () => {
    let captured = '';
    await checkQuota(deps({ countUserUsage: async (_u, since) => { captured = since; return 0; } }), GEN, GLOBAL, { userId: 'u1', nowMs: NOW });
    expect(captured).toBe(new Date(NOW - 24 * 60 * 60 * 1000).toISOString());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/quota.test.ts`
Expected: FAIL — `QuotaScope` not exported / `checkQuota` arity mismatch / `resolveQuotaLimits` shape mismatch.

- [ ] **Step 3: Rewrite `quota.ts` with the scope-based API (green)**

Overwrite `supabase/functions/_shared/quota.ts` with:

```ts
// supabase/functions/_shared/quota.ts
//
// Per-user (by tier, kind-scoped) + global daily quota for billable Lamplight
// AI calls. Counts lamplight_usage rows in a rolling 24h window. No new infra.
// Accepts a small race-window overage under concurrency — fine for a spend cap.
//
// Buckets are INDEPENDENT and scoped by artifact_kind: the generation bucket
// counts generation kinds; the transcription bucket counts note_transcription.
// The global ceiling counts ALL kinds across all users (absolute wallet guard).

import type { SupabaseClient } from '@supabase/supabase-js';

export type Tier = 'none' | 'lite' | 'plus';

export interface QuotaScope {
  kinds: string[];                 // artifact_kinds this bucket counts
  perUser: Record<Tier, number>;
}

export interface QuotaConfig {
  generation: QuotaScope;
  transcription: QuotaScope;
  global: number;                  // all-kinds daily ceiling
}

const GENERATION_KINDS = ['smoke_test', 'daily_devotion', 'connection_card_why'];
const TRANSCRIPTION_KINDS = ['note_transcription'];

const DEFAULTS = {
  generation: { none: 10, lite: 50, plus: 200 },
  transcription: { none: 5, lite: 20, plus: 50 },
  global: 2000,
};

// Per-environment overrides without a code change. Invalid/negative → default;
// 0 is a valid, intentional override (disables a tier / sets a hard ceiling).
export function resolveQuotaLimits(env: { get(key: string): string | undefined }): QuotaConfig {
  const num = (key: string, fallback: number): number => {
    const raw = env.get(key);
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    generation: {
      kinds: GENERATION_KINDS,
      perUser: {
        none: num('LAMPLIGHT_QUOTA_NONE', DEFAULTS.generation.none),
        lite: num('LAMPLIGHT_QUOTA_LITE', DEFAULTS.generation.lite),
        plus: num('LAMPLIGHT_QUOTA_PLUS', DEFAULTS.generation.plus),
      },
    },
    transcription: {
      kinds: TRANSCRIPTION_KINDS,
      perUser: {
        none: num('LAMPLIGHT_QUOTA_TRANSCRIPTION_NONE', DEFAULTS.transcription.none),
        lite: num('LAMPLIGHT_QUOTA_TRANSCRIPTION_LITE', DEFAULTS.transcription.lite),
        plus: num('LAMPLIGHT_QUOTA_TRANSCRIPTION_PLUS', DEFAULTS.transcription.plus),
      },
    },
    global: num('LAMPLIGHT_QUOTA_GLOBAL', DEFAULTS.global),
  };
}

export interface QuotaDeps {
  getTier(userId: string): Promise<Tier>;
  countUserUsage(userId: string, sinceIso: string, kinds: string[]): Promise<number>;
  countGlobalUsage(sinceIso: string): Promise<number>;
}

export type QuotaResult =
  | { ok: true; tier: Tier; userUsed: number; userLimit: number }
  | { ok: false; reason: 'user_quota' | 'global_quota'; tier: Tier; userUsed: number; userLimit: number };

const DAY_MS = 24 * 60 * 60 * 1000;

export async function checkQuota(
  deps: QuotaDeps,
  scope: QuotaScope,
  global: number,
  args: { userId: string; nowMs: number },
): Promise<QuotaResult> {
  const sinceIso = new Date(args.nowMs - DAY_MS).toISOString();
  const tier = await deps.getTier(args.userId);
  const userLimit = scope.perUser[tier];

  const userUsed = await deps.countUserUsage(args.userId, sinceIso, scope.kinds);
  if (userUsed >= userLimit) {
    return { ok: false, reason: 'user_quota', tier, userUsed, userLimit };
  }

  const globalUsed = await deps.countGlobalUsage(sinceIso);
  if (globalUsed >= global) {
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
    async countUserUsage(userId, sinceIso, kinds) {
      const { count, error } = await client
        .from('lamplight_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('artifact_kind', kinds)
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/quota.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/quota.ts supabase/functions/_shared/quota.test.ts
git commit -m "refactor(security): kind-scoped quota buckets (generation/transcription) (#4)"
```

---

## Task 2: Update the `lamplight-generate` quota call site

**Files:**
- Modify: `supabase/functions/lamplight-generate/index.ts`

This call site uses the old 3-arg `checkQuota(deps, limits, args)`. Update it to the generation scope. (No unit test covers `index.ts`; verify via grep + regression suites + best-effort `deno check`.)

- [ ] **Step 1: Read the file and locate the quota block**

Read `supabase/functions/lamplight-generate/index.ts`. The import line already imports `resolveQuotaLimits, checkQuota, supabaseQuotaDeps` (unchanged). Find the quota block (after the `settings.enabled` 403 check).

- [ ] **Step 2: Replace the quota block**

Find:

```ts
  const quota = await checkQuota(
    supabaseQuotaDeps(supabase),
    resolveQuotaLimits(Deno.env),
    { userId, nowMs: Date.now() },
  );
  if (!quota.ok) return jsonResp({ error: 'quota_exceeded', reason: quota.reason }, 429);
```

Replace with:

```ts
  const quotaCfg = resolveQuotaLimits(Deno.env);
  const quota = await checkQuota(
    supabaseQuotaDeps(supabase),
    quotaCfg.generation,
    quotaCfg.global,
    { userId, nowMs: Date.now() },
  );
  if (!quota.ok) return jsonResp({ error: 'quota_exceeded', reason: quota.reason }, 429);
```

- [ ] **Step 3: Verify**

Run: `npx vitest run supabase/functions/lamplight-generate`
Expected: PASS (existing pipeline suites unaffected, 23 tests).

Run (best-effort typecheck): `deno check supabase/functions/lamplight-generate/index.ts`
Expected: success, OR an environment-only failure (missing remote module / npm dep in the deno cache). Do NOT get BLOCKED on an environment error — if it's not a real type error in this file, note it and continue. If it reports a genuine arity/type error at the `checkQuota` call, fix it.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/lamplight-generate/index.ts
git commit -m "refactor(security): lamplight-generate uses the generation quota scope (#4)"
```

---

## Task 3: Refactor `transcribe-note` handler to a trusted `userId` param

**Files:**
- Modify: `supabase/functions/transcribe-note/handler.ts`
- Test: `supabase/functions/transcribe-note/handler.test.ts`

- [ ] **Step 1: Update the handler tests to the new signature (red)**

In `supabase/functions/transcribe-note/handler.test.ts`, replace the whole `describe('handleTranscribe', …)` block with (calls now pass `userId` as the 3rd arg; bodies carry only `image_key`):

```ts
describe('handleTranscribe', () => {
  it('rejects an image_key not under the caller folder', async () => {
    const { d } = deps();
    const res = await handleTranscribe(d as never, { image_key: 'note-scans/u2/x.jpg' }, 'u1');
    expect(res.status).toBe(403);
  });

  it('rejects a bad payload (missing image_key)', async () => {
    const { d } = deps();
    const res = await handleTranscribe(d as never, {} as never, 'u1');
    expect(res.status).toBe(400);
  });

  it('returns transcription + verse flags and inserts a row scoped to the JWT user', async () => {
    const { d, inserted } = deps();
    const res = await handleTranscribe(d as never, { image_key: 'note-scans/u1/x.jpg' }, 'u1');
    expect(res.status).toBe(200);
    expect(res.body.transcription).toBe('Trusting in Psalm 23:1 today');
    expect(res.body.confidence).toBe(0.82);
    expect(res.body.verseFlags).toEqual([
      { ref: 'Psalm 23:1', status: 'found', canonicalText: 'The LORD is my shepherd' },
    ]);
    expect(res.body.transcription_id).toBe('tx-1');
    expect(inserted[0]).toMatchObject({ user_id: 'u1', image_key: 'note-scans/u1/x.jpg', status: 'transcribed' });
  });

  it('degrades to empty verseFlags when verification throws', async () => {
    const { d } = deps({ verifyVerseRefs: async () => { throw new Error('db down'); } });
    const res = await handleTranscribe(d as never, { image_key: 'note-scans/u1/x.jpg' }, 'u1');
    expect(res.status).toBe(200);
    expect(res.body.verseFlags).toEqual([]);
  });

  it('rejects a path-traversal image_key', async () => {
    const { d } = deps();
    const res = await handleTranscribe(d as never, { image_key: 'note-scans/u1/../u2/x.jpg' }, 'u1');
    expect(res.status).toBe(403);
  });

  it('records usage against the JWT user, not the key owner', async () => {
    const calls: any[] = [];
    const { d } = deps({ recordUsage: async (row: any) => { calls.push(row); } });
    await handleTranscribe(d as never, { image_key: 'note-scans/u1/x.jpg' }, 'u1');
    expect(calls.some((c) => c.user_id === 'u1' && c.status === 'ok')).toBe(true);
  });

  it('returns 502 and logs an error when the LLM throws', async () => {
    const calls: any[] = [];
    const { d } = deps({
      llm: { generate: async () => { throw new Error('timeout'); } },
      recordUsage: async (row: any) => { calls.push(row); },
    });
    const res = await handleTranscribe(d as never, { image_key: 'note-scans/u1/x.jpg' }, 'u1');
    expect(res.status).toBe(502);
    expect(calls.some((c) => c.status === 'error')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run supabase/functions/transcribe-note/handler.test.ts`
Expected: FAIL — `handleTranscribe` currently takes 2 args / reads `body.user_id`.

- [ ] **Step 3: Refactor the handler**

In `supabase/functions/transcribe-note/handler.ts`:

(a) Change the body interface (remove `user_id`):

```ts
export interface TranscribeBody { image_key?: string }
```

(b) Replace the function signature + identity validation + IDOR guard. Find:

```ts
export async function handleTranscribe(
  deps: TranscribeDeps,
  body: TranscribeBody,
): Promise<HandlerResponse> {
  if (typeof body.user_id !== 'string' || body.user_id.length === 0) {
    return { status: 400, body: { error: 'bad user_id' } };
  }
  if (typeof body.image_key !== 'string') {
    return { status: 400, body: { error: 'bad image_key' } };
  }
  // IDOR guard: key must be exactly note-scans/{user_id}/{single-safe-filename}.
  // A plain startsWith() is not path-aware — `..` segments would escape the
  // user's folder, and the service-role client bypasses storage RLS.
  const prefix = `note-scans/${body.user_id}/`;
  const rest = body.image_key.startsWith(prefix) ? body.image_key.slice(prefix.length) : null;
  if (rest === null || !/^[A-Za-z0-9._-]+$/.test(rest)) {
    return { status: 403, body: { error: 'forbidden image_key' } };
  }
```

Replace with:

```ts
export async function handleTranscribe(
  deps: TranscribeDeps,
  body: TranscribeBody,
  userId: string,
): Promise<HandlerResponse> {
  if (typeof body.image_key !== 'string') {
    return { status: 400, body: { error: 'bad image_key' } };
  }
  // IDOR guard: key must be exactly note-scans/{userId}/{single-safe-filename}.
  // userId is the JWT-verified caller (never client-supplied). A plain
  // startsWith() is not path-aware — `..` segments would escape the user's
  // folder, and the service-role client bypasses storage RLS.
  const prefix = `note-scans/${userId}/`;
  const rest = body.image_key.startsWith(prefix) ? body.image_key.slice(prefix.length) : null;
  if (rest === null || !/^[A-Za-z0-9._-]+$/.test(rest)) {
    return { status: 403, body: { error: 'forbidden image_key' } };
  }
```

(c) Replace every remaining `body.user_id` with `userId` (4 occurrences: the LLM-error usage row, the `insertRow` call's `user_id`, the insert-error usage row, and the success usage row). After this, `grep -n "body.user_id" supabase/functions/transcribe-note/handler.ts` MUST be empty.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run supabase/functions/transcribe-note/handler.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/transcribe-note/handler.ts supabase/functions/transcribe-note/handler.test.ts
git commit -m "fix(security): transcribe-note IDOR guard validates the JWT user, not body.user_id (#2,#3)"
```

---

## Task 4: Wire JWT identity + transcription quota into `transcribe-note/index.ts`

**Files:**
- Modify: `supabase/functions/transcribe-note/index.ts`

- [ ] **Step 1: Read the file**

Read `supabase/functions/transcribe-note/index.ts`. The whole `serve` body is wrapped in a `try/catch` that returns 500 on any throw (so a quota count-error throw fails closed). Note the existing import block and the `handleTranscribe({...}, body)` call.

- [ ] **Step 2: Add imports**

After the existing `import { handleTranscribe } from './handler.ts';` line, add:

```ts
import { bearerToken, deriveUserId } from '../_shared/auth-identity.ts';
import { resolveQuotaLimits, checkQuota, supabaseQuotaDeps } from '../_shared/quota.ts';
```

- [ ] **Step 3: Derive identity + enforce the transcription quota, and pass `userId` to the handler**

Find:

```ts
    let body: { user_id?: string; image_key?: string };
    try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }

    const supabase = serviceClient();
    const llm = createAnthropicAdapter({ apiKey: anthropicKey, fetch });

    const res = await handleTranscribe({
```

Replace with:

```ts
    let body: { image_key?: string };
    try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }

    const supabase = serviceClient();

    // Identity from the verified JWT, never from the request body.
    const userId = await deriveUserId(supabase, bearerToken(req));
    if (!userId) return jsonResp({ error: 'unauthorized' }, 401);

    // Transcription quota — a separate bucket from generation (counts only
    // note_transcription rows). A count error throws and is surfaced as a 500
    // by the top-level catch (fail closed). Cache-free path: every call that
    // reaches the model records exactly one usage row.
    const cfg = resolveQuotaLimits(Deno.env);
    const quota = await checkQuota(supabaseQuotaDeps(supabase), cfg.transcription, cfg.global, { userId, nowMs: Date.now() });
    if (!quota.ok) return jsonResp({ error: 'quota_exceeded', reason: quota.reason }, 429);

    const llm = createAnthropicAdapter({ apiKey: anthropicKey, fetch });

    const res = await handleTranscribe({
```

- [ ] **Step 4: Pass `userId` as the third argument to `handleTranscribe`**

Find the end of the `handleTranscribe({ … }, body)` call. The deps object ends with `recordUsage: (usageRow) => recordLamplightUsage(supabase, usageRow),` then `}, body);`. Change the final argument list from `}, body);` to:

```ts
    }, body, userId);
```

- [ ] **Step 5: Verify**

Run: `grep -n "body.user_id" supabase/functions/transcribe-note/index.ts`
Expected: empty (no live use).

Run: `npx vitest run supabase/functions/transcribe-note`
Expected: PASS (handler suite, 7 tests — unaffected by index wiring).

Run (best-effort typecheck): `deno check supabase/functions/transcribe-note/index.ts`
Expected: success, OR an environment-only failure (remote module / npm dep cache). Do NOT block on an environment error; fix only a genuine type error in this file.

- [ ] **Step 6: Manual verification (no deployed-function test harness)**

Record outcomes; do not skip.
1. **Identity not spoofable / IDOR closed:** invoke `transcribe-note` with user A's JWT and `image_key: "note-scans/<B uuid>/<file>"`. Expected: `403 forbidden image_key` (the key isn't under A's folder). Pre-fix, sending `user_id: "<B>"` + B's key returned B's transcription.
2. **Unauthorized:** invoke with no `Authorization` header. Expected: `401 unauthorized`.
3. **Quota:** with a `none`-tier user, invoke 6 valid transcriptions in <24h. Expected: the 6th returns `429 quota_exceeded` reason `user_quota` (transcription limit = 5). Confirm generation quota is unaffected (a `lamplight-generate` call still succeeds).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/transcribe-note/index.ts
git commit -m "fix(security): JWT identity + transcription quota on transcribe-note (#2,#3,#4)"
```

---

## Self-Review

- **Spec coverage:** Component 1 (kind-scoped quota) → Task 1. Component 2 (lamplight-generate generation scope) → Task 2. Component 3 (transcribe-note identity + IDOR + quota) → Tasks 3 (handler) + 4 (wiring). `embed-note` excluded per spec — no task, correct. All spec sections map to a task.
- **Type consistency:** `QuotaScope`, `QuotaConfig`, `QuotaDeps` (with the 3-arg `countUserUsage`), and `checkQuota(deps, scope, global, args)` are used identically in Tasks 1, 2, 4 and the tests. `handleTranscribe(deps, body, userId)` and `TranscribeBody = { image_key?: string }` are consistent across Tasks 3 and 4. `resolveQuotaLimits` returns `QuotaConfig` everywhere it's consumed.
- **Placeholder scan:** none — every code/test step has complete content.
- **Independence check:** Task 2 must follow Task 1 (call-site arity depends on the new signature); Task 4 must follow Task 3 (passes `userId` to the new handler signature). Order is 1 → 2 → 3 → 4. Vitest stays green after each task (no test imports `index.ts`).
