# Batch D Security Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the Edge Functions' CORS from `*` to an origin allow-list (env-driven, reflect-if-allowed) and fix the Voyage-key documentation hygiene, completing the security remediation.

**Architecture:** A new pure `_shared/cors.ts` resolves an `ALLOWED_ORIGINS` env allow-list (with a localhost dev fallback) and builds CORS headers that echo the request `Origin` only when allow-listed. Each function computes `cors` per request and defines a local `jsonResp` closure over it, so existing `jsonResp(...)` call sites stay unchanged and every response (preflight, success, error) carries the right CORS headers. `.env.local.example` is corrected to document `VOYAGE_AI_KEY` (and `ALLOWED_ORIGINS`) as server-side secrets.

**Tech Stack:** Deno Edge Functions (TypeScript), Vitest (node env). Mirrors the dependency-injected pure-module pattern of `_shared/quota.ts` / `_shared/auth-identity.ts`.

**Spec:** [docs/superpowers/specs/2026-06-03-batch-d-security-remediation-design.md](../specs/2026-06-03-batch-d-security-remediation-design.md)

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `supabase/functions/_shared/cors.ts` | Resolve allow-list + build origin-reflecting CORS headers | Create |
| `supabase/functions/_shared/cors.test.ts` | Unit tests for the helper | Create |
| `supabase/functions/lamplight-generate/index.ts` | Per-request CORS via helper (serve + handleGenerate) | Modify |
| `supabase/functions/transcribe-note/index.ts` | Per-request CORS via helper | Modify |
| `supabase/functions/embed-note/index.ts` | Per-request CORS via helper | Modify |
| `.env.local.example` | Document VOYAGE_AI_KEY + ALLOWED_ORIGINS as server-side secrets | Modify |

---

## Task 1: Shared CORS helper

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Test: `supabase/functions/_shared/cors.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `supabase/functions/_shared/cors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveAllowedOrigins, corsHeaders } from './cors';

const env = (map: Record<string, string>) => ({ get: (k: string) => map[k] });
const reqWith = (origin?: string) => ({ headers: { get: (n: string) => (n === 'Origin' ? origin ?? null : null) } });

describe('resolveAllowedOrigins', () => {
  it('falls back to the localhost dev origins when ALLOWED_ORIGINS is unset', () => {
    expect(resolveAllowedOrigins(env({}))).toEqual([
      'http://localhost:5173', 'http://127.0.0.1:5173',
      'http://localhost:3000', 'http://127.0.0.1:3000',
    ]);
  });

  it('parses a comma-separated list, trimming whitespace and dropping empties', () => {
    expect(resolveAllowedOrigins(env({ ALLOWED_ORIGINS: 'https://a.com, https://b.com ,' })))
      .toEqual(['https://a.com', 'https://b.com']);
  });
});

describe('corsHeaders', () => {
  const allowed = ['https://app.example.com'];

  it('echoes the Origin when it is allow-listed, with Vary: Origin', () => {
    const h = corsHeaders(reqWith('https://app.example.com'), allowed);
    expect(h['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    expect(h['Vary']).toBe('Origin');
    expect(h['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
    expect(h['Access-Control-Allow-Headers']).toContain('authorization');
  });

  it('omits Access-Control-Allow-Origin for a disallowed Origin', () => {
    const h = corsHeaders(reqWith('https://evil.example.com'), allowed);
    expect(h['Access-Control-Allow-Origin']).toBeUndefined();
    expect(h['Vary']).toBe('Origin');
  });

  it('omits Access-Control-Allow-Origin when there is no Origin header (e.g. cron)', () => {
    const h = corsHeaders(reqWith(undefined), allowed);
    expect(h['Access-Control-Allow-Origin']).toBeUndefined();
    expect(h['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run supabase/functions/_shared/cors.test.ts`
Expected: FAIL — `Cannot find module './cors'`.

- [ ] **Step 3: Create `cors.ts`**

Create `supabase/functions/_shared/cors.ts`:

```ts
// supabase/functions/_shared/cors.ts
//
// CORS for the Edge Functions. Access-Control-Allow-Origin can only hold a
// single origin or '*', so multi-origin support means reflecting the request
// Origin when it is allow-listed (plus Vary: Origin so caches don't mix them).
// A disallowed or missing Origin yields no allow-origin header (the browser
// blocks it); server-to-server callers (pg_cron, no Origin) are unaffected.

const DEV_FALLBACK_ORIGINS = [
  'http://localhost:5173', 'http://127.0.0.1:5173',
  'http://localhost:3000', 'http://127.0.0.1:3000',
];

const BASE_CORS: Record<string, string> = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ALLOWED_ORIGINS (comma-separated) is set via `supabase secrets` in production.
// Unset → the localhost dev fallback (convenience for local development).
export function resolveAllowedOrigins(env: { get(key: string): string | undefined }): string[] {
  const raw = env.get('ALLOWED_ORIGINS');
  if (!raw) return DEV_FALLBACK_ORIGINS;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

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

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run supabase/functions/_shared/cors.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/cors.ts supabase/functions/_shared/cors.test.ts
git commit -m "feat(security): add origin-reflecting CORS helper (#8)"
```

---

## Task 2: Wire the CORS helper into all three functions

**Files:**
- Modify: `supabase/functions/transcribe-note/index.ts`
- Modify: `supabase/functions/embed-note/index.ts`
- Modify: `supabase/functions/lamplight-generate/index.ts`

The pattern for each function: import the helper, delete the module-level `CORS_HEADERS` constant (and any module-level `jsonResp`), and at the top of the request handler compute `cors` + a local `jsonResp` closure over it, switching the `OPTIONS`/`405` raw responses to `cors`. Existing `jsonResp(...)` call sites stay unchanged.

### 2a — `transcribe-note/index.ts`

- [ ] **Step 1: Add the import**

After the existing line `import { resolveQuotaLimits, checkQuota, supabaseQuotaDeps } from '../_shared/quota.ts';`, add:

```ts
import { resolveAllowedOrigins, corsHeaders } from '../_shared/cors.ts';
```

- [ ] **Step 2: Remove the module-level CORS const + jsonResp**

Delete this block:

```ts
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const jsonResp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } });
```

- [ ] **Step 3: Compute per-request cors + jsonResp at the top of serve**

Find:

```ts
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405);
```

Replace with:

```ts
serve(async (req) => {
  const cors = corsHeaders(req, resolveAllowedOrigins(Deno.env));
  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405);
```

### 2b — `embed-note/index.ts`

- [ ] **Step 4: Add the import**

After the existing `import { ... } from '../_shared/process-job.ts';` block, add:

```ts
import { resolveAllowedOrigins, corsHeaders } from '../_shared/cors.ts';
```

- [ ] **Step 5: Remove the module-level CORS const**

Delete:

```ts
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

- [ ] **Step 6: Compute per-request cors + jsonResp at the top of serve; switch OPTIONS/405**

Find:

```ts
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS_HEADERS });
```

Replace with:

```ts
serve(async (req) => {
  const cors = corsHeaders(req, resolveAllowedOrigins(Deno.env));
  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors });
```

- [ ] **Step 7: Remove the now-duplicate module-level jsonResp**

Delete the module-level function (the `cors`-less one):

```ts
function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}
```

### 2c — `lamplight-generate/index.ts`

- [ ] **Step 8: Add the import**

After the existing `import { resolveQuotaLimits, checkQuota, supabaseQuotaDeps } from '../_shared/quota.ts';`, add:

```ts
import { resolveAllowedOrigins, corsHeaders } from '../_shared/cors.ts';
```

- [ ] **Step 9: Remove the module-level CORS const**

Delete:

```ts
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

- [ ] **Step 10: Compute per-request cors + jsonResp at the top of serve; switch OPTIONS**

Find:

```ts
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405);
```

Replace with:

```ts
serve(async (req) => {
  const cors = corsHeaders(req, resolveAllowedOrigins(Deno.env));
  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405);
```

- [ ] **Step 11: Add per-request cors + jsonResp at the top of handleGenerate**

Find:

```ts
async function handleGenerate(req: Request): Promise<Response> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
```

Replace with:

```ts
async function handleGenerate(req: Request): Promise<Response> {
  const cors = corsHeaders(req, resolveAllowedOrigins(Deno.env));
  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
```

- [ ] **Step 12: Remove the now-duplicate module-level jsonResp**

Delete the module-level function (the `CORS_HEADERS`-less one near the bottom):

```ts
function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}
```

### Verify (all three)

- [ ] **Step 13: No wildcard / stale CORS_HEADERS remains**

Run: `grep -rn "Access-Control-Allow-Origin': '\*'\|CORS_HEADERS" supabase/functions/lamplight-generate/index.ts supabase/functions/transcribe-note/index.ts supabase/functions/embed-note/index.ts`
Expected: empty (no `'*'` literal, no remaining `CORS_HEADERS` references).

Run: `grep -rn "corsHeaders(req, resolveAllowedOrigins" supabase/functions/lamplight-generate/index.ts supabase/functions/transcribe-note/index.ts supabase/functions/embed-note/index.ts`
Expected: lamplight-generate appears twice (serve + handleGenerate); transcribe-note and embed-note once each.

- [ ] **Step 14: Regression suites + best-effort typecheck**

Run: `npx vitest run supabase/functions`
Expected: PASS (the existing pipeline/handler/shared suites are unaffected by the CORS wiring).

Run (best-effort, per function): `deno check supabase/functions/lamplight-generate/index.ts supabase/functions/transcribe-note/index.ts supabase/functions/embed-note/index.ts`
Expected: success, OR an environment-only failure (missing remote/npm dep in the deno cache). Do NOT block on an environment error; fix only a genuine type error in the edits.

- [ ] **Step 15: Commit**

```bash
git add supabase/functions/lamplight-generate/index.ts supabase/functions/transcribe-note/index.ts supabase/functions/embed-note/index.ts
git commit -m "fix(security): lock Edge Function CORS to an origin allow-list (#8)"
```

---

## Task 3: Document Voyage key + ALLOWED_ORIGINS as server-side secrets (#7)

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: Move VOYAGE_AI_KEY out of the client section and document the secrets**

Find:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VOYAGE_AI_KEY=my_secret_key

# === Lamplight Reasoning Layer (sub-project 3) ===
#
# ANTHROPIC_API_KEY is server-side only. The Edge Function reads it via
# Deno.env. Set it via:
#   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# Do NOT put it in .env.local — the browser must never see this key.
#
```

Replace with:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# === Lamplight Reasoning Layer (sub-project 3) ===
#
# ANTHROPIC_API_KEY is server-side only. The Edge Function reads it via
# Deno.env. Set it via:
#   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# Do NOT put it in .env.local — the browser must never see this key.
#
# VOYAGE_AI_KEY is ALSO server-side only (embed-note / lamplight-generate read
# it via Deno.env). Set it as a secret, never in .env.local:
#   supabase secrets set VOYAGE_AI_KEY=...
#
# ALLOWED_ORIGINS locks the Edge Functions' CORS allow-list (comma-separated).
# Unset → localhost dev fallback. In production set your real origin(s):
#   supabase secrets set ALLOWED_ORIGINS=https://yourdomain.com
#
```

- [ ] **Step 2: Verify**

Run: `grep -n "VOYAGE_AI_KEY\|ALLOWED_ORIGINS" .env.local.example`
Expected: `VOYAGE_AI_KEY` and `ALLOWED_ORIGINS` appear only inside the server-side comment block (no bare `VOYAGE_AI_KEY=my_secret_key` assignment line at the top).

- [ ] **Step 3: Commit**

```bash
git add .env.local.example
git commit -m "docs(security): document VOYAGE_AI_KEY + ALLOWED_ORIGINS as server-side secrets (#7)"
```

---

## Operational follow-up (user action, not code)

- [ ] Rotate the live Voyage key, set it via `supabase secrets set VOYAGE_AI_KEY=...`, and remove it
  from the local `.env.local`.
- [ ] Set `supabase secrets set ALLOWED_ORIGINS=https://<your-prod-origin>` before/with deploy.
- [ ] Manual e2e (post-deploy): a browser call from an allow-listed origin succeeds; a non-listed
  origin is blocked by the browser; the `pg_cron` embed sweep still drains the queue.

---

## Self-Review

- **Spec coverage:** Component 1 (cors helper) → Task 1. Component 2 (wire all three functions) →
  Task 2 (2a/2b/2c). Component 3 (Voyage-key + ALLOWED_ORIGINS docs, #7) → Task 3. Operational
  rotation/secret-setting → follow-up checklist. All spec sections map to a task.
- **Type consistency:** `resolveAllowedOrigins(env)` and `corsHeaders(req, allowed)` are used
  identically in Tasks 1 and 2 and the tests. Each function's local `jsonResp` keeps the original
  `(body, status?) => Response` signature, so existing call sites are unchanged.
- **Placeholder scan:** none — every step has complete content.
- **Ordering/independence:** Task 2 depends on Task 1 (imports the helper). Task 3 is independent.
  Vitest stays green after each task (the cors suite is self-contained; no test imports the function
  `index.ts` files). lamplight-generate computes `cors` in BOTH `serve` and `handleGenerate` (each
  has its own `req`), so both scopes' responses carry CORS — intentional, not duplication to remove.
