-- 023_notes_decorations.sql
--
-- Free-canvas decorations placed on a note (Layer 3 of notepad styling).
-- Stored as a JSON array of NoteDecoration objects. Existing notes default
-- to an empty array.

alter table public.notes
  add column if not exists decorations jsonb not null default '[]'::jsonb;
