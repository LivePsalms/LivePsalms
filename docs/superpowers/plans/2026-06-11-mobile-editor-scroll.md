# Mobile Notepad Editor Scroll Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On mobile, make the notepad writing pad fit within the screen and scroll vertically only, and make the formatting toolbar scroll horizontally so every button is reachable.

**Architecture:** The shared TipTap editor renders as a flex column whose width equals its widest child. A fixed-width, non-wrapping toolbar (~430px) inflates the column past a phone viewport (~375px), dragging the writing pad off-screen. We constrain the editor column to the viewport, give the toolbar `overflow-x: auto` so it scrolls instead of inflating the column, clamp the writing pad to `overflow-x: hidden`, reduce mobile side padding, and portal the heading dropdown so the toolbar's scroll clip doesn't cut it off. All changes gate on `isBottomToolbar` (the mobile path); desktop is untouched.

**Tech Stack:** React + TypeScript, TipTap, Vitest + @testing-library/react (jsdom), `react-dom` `createPortal`. Existing `.scrollbar-hide` utility lives in `src/index.css:176`.

---

## File Structure

- **Modify:** `src/notepad/components/Editor.tsx`
  - Root flex container (~line 203): clamp width on mobile.
  - Toolbar container (~line 206): `overflow-x: auto` + `scrollbar-hide` on mobile.
  - Heading dropdown trigger wrapper + menu (~lines 240–277): ref + portal on mobile.
  - Scroll content area (~line 348): `overflow-x: hidden`, reduced mobile padding, `data-testid`.
  - `ToolbarButton` (~line 667) and `ToolbarDivider` (~line 697): `flex-shrink: 0`.
- **Create:** `src/notepad/components/Editor.mobile-scroll.test.tsx`
  - New test file with a complete `fakeEditor` mock (the existing `Editor.toolbar-placement.test.tsx` mock is stale — it lacks `editor.on`/`off` — so we do NOT extend it).

**Note on the existing baseline:** `Editor.toolbar-placement.test.tsx` and `garden-scene` already fail before this work (documented pre-existing red baseline). Our goal is to add ZERO new failures, not to make the whole repo green. Our new test file must pass on its own.

---

### Task 1: Toolbar scrolls horizontally; buttons don't shrink (mobile only)

**Files:**
- Create: `src/notepad/components/Editor.mobile-scroll.test.tsx`
- Modify: `src/notepad/components/Editor.tsx` (toolbar container ~206, `ToolbarButton` ~667, `ToolbarDivider` ~697)

- [ ] **Step 1: Write the failing test**

Create `src/notepad/components/Editor.mobile-scroll.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Complete editor mock — includes on/off (the stale toolbar-placement mock omits these).
const fakeEditor = {
  on: () => {},
  off: () => {},
  chain: () => ({
    focus: () => ({
      undo: () => ({ run() {} }),
      redo: () => ({ run() {} }),
      toggleHeading: () => ({ run() {} }),
      setParagraph: () => ({ run() {} }),
    }),
  }),
  can: () => ({ undo: () => true, redo: () => true }),
  isActive: () => false,
  commands: { focus: () => {} },
};
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

import { NotepadEditor } from './Editor';

afterEach(cleanup);

describe('NotepadEditor mobile toolbar scroll', () => {
  it('makes the bottom toolbar horizontally scrollable', () => {
    const { container } = render(<NotepadEditor toolbarPlacement="bottom" />);
    const bar = container.querySelector('[data-toolbar-placement="bottom"]') as HTMLElement;
    expect(bar.style.overflowX).toBe('auto');
    expect(bar.style.minWidth).toBe('0px');
    expect(bar.className).toContain('scrollbar-hide');
  });

  it('does NOT add horizontal scroll to the top (desktop) toolbar', () => {
    const { container } = render(<NotepadEditor />);
    const bar = container.querySelector('[data-toolbar-placement="top"]') as HTMLElement;
    expect(bar.style.overflowX).toBe('');
    expect(bar.className).not.toContain('scrollbar-hide');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/notepad/components/Editor.mobile-scroll.test.tsx`
Expected: FAIL — `bar.style.overflowX` is `''`, not `'auto'` (toolbar has no overflow styles yet).

- [ ] **Step 3: Add overflow + scrollbar-hide to the toolbar (mobile only)**

In `src/notepad/components/Editor.tsx`, the toolbar opening div (~line 206). Change the `className` and add two style props:

```tsx
        <div
          data-toolbar-placement={toolbarPlacement}
          className={`shrink-0 flex items-center gap-0.5 px-3${isBottomToolbar ? ' scrollbar-hide' : ''}`}
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
            minWidth: isBottomToolbar ? 0 : undefined,
            overflowX: isBottomToolbar ? 'auto' : undefined,
          }}
        >
```

- [ ] **Step 4: Make toolbar buttons and dividers not shrink**

In `ToolbarButton` (~line 674), add `flexShrink: 0` to the button style object (so fixed-width buttons keep their width inside the scroll strip instead of squishing):

```tsx
      style={{
        width: 30,
        height: 28,
        flexShrink: 0,
        cursor: disabled ? 'default' : 'pointer',
        background: active ? 'rgba(188, 179, 163, 0.35)' : 'transparent',
        color: disabled ? 'var(--pale-stone)' : active ? 'var(--charred)' : 'var(--deep-umber)',
        border: 'none',
        opacity: disabled ? 0.4 : 1,
      }}
```

In `ToolbarDivider` (~line 700), add `flexShrink: 0`:

```tsx
      style={{
        width: 1,
        height: 20,
        flexShrink: 0,
        background: 'var(--pale-stone)',
        margin: '0 4px',
        alignSelf: 'center',
      }}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/notepad/components/Editor.mobile-scroll.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/notepad/components/Editor.tsx src/notepad/components/Editor.mobile-scroll.test.tsx
git commit -m "fix(notepad): horizontally scroll mobile editor toolbar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Writing pad clamps to screen, scrolls vertical-only, tighter mobile padding

**Files:**
- Modify: `src/notepad/components/Editor.tsx` (root container ~203, scroll area ~348)
- Test: `src/notepad/components/Editor.mobile-scroll.test.tsx`

- [ ] **Step 1: Write the failing test**

Append these two tests inside the `describe(...)` block in `Editor.mobile-scroll.test.tsx`:

```tsx
  it('clamps the writing pad to vertical-only scroll with tighter padding on mobile', () => {
    const { container, getByTestId } = render(<NotepadEditor toolbarPlacement="bottom" />);
    const scroll = getByTestId('editor-scroll') as HTMLElement;
    expect(scroll.style.overflowY).toBe('auto');
    expect(scroll.style.overflowX).toBe('hidden');
    expect(scroll.style.padding).toBe('2rem 1.25rem');
    // Editor column is clamped so the wide toolbar can't push it past the viewport.
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.minWidth).toBe('0px');
    expect(root.style.maxWidth).toBe('100%');
  });

  it('keeps the desktop writing pad padding and no horizontal clamp', () => {
    const { getByTestId } = render(<NotepadEditor />);
    const scroll = getByTestId('editor-scroll') as HTMLElement;
    expect(scroll.style.padding).toBe('2rem 2.5rem');
    expect(scroll.style.overflowX).toBe('');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/notepad/components/Editor.mobile-scroll.test.tsx`
Expected: FAIL — `getByTestId('editor-scroll')` throws (no such testid yet).

- [ ] **Step 3: Clamp the root flex container on mobile**

In `src/notepad/components/Editor.tsx`, the root container (~line 203). Replace its style with:

```tsx
    <div style={{
      display: 'flex',
      flexDirection: isBottomToolbar ? 'column-reverse' : 'column',
      height: '100%',
      position: 'relative',
      ...(isBottomToolbar ? { width: '100%', minWidth: 0, maxWidth: '100%' } : {}),
    }}>
```

- [ ] **Step 4: Clamp the scroll content area and tighten mobile padding**

In `src/notepad/components/Editor.tsx`, the scroll content area (~line 348). Add `data-testid`, `overflowX`, and responsive `padding`:

```tsx
      {/* Scrollable content area */}
      <div
        data-testid="editor-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: isBottomToolbar ? 'hidden' : undefined,
          padding: isBottomToolbar ? '2rem 1.25rem' : '2rem 2.5rem',
          position: 'relative',
        }}
      >
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/notepad/components/Editor.mobile-scroll.test.tsx`
Expected: PASS (4 tests total).

- [ ] **Step 6: Commit**

```bash
git add src/notepad/components/Editor.tsx src/notepad/components/Editor.mobile-scroll.test.tsx
git commit -m "fix(notepad): clamp mobile writing pad to vertical-only scroll

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Portal the heading dropdown so the toolbar scroll-clip doesn't cut it off (mobile)

**Files:**
- Modify: `src/notepad/components/Editor.tsx` (imports, heading state ~166, heading trigger + menu ~240–277)
- Test: `src/notepad/components/Editor.mobile-scroll.test.tsx`

Background: Task 1's `overflow-x: auto` makes the toolbar's computed `overflow-y` `auto`, which vertically clips the heading dropdown (it opens above the toolbar). On mobile we render the open menu through a portal to `document.body` so it escapes the clip. Desktop keeps the inline (absolute) menu unchanged.

- [ ] **Step 1: Write the failing test**

Append these two tests inside the `describe(...)` block in `Editor.mobile-scroll.test.tsx`:

```tsx
  it('portals the heading dropdown out of the toolbar on mobile', () => {
    const { container } = render(<NotepadEditor toolbarPlacement="bottom" />);
    const bar = container.querySelector('[data-toolbar-placement="bottom"]') as HTMLElement;
    fireEvent.click(bar.querySelector('[title="Heading"]') as HTMLElement);
    const menu = document.querySelector('[data-testid="heading-menu"]') as HTMLElement;
    expect(menu).not.toBeNull();
    // Escapes the scroll-clipping toolbar.
    expect(bar.contains(menu)).toBe(false);
  });

  it('keeps the heading dropdown inline inside the desktop toolbar', () => {
    const { container } = render(<NotepadEditor />);
    const bar = container.querySelector('[data-toolbar-placement="top"]') as HTMLElement;
    fireEvent.click(bar.querySelector('[title="Heading"]') as HTMLElement);
    const menu = document.querySelector('[data-testid="heading-menu"]') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(bar.contains(menu)).toBe(true);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/notepad/components/Editor.mobile-scroll.test.tsx`
Expected: FAIL — no element has `data-testid="heading-menu"` yet, so `menu` is null.

- [ ] **Step 3: Add the portal import and heading position state**

In `src/notepad/components/Editor.tsx`, add the `createPortal` import near the top (after the existing React/TipTap imports):

```tsx
import { createPortal } from 'react-dom';
```

Add a ref and coords state next to the existing heading state (~line 166). The ref goes on the trigger wrapper; coords are computed when the menu opens so the fixed-positioned portal sits directly above the button:

```tsx
  // Heading dropdown
  const [headingOpen, setHeadingOpen] = useState(false);
  const headingBtnRef = useRef<HTMLDivElement>(null);
  const [headingCoords, setHeadingCoords] = useState<{ bottom: number; left: number }>({ bottom: 0, left: 0 });

  const openHeadingMenu = () => {
    if (!headingOpen && headingBtnRef.current) {
      const r = headingBtnRef.current.getBoundingClientRect();
      // Anchor the menu's bottom 4px above the trigger (it opens upward on mobile).
      setHeadingCoords({ bottom: window.innerHeight - r.top + 4, left: r.left });
    }
    setHeadingOpen((v) => !v);
  };
```

(`useRef` is already imported in this file — it's used by `dismissedRangeRef` at line 108. If `createPortal` import causes an unused-warning before use, it is consumed in Step 5.)

- [ ] **Step 4: Attach the ref and the new handler to the heading trigger**

In `src/notepad/components/Editor.tsx` (~line 240), put the ref on the `.relative` wrapper and swap the trigger's `onClick` to `openHeadingMenu`:

```tsx
          {/* Heading dropdown */}
          <div className="relative" ref={headingBtnRef}>
            <ToolbarButton
              onClick={openHeadingMenu}
              active={currentHeading !== 'H'}
              title="Heading"
            >
              <Heading size={15} />
              <span className="text-[9px] ml-0.5">{currentHeading !== 'H' ? currentHeading : ''}</span>
              <ChevronDown size={10} className="ml-0.5 opacity-50" />
            </ToolbarButton>
```

- [ ] **Step 5: Render the menu inline on desktop, portaled on mobile**

In `src/notepad/components/Editor.tsx`, replace the existing `{headingOpen && ( ... )}` menu block (~lines 250–277) with a shared menu-items fragment used by both branches. The mobile branch portals to `document.body` with `position: fixed`; the desktop branch keeps the inline absolute menu:

```tsx
            {headingOpen && (() => {
              const menuItems = (
                <>
                  {([1, 2, 3] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => { editor.chain().focus().toggleHeading({ level }).run(); setHeadingOpen(false); }}
                      className="flex items-center w-full px-3 py-1.5 text-[12px] hover:bg-black/5 transition-colors"
                      style={{
                        color: editor.isActive('heading', { level }) ? 'var(--charred)' : 'var(--deep-umber)',
                        fontWeight: editor.isActive('heading', { level }) ? 600 : 400,
                        fontFamily: 'Outfit, sans-serif',
                      }}
                    >
                      Heading {level}
                    </button>
                  ))}
                  <button
                    onClick={() => { editor.chain().focus().setParagraph().run(); setHeadingOpen(false); }}
                    className="flex items-center w-full px-3 py-1.5 text-[12px] hover:bg-black/5 transition-colors"
                    style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
                  >
                    Paragraph
                  </button>
                </>
              );

              if (isBottomToolbar) {
                return createPortal(
                  <div
                    data-testid="heading-menu"
                    className="rounded-md shadow-lg py-1"
                    style={{
                      position: 'fixed',
                      bottom: headingCoords.bottom,
                      left: headingCoords.left,
                      background: 'rgba(240, 236, 232, 0.97)',
                      border: '1px solid var(--pale-stone)',
                      minWidth: 100,
                      zIndex: 60,
                    }}
                  >
                    {menuItems}
                  </div>,
                  document.body,
                );
              }

              return (
                <div
                  data-testid="heading-menu"
                  className="absolute top-full mt-1 left-0 rounded-md shadow-lg z-50 py-1"
                  style={{ background: 'rgba(240, 236, 232, 0.97)', border: '1px solid var(--pale-stone)', minWidth: 100 }}
                >
                  {menuItems}
                </div>
              );
            })()}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/notepad/components/Editor.mobile-scroll.test.tsx`
Expected: PASS (6 tests total).

- [ ] **Step 7: Commit**

```bash
git add src/notepad/components/Editor.tsx src/notepad/components/Editor.mobile-scroll.test.tsx
git commit -m "fix(notepad): portal heading dropdown above scrollable mobile toolbar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Verify no new failures and manual mobile check

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the editor changes**

Run: `npx tsc --noEmit`
Expected: No NEW errors in `Editor.tsx` or `Editor.mobile-scroll.test.tsx`. (The pre-existing baseline has 4 tsc errors in `force-sphere.test.ts` — those are unrelated and must remain the only tsc errors.)

- [ ] **Step 2: Lint the changed files**

Run: `npx eslint src/notepad/components/Editor.tsx src/notepad/components/Editor.mobile-scroll.test.tsx`
Expected: Zero errors from these two files. (Repo ships ~114 pre-existing lint errors elsewhere; do not introduce new ones here.)

- [ ] **Step 3: Run the new test file once more**

Run: `npx vitest run src/notepad/components/Editor.mobile-scroll.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 4: Manual mobile verification**

Start the app (`npm run dev`) and open the notepad editor at a ~375px viewport (DevTools device toolbar, iPhone SE):
- Toolbar: scroll it left/right — every button (undo … decorate) is reachable; buttons keep their size.
- Writing pad: type/paste a long paragraph — text wraps within the screen, never runs off the right edge; the pad scrolls vertically to the bottom; it does NOT scroll horizontally.
- Heading dropdown: tap the Heading button — the menu opens fully visible directly above the button (not clipped by the toolbar).
- Desktop (wide viewport): top toolbar still fits with no horizontal scroll; heading dropdown opens inline below the button as before.

- [ ] **Step 5: Final commit (only if Steps 1–4 surfaced fixes)**

```bash
git add -A
git commit -m "fix(notepad): finalize mobile editor scroll verification

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** Toolbar horizontal scroll → Task 1. Writing pad clamp + vertical-only + mobile padding → Task 2. Heading dropdown portal → Task 3. Decorate tray untouched (already top-level; no task needed). Desktop untouched → asserted in Tasks 1–3 "desktop" tests. Verification → Task 4.
- **Mobile-only gating:** Every behavioral change keys on `isBottomToolbar` (`toolbarPlacement === 'bottom'`), the mobile path; desktop assertions guard against regressions.
- **Type consistency:** `headingBtnRef` (HTMLDivElement), `headingCoords` (`{ bottom, left }`), and `openHeadingMenu` are defined once (Task 3 Step 3) and used in Steps 4–5. `data-testid` values `editor-scroll` and `heading-menu` match between implementation and tests.
- **Baseline awareness:** New tests live in a fresh file with a complete `fakeEditor` mock (adds `on`/`off`/`commands` the stale file lacks); we do not touch the pre-existing red files.
