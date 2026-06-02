# Mobile FAB Expanding Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile gold **+** button open an expanding FAB menu offering "New note" and "Upload note", instead of immediately creating a note.

**Architecture:** A new self-contained `MobileFabMenu` component (framer-motion expanding menu + hidden file input) replaces the inline button in `MobileNotesView`. "New note" keeps the existing create-and-edit flow; "Upload note" opens the native file picker and runs the existing import pipeline with defaults. The parse→build→link orchestration is extracted from `UploadModal` into a shared `filesToNotes()` helper so both paths share one import code path.

**Tech Stack:** React + TypeScript, framer-motion, lucide-react, Vitest + @testing-library/react (jsdom), Tailwind + CSS custom properties.

Spec: [docs/superpowers/specs/2026-06-01-mobile-fab-menu-design.md](../specs/2026-06-01-mobile-fab-menu-design.md)

---

## File Structure

- **Modify** `src/notepad/import/document-importer.ts` — add `FilesToNotesOpts` + `filesToNotes()`.
- **Modify** `src/notepad/import/document-importer.test.ts` — add `filesToNotes` tests.
- **Modify** `src/notepad/components/UploadModal.tsx` — use `filesToNotes()`.
- **Create** `src/components/sections/notepad/mobile/MobileFabMenu.tsx` — expanding FAB menu.
- **Create** `src/components/sections/notepad/mobile/MobileFabMenu.test.tsx` — component tests.
- **Modify** `src/components/sections/notepad/mobile/MobileNotesView.tsx` — swap button for `MobileFabMenu`, add `onUploadFiles` prop.
- **Modify** `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx` — add `handleUploadFiles`, pass it down.

---

## Task 1: Extract `filesToNotes` import helper

**Files:**
- Modify: `src/notepad/import/document-importer.ts`
- Test: `src/notepad/import/document-importer.test.ts`
- Modify: `src/notepad/components/UploadModal.tsx:85-119`

- [ ] **Step 1: Write the failing test**

Append to `src/notepad/import/document-importer.test.ts` (add `filesToNotes` to the existing top import from `./document-importer`):

```ts
// ---------------------------------------------------------------------------
// filesToNotes
// ---------------------------------------------------------------------------

describe('filesToNotes — orchestration', () => {
  it('parses each file into a Note with extension-stripped title and folderId', async () => {
    const files = [
      new File(['hello world'], 'first.txt', { type: 'text/plain' }),
      new File(['# Heading\n\nbody'], 'second.md', { type: 'text/markdown' }),
    ];
    const notes = await filesToNotes(files, { folderId: 'inbox' });
    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.title)).toEqual(['first', 'second']);
    expect(notes.every((n) => n.folderId === 'inbox')).toBe(true);
  });

  it('extracts verse refs as tags when autoDetectVerses is true', async () => {
    const files = [
      new File(['Trust in Romans 8:28 today'], 'verse.txt', { type: 'text/plain' }),
    ];
    const notes = await filesToNotes(files, { folderId: 'root', autoDetectVerses: true });
    expect(notes[0].tags).toEqual(expect.arrayContaining(['Romans 8:28']));
  });

  it('returns empty tags when autoDetectVerses is absent', async () => {
    const files = [
      new File(['Trust in Romans 8:28 today'], 'verse.txt', { type: 'text/plain' }),
    ];
    const notes = await filesToNotes(files, { folderId: 'root' });
    expect(notes[0].tags).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/import/document-importer.test.ts`
Expected: FAIL — `filesToNotes is not a function` (or import error).

- [ ] **Step 3: Add the helper**

In `src/notepad/import/document-importer.ts`, after the `buildNoteFromText` export (and before or after `linkNotesByVerses`), add:

```ts
export interface FilesToNotesOpts {
  folderId: string;
  /** When true, scrape verse references out of the plain text and use them as tags (capped at 10). */
  autoDetectVerses?: boolean;
  /** When true, append a cross-linking "Related Notes" pass via linkNotesByVerses. */
  autoCreateLinks?: boolean;
}

/**
 * Orchestrates the full upload import: parse each File to text, build a Note
 * per file (title = filename without extension), then optionally cross-link by
 * shared verse refs. Returns Notes ready for `importNotes`. Shared by the
 * desktop UploadModal and the mobile FAB upload flow.
 */
export async function filesToNotes(
  files: File[],
  opts: FilesToNotesOpts,
): Promise<Note[]> {
  const { folderId, autoDetectVerses = false, autoCreateLinks = false } = opts;
  const parsed = await Promise.all(
    files.map(async (file) => {
      const text = await parseFile(file);
      const title = file.name.replace(/\.[^.]+$/, '');
      return { title, text };
    }),
  );
  let notes = parsed.map(({ title, text }) =>
    buildNoteFromText({ title, text, folderId, autoDetectVerses }),
  );
  if (autoCreateLinks) {
    notes = linkNotesByVerses(notes);
  }
  return notes;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notepad/import/document-importer.test.ts`
Expected: PASS (all `filesToNotes` cases plus the pre-existing cases).

- [ ] **Step 5: Refactor UploadModal to use the helper**

In `src/notepad/components/UploadModal.tsx`:

Replace the import block (lines ~21-26):

```ts
import {
  parseFile,
  buildNoteFromText,
  linkNotesByVerses,
} from '../import/document-importer';
import type { Note } from '../types';
```

with:

```ts
import { filesToNotes } from '../import/document-importer';
```

Replace the `handleUpload` body (lines ~85-113):

```ts
  const handleUpload = async () => {
    if (files.length === 0 || uploading) return;
    setUploading(true);

    try {
      const parsed = await Promise.all(
        files.map(async (file) => {
          const text = await parseFile(file);
          const title = file.name.replace(/\.[^.]+$/, '');
          return { title, text };
        }),
      );

      let notes: Note[] = parsed.map(({ title, text }) =>
        buildNoteFromText({ title, text, folderId, autoDetectVerses }),
      );

      if (autoCreateLinks) {
        notes = linkNotesByVerses(notes);
      }

      await importNotes(notes);

      setFiles([]);
      onOpenChange(false);
    } finally {
      setUploading(false);
    }
  };
```

with:

```ts
  const handleUpload = async () => {
    if (files.length === 0 || uploading) return;
    setUploading(true);

    try {
      const notes = await filesToNotes(files, {
        folderId,
        autoDetectVerses,
        autoCreateLinks,
      });
      await importNotes(notes);

      setFiles([]);
      onOpenChange(false);
    } finally {
      setUploading(false);
    }
  };
```

- [ ] **Step 6: Verify full test suite + typecheck + lint still pass**

Run: `npx vitest run src/notepad/import/document-importer.test.ts && npx tsc -b && npx eslint src/notepad/components/UploadModal.tsx src/notepad/import/document-importer.ts`
Expected: tests PASS, no TS errors, no lint errors (confirms the removed `Note`/`parseFile`/`buildNoteFromText`/`linkNotesByVerses` imports left no dangling references).

- [ ] **Step 7: Commit**

```bash
git add src/notepad/import/document-importer.ts src/notepad/import/document-importer.test.ts src/notepad/components/UploadModal.tsx
git commit -m "refactor(notepad): extract filesToNotes import helper"
```

---

## Task 2: Create `MobileFabMenu` component

**Files:**
- Create: `src/components/sections/notepad/mobile/MobileFabMenu.tsx`
- Test: `src/components/sections/notepad/mobile/MobileFabMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/sections/notepad/mobile/MobileFabMenu.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { MobileFabMenu } from './MobileFabMenu';

function setReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('reduce') ? reduced : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => cleanup());

describe('MobileFabMenu', () => {
  beforeEach(() => setReducedMotion(false));

  it('hides the options until the trigger is tapped', () => {
    render(<MobileFabMenu onNewNote={vi.fn()} onUploadFiles={vi.fn()} />);
    expect(screen.queryByLabelText('New note')).toBeNull();
    const trigger = screen.getByLabelText('New note menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('reveals both options and sets aria-expanded when tapped', () => {
    render(<MobileFabMenu onNewNote={vi.fn()} onUploadFiles={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('New note menu'));
    expect(screen.getByLabelText('New note')).not.toBeNull();
    expect(screen.getByLabelText('Upload note')).not.toBeNull();
    expect(screen.getByLabelText('Close menu').getAttribute('aria-expanded')).toBe('true');
  });

  it('fires onNewNote and closes when New note is chosen', () => {
    const onNewNote = vi.fn();
    render(<MobileFabMenu onNewNote={onNewNote} onUploadFiles={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('New note menu'));
    fireEvent.click(screen.getByLabelText('New note'));
    expect(onNewNote).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('New note menu').getAttribute('aria-expanded')).toBe('false');
  });

  it('fires onUploadFiles with the selected files', () => {
    const onUploadFiles = vi.fn();
    render(<MobileFabMenu onNewNote={vi.fn()} onUploadFiles={onUploadFiles} />);
    const input = screen.getByTestId('fab-file-input') as HTMLInputElement;
    const file = new File(['x'], 'note.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onUploadFiles).toHaveBeenCalledTimes(1);
    expect(onUploadFiles.mock.calls[0][0]).toEqual([file]);
  });

  it('closes when the backdrop is tapped', () => {
    render(<MobileFabMenu onNewNote={vi.fn()} onUploadFiles={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('New note menu'));
    fireEvent.click(screen.getByTestId('fab-backdrop'));
    expect(screen.getByLabelText('New note menu').getAttribute('aria-expanded')).toBe('false');
  });

  it('closes when Escape is pressed', () => {
    render(<MobileFabMenu onNewNote={vi.fn()} onUploadFiles={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('New note menu'));
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.getByLabelText('New note menu').getAttribute('aria-expanded')).toBe('false');
  });

  it('renders both options under prefers-reduced-motion', () => {
    setReducedMotion(true);
    render(<MobileFabMenu onNewNote={vi.fn()} onUploadFiles={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('New note menu'));
    expect(screen.getByLabelText('New note')).not.toBeNull();
    expect(screen.getByLabelText('Upload note')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileFabMenu.test.tsx`
Expected: FAIL — cannot resolve `./MobileFabMenu`.

- [ ] **Step 3: Implement the component**

Create `src/components/sections/notepad/mobile/MobileFabMenu.tsx`:

```tsx
// src/components/sections/notepad/mobile/MobileFabMenu.tsx
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Pencil, Upload } from 'lucide-react';

export interface MobileFabMenuProps {
  /** Create a new note (existing devotion-create-and-edit flow). */
  onNewNote: () => void;
  /** Receives the picked files; may be async (resolves when import finishes). */
  onUploadFiles: (files: File[]) => void | Promise<void>;
}

/**
 * Mobile-only floating action button that expands into a small menu offering
 * "New note" and "Upload note". Rotates + → × on open, dismisses on option
 * select / re-tap / backdrop tap / Escape, and shows a spinner while an upload
 * import is in flight. Respects prefers-reduced-motion.
 */
export function MobileFabMenu({ onNewNote, onUploadFiles }: MobileFabMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleNewNote = () => {
    setOpen(false);
    onNewNote();
  };

  const handleUploadClick = () => {
    setOpen(false);
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    // Reset so picking the same file again still fires change.
    e.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    try {
      await onUploadFiles(files);
    } finally {
      setBusy(false);
    }
  };

  const options = [
    { key: 'new', label: 'New note', Icon: Pencil, onClick: handleNewNote },
    { key: 'upload', label: 'Upload note', Icon: Upload, onClick: handleUploadClick },
  ] as const;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            data-testid="fab-backdrop"
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          />
        )}
      </AnimatePresence>

      <div
        className="absolute z-50 flex flex-col items-end"
        style={{ right: 16, bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
      >
        <AnimatePresence>
          {open && (
            <motion.div
              className="mb-3 flex flex-col items-end gap-2"
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 10, y: 10, filter: 'blur(10px)' }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, y: 0, filter: 'blur(0px)' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: 10, y: 10, filter: 'blur(10px)' }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 300, damping: 20, delay: 0.05 }
              }
            >
              {options.map((opt, i) => (
                <motion.button
                  key={opt.key}
                  type="button"
                  aria-label={opt.label}
                  onClick={opt.onClick}
                  className="flex items-center gap-2 rounded-full px-4 py-2 shadow-md"
                  style={{
                    background: 'var(--plaster)',
                    color: 'var(--deep-umber)',
                    border: '1px solid var(--pale-stone)',
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: 13,
                  }}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: 20 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.2, delay: i * 0.05 }}
                >
                  <opt.Icon size={16} />
                  <span>{opt.label}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          aria-label={open ? 'Close menu' : 'New note menu'}
          aria-expanded={open}
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center rounded-full shadow-lg disabled:opacity-80"
          style={{ width: 52, height: 52, background: '#b8843a', color: '#fff' }}
        >
          {busy ? (
            <span
              data-testid="fab-spinner"
              className="block rounded-full animate-spin"
              style={{
                width: 22,
                height: 22,
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: '#fff',
              }}
            />
          ) : (
            <motion.span
              className="flex"
              animate={{ rotate: open ? 45 : 0 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Plus size={24} />
            </motion.span>
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".md,.txt,.pdf,.docx"
          multiple
          onChange={handleFileChange}
          className="hidden"
          data-testid="fab-file-input"
        />
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileFabMenu.test.tsx`
Expected: PASS (all 7 cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileFabMenu.tsx src/components/sections/notepad/mobile/MobileFabMenu.test.tsx
git commit -m "feat(mobile): add MobileFabMenu expanding action menu"
```

---

## Task 3: Wire `MobileFabMenu` into the mobile workspace

**Files:**
- Modify: `src/components/sections/notepad/mobile/MobileNotesView.tsx`
- Modify: `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`

- [ ] **Step 1: Replace the inline button in MobileNotesView**

In `src/components/sections/notepad/mobile/MobileNotesView.tsx`:

Change the import line (line 2) from:

```tsx
import { Search, Plus, User } from 'lucide-react';
```

to (drop the now-unused `Plus`, add the menu):

```tsx
import { Search, User } from 'lucide-react';
import { MobileFabMenu } from './MobileFabMenu';
```

Add `onUploadFiles` to `MobileNotesViewProps` (after `onNewNote: () => void;`):

```tsx
  onNewNote: () => void;
  /** Receives files chosen via the FAB "Upload note" option. */
  onUploadFiles: (files: File[]) => void | Promise<void>;
```

Add `onUploadFiles` to the destructured params (after `onNewNote,`):

```tsx
  onNewNote,
  onUploadFiles,
```

Replace the trailing `<button aria-label="New note"> ... </button>` block (lines ~65-78) with:

```tsx
      <MobileFabMenu onNewNote={onNewNote} onUploadFiles={onUploadFiles} />
```

- [ ] **Step 2: Add handleUploadFiles in MobileNotepadWorkspace and pass it down**

In `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`:

Add an import near the other notepad imports (e.g. after the `useNotepadActions` import on line 7):

```tsx
import { filesToNotes } from '../../../../notepad/import/document-importer';
```

Add the handler right after `handleNewNote` (after line ~83):

```tsx
  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      const notes = await filesToNotes(files, {
        folderId: 'root',
        autoDetectVerses: true,
      });
      await actions.importNotes(notes);
    },
    [actions],
  );
```

Pass the prop into `<MobileNotesView>` (after `onNewNote={handleNewNote}`):

```tsx
            onNewNote={handleNewNote}
            onUploadFiles={handleUploadFiles}
```

- [ ] **Step 3: Verify typecheck, lint, and the mobile test suite**

Run: `npx tsc -b && npx eslint src/components/sections/notepad/mobile/MobileNotesView.tsx src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx && npx vitest run src/components/sections/notepad/mobile/MobileFabMenu.test.tsx src/notepad/import/document-importer.test.ts`
Expected: no TS errors, no lint errors (confirms `Plus` removal left no usage), tests PASS.

- [ ] **Step 4: Manual smoke check (record result)**

Run: `npm run dev`, open the app at a mobile width (< 768px), go to the notepad notes view.
Verify: tapping **+** rotates it and reveals "New note" + "Upload note"; "New note" opens a fresh editor; "Upload note" opens the OS file picker and, after choosing a `.txt`/`.md`/`.pdf`/`.docx`, the imported note appears in the notes list (FAB briefly shows the spinner). Tapping outside / Escape closes the menu.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileNotesView.tsx src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx
git commit -m "feat(mobile): wire FAB menu into notes view with upload import"
```

---

## Self-Review Notes

- **Spec coverage:** Expanding menu (Task 2), New note unchanged (Task 3 passes existing `onNewNote`), Upload via native picker + default import opts `{ folderId: 'root', autoDetectVerses: true }` staying on notes tab (Task 3 `handleUploadFiles` — no `setTab` call), spinner feedback (Task 2 `busy`), reduced-motion (Task 2), DRY `filesToNotes` (Task 1), tests for both units — all covered.
- **Type consistency:** `filesToNotes(files, opts)` / `FilesToNotesOpts` / `onUploadFiles: (files: File[]) => void | Promise<void>` / `MobileFabMenuProps` used identically across Tasks 1–3.
- **Mobile-only:** No `useIsMobile` needed — `MobileNotesView` only mounts inside the mobile workspace.
