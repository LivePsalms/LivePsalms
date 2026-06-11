# Mobile Highlight Pill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On mobile, replace the Highlight toolbar button with a floating pill that appears just above the selection (after it settles) and shows highlight swatches inline.

**Architecture:** Mobile-only (`isBottomToolbar`). A debounce in the `selectionUpdate` handler waits ~250ms after the selection range stops changing, then sets a `pillAnchor`. A presentational `HighlightPill` component renders a fixed-position pill (remove ✕ chip + horizontal-scroll swatch row) at that anchor. Positioning math lives in `Editor.tsx` (it owns `editor`/`coordsAtPos`). Desktop's existing `HighlightSwatchPopover` auto-open path is untouched; `swatchAnchor` stays `null` on mobile.

**Tech Stack:** React 19, TipTap, Vitest + @testing-library/react (jsdom), `vi.useFakeTimers()` for the debounce.

**Spec:** `docs/superpowers/specs/2026-06-11-mobile-highlight-pill-design.md`

**Base `main` commit:** `9e545a9`

**Baseline note:** Repo ships known-red (~114 lint errors; tsc errors only in `force-sphere.test.ts`; pre-existing failing `Editor.toolbar-placement` + `garden-scene`). Goal is **zero NEW failures**, not a green repo. Do NOT extend `Editor.toolbar-placement.test.tsx`. Run individual test files with `npx vitest run <file>`.

---

### Task 1: Revert the dead `bottom?` anchor on `HighlightSwatchPopover`

Once the mobile toolbar button is removed (Task 3), only desktop uses this popover, top-anchored. The `bottom?` anchor (added last session in `b6c3bb0`) becomes dead code. Revert it and delete its test.

**Files:**
- Modify: `src/notepad/components/HighlightSwatchPopover.tsx`
- Delete: `src/notepad/components/HighlightSwatchPopover.anchor.test.tsx`

- [ ] **Step 1: Confirm nothing else relies on the `bottom?` field**

Run: `grep -rn "anchor.bottom\|bottom:" src/notepad/components/HighlightSwatchPopover.tsx`
Expected: only the two lines this task removes (the `Anchor` interface and the `style` object).

Also confirm no current caller passes `bottom` to this popover:
Run: `grep -rn "HighlightSwatchPopover" src/notepad --include=*.tsx -l`
Expected: `Editor.tsx` (desktop usage passes `swatchAnchor`, which is top-anchored on desktop) and the two test files. No mobile caller after Task 3.

- [ ] **Step 2: Restore the top-only `Anchor` interface**

In `src/notepad/components/HighlightSwatchPopover.tsx`, change:

```tsx
interface Anchor { top?: number; bottom?: number; left: number; }
```

to:

```tsx
interface Anchor { top: number; left: number; }
```

- [ ] **Step 3: Remove the `bottom` style line**

In the same file, in the root `<div>` `style` object, delete this line:

```tsx
        bottom: anchor.bottom,
```

(Leave `top: anchor.top,` and `left: anchor.left,` in place.)

- [ ] **Step 4: Delete the anchor test**

Run: `git rm src/notepad/components/HighlightSwatchPopover.anchor.test.tsx`

- [ ] **Step 5: Verify the popover still typechecks and its remaining test passes**

Run: `npx vitest run src/notepad/components/HighlightSwatchPopover` (any remaining popover test)
Expected: PASS (or "no test files found" if there were none besides the deleted anchor test — that's fine).

Run: `npx tsc --noEmit 2>&1 | grep HighlightSwatchPopover`
Expected: no output (no new type errors from this file).

- [ ] **Step 6: Commit**

```bash
git add src/notepad/components/HighlightSwatchPopover.tsx
git commit -m "refactor(notepad): revert dead bottom-anchor on highlight popover"
```

(The `git rm` from Step 4 is already staged.)

---

### Task 2: Create the `HighlightPill` component (TDD)

A self-contained, presentational mobile pill: remove ✕ chip + a horizontal-scroll row of highlight swatches. It consumes a ready-made anchor; no positioning math inside.

**Files:**
- Create: `src/notepad/components/HighlightPill.tsx`
- Test: `src/notepad/components/HighlightPill.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/notepad/components/HighlightPill.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HighlightPill } from './HighlightPill';
import type { StyleAsset } from '../styles/manifest';

const assets: StyleAsset[] = [
  { id: 'highlight-01', category: 'highlight', thumbUrl: '/styles/highlight/highlight-01.thumb.webp' } as StyleAsset,
  { id: 'highlight-02', category: 'highlight', thumbUrl: '/styles/highlight/highlight-02.thumb.webp' } as StyleAsset,
  { id: 'arrow-01', category: 'arrow', thumbUrl: '/styles/arrow/arrow-01.thumb.webp' } as StyleAsset,
];

afterEach(cleanup);

describe('HighlightPill', () => {
  it('renders only highlight swatches plus a remove chip', () => {
    const { getByLabelText, queryByLabelText } = render(
      <HighlightPill assets={assets} anchor={{ bottom: 100, left: 30 }} onPick={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()} />
    );
    expect(getByLabelText('Remove highlight')).not.toBeNull();
    expect(getByLabelText('Highlight highlight-01')).not.toBeNull();
    expect(getByLabelText('Highlight highlight-02')).not.toBeNull();
    expect(queryByLabelText('Highlight arrow-01')).toBeNull(); // non-highlight filtered out
  });

  it('calls onPick with the swatch id when a swatch is tapped', () => {
    const onPick = vi.fn();
    const { getByLabelText } = render(
      <HighlightPill assets={assets} anchor={{ bottom: 100, left: 30 }} onPick={onPick} onRemove={vi.fn()} onClose={vi.fn()} />
    );
    fireEvent.click(getByLabelText('Highlight highlight-01'));
    expect(onPick).toHaveBeenCalledWith('highlight-01');
  });

  it('calls onRemove when the remove chip is tapped', () => {
    const onRemove = vi.fn();
    const { getByLabelText } = render(
      <HighlightPill assets={assets} anchor={{ bottom: 100, left: 30 }} onPick={vi.fn()} onRemove={onRemove} onClose={vi.fn()} />
    );
    fireEvent.click(getByLabelText('Remove highlight'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('applies the anchor (bottom vs top) to the fixed container', () => {
    const { getByRole, rerender } = render(
      <HighlightPill assets={assets} anchor={{ bottom: 120, left: 30 }} onPick={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()} />
    );
    const elBottom = getByRole('dialog') as HTMLElement;
    expect(elBottom.style.position).toBe('fixed');
    expect(elBottom.style.bottom).toBe('120px');
    expect(elBottom.style.left).toBe('30px');

    rerender(
      <HighlightPill assets={assets} anchor={{ top: 80, left: 30 }} onPick={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()} />
    );
    const elTop = getByRole('dialog') as HTMLElement;
    expect(elTop.style.top).toBe('80px');
  });

  it('closes on an outside pointerdown', () => {
    const onClose = vi.fn();
    render(
      <HighlightPill assets={assets} anchor={{ bottom: 100, left: 30 }} onPick={vi.fn()} onRemove={vi.fn()} onClose={onClose} />
    );
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/notepad/components/HighlightPill.test.tsx`
Expected: FAIL — cannot resolve `./HighlightPill` / `HighlightPill is not defined`.

- [ ] **Step 3: Write the component**

Create `src/notepad/components/HighlightPill.tsx`:

```tsx
// src/notepad/components/HighlightPill.tsx
import { useEffect, useRef } from 'react';
import { filterAssets, type StyleAsset } from '../styles/manifest';

interface Anchor { top?: number; bottom?: number; left: number; }

interface Props {
  assets: StyleAsset[];
  anchor: Anchor;
  onPick: (swatchId: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

// Mobile-only floating pill, rendered just above (or below) the settled
// selection. Presentational: it consumes a ready-made anchor; positioning math
// lives in the editor. A single horizontal-scrolling row: remove chip + swatches.
export function HighlightPill({ assets, anchor, onPick, onRemove, onClose }: Props) {
  const shown = filterAssets(assets, 'highlight', '');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Highlight swatches"
      className="scrollbar-hide"
      style={{
        position: 'fixed',
        top: anchor.top,
        bottom: anchor.bottom,
        left: anchor.left,
        zIndex: 60,
        maxWidth: 'calc(100vw - 16px)',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        background: '#fff',
        border: '1px solid var(--pale-stone)',
        borderRadius: 9,
        boxShadow: '0 8px 22px rgba(0,0,0,.16)',
        padding: 6,
        overflowX: 'auto',
      }}
    >
      <button
        aria-label="Remove highlight"
        onClick={onRemove}
        style={{ flex: '0 0 auto', height: 28, width: 28, border: '1px solid var(--pale-stone)', borderRadius: 6, background: '#fff', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--silica)' }}
      >
        ✕
      </button>
      {shown.map((a) => (
        <button
          key={a.id}
          aria-label={`Highlight ${a.id}`}
          onClick={() => onPick(a.id)}
          style={{ flex: '0 0 auto', height: 28, width: 36, border: '1px solid var(--pale-stone)', borderRadius: 6, overflow: 'hidden', background: '#fff', cursor: 'pointer', padding: 0 }}
        >
          <img src={a.thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/notepad/components/HighlightPill.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/HighlightPill.tsx src/notepad/components/HighlightPill.test.tsx
git commit -m "feat(notepad): add HighlightPill component (mobile swatch pill)"
```

---

### Task 3: Wire the pill into the editor; remove the toolbar button (TDD)

Replace the toolbar-button behavior in `Editor.tsx` with the debounced pill. Test-first: rewrite `Editor.mobile-highlight.test.tsx` to assert the new behavior, watch it fail, then implement.

**Files:**
- Replace test: `src/notepad/components/Editor.mobile-highlight.test.tsx`
- Modify: `src/notepad/components/Editor.tsx`
  - Imports (top of file).
  - State/refs block (currently lines 108–125).
  - `selectionUpdate` effect (currently lines 127–161).
  - Toolbar button block (currently lines 433–443).
  - Render area near the existing popover (currently lines 729–746).

- [ ] **Step 1: Rewrite the test to assert pill behavior (failing)**

Replace the entire contents of `src/notepad/components/Editor.mobile-highlight.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Editor mock that captures event handlers so tests can drive selectionUpdate,
// and exposes a mutable selection. coordsAtPos drives pill positioning.
const handlers: Record<string, Array<() => void>> = {};
const setStyleHighlight = vi.fn(() => ({ run() {} }));
const unsetStyleHighlight = vi.fn(() => ({ run() {} }));
const fakeEditor = {
  state: { selection: { from: 0, to: 0 } },
  view: { coordsAtPos: () => ({ top: 200, bottom: 220, left: 30, right: 40 }) },
  on: (event: string, cb: () => void) => {
    (handlers[event] ||= []).push(cb);
  },
  off: (event: string, cb: () => void) => {
    handlers[event] = (handlers[event] || []).filter((h) => h !== cb);
  },
  chain: () => ({
    focus: () => ({
      setStyleHighlight, unsetStyleHighlight,
      undo: () => ({ run() {} }), redo: () => ({ run() {} }),
      toggleHeading: () => ({ run() {} }), setParagraph: () => ({ run() {} }),
    }),
  }),
  can: () => ({ undo: () => true, redo: () => true }),
  isActive: () => false,
  commands: { focus: () => {} },
};

function fireSelection(from: number, to: number) {
  fakeEditor.state.selection = { from, to };
  // React 19 only flushes state updates triggered inside act(); the editor's
  // selectionUpdate listener is invoked directly here, so wrap it.
  act(() => {
    (handlers.selectionUpdate || []).forEach((h) => h());
  });
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
vi.mock('./HighlightSwatchPopover', () => ({ HighlightSwatchPopover: () => <div data-testid="swatch-popover" /> }));
// Render a visible, interactive marker so the pill's presence + pick/remove are assertable.
vi.mock('./HighlightPill', () => ({
  HighlightPill: ({ onPick, onRemove }: { onPick: (id: string) => void; onRemove: () => void }) => (
    <div data-testid="highlight-pill">
      <button data-testid="pill-swatch" onClick={() => onPick('highlight-01')}>pick</button>
      <button data-testid="pill-remove" onClick={onRemove}>remove</button>
    </div>
  ),
}));

import { NotepadEditor } from './Editor';

afterEach(() => {
  cleanup();
  setStyleHighlight.mockClear();
  unsetStyleHighlight.mockClear();
  vi.useRealTimers();
});

describe('NotepadEditor mobile highlight pill', () => {
  it('does NOT show the pill immediately on selection; shows it after the settle debounce', () => {
    vi.useFakeTimers();
    const { queryByTestId } = render(<NotepadEditor toolbarPlacement="bottom" />);
    fireSelection(2, 8);
    expect(queryByTestId('highlight-pill')).toBeNull(); // not yet — still "moving"
    act(() => { vi.advanceTimersByTime(250); });
    expect(queryByTestId('highlight-pill')).not.toBeNull(); // settled
  });

  it('hides the pill when the selection collapses', () => {
    vi.useFakeTimers();
    const { queryByTestId } = render(<NotepadEditor toolbarPlacement="bottom" />);
    fireSelection(2, 8);
    act(() => { vi.advanceTimersByTime(250); });
    expect(queryByTestId('highlight-pill')).not.toBeNull();
    fireSelection(5, 5);
    expect(queryByTestId('highlight-pill')).toBeNull();
  });

  it('applies a highlight via setStyleHighlight when a pill swatch is tapped', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(<NotepadEditor toolbarPlacement="bottom" />);
    fireSelection(2, 8);
    act(() => { vi.advanceTimersByTime(250); });
    act(() => { fireEvent.click(getByTestId('pill-swatch')); });
    expect(setStyleHighlight).toHaveBeenCalledWith('highlight-01');
  });

  it('removes a highlight via unsetStyleHighlight when the pill remove chip is tapped', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(<NotepadEditor toolbarPlacement="bottom" />);
    fireSelection(2, 8);
    act(() => { vi.advanceTimersByTime(250); });
    act(() => { fireEvent.click(getByTestId('pill-remove')); });
    expect(unsetStyleHighlight).toHaveBeenCalled();
  });

  it('renders no Highlight toolbar button on mobile', () => {
    const { container } = render(<NotepadEditor toolbarPlacement="bottom" />);
    expect(container.querySelector('[title="Highlight"]')).toBeNull();
  });

  it('does not show the pill on desktop and keeps the auto-open popover', () => {
    const { queryByTestId } = render(<NotepadEditor />);
    fireSelection(2, 8);
    expect(queryByTestId('highlight-pill')).toBeNull();
    expect(queryByTestId('swatch-popover')).not.toBeNull(); // desktop unchanged
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/notepad/components/Editor.mobile-highlight.test.tsx`
Expected: FAIL — the pill never renders (no `highlight-pill` testid), and the `[title="Highlight"]` button still exists. (Failures confirm the wiring isn't there yet.)

- [ ] **Step 3: Add the `HighlightPill` import**

In `src/notepad/components/Editor.tsx`, just after the existing `HighlightSwatchPopover` import (line 20):

```tsx
import { HighlightSwatchPopover } from './HighlightSwatchPopover';
import { HighlightPill } from './HighlightPill';
```

- [ ] **Step 4: Replace the mobile state/refs and the `openHighlightSwatch` handler**

In `src/notepad/components/Editor.tsx`, replace this block (currently lines 113–125):

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

with:

```tsx
  // Mobile-only highlight pill, shown just above the selection once it settles.
  const [pillAnchor, setPillAnchor] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const pillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillRangeRef = useRef<{ from: number; to: number } | null>(null);
  const PILL_SETTLE_MS = 250;
  const PILL_TOP_MARGIN = 56; // if the selection sits this close to the top, flip the pill below it
```

- [ ] **Step 5: Replace the mobile branch of the `selectionUpdate` effect with the debounce**

In the same file, in the `selectionUpdate` `update` function, replace the mobile branch (currently lines 131–142):

```tsx
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
```

with:

```tsx
      if (isBottomToolbar) {
        // Mobile: never show the pill mid-drag. Hide while the range is moving,
        // then reveal ~250ms after it settles. Recompute the anchor on fire.
        if (from === to) {
          if (pillTimerRef.current) { clearTimeout(pillTimerRef.current); pillTimerRef.current = null; }
          pillRangeRef.current = null;
          setPillAnchor(null);
          return;
        }
        const prev = pillRangeRef.current;
        if (prev && prev.from === from && prev.to === to) return; // unchanged → no-op, avoid flicker
        pillRangeRef.current = { from, to };
        setPillAnchor(null);
        if (pillTimerRef.current) clearTimeout(pillTimerRef.current);
        pillTimerRef.current = setTimeout(() => {
          const coords = editor.view.coordsAtPos(from);
          const left = Math.max(8, Math.min(coords.left, window.innerWidth - 8));
          const anchor = coords.top < PILL_TOP_MARGIN
            ? { top: coords.bottom + 6, left }                       // near top → below
            : { bottom: window.innerHeight - coords.top + 6, left }; // default → above
          setPillAnchor(anchor);
        }, PILL_SETTLE_MS);
        return;
      }
```

- [ ] **Step 6: Clear the pill timer in the effect cleanup**

In the same `useEffect`, replace the return/cleanup (currently line 160):

```tsx
    editor.on('selectionUpdate', update);
    return () => { editor.off('selectionUpdate', update); };
```

with:

```tsx
    editor.on('selectionUpdate', update);
    return () => {
      editor.off('selectionUpdate', update);
      if (pillTimerRef.current) { clearTimeout(pillTimerRef.current); pillTimerRef.current = null; }
    };
```

- [ ] **Step 7: Remove the mobile Highlight toolbar button**

In the same file, delete this entire block (currently lines 433–444):

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

- [ ] **Step 8: Render the pill**

In the same file, immediately after the closing `)}` of the existing `{editor && swatchAnchor && !swatchDismissed && ( … )}` popover block (the block currently ending around line 746), add:

```tsx
      {editor && isBottomToolbar && pillAnchor && (
        <HighlightPill
          assets={STYLE_ASSETS}
          anchor={pillAnchor}
          onPick={(id) => {
            editor.chain().focus().setStyleHighlight(id).run();
            setPillAnchor(null);
          }}
          onRemove={() => {
            editor.chain().focus().unsetStyleHighlight().run();
            setPillAnchor(null);
          }}
          onClose={() => setPillAnchor(null)}
        />
      )}
```

- [ ] **Step 9: Remove the now-unused `Highlighter` icon import if nothing else uses it**

Run: `grep -n "Highlighter" src/notepad/components/Editor.tsx`
Expected after Step 7: only the lucide import line remains. If so, remove `Highlighter` from that import. If `Highlighter` appears elsewhere, leave the import.

- [ ] **Step 10: Run the mobile-highlight test to verify it passes**

Run: `npx vitest run src/notepad/components/Editor.mobile-highlight.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 11: Verify no new type errors and no new failing tests in touched files**

Run: `npx tsc --noEmit 2>&1 | grep -E "Editor.tsx|HighlightPill|HighlightSwatchPopover"`
Expected: no output (the only known tsc errors are in `force-sphere.test.ts`).

Run: `npx vitest run src/notepad/components/HighlightPill.test.tsx src/notepad/components/Editor.mobile-highlight.test.tsx`
Expected: PASS (all).

- [ ] **Step 12: Commit**

```bash
git add src/notepad/components/Editor.tsx src/notepad/components/Editor.mobile-highlight.test.tsx
git commit -m "feat(notepad): mobile highlight pill near selection (replaces toolbar button)"
```

---

### Task 4: Manual verification + finish (optional but recommended)

jsdom can't fully cover settle timing or on-screen positioning. Verify in a real mobile viewport, then integrate the branch.

**Files:** none (verification only).

- [ ] **Step 1: Run the dev server**

Use the project's `/run` flow (or `npm run dev`) and open `/notepad/notes` (signed-out local mode works).

- [ ] **Step 2: Verify at 375px (mobile)**

In DevTools device mode at 375px:
- Select text with a touch-drag → the pill does **not** appear mid-drag.
- Release → ~250ms later the pill appears just above the selection.
- The swatch row scrolls horizontally; tapping a swatch applies the highlight; the ✕ chip removes it.
- Tapping outside dismisses the pill.
- Select text near the very top of the viewport → the pill flips to **below** the selection.

- [ ] **Step 3: Verify desktop is unchanged**

At a desktop width, select text → the existing `HighlightSwatchPopover` still auto-opens at the selection; no pill appears.

- [ ] **Step 4: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to merge to `main` and push (the user's standard flow).

---

## Self-Review

**Spec coverage:**
- Settle-not-drag debounce → Task 3 Steps 4–6. ✓
- Range-unchanged no-op → Task 3 Step 5 (`prev.from === from && prev.to === to` → return). ✓
- Collapse hides → Task 3 Step 5 (`from === to` branch) + test in Step 1. ✓
- Pill content (✕ chip + horizontal-scroll swatch row, no search) → Task 2. ✓
- Apply/remove via `setStyleHighlight`/`unsetStyleHighlight` → Task 3 Step 8 + tests. ✓
- Outside-pointerdown dismiss → Task 2 (component effect) + test. ✓
- Positioning above default / below fallback / clamp left → Task 3 Step 5. ✓
- Remove toolbar button + unused `hasSelection`/`highlightBtnRef`/`openHighlightSwatch` → Task 3 Steps 4 & 7. ✓
- Desktop byte-for-byte unchanged; `swatchAnchor` stays null on mobile → desktop branch untouched, mobile branch never sets `swatchAnchor`; test asserts popover still auto-opens on desktop. ✓
- Revert dead `bottom?` anchor + delete anchor test → Task 1. ✓
- Replace `Editor.mobile-highlight.test.tsx` with pill tests using fake timers → Task 3 Step 1. ✓
- Don't extend `Editor.toolbar-placement.test.tsx` → not touched. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output. ✓

**Type consistency:** `pillAnchor`/`setPillAnchor`, `pillTimerRef`, `pillRangeRef`, `PILL_SETTLE_MS`, `PILL_TOP_MARGIN` used consistently across Task 3 steps. `HighlightPill` props (`assets`, `anchor`, `onPick`, `onRemove`, `onClose`) match between Task 2 (definition) and Task 3 Step 8 (usage). `setStyleHighlight(id)` / `unsetStyleHighlight()` signatures match the editor chain mock and the real desktop usage. ✓
