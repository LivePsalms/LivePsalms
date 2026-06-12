// supabase/functions/import-apple-note/index.ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { resolveAllowedOrigins, corsHeaders } from '../_shared/cors.ts';
import { bearerToken } from '../_shared/auth-identity.ts';
import { hashToken } from '../_shared/pat-hash.ts';
import { handleImport, type ImportDeps, type NoteInsert, type NoteUpdate } from './handler.ts';

// Bounds a runaway Shortcut loop; enforced atomically in the consume_pat RPC.
const MAX_PER_HOUR = 600;

serve(async (req) => {
  const cors = corsHeaders(req, resolveAllowedOrigins(Deno.env));
  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405);

  try {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }

    const supabase = serviceClient();
    const tokenHash = await hashToken(bearerToken(req));

    const deps: ImportDeps = {
      consumeToken: async (hash) => {
        const { data, error } = await supabase.rpc('consume_pat', { p_token_hash: hash, p_max_per_hour: MAX_PER_HOUR });
        if (error) throw new Error(error.message);
        const row = Array.isArray(data) ? data[0] : data;
        return { userId: row?.user_id ?? null, rateLimited: !!row?.rate_limited };
      },
      findExistingNote: async (userId, externalId) => {
        const { data, error } = await supabase
          .from('notes').select('id, apple_modified_at')
          .eq('user_id', userId).eq('external_id', externalId).maybeSingle();
        if (error) throw new Error(error.message);
        return data ? { id: data.id as string, appleModifiedAt: (data.apple_modified_at as string) ?? null } : null;
      },
      insertNote: async (row: NoteInsert) => {
        const { data, error } = await supabase.from('notes').insert(row).select('id').single();
        if (error) throw new Error(error.message);
        return data!.id as string;
      },
      updateNote: async (id: string, fields: NoteUpdate) => {
        const { error } = await supabase.from('notes')
          .update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw new Error(error.message);
      },
      findOrCreateFolder: async (userId, name, parentId) => {
        const base = supabase.from('folders').select('id').eq('user_id', userId).eq('name', name);
        const scoped = parentId === null ? base.is('parent_id', null) : base.eq('parent_id', parentId);
        const { data: found, error: findErr } = await scoped.maybeSingle();
        if (findErr) throw new Error(findErr.message);
        if (found) return found.id as string;
        const { data, error } = await supabase.from('folders')
          .insert({ user_id: userId, name, parent_id: parentId, order: 0 })
          .select('id').single();
        if (error) throw new Error(error.message);
        return data!.id as string;
      },
    };

    const res = await handleImport(deps, tokenHash, body);
    return jsonResp(res.body, res.status);
  } catch (err) {
    return jsonResp({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
