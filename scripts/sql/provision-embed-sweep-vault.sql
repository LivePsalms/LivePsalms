-- scripts/sql/provision-embed-sweep-vault.sql
--
-- Provisions the two Vault secrets that migration 011's `lamplight_embed_sweep`
-- pg_cron job reads at run time. Until both exist, the cron schedule is a
-- silent no-op (per the `where url is not null and key is not null` guard at
-- supabase/migrations/011_lamplight_signal_layer.sql:148).
--
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor) — the
-- editor's role has the privileges Vault needs and the JWT never leaves
-- Supabase. Do NOT commit the resolved JWT to git.
--
-- Project ref: xnldoqfpzlwxjuwvkmqa (from supabase/.temp/project-ref).
-- Service role key: copy from Dashboard → Project Settings → API → service_role.

-- ── 1. Edge Function URL ─────────────────────────────────────────────────
-- Use the modern /functions/v1/ host; the deprecated <ref>.functions.supabase.co
-- host also works but is being phased out.
select vault.create_secret(
  'https://xnldoqfpzlwxjuwvkmqa.supabase.co/functions/v1/embed-note',
  'embed_fn_url'
);

-- ── 2. Service role JWT ──────────────────────────────────────────────────
-- Replace <PASTE_SERVICE_ROLE_JWT_HERE> with the full eyJ… token.
select vault.create_secret(
  '<PASTE_SERVICE_ROLE_JWT_HERE>',
  'service_role_key'
);

-- ── 3. Verify both secrets exist ─────────────────────────────────────────
-- Names only; never SELECT decrypted_secret in shared sessions.
select name, created_at
  from vault.secrets
 where name in ('embed_fn_url', 'service_role_key')
 order by name;

-- ── 4. Verify the cron job is scheduled and active ───────────────────────
select jobid, schedule, jobname, active
  from cron.job
 where jobname = 'lamplight_embed_sweep';

-- ── 5. After ~1 minute, confirm the cron is firing successfully ──────────
-- Expected: rows with status='succeeded' arriving every minute.
select start_time, status, return_message
  from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'lamplight_embed_sweep')
 order by start_time desc
 limit 5;

-- ── Rotation (later) ─────────────────────────────────────────────────────
-- When the service role key is rotated, UPDATE the existing row so the cron
-- job's reference keeps resolving — don't create a second secret:
--
--   update vault.secrets set secret = '<NEW_JWT>' where name = 'service_role_key';
