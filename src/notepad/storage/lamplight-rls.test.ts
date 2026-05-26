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
});
