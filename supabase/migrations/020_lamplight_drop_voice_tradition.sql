-- 020_lamplight_drop_voice_tradition.sql
-- Voice + tradition are now auto-determined by the model from note content;
-- these manual-preference columns are no longer read or written.
alter table lamplight_settings drop column if exists voice_preference;
alter table lamplight_settings drop column if exists tradition_hint;
