// src/__tests__/enqueue-embedding-rpc.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const URL  = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY;
const skip = !URL || !ANON || !SERVICE;

describe.skipIf(skip)('enqueue_lamplight_embedding RPC', () => {
  let service: SupabaseClient;
  let userA: { id: string; client: SupabaseClient };
  let noteA: string;

  beforeAll(async () => {
    service = createClient(URL!, SERVICE!);
    const email = `enq-${Date.now()}@test.invalid`;
    const { data, error } = await service.auth.admin.createUser({
      email, password: 'p4ssword!', email_confirm: true,
    });
    if (error) throw error;
    const uid = data.user!.id;
    const userClient = createClient(URL!, ANON!);
    await userClient.auth.signInWithPassword({ email, password: 'p4ssword!' });
    userA = { id: uid, client: userClient };
    // Opt the user in.
    await userClient.from('lamplight_settings').upsert({ user_id: uid, enabled: true });
    // Create a note.
    const { data: noteRow } = await userClient
      .from('notes').insert({ user_id: uid, content: '{"type":"doc"}' }).select('id').single();
    noteA = noteRow!.id;
  });

  it('inserts a queued job when opted in and hash is new', async () => {
    const { data: jobId, error } = await userA.client.rpc('enqueue_lamplight_embedding', {
      p_note_id: noteA, p_content_hash: 'h1',
    });
    expect(error).toBeNull();
    expect(jobId).toBeTruthy();

    const { data: job } = await service
      .from('lamplight_jobs').select('*').eq('id', jobId).single();
    expect(job.kind).toBe('embedding_refresh');
    expect(job.status).toBe('queued');
    expect(job.payload).toMatchObject({ note_id: noteA, content_hash: 'h1' });
  });

  it('returns null when hash matches existing embedding', async () => {
    await service.from('lamplight_embeddings').insert({
      user_id: userA.id, source_type: 'note', source_id: noteA,
      content_hash: 'h2', embedding: new Array(1024).fill(0),
    });
    const { data, error } = await userA.client.rpc('enqueue_lamplight_embedding', {
      p_note_id: noteA, p_content_hash: 'h2',
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('coalesces duplicate enqueue calls into one queued row', async () => {
    // Clear prior jobs.
    await service.from('lamplight_jobs').delete().eq('user_id', userA.id);
    await service.from('lamplight_embeddings').delete().eq('user_id', userA.id);

    const r1 = await userA.client.rpc('enqueue_lamplight_embedding', {
      p_note_id: noteA, p_content_hash: 'h3',
    });
    const r2 = await userA.client.rpc('enqueue_lamplight_embedding', {
      p_note_id: noteA, p_content_hash: 'h3',
    });
    expect(r1.data).toBe(r2.data); // same job id

    const { count } = await service
      .from('lamplight_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userA.id).eq('status', 'queued');
    expect(count).toBe(1);
  });

  it('returns null when opted out', async () => {
    await userA.client.from('lamplight_settings').upsert({ user_id: userA.id, enabled: false });
    const { data, error } = await userA.client.rpc('enqueue_lamplight_embedding', {
      p_note_id: noteA, p_content_hash: 'h4',
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
    // Re-opt in for any later tests.
    await userA.client.from('lamplight_settings').upsert({ user_id: userA.id, enabled: true });
  });

  it('raises when caller does not own the note', async () => {
    // Create user B and a note belonging to B.
    const email = `enq-b-${Date.now()}@test.invalid`;
    const { data: bData } = await service.auth.admin.createUser({
      email, password: 'p4ssword!', email_confirm: true,
    });
    const bUid = bData.user!.id;
    const { data: bNoteRow } = await service
      .from('notes').insert({ user_id: bUid, content: '{"type":"doc"}' }).select('id').single();
    const bNoteId = bNoteRow!.id;

    const { error } = await userA.client.rpc('enqueue_lamplight_embedding', {
      p_note_id: bNoteId, p_content_hash: 'h5',
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? '')).toMatch(/not authorized|authorized|permission/i);
  });
});
