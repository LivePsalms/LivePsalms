-- 013_lamplight_match_rpc_timeout.sql — bump per-function statement_timeout
-- for the cosine-match RPCs.
--
-- Symptom: PGRST returned 57014 (canceling statement due to statement timeout)
-- on the first cold-cache invocation of match_bible_embeddings. Supabase's
-- default per-statement timeout is 8s, which is tight for an HNSW search
-- over ~31K BSB embeddings when the index pages aren't yet in shared_buffers.
-- Once warm, the same query completes in well under 1s, but the cold path
-- can spike to 5–10s on shared compute.
--
-- Fix: raise the per-call statement_timeout to 30s for both match RPCs via
-- ALTER FUNCTION ... SET statement_timeout. The setting is scoped to these
-- functions only; nothing else in the schema is affected. 30s is generous
-- headroom; the practical p99 is far lower. We rely on the existing HNSW
-- index (m=16, ef_construction=64) from migration 011 for actual speed.

alter function public.match_user_note_embeddings(uuid, extensions.vector(1024), text, int)
  set statement_timeout = '30s';

alter function public.match_bible_embeddings(extensions.vector(1024), int)
  set statement_timeout = '30s';
