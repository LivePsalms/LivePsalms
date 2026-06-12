# Apple Notes Import — Runbook

Lets users bring their Apple Notes into the Psalms notepad via an Apple Shortcut
that POSTs each note to the `import-apple-note` edge function, authenticated by a
personal access token (PAT).

## User setup
1. In Psalms → Settings → **Connect Apple Notes**, tap **Generate token** and
   copy the `psalms_pat_…` value (shown once).
2. Install the Psalms "Import Apple Notes" Shortcut (link distributed separately).
3. On first run the Shortcut prompts for the token and stores it; paste the value.

## Shortcut recipe (build once, distribute as an iCloud link)
1. **Text** action → the import endpoint:
   `https://<project-ref>.functions.supabase.co/import-apple-note`
   (or `${VITE_SUPABASE_URL}/functions/v1/import-apple-note`).
2. **Find Notes** → filter to a folder the user picks (use "Ask Each Time" for the folder).
3. **Repeat with Each** (the found notes):
   - **Get Details of Notes** → Name → set variable `noteTitle`.
   - **Get Details of Notes** → Body → **Get Text from Input** → variable `noteText`.
   - **Get Details of Notes** → Creation Date → **Format Date** (ISO 8601) → `createdAt`.
   - **Get Details of Notes** → Modification Date → **Format Date** (ISO 8601) → `modifiedAt`.
   - **Get Contents of URL**:
     - Method: `POST`
     - Headers: `Authorization: Bearer <stored token>`, `Content-Type: application/json`
     - Request Body: JSON →
       `{ "title": noteTitle, "text": noteText, "created_at": createdAt, "modified_at": modifiedAt, "folder_name": "<picked folder name>" }`
4. (Optional) Show a final count of created/updated/unchanged responses.

The endpoint returns `{ status: "created" | "updated" | "unchanged", note_id }` per note.

## Behaviour
- Imported notes land in an auto-created **Apple Notes** folder (a named subfolder
  when `folder_name` is sent), with `type = general`.
- Dedup key = SHA-256 of `creation-date|title`. Re-running is safe: a note is only
  rewritten when its Apple modification date is newer than the last import.
- Rate limit: 600 requests/hour per token (HTTP 429 beyond that).

## Deployment (run by a maintainer)
1. Apply the migration (NOT in CI — manual):
   `supabase db push` (against the linked project).
2. Deploy the function (NOT carried by a frontend/Vercel deploy):
   `supabase functions deploy import-apple-note --use-api`
3. Confirm `config.toml` pushed `verify_jwt = false` for `import-apple-note`.
   **Review the push diff** — a config push can clobber the whole `[auth]` block.
4. Ensure `ALLOWED_ORIGINS` is unchanged (CORS is irrelevant to the Shortcut, but
   the shared helper still reads it).

## Revocation
Settings → Connect Apple Notes → **Revoke** sets `revoked_at`; the next Shortcut
run gets HTTP 401.
