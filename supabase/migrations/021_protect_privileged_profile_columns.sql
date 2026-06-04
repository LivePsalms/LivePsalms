-- 021_protect_privileged_profile_columns.sql
-- Batch A security remediation, Finding #1 (+ #6).
--
-- The profiles UPDATE policy is `using (auth.uid() = id)` with no column guard,
-- so any authenticated user could `update({ is_admin: true })` on their own row
-- and unlock every admin RPC. RLS can't express column-level restrictions, so a
-- BEFORE UPDATE trigger blocks privileged-column changes that originate from a
-- client role.
--
-- This function is intentionally SECURITY INVOKER (the default — do NOT add
-- `security definer`). It must observe the CALLER's role via current_user:
--   * A direct client UPDATE runs as 'authenticated' (or 'anon') -> blocked.
--   * The SECURITY DEFINER update_note_count() trigger (003_triggers.sql) writes
--     note_count during ordinary note inserts; inside THAT function current_user
--     is its owner (not 'authenticated'), so this guard passes it through.
--   * service_role / postgres (Edge Functions, migrations, admin SQL) -> passes.
-- Gating on auth.role() instead of current_user would NOT work: auth.role() is
-- JWT-scoped and stays 'authenticated' even inside SECURITY DEFINER functions,
-- which would falsely block the legitimate update_note_count() write.
--
-- last_acknowledged_tier_threshold is intentionally server-only here. No client
-- code writes it today; if a level-up-modal acknowledgement feature later needs
-- to persist it, route that write through a dedicated SECURITY DEFINER RPC
-- rather than relaxing this guard.

create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.is_admin is distinct from old.is_admin
       or new.note_count is distinct from old.note_count
       or new.highest_note_count is distinct from old.highest_note_count
       or new.last_acknowledged_tier_threshold is distinct from old.last_acknowledged_tier_threshold then
      raise exception 'cannot modify privileged profile columns';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileged
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_columns();
