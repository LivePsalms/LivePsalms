import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

maybeDescribe('Lamplight chat RLS isolation (integration)', () => {
  let userA: { client: SupabaseClient; userId: string };
  let userB: { client: SupabaseClient; userId: string };

  beforeAll(async () => {
    userA = await signedClient(USER_A_EMAIL!, USER_A_PASS!);
    userB = await signedClient(USER_B_EMAIL!, USER_B_PASS!);
  });

  it("user B cannot read user A's chat threads", async () => {
    const passageRef = `rls.${Date.now()}`;
    const ins = await userA.client.from('lamplight_chat_threads').insert({
      user_id: userA.userId, book: 'rls', chapter: 1, passage_ref: passageRef, title: 't',
    }).select('id').single();
    expect(ins.error).toBeNull();

    const leak = await userB.client.from('lamplight_chat_threads').select('id').eq('passage_ref', passageRef);
    expect(leak.error).toBeNull();
    expect(leak.data).toEqual([]);

    await userA.client.from('lamplight_chat_threads').delete().eq('id', ins.data!.id);
  });

  it("user B cannot insert a chat thread impersonating user A", async () => {
    const { error } = await userB.client.from('lamplight_chat_threads').insert({
      user_id: userA.userId, book: 'rls', chapter: 2, passage_ref: `imp.${Date.now()}`, title: 't',
    });
    expect(error).not.toBeNull();
  });

  it("user B cannot insert a chat message impersonating user A", async () => {
    const { error } = await userB.client.from('lamplight_chat_messages').insert({
      thread_id: '00000000-0000-0000-0000-0000000000aa',
      user_id: userA.userId, role: 'user', content: 'x', citations: [],
    });
    expect(error).not.toBeNull();
  });
});
