-- supabase/migrations/011_lamplight_signal_layer.sql
--
-- Signal Layer (sub-project 2). Three discrete changes:
--   1. Enable pg_cron + pg_net (for the embedding sweep).
--   2. Allow lamplight_embeddings.user_id to be NULL so Bible passages
--      (no per-user owner) can share the table. RLS continues to work via
--      `auth.uid() = user_id` evaluating to NULL → false for Bible rows.
--   3. Swap ivfflat → HNSW (better recall on our corpus size; table is empty
--      today so the swap is a single DROP+CREATE) and add a unique
--      constraint that lets the Edge Function upsert cleanly.
-- The RPC, sweep, and post-deploy settings live in subsequent migration steps.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── 1. Owner nullability + source-type CHECK ─────────────────────────────
alter table public.lamplight_embeddings
  alter column user_id drop not null;

alter table public.lamplight_embeddings
  add constraint lamplight_embeddings_owner_check
  check (
    (source_type = 'note'          and user_id is not null) or
    (source_type = 'bible_passage' and user_id is null)
  );

-- ── 2. Replace ivfflat with HNSW; replace non-unique btree with unique ───
drop index if exists public.lamplight_embeddings_ivfflat;
drop index if exists public.lamplight_embeddings_user_source;

-- On Supabase, pgvector is installed in the `extensions` schema, so we
-- fully-qualify the operator class to avoid "does not exist for access method
-- hnsw" errors caused by the migration session's restricted search_path.
create index if not exists lamplight_embeddings_embedding_hnsw
  on public.lamplight_embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

alter table public.lamplight_embeddings
  add constraint lamplight_embeddings_source_uq
  unique nulls not distinct (user_id, source_type, source_id);

-- ── 3. enqueue_lamplight_embedding ───────────────────────────────────────
-- SECURITY DEFINER: every branch must check auth.uid() before touching tables.
-- A definer function that forgets the check is an RLS bypass. Do not optimize
-- away the explicit checks below.
create or replace function public.enqueue_lamplight_embedding(
  p_note_id uuid,
  p_content_hash text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_hash text;
  v_job_id uuid;
begin
  if not exists (
    select 1 from notes where id = p_note_id and user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1 from lamplight_settings
    where user_id = auth.uid() and enabled = true
  ) then
    return null;
  end if;

  select content_hash into v_existing_hash
  from lamplight_embeddings
  where user_id = auth.uid()
    and source_type = 'note'
    and source_id = p_note_id::text;

  if v_existing_hash = p_content_hash then
    return null;
  end if;

  select id into v_job_id
  from lamplight_jobs
  where user_id = auth.uid()
    and kind = 'embedding_refresh'
    and status = 'queued'
    and payload->>'note_id' = p_note_id::text;

  if v_job_id is not null then
    return v_job_id;
  end if;

  begin
    insert into lamplight_jobs (user_id, kind, status, payload, scheduled_at)
    values (
      auth.uid(),
      'embedding_refresh',
      'queued',
      jsonb_build_object('note_id', p_note_id, 'content_hash', p_content_hash),
      now()
    )
    returning id into v_job_id;
  exception when unique_violation then
    -- Concurrent caller raced us. Return the now-existing queued job's id.
    select id into v_job_id
    from lamplight_jobs
    where user_id = auth.uid()
      and kind = 'embedding_refresh'
      and status = 'queued'
      and payload->>'note_id' = p_note_id::text
    limit 1;
  end;

  return v_job_id;
end;
$$;

grant execute on function public.enqueue_lamplight_embedding(uuid, text) to authenticated;

-- ── 4. pg_cron sweep — drains orphaned queued jobs every minute ──────────
-- The two settings (`app.settings.embed_fn_url`, `app.settings.service_role_key`)
-- are provisioned out-of-band — see docs/lamplight/post-deploy-signal-layer.md.
-- The `current_setting(..., true)` form returns NULL on a fresh DB without the
-- secrets, so the cron call no-ops gracefully in local dev.
select cron.schedule(
  'lamplight_embed_sweep',
  '* * * * *',
  $cron$
  select net.http_post(
    url := current_setting('app.settings.embed_fn_url', true),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{"sweep": true}'::jsonb
  )
  where current_setting('app.settings.embed_fn_url', true) is not null
    and current_setting('app.settings.service_role_key', true) is not null;
  $cron$
);

-- ── 5. Claim RPCs — atomic FOR UPDATE SKIP LOCKED dequeue ────────────────
create or replace function public.claim_lamplight_jobs(p_limit int)
returns setof public.lamplight_jobs
language sql
security definer
set search_path = public
as $$
  update lamplight_jobs
     set status = 'running', started_at = now()
   where id in (
     select id from lamplight_jobs
      where status = 'queued'
        and scheduled_at <= now()
        and kind = 'embedding_refresh'
      order by scheduled_at
      limit p_limit
      for update skip locked
   )
   returning *;
$$;

create or replace function public.claim_lamplight_job_by_id(p_job_id uuid)
returns setof public.lamplight_jobs
language sql
security definer
set search_path = public
as $$
  update lamplight_jobs
     set status = 'running', started_at = now()
   where id = p_job_id
     and status = 'queued'
   returning *;
$$;

revoke execute on function public.claim_lamplight_jobs(int)      from public, anon, authenticated;
revoke execute on function public.claim_lamplight_job_by_id(uuid) from public, anon, authenticated;
-- service_role bypasses the revoke; only it (and supabase_admin) can call these.

-- ── 6. Race protection: prevent duplicate queued jobs for the same note ──
-- Defense in depth — the enqueue_lamplight_embedding RPC's coalesce SELECT is
-- not atomic with the subsequent INSERT, so two concurrent calls could both
-- miss the SELECT and both INSERT. This partial unique index guarantees only
-- one queued embedding_refresh row per (user_id, note_id) can exist at a time.
create unique index if not exists lamplight_jobs_embedding_refresh_queued_uq
  on public.lamplight_jobs (user_id, (payload->>'note_id'))
  where kind = 'embedding_refresh' and status = 'queued';
