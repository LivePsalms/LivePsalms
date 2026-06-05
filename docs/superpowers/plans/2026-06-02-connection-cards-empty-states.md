# Connection Cards Empty States (Mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blank mobile "Connection Cards" segment with four contextual empty states (checklist / reading / nothing-echoes / error-retry) that reflect the real reason no cards are showing.

**Architecture:** Enrich `useConnectionCards` so its `inactive` state carries a reason plus two booleans, and add a `retry()` that re-runs the neighbor fetch. Add a pure `ConnectionCardsEmpty` presentational component. Lift the hook + threshold fetch out of `ConnectionCardsStrip` into a new `ConnectionCardsPanel` container that renders the cards when `ready` and (only when `showEmptyStates` is set) the empty component otherwise. `ConnectionCardsStrip` becomes a thin wrapper (`showEmptyStates={false}`) so desktop is unchanged; the mobile view uses the panel with `showEmptyStates`.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react (jsdom), Tailwind utility classes with CSS-variable palette.

**Spec:** `docs/superpowers/specs/2026-06-02-connection-cards-empty-states-design.md`

**Conventions:**
- Run a single test file with: `npx vitest run <path>`
- Typecheck with: `npx tsc -b`
- Lint with: `npm run lint`

---

## File Structure

- `src/notepad/storage/fake-lamplight-adapter.ts` — **modify**: add `__failNextGetConnectionNeighbors()` so tests can simulate a network error on neighbor fetch.
- `src/notepad/hooks/useConnectionCards.ts` — **modify**: enrich `inactive` state (`reason`, `meetsDepth`, `meetsVault`); add `retry()` via a nonce in the effect deps.
- `src/notepad/hooks/useConnectionCards.test.tsx` — **modify**: assert new `inactive` fields; add a retry test.
- `src/notepad/components/lamplight/ConnectionCardsEmpty.tsx` — **create**: pure presentational empty-state component.
- `src/notepad/components/lamplight/ConnectionCardsEmpty.test.tsx` — **create**: unit tests for the four states.
- `src/notepad/components/lamplight/ConnectionCardsPanel.tsx` — **create**: container owning the hook + threshold; renders cards or empty/null.
- `src/notepad/components/lamplight/ConnectionCardsStrip.tsx` — **modify**: becomes a thin wrapper over the panel with `showEmptyStates={false}`. The ready-state JSX moves into the panel.
- `src/notepad/components/lamplight/ConnectionCardsStrip.test.tsx` — **unchanged** (behavior preserved; must still pass).
- `src/components/sections/notepad/mobile/LamplightMobileView.tsx` — **modify**: connections segment uses `ConnectionCardsPanel` with `showEmptyStates`.
- `src/components/sections/notepad/mobile/LamplightMobileView.test.tsx` — **modify**: mock `ConnectionCardsPanel` instead of `ConnectionCardsStrip`.

---

## Task 1: Enrich the hook (`inactive` reason + booleans + `retry()`)

**Files:**
- Modify: `src/notepad/storage/fake-lamplight-adapter.ts`
- Modify: `src/notepad/hooks/useConnectionCards.ts`
- Test: `src/notepad/hooks/useConnectionCards.test.tsx`

- [ ] **Step 1: Add a neighbor-fetch failure hook to the fake adapter**

In `src/notepad/storage/fake-lamplight-adapter.ts`, add a private failure flag near the other connection-cards private fields (just after `private nextGenerateConnectionWhyFailure: ... | null = null;`):

```ts
  private failNextGetConnectionNeighbors = false;

  __failNextGetConnectionNeighbors(): void {
    this.failNextGetConnectionNeighbors = true;
  }
```

Then, at the very top of the existing `getConnectionNeighbors` method body, consume the flag:

```ts
  async getConnectionNeighbors(
    sourceNoteId: string,
    k = 5,
    minSimilarity?: number,
  ): Promise<ConnectionNeighbor[]> {
    if (this.failNextGetConnectionNeighbors) {
      this.failNextGetConnectionNeighbors = false;
      throw new Error('simulated network failure');
    }
    const all = this.connectionNeighbors.get(sourceNoteId) ?? [];
    const filtered =
      typeof minSimilarity === 'number'
        ? all.filter((n) => n.similarity >= minSimilarity)
        : all;
    return filtered.slice(0, k);
  }
```

- [ ] **Step 2: Write the failing tests**

In `src/notepad/hooks/useConnectionCards.test.tsx`, add these tests inside the `describe('useConnectionCards', ...)` block (after the existing `no_connections` test). Note `act` is already imported.

```tsx
  it('inactive (no active note) carries reason + booleans', async () => {
    const adapter = new FakeLamplightAdapter();
    const loadNeighborNotes = async () => [];
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: null,
        totalNoteCount: 50,
        loadNeighborNotes,
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('inactive'));
    if (result.current.state.phase !== 'inactive') throw new Error('phase');
    expect(result.current.state.reason).toBe('no_active_note');
    expect(result.current.state.meetsDepth).toBe(false);
    expect(result.current.state.meetsVault).toBe(true);
  });

  it('inactive (note too short) reports meetsDepth=false, meetsVault=true', async () => {
    const adapter = new FakeLamplightAdapter();
    const shortNote = fakeNote({ content: makeContent('short note') });
    const loadNeighborNotes = async () => [];
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: shortNote,
        totalNoteCount: 50,
        loadNeighborNotes,
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('inactive'));
    if (result.current.state.phase !== 'inactive') throw new Error('phase');
    expect(result.current.state.reason).toBe('note_too_short');
    expect(result.current.state.meetsDepth).toBe(false);
    expect(result.current.state.meetsVault).toBe(true);
  });

  it('inactive (vault too small) reports meetsDepth=true, meetsVault=false', async () => {
    const adapter = new FakeLamplightAdapter();
    const note = fakeNote({});
    const loadNeighborNotes = async () => [];
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: note,
        totalNoteCount: 1,
        loadNeighborNotes,
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('inactive'));
    if (result.current.state.phase !== 'inactive') throw new Error('phase');
    expect(result.current.state.reason).toBe('vault_too_small');
    expect(result.current.state.meetsDepth).toBe(true);
    expect(result.current.state.meetsVault).toBe(false);
  });

  it('retry() re-runs the fetch after a network error', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedNoteEmbedding('note-1');
    adapter.__seedConnectionNeighbors('note-1', [
      { relatedNoteId: 'note-2', similarity: 0.95 },
    ]);
    adapter.__failNextGetConnectionNeighbors();
    const note = fakeNote({ id: 'note-1' });
    const loadNeighborNotes = async (ids: string[]) =>
      ids.map((id) => fakeNote({ id, title: `Note ${id}` }));
    const { result } = renderHook(() =>
      useConnectionCards({
        adapter,
        userId: 'u1',
        activeNote: note,
        totalNoteCount: 50,
        loadNeighborNotes,
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('error'));

    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/notepad/hooks/useConnectionCards.test.tsx`
Expected: FAIL — the new `inactive` fields don't exist (TS/assertion errors) and `result.current.retry` is undefined.

- [ ] **Step 4: Update the state type and result interface**

In `src/notepad/hooks/useConnectionCards.ts`, replace the `inactive` variant of `ConnectionCardsState`:

```ts
export type ConnectionCardsState =
  | {
      phase: 'inactive';
      reason: 'no_active_note' | 'note_too_short' | 'vault_too_small';
      meetsDepth: boolean;
      meetsVault: boolean;
    }
  | { phase: 'waiting_for_embedding' }
  | { phase: 'no_connections' }
  | { phase: 'ready'; cards: ConnectionCard[] }
  | { phase: 'error'; reason: 'network' };
```

Add `retry` to the result interface:

```ts
export interface UseConnectionCardsResult {
  state: ConnectionCardsState;
  expandCard: (relatedNoteId: string) => Promise<void>;
  retryWhy: (relatedNoteId: string) => Promise<void>;
  retry: () => void;
}
```

- [ ] **Step 5: Compute the booleans, set enriched inactive states, and add the retry nonce**

In `useConnectionCards.ts`, add a retry-nonce state next to the existing `state` declaration:

```ts
  const [state, setState] = useState<ConnectionCardsState>({
    phase: 'inactive',
    reason: 'no_active_note',
    meetsDepth: false,
    meetsVault: false,
  });
  const [retryNonce, setRetryNonce] = useState(0);
```

Inside the effect's `run()` function, replace the three early `inactive` returns. Compute both booleans up front using the data already in scope, then branch:

```ts
    async function run() {
      const meetsVault = totalNoteCount >= qualifyingMinVaultSize;

      if (!activeNote) {
        setState({ phase: 'inactive', reason: 'no_active_note', meetsDepth: false, meetsVault });
        return;
      }
      const plaintext = extractTextFromNote(activeNote);
      const meetsDepth = countWords(plaintext) >= qualifyingMinWords;
      if (!meetsDepth) {
        setState({ phase: 'inactive', reason: 'note_too_short', meetsDepth: false, meetsVault });
        return;
      }
      if (!meetsVault) {
        setState({ phase: 'inactive', reason: 'vault_too_small', meetsDepth: true, meetsVault: false });
        return;
      }

      const hasEmbedding = await adapter.hasNoteEmbedding(activeNote.id);
      // ... rest of the existing run() body is unchanged ...
```

Leave the remainder of `run()` (embedding check, neighbor fetch, card mapping) exactly as-is.

Add `retryNonce` to the effect's dependency array (append it to the existing list):

```ts
  }, [
    adapter,
    activeNote,
    totalNoteCount,
    qualifyingMinWords,
    qualifyingMinVaultSize,
    qualifyingMinSimilarity,
    maxRenderedCards,
    retryNonce,
  ]);
```

Define `retry` (place it next to `retryWhy`) and add it to the return:

```ts
  const retry = useCallback(() => {
    setRetryNonce((n) => n + 1);
  }, []);

  return { state, expandCard, retryWhy, retry };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/notepad/hooks/useConnectionCards.test.tsx`
Expected: PASS (all existing + 4 new tests).

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b`
Expected: no errors. (If `ConnectionCardsStrip` reads `state.phase === 'ready'` only, it stays valid; the enriched `inactive` is additive.)

- [ ] **Step 8: Commit**

```bash
git add src/notepad/hooks/useConnectionCards.ts src/notepad/hooks/useConnectionCards.test.tsx src/notepad/storage/fake-lamplight-adapter.ts
git commit -m "feat(notepad): enrich useConnectionCards inactive state + retry()

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Create `ConnectionCardsEmpty` (pure presentational component)

**Files:**
- Create: `src/notepad/components/lamplight/ConnectionCardsEmpty.tsx`
- Test: `src/notepad/components/lamplight/ConnectionCardsEmpty.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/notepad/components/lamplight/ConnectionCardsEmpty.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConnectionCardsEmpty } from './ConnectionCardsEmpty';

afterEach(cleanup);

describe('<ConnectionCardsEmpty />', () => {
  it('inactive: shows the checklist with depth done, vault not yet', () => {
    render(
      <ConnectionCardsEmpty
        state={{ phase: 'inactive', reason: 'vault_too_small', meetsDepth: true, meetsVault: false }}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText(/No connections lit yet/i)).toBeInTheDocument();
    const depth = screen.getByText(/Write a note with some depth/i).closest('li')!;
    const vault = screen.getByText(/Keep a few more notes in your vault/i).closest('li')!;
    expect(depth).toHaveAttribute('data-done', 'true');
    expect(vault).toHaveAttribute('data-done', 'false');
  });

  it('inactive: depth not yet when meetsDepth=false', () => {
    render(
      <ConnectionCardsEmpty
        state={{ phase: 'inactive', reason: 'note_too_short', meetsDepth: false, meetsVault: true }}
        onRetry={() => {}}
      />,
    );
    const depth = screen.getByText(/Write a note with some depth/i).closest('li')!;
    const vault = screen.getByText(/Keep a few more notes in your vault/i).closest('li')!;
    expect(depth).toHaveAttribute('data-done', 'false');
    expect(vault).toHaveAttribute('data-done', 'true');
  });

  it('waiting_for_embedding: shows reading message with a polite live region', () => {
    render(
      <ConnectionCardsEmpty state={{ phase: 'waiting_for_embedding' }} onRetry={() => {}} />,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText(/The lamp is reading/i)).toBeInTheDocument();
  });

  it('no_connections: shows the nothing-echoes message', () => {
    render(<ConnectionCardsEmpty state={{ phase: 'no_connections' }} onRetry={() => {}} />);
    expect(screen.getByText(/Nothing echoes yet/i)).toBeInTheDocument();
  });

  it('error: shows the message and Try again invokes onRetry', () => {
    const onRetry = vi.fn();
    render(<ConnectionCardsEmpty state={{ phase: 'error', reason: 'network' }} onRetry={onRetry} />);
    expect(screen.getByText(/Couldn't reach the lamp/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsEmpty.test.tsx`
Expected: FAIL — module `./ConnectionCardsEmpty` does not exist.

- [ ] **Step 3: Implement the component**

Create `src/notepad/components/lamplight/ConnectionCardsEmpty.tsx`:

```tsx
import type { ConnectionCardsState } from '../../hooks/useConnectionCards';

type EmptyState = Exclude<ConnectionCardsState, { phase: 'ready' }>;

export interface ConnectionCardsEmptyProps {
  state: EmptyState;
  onRetry: () => void;
}

const UI_FONT = 'Outfit, sans-serif';
const SERIF_FONT = 'Cormorant Garamond, serif';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center min-h-[260px] px-8 py-10"
      style={{ background: 'var(--alabaster)' }}
    >
      {children}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xl mb-2"
      style={{ color: 'var(--deep-umber)', fontFamily: SERIF_FONT }}
    >
      {children}
    </p>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-sm leading-relaxed max-w-[18rem]"
      style={{ color: 'var(--silica)', fontFamily: UI_FONT }}
    >
      {children}
    </p>
  );
}

export function ConnectionCardsEmpty({ state, onRetry }: ConnectionCardsEmptyProps) {
  if (state.phase === 'waiting_for_embedding') {
    return (
      <Frame>
        <Title>The lamp is reading…</Title>
        <p
          role="status"
          aria-live="polite"
          className="text-sm leading-relaxed max-w-[18rem]"
          style={{ color: 'var(--silica)', fontFamily: UI_FONT }}
        >
          It's quietly taking in what you've written — connections will surface here in a moment.
        </p>
      </Frame>
    );
  }

  if (state.phase === 'no_connections') {
    return (
      <Frame>
        <Title>Nothing echoes yet</Title>
        <Body>
          This note stands on its own for now. As your vault grows, the lamp may find quiet
          threads between it and others.
        </Body>
      </Frame>
    );
  }

  if (state.phase === 'error') {
    return (
      <Frame>
        <Title>Couldn't reach the lamp</Title>
        <Body>A brief hiccup — your notes are safe.</Body>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 text-sm underline cursor-pointer"
          style={{ color: 'var(--deep-umber)', fontFamily: UI_FONT }}
        >
          Try again
        </button>
      </Frame>
    );
  }

  // inactive — checklist
  const items = [
    { label: 'Write a note with some depth', done: state.meetsDepth },
    { label: 'Keep a few more notes in your vault', done: state.meetsVault },
  ];
  return (
    <Frame>
      <Title>No connections lit yet</Title>
      <Body>The lamp finds notes that quietly echo one another. A couple of things help it along:</Body>
      <ul className="mt-5 flex flex-col gap-3 text-left w-full max-w-[18rem]">
        {items.map((item) => (
          <li
            key={item.label}
            data-done={item.done ? 'true' : 'false'}
            className="flex items-start gap-3 text-sm"
            style={{ color: 'var(--deep-umber)', fontFamily: UI_FONT }}
          >
            <span
              aria-hidden
              className="flex-none inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[11px]"
              style={{
                background: item.done ? 'var(--deep-umber)' : 'var(--pale-stone)',
                color: item.done ? 'var(--alabaster)' : 'var(--silica)',
              }}
            >
              {item.done ? '✓' : '·'}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsEmpty.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/notepad/components/lamplight/ConnectionCardsEmpty.tsx src/notepad/components/lamplight/ConnectionCardsEmpty.test.tsx
git commit -m "feat(notepad): ConnectionCardsEmpty contextual empty-state component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Extract `ConnectionCardsPanel` and reduce the strip to a wrapper

**Files:**
- Create: `src/notepad/components/lamplight/ConnectionCardsPanel.tsx`
- Modify: `src/notepad/components/lamplight/ConnectionCardsStrip.tsx`
- Test (must still pass, unchanged): `src/notepad/components/lamplight/ConnectionCardsStrip.test.tsx`

This task is a refactor: the panel contains exactly what the strip used to do, plus the new `showEmptyStates` branch. The existing strip tests render the real `ConnectionCardsStrip` (which now delegates to the panel) and must continue to pass with no edits.

- [ ] **Step 1: Create the panel with the strip's full logic + the empty branch**

Create `src/notepad/components/lamplight/ConnectionCardsPanel.tsx`. This is the current strip body, verbatim, with two additions: a `showEmptyStates` prop, wiring `retry` from the hook, and the non-ready branch that renders `ConnectionCardsEmpty`.

```tsx
import { useEffect, useState } from 'react';
import { useConnectionCards } from '../../hooks/useConnectionCards';
import { useAuthSession } from '@/auth/context/useAuthSession';
import { firstNameOf } from '../../first-load/notepad-first-load';
import { sanitizeFirstName } from '../../utils/personalization';
import { prefixWhyWithName } from '../../connection-cards/why-render';
import { ConnectionCardsEmpty } from './ConnectionCardsEmpty';
import type { LamplightAdapter } from '../../storage/lamplight-adapter';
import type { Note } from '../../types';

export interface ConnectionCardsPanelProps {
  adapter: LamplightAdapter;
  userId: string;
  activeNote: Note | null;
  totalNoteCount: number;
  loadNeighborNotes: (ids: string[]) => Promise<Note[]>;
  onOpenNote: (noteId: string) => void;
  /** When true, non-ready phases render a contextual empty state instead of nothing. */
  showEmptyStates?: boolean;
}

export function ConnectionCardsPanel({
  adapter,
  userId,
  activeNote,
  totalNoteCount,
  loadNeighborNotes,
  onOpenNote,
  showEmptyStates = false,
}: ConnectionCardsPanelProps) {
  // Pull the server-authoritative similarity threshold so the panel never
  // renders a card the edge function will refuse to explain. While the fetch
  // is in flight (or if it errors), the hook falls back to the spec value
  // (0.78), which is the production-safe default.
  const [minSimilarity, setMinSimilarity] = useState<number | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    adapter
      .getConnectionCardThresholds()
      .then((t) => {
        if (!cancelled) setMinSimilarity(t.minSimilarity);
      })
      .catch(() => {
        // Swallow — hook default (0.78) is the right fallback.
      });
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  const { state, expandCard, retryWhy, retry } = useConnectionCards({
    adapter,
    userId,
    activeNote,
    totalNoteCount,
    loadNeighborNotes,
    qualifyingMinSimilarity: minSimilarity,
  });
  const { user } = useAuthSession();
  const firstName = user ? sanitizeFirstName(firstNameOf(user)) : null;
  const [activeChipId, setActiveChipId] = useState<string | null>(null);

  if (state.phase !== 'ready') {
    if (showEmptyStates) {
      return <ConnectionCardsEmpty state={state} onRetry={retry} />;
    }
    return null;
  }

  const cards = state.cards;
  const activeCard = activeChipId
    ? cards.find((c) => c.relatedNoteId === activeChipId) ?? null
    : null;

  const handleChipClick = async (relatedNoteId: string) => {
    if (activeChipId === relatedNoteId) {
      setActiveChipId(null);
      return;
    }
    setActiveChipId(relatedNoteId);
    const card = cards.find((c) => c.relatedNoteId === relatedNoteId);
    if (card && card.why.phase === 'collapsed') {
      await expandCard(relatedNoteId);
    }
  };

  return (
    <section
      aria-label="Connection cards"
      className="border-t px-4 py-3"
      style={{ borderColor: 'var(--pale-stone)', background: 'var(--plaster)' }}
    >
      {activeCard && (
        <div
          className="mb-2 border rounded px-3 py-2"
          style={{ borderColor: 'var(--pale-stone)', background: 'var(--alabaster)' }}
        >
          {activeCard.why.phase === 'loading' && (
            <p
              role="status"
              aria-live="polite"
              className="text-xs"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              Lighting…
            </p>
          )}
          {activeCard.why.phase === 'shown' && (
            <p
              className="text-sm italic"
              style={{ color: 'var(--deep-umber)', fontFamily: 'Cormorant Garamond, serif' }}
              data-cached={activeCard.why.cached}
            >
              {prefixWhyWithName(activeCard.why.text, firstName)}
            </p>
          )}
          {activeCard.why.phase === 'error' && (
            <div
              className="text-xs"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              <p className="mb-1">Couldn't read this connection.</p>
              <button
                onClick={() => retryWhy(activeCard.relatedNoteId)}
                className="underline cursor-pointer"
                style={{ color: 'var(--deep-umber)' }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
      <p
        className="text-[10px] uppercase tracking-wider mb-2"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        Connection Cards
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1" role="list">
        {cards.map((c) => {
          const signals = [...c.sharedTags.map((t) => `#${t}`), ...c.sharedVerseRefs];
          const isActive = activeChipId === c.relatedNoteId;
          return (
            <div
              key={c.relatedNoteId}
              role="listitem"
              className="flex-none w-[220px] border rounded"
              style={{
                borderColor: isActive ? 'var(--deep-umber)' : 'var(--pale-stone)',
                background: 'var(--alabaster)',
              }}
            >
              <button
                aria-label={`Show why this connects to ${c.relatedNoteTitle}`}
                aria-pressed={isActive}
                onClick={() => handleChipClick(c.relatedNoteId)}
                className="block w-full text-left px-3 py-2 cursor-pointer"
              >
                {signals.length > 0 && (
                  <p
                    className="text-[10px] mb-1 truncate"
                    style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
                  >
                    {signals.join(' · ')}
                  </p>
                )}
                <p
                  className="text-xs truncate"
                  style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
                >
                  {c.relatedNoteTitle}
                </p>
              </button>
              <button
                aria-label={`Open note: ${c.relatedNoteTitle}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNote(c.relatedNoteId);
                }}
                className="block w-full text-right px-3 pb-1 text-xs cursor-pointer hover:underline"
                style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
              >
                Open ↗
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Reduce `ConnectionCardsStrip` to a thin wrapper**

Replace the entire contents of `src/notepad/components/lamplight/ConnectionCardsStrip.tsx` with:

```tsx
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

/**
 * Inline strip for the desktop Content tab. Self-hides for every state
 * except `ready` — no empty-state placeholders in the writing surface.
 * (Empty states live in the mobile Connection Cards segment via
 * ConnectionCardsPanel with showEmptyStates.)
 */
export function ConnectionCardsStrip(props: ConnectionCardsStripProps) {
  return <ConnectionCardsPanel {...props} showEmptyStates={false} />;
}
```

- [ ] **Step 3: Run the existing strip tests (must still pass unchanged)**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsStrip.test.tsx`
Expected: PASS — all existing tests (self-hide on non-ready, header+chips on ready, why expand, threshold flow) behave identically because the panel preserves the logic.

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/ConnectionCardsPanel.tsx src/notepad/components/lamplight/ConnectionCardsStrip.tsx
git commit -m "refactor(notepad): extract ConnectionCardsPanel; strip wraps it

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire the mobile Connection Cards segment to show empty states

**Files:**
- Modify: `src/components/sections/notepad/mobile/LamplightMobileView.tsx`
- Test: `src/components/sections/notepad/mobile/LamplightMobileView.test.tsx`

- [ ] **Step 1: Update the test to mock the panel and assert empty-state wiring**

Replace the `ConnectionCardsStrip` mock in `src/components/sections/notepad/mobile/LamplightMobileView.test.tsx` with a `ConnectionCardsPanel` mock that records the `showEmptyStates` prop. Replace lines 12–14 (the `vi.mock('.../ConnectionCardsStrip', ...)` block) with:

```tsx
const { panelSpy } = vi.hoisted(() => ({ panelSpy: vi.fn() }));
vi.mock('../../../../notepad/components/lamplight/ConnectionCardsPanel', () => ({
  ConnectionCardsPanel: (props: { showEmptyStates?: boolean }) => {
    panelSpy(props);
    return <div data-testid="connections" />;
  },
}));
```

Then add a test inside the `describe` block asserting the mobile segment opts into empty states:

```tsx
  it('renders the connections panel with showEmptyStates enabled', () => {
    panelSpy.mockClear();
    const { getByRole } = render(<LamplightMobileView {...props} />);
    fireEvent.click(getByRole('button', { name: 'Connection Cards' }));
    expect(panelSpy).toHaveBeenCalledWith(
      expect.objectContaining({ showEmptyStates: true }),
    );
  });
```

The existing `getByTestId('connections')` assertions keep working because the mock still renders `data-testid="connections"`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/LamplightMobileView.test.tsx`
Expected: FAIL — the view still imports/renders `ConnectionCardsStrip`, so the `ConnectionCardsPanel` mock is never called and `panelSpy` has no calls.

- [ ] **Step 3: Switch the view to the panel**

In `src/components/sections/notepad/mobile/LamplightMobileView.tsx`:

Replace the import on line 4:

```tsx
import { ConnectionCardsPanel } from '../../../../notepad/components/lamplight/ConnectionCardsPanel';
```

Replace the connections-segment render (the `<ConnectionCardsStrip ... />` JSX, lines 49–56) with:

```tsx
            <ConnectionCardsPanel
              adapter={lamplightAdapter}
              userId={userId}
              activeNote={activeNote}
              totalNoteCount={totalNoteCount}
              loadNeighborNotes={loadNeighborNotes}
              onOpenNote={onOpenNote}
              showEmptyStates
            />
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/LamplightMobileView.test.tsx`
Expected: PASS (existing tests + the new `showEmptyStates` test).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/notepad/mobile/LamplightMobileView.tsx src/components/sections/notepad/mobile/LamplightMobileView.test.tsx
git commit -m "feat(notepad): mobile Connection Cards segment shows contextual empty states

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — no regressions across the suite.

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors in the touched files.

- [ ] **Step 4 (manual, optional): Eyeball the four states on mobile**

Run the app, open the notepad on a mobile viewport, select the **Connection Cards** segment, and confirm:
- a short/new note shows the "No connections lit yet" checklist with the correct ✓ / ·,
- a qualifying note whose embedding is pending shows "The lamp is reading…",
- a qualifying note with no neighbors shows "Nothing echoes yet",
- the desktop Content tab strip still self-hides (unchanged).

---

## Self-Review Notes

- **Spec coverage:** four states (Task 2) ✓; hook `inactive` enrichment + `retry()` (Task 1) ✓; panel/strip refactor preserving desktop (Task 3) ✓; mobile wiring (Task 4) ✓; accessibility `role=status`/`aria-live` and text-not-color status (Task 2) ✓; tests for all three layers ✓.
- **Type consistency:** `ConnectionCardsState` enriched once in Task 1 and consumed by `ConnectionCardsEmpty` via `Exclude<…, { phase: 'ready' }>` (Task 2) and the panel's `state.phase !== 'ready'` branch (Task 3); `retry` added to `UseConnectionCardsResult` (Task 1) and consumed in the panel (Task 3). `showEmptyStates` defined on `ConnectionCardsPanelProps` (Task 3) and passed in Task 4.
- **No placeholders:** every code step shows complete code; every run step states the expected result.
