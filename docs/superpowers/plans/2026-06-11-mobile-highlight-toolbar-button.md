# Mobile Highlight Toolbar Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the mobile notepad editor, stop the highlight swatch popover from auto-opening mid-selection; instead add a Highlight button to the bottom toolbar that opens the picker for the current selection. Desktop is unchanged.

**Architecture:** Branch the existing `selectionUpdate` effect on `isBottomToolbar`. Desktop keeps the auto-open path verbatim. Mobile only tracks a `hasSelection` flag (and closes the picker when the selection collapses) — it never opens the popover. A new mobile-only `Highlighter` toolbar button opens the popover anchored *above* the bottom toolbar via a new optional `bottom` field on the popover's anchor.

**Tech Stack:** React, TipTap (ProseMirror), lucide-react icons, Vitest + @testing-library/react (jsdom).

---

## File Structure

- **Modify** `src/notepad/components/HighlightSwatchPopover.tsx` — widen `Anchor` to allow bottom-anchoring; apply `bottom` in the style.
- **Modify** `src/notepad/components/Editor.tsx` — branch the `selectionUpdate` effect, add `hasSelection` state, add the mobile Highlight button + its open handler, widen the `swatchAnchor` state type, import `Highlighter`.
- **Create** `src/notepad/components/HighlightSwatchPopover.anchor.test.tsx` — unit test for bottom-anchoring.
- **Create** `src/notepad/components/Editor.mobile-highlight.test.tsx` — behavior tests (mobile no-auto-open, button enable/disable, click opens, collapse closes; desktop regression).

---

## Task 1: Bottom-anchoring support in HighlightSwatchPopover

**Files:**
- Modify: `src/notepad/components/HighlightSwatchPopover.tsx:5` (Anchor interface) and `:80-84` (style block)
- Test: `src/notepad/components/HighlightSwatchPopover.anchor.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/notepad/components/HighlightSwatchPopover.anchor.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HighlightSwatchPopover } from './HighlightSwatchPopover';

// The manifest helper filters assets by category/query; stub to an empty list
// so the test focuses purely on positioning.
vi.mock('../styles/manifest', () => ({
  filterAssets: () => [],
}));

afterEach(cleanup);

const baseProps = {
  assets: [],
  query: '',
  onQueryChange: vi.fn(),
  onPick: vi.fn(),
  onRemove: vi.fn(),
  onClose: vi.fn(),
  autoFocus: false,
};

describe('HighlightSwatchPopover anchoring', () => {
  it('top-anchors when given a top coordinate (desktop)', () => {
    const { getByRole } = render(
      <HighlightSwatchPopover {...baseProps} anchor={{ top: 120, left: 40 }} />,
    );
    const dialog = getByRole('dialog') as HTMLElement;
    expect(dialog.style.top).toBe('120px');
    expect(dialog.style.bottom).toBe('');
    expect(dialog.style.left).toBe('40px');
  });

  it('bottom-anchors when given a bottom coordinate (mobile)', () => {
    const { getByRole } = render(
      <HighlightSwatchPopover {...baseProps} anchor={{ bottom: 80, left: 40 }} />,
    );
    const dialog = getByRole('dialog') as HTMLElement;
    expect(dialog.style.bottom).toBe('80px');
    expect(dialog.style.top).toBe('');
    expect(dialog.style.left).toBe('40px');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/components/HighlightSwatchPopover.anchor.test.tsx`
Expected: FAIL — the bottom-anchor test fails because `Anchor` has no `bottom` and the style never sets `bottom` (also a TS error that `bottom`/optional `top` is not assignable).

- [ ] **Step 3: Widen the Anchor interface**

In `src/notepad/components/HighlightSwatchPopover.tsx`, replace the interface at line 5:

```tsx
interface Anchor { top?: number; bottom?: number; left: number; }
```

- [ ] **Step 4: Apply `bottom` in the style block**

In the same file, in the root `<div>` style (around lines 80-84), add the `bottom` line next to `top`:

```tsx
      style={{
        position: 'fixed',
        top: anchor.top,
        bottom: anchor.bottom,
        left: anchor.left,
        zIndex: 60,
        width: 200,
        background: '#fff',
        border: '1px solid var(--pale-stone)',
        borderRadius: 9,
        boxShadow: '0 8px 22px rgba(0,0,0,.16)',
        padding: 8,
      }}
```

(When `top` is `undefined` React omits it, so `bottom` governs; desktop still passes `top` only.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/notepad/components/HighlightSwatchPopover.anchor.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```bash
git add src/notepad/components/HighlightSwatchPopover.tsx src/notepad/components/HighlightSwatchPopover.anchor.test.tsx
git commit -m "feat(notepad): allow bottom-anchoring the highlight swatch popover"
```

---

## Task 2: Mobile selection-tracking + Highlight toolbar button

**Files:**
- Modify: `src/notepad/components/Editor.tsx` — import (`:4-18`), `swatchAnchor` state type (`:105`), new `hasSelection` state + `highlightBtnRef` + `openHighlightSwatch` (near `:105-132`), effect split (`:111-132`), button JSX (before `:405`)
- Test: `src/notepad/components/Editor.mobile-highlight.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/notepad/components/Editor.mobile-highlight.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Editor mock that captures event handlers so tests can drive selectionUpdate,
// and exposes a mutable selection. coordsAtPos is needed for the desktop branch.
const handlers: Record<string, Array<() => void>> = {};
const fakeEditor = {
  state: { selection: { from: 0, to: 0 } },
  view: { coordsAtPos: () => ({ top: 10, bottom: 20, left: 30, right: 40 }) },
  on: (event: string, cb: () => void) => {
    (handlers[event] ||= []).push(cb);
  },
  off: (event: string, cb: () => void) => {
    handlers[event] = (handlers[event] || []).filter((h) => h !== cb);
  },
  chain: () => ({ focus: () => ({ setStyleHighlight: () => ({ run() {} }), unsetStyleHighlight: () => ({ run() {} }), undo: () => ({ run() {} }), redo: () => ({ run() {} }), toggleHeading: () => ({ run() {} }), setParagraph: () => ({ run() {} }) }) }),
  can: () => ({ undo: () => true, redo: () => true }),
  isActive: () => false,
  commands: { focus: () => {} },
};

function fireSelection(from: number, to: number) {
  fakeEditor.state.selection = { from, to };
  (handlers.selectionUpdate || []).forEach((h) => h());
}

vi.mock('../context/useNoteCollection', () => ({
  useNoteCollection: () => ({
    notes: [],
    activeNote: { id: 'n1', title: 'T', createdAt: new Date().toISOString(), tags: [] },
    collection: { openNote: vi.fn() },
  }),
}));
vi.mock('../context/useNotepadActions', () => ({ useNotepadActions: () => ({ updateNote: vi.fn() }) }));
vi.mock('../context/useReferenceGraph', () => ({ useReferenceGraph: () => ({ graph: null }) }));
vi.mock('../editor/use-note-editor', () => ({ useNoteEditor: () => ({ editor: fakeEditor }) }));
vi.mock('../editor/use-note-link-popup', () => ({
  useNoteLinkPopup: () => ({ popup: null, search: '', setSearch: vi.fn(), filteredNotes: [], dismiss: vi.fn(), insert: vi.fn() }),
}));
vi.mock('../editor/use-verse-tooltip', () => ({
  useVerseTooltip: () => ({ tooltip: null, onMouseOver: vi.fn(), onMouseOut: vi.fn() }),
}));
vi.mock('@tiptap/react', () => ({ EditorContent: () => <div data-testid="editor-content" /> }));
vi.mock('../../auth/context/useAccountProfile', () => ({ useAccountProfile: () => ({ profile: null }) }));
vi.mock('../decorations/DecorationLayer', () => ({ DecorationLayer: () => null }));
vi.mock('../decorations/useDecorations', () => ({ useDecorations: () => ({ decorations: [], applyDecoration: vi.fn() }) }));
vi.mock('../decorations/DecorationTray', () => ({ DecorationTray: () => null }));
// Render a visible marker so presence of the popover is assertable.
vi.mock('./HighlightSwatchPopover', () => ({ HighlightSwatchPopover: () => <div data-testid="swatch-popover" /> }));

import { NotepadEditor } from './Editor';

afterEach(cleanup);

describe('NotepadEditor mobile highlight button', () => {
  it('does NOT auto-open the popover on a non-empty selection (mobile)', () => {
    const { queryByTestId } = render(<NotepadEditor toolbarPlacement="bottom" />);
    fireSelection(2, 8);
    expect(queryByTestId('swatch-popover')).toBeNull();
  });

  it('disables the Highlight button with no selection and enables it with one', () => {
    const { container } = render(<NotepadEditor toolbarPlacement="bottom" />);
    const btn = container.querySelector('[title="Highlight"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(true);
    fireSelection(2, 8);
    expect(btn.disabled).toBe(false);
  });

  it('opens the popover when the Highlight button is tapped', () => {
    const { container, queryByTestId } = render(<NotepadEditor toolbarPlacement="bottom" />);
    fireSelection(2, 8);
    fireEvent.click(container.querySelector('[title="Highlight"]') as HTMLElement);
    expect(queryByTestId('swatch-popover')).not.toBeNull();
  });

  it('closes the popover when the selection collapses', () => {
    const { container, queryByTestId } = render(<NotepadEditor toolbarPlacement="bottom" />);
    fireSelection(2, 8);
    fireEvent.click(container.querySelector('[title="Highlight"]') as HTMLElement);
    expect(queryByTestId('swatch-popover')).not.toBeNull();
    fireSelection(5, 5);
    expect(queryByTestId('swatch-popover')).toBeNull();
  });

  it('still auto-opens on the desktop toolbar and renders no Highlight button', () => {
    const { container, queryByTestId } = render(<NotepadEditor />);
    expect(container.querySelector('[title="Highlight"]')).toBeNull();
    fireSelection(2, 8);
    expect(queryByTestId('swatch-popover')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/components/Editor.mobile-highlight.test.tsx`
Expected: FAIL — there is no `[title="Highlight"]` button (mobile tests fail to find it), and the mobile branch currently auto-opens (the first test fails because the popover renders). Desktop test should already pass.

- [ ] **Step 3: Import the Highlighter icon**

In `src/notepad/components/Editor.tsx`, add `Highlighter` to the lucide-react import (lines 4-18):

```tsx
import {
  Undo2,
  Redo2,
  Heading,
  List,
  ListOrdered,
  Quote,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Underline as UnderlineIcon,
  ChevronDown,
  Sparkles,
  Highlighter,
} from 'lucide-react';
```

- [ ] **Step 4: Widen the swatchAnchor state type and add mobile state/refs**

In `src/notepad/components/Editor.tsx`, change the `swatchAnchor` state declaration (line 105) to allow bottom-anchoring:

```tsx
  const [swatchAnchor, setSwatchAnchor] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
```

Then, immediately after the existing `dismissedRangeRef` declaration (line 109), add the mobile selection flag, the button ref, and the open handler:

```tsx
  const [hasSelection, setHasSelection] = useState(false);
  const highlightBtnRef = useRef<HTMLDivElement>(null);

  // Mobile-only: open the swatch picker for the current selection, docked above
  // the bottom toolbar. autoFocus stays off so the soft keyboard doesn't pop.
  const openHighlightSwatch = () => {
    const el = highlightBtnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSwatchAnchor({ bottom: window.innerHeight - r.top + 6, left: r.left });
    setSwatchDismissed(false);
    setSwatchAutoFocus(false);
  };
```

- [ ] **Step 5: Branch the selectionUpdate effect on mobile**

Replace the entire effect at lines 111-132 with the branched version. The desktop branch is the original body verbatim; the mobile branch only tracks selection and closes on collapse:

```tsx
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const { from, to } = editor.state.selection;
      if (isBottomToolbar) {
        // Mobile: never auto-open. Track selection for the toolbar button and
        // close the picker if the selection collapses.
        const selected = from !== to;
        setHasSelection(selected);
        if (!selected) {
          setSwatchAnchor(null);
          setSwatchDismissed(false);
          dismissedRangeRef.current = null;
        }
        return;
      }
      // Desktop: unchanged auto-open behavior.
      if (from === to) {
        setSwatchAnchor(null);
        setSwatchDismissed(false);
        dismissedRangeRef.current = null;
        return;
      }
      const start = editor.view.coordsAtPos(from);
      setSwatchAnchor({ top: start.bottom + 6, left: start.left });
      setSwatchAutoFocus(lastInteractionRef.current === 'pointer');
      const dismissed = dismissedRangeRef.current;
      if (!dismissed || dismissed.from !== from || dismissed.to !== to) {
        setSwatchDismissed(false);
        dismissedRangeRef.current = null;
      }
    };
    editor.on('selectionUpdate', update);
    return () => { editor.off('selectionUpdate', update); };
  }, [editor, isBottomToolbar]);
```

- [ ] **Step 6: Add the mobile Highlight button to the toolbar**

In `src/notepad/components/Editor.tsx`, immediately before the Decorate button (line 405, `<ToolbarButton onClick={() => setTrayOpen(...`), insert the mobile-only Highlight button wrapped in a ref'd div (the ref gives `openHighlightSwatch` the button's rect):

```tsx
          {isBottomToolbar && (
            <div ref={highlightBtnRef} className="relative">
              <ToolbarButton
                onClick={openHighlightSwatch}
                disabled={!(hasSelection || editor.isActive('styleHighlight'))}
                title="Highlight"
                mobile={isBottomToolbar}
              >
                <Highlighter size={15} />
              </ToolbarButton>
            </div>
          )}
```

- [ ] **Step 7: Run the new test to verify it passes**

Run: `npx vitest run src/notepad/components/Editor.mobile-highlight.test.tsx`
Expected: PASS (all 5 cases).

- [ ] **Step 8: Run the existing mobile-scroll test for regressions**

Run: `npx vitest run src/notepad/components/Editor.mobile-scroll.test.tsx`
Expected: PASS (unchanged — confirms the toolbar/heading-portal behavior still holds).

- [ ] **Step 9: Commit**

```bash
git add src/notepad/components/Editor.tsx src/notepad/components/Editor.mobile-highlight.test.tsx
git commit -m "feat(notepad): mobile highlight via toolbar button (no mid-drag popover)"
```

---

## Task 3: Manual verification

**Files:** none (manual QA against the running app).

- [ ] **Step 1: Start the dev server (if not already running)**

Run: `npm run dev`
Expected: Vite serves on `http://localhost:5173`.

- [ ] **Step 2: Verify mobile selection no longer fights the user**

In Chrome DevTools (MCP or manual) at a 375px viewport, open `/notepad/notes` (signed-out local mode), create a note via the FAB → "General", type a sentence. Touch-drag-select across multiple words.
Expected: NO swatch popover appears during the drag; the selection extends freely. The bottom-toolbar Highlight button (highlighter icon) is enabled once text is selected. Tapping it opens the swatch grid docked ABOVE the toolbar, not over the text. Picking a swatch applies the highlight to the selection. Collapsing the selection (tap elsewhere) closes the picker.

- [ ] **Step 3: Verify desktop is unchanged**

At a desktop viewport (top toolbar), select text with the mouse.
Expected: the swatch popover still auto-opens at the selection start exactly as before; there is NO Highlight button in the top toolbar.

---

## Self-Review notes

- **Spec coverage:** Section 1 (behavior split) → Task 2 Step 5. Section 2 (mobile button: enable rule, tap handler, bottom-anchor, autoFocus off) → Task 2 Steps 4/6. Section 3 (popover `bottom` prop) → Task 1. Section 4 (testing, mobile + desktop regression) → Tasks 1-2 tests + Task 3 manual. All covered.
- **Type consistency:** `swatchAnchor` state type (`{ top?; bottom?; left }`) matches the popover `Anchor` interface (`{ top?; bottom?; left }`); `openHighlightSwatch`, `hasSelection`, `highlightBtnRef` names are used consistently across steps.
- **Baseline:** goal is ZERO new failures vs. the known-red baseline (~114 lint errors, tsc errors only in `force-sphere.test.ts`, pre-existing failing `Editor.toolbar-placement` and `garden-scene`). Do not extend the stale `Editor.toolbar-placement.test.tsx`.
