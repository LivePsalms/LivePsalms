-- 012_lamplight_match_rpcs.sql — pgvector cosine match RPCs for Reasoning Layer.
--
-- Two SECURITY DEFINER functions that wrap the cosine ordering query against
-- lamplight_embeddings so the Edge Function never constructs SQL strings.
-- Both are revoked from public + authenticated; service-role only.
--
-- search_path is pinned to (public, extensions) so the pgvector `<=>` operator
-- resolves inside the function body. This mirrors how migration 011 had to
-- fully-qualify `extensions.vector_cosine_ops` in the HNSW index — operators
-- and operator classes need the extensions schema visible.
--
-- The parameter type must be fully-qualified as `extensions.vector(1024)`:
-- the function's `set search_path` clause applies only at runtime, not at
-- CREATE FUNCTION parse time, so an unqualified `vector(1024)` in the
-- signature fails with "type vector does not exist".

create or replace function public.match_user_note_embeddings(
  p_user_id uuid,
  p_query_vector extensions.vector(1024),
  p_exclude_source_id text,
  p_limit int default 50
)
returns table (
  id uuid,
  source_id text,
  similarity float,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select e.id,
         e.source_id,
         1 - (e.embedding <=> p_query_vector) as similarity,
         e.metadata
    from public.lamplight_embeddings e
   where e.user_id = p_user_id
     and e.source_type = 'note'
     and (p_exclude_source_id is null or e.source_id <> p_exclude_source_id)
   order by e.embedding <=> p_query_vector
   limit p_limit
$$;

create or replace function public.match_bible_embeddings(
  p_query_vector extensions.vector(1024),
  p_limit int default 50
)
returns table (
  id uuid,
  source_id text,
  similarity float,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select e.id,
         e.source_id,
         1 - (e.embedding <=> p_query_vector) as similarity,
         e.metadata
    from public.lamplight_embeddings e
   where e.user_id is null
     and e.source_type = 'bible_passage'
   order by e.embedding <=> p_query_vector
   limit p_limit
$$;

revoke execute on function public.match_user_note_embeddings(uuid, extensions.vector(1024), text, int) from public, authenticated;
revoke execute on function public.match_bible_embeddings(extensions.vector(1024), int) from public, authenticated;
