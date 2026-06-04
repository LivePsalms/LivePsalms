# Batch D Security Remediation — Design

**Date:** 2026-06-03
**Status:** Approved (design); pending implementation plan
**Predecessors:** Batches A, B (merged), C (merged). This is the final batch.

## Background

The 2026-06-03 audit's Batch D covers the two LOW findings:
- **#8 — Wildcard CORS.** All three Edge Functions hardcode
  `'Access-Control-Allow-Origin': '*'` ([transcribe-note/index.ts:17](../../../supabase/functions/transcribe-note/index.ts),
  [lamplight-generate/index.ts:44](../../../supabase/functions/lamplight-generate/index.ts),
  [embed-note/index.ts:40](../../../supabase/functions/embed-note/index.ts)). Now that identity/quota
  are JWT-enforced (Batches A–C), CORS should be locked to the app's real origin(s) as defense in
  depth against drive-by browser calls.
- **#7 — Voyage-key hygiene.** `VOYAGE_AI_KEY` is a server-side secret (Edge Functions read it via
  `Deno.env`) but is documented in `.env.local.example` alongside client `VITE_*` vars — unlike
  `ANTHROPIC_API_KEY`, which the same file documents as a `supabase secrets` value that must never
  go in `.env.local`. Git contains only the placeholder `my_secret_key`, never a real key (confirmed).

## Verified facts

- The functions read no origin/site env var today (only `ANTHROPIC_API_KEY`, `VOYAGE_AI_KEY`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RERANK_ENABLED`).
- `Access-Control-Allow-Origin` accepts a single origin or `*` — never a list. Multi-origin support
  requires reflecting the request `Origin` header when it is allow-listed, plus `Vary: Origin`.
- `embed-note` is called by the `pg_cron` sweep (server-to-server, **no `Origin` header**) and by the
  browser (`{ job_id }`). CORS is a browser-only mechanism, so the cron path is unaffected by any CORS
  change; only the browser path is governed by the allow-list.
- The existing functions deliberately route **every** response (including errors and the `OPTIONS`
  preflight) through CORS headers, because an uncaught throw makes the Supabase runtime emit a
  header-less 500 that the browser misreports as a CORS error. The new design preserves this.

## Component 1 — Shared CORS helper (`supabase/functions/_shared/cors.ts`, new)

Two pure, dependency-injected functions (unit-tested like `quota.ts` / `auth-identity.ts`):

```ts
const DEV_FALLBACK_ORIGINS = [
  'http://localhost:5173', 'http://127.0.0.1:5173',
  'http://localhost:3000', 'http://127.0.0.1:3000',
];

const BASE_CORS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ALLOWED_ORIGINS (comma-separated) set via `supabase secrets` in prod.
// Unset → dev fallback (local development convenience).
export function resolveAllowedOrigins(env: { get(k: string): string | undefined }): string[] {
  const raw = env.get('ALLOWED_ORIGINS');
  if (!raw) return DEV_FALLBACK_ORIGINS;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

// Reflect the request Origin only when allow-listed; always set Vary: Origin so
// caches don't serve one origin's allow-header to another. A disallowed or
// missing Origin yields no Access-Control-Allow-Origin (the browser blocks it),
// while server-to-server callers (cron, no Origin) are unaffected.
export function corsHeaders(
  req: { headers: { get(name: string): string | null } },
  allowed: string[],
): Record<string, string> {
  const origin = req.headers.get('Origin');
  const headers: Record<string, string> = { ...BASE_CORS, Vary: 'Origin' };
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}
```

## Component 2 — Wire into the three functions

In each of `lamplight-generate/index.ts`, `transcribe-note/index.ts`, `embed-note/index.ts`:
- Import `resolveAllowedOrigins, corsHeaders` from `../_shared/cors.ts`.
- Remove the hardcoded `CORS_HEADERS` constant (the one with `'*'`).
- At the **start of each request** compute `const cors = corsHeaders(req, resolveAllowedOrigins(Deno.env));`.
- Use `cors` on **every** response: the `OPTIONS` preflight, all success responses, and all error
  responses. Update each function's `jsonResp` helper to accept the `cors` headers (e.g.
  `jsonResp(body, status, cors)`), and pass `cors` at every call site, so a thrown error still
  returns CORS headers.

Behavioral result: a browser request from an allow-listed origin gets that origin echoed back; a
disallowed origin gets no allow-origin header (blocked by the browser); the cron sweep (no `Origin`)
is unchanged.

## Component 3 — Voyage-key hygiene (#7)

- **`.env.local.example`:** remove `VOYAGE_AI_KEY=my_secret_key` from the top (client) section and
  document it as a server-side secret, mirroring the existing `ANTHROPIC_API_KEY` guidance:
  `supabase secrets set VOYAGE_AI_KEY=...` (never in `.env.local`). Add an `ALLOWED_ORIGINS` note in
  the same server-secrets section: `supabase secrets set ALLOWED_ORIGINS=https://yourdomain.com`.
- **Operational (user action, not code):** rotate the live Voyage key, set it via `supabase secrets`
  in production, and remove it from the local `.env.local`. The implementation will **not** modify
  the gitignored `.env.local`.

## Testing

- **`cors.test.ts` (unit):**
  - `resolveAllowedOrigins`: unset env → the four dev-fallback origins; set env → parsed list with
    trimming and empty-segment filtering.
  - `corsHeaders`: allow-listed origin → `Access-Control-Allow-Origin` equals that origin and `Vary:
    Origin` present; disallowed origin → no `Access-Control-Allow-Origin`; missing `Origin` header →
    no `Access-Control-Allow-Origin`; base methods/headers always present.
- **Wiring:** glue (no deployed-function test harness). The existing function vitest suites must stay
  green. Best-effort `deno check` on each edited `index.ts`. **Manual e2e (post-deploy):** a browser
  call from an allow-listed origin succeeds; a non-listed origin is blocked by the browser; the
  `pg_cron` sweep still drains the queue (no `Origin`, unaffected).

## Out of scope

Nothing deferred — Batch D is the last of the four batches. Remaining work after this is purely
operational (key rotation, setting `ALLOWED_ORIGINS`/secrets in prod, dashboard budget caps, and the
deploy-time manual e2e checks from all four batches).
