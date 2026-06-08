-- supabase/migrations/025_lamplight_chat_thread_archive.sql
-- Allow a user to start a fresh reflection on a passage they've already studied.
-- The "one thread per passage" rule becomes "one ACTIVE (non-archived) thread
-- per passage": archive the current thread, and a new one can begin.

alter table public.lamplight_chat_threads
  add column archived boolean not null default false;

-- Replace the unconditional unique with a partial unique over active threads.
-- 024 declared `unique (user_id, passage_ref)` as an unnamed table-level
-- constraint, so Postgres assigned its default name below.
alter table public.lamplight_chat_threads
  drop constraint if exists lamplight_chat_threads_user_id_passage_ref_key;

create unique index lamplight_chat_threads_active_passage
  on public.lamplight_chat_threads (user_id, passage_ref)
  where archived = false;
