-- supabase/migrations/028_apple_notes_import.sql
-- Personal access tokens (long-lived, revocable) for non-browser clients like
-- the Apple Notes import Shortcut, plus the columns/identity the
-- import-apple-note edge function needs to dedup and stamp imported notes.

-- ── Personal access tokens ───────────────────────────────────────────────
create table if not exists public.personal_access_tokens (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  token_hash         text not null unique,            -- SHA-256 hex; raw token never stored
  name               text not null default 'Apple Notes Shortcut',
  last_used_at       timestamptz,
  usage_window_start timestamptz not null default now(),
  usage_count        integer not null default 0,
  created_at         timestamptz not null default now(),
  revoked_at         timestamptz
);

create index if not exists personal_access_tokens_user_idx
  on public.personal_access_tokens (user_id);

alter table public.personal_access_tokens enable row level security;

-- The browser (authenticated session) manages its own tokens. The edge function
-- reads/updates via the service-role client, which bypasses RLS.
create policy "Users can view own tokens"
  on public.personal_access_tokens for select using (auth.uid() = user_id);
create policy "Users can insert own tokens"
  on public.personal_access_tokens for insert with check (auth.uid() = user_id);
create policy "Users can update own tokens"
  on public.personal_access_tokens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own tokens"
  on public.personal_access_tokens for delete using (auth.uid() = user_id);

-- Atomically resolve a token to its user while enforcing revocation and a
-- rolling hourly rate limit. SECURITY DEFINER so the edge function can call it;
-- it only ever reads the hash it is given. Returns no row for unknown/revoked
-- tokens; rate_limited = true (with the real user_id) when the cap is hit.
create or replace function public.consume_pat(p_token_hash text, p_max_per_hour integer)
returns table (user_id uuid, rate_limited boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_user   uuid;
  v_window timestamptz;
  v_count  integer;
begin
  select pat.id, pat.user_id, pat.usage_window_start, pat.usage_count
    into v_id, v_user, v_window, v_count
    from public.personal_access_tokens pat
    where pat.token_hash = p_token_hash and pat.revoked_at is null
    for update;
  if not found then
    return;  -- no row → caller treats as unauthorized
  end if;

  -- Reset the window if it has rolled over.
  if now() - v_window > interval '1 hour' then
    v_window := now();
    v_count := 0;
  end if;

  if v_count >= p_max_per_hour then
    update public.personal_access_tokens
      set usage_window_start = v_window, usage_count = v_count
      where id = v_id;
    user_id := v_user; rate_limited := true; return next; return;
  end if;

  update public.personal_access_tokens
    set usage_window_start = v_window,
        usage_count = v_count + 1,
        last_used_at = now()
    where id = v_id;

  user_id := v_user; rate_limited := false; return next;
end;
$$;

-- ── Imported-note provenance + dedup on notes ────────────────────────────
alter table public.notes
  add column if not exists source text not null default 'app',
  add column if not exists external_id text,
  add column if not exists apple_modified_at timestamptz;

-- One row per (user, Apple note); app-created notes (null external_id) unconstrained.
create unique index if not exists notes_user_external_id_idx
  on public.notes (user_id, external_id) where external_id is not null;
