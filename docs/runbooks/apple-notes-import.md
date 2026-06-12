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
3. **Repeat with Each** (the found notes). Inside the loop, the current note is the
   **Repeat Item** variable; pull its details by inserting Repeat Item and tapping the
   token to pick a detail (there is **no** "Get Details of Notes" action):
   - Repeat Item → **Name** → set variable `noteTitle`.
   - Repeat Item → **Body** → set variable `noteText`.
   - **Get Contents of URL**:
     - Method: `POST`
     - Headers: `Authorization: Bearer <stored token>`, `Content-Type: application/json`
     - Request Body: JSON →
       `{ "title": noteTitle, "text": noteText, "folder_name": "<picked folder name>" }`
4. (Optional) Show a final count of created/unchanged responses.

The endpoint returns `{ status: "created" | "unchanged", note_id }` per note.

> **Why no dates?** Apple Shortcuts cannot read a note's id or its creation/
> modification dates (the Note variable only exposes Name, Summary, Body, Folder,
> Tags). So the server identifies a note by a **hash of its title + body**, not by
> date. Sending `created_at`/`modified_at` is unnecessary (and they'd be empty).

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

   There is **no** "Get Details of Notes" action. To read a note's fields, insert the
   **Repeat Item** variable and click the token to choose which detail to use (the Note
   type exposes **Name, Summary, Body, Folder, Tags** — note that **dates are not
   available**, which is why the server keys off content, not dates).

   4a. **Text** action → insert **Repeat Item**, click the token → choose **Name** →
       **Set Variable** `noteTitle`.

   4b. **Text** action → insert **Repeat Item**, click the token → choose **Body** →
       **Set Variable** `noteText`.

   4c. **Get Contents of URL** (search "Get Contents of URL"), input = the `endpoint`
       variable. Tap **Show More** and set:
       - **Method:** `POST`
       - **Headers:** add two —
         - `Authorization` = `Bearer ` followed by the `token` variable
           (type `Bearer `, then insert the variable right after the space)
         - `Content-Type` = `application/json`
       - **Request Body:** **JSON**, then **Add new field** for each (Type = Text):
         - `title` (Text) = `noteTitle`
         - `text` (Text) = `noteText`
         - `folder_name` (Text) = the folder name (a Text value, or the folder the user
           picked in step 3 — you can reuse an **Ask Each Time** value here)

   4d. *(Optional)* **Get Dictionary Value** → key `status` from the **Contents of URL**
       output, then **Add to Variable** `results` to tally outcomes.

5. *(After End Repeat, optional)* **Show Notification** or **Show Result** with the
   `results` count so the user sees how many notes were created/unchanged.

**Test before sharing:** run the Shortcut against a small test folder (2–3 notes).
First run should report `created`; an immediate re-run should report `unchanged`.
(Editing a note's text then re-running imports it as a *new* note, because identity is
the title+body hash — see Behaviour.) Confirm the notes appear under
**Apple Notes › <folder>** in the Psalms notepad.

**Distribute:** Shortcuts → right-click the shortcut → **Share** → **Copy iCloud Link**
(enable iCloud sharing if prompted). Put that link in the Settings → Connect Apple
Notes copy and in the "User setup" section above. Anyone with the link installs it in
one tap; on first run it prompts for their own token.

> Note: a Shortcut is authored in Apple's GUI and lives as a `.shortcut` file in
> iCloud, not as code in this repo. These instructions are the source of truth for
> rebuilding it; there is no file to commit here beyond this runbook.

## Behaviour
- Imported notes land in an auto-created **Apple Notes** folder (a named subfolder
  when `folder_name` is sent), with `type = general`. The note's date in Psalms is its
  import time (Apple's original dates are not available to Shortcuts).
- **Dedup key = SHA-256 of `title|body`** (the note's content). Re-running is safe:
  an unchanged note returns `unchanged` and is not re-inserted.
  - Two notes with the *same title AND same body* are treated as one.
  - A note **edited** in Apple Notes hashes differently, so it imports as a **new**
    note (the previous version remains; the server never overwrites a different note).
    If you re-import frequently after edits, expect extra copies — delete stale ones in
    Psalms.
- Statuses: `created` (new) or `unchanged` (identical content already imported). There
  is no `updated` status — see the edit behaviour above.
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
