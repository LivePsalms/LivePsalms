-- 026_notes_general_type.sql
-- Add a fourth "general" note type. The notes.type CHECK from migration 002
-- only allowed ('devotion','sermon','theme'); widen it so plain/general notes
-- can be created. Additive and backward-compatible — existing rows are
-- unaffected, and the column default stays 'devotion'.

alter table public.notes drop constraint if exists notes_type_check;

alter table public.notes
  add constraint notes_type_check
  check (type in ('general', 'devotion', 'sermon', 'theme'));
