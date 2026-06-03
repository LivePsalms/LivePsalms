# Handwriting Note Transcription — Design

**Date:** 2026-06-02
**Status:** Approved (brainstorming) — pending implementation plan
**Feature:** Let a user scan/upload a handwritten note (camera or photo) and get an
accurate, editable transcription, even when the handwriting is sloppy. Built to
exploit what this app uniquely knows: Scripture.

---

## Goal

When a user on the notepad chooses to upload a note and supplies a handwritten
page, the app should transcribe it as accurately as possible — using the app's
Scripture knowledge to resolve messy words and to flag (never fabricate)
verse references — then hand the user an editable transcript for one-tap
correction before it becomes a real note.

## Non-goals (v1)

- Multi-page batch scanning (schema is shaped to allow it later; UI is one image per scan).
- Async job-queue processing (interactive single Claude call is sufficient; the
  Lamplight-style job queue is a deferred option only if batch lands).
- Building an automated accuracy eval *harness* (the eval **data** is captured from day one).
- Auto-correcting the user's text against canonical Scripture (explicitly rejected — see Decisions).

## Decisions locked during brainstorming

1. **Vision model: Claude Sonnet** (`claude-sonnet-4-6`) via the existing
   `_shared/anthropic.ts` adapter + a new `transcribe-note` Edge Function. No
   second AI provider (the reference's Gemini is not adopted — the app already
   runs Claude). Sonnet over Haiku: better on messy handwriting, worth it on a
   low-frequency action.
2. **Capture: camera + file upload.** In-app `getUserMedia` camera capture plus
   file/photo picker.
3. **Scripture handling: verify + flag, never autocorrect.** Transcribe exactly
   what's written; detect verse references; look them up in `bible_passages`;
   flag mismatches/not-found for the user. The user always decides. Honors the
   Lamplight "never pronounce / never fabricate Scripture" principle.
4. **Preprocessing: full.** Canvas downscale→grayscale→contrast **plus**
   OpenCV.js/jscanify auto-deskew/edge-flatten, with the heavy WASM lazy-loaded
   only when the capture flow opens.
5. **Image retention: keep on save, purge on discard.** Saved notes keep their
   source image (re-view original; eval set). Discarded scans delete image + row.

---

## Architecture

Transcription is a **third input path** into the notepad alongside file-import and
manual-create. It feeds the *same* existing pipeline —
`buildNoteFromText` → `importNote` → `linkNotesByVerses` (see
`src/notepad/import/document-importer.ts`) — so auto verse-tagging, backlinks,
and embeddings all happen for free once the note is saved. The only genuinely new
surface is the **capture → preprocess → transcribe → review** front half.

### Component inventory (new unless noted)

| Layer | Unit | Responsibility |
|---|---|---|
| Client / capture | `ScanCapture` component | Camera (`getUserMedia`) + file/photo picker. One image per scan in v1. |
| Client / image | `image-preprocess.ts` (pure transform `Blob→Blob`) | Canvas downscale→grayscale→contrast. Lazy-imports `deskew.ts`. |
| Client / image | `deskew.ts` (lazy) | OpenCV.js/jscanify edge-detect + 4-point perspective flatten. No-op if no confident quad. |
| Client / data | `transcription-client.ts` | Upload cleaned image to `note-scans` bucket → `invoke('transcribe-note')` → return result. |
| Server | `supabase/functions/transcribe-note/index.ts` | Auth + entitlement, fetch image, call Claude vision, verse verification, log usage, return JSON. |
| Server | `supabase/functions/_shared/anthropic.ts` (**extend**) | Add multimodal (image) message support — currently text-only. |
| Client / review | `TranscriptionReview` component | Side-by-side image + editable TipTap transcript; uncertain-word highlight; verse-flag panel; confirm/discard. |
| Client / editor | `uncertain-decoration.ts` | ProseMirror decoration plugin highlighting low-confidence spans. |
| Data | `note_transcriptions` table + `note-scans` Storage bucket | Provenance, original image (safety net), eval set. |

### Data flow

```
1. User opens Scan → ScanCapture (camera shot OR file pick)
2. image-preprocess: downscale→gray→contrast → (lazy) deskew/flatten
3. transcription-client: upload cleaned image → note-scans/{userId}/{uuid}.jpg → key
4. invoke transcribe-note(image_key)
      ├─ Claude vision (sonnet) → {transcription, confidence, uncertainWords[]}
      ├─ extractVerseRefs(transcription) → look up each in bible_passages → verseFlags[]
      └─ insert note_transcriptions row (status='transcribed'), recordLamplightUsage
5. TranscriptionReview: image (signed URL) ║ editable transcript
      • uncertain words highlighted   • verse flags ("Psalm 23:1 ✓" / "not found — check")
6. User edits + Confirm → buildNoteFromText → importNote → linkNotesByVerses
      └─ update note_transcriptions: note_id set, status='saved'
   User Discard → delete image from Storage AND delete the note_transcriptions row
```

**Boundaries:** preprocessing knows nothing about Claude; the Edge Function knows
nothing about TipTap; the review component knows nothing about how the image was
captured. Each is independently testable.

---

## Server side

### `transcribe-note` Edge Function

Mirrors the `lamplight-generate` skeleton: `serve` + `CORS_HEADERS`, top-level
`try` → `jsonResp` (so every error keeps CORS headers), `serviceClient()`,
`recordLamplightUsage`. Reuses platform JWT verification.

Request: `POST { user_id, image_key }`. Steps:

1. Require `ANTHROPIC_API_KEY` (else 500). Validate `user_id` is a UUID and
   `image_key` is prefixed exactly `note-scans/{user_id}/` — defense-in-depth
   against IDOR through the privileged service client.
2. Download the image object from Storage → base64. Enforce MIME allow-list +
   max-size cap (≤10 MB).
3. Call Claude **sonnet** vision with a forced tool (schema below). `maxTokens`
   ~4096 for this call.
4. `extractVerseRefs(transcription)` → verse verification (below) → `verseFlags[]`.
5. Insert `note_transcriptions` row (`status='transcribed'`),
   `recordLamplightUsage({ artifact_kind:'note_transcription', model, tokens_in, tokens_out, status })`.
6. Return `{ transcription, confidence, uncertainWords, verseFlags, transcription_id }`.

### Anthropic adapter extension (`_shared/anthropic.ts`)

Today `GenerateInput.messages[].content` is `string`. Widen to
`string | ContentBlock[]`, where a block is `{type:'text', text}` or
`{type:'image', source:{type:'base64', media_type, data}}`. Purely additive —
existing text callers (Lamplight pipelines) are untouched. `'sonnet'` already
maps to `claude-sonnet-4-6` in `MODEL_IDS`.

### Forced-tool structured-output schema

```ts
tool: {
  name: 'record_transcription',
  description: '...',
  input_schema: {
    type: 'object',
    properties: {
      transcription:  { type: 'string' },   // exact, line breaks preserved
      confidence:     { type: 'number' },    // 0–1 overall legibility
      uncertainWords: {                       // each: bare word + short context
        type: 'array',
        items: { type: 'object', properties: {
          text:    { type: 'string' },
          context: { type: 'string' }         // ~3 surrounding words, to locate the right span
        }, required: ['text'] }
      }
    },
    required: ['transcription', 'confidence', 'uncertainWords']
  }
}
```

`context` (not just the bare word) is what lets the decoration plugin highlight
the correct occurrence when a word repeats.

### System prompt (domain-primed, never-fabricate)

> You are transcribing a handwritten note from a Psalms / Bible-study devotional
> journal. The writer may reference verses ("Psalm 23:1"), psalm titles, prayers,
> and scriptural language — use this context to resolve messy handwriting.
> Transcribe EXACTLY what is written, preserving line breaks and the writer's own
> spelling. Do NOT paraphrase, correct, complete, or add commentary. If a word is
> illegible, give your single best guess and add it to uncertainWords. **Never
> invent text, and never insert Scripture the writer did not write.**

### Verse verification (verify + flag, server-side)

For each ref from `extractVerseRefs(transcription)`, parse `book/chapter/verse`
and look it up in `bible_passages` (book, chapter, verse_start, verse_end, text):

- `{ ref, status:'found', canonicalText }` → review UI can show the real verse
  beside what was written (catches a misread word inside a quote).
- `{ ref, status:'not_found' }` → reference doesn't resolve (e.g. "Psalm 151:1"):
  flag "couldn't find this — check the photo." Catches both **misreads** and
  **hallucinated references**, and never edits the user's text.

Verification is an **enhancement, not a hard dependency**: if a lookup throws, it
degrades to "skipped" and the transcription still returns.

Decision: verse verification runs **server-side inside the function** (one
round-trip, reuses the server's Bible access) rather than client-side.

---

## Data model

New migration `019_note_transcriptions.sql`:

```sql
create table note_transcriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  note_id uuid references notes(id) on delete set null,   -- set on save
  image_key text not null,            -- note-scans/{user_id}/{uuid}.jpg
  raw_transcription text not null,    -- model output, never mutated → eval set
  confidence numeric,
  uncertain_words jsonb not null default '[]',
  verse_flags jsonb not null default '[]',
  model text,
  status text not null default 'transcribed',  -- 'transcribed' | 'saved' (discard deletes the row)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- RLS: auth.uid() = user_id on SELECT/INSERT/UPDATE/DELETE (same pattern as notes).
```

`raw_transcription` is immutable while the final edited text lives on
`notes.content`. raw vs. corrected = the accuracy eval set the reference calls out.

### Storage bucket `note-scans`

**Private** (unlike the public `avatars` bucket — these are personal journal
pages), RLS keyed on `(storage.foldername(name))[1] = auth.uid()::text` for
insert/update/select/delete (mirror `004_storage.sql`), read via short-lived
signed URLs only.

---

## Client side

### Capture — `ScanCapture`

Reached from the notepad's existing upload affordance (UploadModal "+" / mobile
FAB). Two entry points:

- **Take photo** → `getUserMedia({ video:{ facingMode:'environment' }})`, live
  preview, shutter → `Blob`. Graceful fallback to file input if permission denied
  or no camera (desktop).
- **Choose photo** → `<input type="file" accept="image/*" capture="environment">`
  (on mobile this also offers the native camera — most reliable path).

Accept JPG/PNG/HEIC/WebP. HEIC → decode via canvas; if unsupported, lazy-load
`heic2any`; if that fails, ask for JPG/PNG. One image per scan in v1.

### Preprocessing — `image-preprocess.ts`

Pure transform `Blob → Blob` on an offscreen canvas, no dependencies:

1. Downscale to ~1500px long edge (skip if already smaller).
2. Grayscale + auto-contrast (histogram stretch).
3. Re-encode JPEG q≈0.85.

Then `await import('./deskew')` for the heavy pass.

### Deskew — `deskew.ts` (lazy)

OpenCV.js/jscanify document-edge detection → 4-point perspective warp to flatten
an angled photo → cropped, deskewed canvas. Multi-MB WASM dynamically imported
**only** when `ScanCapture` opens — zero cost to the notepad bundle otherwise. If
no confident quad is found, **no-op** and return input unchanged (never mangle a
straight scan). Spinner "Cleaning up image…" covers this step.

### Upload + invoke — `transcription-client.ts`

Upload cleaned `Blob` to `note-scans/{userId}/{uuid}.jpg` via the supabase client,
then `supabase.functions.invoke('transcribe-note', { body:{ user_id, image_key }})`.
Return the structured result to the review component.

### Review — `TranscriptionReview`

Two-pane (stacks vertically on mobile):

- **Left:** original image from a signed URL — pinch/scroll zoom to squint at a
  hard word.
- **Right:** editable TipTap editor pre-loaded with the transcription (paragraphs
  split on line breaks, same doc shape as `buildNoteFromText`).
  - **Uncertain words** highlighted via `uncertain-decoration.ts` — a ProseMirror
    decoration plugin taking `{text, context}[]`, locating each span (context
    disambiguates repeats), painting a subtle underline/highlight. **Decorations,
    not marks** — ephemeral, never persist into `notes.content`, and editing a
    word naturally clears its flag.
  - **Verse flags** panel: `Psalm 23:1 ✓` (tap to peek canonical text beside what
    was written) and `Psalm 151 — couldn't find this, check the photo`.
    Informational only; never auto-edits.
  - **Title** field (defaults to "Scanned note · {date}", editable) + existing
    auto-detect-verses / auto-link toggles.
- **Actions:** **Save note** → `buildNoteFromText` → `importNote` →
  `linkNotesByVerses`, then PATCH `note_transcriptions` (`note_id`,
  `status='saved'`). **Discard** → delete image from Storage and delete the
  `note_transcriptions` row.

**A11y / reduced-motion:** spinner and reveals honor `prefers-reduced-motion`;
editor is the focus target on mount; image alt text "Your scanned note."

---

## Error handling

Every failure has a defined, recoverable surface — never a dead end, and the
image is preserved through retries.

| Failure | Behavior |
|---|---|
| Camera permission denied / no camera | Silent fallback to file picker; brief inline note. |
| HEIC can't decode | Lazy `heic2any`; if that fails, ask for JPG/PNG. |
| Deskew finds no confident page quad | No-op, proceed with contrast-only image (never mangle). |
| Upload to Storage fails | Retry once, then toast "Couldn't upload — try again"; nothing persisted. |
| Edge Function 4xx/5xx | Adapter retries 429/5xx ×3 w/ backoff. Surfaced as `{error}` via `jsonResp` (CORS-safe). UI: "Transcription failed — retry / use a clearer photo." Image already in Storage → retry needs no re-upload. |
| Claude returns empty/garbage | Low `confidence` + empty → review opens on a blank editor with the image; user types manually. Never block on a bad read. |
| Verse lookup throws | Verification degrades to "skipped" — transcription still returns; flags absent. |

---

## Security

- `note-scans` bucket **private**; per-user folder RLS; reads via short-lived
  signed URLs only.
- Edge Function asserts `image_key` is prefixed `note-scans/{user_id}/` before the
  service client touches the object — blocks IDOR through the privileged client.
- Reuse platform JWT verification (as `lamplight-generate`); `ANTHROPIC_API_KEY`
  stays server-only.
- Input validation: `user_id` UUID, `image_key` pattern match, image MIME
  allow-list + max-size cap (≤10 MB) enforced **client-side and in the function**.
- Handwritten journal pages are sensitive personal/religious content — private
  bucket + per-user RLS + expiring signed URLs are the core safeguard.

---

## Performance

- Heavy OpenCV WASM dynamically imported only when `ScanCapture` opens — zero cost
  to the notepad bundle for non-scanning users.
- Downscaling to ~1500px before upload cuts upload time and Claude input tokens.
- `transcribe-note` = one Claude call + a couple of indexed Postgres lookups —
  interactive latency, no async job queue needed (deferred Approach C if batch lands).

---

## Testing (Vitest + pure-unit conventions)

- `image-preprocess.ts` — pure unit tests (dimension cap, grayscale/contrast on a
  known pixel buffer). Deskew's OpenCV path smoke-tested via UI (DOM/WASM-coupled —
  same exemption as `parseFile`).
- Verse-verification helper (parse ref → `bible_passages` lookup → flag) — pure
  unit tests incl. `not_found` and malformed refs.
- `uncertain-decoration.ts` span-locator — pure unit tests (repeat-word
  disambiguation via `context`, zero matches, overlapping).
- `transcribe-note` — Anthropic adapter's new multimodal shaping + dispatch/
  validation/error branches with mocked `fetch` (same approach as Lamplight tests).
- `note_transcriptions` RLS — policy test mirroring `lamplight-rls.test.ts`.
- **Eval seed:** preserved `raw_transcription` vs. user's final edits = a real
  accuracy eval set captured from day one (harness out of scope for v1).

---

## Deferred / future

- Multi-page batch scanning (per-scan table already supports it).
- Async job-queue processing (Lamplight-style) if batch or slow processing lands.
- Automated accuracy eval harness over the captured raw-vs-edited data set.
