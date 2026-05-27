-- 014_lamplight_connection_match_rpc.sql — authenticated-callable neighbor
-- lookup for Connection Cards (sub-project 5).
--
-- Unlike match_user_note_embeddings (from migration 012, service-role only,
-- accepts an arbitrary p_user_id), this RPC derives the user identity from
-- auth.uid() and ownership-checks the source note before returning anything.
-- Returns only (related_note_id, similarity) — no embeddings leak — so it
-- is safe to grant to `authenticated` and skip the Edge Function hop.
--
-- Type qualification matches migration 012's discipline: extensions.vector(1024)
-- in the signature (pgvector type lives in the extensions schema; set
-- search_path applies at runtime, not at parse time, so the signature must be
-- fully qualified). Statement timeout = 30s matches migration 013.

create or replace function public.match_my_note_neighbors(
  p_source_note_id uuid,
  p_k int default 5,
  p_min_similarity float default 0.78
)
returns table (
  related_note_id uuid,
  similarity float
)
language plpgsql
stable
security definer
set search_path = public, extensions
set statement_timeout = '30s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_embedding extensions.vector(1024);
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  if not exists (
    select 1 from public.notes
     where id = p_source_note_id
       and user_id = v_user_id
  ) then
    raise exception 'not authorized';
  end if;

  select e.embedding
    into v_source_embedding
    from public.lamplight_embeddings e
   where e.user_id = v_user_id
     and e.source_type = 'note'
     and e.source_id = p_source_note_id::text
   limit 1;

  if v_source_embedding is null then
    return;
  end if;

  return query
    select (e.source_id::uuid) as related_note_id,
           (1 - (e.embedding <=> v_source_embedding))::float as similarity
      from public.lamplight_embeddings e
     where e.user_id = v_user_id
       and e.source_type = 'note'
       and e.source_id <> p_source_note_id::text
       and (1 - (e.embedding <=> v_source_embedding)) >= p_min_similarity
     order by e.embedding <=> v_source_embedding
     limit p_k;
end;
$$;

grant execute on function public.match_my_note_neighbors(uuid, int, float) to authenticated;
