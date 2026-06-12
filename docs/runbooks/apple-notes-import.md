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

## Building the Shortcut step by step (maintainer, one-time)

Build this once in the **Shortcuts app** (easiest on a Mac, also works on iPhone/iPad),
test it, then share it as an iCloud link. Each numbered step is one action you add by
searching the action list and dragging it in, in order.

**Prep:** open Shortcuts → **File ▸ New Shortcut** (Mac) or **+** (iOS). Name it
`Import Apple Notes`. In the shortcut settings (ⓘ), turn ON **Show in Share Sheet**
is *not* needed — this runs standalone.

1. **Ask for Input** (search "Ask for Input")
   - Input type: **Text**
   - Prompt: `Paste your Psalms token (psalms_pat_…)`
   - Then add **Set Variable** → name it `token`.
   *(This prompts for the token every run. To store it permanently instead, replace
   these two with a single **Text** action holding the token and Set Variable `token` —
   less safe but no prompt. The Ask-for-Input version is recommended for sharing.)*

2. **Text** action → type the endpoint URL exactly:
   `https://<project-ref>.functions.supabase.co/import-apple-note`
   Then **Set Variable** → `endpoint`.
   *(Replace `<project-ref>` with the real Supabase project ref before sharing.)*

3. **Find Notes** (search "Find Notes")
   - Tap **Add Filter** → **Folder** → **is** → choose the folder, OR tap the folder
     value and select **Ask Each Time** so the user picks at run time.
   - Leave **Sort by** / **Limit** off (import everything in the folder).

4. **Repeat with Each** (search "Repeat with Each"), pass it the **Notes** output from
   step 3. Everything below goes *inside* the Repeat block (between "Repeat with Each"
   and "End Repeat"). Inside the block, the current note is the **Repeat Item** variable.

   4a. **Get Details of Notes** → detail: **Name**, input: **Repeat Item** →
       **Set Variable** `noteTitle`.

   4b. **Get Details of Notes** → detail: **Body**, input: **Repeat Item**. Add
       **Get Text from Input** (input = that Body) → **Set Variable** `noteText`.

   4c. **Get Details of Notes** → detail: **Creation Date**, input: **Repeat Item**.
       Add **Format Date** → Date Format: **Custom** → format string `yyyy-MM-dd'T'HH:mm:ss'Z'`
       (or pick **ISO 8601**) → **Set Variable** `createdAt`.

   4d. **Get Details of Notes** → detail: **Modification Date**, input: **Repeat Item**.
       Add **Format Date** (same ISO 8601 format) → **Set Variable** `modifiedAt`.

   4e. **Get Contents of URL** (search "Get Contents of URL"), input = the `endpoint`
       variable. Tap **Show More** and set:
       - **Method:** `POST`
       - **Headers:** add two —
         - `Authorization` = `Bearer ` followed by the `token` variable
           (type `Bearer `, then insert the variable right after the space)
         - `Content-Type` = `application/json`
       - **Request Body:** **JSON**, then **Add new field** for each (pick the right type):
         - `title` (Text) = `noteTitle`
         - `text` (Text) = `noteText`
         - `created_at` (Text) = `createdAt`
         - `modified_at` (Text) = `modifiedAt`
         - `folder_name` (Text) = the folder name (a Text value, or the folder the user
           picked in step 3 — you can reuse an **Ask Each Time** value here)

   4f. *(Optional)* **Get Dictionary Value** → key `status` from the **Contents of URL**
       output, then **Add to Variable** `results` to tally outcomes.

5. *(After End Repeat, optional)* **Show Notification** or **Show Result** with the
   `results` count so the user sees how many notes were created/updated/unchanged.

**Test before sharing:** run the Shortcut against a small test folder (2–3 notes).
First run should report `created`; an immediate re-run should report `unchanged`;
editing a note in Apple Notes then re-running should report `updated`. Confirm the
notes appear under **Apple Notes › <folder>** in the Psalms notepad.

**Distribute:** Shortcuts → right-click the shortcut → **Share** → **Copy iCloud Link**
(enable iCloud sharing if prompted). Put that link in the Settings → Connect Apple
Notes copy and in the "User setup" section above. Anyone with the link installs it in
one tap; on first run it prompts for their own token.

> Note: a Shortcut is authored in Apple's GUI and lives as a `.shortcut` file in
> iCloud, not as code in this repo. These instructions are the source of truth for
> rebuilding it; there is no file to commit here beyond this runbook.

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
