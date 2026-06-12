// src/auth/personal-tokens.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PersonalToken {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
}

// MUST match supabase/functions/_shared/pat-hash.ts exactly (the same parity
// vector is asserted in both trees) so issued tokens validate server-side.
export async function hashToken(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 32 random bytes, URL-safe base64, prefixed for recognizability.
export function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `psalms_pat_${b64}`;
}

// Creates a token and returns the RAW value (shown to the user exactly once).
// Only the hash is persisted.
export async function createToken(client: SupabaseClient, userId: string, name: string): Promise<string> {
  const raw = generateRawToken();
  const token_hash = await hashToken(raw);
  const { error } = await client.from('personal_access_tokens').insert({ user_id: userId, token_hash, name });
  if (error) throw error;
  return raw;
}

export async function listTokens(client: SupabaseClient): Promise<PersonalToken[]> {
  const { data, error } = await client
    .from('personal_access_tokens')
    .select('id, name, last_used_at, created_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    lastUsedAt: (r.last_used_at as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

export async function revokeToken(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('personal_access_tokens')
    .update({ revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// Count of the signed-in user's Apple-Notes-imported notes (RLS scopes to own rows).
// head:true => no rows returned, just the exact count. The `source` column exists
// from migration 028.
export async function countImportedNotes(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from('notes')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'apple_notes');
  if (error) throw error;
  return count ?? 0;
}
