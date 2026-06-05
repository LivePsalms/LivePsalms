# Batch C Security Remediation — Design

**Date:** 2026-06-03
**Status:** Approved (design); pending implementation
**Predecessors:** [Batch A](2026-06-03-batch-a-security-remediation-design.md), [Batch B](2026-06-03-batch-b-security-remediation-design.md) (both merged).

## Background

The 2026-06-03 audit's Batch C covers finding #5: `verify_jwt` is not explicitly pinned per
function in `supabase/config.toml`. (Finding #6 — user-editable gamification columns — was already
resolved by Batch A's `profiles` trigger, so it needs no work here.)

Today there is **no `[functions]` block** in `supabase/config.toml`, so all Edge Functions rely on
the Supabase platform default (`verify_jwt = true`). That default is correct, but implicit: a future
`supabase functions deploy --no-verify-jwt` (or a dashboard toggle) could silently disable JWT
verification on a function, turning every downstream auth/identity/quota control built in Batches A
and B into an unauthenticated free-for-all. Pinning `verify_jwt = true` explicitly per function makes
the invariant version-controlled and reviewable.

## Verified facts

- No `[functions]` blocks exist in `supabase/config.toml` (only `[edge_runtime]` at line 369).
- All three functions require authentication and are safe with `verify_jwt = true`:
  - `lamplight-generate` — browser-invoked with the user JWT (`functions.invoke`).
  - `transcribe-note` — browser-invoked with the user JWT (`functions.invoke`).
  - `embed-note` — browser-invoked for the `{ job_id }` path (user JWT) **and** called by the
    `pg_cron` sweep, which sends the **service_role key as a Bearer JWT**
    ([011_lamplight_signal_layer.sql:141-145](../../../supabase/migrations/011_lamplight_signal_layer.sql)).
    The service_role key is a valid signed JWT, so `verify_jwt = true` accepts the cron call — the
    sweep path does not break.

## Change

Add to `supabase/config.toml`, immediately after the `[edge_runtime]` section (before `[analytics]`):

```toml
# Pin JWT verification per function. The Supabase default is already
# verify_jwt = true; pinning it here keeps the invariant in version control so a
# future `supabase functions deploy --no-verify-jwt` (or dashboard toggle) can't
# silently expose these endpoints. All three require auth:
#   - lamplight-generate, transcribe-note: browser-invoked with the user JWT.
#   - embed-note: browser-invoked ({ job_id }) AND called by the pg_cron sweep,
#     which sends the service_role key as a Bearer JWT — so verify_jwt = true is
#     safe on the cron path too (a valid signed JWT).
[functions.lamplight-generate]
verify_jwt = true

[functions.transcribe-note]
verify_jwt = true

[functions.embed-note]
verify_jwt = true
```

No behavior change today (the default is already `true`); this pins and documents the invariant.

## Testing

There is no logic to unit-test (TOML config). Verification is:

1. **Structural** — `supabase/config.toml` contains the three `[functions.<name>]` blocks, each with
   `verify_jwt = true`. Confirm by inspection/grep.
2. **Manual e2e (post-deploy, needs a deploy)** — `curl -X POST <function-url>` with **no**
   `Authorization` header for each of the three functions → expect `401` from the platform gateway
   before the function body runs. (A request with a valid user/service JWT still succeeds, proving
   the cron sweep is unaffected.)

## Out of scope

- CORS allow-origin lockdown + Voyage-key hygiene → **Batch D**.
- Any change to function code, the cron schedule, or other `config.toml` sections.

## Implementation note

This is a 6-line config pin with no testable logic, so it will be implemented **inline** (single
edit + structural verification + commit) rather than via the worktree + multi-subagent flow used for
Batches A/B.
