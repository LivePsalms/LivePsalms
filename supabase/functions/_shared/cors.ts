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
