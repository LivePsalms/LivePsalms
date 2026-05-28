-- 015_lamplight_entitlements_ui.sql
-- Sub-Project 6 (partial — no paywall): admin tooling, entitlement display,
-- and write-only usage telemetry. Adds `profiles.is_admin`, a SQL helper
-- `is_lamplight_admin()`, a `lamplight_usage` table, an additive admin
-- SELECT policy on `lamplight_jobs`, and 5 SECURITY DEFINER admin RPCs.

-- ── profiles.is_admin ────────────────────────────────────────────────────
alter table public.profiles
  add column is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Manually toggled in SQL by service-role. Gates /admin surfaces. Not user-editable.';

-- ── is_lamplight_admin() helper ──────────────────────────────────────────
create or replace function public.is_lamplight_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

revoke execute on function public.is_lamplight_admin() from public, anon;
grant execute on function public.is_lamplight_admin() to authenticated;

-- ── lamplight_usage ──────────────────────────────────────────────────────
create table public.lamplight_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  model text not null,
  artifact_kind text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  status text not null check (status in ('ok','error')),
  error_code text,
  created_at timestamptz not null default now()
);

create index lamplight_usage_user_created
  on public.lamplight_usage (user_id, created_at desc);
create index lamplight_usage_created
  on public.lamplight_usage (created_at desc);

alter table public.lamplight_usage enable row level security;

-- Permissive-OR policy: own rows, OR admin sees all. No INSERT/UPDATE/DELETE
-- policy — service-role bypasses RLS, and no authenticated client writes here.
create policy "Users can view own lamplight_usage"
  on public.lamplight_usage for select
  using (auth.uid() = user_id or public.is_lamplight_admin());

-- ── lamplight_jobs: additive admin SELECT ────────────────────────────────
-- Existing user-scoped policies (migration 008) remain. Postgres OR-merges
-- permissive policies, so admins see all rows; non-admins still see only own.
create policy "Admins can view all lamplight_jobs"
  on public.lamplight_jobs for select
  using (public.is_lamplight_admin());

-- ── admin_list_lamplight_jobs ────────────────────────────────────────────
create or replace function public.admin_list_lamplight_jobs(
  p_status text[] default array['failed'],
  p_kind text[] default null,
  p_user_search text default null,
  p_since timestamptz default now() - interval '7 days',
  p_limit int default 200
)
returns table (
  id uuid,
  user_id uuid,
  email text,
  kind text,
  status text,
  attempts int,
  payload jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_lamplight_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select j.id, j.user_id, u.email::text, j.kind, j.status, j.attempts,
         j.payload, j.scheduled_at, j.started_at, j.finished_at, j.error
  from public.lamplight_jobs j
  left join auth.users u on u.id = j.user_id
  where j.status = any(p_status)
    and (p_kind is null or j.kind = any(p_kind))
    and (
      p_user_search is null
      or u.email ilike '%' || p_user_search || '%'
      or j.user_id::text = p_user_search
    )
    and j.scheduled_at >= p_since
  order by coalesce(j.finished_at, j.scheduled_at) desc
  limit greatest(1, least(p_limit, 500));
end;
$$;

revoke execute on function public.admin_list_lamplight_jobs(text[], text[], text, timestamptz, int) from public, anon;
grant execute on function public.admin_list_lamplight_jobs(text[], text[], text, timestamptz, int) to authenticated;

-- ── admin_lamplight_job_counts ───────────────────────────────────────────
create or replace function public.admin_lamplight_job_counts(
  p_since timestamptz default now() - interval '24 hours'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_lamplight_admin() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'queued',  count(*) filter (where status = 'queued'),
    'running', count(*) filter (where status = 'running'),
    'done',    count(*) filter (where status = 'done'),
    'failed',  count(*) filter (where status = 'failed'),
    'since',   p_since
  ) into v_result
  from public.lamplight_jobs
  where scheduled_at >= p_since;

  return v_result;
end;
$$;

revoke execute on function public.admin_lamplight_job_counts(timestamptz) from public, anon;
grant execute on function public.admin_lamplight_job_counts(timestamptz) to authenticated;

-- ── admin_requeue_lamplight_job (single) ─────────────────────────────────
create or replace function public.admin_requeue_lamplight_job(p_job_id uuid)
returns public.lamplight_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.lamplight_jobs;
begin
  if not public.is_lamplight_admin() then
    raise exception 'not authorized';
  end if;

  update public.lamplight_jobs
     set status       = 'queued',
         attempts     = 0,
         error        = null,
         scheduled_at = now(),
         started_at   = null,
         finished_at  = null
   where id = p_job_id
  returning * into v_row;

  if not found then
    raise exception 'job not found: %', p_job_id;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.admin_requeue_lamplight_job(uuid) from public, anon;
grant  execute on function public.admin_requeue_lamplight_job(uuid) to authenticated;

-- ── admin_requeue_failed_lamplight_jobs (bulk) ───────────────────────────
create or replace function public.admin_requeue_failed_lamplight_jobs(
  p_kind text default null,
  p_limit int default 100
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_lamplight_admin() then
    raise exception 'not authorized';
  end if;

  with picked as (
    select id from public.lamplight_jobs
     where status = 'failed'
       and (p_kind is null or kind = p_kind)
     order by finished_at asc nulls last
     limit greatest(1, least(p_limit, 100))
  )
  update public.lamplight_jobs j
     set status       = 'queued',
         attempts     = 0,
         error        = null,
         scheduled_at = now(),
         started_at   = null,
         finished_at  = null
   from picked
   where j.id = picked.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.admin_requeue_failed_lamplight_jobs(text, int) from public, anon;
grant  execute on function public.admin_requeue_failed_lamplight_jobs(text, int) to authenticated;
