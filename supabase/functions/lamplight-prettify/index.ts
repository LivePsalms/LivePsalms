// supabase/functions/lamplight-prettify/index.ts
//
// One-shot "Prettify" generation. Returns semantic decoration intents for the
// active note. JWT verification stays on at the platform level; this function
// additionally requires lamplight_settings.enabled=true for the caller.
//
// Identity comes from the verified JWT, never from body.user_id. Empty notes
// short-circuit to { ok:false, reason:'no_content' } (200) before quota — they
// incur no model spend.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { createAnthropicAdapter } from '../_shared/anthropic.ts';
import { recordLamplightUsage } from '../_shared/usage.ts';
import { runGeneration, type GenerationLifecycleDeps } from '../_shared/generation-lifecycle.ts';
import { bearerToken, deriveUserId } from '../_shared/auth-identity.ts';
import { resolveQuotaLimits, checkQuota, supabaseQuotaDeps } from '../_shared/quota.ts';
import { resolveAllowedOrigins, corsHeaders } from '../_shared/cors.ts';
import { classifyGenerateError } from '../lamplight-generate/classify-error.ts';
import { runPrettifyPipeline } from './prettify-pipeline.ts';
import type { Density } from './prettify-validators.ts';

function isDensity(v: unknown): v is Density {
  return v === 'light' || v === 'balanced' || v === 'rich';
}

serve(async (req) => {
  const cors = corsHeaders(req, resolveAllowedOrigins(Deno.env));
  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405);

  try {
    return await handlePrettify(req);
  } catch (err) {
    return jsonResp({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

async function handlePrettify(req: Request): Promise<Response> {
  const cors = corsHeaders(req, resolveAllowedOrigins(Deno.env));
  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return jsonResp({ error: 'ANTHROPIC_API_KEY missing' }, 500);

  let body: { content_text?: unknown; density?: unknown };
  try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }

  const contentText = typeof body.content_text === 'string' ? body.content_text : '';
  if (!isDensity(body.density)) return jsonResp({ error: 'bad density' }, 400);
  const density = body.density;

  const supabase = serviceClient();

  const userId = await deriveUserId(supabase, bearerToken(req));
  if (!userId) return jsonResp({ error: 'unauthorized' }, 401);

  const { data: settings, error: sErr } = await supabase
    .from('lamplight_settings')
    .select('enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (sErr) return jsonResp({ error: sErr.message }, 500);
  if (!settings?.enabled) return jsonResp({ ok: false, reason: 'disabled' }, 403);

  // Empty note: no model spend, no quota. Return before runGeneration.
  if (!contentText.trim()) return jsonResp({ ok: false, reason: 'no_content' }, 200);

  const quotaCfg = resolveQuotaLimits(Deno.env);
  const llm = createAnthropicAdapter({ apiKey: anthropicKey, fetch });

  const lifecycleDeps: GenerationLifecycleDeps = {
    checkQuota: async (uid) => {
      const quota = await checkQuota(
        supabaseQuotaDeps(supabase),
        quotaCfg.generation,
        quotaCfg.global,
        { userId: uid, nowMs: Date.now() },
      );
      return quota.ok ? { ok: true } : { ok: false, reason: quota.reason };
    },
    recordUsage: (row) => recordLamplightUsage(supabase, row),
    classifyError: classifyGenerateError,
  };

  const { status, response } = await runGeneration(
    lifecycleDeps,
    { userId, artifactKind: 'prettify' },
    async () => {
      const result = await runPrettifyPipeline({ llm, ctx: { contentText, density } });
      return { response: result, usage: result.usage };
    },
  );
  return jsonResp(response, status);
}
