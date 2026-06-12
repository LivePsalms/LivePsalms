-- 029_onboarding_progress.sql
-- Notepad onboarding: per-user "Your journey" progress for accounts created
-- after the onboarding feature launch. Shape (TS AccountProgress):
--   { guidedNote: 'pending'|'done'|'skipped', items: Record<itemId, isoTimestamp>,
--     dismissed: boolean, studyDates: string[], merged: boolean }
--
-- INTENTIONALLY user-writable. The profiles UPDATE policy (auth.uid() = id) already
-- allows self-update, and this column is deliberately NOT added to
-- protect_privileged_profile_columns() (021) -- onboarding progress is owned by the
-- user, unlike is_admin / note_count / highest_note_count.
--
-- Note: migration 028 was taken by 028_apple_notes_import.sql; this onboarding
-- migration is therefore numbered 029.
alter table public.profiles
  add column if not exists onboarding_progress jsonb;
