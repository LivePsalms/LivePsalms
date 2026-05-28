-- 016_lamplight_voyage_context_3.sql
--
-- Migrate Lamplight embeddings from voyage-3-large @ 1024-dim to voyage-context-3
-- @ 512-dim with paragraph-grain chunking for notes. lamplight_embeddings holds
-- derived data only — vectors are recomputable from notes + BSB at any time.
-- This migration wipes the table; ingest-bsb.ts + backfill-note-embeddings.ts
-- repopulate it. Foundation tables (settings, jobs, usage, artifacts,
-- entitlements, suggestions, connections) are untouched.

-- ── 1. Drop dependents on the embedding column ───────────────────────────
drop index if exists public.lamplight_embeddings_embedding_hnsw;
alter table public.lamplight_embeddings
  drop constraint if exists lamplight_embeddings_source_uq;

-- ── 2. Drop the old match RPCs (their signatures reference vector(1024)) ─
drop function if exists public.match_user_note_embeddings(uuid, extensions.vector(1024), text, int);
drop function if exists public.match_bible_embeddings(extensions.vector(1024), int);
drop function if exists public.match_my_note_neighbors(uuid, int, float);

-- ── 3. Hard cutover ──────────────────────────────────────────────────────
truncate table public.lamplight_embeddings;
alter table public.lamplight_embeddings
  alter column embedding type extensions.vector(512);

-- ── 4. Add chunk columns; defaults let NOT NULL stick on the empty table ─
alter table public.lamplight_embeddings
  add column chunk_index int  not null default 0,
  add column chunk_text  text not null default '';

-- ── 5. Rebuild unique constraint at chunk grain ──────────────────────────
alter table public.lamplight_embeddings
  add constraint lamplight_embeddings_source_uq
  unique nulls not distinct (user_id, source_type, source_id, chunk_index);

-- ── 6. Rebuild HNSW on vector(512) ───────────────────────────────────────
create index lamplight_embeddings_embedding_hnsw
  on public.lamplight_embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ── 7. Service-role match RPCs (consumed by Edge Function retrieval) ─────
create or replace function public.match_user_note_embeddings(
  p_user_id           uuid,
  p_query_vector      extensions.vector(512),
  p_exclude_source_id text,
  p_limit             int default 50
) returns table (
  id          uuid,
  source_id   text,
  chunk_index int,
  chunk_text  text,
  similarity  float,
  metadata    jsonb
)
language sql stable security definer
set search_path = public, extensions
as $$
  select e.id, e.source_id, e.chunk_index, e.chunk_text,
         1 - (e.embedding <=> p_query_vector) as similarity,
         e.metadata
    from public.lamplight_embeddings e
   where e.user_id = p_user_id
     and e.source_type = 'note'
     and (p_exclude_source_id is null or e.source_id <> p_exclude_source_id)
   order by e.embedding <=> p_query_vector
   limit p_limit
$$;

revoke execute on function public.match_user_note_embeddings(uuid, extensions.vector(512), text, int)
  from public, authenticated;

create or replace function public.match_bible_embeddings(
  p_query_vector extensions.vector(512),
  p_limit        int default 50
) returns table (
  id          uuid,
  source_id   text,
  chunk_index int,
  chunk_text  text,
  similarity  float,
  metadata    jsonb
)
language sql stable security definer
set search_path = public, extensions
as $$
  select e.id, e.source_id, e.chunk_index, e.chunk_text,
         1 - (e.embedding <=> p_query_vector) as similarity,
         e.metadata
    from public.lamplight_embeddings e
   where e.user_id is null
     and e.source_type = 'bible_passage'
   order by e.embedding <=> p_query_vector
   limit p_limit
$$;

revoke execute on function public.match_bible_embeddings(extensions.vector(512), int)
  from public, authenticated;

-- ── 8. Authenticated browser-callable RPC with server-side aggregation ───
create or replace function public.match_my_note_neighbors(
  p_source_note_id uuid,
  p_k              int default 5,
  p_min_similarity float default 0.78
) returns table (
  related_note_id uuid,
  similarity      float
)
language plpgsql stable security definer
set search_path = public, extensions
set statement_timeout = '30s'
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  if not exists (
    select 1 from public.notes
     where id = p_source_note_id and user_id = v_user_id
  ) then
    raise exception 'not authorized';
  end if;

  return query
    with source_chunks as (
      select e.chunk_index, e.embedding
        from public.lamplight_embeddings e
       where e.user_id = v_user_id
         and e.source_type = 'note'
         and e.source_id = p_source_note_id::text
    ),
    candidate_hits as (
      select c.source_id as related_source_id,
             (1 - (c.embedding <=> sc.embedding))::float as sim
        from source_chunks sc
        cross join lateral (
          select e.source_id, e.embedding
            from public.lamplight_embeddings e
           where e.user_id = v_user_id
             and e.source_type = 'note'
             and e.source_id <> p_source_note_id::text
           order by e.embedding <=> sc.embedding
           limit greatest(p_k * 4, 20)
        ) c
    )
    select (related_source_id::uuid) as related_note_id,
           max(sim) as similarity
      from candidate_hits
     group by related_source_id
    having max(sim) >= p_min_similarity
     order by max(sim) desc
     limit p_k;
end;
$$;

grant execute on function public.match_my_note_neighbors(uuid, int, float) to authenticated;

-- ── 9. Edge-Function-only atomic DELETE+INSERT RPC ───────────────────────
create or replace function public.replace_note_embeddings(
  p_user_id      uuid,
  p_note_id      text,
  p_content_hash text,
  p_chunks       jsonb
) returns void
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  delete from public.lamplight_embeddings
   where user_id = p_user_id
     and source_type = 'note'
     and source_id = p_note_id;

  insert into public.lamplight_embeddings
    (user_id, source_type, source_id, chunk_index, chunk_text, content_hash, embedding, metadata)
  select p_user_id,
         'note',
         p_note_id,
         (c->>'chunk_index')::int,
         c->>'chunk_text',
         p_content_hash,
         (c->>'embedding')::extensions.vector(512),
         coalesce(c->'metadata', '{}'::jsonb)
    from jsonb_array_elements(p_chunks) c;
end;
$$;

revoke execute on function public.replace_note_embeddings(uuid, text, text, jsonb)
  from public, authenticated;
-- service-role only (no grant); Edge Function uses service-role JWT.
