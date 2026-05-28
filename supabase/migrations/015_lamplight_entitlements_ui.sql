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
