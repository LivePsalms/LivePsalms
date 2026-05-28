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
