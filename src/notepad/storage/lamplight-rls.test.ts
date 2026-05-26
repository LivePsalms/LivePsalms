import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SupabaseLamplightAdapter } from './supabase-lamplight-adapter';

declare const process: { env: Record<string, string | undefined> };

const SUPABASE_URL = process.env.SUPABASE_TEST_URL;
const SUPABASE_ANON = process.env.SUPABASE_TEST_ANON_KEY;
const USER_A_EMAIL = process.env.SUPABASE_TEST_USER_A_EMAIL;
const USER_A_PASS = process.env.SUPABASE_TEST_USER_A_PASS;
const USER_B_EMAIL = process.env.SUPABASE_TEST_USER_B_EMAIL;
const USER_B_PASS = process.env.SUPABASE_TEST_USER_B_PASS;

const haveEnv =
  SUPABASE_URL && SUPABASE_ANON && USER_A_EMAIL && USER_A_PASS && USER_B_EMAIL && USER_B_PASS;

const maybeDescribe = haveEnv ? describe : describe.skip;

async function signedClient(email: string, password: string): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(SUPABASE_URL!, SUPABASE_ANON!);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client, userId: data.user!.id };
}

maybeDescribe('Lamplight RLS isolation (integration)', () => {
  let userA: { client: SupabaseClient; userId: string };
  let userB: { client: SupabaseClient; userId: string };

  beforeAll(async () => {
    userA = await signedClient(USER_A_EMAIL!, USER_A_PASS!);
    userB = await signedClient(USER_B_EMAIL!, USER_B_PASS!);
  });

  it("user B cannot read user A's lamplight_settings", async () => {
    const adapterA = new SupabaseLamplightAdapter(userA.client);
    await adapterA.upsertSettings(userA.userId, { enabled: true, voicePreference: 'Father' });

    const adapterB = new SupabaseLamplightAdapter(userB.client);
    const leaked = await adapterB.getSettings(userA.userId);
    expect(leaked).toBeNull();
  });

  it("user B cannot insert a lamplight_settings row impersonating user A", async () => {
    const adapterB = new SupabaseLamplightAdapter(userB.client);
    await expect(
      adapterB.upsertSettings(userA.userId, { enabled: true })
    ).rejects.toThrow();
  });

  it("getPromoConfig is readable by all signed-in users", async () => {
    const adapterB = new SupabaseLamplightAdapter(userB.client);
    const promo = await adapterB.getPromoConfig();
    expect(typeof promo.promoActive).toBe('boolean');
  });

  it("user B cannot read user A's lamplight_embeddings", async () => {
    // userA inserts an embedding via their own client (1024-dim zero vector).
    const sourceId = `rls-test-${Date.now()}`;
    const { error: insErr } = await userA.client.from('lamplight_embeddings').insert({
      user_id: userA.userId,
      source_type: 'note',
      source_id: sourceId,
      content_hash: 'h',
      embedding: new Array(1024).fill(0),
    });
    expect(insErr).toBeNull();

    // userB cannot see it.
    const { data, error } = await userB.client
      .from('lamplight_embeddings')
      .select('source_id')
      .eq('source_id', sourceId);
    expect(error).toBeNull();
    expect(data).toEqual([]);

    // Cleanup — userA deletes their own row.
    await userA.client.from('lamplight_embeddings').delete().eq('source_id', sourceId);
  });

  it("user B cannot insert a lamplight_embeddings row impersonating user A", async () => {
    const { error } = await userB.client.from('lamplight_embeddings').insert({
      user_id: userA.userId,
      source_type: 'note',
      source_id: `rls-impersonate-${Date.now()}`,
      content_hash: 'h',
      embedding: new Array(1024).fill(0),
    });
    expect(error).not.toBeNull(); // RLS rejects
  });

  it("authenticated users cannot see Bible rows (user_id IS NULL)", async () => {
    // RLS policy `auth.uid() = user_id` evaluates to NULL → false for NULL-owner rows,
    // so authenticated clients see zero of them regardless of whether any exist.
    const { data, error } = await userB.client
      .from('lamplight_embeddings')
      .select('source_id, user_id')
      .is('user_id', null);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
