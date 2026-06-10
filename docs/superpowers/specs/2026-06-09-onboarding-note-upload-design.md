# Onboarding Note Upload — Design

**Date:** 2026-06-09
**Status:** Approved (pending spec review)

## Problem

New users who already keep notes elsewhere have no way to bring them in during
signup — they land in an empty notepad and must discover the in-app upload later.
Add an optional "bring your existing notes" step to the signup onboarding so a new
user can upload files (or skip) before they start, for a more unified first run.

## Decisions (from brainstorming)

1. **Placement:** the `/welcome` page becomes two sequential beats in one route —
   (1) profile (name + DOB), (2) import. No new route.
2. **Minimal uploader, smart defaults:** drag-drop (.md/.txt/.pdf/.docx) + a
   selected-files list + Skip / Upload. Defaults: verse auto-tagging ON, cross-links
   OFF, destination Root. No options UI in onboarding (users refine later in-app).
3. Reuse the shared `filesToNotes` parser; do **not** reuse `UploadModal` (it is
   coupled to `NotepadProvider`, which is not mounted on `/welcome`).
4. The existing `MigrationDialog` (in-browser local-note migration) is unchanged.

## Current state (for reference)

- Signup → `/notepad/notes`; `useNotepadFirstLoad` sees no `profile.fullName` and
  redirects to `/welcome`. `WelcomePage` collects name + DOB, calls
  `account.updateProfile(...)`, then `navigate('/notepad/notes')`.
- `useAuthSession()` exposes `adapter` (the notes storage adapter — `SupabaseAdapter`
  for a logged-in user). `adapter.importNote(note)` is id-preserving and maps
  `folderId === 'root'` → `null` folder_id, so imported notes need no folder setup.
- `src/notepad/import/document-importer.ts` exports `filesToNotes(files, { folderId,
  autoDetectVerses?, autoCreateLinks? })` — provider-free; parses each file to a
  full `Note`. Already unit-tested.
- `react-dropzone` is already a dependency (used by `UploadModal`).

## Architecture

### Unit 1 — `WelcomeImportStep` (new: `src/auth/WelcomeImportStep.tsx`)

A self-contained, presentation-plus-action unit for the import beat.

Props:
```ts
interface WelcomeImportStepProps {
  adapter: Pick<NotesAdapter, 'importNote'>; // from useAuthSession in WelcomePage
  onDone: () => void;   // imported (or finished) → navigate to notepad
  onSkip: () => void;   // skipped → navigate to notepad
}
```
(`NotesAdapter` is the interface in `src/notepad/storage/adapter.ts`.)

Behavior:
- `react-dropzone` zone accepting `.md/.txt/.pdf/.docx`; accumulates `File[]` in
  state, de-duped by name (mirrors `UploadModal`'s `onDrop`). Shows a selected-files
  list with per-file remove (filename + size).
- **Upload & Continue** (disabled when no files or while processing):
  `setBusy(true)` → `const notes = await filesToNotes(files, { folderId: 'root',
  autoDetectVerses: true })` → `for (const n of notes) await adapter.importNote(n)`
  → `toast.success('Imported N note(s)')` → `onDone()`. On any throw:
  `toast.error(...)`, `setBusy(false)`, stay on the step with files intact (no
  navigation, no data loss).
- **Skip for now** (disabled while processing): `onSkip()`.
- Visual chrome matches `WelcomePage`'s card tokens (`--alabaster`, `--pale-stone`,
  `--deep-umber`, Outfit/Cormorant), reusing the dropzone styling pattern from
  `UploadModal` (not the modal itself).

Sequential `await` for `importNote` (not `Promise.all`) so one failure reports a
clear partial state and avoids hammering the API; N is small (a first-run upload).

### Unit 2 — `WelcomePage` two-step (`src/auth/WelcomePage.tsx`)

- Add `const [step, setStep] = useState<'profile' | 'import'>('profile')`.
- Pull `adapter` from `useAuthSession()`.
- `handleContinue` (profile step): unchanged save via `account.updateProfile`; on
  success, replace `navigate('/notepad/notes')` with `setStep('import')`. Keep the
  toast.
- Render: when `step === 'profile'`, the existing name/DOB card (button label stays
  "Continue"). When `step === 'import'`, render the same card chrome (logo/header
  swapped to an import-appropriate title/subtitle) wrapping
  `<WelcomeImportStep adapter={adapter} onDone={goNotepad} onSkip={goNotepad} />`
  where `goNotepad = () => navigate('/notepad/notes')`.
- The early `if (!loading && !user) navigate('/login')` and loading guards are
  unchanged.

## Testing

- **`WelcomeImportStep.test.tsx`** (jsdom):
  - Renders the dropzone, Skip, and Upload; Upload is disabled with no files.
  - Skip → calls `onSkip`, never calls `adapter.importNote`.
  - Selecting files (fire a `change` on the dropzone input with a `.txt` `File`)
    enables Upload; clicking Upload calls `adapter.importNote` once per file and then
    `onDone`. (Use a real `.txt` `File` so `filesToNotes`→`parseFile` uses
    `File.text()`, which jsdom supports; assert on a stub `adapter.importNote`.)
  - Import error: `adapter.importNote` rejects → `onDone` NOT called, component still
    shows the Upload button (stayed on step). (Stub `toast` if needed.)
- **`WelcomePage.test.tsx`** (light, jsdom): after a successful profile save the view
  advances to the import step (Skip/Upload visible) rather than navigating. Mock
  `useAuthSession`/`useAccountProfile`/`react-router` `useNavigate` as the existing
  auth tests do; if the provider surface proves too heavy to stub cleanly, cover the
  transition via `WelcomeImportStep` alone and note WelcomePage as integration-only.
- Existing `filesToNotes` tests already cover parsing/build; not duplicated here.
- Lint only the touched files.

## Out of scope

- `MigrationDialog` and the local-note migration path (unchanged).
- Folder selection, verse/link toggles, paste-text, or scan-handwriting in onboarding
  (in-app `UploadModal` keeps those).
- Re-importing / dedupe against notes already in the account (first-run only).
- Mobile-specific onboarding layout beyond the responsive card already in use.
