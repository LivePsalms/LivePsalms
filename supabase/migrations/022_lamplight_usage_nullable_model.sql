-- 022_lamplight_usage_nullable_model.sql
--
-- Allow lamplight_usage.model to be NULL. Pre-model failures (quota block,
-- context-build throw) now record an honest NULL model instead of a fictional
-- model id, so cost attribution stays correct. See generation-lifecycle.ts.

alter table public.lamplight_usage
  alter column model drop not null;
