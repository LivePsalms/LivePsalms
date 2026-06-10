// supabase/functions/contact-message/index.ts
//
// Public contact form endpoint. Validates { name, email, subject } and relays
// the message to support@livepsalms.com via Resend, with reply_to set to the
// submitter so replying in the inbox goes straight back to them.
//
// Trust model: PUBLIC endpoint — deployed with verify_jwt = false (pinned in
// supabase/config.toml). Anonymous visitors submit the form, and this project's
// client key is a non-JWT publishable key (sb_publishable_...) that the default
// JWT gate would 401. This is safe: the handler does no privileged DB work,
// validates its own input, and its only side effect is sending one email.
// (Spam/abuse hardening — rate limiting, captcha — is a deliberate follow-up.)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { resolveAllowedOrigins, corsHeaders } from '../_shared/cors.ts';
import { validateContactInput, buildResendPayload } from '../_shared/contact-message.ts';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

serve(async (req) => {
  const cors = corsHeaders(req, resolveAllowedOrigins(Deno.env));
  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'content-type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405);

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    // Misconfiguration — log the specific cause server-side, but return a
    // generic message so this public endpoint doesn't reveal internal env names.
    console.error('contact-message: RESEND_API_KEY missing');
    return jsonResp({ error: 'server configuration error' }, 500);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResp({ error: 'bad json' }, 400);
  }

  const validation = validateContactInput(raw);
  if (!validation.ok || !validation.value) {
    return jsonResp({ error: validation.errors.join(', ') }, 400);
  }

  const payload = buildResendPayload(validation.value);

  let resendRes: Response;
  try {
    resendRes = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (_err) {
    return jsonResp({ error: 'failed to reach email provider' }, 502);
  }

  if (!resendRes.ok) {
    // Log the provider detail server-side; return a generic error to the client.
    const detail = await resendRes.text().catch(() => '');
    console.error('Resend error', resendRes.status, detail);
    return jsonResp({ error: 'failed to send message' }, 502);
  }

  return jsonResp({ ok: true });
});
