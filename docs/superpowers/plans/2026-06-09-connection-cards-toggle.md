# Connection Cards Show/Hide Toggle (Desktop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible header bar to the desktop Notepad Connection Cards strip so users can show/hide the cards, with the choice remembered across sessions.

**Architecture:** Collapse rendering lives inside `ConnectionCardsPanel` behind a new `collapsible` prop (the panel is the only place that knows whether there are cards to show). The desktop-only `ConnectionCardsStrip` wrapper owns a `localStorage`-persisted open/closed boolean and passes it down. Collapsing hides the card list without unmounting the panel, so discovery never re-runs on re-open. Mobile (`layout="stack"`, non-collapsible) is byte-for-byte unchanged.

**Tech Stack:** React + TypeScript, Vite, Vitest + @testing-library/react (jsdom), Tailwind. Existing `FakeLamplightAdapter` drives component tests end-to-end (seed embeddings/neighbors, `waitFor`).

**Spec:** `docs/superpowers/specs/2026-06-09-connection-cards-toggle-design.md`

---

## File Structure

- **Modify** `src/notepad/components/lamplight/ConnectionCardsPanel.tsx` — add `collapsible` / `open` / `onToggleOpen` props; turn the "Connection Cards" label row into a header button + chevron when collapsible; gate the active-why block and card list on an open flag.
- **Modify** `src/notepad/components/lamplight/ConnectionCardsStrip.tsx` — own the persisted open/closed state; pass `collapsible open onToggleOpen` into the panel.
- **Create** `src/notepad/components/lamplight/ConnectionCardsPanel.collapsible.test.tsx` — direct-panel tests for collapsible rendering + a non-collapsible regression guard.
- **Modify** `src/notepad/components/lamplight/ConnectionCardsStrip.test.tsx` — persistence + toggle behavior through the real wrapper.

---

## Task 1: Collapsible rendering in `ConnectionCardsPanel`

**Files:**
- Test (create): `src/notepad/components/lamplight/ConnectionCardsPanel.collapsible.test.tsx`
- Modify: `src/notepad/components/lamplight/ConnectionCardsPanel.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/notepad/components/lamplight/ConnectionCardsPanel.collapsible.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
  const note = fakeNote({ id: 'note-1' });
  const loadNeighborNotes = async (ids: string[]) =>
    ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
  return { adapter, note, loadNeighborNotes };
}

describe('ConnectionCardsPanel collapsible', () => {
  it('collapsible + open renders a header button with the list', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyPanel();
    render(
      <ConnectionCardsPanel
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
        collapsible
        open
        onToggleOpen={() => {}}
      />,
    );
    const header = await screen.findByRole('button', { name: /connection cards/i });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText('Note note-2')).toBeInTheDocument();
  });

  it('collapsible + open=false hides the list but keeps the header', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyPanel();
    render(
      <ConnectionCardsPanel
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
        collapsible
        open={false}
        onToggleOpen={() => {}}
      />,
    );
    const header = await screen.findByRole('button', { name: /connection cards/i });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Note note-2')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('non-collapsible keeps a plain (non-button) label and always shows the list', async () => {
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
    expect(await screen.findByText('Note note-2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^connection cards$/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsPanel.collapsible.test.tsx`
Expected: FAIL — the first two tests fail because there is no header `button` named "Connection Cards" (the label is a `<p>`) and `open={false}` still renders the list. The third test should already pass.

- [ ] **Step 3: Add the props to the interface**

In `src/notepad/components/lamplight/ConnectionCardsPanel.tsx`, inside `ConnectionCardsPanelProps` (after the existing `layout?: 'strip' | 'stack';` line), add:

```tsx
  /** When true, the label row becomes a clickable header that shows/hides the card list (desktop strip). */
  collapsible?: boolean;
  /** Whether the card list is shown. Only meaningful when `collapsible`. Default true. */
  open?: boolean;
  /** Toggle handler invoked when the collapsible header is clicked. */
  onToggleOpen?: () => void;
```

- [ ] **Step 4: Destructure the new props**

In the same file, change the component parameter destructure from:

```tsx
export function ConnectionCardsPanel({
  adapter,
  activeNote,
  totalNoteCount,
  loadNeighborNotes,
  onOpenNote,
  showEmptyStates = false,
  layout = 'strip',
}: ConnectionCardsPanelProps) {
```

to:

```tsx
export function ConnectionCardsPanel({
  adapter,
  activeNote,
  totalNoteCount,
  loadNeighborNotes,
  onOpenNote,
  showEmptyStates = false,
  layout = 'strip',
  collapsible = false,
  open = true,
  onToggleOpen,
}: ConnectionCardsPanelProps) {
```

- [ ] **Step 5: Derive the open flag**

In the same file, find `const isStack = layout === 'stack';` and add the next line directly below it:

```tsx
  const isStack = layout === 'stack';
  // When not collapsible the list is always shown (mobile/stack and any other
  // caller keep today's behavior). When collapsible, `open` drives visibility.
  const showList = !collapsible || open;
```

- [ ] **Step 6: Gate the active-why block on `showList`**

In the same file, change the active-card "why" block from:

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

to:

```tsx
      {!isStack && showList && activeCard && (
        <div
          className="mb-2 border rounded px-3 py-2"
          style={{ borderColor: 'var(--pale-stone)', background: 'var(--alabaster)' }}
        >
          {renderWhy(activeCard)}
        </div>
      )}
```

- [ ] **Step 7: Replace the label with a collapsible header**

In the same file, change the label row from:

```tsx
      <p
        className="text-[10px] uppercase tracking-wider mb-2"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        Connection Cards
      </p>
```

to:

```tsx
      {collapsible ? (
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-controls="connection-cards-list"
          className="flex items-center gap-1 text-[10px] uppercase tracking-wider mb-2 cursor-pointer"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Connection Cards
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              transition: 'transform 0.2s',
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}
          >
            ⌄
          </span>
        </button>
      ) : (
        <p
          className="text-[10px] uppercase tracking-wider mb-2"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Connection Cards
        </p>
      )}
```

- [ ] **Step 8: Gate the card list on `showList` and give it an id**

In the same file, the card list is the `<div ... role="list">` that wraps `{cards.map(...)}`. Change its opening from:

```tsx
      <div
        className={isStack ? 'flex flex-col gap-2' : 'flex gap-2 overflow-x-auto pb-1'}
        role="list"
      >
        {cards.map((c) => {
```

to (note the leading `{showList && (` and the added `id`):

```tsx
      {showList && (
      <div
        id="connection-cards-list"
        className={isStack ? 'flex flex-col gap-2' : 'flex gap-2 overflow-x-auto pb-1'}
        role="list"
      >
        {cards.map((c) => {
```

Then find the matching close of that list `<div>` — it is the `</div>` immediately before the closing `</section>`:

```tsx
        })}
      </div>
    </section>
```

and change it to close the new `{showList && (` wrapper:

```tsx
        })}
      </div>
      )}
    </section>
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsPanel.collapsible.test.tsx`
Expected: PASS (all 3 tests).

- [ ] **Step 10: Verify the panel's existing tests still pass**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsPanel.stack.test.tsx`
Expected: PASS — `layout="stack"` is non-collapsible, so the list still always renders and the label is still a `<p>`.

- [ ] **Step 11: Commit**

```bash
git add src/notepad/components/lamplight/ConnectionCardsPanel.tsx src/notepad/components/lamplight/ConnectionCardsPanel.collapsible.test.tsx
git commit -m "feat(notepad): collapsible header for connection cards panel"
```

---

## Task 2: Persisted open/closed state in `ConnectionCardsStrip`

**Files:**
- Modify: `src/notepad/components/lamplight/ConnectionCardsStrip.test.tsx`
- Modify: `src/notepad/components/lamplight/ConnectionCardsStrip.tsx`

- [ ] **Step 1: Write the failing tests**

In `src/notepad/components/lamplight/ConnectionCardsStrip.test.tsx`, add `act` to the existing testing-library import so the line reads:

```tsx
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
```

Then add a `localStorage.clear()` to the existing `afterEach` so it becomes:

```tsx
afterEach(() => {
  cleanup();
  localStorage.clear();
  mockUseAuthSession.mockReset();
  mockUseAuthSession.mockImplementation(() => ({ user: null, loading: false }));
});
```

Then append this new `describe` block at the end of the file (after the last test, before the final closing `});` of the outer describe — i.e. as a sibling `describe` at the bottom of the file):

```tsx
describe('ConnectionCardsStrip show/hide toggle', () => {
  function seedReadyStrip() {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
    ]);
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    return { adapter, note, loadNeighborNotes };
  }

  it('defaults to open: header is expanded and cards are visible', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyStrip();
    render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    const header = await screen.findByRole('button', { name: /connection cards/i });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText('Note note-2')).toBeInTheDocument();
  });

  it('clicking the header collapses the list and persists the choice', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyStrip();
    render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    const header = await screen.findByRole('button', { name: /connection cards/i });
    expect(await screen.findByText('Note note-2')).toBeInTheDocument();

    act(() => {
      fireEvent.click(header);
    });

    expect(screen.queryByText('Note note-2')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /connection cards/i }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(localStorage.getItem('lp.notepad.connectionCards.open')).toBe('false');
  });

  it('renders collapsed on mount when localStorage has the closed preference', async () => {
    localStorage.setItem('lp.notepad.connectionCards.open', 'false');
    const { adapter, note, loadNeighborNotes } = seedReadyStrip();
    render(
      <ConnectionCardsStrip
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
      />,
    );
    const header = await screen.findByRole('button', { name: /connection cards/i });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Note note-2')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsStrip.test.tsx -t "show/hide toggle"`
Expected: FAIL — there is no header `button` named "Connection Cards" yet (the strip still passes `ConnectionCardsPanel` without `collapsible`, so the label is a `<p>`).

- [ ] **Step 3: Implement the persisted toggle in the strip**

Replace the entire contents of `src/notepad/components/lamplight/ConnectionCardsStrip.tsx` with:

```tsx
import { useState } from 'react';
import { ConnectionCardsPanel } from './ConnectionCardsPanel';
import type { LamplightAdapter } from '../../storage/lamplight-adapter';
import type { Note } from '../../types';

export interface ConnectionCardsStripProps {
  adapter: LamplightAdapter;
  userId: string;
  activeNote: Note | null;
  totalNoteCount: number;
  loadNeighborNotes: (ids: string[]) => Promise<Note[]>;
  onOpenNote: (noteId: string) => void;
}

/** Persisted across sessions; a single global preference, not per-note. */
const CONNECTION_CARDS_OPEN_KEY = 'lp.notepad.connectionCards.open';

/** Default open: only an explicit stored 'false' collapses. Safe if storage throws. */
function readInitialOpen(): boolean {
  try {
    return localStorage.getItem(CONNECTION_CARDS_OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
}

/**
 * Inline strip for the desktop Content tab. Self-hides for every state
 * except `ready` — no empty-state placeholders in the writing surface.
 * Owns the desktop show/hide preference and renders a collapsible header.
 * (Empty states and the always-on stack live on mobile via
 * ConnectionCardsPanel directly.)
 */
export function ConnectionCardsStrip(props: ConnectionCardsStripProps) {
  const [open, setOpen] = useState<boolean>(readInitialOpen);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CONNECTION_CARDS_OPEN_KEY, String(next));
      } catch {
        // Best-effort persistence; ignore storage failures.
      }
      return next;
    });
  };

  return (
    <ConnectionCardsPanel
      {...props}
      showEmptyStates={false}
      collapsible
      open={open}
      onToggleOpen={toggle}
    />
  );
}
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsStrip.test.tsx -t "show/hide toggle"`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Run the full strip suite to verify no regression**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsStrip.test.tsx`
Expected: PASS — existing tests still pass because `open` defaults to true, so the list renders by default (e.g. "renders header + chips when neighbors exist" still finds the cards).

- [ ] **Step 6: Commit**

```bash
git add src/notepad/components/lamplight/ConnectionCardsStrip.tsx src/notepad/components/lamplight/ConnectionCardsStrip.test.tsx
git commit -m "feat(notepad): persisted desktop show/hide toggle for connection cards"
```

---

## Task 3: Verify, lint, and finalize

**Files:** none modified (verification only).

- [ ] **Step 1: Run the full Lamplight component test suite**

Run: `npx vitest run src/notepad/components/lamplight`
Expected: PASS — all connection-card panel/strip tests green.

- [ ] **Step 2: Lint only the touched files**

Run: `npx eslint src/notepad/components/lamplight/ConnectionCardsPanel.tsx src/notepad/components/lamplight/ConnectionCardsStrip.tsx src/notepad/components/lamplight/ConnectionCardsPanel.collapsible.test.tsx src/notepad/components/lamplight/ConnectionCardsStrip.test.tsx`
Expected: no errors. (Repo-wide `npm run lint` has unrelated pre-existing errors — do not run it.)

- [ ] **Step 3: Manual verification in the preview (desktop)**

With the dev server running at desktop width (1440×900), open the Notepad on a note that has connections (Content tab). Confirm:
- The "Connection Cards" header now shows a chevron and is clickable.
- Clicking it hides the card list; the header bar stays.
- Clicking again re-shows the cards (no flash of re-fetch — the panel did not remount).
- Reloading the page preserves the last open/closed state.
- A note with no connections shows nothing (no header bar) — unchanged.

- [ ] **Step 4: Final confirmation**

Confirm the working tree contains only the four intended files as changes (plus the two committed plan/spec docs); no unrelated churn was staged in the two feature commits.

Run: `git show --stat HEAD~1 HEAD | grep -E "ConnectionCards|connection-cards"`
Expected: only `ConnectionCardsPanel.tsx`, `ConnectionCardsPanel.collapsible.test.tsx`, `ConnectionCardsStrip.tsx`, `ConnectionCardsStrip.test.tsx` appear.

---

## Self-Review Notes

- **Spec coverage:** affordance (Task 1 Step 7 header + chevron), default-open (Task 2 `readInitialOpen` `!== 'false'`), persistence (Task 2 `localStorage` under `lp.notepad.connectionCards.open`), desktop-only (toggle lives in `ConnectionCardsStrip`, mobile uses the panel non-collapsible — guarded by Task 1 test 3 and the existing stack suite), self-hide preserved (the `phase !== 'ready'` early return is untouched; the header renders only inside the ready `<section>`). All covered.
- **Type consistency:** `collapsible` / `open` / `onToggleOpen` are defined in `ConnectionCardsPanelProps` (Task 1 Step 3), destructured (Step 4), and supplied by the strip (Task 2 Step 3). Storage key string `lp.notepad.connectionCards.open` matches between the strip implementation and the test assertion.
- **No placeholders:** every code step shows full before/after.
