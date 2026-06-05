# Notepad Mobile Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/notepad/notes` a dedicated mobile experience — a bottom-tab shell (Notes · Editor · Lamplight · More) with a keyboard-accessory editor toolbar and a Lamplight view that toggles between Today's Lamp and this note's connection cards — while leaving the desktop layout byte-for-byte unchanged.

**Architecture:** A single breakpoint switch (`useIsMobile()`) inside the existing `Notepad` provider tree chooses between the renamed-but-unchanged `DesktopNotepadWorkspace` and a new `MobileNotepadWorkspace`. The mobile shell is pure layout + navigation: it composes the SAME leaf components (`NotepadSidebar`, `NotepadEditor`, `LamplightTabPanel`, `ConnectionCardsStrip`, `BacklinksPanel`, `InfoPanel`, `GraphPane`) which already read from `NotepadProvider` context, so both shells share data, persistence, and Lamplight wiring. New mobile code lives under `src/components/sections/notepad/mobile/`.

**Tech Stack:** React + TypeScript, Vite, Tailwind + inline styles + CSS custom properties (existing notepad styling conventions), Tiptap (existing editor), Vitest + @testing-library/react + jsdom for tests (per-file `// @vitest-environment jsdom` docblock; default env is `node`).

---

## File Structure

**New files (all mobile-only):**

- `src/components/sections/notepad/mobile/types.ts` — `MobileTab` union type.
- `src/components/sections/notepad/mobile/Segmented.tsx` — reusable two/three-way segmented control (used by Lamplight view + More sheet).
- `src/components/sections/notepad/mobile/MobileTabBar.tsx` — the bottom tab bar (4 tabs, active highlight, Lamplight glow-dot badge, safe-area inset).
- `src/components/sections/notepad/mobile/useKeyboardInset.ts` — hook returning the px the editor toolbar must rise to sit above the on-screen keyboard.
- `src/components/sections/notepad/mobile/useHasConnections.ts` — hook returning whether the active note has Lamplight connections (drives the glow-dot).
- `src/components/sections/notepad/mobile/MobileNotesView.tsx` — Notes view (exit + search header, `NotepadSidebar`, `+` FAB). Presentational; callbacks injected.
- `src/components/sections/notepad/mobile/MobileEditorView.tsx` — Editor view (thin header with `⋯`, `NotepadEditor` with bottom toolbar placement).
- `src/components/sections/notepad/mobile/LamplightMobileView.tsx` — Lamplight view (segmented Today's Lamp | Connections).
- `src/components/sections/notepad/mobile/MobileMoreSheet.tsx` — bottom sheet (segmented Backlinks/Info/Graph + online-status footer).
- `src/components/sections/notepad/mobile/useMobileWorkspaceModel.ts` — gathers context reads + Lamplight wiring into one object (keeps the workspace component thin/testable).
- `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx` — the shell: owns active-tab + sheet state, renders the active view + tab bar + offline banner.

**Modified files:**

- `src/notepad/components/Editor.tsx` — add an optional `toolbarPlacement?: 'top' | 'bottom'` prop (+ `toolbarBottomOffset?: number`). Default `'top'` keeps desktop identical.
- `src/components/sections/Notepad.tsx` — rename the existing `NotepadWorkspace` body to `DesktopNotepadWorkspace` (no body change) and add a new `NotepadWorkspace` that switches on `useIsMobile()`.

**Test files:** one `*.test.tsx`/`*.test.ts` co-located beside each new unit, plus an Editor regression test.

---

## Conventions used by every task

- Component tests start with the docblock `// @vitest-environment jsdom` (the repo default env is `node`).
- Use `render`, `cleanup` from `@testing-library/react`; `afterEach(cleanup)`.
- Wrap router-dependent renders in `<MemoryRouter>` from `react-router-dom`.
- Run a single test file with: `npx vitest run <path>`.
- Commit after each task.

---

### Task 1: `MobileTab` type + `Segmented` control

**Files:**
- Create: `src/components/sections/notepad/mobile/types.ts`
- Create: `src/components/sections/notepad/mobile/Segmented.tsx`
- Test: `src/components/sections/notepad/mobile/Segmented.test.tsx`

- [ ] **Step 1: Write the type file**

```ts
// src/components/sections/notepad/mobile/types.ts
export type MobileTab = 'notes' | 'editor' | 'lamplight' | 'more';
```

- [ ] **Step 2: Write the failing test**

```tsx
// src/components/sections/notepad/mobile/Segmented.test.tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Segmented } from './Segmented';

afterEach(cleanup);

describe('<Segmented />', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Bravo' },
  ];

  it('renders one button per option and marks the selected one pressed', () => {
    const { getByRole } = render(
      <Segmented options={options} value="a" onChange={() => {}} />,
    );
    expect(getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed')).toBe('true');
    expect(getByRole('button', { name: 'Bravo' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onChange with the option value when a segment is clicked', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <Segmented options={options} value="a" onChange={onChange} />,
    );
    fireEvent.click(getByRole('button', { name: 'Bravo' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/Segmented.test.tsx`
Expected: FAIL — `Cannot find module './Segmented'`.

- [ ] **Step 4: Implement `Segmented`**

```tsx
// src/components/sections/notepad/mobile/Segmented.tsx
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <div
      role="group"
      className="flex gap-1 p-1 rounded-full"
      style={{ background: 'var(--pale-stone)', fontFamily: 'Outfit, sans-serif' }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className="flex-1 text-[12px] font-medium rounded-full transition-colors"
            style={{
              padding: '7px 0',
              background: selected ? 'var(--deep-umber)' : 'transparent',
              color: selected ? 'var(--plaster)' : 'var(--silica)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/Segmented.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/notepad/mobile/types.ts src/components/sections/notepad/mobile/Segmented.tsx src/components/sections/notepad/mobile/Segmented.test.tsx
git commit -m "feat(notepad-mobile): add MobileTab type and Segmented control"
```

---

### Task 2: `MobileTabBar`

**Files:**
- Create: `src/components/sections/notepad/mobile/MobileTabBar.tsx`
- Test: `src/components/sections/notepad/mobile/MobileTabBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/sections/notepad/mobile/MobileTabBar.test.tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileTabBar } from './MobileTabBar';

afterEach(cleanup);

describe('<MobileTabBar />', () => {
  it('renders all four tabs and marks the active one', () => {
    const { getByRole } = render(
      <MobileTabBar active="editor" onSelect={() => {}} lamplightHasConnections={false} />,
    );
    expect(getByRole('tab', { name: /Notes/ })).toBeTruthy();
    expect(getByRole('tab', { name: /Editor/ }).getAttribute('aria-selected')).toBe('true');
    expect(getByRole('tab', { name: /Lamplight/ })).toBeTruthy();
    expect(getByRole('tab', { name: /More/ })).toBeTruthy();
  });

  it('calls onSelect with the tab id when a tab is tapped', () => {
    const onSelect = vi.fn();
    const { getByRole } = render(
      <MobileTabBar active="notes" onSelect={onSelect} lamplightHasConnections={false} />,
    );
    fireEvent.click(getByRole('tab', { name: /Lamplight/ }));
    expect(onSelect).toHaveBeenCalledWith('lamplight');
  });

  it('shows the connection glow-dot only when lamplightHasConnections is true', () => {
    const { rerender, container } = render(
      <MobileTabBar active="notes" onSelect={() => {}} lamplightHasConnections={false} />,
    );
    expect(container.querySelector('[data-testid="lamplight-dot"]')).toBeNull();
    rerender(
      <MobileTabBar active="notes" onSelect={() => {}} lamplightHasConnections={true} />,
    );
    expect(container.querySelector('[data-testid="lamplight-dot"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileTabBar.test.tsx`
Expected: FAIL — `Cannot find module './MobileTabBar'`.

- [ ] **Step 3: Implement `MobileTabBar`**

```tsx
// src/components/sections/notepad/mobile/MobileTabBar.tsx
import { NotebookPen, Pencil, Flame, MoreHorizontal } from 'lucide-react';
import type { MobileTab } from './types';

interface TabDef {
  id: MobileTab;
  label: string;
  Icon: typeof NotebookPen;
}

const TABS: TabDef[] = [
  { id: 'notes', label: 'Notes', Icon: NotebookPen },
  { id: 'editor', label: 'Editor', Icon: Pencil },
  { id: 'lamplight', label: 'Lamplight', Icon: Flame },
  { id: 'more', label: 'More', Icon: MoreHorizontal },
];

export interface MobileTabBarProps {
  active: MobileTab;
  onSelect: (tab: MobileTab) => void;
  lamplightHasConnections: boolean;
}

export function MobileTabBar({ active, onSelect, lamplightHasConnections }: MobileTabBarProps) {
  return (
    <div
      role="tablist"
      className="shrink-0 flex"
      style={{
        borderTop: '1px solid var(--pale-stone)',
        background: 'rgba(240, 236, 232, 0.97)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        fontFamily: 'Outfit, sans-serif',
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const selected = id === active;
        const accent = id === 'lamplight';
        return (
          <button
            key={id}
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(id)}
            className="relative flex-1 flex flex-col items-center justify-center gap-0.5"
            style={{
              minHeight: 56,
              color: selected
                ? accent
                  ? '#b8843a'
                  : 'var(--deep-umber)'
                : 'var(--silica)',
              borderTop: selected ? `2px solid ${accent ? '#b8843a' : 'var(--deep-umber)'}` : '2px solid transparent',
              background: 'transparent',
            }}
          >
            <span className="relative">
              <Icon size={18} />
              {accent && lamplightHasConnections && (
                <span
                  data-testid="lamplight-dot"
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -4,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#b8843a',
                  }}
                />
              )}
            </span>
            <span className="text-[10px] tracking-wide">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileTabBar.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileTabBar.tsx src/components/sections/notepad/mobile/MobileTabBar.test.tsx
git commit -m "feat(notepad-mobile): add bottom MobileTabBar with Lamplight glow-dot"
```

---

### Task 3: `useKeyboardInset` hook

The editor's bottom toolbar must rise above the on-screen keyboard. `visualViewport` shrinks when the keyboard opens; the inset is `window.innerHeight - (visualViewport.height + visualViewport.offsetTop)`.

**Files:**
- Create: `src/components/sections/notepad/mobile/useKeyboardInset.ts`
- Test: `src/components/sections/notepad/mobile/useKeyboardInset.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/sections/notepad/mobile/useKeyboardInset.test.tsx
// @vitest-environment jsdom
import { render, cleanup, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardInset } from './useKeyboardInset';

afterEach(cleanup);

function Probe() {
  const inset = useKeyboardInset();
  return <div data-testid="inset">{inset}</div>;
}

describe('useKeyboardInset', () => {
  let listeners: Record<string, () => void>;
  beforeEach(() => {
    listeners = {};
    // window.innerHeight is 768 in jsdom by default; set explicitly.
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    // Fake visualViewport.
    (window as unknown as { visualViewport: unknown }).visualViewport = {
      height: 800,
      offsetTop: 0,
      addEventListener: (ev: string, cb: () => void) => {
        listeners[ev] = cb;
      },
      removeEventListener: () => {},
    };
  });

  it('returns 0 when the keyboard is closed', () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('inset').textContent).toBe('0');
  });

  it('returns the covered height when the viewport shrinks (keyboard open)', () => {
    const { getByTestId } = render(<Probe />);
    act(() => {
      (window as unknown as { visualViewport: { height: number } }).visualViewport.height = 500;
      listeners['resize']?.();
    });
    expect(getByTestId('inset').textContent).toBe('300');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/useKeyboardInset.test.tsx`
Expected: FAIL — `Cannot find module './useKeyboardInset'`.

- [ ] **Step 3: Implement `useKeyboardInset`**

```ts
// src/components/sections/notepad/mobile/useKeyboardInset.ts
import { useEffect, useState } from 'react';

/**
 * Pixels the bottom of the layout is covered by the on-screen keyboard.
 * 0 when the keyboard is closed or visualViewport is unavailable.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const covered = window.innerHeight - (vv.height + vv.offsetTop);
      setInset(covered > 0 ? Math.round(covered) : 0);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/useKeyboardInset.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/useKeyboardInset.ts src/components/sections/notepad/mobile/useKeyboardInset.test.tsx
git commit -m "feat(notepad-mobile): add useKeyboardInset hook for accessory toolbar"
```

---

### Task 4: `useHasConnections` hook (glow-dot signal)

Reuses the existing `useConnectionCards` state machine. When `state.phase === 'ready'` with at least one card, the active note has connections.

**Files:**
- Create: `src/components/sections/notepad/mobile/useHasConnections.ts`
- Test: `src/components/sections/notepad/mobile/useHasConnections.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/sections/notepad/mobile/useHasConnections.test.tsx
// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the underlying hook so this test stays a pure unit of the wrapper logic.
vi.mock('../../../../notepad/hooks/useConnectionCards', () => ({
  useConnectionCards: vi.fn(),
}));
import { useConnectionCards } from '../../../../notepad/hooks/useConnectionCards';
import { useHasConnections } from './useHasConnections';

afterEach(cleanup);

const baseArgs = {
  adapter: {} as never,
  userId: 'u1',
  activeNote: { id: 'n1' } as never,
  totalNoteCount: 5,
  loadNeighborNotes: async () => [],
};

function Probe() {
  const has = useHasConnections(baseArgs);
  return <div data-testid="has">{String(has)}</div>;
}

describe('useHasConnections', () => {
  it('is true when the connection-cards state is ready with cards', () => {
    vi.mocked(useConnectionCards).mockReturnValue({
      state: { phase: 'ready', cards: [{ relatedNoteId: 'x' }] } as never,
      expandCard: vi.fn(),
      retryWhy: vi.fn(),
    });
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('has').textContent).toBe('true');
  });

  it('is false for any non-ready phase', () => {
    vi.mocked(useConnectionCards).mockReturnValue({
      state: { phase: 'no_connections' } as never,
      expandCard: vi.fn(),
      retryWhy: vi.fn(),
    });
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('has').textContent).toBe('false');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/useHasConnections.test.tsx`
Expected: FAIL — `Cannot find module './useHasConnections'`.

- [ ] **Step 3: Implement `useHasConnections`**

```ts
// src/components/sections/notepad/mobile/useHasConnections.ts
import { useConnectionCards } from '../../../../notepad/hooks/useConnectionCards';
import type { LamplightAdapter } from '../../../../notepad/storage/lamplight-adapter';
import type { Note } from '../../../../notepad/types';

export interface UseHasConnectionsArgs {
  adapter: LamplightAdapter | null;
  userId: string | null;
  activeNote: Note | null;
  totalNoteCount: number;
  loadNeighborNotes: (ids: string[]) => Promise<Note[]>;
}

/**
 * True when the active note has at least one qualifying Lamplight connection.
 * Drives the bottom-bar Lamplight glow-dot. Safe no-op when adapter/user absent.
 */
export function useHasConnections({
  adapter,
  userId,
  activeNote,
  totalNoteCount,
  loadNeighborNotes,
}: UseHasConnectionsArgs): boolean {
  // useConnectionCards requires a non-null adapter; when absent, pass a null
  // activeNote so the hook parks in its inactive phase and never fetches.
  const { state } = useConnectionCards({
    adapter: (adapter ?? ({} as LamplightAdapter)),
    userId: userId ?? '',
    activeNote: adapter && userId ? activeNote : null,
    totalNoteCount,
    loadNeighborNotes,
  });
  return state.phase === 'ready' && state.cards.length > 0;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/useHasConnections.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/useHasConnections.ts src/components/sections/notepad/mobile/useHasConnections.test.tsx
git commit -m "feat(notepad-mobile): add useHasConnections glow-dot signal"
```

---

### Task 5: Add `toolbarPlacement` prop + mobile tap-tooltip to `NotepadEditor`

Add an opt-in bottom placement so the formatting toolbar can ride above the keyboard on mobile (default `'top'` ⇒ desktop renders identically), and — gated on the same mobile signal — make the verse tooltip open on tap (the existing tooltip is hover-only via `onMouseOver`, which never fires on touch). Desktop behavior is unchanged because the tap wiring only activates when `toolbarPlacement === 'bottom'`.

**Files:**
- Modify: `src/notepad/components/Editor.tsx`
- Test: `src/notepad/components/Editor.toolbar-placement.test.tsx`

- [ ] **Step 1: Write the failing test**

This test drives `NotepadEditor` through a real provider would be heavy; instead assert the toolbar container's placement via a data attribute we add. The editor needs context, so mock the editor-bridge hook to force an editor-present render with an active note.

```tsx
// src/notepad/components/Editor.toolbar-placement.test.tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal context + editor mocks so NotepadEditor renders its toolbar.
const fakeEditor = {
  chain: () => ({ focus: () => ({ undo: () => ({ run() {} }), redo: () => ({ run() {} }) }) }),
  can: () => ({ undo: () => true, redo: () => true }),
  isActive: () => false,
};
// Stable spy so we can assert the verse handler fires on tap.
const verseSpies = vi.hoisted(() => ({ onMouseOver: vi.fn() }));
vi.mock('../context/useNoteCollection', () => ({
  useNoteCollection: () => ({
    notes: [],
    activeNote: { id: 'n1', title: 'T', createdAt: new Date().toISOString(), tags: [] },
    collection: { openNote: vi.fn() },
  }),
}));
vi.mock('../context/useNotepadActions', () => ({
  useNotepadActions: () => ({ updateNote: vi.fn() }),
}));
vi.mock('../context/useReferenceGraph', () => ({ useReferenceGraph: () => ({ graph: null }) }));
vi.mock('../editor/use-note-editor', () => ({ useNoteEditor: () => ({ editor: fakeEditor }) }));
vi.mock('../editor/use-note-link-popup', () => ({
  useNoteLinkPopup: () => ({ popup: null, search: '', setSearch: vi.fn(), filteredNotes: [], dismiss: vi.fn(), insert: vi.fn() }),
}));
vi.mock('../editor/use-verse-tooltip', () => ({
  useVerseTooltip: () => ({ tooltip: null, onMouseOver: verseSpies.onMouseOver, onMouseOut: vi.fn() }),
}));
vi.mock('../hooks/use-journal-theme', () => ({ useJournalTheme: () => ['default', vi.fn()] }));
vi.mock('@tiptap/react', () => ({ EditorContent: () => <div data-testid="editor-content" /> }));

import { NotepadEditor } from './Editor';

beforeEach(() => verseSpies.onMouseOver.mockClear());
afterEach(cleanup);

describe('NotepadEditor toolbarPlacement', () => {
  it('defaults to top placement', () => {
    const { container } = render(<NotepadEditor />);
    const bar = container.querySelector('[data-toolbar-placement]');
    expect(bar?.getAttribute('data-toolbar-placement')).toBe('top');
  });

  it('renders a bottom-pinned toolbar when toolbarPlacement="bottom"', () => {
    const { container } = render(<NotepadEditor toolbarPlacement="bottom" toolbarBottomOffset={120} />);
    const bar = container.querySelector('[data-toolbar-placement]') as HTMLElement;
    expect(bar.getAttribute('data-toolbar-placement')).toBe('bottom');
    expect(bar.style.position).toBe('sticky');
    expect(bar.style.bottom).toBe('120px');
  });

  it('does NOT fire the verse handler on content tap in top placement (desktop unchanged)', () => {
    const { getByTestId } = render(<NotepadEditor />);
    fireEvent.click(getByTestId('editor-content').parentElement as HTMLElement);
    expect(verseSpies.onMouseOver).not.toHaveBeenCalled();
  });

  it('fires the verse handler on content tap in bottom placement (mobile tap tooltip)', () => {
    const { getByTestId } = render(<NotepadEditor toolbarPlacement="bottom" />);
    fireEvent.click(getByTestId('editor-content').parentElement as HTMLElement);
    expect(verseSpies.onMouseOver).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/notepad/components/Editor.toolbar-placement.test.tsx`
Expected: FAIL — props not supported / no `data-toolbar-placement` attribute.

- [ ] **Step 3: Update the `NotepadEditorProps` interface**

In `src/notepad/components/Editor.tsx`, replace the interface (around line 31):

```tsx
export interface NotepadEditorProps {
  onAfterSave?: (note: Note) => void;
  /** 'top' (default, desktop) renders the toolbar above the content. 'bottom'
   *  pins it to the bottom of the editor (mobile accessory bar). */
  toolbarPlacement?: 'top' | 'bottom';
  /** When toolbarPlacement is 'bottom', px to lift the bar above the keyboard. */
  toolbarBottomOffset?: number;
}
```

- [ ] **Step 4: Destructure the new props**

Replace the component signature (line 52):

```tsx
export function NotepadEditor({
  onAfterSave,
  toolbarPlacement = 'top',
  toolbarBottomOffset = 0,
}: NotepadEditorProps = {}) {
```

- [ ] **Step 5: Make the outer container order toolbar/content for bottom placement**

Replace the outer return wrapper `<div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>` (line 137) with:

```tsx
  const isBottomToolbar = toolbarPlacement === 'bottom';
  return (
    <div style={{ display: 'flex', flexDirection: isBottomToolbar ? 'column-reverse' : 'column', height: '100%', position: 'relative' }}>
```

`column-reverse` keeps the existing markup order (toolbar first, content second) but paints the toolbar at the bottom.

- [ ] **Step 6: Tag and pin the toolbar container**

On the toolbar `<div className="shrink-0 flex items-center gap-0.5 px-3 border-b" ...>` (line 140), add `data-toolbar-placement` and merge the bottom-pin styles. Replace its opening tag with:

```tsx
        <div
          data-toolbar-placement={toolbarPlacement}
          className="shrink-0 flex items-center gap-0.5 px-3 overflow-x-auto"
          style={{
            height: 40,
            background: 'rgba(240, 236, 232, 0.97)',
            borderColor: 'var(--pale-stone)',
            borderBottom: isBottomToolbar ? 'none' : '1px solid var(--pale-stone)',
            borderTop: isBottomToolbar ? '1px solid var(--pale-stone)' : 'none',
            fontFamily: 'Outfit, sans-serif',
            position: isBottomToolbar ? 'sticky' : undefined,
            bottom: isBottomToolbar ? `${toolbarBottomOffset}px` : undefined,
            zIndex: isBottomToolbar ? 20 : undefined,
          }}
        >
```

(We swapped the static `border-b` class for explicit `borderTop`/`borderBottom` so the divider sits on the correct edge, and added `overflow-x-auto` so the row scrolls horizontally on narrow screens.)

- [ ] **Step 7: Flip the dropdown menus upward for bottom placement**

The heading dropdown (line 179) and theme dropdown (line 283) both use `className="absolute top-full ... mt-1 ..."`. For bottom placement they must open upward. For each, change the className to a computed value. Heading dropdown:

```tsx
              <div
                className={`absolute ${isBottomToolbar ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 rounded-md shadow-lg z-50 py-1`}
                style={{ background: 'rgba(240, 236, 232, 0.97)', border: '1px solid var(--pale-stone)', minWidth: 100 }}
              >
```

Theme dropdown:

```tsx
              <div
                className={`absolute ${isBottomToolbar ? 'bottom-full mb-1' : 'top-full mt-1'} right-0 rounded-md shadow-lg z-50 py-1`}
                style={{
                  background: 'rgba(240, 236, 232, 0.97)',
                  border: '1px solid var(--pale-stone)',
                  minWidth: 200,
                }}
              >
```

- [ ] **Step 8: Wire tap-to-tooltip for the verse on mobile only**

The editor content wrapper (line ~414) currently binds `onClick={handleClick}` (note-link clicks) and `onMouseOver={handleMouseOver}` (verse tooltip, hover). On touch, `onMouseOver` never fires, so the verse tooltip is unreachable. Bind the same verse handler to tap, gated on bottom placement so desktop is untouched. Replace that wrapper's opening tag:

```tsx
          <div
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
            onClick={(e) => {
              handleClick(e);
              // On mobile (bottom toolbar) there is no hover; a tap shows/dismisses
              // the verse tooltip. handleMouseOver reads e.target.closest(...) so a
              // click event drives it correctly and clears it when tapping off a verse.
              if (isBottomToolbar) handleMouseOver(e);
            }}
            style={{ flex: 1 }}
          >
```

- [ ] **Step 9: Run the placement test**

Run: `npx vitest run src/notepad/components/Editor.toolbar-placement.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 10: Run the full suite to confirm no desktop regression**

Run: `npx vitest run`
Expected: PASS (all existing tests green — the default `'top'` path, including the verse-tooltip behavior, is unchanged).

- [ ] **Step 11: Commit**

```bash
git add src/notepad/components/Editor.tsx src/notepad/components/Editor.toolbar-placement.test.tsx
git commit -m "feat(notepad): add bottom toolbar placement + mobile tap tooltip to NotepadEditor"
```

---

### Task 6: `MobileNotesView`

Presentational Notes view: header with a "‹ Psalms" exit and a search icon, the existing `NotepadSidebar`, and a `+` FAB. All actions are injected callbacks.

**Files:**
- Create: `src/components/sections/notepad/mobile/MobileNotesView.tsx`
- Test: `src/components/sections/notepad/mobile/MobileNotesView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/sections/notepad/mobile/MobileNotesView.test.tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../notepad/components/Sidebar', () => ({
  NotepadSidebar: () => <div data-testid="sidebar" />,
}));
import { MobileNotesView } from './MobileNotesView';

afterEach(cleanup);

describe('<MobileNotesView />', () => {
  const props = {
    onExit: vi.fn(),
    onOpenSearch: vi.fn(),
    onNewNote: vi.fn(),
    onOpenNote: vi.fn(),
  };

  it('renders the sidebar and the new-note FAB', () => {
    const { getByTestId, getByLabelText } = render(<MobileNotesView {...props} />);
    expect(getByTestId('sidebar')).toBeTruthy();
    expect(getByLabelText('New note')).toBeTruthy();
  });

  it('wires exit, search, and new-note actions', () => {
    const onExit = vi.fn();
    const onOpenSearch = vi.fn();
    const onNewNote = vi.fn();
    const { getByLabelText } = render(
      <MobileNotesView {...props} onExit={onExit} onOpenSearch={onOpenSearch} onNewNote={onNewNote} />,
    );
    fireEvent.click(getByLabelText('Back to Psalms'));
    fireEvent.click(getByLabelText('Search notes'));
    fireEvent.click(getByLabelText('New note'));
    expect(onExit).toHaveBeenCalledOnce();
    expect(onOpenSearch).toHaveBeenCalledOnce();
    expect(onNewNote).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileNotesView.test.tsx`
Expected: FAIL — `Cannot find module './MobileNotesView'`.

- [ ] **Step 3: Implement `MobileNotesView`**

```tsx
// src/components/sections/notepad/mobile/MobileNotesView.tsx
import { ChevronLeft, Search, Plus } from 'lucide-react';
import { NotepadSidebar } from '../../../../notepad/components/Sidebar';

export interface MobileNotesViewProps {
  onExit: () => void;
  onOpenSearch: () => void;
  onNewNote: () => void;
  onOpenNote: (id: string) => void;
}

export function MobileNotesView({ onExit, onOpenSearch, onNewNote, onOpenNote }: MobileNotesViewProps) {
  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--plaster)' }}>
      <header
        className="shrink-0 flex items-center justify-between px-3"
        style={{ height: 48, borderBottom: '1px solid var(--pale-stone)', fontFamily: 'Outfit, sans-serif' }}
      >
        <button
          aria-label="Back to Psalms"
          onClick={onExit}
          className="flex items-center gap-1 text-[13px]"
          style={{ color: 'var(--deep-umber)' }}
        >
          <ChevronLeft size={18} />
          Psalms
        </button>
        <button
          aria-label="Search notes"
          onClick={onOpenSearch}
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/5"
          style={{ color: 'var(--deep-umber)' }}
        >
          <Search size={18} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        <NotepadSidebar hideCollectionHeader={false} onOpenNote={onOpenNote} />
      </div>

      <button
        aria-label="New note"
        onClick={onNewNote}
        className="absolute right-4 flex items-center justify-center rounded-full shadow-lg"
        style={{
          bottom: 'calc(72px + env(safe-area-inset-bottom))',
          width: 52,
          height: 52,
          background: '#b8843a',
          color: '#fff',
        }}
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileNotesView.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileNotesView.tsx src/components/sections/notepad/mobile/MobileNotesView.test.tsx
git commit -m "feat(notepad-mobile): add MobileNotesView (exit, search, sidebar, FAB)"
```

---

### Task 7: `MobileEditorView`

Thin header with a `⋯` that opens the More/Details sheet, plus the existing `NotepadEditor` configured for bottom-toolbar placement and lifted above the keyboard via `useKeyboardInset`.

**Files:**
- Create: `src/components/sections/notepad/mobile/MobileEditorView.tsx`
- Test: `src/components/sections/notepad/mobile/MobileEditorView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/sections/notepad/mobile/MobileEditorView.test.tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
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
    const { getByTestId } = render(<MobileEditorView onOpenDetails={vi.fn()} />);
    expect(getByTestId('editor').getAttribute('data-placement')).toBe('bottom');
  });

  it('opens details when the ⋯ button is tapped', () => {
    const onOpenDetails = vi.fn();
    const { getByLabelText } = render(<MobileEditorView onOpenDetails={onOpenDetails} />);
    fireEvent.click(getByLabelText('Note details'));
    expect(onOpenDetails).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileEditorView.test.tsx`
Expected: FAIL — `Cannot find module './MobileEditorView'`.

- [ ] **Step 3: Implement `MobileEditorView`**

```tsx
// src/components/sections/notepad/mobile/MobileEditorView.tsx
import { MoreHorizontal } from 'lucide-react';
import { NotepadEditor } from '../../../../notepad/components/Editor';
import type { Note } from '../../../../notepad/types';
import { useKeyboardInset } from './useKeyboardInset';

export interface MobileEditorViewProps {
  onOpenDetails: () => void;
  onAfterSave?: (note: Note) => void;
}

export function MobileEditorView({ onOpenDetails, onAfterSave }: MobileEditorViewProps) {
  const keyboardInset = useKeyboardInset();
  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--plaster)' }}>
      <header
        className="shrink-0 flex items-center justify-end px-3"
        style={{ height: 44, borderBottom: '1px solid var(--pale-stone)', fontFamily: 'Outfit, sans-serif' }}
      >
        <button
          aria-label="Note details"
          onClick={onOpenDetails}
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/5"
          style={{ color: 'var(--deep-umber)' }}
        >
          <MoreHorizontal size={20} />
        </button>
      </header>

      <div className="flex-1 min-h-0">
        <NotepadEditor
          onAfterSave={onAfterSave}
          toolbarPlacement="bottom"
          toolbarBottomOffset={keyboardInset}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileEditorView.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileEditorView.tsx src/components/sections/notepad/mobile/MobileEditorView.test.tsx
git commit -m "feat(notepad-mobile): add MobileEditorView with keyboard accessory toolbar"
```

---

### Task 8: `LamplightMobileView` (Today's Lamp | Connections)

Segmented toggle. Only the selected surface mounts, so Today's Lamp doesn't generate a devotion while the user is on Connections, and vice versa. Default `'today'`.

**Files:**
- Create: `src/components/sections/notepad/mobile/LamplightMobileView.tsx`
- Test: `src/components/sections/notepad/mobile/LamplightMobileView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/sections/notepad/mobile/LamplightMobileView.test.tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../notepad/components/lamplight/LamplightTabPanel', () => ({
  LamplightTabPanel: () => <div data-testid="todays-lamp" />,
}));
vi.mock('../../../../notepad/components/lamplight/ConnectionCardsStrip', () => ({
  ConnectionCardsStrip: () => <div data-testid="connections" />,
}));
import { LamplightMobileView } from './LamplightMobileView';

afterEach(cleanup);

const props = {
  lamplightAdapter: {} as never,
  userId: 'u1',
  activeNote: { id: 'n1' } as never,
  totalNoteCount: 5,
  loadNeighborNotes: async () => [],
  onOpenNote: vi.fn(),
};

describe('<LamplightMobileView />', () => {
  it("defaults to Today's Lamp", () => {
    const { getByTestId, queryByTestId } = render(<LamplightMobileView {...props} />);
    expect(getByTestId('todays-lamp')).toBeTruthy();
    expect(queryByTestId('connections')).toBeNull();
  });

  it('switches to Connections when that segment is chosen', () => {
    const { getByRole, getByTestId, queryByTestId } = render(<LamplightMobileView {...props} />);
    fireEvent.click(getByRole('button', { name: 'Connections' }));
    expect(getByTestId('connections')).toBeTruthy();
    expect(queryByTestId('todays-lamp')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/LamplightMobileView.test.tsx`
Expected: FAIL — `Cannot find module './LamplightMobileView'`.

- [ ] **Step 3: Implement `LamplightMobileView`**

```tsx
// src/components/sections/notepad/mobile/LamplightMobileView.tsx
import { useState } from 'react';
import { LamplightTabPanel } from '../../../../notepad/components/lamplight/LamplightTabPanel';
import { ConnectionCardsStrip } from '../../../../notepad/components/lamplight/ConnectionCardsStrip';
import type { LamplightAdapter } from '../../../../notepad/storage/lamplight-adapter';
import type { Note } from '../../../../notepad/types';
import { Segmented } from './Segmented';

type LampSegment = 'today' | 'connections';

export interface LamplightMobileViewProps {
  lamplightAdapter: LamplightAdapter;
  userId: string | null;
  activeNote: Note | null;
  totalNoteCount: number;
  loadNeighborNotes: (ids: string[]) => Promise<Note[]>;
  onOpenNote: (id: string) => void;
}

export function LamplightMobileView({
  lamplightAdapter,
  userId,
  activeNote,
  totalNoteCount,
  loadNeighborNotes,
  onOpenNote,
}: LamplightMobileViewProps) {
  const [segment, setSegment] = useState<LampSegment>('today');

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--alabaster)' }}>
      <div className="shrink-0 px-4 pt-3 pb-2">
        <Segmented<LampSegment>
          options={[
            { value: 'today', label: "Today's Lamp" },
            { value: 'connections', label: 'Connections' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {segment === 'today' && <LamplightTabPanel lamplightAdapter={lamplightAdapter} />}
        {segment === 'connections' &&
          (userId ? (
            <ConnectionCardsStrip
              adapter={lamplightAdapter}
              userId={userId}
              activeNote={activeNote}
              totalNoteCount={totalNoteCount}
              loadNeighborNotes={loadNeighborNotes}
              onOpenNote={onOpenNote}
            />
          ) : (
            <div
              className="flex items-center justify-center min-h-[200px] text-xs"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              Sign in to see connections.
            </div>
          ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/LamplightMobileView.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/LamplightMobileView.tsx src/components/sections/notepad/mobile/LamplightMobileView.test.tsx
git commit -m "feat(notepad-mobile): add LamplightMobileView with Today's Lamp | Connections toggle"
```

---

### Task 9: `MobileMoreSheet`

A bottom sheet (overlay) that hosts per-note details — Backlinks / Info / Graph — behind a segmented control, plus an online/offline status footer. Reached from both the More tab and the editor `⋯`.

> Scope note: the brainstorm sketch showed a Theme/Sync/Settings footer. Journal-theme selection already lives in the editor toolbar, so the sheet footer ships with the real online/offline status only; a Theme/Settings row is a deliberate follow-up, not built here.

**Files:**
- Create: `src/components/sections/notepad/mobile/MobileMoreSheet.tsx`
- Test: `src/components/sections/notepad/mobile/MobileMoreSheet.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/sections/notepad/mobile/MobileMoreSheet.test.tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../notepad/components/BacklinksPanel', () => ({ BacklinksPanel: () => <div data-testid="backlinks" /> }));
vi.mock('../../../../notepad/components/InfoPanel', () => ({ InfoPanel: () => <div data-testid="info" /> }));
vi.mock('../GraphPane', () => ({ GraphPane: () => <div data-testid="graph" /> }));
vi.mock('../../../../notepad/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
import { MobileMoreSheet } from './MobileMoreSheet';

afterEach(cleanup);

describe('<MobileMoreSheet />', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<MobileMoreSheet open={false} onClose={vi.fn()} />);
    expect(container.querySelector('[data-testid="backlinks"]')).toBeNull();
  });

  it('shows Backlinks by default and switches panels via the segmented control', () => {
    const { getByTestId, queryByTestId, getByRole } = render(<MobileMoreSheet open onClose={vi.fn()} />);
    expect(getByTestId('backlinks')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Graph' }));
    expect(getByTestId('graph')).toBeTruthy();
    expect(queryByTestId('backlinks')).toBeNull();
  });

  it('calls onClose when the backdrop is tapped', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(<MobileMoreSheet open onClose={onClose} />);
    fireEvent.click(getByLabelText('Close details'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileMoreSheet.test.tsx`
Expected: FAIL — `Cannot find module './MobileMoreSheet'`.

- [ ] **Step 3: Implement `MobileMoreSheet`**

```tsx
// src/components/sections/notepad/mobile/MobileMoreSheet.tsx
import { useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { BacklinksPanel } from '../../../../notepad/components/BacklinksPanel';
import { InfoPanel } from '../../../../notepad/components/InfoPanel';
import { GraphPane } from '../GraphPane';
import { useOnlineStatus } from '../../../../notepad/hooks/useOnlineStatus';
import { Segmented } from './Segmented';

type DetailSegment = 'backlinks' | 'info' | 'graph';

export interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMoreSheet({ open, onClose }: MobileMoreSheetProps) {
  const [segment, setSegment] = useState<DetailSegment>('backlinks');
  const isOnline = useOnlineStatus();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ fontFamily: 'Outfit, sans-serif' }}>
      <button
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.35)' }}
      />
      <div
        className="relative rounded-t-2xl flex flex-col"
        style={{
          background: 'var(--plaster)',
          maxHeight: '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -8px 28px rgba(0,0,0,0.18)',
        }}
      >
        <div className="flex justify-center pt-2">
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--pale-stone)' }} />
        </div>

        <div className="px-4 pt-3 pb-2">
          <Segmented<DetailSegment>
            options={[
              { value: 'backlinks', label: 'Backlinks' },
              { value: 'info', label: 'Info' },
              { value: 'graph', label: 'Graph' },
            ]}
            value={segment}
            onChange={setSegment}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {segment === 'backlinks' && <BacklinksPanel />}
          {segment === 'info' && <InfoPanel />}
          {segment === 'graph' && <GraphPane graphOpen expanded={false} onToggleExpand={() => {}} />}
        </div>

        <footer
          className="shrink-0 flex items-center gap-2 px-4 py-2 text-[11px]"
          style={{ borderTop: '1px solid var(--pale-stone)', color: 'var(--silica)' }}
        >
          {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
          {isOnline ? 'Synced' : 'Offline — changes saved locally'}
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileMoreSheet.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileMoreSheet.tsx src/components/sections/notepad/mobile/MobileMoreSheet.test.tsx
git commit -m "feat(notepad-mobile): add MobileMoreSheet (Backlinks/Info/Graph + status)"
```

---

### Task 10: `useMobileWorkspaceModel` (context + Lamplight wiring)

Gathers everything the shell needs from context — auth, notes, online status, and the Lamplight adapter wiring (mirrors `Notepad.tsx` lines 30–52) — into one object so the workspace component stays thin and testable.

**Files:**
- Create: `src/components/sections/notepad/mobile/useMobileWorkspaceModel.ts`
- Test: `src/components/sections/notepad/mobile/useMobileWorkspaceModel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/sections/notepad/mobile/useMobileWorkspaceModel.test.tsx
// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/context/useAuthSession', () => ({
  useAuthSession: () => ({ user: { id: 'u1' }, adapter: {} }),
}));
vi.mock('../../../../notepad/context/useNoteCollection', () => ({
  useNoteCollection: () => ({
    notes: [{ id: 'n1' }, { id: 'n2' }],
    activeNote: { id: 'n1' },
    collection: { openNote: vi.fn(), createNote: vi.fn() },
  }),
}));
vi.mock('../../../../notepad/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
vi.mock('../../../../notepad/hooks/useLamplightSettings', () => ({
  useLamplightSettings: () => ({ settings: { enabled: true } }),
}));
vi.mock('../../../../notepad/hooks/useLamplightEmbeddingTrigger', () => ({
  useLamplightEmbeddingTrigger: () => vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ supabase: null }));

import { useMobileWorkspaceModel } from './useMobileWorkspaceModel';

afterEach(cleanup);

function Probe() {
  const m = useMobileWorkspaceModel();
  return (
    <div>
      <span data-testid="user">{m.user?.id ?? 'none'}</span>
      <span data-testid="count">{m.totalNoteCount}</span>
      <span data-testid="active">{m.activeNote?.id ?? 'none'}</span>
    </div>
  );
}

describe('useMobileWorkspaceModel', () => {
  it('exposes user, notes count, and active note from context', () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('user').textContent).toBe('u1');
    expect(getByTestId('count').textContent).toBe('2');
    expect(getByTestId('active').textContent).toBe('n1');
  });

  it('provides a loadNeighborNotes that filters the note list by id', async () => {
    let result: unknown;
    function Probe2() {
      const m = useMobileWorkspaceModel();
      result = m.loadNeighborNotes;
      return null;
    }
    render(<Probe2 />);
    const notes = await (result as (ids: string[]) => Promise<{ id: string }[]>)(['n2']);
    expect(notes).toEqual([{ id: 'n2' }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/useMobileWorkspaceModel.test.tsx`
Expected: FAIL — `Cannot find module './useMobileWorkspaceModel'`.

- [ ] **Step 3: Implement `useMobileWorkspaceModel`**

```ts
// src/components/sections/notepad/mobile/useMobileWorkspaceModel.ts
import { useCallback, useMemo } from 'react';
import { useAuthSession } from '@/auth/context/useAuthSession';
import { useNoteCollection } from '../../../../notepad/context/useNoteCollection';
import { useOnlineStatus } from '../../../../notepad/hooks/useOnlineStatus';
import { useLamplightSettings } from '../../../../notepad/hooks/useLamplightSettings';
import { useLamplightEmbeddingTrigger } from '../../../../notepad/hooks/useLamplightEmbeddingTrigger';
import { SupabaseLamplightAdapter } from '../../../../notepad/storage/supabase-lamplight-adapter';
import type { LamplightAdapter } from '../../../../notepad/storage/lamplight-adapter';
import type { Note } from '../../../../notepad/types';
import { supabase } from '@/lib/supabase';

export interface MobileWorkspaceModel {
  user: { id: string } | null;
  notes: Note[];
  activeNote: Note | null;
  totalNoteCount: number;
  isOnline: boolean;
  openNote: (id: string) => void;
  createNote: (folderId: string, type: 'devotion' | 'sermon' | 'theme') => void;
  lamplightAdapter: LamplightAdapter | null;
  onAfterSave: (note: Note) => void;
  loadNeighborNotes: (ids: string[]) => Promise<Note[]>;
}

export function useMobileWorkspaceModel(): MobileWorkspaceModel {
  const { user } = useAuthSession();
  const { notes, activeNote, collection } = useNoteCollection();
  const isOnline = useOnlineStatus();

  const lamplightAdapter = useMemo(
    () => (supabase ? new SupabaseLamplightAdapter(supabase) : null),
    [],
  );

  const { settings: lamplightSettings } = useLamplightSettings({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: lamplightAdapter as any,
    userId: lamplightAdapter ? (user?.id ?? null) : null,
  });

  const onAfterSave = useLamplightEmbeddingTrigger({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: lamplightAdapter as any,
    enabled: !!(lamplightAdapter && lamplightSettings?.enabled),
    userId: lamplightAdapter ? (user?.id ?? null) : null,
    invoke: (name, options) => supabase!.functions.invoke(name, options),
  });

  const loadNeighborNotes = useCallback(
    async (ids: string[]) => notes.filter((n) => ids.includes(n.id)),
    [notes],
  );

  return {
    user: user ? { id: user.id } : null,
    notes,
    activeNote,
    totalNoteCount: notes.length,
    isOnline,
    openNote: collection.openNote,
    createNote: collection.createNote,
    lamplightAdapter,
    onAfterSave,
    loadNeighborNotes,
  };
}
```

> Implementation note: this duplicates the Lamplight wiring from `Notepad.tsx` rather than extracting a shared hook, to keep the desktop file's only change a mechanical rename (Task 11). If both shells later need to evolve this wiring together, extract a shared hook then.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/useMobileWorkspaceModel.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/useMobileWorkspaceModel.ts src/components/sections/notepad/mobile/useMobileWorkspaceModel.test.tsx
git commit -m "feat(notepad-mobile): add useMobileWorkspaceModel context/Lamplight wiring"
```

---

### Task 11: `MobileNotepadWorkspace` (the shell)

Owns active-tab + sheet state, renders the active view, the offline banner, the tab bar, the More sheet, and the `SearchDialog`/`MigrationDialog`. Search opens by dispatching the existing global Cmd+K keydown (matches desktop `handleOpenSearch`).

**Files:**
- Create: `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`
- Test: `src/components/sections/notepad/mobile/MobileNotepadWorkspace.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/sections/notepad/mobile/MobileNotepadWorkspace.test.tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const model = {
  user: { id: 'u1' },
  notes: [{ id: 'n1' }],
  activeNote: { id: 'n1' },
  totalNoteCount: 1,
  isOnline: true,
  openNote: vi.fn(),
  createNote: vi.fn(),
  lamplightAdapter: {},
  onAfterSave: vi.fn(),
  loadNeighborNotes: async () => [],
};
vi.mock('./useMobileWorkspaceModel', () => ({ useMobileWorkspaceModel: () => model }));
vi.mock('./useHasConnections', () => ({ useHasConnections: () => false }));
vi.mock('./MobileNotesView', () => ({ MobileNotesView: () => <div data-testid="view-notes" /> }));
vi.mock('./MobileEditorView', () => ({ MobileEditorView: () => <div data-testid="view-editor" /> }));
vi.mock('./LamplightMobileView', () => ({ LamplightMobileView: () => <div data-testid="view-lamplight" /> }));
vi.mock('./MobileMoreSheet', () => ({ MobileMoreSheet: (p: { open: boolean }) => (p.open ? <div data-testid="more-sheet" /> : null) }));
vi.mock('../../../../notepad/components/SearchDialog', () => ({ SearchDialog: () => <div /> }));
vi.mock('../../../../notepad/components/MigrationDialog', () => ({ MigrationDialog: () => <div /> }));
vi.mock('../../../../notepad/first-load/useNotepadFirstLoad', () => ({
  useNotepadFirstLoad: () => ({ showMigration: false, dismissMigration: vi.fn() }),
}));
vi.mock('@/auth/context/useAuthSession', () => ({ useAuthSession: () => ({ adapter: {} }) }));
vi.mock('../../../../notepad/context/useNotepadActions', () => ({ useNotepadActions: () => ({ init: vi.fn() }) }));

import { MobileNotepadWorkspace } from './MobileNotepadWorkspace';

afterEach(cleanup);

function renderShell() {
  return render(
    <MemoryRouter>
      <MobileNotepadWorkspace />
    </MemoryRouter>,
  );
}

describe('<MobileNotepadWorkspace />', () => {
  it('starts on the Notes view', () => {
    const { getByTestId } = renderShell();
    expect(getByTestId('view-notes')).toBeTruthy();
  });

  it('switches the visible view when a tab is selected', () => {
    const { getByRole, getByTestId } = renderShell();
    fireEvent.click(getByRole('tab', { name: /Lamplight/ }));
    expect(getByTestId('view-lamplight')).toBeTruthy();
  });

  it('opens the More sheet from the More tab', () => {
    const { getByRole, getByTestId } = renderShell();
    fireEvent.click(getByRole('tab', { name: /More/ }));
    expect(getByTestId('more-sheet')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileNotepadWorkspace.test.tsx`
Expected: FAIL — `Cannot find module './MobileNotepadWorkspace'`.

- [ ] **Step 3: Implement `MobileNotepadWorkspace`**

```tsx
// src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { useAuthSession } from '@/auth/context/useAuthSession';
import { useNotepadActions } from '../../../../notepad/context/useNotepadActions';
import { useNotepadFirstLoad } from '../../../../notepad/first-load/useNotepadFirstLoad';
import { SearchDialog } from '../../../../notepad/components/SearchDialog';
import { MigrationDialog } from '../../../../notepad/components/MigrationDialog';
import { MobileTabBar } from './MobileTabBar';
import { MobileNotesView } from './MobileNotesView';
import { MobileEditorView } from './MobileEditorView';
import { LamplightMobileView } from './LamplightMobileView';
import { MobileMoreSheet } from './MobileMoreSheet';
import { useMobileWorkspaceModel } from './useMobileWorkspaceModel';
import { useHasConnections } from './useHasConnections';
import type { MobileTab } from './types';

export function MobileNotepadWorkspace() {
  const navigate = useNavigate();
  const model = useMobileWorkspaceModel();
  const actions = useNotepadActions();
  const { adapter } = useAuthSession();
  const { showMigration, dismissMigration } = useNotepadFirstLoad();

  const [tab, setTab] = useState<MobileTab>('notes');
  const [moreOpen, setMoreOpen] = useState(false);

  const hasConnections = useHasConnections({
    adapter: model.lamplightAdapter,
    userId: model.user?.id ?? null,
    activeNote: model.activeNote,
    totalNoteCount: model.totalNoteCount,
    loadNeighborNotes: model.loadNeighborNotes,
  });

  const openSearch = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }, []);

  const handleSelectTab = useCallback((next: MobileTab) => {
    if (next === 'more') {
      setMoreOpen(true);
      return;
    }
    setMoreOpen(false);
    setTab(next);
  }, []);

  const handleOpenNote = useCallback(
    (id: string) => {
      model.openNote(id);
      setTab('editor');
    },
    [model],
  );

  const handleNewNote = useCallback(() => {
    model.createNote('root', 'devotion');
    setTab('editor');
  }, [model]);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--plaster)' }}>
      {!model.isOnline && model.user && (
        <div
          className="flex items-center justify-center gap-2 py-2 text-xs shrink-0"
          style={{
            background: 'rgba(232, 169, 58, 0.15)',
            borderBottom: '1px solid rgba(232, 169, 58, 0.3)',
            color: 'var(--deep-umber)',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          <WifiOff className="w-3.5 h-3.5" />
          You're offline — viewing cached notes
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        {tab === 'notes' && (
          <MobileNotesView
            onExit={() => navigate('/')}
            onOpenSearch={openSearch}
            onNewNote={handleNewNote}
            onOpenNote={handleOpenNote}
          />
        )}
        {tab === 'editor' && (
          <MobileEditorView onOpenDetails={() => setMoreOpen(true)} onAfterSave={model.onAfterSave} />
        )}
        {tab === 'lamplight' && model.lamplightAdapter && (
          <LamplightMobileView
            lamplightAdapter={model.lamplightAdapter}
            userId={model.user?.id ?? null}
            activeNote={model.activeNote}
            totalNoteCount={model.totalNoteCount}
            loadNeighborNotes={model.loadNeighborNotes}
            onOpenNote={handleOpenNote}
          />
        )}
        {tab === 'lamplight' && !model.lamplightAdapter && (
          <div
            className="flex items-center justify-center h-full text-xs"
            style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
          >
            Lamplight unavailable — Supabase not configured.
          </div>
        )}
      </div>

      <MobileTabBar active={tab} onSelect={handleSelectTab} lamplightHasConnections={hasConnections} />

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />

      <SearchDialog />
      <MigrationDialog
        open={showMigration}
        onClose={dismissMigration}
        targetAdapter={adapter}
        onMigrationComplete={() => actions.init()}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/MobileNotepadWorkspace.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx src/components/sections/notepad/mobile/MobileNotepadWorkspace.test.tsx
git commit -m "feat(notepad-mobile): assemble MobileNotepadWorkspace shell"
```

---

### Task 12: Wire the breakpoint switch into `Notepad.tsx`

Rename the existing workspace body to `DesktopNotepadWorkspace` (no body change) and add a new `NotepadWorkspace` that switches on `useIsMobile()`.

**Files:**
- Modify: `src/components/sections/Notepad.tsx`
- Test: `src/components/sections/Notepad.switch.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/sections/Notepad.switch.test.tsx
// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const isMobile = { value: false };
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => isMobile.value }));
vi.mock('./notepad/mobile/MobileNotepadWorkspace', () => ({
  MobileNotepadWorkspace: () => <div data-testid="mobile-shell" />,
}));
// Stand in for the (heavy) desktop body so this test stays focused on the switch.
vi.mock('@/notepad/context/NotepadProvider', () => ({
  NotepadProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/auth/context/useAuthSession', () => ({ useAuthSession: () => ({ adapter: {} }) }));

// The desktop body reads many hooks; mock the workspace's own module boundary by
// mocking the leaf imports it pulls. Simplest: assert via the mobile path and a
// sentinel for desktop using a spy on the rendered marker the desktop path emits.

import { Notepad } from './Notepad';

afterEach(cleanup);

describe('Notepad breakpoint switch', () => {
  it('renders the mobile shell when useIsMobile() is true', () => {
    isMobile.value = true;
    const { getByTestId } = render(<Notepad />);
    expect(getByTestId('mobile-shell')).toBeTruthy();
  });
});
```

> Note: this asserts the mobile branch only. The desktop branch is covered by leaving every existing test green in Step 5 (the desktop body is unchanged).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/sections/Notepad.switch.test.tsx`
Expected: FAIL — `MobileNotepadWorkspace` not referenced by `Notepad.tsx` yet, so the mobile shell never renders.

- [ ] **Step 3: Add the imports**

In `src/components/sections/Notepad.tsx`, add to the import block (after line 22):

```tsx
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileNotepadWorkspace } from './notepad/mobile/MobileNotepadWorkspace';
```

- [ ] **Step 4: Rename the existing body and add the switch**

Change the existing declaration on line 24 from:

```tsx
function NotepadWorkspace() {
```

to:

```tsx
function DesktopNotepadWorkspace() {
```

Leave the entire body of that function unchanged. Then, immediately after that function's closing brace (before `export function Notepad()` on line 264), insert:

```tsx
function NotepadWorkspace() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileNotepadWorkspace /> : <DesktopNotepadWorkspace />;
}
```

`export function Notepad()` (line 264) already renders `<NotepadWorkspace />` inside `NotepadProvider`, so no change is needed there.

- [ ] **Step 5: Run the switch test and the full suite**

Run: `npx vitest run src/components/sections/Notepad.switch.test.tsx`
Expected: PASS (1 test).

Run: `npx vitest run`
Expected: PASS — all existing tests remain green (desktop body untouched).

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/Notepad.tsx src/components/sections/Notepad.switch.test.tsx
git commit -m "feat(notepad): switch to MobileNotepadWorkspace below the mobile breakpoint"
```

---

### Task 13: Full verification — lint, types, build

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — full suite green, including all new mobile tests and all pre-existing tests.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. Fix any lint issues introduced by the new files, then re-run.

- [ ] **Step 3: Type-check + production build**

Run: `npm run build`
Expected: `tsc -b` passes and `vite build` completes without errors.

- [ ] **Step 4: Manual smoke (document result)**

Run: `npm run dev`, open the app, navigate to `/notepad/notes`, and use browser devtools device mode at 390px width. Verify:
- The bottom tab bar shows Notes · Editor · Lamplight · More.
- Notes lists notes; the `+` FAB creates a note and lands in Editor.
- The editor's formatting toolbar sits at the bottom and rises above the keyboard when the field is focused.
- Lamplight shows the Today's Lamp | Connections toggle and switches between them.
- The More tab and the editor `⋯` both open the details sheet (Backlinks/Info/Graph).
- At ≥768px width the desktop three-column layout renders exactly as before.

- [ ] **Step 5: Commit any lint/type fixes**

```bash
git add -A
git commit -m "chore(notepad-mobile): lint and type fixes after mobile revamp"
```

(Skip if Steps 1–3 produced no changes.)

---

## Self-Review

**Spec coverage:**
- Mobile-only separate shell behind `useIsMobile()`, desktop untouched → Tasks 12 (switch) + every mobile file isolated under `mobile/`. ✓
- Bottom bar Notes · Editor · Lamplight · More → Task 2 + Task 11. ✓
- Notes view: exit link, search, `+` FAB, folders/list via `NotepadSidebar`, tap opens Editor → Task 6 + Task 11 (`handleOpenNote`/`handleNewNote`). ✓
- Editor: keyboard accessory toolbar → Task 5 (Editor prop) + Task 3 (`useKeyboardInset`) + Task 7. ✓
- Verse tooltip becomes tap → Task 5 Step 8 binds the hover handler to tap, gated on bottom placement (desktop untouched), with tests in Task 5. The note-link popup is already trigger-by-typing (`[[`) and its option buttons use `onMouseDown` (fires on touch), so it works on mobile as-is. Manual confirmation in Task 13 Step 4. ✓
- Lamplight view: segmented Today's Lamp | Connections → Task 8. ✓
- Glow-dot on Lamplight tab when active note has connections → Task 2 (rendering) + Task 4 (`useHasConnections`) + Task 11 (wiring). ✓
- More sheet (Backlinks/Info/Graph) reachable from tab and editor `⋯` → Task 9 + Task 11. ✓
- Offline banner → Task 11. ✓
- Search reuses `SearchDialog` via Cmd+K dispatch → Task 11 (`openSearch`). ✓
- Safe-area insets, ≥44px targets, `100dvh`/`fixed inset-0` shell → Tasks 2, 6, 11. ✓
- Journal themes preserved → `NotepadEditor` reused; theme logic untouched. ✓
- Tests incl. desktop regression guard → each task's tests + Task 12 Step 5 + Task 13. ✓

**Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N" — every step has concrete code or an exact command. The one deliberate scope reduction (Theme/Settings row in the More footer) is called out explicitly in Task 9, not left as a silent gap. ✓

**Type consistency:** `MobileTab` ('notes'|'editor'|'lamplight'|'more') is used identically in Tasks 1, 2, 11, 12. `Segmented<T>` generic signature matches its uses in Tasks 8 and 9. `MobileWorkspaceModel` fields produced in Task 10 match every field read in Task 11 (`lamplightAdapter`, `loadNeighborNotes`, `onAfterSave`, `openNote`, `createNote`, `activeNote`, `totalNoteCount`, `isOnline`, `user`). `NotepadEditor` props `toolbarPlacement`/`toolbarBottomOffset` defined in Task 5 match the call in Task 7. `useHasConnections` args in Task 4 match the call site in Task 11. ✓

---

## Notes / deliberate scope decisions

- **Lamplight wiring is duplicated** between `Notepad.tsx` (desktop) and `useMobileWorkspaceModel` to keep the desktop file's only change a rename. Extract a shared hook later if the two need to evolve together.
- **More-sheet footer** ships with online/offline status only; a Theme/Settings row is a follow-up (journal-theme selection already lives in the editor toolbar).
- **Glow-dot** runs `useConnectionCards` independently of the Connections strip (one extra lightweight pass). If profiling shows it matters, lift the connection state so the badge and the strip share one computation.
- **Graph** remains the existing deferred placeholder; no graph functionality is added.
