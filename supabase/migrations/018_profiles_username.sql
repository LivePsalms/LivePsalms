-- 018_profiles_username.sql — per-user vanity username for the notepad route.
--
-- Adds a nullable `username` to profiles (existing rows stay null until the
-- user picks one on first notepad visit). Uniqueness is case-insensitive via a
-- unique index on lower(username) so 'Natalie' and 'natalie' cannot coexist.
-- check_username_available() returns only a boolean — it never leaks who owns a
-- name — so it is safe to grant to `authenticated` and power the live picker.

alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create or replace function public.check_username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
      from public.profiles
     where lower(username) = lower(trim(candidate))
  );
$$;

grant execute on function public.check_username_available(text) to authenticated;
