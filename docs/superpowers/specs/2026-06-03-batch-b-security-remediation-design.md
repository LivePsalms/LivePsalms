# Batch B Security Remediation — Design

**Date:** 2026-06-03
**Status:** Approved (design); pending implementation plan
**Predecessor:** [Batch A](2026-06-03-batch-a-security-remediation-design.md) (merged) — JWT identity +
quota established for `lamplight-generate`; `_shared/auth-identity.ts` and `_shared/quota.ts` exist.

## Background

The 2026-06-03 security audit's Batch B covers findings #2 (JWT identity) and #3 (storage IDOR) for
the AI Edge Functions other than `lamplight-generate`. Investigation narrowed the actual scope:

- **`embed-note` is excluded** — it is already adequately protected by design. It processes jobs by
  `job_id` (or a `sweep`); `claim_lamplight_job_by_id` only succeeds while a job is `'queued'`, the
  embedded note content belongs to whoever enqueued the job (read from the queue row, not the
  request), and service-role does all reads/writes. A malicious authenticated caller passing
  arbitrary `job_id`s gets `{ processed: 0 }` — no cross-user data, no Voyage cost. Its spend
  surface is bounded by the queue/claim design (a user can only cause embeddings of their own notes,
  via note saves). Raw invocation flooding is a per-IP concern deferred to Batch D. See the trust
  model documented at [embed-note/index.ts:10-18](../../../supabase/functions/embed-note/index.ts).
- **`transcribe-note` already has a path-aware IDOR guard**
  ([handler.ts:41-52](../../../supabase/functions/transcribe-note/handler.ts)) that validates
  `image_key` against `note-scans/{user_id}/{safe-filename}` and rejects `..` traversal. The only
  hole: it checks against the **client-supplied `body.user_id`**, so an attacker sends the victim's
  `user_id` and the victim's key together and the guard passes (service-role download then bypasses
  storage RLS). Deriving `user_id` from the verified JWT makes the existing guard real.

So Batch B reduces to **`transcribe-note` only**: JWT-derived identity (#2) → the existing IDOR
guard (#3) becomes enforceable, plus a quota (#4 extension). It also includes a small refinement to
the merged Batch A quota so the transcription and generation buckets are genuinely independent.

## Scope of Batch B

1. Refactor `_shared/quota.ts` from one combined bucket to **kind-scoped buckets**.
2. Update the Batch A call site (`lamplight-generate/index.ts`) to use the generation scope.
3. `transcribe-note`: JWT-derived identity, the IDOR guard enforced against the JWT user, and a
   separate transcription quota.

## Verified facts that shape the design

- `transcribe-note/index.ts` reads `body.user_id` and `body.image_key`, then downloads via the
  service-role client ([index.ts:47-59](../../../supabase/functions/transcribe-note/index.ts)).
- The handler validates `body.image_key` against `note-scans/${body.user_id}/` with a single-segment
  safe-filename regex (`^[A-Za-z0-9._-]+$`), rejecting traversal
  ([handler.ts:41-52](../../../supabase/functions/transcribe-note/handler.ts)). Identity is the only
  untrusted input.
- The handler records exactly one `lamplight_usage` row per call, `artifact_kind: 'note_transcription'`,
  on each return path (LLM error, save error, success) — the early IDOR/validation rejections return
  before any model call and record nothing (correct: free rejections don't consume quota).
- The client invokes via `supabase.functions.invoke('transcribe-note', …)`
  ([transcription-client.ts:33](../../../src/notepad/scan/transcription-client.ts)), which attaches
  the user's JWT as `Authorization: Bearer`. `deriveUserId` works exactly as in `lamplight-generate`.
- Batch A's `checkQuota` currently counts **all** `lamplight_usage` rows in the window (combined
  bucket). The Batch A spec flagged this as refinable.

## Component 1 — Quota module: kind-scoped buckets (`_shared/quota.ts`)

```ts
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
```

`resolveQuotaLimits(env): QuotaConfig` returns:

| Bucket | kinds | none | lite | plus | env override prefix |
|--------|-------|------|------|------|---------------------|
| generation | `smoke_test`, `daily_devotion`, `connection_card_why` | 10 | 50 | 200 | `LAMPLIGHT_QUOTA_{NONE,LITE,PLUS}` |
| transcription | `note_transcription` | 5 | 20 | 50 | `LAMPLIGHT_QUOTA_TRANSCRIPTION_{NONE,LITE,PLUS}` |
| global | (all) | — | — | — | `LAMPLIGHT_QUOTA_GLOBAL` (=2000) |

(The generation env keys keep their Batch A names for backward compatibility.) The same
invalid/negative-override → default and `0`-is-valid rules from Batch A apply to all keys.

`QuotaDeps` gains a kinds filter on the per-user counter; global stays all-kinds:

```ts
export interface QuotaDeps {
  getTier(userId: string): Promise<Tier>;
  countUserUsage(userId: string, sinceIso: string, kinds: string[]): Promise<number>;
  countGlobalUsage(sinceIso: string): Promise<number>;
}
```

`checkQuota` takes the scope + the global ceiling explicitly:

```ts
export async function checkQuota(
  deps: QuotaDeps,
  scope: QuotaScope,
  global: number,
  args: { userId: string; nowMs: number },
): Promise<QuotaResult>
```

Logic unchanged except it counts `scope.kinds` against `scope.perUser[tier]` (user check first,
then global). `supabaseQuotaDeps.countUserUsage` adds `.in('artifact_kind', kinds)` to the existing
`select('id', { count: 'exact', head: true })` query; it still throws on error (fail closed).

## Component 2 — Refine the Batch A call site (`lamplight-generate/index.ts`)

Replace the Batch A `checkQuota(deps, resolveQuotaLimits(Deno.env), { userId, nowMs })` call with:

```ts
const cfg = resolveQuotaLimits(Deno.env);
const quota = await checkQuota(supabaseQuotaDeps(supabase), cfg.generation, cfg.global, { userId, nowMs: Date.now() });
if (!quota.ok) return jsonResp({ error: 'quota_exceeded', reason: quota.reason }, 429);
```

Net effect: the generation bucket now counts only generation kinds, so `note_transcription` rows no
longer consume the generation budget. Buckets are independent.

## Component 3 — `transcribe-note` identity + IDOR + quota

**`index.ts`:**
- Derive identity from the verified JWT (reusing `_shared/auth-identity.ts`):
  `const userId = await deriveUserId(supabase, bearerToken(req)); if (!userId) return jsonResp({ error: 'unauthorized' }, 401);`
- Enforce the transcription quota before any work:
  `const cfg = resolveQuotaLimits(Deno.env); const q = await checkQuota(supabaseQuotaDeps(supabase), cfg.transcription, cfg.global, { userId, nowMs: Date.now() }); if (!q.ok) return jsonResp({ error: 'quota_exceeded', reason: q.reason }, 429);`
- Call `handleTranscribe(deps, { image_key: body.image_key }, userId)` — passing the trusted `userId`.

**`handler.ts`:**
- Change the signature to `handleTranscribe(deps, body: TranscribeBody, userId: string)` and remove
  `user_id` from `TranscribeBody` (now `{ image_key?: string }`). The handler no longer reads any
  client-supplied identity.
- The IDOR guard validates `image_key` against the trusted `userId`
  (`note-scans/${userId}/` + the existing safe-filename regex). All `recordUsage` rows use `userId`.
- Keep the `image_key` type/shape validation (400) and the IDOR rejection (403) before `downloadImage`.

**Ordering:** identity (401) → quota (429) → handler: validate `image_key` (400/403) → download →
Sonnet → record exactly one `note_transcription` usage row. Fail-closed inherited from the quota
deps (throw → the existing top-level `try/catch` returns 500 with CORS headers).

The client may still send `user_id` in the body; the server ignores it. No client change required
(the JWT is auto-attached by `functions.invoke`).

## Testing

- **`quota.test.ts`:** update existing `checkQuota` calls to the new `(deps, scope, global, args)`
  signature. Add: generation scope counts only generation kinds; transcription scope counts only
  `note_transcription`; the `kinds` array is passed through to `countUserUsage`; global ceiling
  blocks regardless of scope; `resolveQuotaLimits` returns both buckets with correct defaults and
  honors `LAMPLIGHT_QUOTA_TRANSCRIPTION_*` overrides (and rejects invalid ones).
- **`transcribe-note/handler.test.ts`:** update calls to pass `userId` as the third argument and
  drop `user_id` from bodies. Verify: a mismatched-prefix or `..`-traversal `image_key` against the
  trusted `userId` → 403 (no download); a malformed `image_key` → 400; the happy path uses `userId`
  in the IDOR check and in the recorded usage row.
- **`auth-identity`:** reused unchanged (no new tests).
- **Wiring (`transcribe-note/index.ts`):** glue, not unit-covered (no deployed-function harness).
  Manual e2e: request with user A's JWT and `body.user_id = B` → operates on A / 401, never B's
  image; loop past the transcription limit → 429 `quota_exceeded` reason `user_quota`.

## Out of scope (later batches)

- `embed-note` — protected by its queue/claim design (documented above).
- Explicit per-function `verify_jwt = true` in `config.toml` → **Batch C**.
- CORS allow-origin lockdown + Voyage-key hygiene → **Batch D**.

## Operational note

The transcription bucket counts the costlier Sonnet+image path; keep the dashboard budget caps from
Batch A's operational follow-up as the absolute backstop.
