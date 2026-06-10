# Onboarding Note Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional "bring your existing notes" upload step to the signup onboarding so a new user can import note files (or skip) before entering the app.

**Architecture:** The `/welcome` page becomes two sequential beats in one route — (1) profile (name + DOB), (2) import. A new self-contained `WelcomeImportStep` component reuses the provider-free `filesToNotes` parser and persists via the auth-session `adapter.importNote`. No new routing; the existing `MigrationDialog` is untouched.

**Tech Stack:** React + TypeScript, Vite, `react-dropzone` (already a dep), Vitest + @testing-library/react (jsdom), sonner toasts.

**Spec:** `docs/superpowers/specs/2026-06-09-onboarding-note-upload-design.md`

---

## File Structure

- **Create** `src/auth/WelcomeImportStep.tsx` — the import beat: dropzone + file list + Upload/Skip; parses via `filesToNotes` and persists via `adapter.importNote`.
- **Create** `src/auth/WelcomeImportStep.test.tsx` — unit tests for the step.
- **Modify** `src/auth/WelcomePage.tsx` — add `step` state; advance to import after profile save; render the step.
- **Create** `src/auth/WelcomePage.test.tsx` — the profile→import transition + skip→navigate.

---

## Task 1: `WelcomeImportStep` component

**Files:**
- Create: `src/auth/WelcomeImportStep.tsx`
- Test: `src/auth/WelcomeImportStep.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/auth/WelcomeImportStep.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { WelcomeImportStep } from './WelcomeImportStep';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);

function selectFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

describe('WelcomeImportStep', () => {
  it('disables Upload until a file is selected; Skip calls onSkip without importing', () => {
    const importNote = vi.fn(async (n) => n);
    const onSkip = vi.fn();
    const onDone = vi.fn();
    render(<WelcomeImportStep adapter={{ importNote }} onDone={onDone} onSkip={onSkip} />);

    expect(screen.getByRole('button', { name: /upload & continue/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(importNote).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('imports one note per selected file, then calls onDone', async () => {
    const importNote = vi.fn(async (n) => n);
    const onDone = vi.fn();
    const { container } = render(
      <WelcomeImportStep adapter={{ importNote }} onDone={onDone} onSkip={() => {}} />,
    );

    selectFile(container, new File(['Psalm 23 is my anchor.'], 'note.txt', { type: 'text/plain' }));
    await screen.findByText('note.txt');

    const upload = screen.getByRole('button', { name: /upload & continue/i });
    expect(upload).toBeEnabled();
    fireEvent.click(upload);

    await waitFor(() => expect(importNote).toHaveBeenCalledTimes(1));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('keeps the user on the step when an import fails (no onDone)', async () => {
    const importNote = vi.fn().mockRejectedValueOnce(new Error('network'));
    const onDone = vi.fn();
    const { container } = render(
      <WelcomeImportStep adapter={{ importNote }} onDone={onDone} onSkip={() => {}} />,
    );

    selectFile(container, new File(['hello'], 'a.txt', { type: 'text/plain' }));
    await screen.findByText('a.txt');
    fireEvent.click(screen.getByRole('button', { name: /upload & continue/i }));

    await waitFor(() => expect(importNote).toHaveBeenCalled());
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /upload & continue/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/auth/WelcomeImportStep.test.tsx`
Expected: FAIL — module `./WelcomeImportStep` does not exist yet.

- [ ] **Step 3: Implement the component**

Create `src/auth/WelcomeImportStep.tsx`:

```tsx
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Upload, FileText, X } from 'lucide-react';
import { filesToNotes } from '@/notepad/import/document-importer';
import type { StorageAdapter } from '@/notepad/storage/adapter';

export interface WelcomeImportStepProps {
  adapter: Pick<StorageAdapter, 'importNote'>;
  onDone: () => void;
  onSkip: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function WelcomeImportStep({ adapter, onDone, onSkip }: WelcomeImportStepProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...accepted.filter((f) => !existing.has(f.name))];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/markdown': ['.md'],
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
  });

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  const handleUpload = async () => {
    if (files.length === 0 || busy) return;
    setBusy(true);
    try {
      const notes = await filesToNotes(files, { folderId: 'root', autoDetectVerses: true });
      for (const note of notes) {
        await adapter.importNote(note);
      }
      toast.success(`Imported ${notes.length} note${notes.length === 1 ? '' : 's'}.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not import your notes.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        {...getRootProps()}
        className="flex flex-col items-center justify-center gap-2 rounded-lg px-6 py-8 cursor-pointer transition-colors"
        style={{
          border: `2px dashed ${isDragActive ? 'var(--deep-umber)' : 'var(--pale-stone)'}`,
          background: isDragActive ? 'rgba(188, 179, 163, 0.1)' : 'transparent',
        }}
      >
        <input {...getInputProps()} />
        <Upload className="w-7 h-7" style={{ color: isDragActive ? 'var(--deep-umber)' : 'var(--silica)' }} />
        <p className="text-[13px] text-center" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
          {isDragActive ? 'Drop files here' : 'Drag & drop files, or click to browse'}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
          Supports .md, .txt, .pdf, .docx
        </p>
      </div>

      {files.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--pale-stone)' }}>
          {files.map((file, idx) => (
            <div
              key={file.name}
              className="flex items-center gap-2.5 px-3 py-2"
              style={{ borderTop: idx > 0 ? '1px solid var(--pale-stone)' : 'none', fontFamily: 'Outfit, sans-serif' }}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--silica)' }} />
              <span className="text-[12px] flex-1 truncate min-w-0" style={{ color: 'var(--deep-umber)' }}>{file.name}</span>
              <span className="text-[11px] shrink-0" style={{ color: 'var(--silica)' }}>{formatBytes(file.size)}</span>
              <button
                onClick={() => removeFile(file.name)}
                className="shrink-0 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--silica)' }}
                type="button"
                aria-label={`Remove ${file.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={files.length === 0 || busy}
        className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
        style={{ background: 'var(--deep-umber)', color: 'var(--plaster)', fontFamily: 'Outfit, sans-serif' }}
        type="button"
      >
        {busy ? 'Importing…' : 'Upload & Continue'}
      </button>
      <button
        onClick={onSkip}
        disabled={busy}
        className="w-full py-2 rounded-lg text-[13px] transition-opacity disabled:opacity-50"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif', background: 'transparent' }}
        type="button"
      >
        Skip for now
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/auth/WelcomeImportStep.test.tsx`
Expected: PASS (3 tests). If `react-dropzone`'s async file processing makes the
`findByText('note.txt')` flaky, the `await screen.findByText(...)` already retries —
do not add arbitrary timeouts.

- [ ] **Step 5: Commit**

```bash
git add src/auth/WelcomeImportStep.tsx src/auth/WelcomeImportStep.test.tsx
git commit -m "feat(onboarding): WelcomeImportStep — upload existing notes during signup"
```

---

## Task 2: Wire `WelcomePage` into two steps

**Files:**
- Modify: `src/auth/WelcomePage.tsx`
- Test: `src/auth/WelcomePage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/auth/WelcomePage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const updateProfile = vi.fn(async () => {});
const importNote = vi.fn(async (n) => n);
vi.mock('./context/useAuthSession', () => ({
  useAuthSession: () => ({ user: { id: 'u1' }, loading: false, adapter: { importNote } }),
}));
vi.mock('./context/useAccountProfile', () => ({
  useAccountProfile: () => ({ profile: { fullName: '' }, account: { updateProfile } }),
}));

import { WelcomePage } from './WelcomePage';

afterEach(() => {
  cleanup();
  navigate.mockClear();
  updateProfile.mockClear();
});

describe('WelcomePage onboarding flow', () => {
  it('advances to the import step after saving the profile (no navigation yet)', async () => {
    render(<WelcomePage />);
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Sarah' } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: /skip for now/i })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('Skip on the import step navigates to the notepad', async () => {
    render(<WelcomePage />);
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Sarah' } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    const skip = await screen.findByRole('button', { name: /skip for now/i });
    fireEvent.click(skip);
    expect(navigate).toHaveBeenCalledWith('/notepad/notes');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/auth/WelcomePage.test.tsx`
Expected: FAIL — after Continue there is no "Skip for now" button yet (the page
still navigates straight to the notepad).

- [ ] **Step 3: Add the import + state + navigation helper**

In `src/auth/WelcomePage.tsx`:

(a) After the existing import block, add:

```tsx
import { WelcomeImportStep } from './WelcomeImportStep';
```

(b) Change the auth-session destructure from:

```tsx
  const { user, loading } = useAuthSession();
```

to:

```tsx
  const { user, loading, adapter } = useAuthSession();
```

(c) Immediately after the existing `const [saving, setSaving] = useState(false);`
line, add:

```tsx
  const [step, setStep] = useState<'profile' | 'import'>('profile');
  const goNotepad = () => navigate('/notepad/notes');
```

- [ ] **Step 4: Advance to the import step instead of navigating after profile save**

In `handleContinue`, change the success line from:

```tsx
      toast.success(`Welcome, ${fullName.trim().split(' ')[0]}!`);
      navigate('/notepad/notes');
```

to:

```tsx
      toast.success(`Welcome, ${fullName.trim().split(' ')[0]}!`);
      setStep('import');
```

- [ ] **Step 5: Make the subtitle step-aware**

Change the subtitle paragraph text from:

```tsx
            Just a couple of details to get you started.
```

to:

```tsx
            {step === 'profile'
              ? 'Just a couple of details to get you started.'
              : 'Bring any notes you already have — or skip for now.'}
```

- [ ] **Step 6: Render the import step in place of the profile form when step==='import'**

Wrap the profile form. Change its opening from:

```tsx
        <div className="flex flex-col gap-4">
```

to:

```tsx
        {step === 'profile' ? (
        <div className="flex flex-col gap-4">
```

Then change the form's closing (the unique Continue-button-then-close sequence) from:

```tsx
            {saving ? 'Saving...' : 'Continue'}
          </button>

        </div>
```

to:

```tsx
            {saving ? 'Saving...' : 'Continue'}
          </button>

        </div>
        ) : (
          <WelcomeImportStep adapter={adapter} onDone={goNotepad} onSkip={goNotepad} />
        )}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/auth/WelcomePage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add src/auth/WelcomePage.tsx src/auth/WelcomePage.test.tsx
git commit -m "feat(onboarding): two-step Welcome — profile then optional note import"
```

---

## Task 3: Verify, lint, finalize

**Files:** none modified (verification only).

- [ ] **Step 1: Run the full auth suite**

Run: `npx vitest run src/auth`
Expected: PASS — new tests green, existing auth tests unaffected.

- [ ] **Step 2: Lint the touched files**

Run: `npx eslint src/auth/WelcomeImportStep.tsx src/auth/WelcomeImportStep.test.tsx src/auth/WelcomePage.tsx src/auth/WelcomePage.test.tsx`
Expected: no errors. (Do NOT run repo-wide `npm run lint` — it has unrelated
pre-existing errors.)

- [ ] **Step 3: Manual verification note (preview)**

The signup→/welcome flow requires a real authenticated session (Supabase), which
cannot be exercised in the local preview without credentials. Verification relies on
the component + page tests above. If a live account is available, confirm: after
signup, the Welcome page shows the name step → Continue → the import step with
drag-drop + "Skip for now" / "Upload & Continue"; Skip lands in the notepad; an
upload of a `.txt`/`.md` file creates notes visible in the collection.

- [ ] **Step 4: Confirm clean commit scope**

Run: `git show --stat HEAD~1 HEAD | grep -E "WelcomeImportStep|WelcomePage"`
Expected: only `WelcomeImportStep.tsx`, `WelcomeImportStep.test.tsx`,
`WelcomePage.tsx`, `WelcomePage.test.tsx` appear — no unrelated churn staged.

---

## Self-Review Notes

- **Spec coverage:** two-step placement (Task 2), minimal uploader with defaults
  folderId='root'/autoDetectVerses=true/no links (Task 1 Step 3), reuse `filesToNotes`
  + auth-session `adapter` (Task 1 + Task 2 prop threading), Skip + error-keeps-you-
  there (Task 1 tests), MigrationDialog untouched (not referenced). All covered.
- **Type consistency:** `WelcomeImportStepProps.adapter: Pick<StorageAdapter,
  'importNote'>` matches the stub `{ importNote }` used in both test files and the
  real `adapter` from `useAuthSession()` (typed `StorageAdapter`). `onDone`/`onSkip`
  both bound to `goNotepad` in `WelcomePage`.
- **No placeholders:** every code step is complete.
- **Note:** the spec referenced the adapter interface as `NotesAdapter`; the actual
  exported interface is `StorageAdapter` (`src/notepad/storage/adapter.ts`) — this
  plan uses the correct name.
