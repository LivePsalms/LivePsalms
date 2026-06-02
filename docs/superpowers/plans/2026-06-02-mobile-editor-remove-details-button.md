# Remove Redundant 3-Dots "Note Details" Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant 3-dots "Note details" button from the mobile editor header (the bottom "More" tab already opens the same sheet).

**Architecture:** Delete the `MoreHorizontal` button and its `onOpenDetails` prop from `MobileEditorView`, and drop the prop pass from `MobileNotepadWorkspace`. All three files (component, caller, test) change together so the build stays type-clean. `MobileMoreSheet` and the bottom "More" tab are untouched.

**Tech Stack:** React + TypeScript, lucide-react, Vitest + @testing-library/react (jsdom).

---

## File Structure

- `src/components/sections/notepad/mobile/MobileEditorView.tsx` — remove button, import, and `onOpenDetails` prop (modify).
- `src/components/sections/notepad/mobile/MobileEditorView.test.tsx` — drop the details test + `onOpenDetails` prop; assert the button is gone (modify).
- `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx` — drop the `onOpenDetails` prop pass (modify).

---

## Task 1: Remove the 3-dots "Note details" button

**Files:**
- Modify: `src/components/sections/notepad/mobile/MobileEditorView.tsx`
- Modify: `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`
- Test: `src/components/sections/notepad/mobile/MobileEditorView.test.tsx`

- [ ] **Step 1: Update the test file**

Replace the FULL contents of `src/components/sections/notepad/mobile/MobileEditorView.test.tsx` with (the "opens details" test is removed, `onOpenDetails` is dropped from every render, and a new assertion confirms the button is gone):

```tsx
// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../notepad/components/Editor', () => ({
  NotepadEditor: (props: { toolbarPlacement?: string }) => (
    <div data-testid="editor" data-placement={props.toolbarPlacement} />
  ),
}));
vi.mock('./useKeyboardInset', () => ({ useKeyboardInset: () => 0 }));
import { MobileEditorView } from './MobileEditorView';

afterEach(cleanup);

describe('<MobileEditorView />', () => {
  it('renders the editor with bottom toolbar placement', () => {
    render(<MobileEditorView onExit={vi.fn()} hasActiveNote onNewNote={vi.fn()} />);
    expect(screen.getByTestId('editor').getAttribute('data-placement')).toBe('bottom');
  });

  it('does not render a Note details button (removed as redundant with the More tab)', () => {
    render(<MobileEditorView onExit={vi.fn()} hasActiveNote onNewNote={vi.fn()} />);
    expect(screen.queryByLabelText('Note details')).toBeNull();
  });

  it('shows the New note FAB when no note is displayed', () => {
    render(<MobileEditorView onExit={vi.fn()} hasActiveNote={false} onNewNote={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'New note' })).toBeInTheDocument();
  });

  it('hides the New note FAB when a note is displayed', () => {
    render(<MobileEditorView onExit={vi.fn()} hasActiveNote onNewNote={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'New note' })).toBeNull();
  });

  it('calls onNewNote when the FAB is tapped in the empty state', () => {
    const onNewNote = vi.fn();
    render(<MobileEditorView onExit={vi.fn()} hasActiveNote={false} onNewNote={onNewNote} />);
    fireEvent.click(screen.getByRole('button', { name: 'New note' }));
    expect(onNewNote).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileEditorView.test.tsx`
Expected: FAIL — the `does not render a Note details button` test fails because the button is still present (`queryByLabelText('Note details')` finds it).

- [ ] **Step 3: Remove the button and prop from `MobileEditorView.tsx`**

Replace the FULL contents of `src/components/sections/notepad/mobile/MobileEditorView.tsx` with:

```tsx
// src/components/sections/notepad/mobile/MobileEditorView.tsx
import { User } from 'lucide-react';
import { NotepadEditor } from '../../../../notepad/components/Editor';
import type { Note } from '../../../../notepad/types';
import { useKeyboardInset } from './useKeyboardInset';
import { MobileNewNoteFab } from './MobileNewNoteFab';

export interface MobileEditorViewProps {
  /** Tapping the logo returns to the home page. */
  onExit: () => void;
  onAfterSave?: (note: Note) => void;
  /** Opens the account menu (signed in) or the sign in / sign up modal (signed out). */
  onOpenAccount?: () => void;
  /** The signed-in user's avatar URL, if they've uploaded one. */
  avatarUrl?: string | null;
  /** Whether a note is currently displayed in the editor. */
  hasActiveNote: boolean;
  /** Create a new note (used by the empty-state FAB). */
  onNewNote: () => void;
}

export function MobileEditorView({
  onExit,
  onAfterSave,
  onOpenAccount,
  avatarUrl,
  hasActiveNote,
  onNewNote,
}: MobileEditorViewProps) {
  const keyboardInset = useKeyboardInset();
  return (
    <div className="relative flex flex-col h-full min-h-0" style={{ background: 'var(--plaster)' }}>
      <header
        className="shrink-0 flex items-center justify-between gap-1 px-3"
        style={{ height: 44, borderBottom: '1px solid var(--pale-stone)', fontFamily: 'Outfit, sans-serif' }}
      >
        <button
          aria-label="Home"
          onClick={onExit}
          className="flex items-center"
        >
          <img src="/logo-icon.png" alt="LivePsalms" className="h-7 w-auto object-contain" />
        </button>
        <div className="flex items-center gap-1">
        <button
          aria-label="Account"
          onClick={onOpenAccount}
          className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden hover:bg-black/5"
          style={{ color: 'var(--deep-umber)' }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <User size={18} />
          )}
        </button>
        </div>
      </header>

      <div className="flex-1 min-h-0">
        <NotepadEditor
          onAfterSave={onAfterSave}
          toolbarPlacement="bottom"
          toolbarBottomOffset={keyboardInset}
        />
      </div>
      {!hasActiveNote && <MobileNewNoteFab onClick={onNewNote} />}
    </div>
  );
}
```

(The `MoreHorizontal` import, the `onOpenDetails` prop/destructure, and the "Note details" `<button>` are all removed. Everything else — Home, Account, editor, FAB — is unchanged.)

- [ ] **Step 4: Remove the prop pass from `MobileNotepadWorkspace.tsx`**

In `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`, the `tab === 'editor'` block currently reads:

```tsx
        {tab === 'editor' && (
          <MobileEditorView
            onOpenDetails={() => setMoreOpen(true)}
            onExit={() => navigate('/')}
            onAfterSave={model.onAfterSave}
            onOpenAccount={openAccount}
            avatarUrl={profile?.avatarUrl ?? null}
            hasActiveNote={!!model.activeNote}
            onNewNote={handleNewNote}
          />
        )}
```

Remove the `onOpenDetails` line so it reads:

```tsx
        {tab === 'editor' && (
          <MobileEditorView
            onExit={() => navigate('/')}
            onAfterSave={model.onAfterSave}
            onOpenAccount={openAccount}
            avatarUrl={profile?.avatarUrl ?? null}
            hasActiveNote={!!model.activeNote}
            onNewNote={handleNewNote}
          />
        )}
```

Leave everything else unchanged: `moreOpen`, `setMoreOpen`, `handleSelectTab` (which still calls `setMoreOpen(true)` for the "more" tab), and the `<MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />` render all stay — the bottom "More" tab still opens the sheet.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileEditorView.test.tsx`
Expected: PASS — all 5 tests green (the "Note details" button is gone; the FAB and placement tests still pass).

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileEditorView.tsx src/components/sections/notepad/mobile/MobileEditorView.test.tsx src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx
git commit -m "feat(mobile): remove redundant 3-dots Note details button from editor header"
```

---

## Task 2: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean (exit 0). This confirms no dangling `onOpenDetails` references remain anywhere.

- [ ] **Step 2: Run the touched + adjacent test files**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileEditorView.test.tsx src/components/sections/notepad/mobile/MobileNotepadWorkspace.test.tsx`
Expected: all pass (5 + 4 = 9 tests). The workspace tests stub `MobileEditorView`, so they are unaffected by the prop removal.

- [ ] **Step 3: Lint the touched source files**

Run: `npx eslint src/components/sections/notepad/mobile/MobileEditorView.tsx src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`
Expected: no errors (confirms no unused `MoreHorizontal` import or unused param).

- [ ] **Step 4: Manual smoke (optional, recommended)**

Run the app (`npm run dev`), mobile viewport, open the Editor tab. Confirm: the header right side shows only the Account/avatar button — no 3-dots. Tapping the bottom "More" tab still opens the details sheet (Backlinks / Info / Graph). Desktop and the Notes tab are unchanged.

---

## Notes / Decisions Captured

- The 3-dots and the bottom "More" tab both called `setMoreOpen(true)` → same `MobileMoreSheet`; removing the 3-dots drops a duplicate entry point only.
- `onOpenDetails` is fully removed (not made optional) since the workspace was its only caller.
- `MobileMoreSheet`, the More tab, and desktop are untouched.
