# Mobile Connection Cards Vertical Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On mobile only, render the Connection Cards segment as a vertical stack of full-width cards with the "why" reveal expanding inline inside the tapped card; desktop's horizontal strip is unchanged.

**Architecture:** Add a `layout?: 'strip' | 'stack'` prop to the shared `ConnectionCardsPanel` (default `'strip'`). The mobile call site (`LamplightMobileView`) passes `layout="stack"`. In `stack` mode the cards container flows in a column with full-width cards, and the why-state render (extracted into one shared helper) renders inline inside the active card instead of the top panel. The `strip` path stays byte-for-byte identical because it is the default.

**Tech Stack:** React + TypeScript, Tailwind utility classes + inline CSS-variable styles, Vitest + @testing-library/react (jsdom), `FakeLamplightAdapter` test double.

---

### Task 1: Add `layout` prop + vertical container + inline "why" to `ConnectionCardsPanel`

**Files:**
- Modify: `src/notepad/components/lamplight/ConnectionCardsPanel.tsx`
- Test: `src/notepad/components/lamplight/ConnectionCardsPanel.stack.test.tsx` (create)

The existing `ConnectionCardsStrip.test.tsx` already covers the `strip` (default) path via the wrapper; that suite must stay green to prove desktop is unchanged. This task adds a new test file for the `stack` path.

- [ ] **Step 1: Write the failing test**

Create `src/notepad/components/lamplight/ConnectionCardsPanel.stack.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { ConnectionCardsPanel } from './ConnectionCardsPanel';
import { FakeLamplightAdapter } from '../../storage/fake-lamplight-adapter';
import type { Note } from '../../types';

const mockUseAuthSession = vi.hoisted(() => vi.fn(() => ({ user: null, loading: false })));
vi.mock('@/auth/context/useAuthSession', () => ({
  useAuthSession: mockUseAuthSession,
}));

afterEach(() => {
  cleanup();
  mockUseAuthSession.mockReset();
  mockUseAuthSession.mockImplementation(() => ({ user: null, loading: false }));
});

function makeContent(text: string): string {
  return JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
}

function fakeNote(over: Partial<Note>): Note {
  return {
    id: 'note-1',
    title: 'Untitled',
    content: makeContent('word '.repeat(150).trim()),
    folderId: 'folder-1',
    type: 'devotion',
    tags: [],
    wordCount: 150,
    createdAt: '2026-05-27T00:00:00.000Z',
    updatedAt: '2026-05-27T00:00:00.000Z',
    ...over,
  };
}

function seedReadyPanel() {
  const adapter = new FakeLamplightAdapter();
  adapter.__seedNoteEmbedding('note-1');
  adapter.__seedConnectionNeighbors('note-1', [
    { relatedNoteId: 'note-2', similarity: 0.95 },
  ]);
  adapter.__seedConnectionWhy('note-1', 'note-2', 'Both notes circle the same wilderness motif.');
  const note = fakeNote({ id: 'note-1' });
  const loadNeighborNotes = async (ids: string[]) =>
    ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
  return { adapter, note, loadNeighborNotes };
}

describe('ConnectionCardsPanel layout="stack"', () => {
  it('lays cards out vertically (no horizontal scroll container)', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyPanel();
    render(
      <ConnectionCardsPanel
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
        layout="stack"
      />,
    );
    const list = await screen.findByRole('list');
    expect(list.className).toContain('flex-col');
    expect(list.className).not.toContain('overflow-x-auto');
  });

  it('expands the "why" inline inside the tapped card (not a top panel)', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyPanel();
    render(
      <ConnectionCardsPanel
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
        layout="stack"
      />,
    );
    await waitFor(() => expect(screen.getByText('Note note-2')).toBeInTheDocument());

    fireEvent.click(
      screen.getByRole('button', { name: /show why this connects to Note note-2/i }),
    );
    await waitFor(() =>
      expect(screen.getByText('Both notes circle the same wilderness motif.')).toBeInTheDocument(),
    );

    // The why text lives INSIDE the card's listitem, not above the list.
    const item = screen.getByRole('listitem');
    expect(
      within(item).getByText('Both notes circle the same wilderness motif.'),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsPanel.stack.test.tsx`
Expected: FAIL — `ConnectionCardsPanel` does not accept `layout`, the list container is `overflow-x-auto` (not `flex-col`), and the why text is in the top panel (not within the listitem).

- [ ] **Step 3: Add the `layout` prop and branch the render**

Edit `src/notepad/components/lamplight/ConnectionCardsPanel.tsx`.

3a. Add `layout` to the props interface (after `showEmptyStates`):

```tsx
  /** When true, non-ready phases render a contextual empty state instead of nothing. */
  showEmptyStates?: boolean;
  /** 'strip' = horizontal inline strip (desktop). 'stack' = vertical full-width cards (mobile). */
  layout?: 'strip' | 'stack';
```

3b. Add `layout = 'strip'` to the destructured params (after `showEmptyStates = false,`):

```tsx
  showEmptyStates = false,
  layout = 'strip',
}: ConnectionCardsPanelProps) {
```

3c. Just before the `return (` (after the `handleChipClick` function, around line 86), add `isStack` and a shared why-renderer:

```tsx
  const isStack = layout === 'stack';

  const renderWhy = (card: typeof cards[number]) => {
    if (card.why.phase === 'loading') {
      return (
        <p
          role="status"
          aria-live="polite"
          className="text-xs"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Lighting…
        </p>
      );
    }
    if (card.why.phase === 'shown') {
      return (
        <p
          className="text-sm italic"
          style={{ color: 'var(--deep-umber)', fontFamily: 'Cormorant Garamond, serif' }}
          data-cached={card.why.cached}
        >
          {prefixWhyWithName(card.why.text, firstName)}
        </p>
      );
    }
    if (card.why.phase === 'error') {
      return (
        <div className="text-xs" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
          <p className="mb-1">Couldn't read this connection.</p>
          <button
            onClick={() => retryWhy(card.relatedNoteId)}
            className="underline cursor-pointer"
            style={{ color: 'var(--deep-umber)' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return null;
  };
```

3d. Replace the top `activeCard` panel block (currently lines ~93–133, the whole `{activeCard && ( … )}` expression) with a strip-only version that delegates to `renderWhy`:

```tsx
      {!isStack && activeCard && (
        <div
          className="mb-2 border rounded px-3 py-2"
          style={{ borderColor: 'var(--pale-stone)', background: 'var(--alabaster)' }}
        >
          {renderWhy(activeCard)}
        </div>
      )}
```

3e. Replace the cards container opening tag (currently `<div className="flex gap-2 overflow-x-auto pb-1" role="list">`) with a layout-aware class:

```tsx
      <div
        className={isStack ? 'flex flex-col gap-2' : 'flex gap-2 overflow-x-auto pb-1'}
        role="list"
      >
```

3f. Replace the card wrapper `<div>` (currently `className="flex-none w-[220px] border rounded"`) with a layout-aware width:

```tsx
            <div
              key={c.relatedNoteId}
              role="listitem"
              className={`${isStack ? 'w-full' : 'flex-none w-[220px]'} border rounded`}
              style={{
                borderColor: isActive ? 'var(--deep-umber)' : 'var(--pale-stone)',
                background: 'var(--alabaster)',
              }}
            >
```

3g. Make the title wrap + go serif in stack mode. Replace the title `<p>` (currently `className="text-xs truncate"` with `fontFamily: 'Outfit, sans-serif'`) with:

```tsx
                <p
                  className={isStack ? 'text-base' : 'text-xs truncate'}
                  style={{
                    color: 'var(--deep-umber)',
                    fontFamily: isStack ? 'Cormorant Garamond, serif' : 'Outfit, sans-serif',
                  }}
                >
                  {c.relatedNoteTitle}
                </p>
```

3h. Render the inline why between the why-toggle button and the Open button (stack only). Immediately after the closing `</button>` of the why-toggle button (the one whose `aria-label` is `Show why this connects to …`, around line 174) and before the Open `<button>`, insert:

```tsx
              {isStack && isActive && (
                <div className="px-3 pb-2">{renderWhy(c)}</div>
              )}
```

3i. Give the Open button a top divider in stack mode. Replace its `className` (currently `"block w-full text-right px-3 pb-1 text-xs cursor-pointer hover:underline"`) and add a conditional border color:

```tsx
              <button
                aria-label={`Open note: ${c.relatedNoteTitle}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNote(c.relatedNoteId);
                }}
                className={`block w-full text-right px-3 text-xs cursor-pointer hover:underline ${
                  isStack ? 'border-t pt-2 pb-2 mt-1' : 'pb-1'
                }`}
                style={{
                  color: 'var(--deep-umber)',
                  fontFamily: 'Outfit, sans-serif',
                  ...(isStack ? { borderColor: 'var(--pale-stone)' } : {}),
                }}
              >
                Open ↗
              </button>
```

- [ ] **Step 4: Run the new stack test to verify it passes**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsPanel.stack.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Run the existing strip suite to verify desktop is unchanged**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsStrip.test.tsx`
Expected: PASS (all cases — strip path untouched).

- [ ] **Step 6: Commit**

```bash
git add src/notepad/components/lamplight/ConnectionCardsPanel.tsx \
        src/notepad/components/lamplight/ConnectionCardsPanel.stack.test.tsx
git commit -m "feat(lamplight): add stack layout to ConnectionCardsPanel"
```

---

### Task 2: Pass `layout="stack"` from `LamplightMobileView`

**Files:**
- Modify: `src/components/sections/notepad/mobile/LamplightMobileView.tsx:49-57`
- Test: `src/components/sections/notepad/mobile/LamplightMobileView.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this case inside the `describe('<LamplightMobileView />', …)` block in `LamplightMobileView.test.tsx`:

```tsx
  it('renders the connections panel with the vertical stack layout', () => {
    panelSpy.mockClear();
    const { getByRole } = render(<LamplightMobileView {...props} />);
    fireEvent.click(getByRole('button', { name: 'Connection Cards' }));
    expect(panelSpy).toHaveBeenCalledWith(
      expect.objectContaining({ layout: 'stack' }),
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/LamplightMobileView.test.tsx`
Expected: FAIL — the new case fails because `LamplightMobileView` does not pass `layout`.

- [ ] **Step 3: Pass the prop**

In `LamplightMobileView.tsx`, add `layout="stack"` to the `<ConnectionCardsPanel>` (alongside `showEmptyStates`):

```tsx
            <ConnectionCardsPanel
              adapter={lamplightAdapter}
              userId={userId}
              activeNote={activeNote}
              totalNoteCount={totalNoteCount}
              loadNeighborNotes={loadNeighborNotes}
              onOpenNote={onOpenNote}
              showEmptyStates
              layout="stack"
            />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/LamplightMobileView.test.tsx`
Expected: PASS (all cases, including the existing `showEmptyStates` case).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/LamplightMobileView.tsx \
        src/components/sections/notepad/mobile/LamplightMobileView.test.tsx
git commit -m "feat(lamplight): render mobile connection cards as vertical stack"
```

---

### Task 3: Full verification

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the full lamplight + mobile test scope**

Run: `npx vitest run src/notepad/components/lamplight src/components/sections/notepad/mobile`
Expected: PASS.

- [ ] **Step 3: Lint the touched files**

Run: `npx eslint src/notepad/components/lamplight/ConnectionCardsPanel.tsx src/components/sections/notepad/mobile/LamplightMobileView.tsx`
Expected: clean (no new warnings/errors).

---

## Notes for the implementer

- **Do not** alter the `strip` branch's classes or the top-panel markup beyond routing it through `renderWhy` — desktop must stay visually identical. The `ConnectionCardsStrip.test.tsx` suite is your regression guard.
- `prefixWhyWithName`, `firstName`, `retryWhy`, `expandCard`, and `activeChipId` already exist in the component scope; `renderWhy` closes over them. No new imports are required.
- The mobile segment is already wrapped in a vertical `overflow-y-auto` container in `LamplightMobileView`, so stacked cards scroll vertically with no extra CSS.
