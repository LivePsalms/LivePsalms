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

create index lamplight_embeddings_embedding_hnsw
  on public.lamplight_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

alter table public.lamplight_embeddings
  add constraint lamplight_embeddings_source_uq
  unique nulls not distinct (user_id, source_type, source_id);
