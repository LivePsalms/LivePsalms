-- Add last_acknowledged_tier_threshold to profiles so the level-up modal can
-- be shown exactly once per user per tier crossing, persisted across sessions
-- and devices. Without this column the client compares current tier against a
-- React ref captured at mount time, which causes the modal to fire on every
-- login because the "previous" snapshot resets each time NotepadToolbar mounts.
--
-- Backfill: existing users are treated as having already acknowledged their
-- current tier, so deploying this migration does not retroactively fire the
-- modal for everyone on their next login. New tier crossings after deploy
-- behave normally.

alter table public.profiles
  add column if not exists last_acknowledged_tier_threshold integer not null default 0;

-- Tier thresholds mirror src/notepad/gamification/tiers.ts.
-- The where-clause keeps the backfill idempotent if the migration is replayed:
-- only rows still at the default 0 are touched.
update public.profiles
  set last_acknowledged_tier_threshold = case
    when highest_note_count >= 5000 then 5000
    when highest_note_count >= 1000 then 1000
    when highest_note_count >= 500  then 500
    when highest_note_count >= 300  then 300
    when highest_note_count >= 150  then 150
    when highest_note_count >= 50   then 50
    when highest_note_count >= 10   then 10
    else 0
  end
  where last_acknowledged_tier_threshold = 0;
