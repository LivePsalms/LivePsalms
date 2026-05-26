# Signal Layer — Post-Deploy Steps

After applying migration 011 in a fresh environment, run these once.

## 1. Set Edge Function secrets

```bash
supabase secrets set VOYAGE_AI_KEY=<your-voyage-key>
```

## 2. Deploy the Edge Function

```bash
supabase functions deploy embed-note --no-verify-jwt=false
```

Capture the deployed URL — it has the form
`https://<project-ref>.functions.supabase.co/embed-note`.

## 3. Provision pg_cron settings

Open the SQL editor for the production database (NOT a migration file —
the service role key must not be committed) and run:

```sql
alter database postgres
  set app.settings.embed_fn_url = 'https://<project-ref>.functions.supabase.co/embed-note';

alter database postgres
  set app.settings.service_role_key = '<service-role-jwt>';
```

These are read by `cron.schedule('lamplight_embed_sweep', …)` registered in
migration 011. Until they are set, the sweep is a no-op.

## 4. Run BSB ingest

```bash
SUPABASE_URL=<...> SUPABASE_SERVICE_ROLE_KEY=<...> VOYAGE_AI_KEY=<...> \
  npx tsx scripts/ingest-bsb.ts
```

Expected: ~32K rows in `bible_passages` + matching rows in `lamplight_embeddings`.
Re-running is a no-op.

## 5. Run note backfill

```bash
SUPABASE_URL=<...> SUPABASE_SERVICE_ROLE_KEY=<...> \
  npx tsx scripts/backfill-note-embeddings.ts
```

The script enqueues `embedding_refresh` jobs; `pg_cron` drains them at 1/min,
or invoke the function directly with `{"sweep":true}` to drain immediately.
