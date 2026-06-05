# Mobile Editor Empty-State New-Note FAB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the mobile editor tab, when no note is displayed, show a gold plus FAB that directly creates a new note.

**Architecture:** A new single-purpose `MobileNewNoteFab` button is rendered by `MobileEditorView` only when `hasActiveNote` is false. The workspace passes `hasActiveNote={!!model.activeNote}` and the existing `handleNewNote` as `onNewNote`. Creating a note sets `model.activeNote`, which hides the FAB and shows the note. Mobile-only; desktop and the Notes-tab FAB are untouched.

**Tech Stack:** React + TypeScript, lucide-react icons, Vitest + @testing-library/react (jsdom), Tailwind utility classes with CSS custom-property tokens.

---

## File Structure

- `src/components/sections/notepad/mobile/MobileNewNoteFab.tsx` — new direct-create FAB button (create).
- `src/components/sections/notepad/mobile/MobileNewNoteFab.test.tsx` — component test (create).
- `src/components/sections/notepad/mobile/MobileEditorView.tsx` — add `hasActiveNote`/`onNewNote` props, render FAB when empty (modify).
- `src/components/sections/notepad/mobile/MobileEditorView.test.tsx` — update existing render calls, add FAB tests (modify).
- `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx` — pass the two new props (modify).
- `src/components/sections/notepad/mobile/MobileNotepadWorkspace.test.tsx` — assert the props are wired (modify).

---

## Task 1: `MobileNewNoteFab` component

**Files:**
- Create: `src/components/sections/notepad/mobile/MobileNewNoteFab.tsx`
- Test: `src/components/sections/notepad/mobile/MobileNewNoteFab.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/sections/notepad/mobile/MobileNewNoteFab.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileNewNoteFab } from './MobileNewNoteFab';

afterEach(cleanup);

describe('<MobileNewNoteFab />', () => {
  it('renders a button labeled "New note"', () => {
    render(<MobileNewNoteFab onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'New note' })).toBeInTheDocument();
  });

  it('calls onClick when tapped', () => {
    const onClick = vi.fn();
    render(<MobileNewNoteFab onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'New note' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileNewNoteFab.test.tsx`
Expected: FAIL — cannot find module `./MobileNewNoteFab`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/sections/notepad/mobile/MobileNewNoteFab.tsx`:

```tsx
// src/components/sections/notepad/mobile/MobileNewNoteFab.tsx
import { Plus } from 'lucide-react';

export interface MobileNewNoteFabProps {
  /** Create a new note directly (no menu). */
  onClick: () => void;
}

/**
 * Mobile-only floating action button shown on the editor tab's empty state.
 * A single tap creates a new note. Positioned to match the Notes-tab FAB.
 */
export function MobileNewNoteFab({ onClick }: MobileNewNoteFabProps) {
  return (
    <div
      className="absolute z-50"
      style={{ right: 16, bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
    >
      <button
        type="button"
        aria-label="New note"
        onClick={onClick}
        className="flex items-center justify-center rounded-full shadow-lg"
        style={{ width: 52, height: 52, background: '#b8843a', color: '#fff' }}
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileNewNoteFab.test.tsx`
Expected: PASS (2 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileNewNoteFab.tsx src/components/sections/notepad/mobile/MobileNewNoteFab.test.tsx
git commit -m "feat(mobile): add MobileNewNoteFab direct-create button"
```

---

## Task 2: Render the FAB in `MobileEditorView` when no note is displayed

**Files:**
- Modify: `src/components/sections/notepad/mobile/MobileEditorView.tsx`
- Test: `src/components/sections/notepad/mobile/MobileEditorView.test.tsx`

- [ ] **Step 1: Update existing tests + add new tests**

The existing test file renders `MobileEditorView` with only `onOpenDetails`/`onExit`. The two new props (`hasActiveNote`, `onNewNote`) are required, so update the two existing render calls and add a new describe block. Replace the FULL contents of `src/components/sections/notepad/mobile/MobileEditorView.test.tsx` with:

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
    render(
      <MobileEditorView onOpenDetails={vi.fn()} onExit={vi.fn()} hasActiveNote onNewNote={vi.fn()} />,
    );
    expect(screen.getByTestId('editor').getAttribute('data-placement')).toBe('bottom');
  });

  it('opens details when the ⋯ button is tapped', () => {
    const onOpenDetails = vi.fn();
    render(
      <MobileEditorView onOpenDetails={onOpenDetails} onExit={vi.fn()} hasActiveNote onNewNote={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText('Note details'));
    expect(onOpenDetails).toHaveBeenCalledOnce();
  });

  it('shows the New note FAB when no note is displayed', () => {
    render(
      <MobileEditorView onOpenDetails={vi.fn()} onExit={vi.fn()} hasActiveNote={false} onNewNote={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'New note' })).toBeInTheDocument();
  });

  it('hides the New note FAB when a note is displayed', () => {
    render(
      <MobileEditorView onOpenDetails={vi.fn()} onExit={vi.fn()} hasActiveNote onNewNote={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'New note' })).toBeNull();
  });

  it('calls onNewNote when the FAB is tapped in the empty state', () => {
    const onNewNote = vi.fn();
    render(
      <MobileEditorView onOpenDetails={vi.fn()} onExit={vi.fn()} hasActiveNote={false} onNewNote={onNewNote} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'New note' }));
    expect(onNewNote).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileEditorView.test.tsx`
Expected: FAIL — `MobileEditorView` does not accept `hasActiveNote`/`onNewNote` (TS error) and the "New note" button is not found.

- [ ] **Step 3: Implement the changes**

Edit `src/components/sections/notepad/mobile/MobileEditorView.tsx`.

(a) Add the import near the top (after the lucide import):

```tsx
import { MobileNewNoteFab } from './MobileNewNoteFab';
```

(b) Add the two props to the interface (after `avatarUrl`):

```tsx
export interface MobileEditorViewProps {
  onOpenDetails: () => void;
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
```

(c) Add `hasActiveNote` and `onNewNote` to the destructured params:

```tsx
export function MobileEditorView({
  onOpenDetails,
  onExit,
  onAfterSave,
  onOpenAccount,
  avatarUrl,
  hasActiveNote,
  onNewNote,
}: MobileEditorViewProps) {
```

(d) Add `relative` to the root container className so the absolutely-positioned FAB anchors to it. Change:

```tsx
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--plaster)' }}>
```

to:

```tsx
    <div className="relative flex flex-col h-full min-h-0" style={{ background: 'var(--plaster)' }}>
```

(e) Render the FAB at the end of the root container, just before its closing `</div>` (after the editor `<div className="flex-1 min-h-0"> ... </div>` block):

```tsx
      {!hasActiveNote && <MobileNewNoteFab onClick={onNewNote} />}
    </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileEditorView.test.tsx`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileEditorView.tsx src/components/sections/notepad/mobile/MobileEditorView.test.tsx
git commit -m "feat(mobile): show New note FAB on editor empty state"
```

---

## Task 3: Wire the props through `MobileNotepadWorkspace`

**Files:**
- Modify: `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`
- Test: `src/components/sections/notepad/mobile/MobileNotepadWorkspace.test.tsx`

- [ ] **Step 1: Write the failing test**

The workspace test mocks `MobileEditorView` as a stub. Convert that mock into a prop-capturing spy (via `vi.hoisted`, since `vi.mock` is hoisted above module-level consts) and assert the editor tab receives the wired props. The mocked `model` already has `activeNote: { id: 'n1' }`, so `hasActiveNote` should be `true`.

Replace the existing `MobileEditorView` mock line:

```tsx
vi.mock('./MobileEditorView', () => ({ MobileEditorView: () => <div data-testid="view-editor" /> }));
```

with:

```tsx
const { editorViewSpy } = vi.hoisted(() => ({ editorViewSpy: vi.fn() }));
vi.mock('./MobileEditorView', () => ({
  MobileEditorView: (props: { hasActiveNote?: boolean; onNewNote?: () => void }) => {
    editorViewSpy(props);
    return <div data-testid="view-editor" />;
  },
}));
```

Then append this test inside the existing `describe('<MobileNotepadWorkspace />', ...)` block:

```tsx
  it('wires hasActiveNote and onNewNote into the editor view', () => {
    editorViewSpy.mockClear();
    const { getByRole } = renderShell();
    fireEvent.click(getByRole('tab', { name: /Editor/ }));
    expect(editorViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({ hasActiveNote: true, onNewNote: expect.any(Function) }),
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileNotepadWorkspace.test.tsx`
Expected: FAIL — `editorViewSpy` is called with props that lack `hasActiveNote`/`onNewNote` (they're `undefined`), because the workspace does not yet pass them.

- [ ] **Step 3: Implement the wiring**

In `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`, the `tab === 'editor'` block currently reads:

```tsx
        {tab === 'editor' && (
          <MobileEditorView
            onOpenDetails={() => setMoreOpen(true)}
            onExit={() => navigate('/')}
            onAfterSave={model.onAfterSave}
            onOpenAccount={openAccount}
            avatarUrl={profile?.avatarUrl ?? null}
          />
        )}
```

Add the two props:

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

(`handleNewNote` is already defined at lines 81–84 and does `createNote('root', 'devotion'); setTab('editor');`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileNotepadWorkspace.test.tsx`
Expected: PASS — `editorViewSpy` called with `{ hasActiveNote: true, onNewNote: <function> }`; the 3 pre-existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx src/components/sections/notepad/mobile/MobileNotepadWorkspace.test.tsx
git commit -m "feat(mobile): pass hasActiveNote/onNewNote to editor view"
```

---

## Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean (exit 0).

- [ ] **Step 2: Run the touched test files**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileNewNoteFab.test.tsx src/components/sections/notepad/mobile/MobileEditorView.test.tsx src/components/sections/notepad/mobile/MobileNotepadWorkspace.test.tsx`
Expected: all pass (2 + 5 + 4 = 11 tests).

- [ ] **Step 3: Lint the touched files**

Run: `npx eslint src/components/sections/notepad/mobile/MobileNewNoteFab.tsx src/components/sections/notepad/mobile/MobileEditorView.tsx src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`
Expected: no errors.

- [ ] **Step 4: Manual smoke (optional, recommended)**

Run the app (`npm run dev`), open a mobile viewport, go to the Editor tab with no note selected. Confirm: the empty state shows the gold plus FAB bottom-right; tapping it creates a new note and the editor shows it (FAB gone). Open an existing note → no FAB on the editor. Confirm the Notes-tab FAB and desktop are unchanged.

---

## Notes / Decisions Captured

- Direct create (single tap), not an expanding menu — chosen during brainstorming.
- FAB shows only when `hasActiveNote` is false (editor empty state).
- Mobile-only; `MobileFabMenu` and desktop are untouched.
- `MobileNewNoteFab` is standalone (not a variant of `MobileFabMenu`) to keep each component single-purpose; the few shared style values are cheaper to duplicate than to abstract.
