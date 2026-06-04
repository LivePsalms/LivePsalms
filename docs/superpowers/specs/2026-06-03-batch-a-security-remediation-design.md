# Batch A Security Remediation — Design

**Date:** 2026-06-03
**Status:** Approved (design); pending implementation plan
**Deployment context:** App is deployed (Edge Functions live) but with no/few real users. Fix
urgently; no incident-response (key rotation / live-row audit) required.

## Background

A security audit of Psalms_app (Vite + React SPA → Supabase Postgres + Edge Functions; AI
"Lamplight" layer calling Anthropic + Voyage from Edge Functions) produced 8 findings across 4
severities. All findings were re-verified against the live code before this design was written.

The 8 findings are being remediated in four sequenced sub-projects, each with its own
spec → plan → implementation cycle:

| Batch | Findings | Theme |
|-------|----------|-------|
| **A (this spec)** | #1 Critical, #4 High, + JWT-identity slice of #2 | Admin self-promotion guard + AI spend cap |
| B | #2 High, #3 High | JWT identity + storage IDOR guard for `transcribe-note`/`embed-note` |
| C | #5 Med, #6 Med | Explicit `verify_jwt` config + gamification-column guard (#6 resolved by Batch A) |
| D | #7 Low, #8 Low | Voyage-key hygiene + CORS lockdown |

## Scope of Batch A

Three changes across two Edge-Function files and one new migration:

1. **Finding #1 (Critical)** — privileged-column guard trigger on `profiles`. Also resolves
   **Finding #6** (gamification counters share the same root cause and the same trigger).
2. **JWT-derived identity** for `lamplight-generate` — the slice of Finding #2 that Finding #4
   depends on (a per-user quota keyed on a spoofable `body.user_id` is meaningless).
3. **Finding #4 (High)** — per-user/tier quota plus a global daily ceiling on `lamplight-generate`.

## Verified facts that shape the design

- `profiles` UPDATE policy is `using (auth.uid() = id)` with no `WITH CHECK` and no column
  restriction ([001_profiles.sql:21](../../../supabase/migrations/001_profiles.sql)). `is_admin`
  (added in 015) lives on this user-updatable row.
- The only `BEFORE UPDATE` trigger on `profiles` today just sets `updated_at`
  ([003_triggers.sql:67](../../../supabase/migrations/003_triggers.sql)).
- `update_note_count()` is **SECURITY DEFINER** ([003_triggers.sql:48](../../../supabase/migrations/003_triggers.sql))
  and writes `profiles.note_count` / `highest_note_count` during ordinary authenticated note inserts.
- `auth.role()` is **request-scoped from the JWT** and stays `'authenticated'` even inside a
  SECURITY DEFINER function. `current_user` **does** become the function owner inside SECURITY
  DEFINER. → The guard must gate on `current_user`, not `auth.role()`, or it would raise inside
  `update_note_count()` and break note creation.
- Client code writes only `full_name` / `username` / `date_of_birth` / `avatar_url` to `profiles`
  ([account-profile.ts:63](../../../src/auth/profile/account-profile.ts)). It never writes
  `is_admin`, `note_count`, `highest_note_count`, or `last_acknowledged_tier_threshold`. Locking
  all four is therefore safe — no client feature regresses.
- `lamplight-generate` reads `body.user_id` and never calls `getUser()`
  ([lamplight-generate/index.ts:79](../../../supabase/functions/lamplight-generate/index.ts)); it
  acts on that id with the service-role client (RLS bypassed).
- Entitlement tiers are `'plus' | 'lite' | 'none'` (default `'none'`), and `lamplight_entitlements`
  is SELECT-only for users ([008_lamplight_schema.sql:52](../../../supabase/migrations/008_lamplight_schema.sql)).
- `lamplight_usage` has `(user_id, created_at, status, artifact_kind, ...)`, indexes on
  `(user_id, created_at desc)` and `(created_at desc)`, and **no INSERT/UPDATE/DELETE policy**
  (service-role writes only) ([015_lamplight_entitlements_ui.sql](../../../supabase/migrations/015_lamplight_entitlements_ui.sql)).
  It is a sound, tamper-proof home for a count-based quota.
- Today usage rows are written on error paths and inside some pipelines, but **`smoke_test`
  success writes no row** — so a naive count-based quota under-reports unless recording is
  centralized to exactly one row per billable request.

## Component 1 — Privileged-column trigger

New migration `021_protect_privileged_profile_columns.sql`:

```sql
-- Intentionally SECURITY INVOKER (the default — do NOT add `security definer`).
-- A SECURITY DEFINER function runs as its owner, so current_user would become
-- the owner and the guard below would never match — rendering it inert.
create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Gate on current_user (the executing DB role), NOT auth.role() (JWT-scoped,
  -- stays 'authenticated' inside SECURITY DEFINER triggers like update_note_count).
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

**Behavior matrix:**

| Source of UPDATE | `current_user` | Privileged column change |
|------------------|----------------|--------------------------|
| Browser / authenticated client | `authenticated` | **Blocked** (raises) |
| Anon client | `anon` | **Blocked** (raises) |
| `update_note_count()` (SECURITY DEFINER) during note insert | owner (e.g. `postgres`) | Allowed |
| Service-role key (Edge Functions, admin) | `service_role` | Allowed |
| Migrations / SQL console | `postgres` / `supabase_admin` | Allowed |

This makes the audit's reported one-line escalation
(`supabase.from('profiles').update({ is_admin: true })`) raise an exception, and closes the same
hole for the gamification counters (Finding #6).

## Component 2 — JWT-derived identity in `lamplight-generate`

Immediately after the body is parsed, derive the caller from the verified JWT and use that id for
**everything** downstream; `body.user_id` is ignored entirely (not merely compared).

```ts
const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
if (authErr || !user) return jsonResp({ error: 'unauthorized' }, 401);
const userId = user.id;   // replaces every prior use of body.user_id
```

- Platform `verify_jwt` already rejects unauthenticated callers; `getUser()` adds *identity* on
  top of *authentication*.
- `body.user_id` is removed from the dispatch logic. The body type may retain the field for
  backward-compat with the client, but the server never reads it for identity.
- This alone neutralizes the cross-user read/exfiltration in Finding #2 **for `lamplight-generate`**.
  `transcribe-note` / `embed-note` are Batch B.

## Component 3 — Quota enforcement (Approach A: count + global ceiling)

New shared module `supabase/functions/_shared/quota.ts`.

**Limits** (constants with optional `Deno.env` override per environment):

```
PER_USER_DAILY = { none: 10, lite: 50, plus: 200 }   // rolling 24h, one combined bucket
GLOBAL_DAILY   = 2000                                 // all users, rolling 24h
```

**`checkQuota(supabase, userId)`** runs after the `settings.enabled` check and **before** any
context build or model call:

1. Read tier from `lamplight_entitlements` for `userId` (`maybeSingle`, default `'none'`).
2. Count this user's `lamplight_usage` rows where `created_at >= now() - 24h`.
   If `>= PER_USER_DAILY[tier]` → return `{ ok: false, reason: 'user_quota' }`.
3. Count **all** `lamplight_usage` rows where `created_at >= now() - 24h`.
   If `>= GLOBAL_DAILY` → return `{ ok: false, reason: 'global_quota' }`.
4. Otherwise `{ ok: true }`.

On a blocked result, `handleGenerate` returns HTTP **429** with the reason. Counts use
`select('id', { count: 'exact', head: true })` against the existing indexes.

**Reliability fix (required for the count to be trustworthy):** centralize usage recording so
every billable request writes **exactly one** `lamplight_usage` row on both success and error,
replacing today's scattered/missing inserts (notably `smoke_test` success). The pre-check counts
prior rows; the request's own row is written at completion. Effect: the Nth call sees N−1 prior
rows, so a user gets exactly `limit` calls before the next is blocked.

**Accepted limitation:** under concurrency, simultaneous requests can each read "under limit" and
proceed, allowing a small overage (≤ concurrency−1). Acceptable for a spend cap; not a hard
boundary. If exact enforcement is later required, migrate to the atomic SECURITY DEFINER counter
(audit Approach B).

**Counting policy:** all `lamplight_usage` rows in the window count toward quota, including
early-return error paths (`no_embedding`, `not_neighbor`). This is deliberate — it also throttles
abusive looping of cheap error paths. Can be refined later if it proves too strict.

## Testing

- **Trigger (integration / pgTAP):**
  - Authenticated client `UPDATE profiles SET is_admin = true` → rejected.
  - Authenticated client `UPDATE` of `note_count` / `last_acknowledged_tier_threshold` → rejected.
  - **Regression:** authenticated note insert still updates `note_count` (the SECURITY DEFINER
    path is unaffected).
  - Service-role `UPDATE is_admin` → allowed.
- **JWT identity:** request carrying user A's JWT with `body.user_id = B` → operates on A; no
  access to B's data. Request with no/invalid token → 401.
- **Quota:** user at tier limit → 429 `user_quota`; global ceiling reached → 429 `global_quota`;
  under-limit → 200. Every billable kind writes exactly one `lamplight_usage` row (success and
  error).

## Out of scope (deferred to later batches)

- `transcribe-note` / `embed-note` JWT identity, image-key IDOR guard, and their quota → **Batch B**.
  (The global ceiling gives partial coverage if those functions write `lamplight_usage` rows.)
- Explicit per-function `verify_jwt = true` in `config.toml` → **Batch C**.
- CORS allow-origin lockdown and Voyage-key hygiene → **Batch D**.

## Operational note (not code)

Set hard budget caps + alerts in the Anthropic and Voyage dashboards as an absolute backstop,
independent of application-level quota. Recommended regardless of batch sequencing.
