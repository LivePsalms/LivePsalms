import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };

const SUPABASE_URL = process.env.SUPABASE_TEST_URL;
const SUPABASE_ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SUPABASE_SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.SUPABASE_TEST_ADMIN_EMAIL;
const ADMIN_PASS = process.env.SUPABASE_TEST_ADMIN_PASS;
const USER_A_EMAIL = process.env.SUPABASE_TEST_USER_A_EMAIL;
const USER_A_PASS = process.env.SUPABASE_TEST_USER_A_PASS;

const haveEnv =
  SUPABASE_URL && SUPABASE_ANON && SUPABASE_SERVICE &&
  ADMIN_EMAIL && ADMIN_PASS && USER_A_EMAIL && USER_A_PASS;

const maybeDescribe = haveEnv ? describe : describe.skip;

async function signedClient(email: string, password: string): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(SUPABASE_URL!, SUPABASE_ANON!);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client, userId: data.user!.id };
}

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE!);
}

maybeDescribe('Lamplight admin RPCs (integration)', () => {
  let admin: { client: SupabaseClient; userId: string };
  let userA: { client: SupabaseClient; userId: string };

  beforeAll(async () => {
    admin = await signedClient(ADMIN_EMAIL!, ADMIN_PASS!);
    userA = await signedClient(USER_A_EMAIL!, USER_A_PASS!);
    const svc = serviceClient();
    await svc.from('profiles').update({ is_admin: true }).eq('id', admin.userId);
    await svc.from('profiles').update({ is_admin: false }).eq('id', userA.userId);
  });

  afterAll(async () => {
    const svc = serviceClient();
    await svc.from('profiles').update({ is_admin: false }).eq('id', admin.userId);
  });

  it('is_lamplight_admin returns true for admin, false for non-admin', async () => {
    const { data: aData, error: aErr } = await admin.client.rpc('is_lamplight_admin');
    expect(aErr).toBeNull();
    expect(aData).toBe(true);

    const { data: uData, error: uErr } = await userA.client.rpc('is_lamplight_admin');
    expect(uErr).toBeNull();
    expect(uData).toBe(false);
  });

  it('is_lamplight_admin returns false for unauthenticated callers', async () => {
    const anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON!);
    const { data, error } = await anonClient.rpc('is_lamplight_admin');
    expect(error).toBeNull();
    expect(data).toBe(false);
  });
});
