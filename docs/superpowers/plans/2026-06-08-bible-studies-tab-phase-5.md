# Bible Studies Tab — Phase 5 Implementation Plan (Reflection History Browser)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user revisit past reflections on a passage — browse the list of prior conversation threads (active + archived) for the open chapter and read any one of them, read-only.

**Architecture:** Pure client-side + RLS reads — no migration, no edge-function change. Two read hooks (`useChatThreadList`, `useThreadMessages`) feed two presentational components (`ChatHistoryList`, `ReflectionThreadView`). `LamplightChat` gains a small view-state machine: `live` (today's conversation, unchanged) → `list` (history) → `thread` (read-only past reflection).

**Tech Stack:** React 19 + Vite + Vitest/@testing-library. Reads `lamplight_chat_threads` and `lamplight_chat_messages` through the existing owner-only RLS — no new tables or policies.

**Prerequisite:** Phases 1–4 are merged. In particular Phase 4 created the `archived` flag, so a passage can have multiple threads; `useChatThread`, `ChatMessage`, `LamplightChat`, and `BibleStudyPane` exist.

**Scope boundary:** Read-only browsing of existing threads. No rename, no delete, no resuming an archived thread as the active one — those are possible Phase 6 items.

---

## Design decisions

- **Read-only.** Viewing a past thread shows its messages and a "Return to current reflection" control. No input box, no insight, no edits — keeps the data immutable from this surface.
- **List source.** All threads for `(user_id, passage_ref)` ordered newest-first. The active (non-archived) thread is labeled "Current"; the rest are dated. Titles already exist (set at thread creation in Phase 2).
- **No counts/previews in V1.** Listing avoids per-thread message-count queries (N+1). A card shows title + date + Current/Past badge. Message previews are a Phase 6 nicety.
- **Entry point.** A "History" button in `LamplightChat`'s header (alongside Phase 4's "+ New reflection"). Always present; the list view handles the empty case.

## File structure

- Create `src/notepad/bible/useChatThreadList.ts` (+ test) — list threads for a passage.
- Create `src/notepad/bible/useThreadMessages.ts` (+ test) — load one thread's messages by id.
- Create `src/notepad/components/lamplight/chat/ChatHistoryList.tsx` (+ test) — thread cards.
- Create `src/notepad/components/lamplight/chat/ReflectionThreadView.tsx` (+ test) — read-only message view.
- Modify `src/notepad/components/lamplight/chat/LamplightChat.tsx` (+ test) — view switching + History button.

---

### Task 1: `useChatThreadList` hook

**Files:**
- Create: `src/notepad/bible/useChatThreadList.ts`
- Test: `src/notepad/bible/useChatThreadList.test.ts`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// src/notepad/bible/useChatThreadList.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

const order = vi.fn();
const eq2 = vi.fn(() => builder);
const eq1 = vi.fn(() => builder);
const select = vi.fn(() => builder);
const from = vi.fn(() => builder);
let orderResult: { data: unknown; error: unknown } = { data: [], error: null };
const builder = { select, eq: eq1, order, then: (r: (v: unknown) => unknown) => Promise.resolve(r(orderResult)) };
order.mockImplementation(() => builder);
eq1.mockImplementation(() => ({ eq: eq2, order }));
eq2.mockImplementation(() => ({ order }));

vi.mock('@/lib/supabase', () => ({ supabase: { from } }));
import { useChatThreadList } from './useChatThreadList';

beforeEach(() => {
  vi.clearAllMocks();
  from.mockImplementation(() => builder);
  select.mockImplementation(() => builder);
  eq1.mockImplementation(() => ({ eq: eq2, order }));
  eq2.mockImplementation(() => ({ order }));
  order.mockImplementation(() => builder);
  orderResult = { data: [], error: null };
});
afterEach(cleanup);

describe('useChatThreadList', () => {
  it('returns [] for a passage with no threads', async () => {
    const { result } = renderHook(() => useChatThreadList('jhn', 10, 'u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.threads).toEqual([]);
    expect(from).toHaveBeenCalledWith('lamplight_chat_threads');
  });

  it('maps thread rows newest-first', async () => {
    orderResult = {
      data: [
        { id: 't2', title: 'On the gate', created_at: '2026-06-02T00:00:00Z', archived: false },
        { id: 't1', title: 'Study of John 10', created_at: '2026-06-01T00:00:00Z', archived: true },
      ],
      error: null,
    };
    const { result } = renderHook(() => useChatThreadList('jhn', 10, 'u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.threads.map((t) => t.id)).toEqual(['t2', 't1']);
    expect(result.current.threads[0].archived).toBe(false);
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/bible/useChatThreadList.test.ts`
Expected: FAIL — cannot resolve `./useChatThreadList`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/notepad/bible/useChatThreadList.ts
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ChatThreadSummary {
  id: string;
  title: string;
  created_at: string;
  archived: boolean;
}

export interface UseChatThreadListResult {
  threads: ChatThreadSummary[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useChatThreadList(book: string, chapter: number, userId: string | null): UseChatThreadListResult {
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const passageRef = `${book}.${chapter}`;
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setThreads([]);

    if (!supabase || !userId) { setLoading(false); return; }

    (async () => {
      const { data, error: qErr } = await supabase
        .from('lamplight_chat_threads')
        .select('id, title, created_at, archived')
        .eq('user_id', userId)
        .eq('passage_ref', passageRef)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (qErr) { setError(qErr.message); setThreads([]); }
      else setThreads((data ?? []) as ChatThreadSummary[]);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [passageRef, userId, nonce]);

  return { threads, loading, error, reload };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/bible/useChatThreadList.test.ts`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/bible/useChatThreadList.ts src/notepad/bible/useChatThreadList.test.ts
git commit -m "feat(bible): useChatThreadList lists a passage's reflection threads"
```

---

### Task 2: `useThreadMessages` hook

**Files:**
- Create: `src/notepad/bible/useThreadMessages.ts`
- Test: `src/notepad/bible/useThreadMessages.test.ts`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// src/notepad/bible/useThreadMessages.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

const order = vi.fn();
const eq = vi.fn(() => builder);
const select = vi.fn(() => builder);
const from = vi.fn(() => builder);
let orderResult: { data: unknown; error: unknown } = { data: [], error: null };
const builder = { select, eq, order, then: (r: (v: unknown) => unknown) => Promise.resolve(r(orderResult)) };
order.mockImplementation(() => builder);
eq.mockImplementation(() => builder);

vi.mock('@/lib/supabase', () => ({ supabase: { from } }));
import { useThreadMessages } from './useThreadMessages';

beforeEach(() => {
  vi.clearAllMocks();
  from.mockImplementation(() => builder);
  select.mockImplementation(() => builder);
  eq.mockImplementation(() => builder);
  order.mockImplementation(() => builder);
  orderResult = { data: [], error: null };
});
afterEach(cleanup);

describe('useThreadMessages', () => {
  it('does not query when threadId is null', async () => {
    const { result } = renderHook(() => useThreadMessages(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(from).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it('loads ordered messages for a thread id', async () => {
    orderResult = {
      data: [
        { id: 'm1', role: 'user', content: 'q', citations: [] },
        { id: 'm2', role: 'assistant', content: 'a', citations: [{ type: 'verse', ref: 'jhn 10:11' }] },
      ],
      error: null,
    };
    const { result } = renderHook(() => useThreadMessages('t1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(eq).toHaveBeenCalledWith('thread_id', 't1');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(result.current.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/bible/useThreadMessages.test.ts`
Expected: FAIL — cannot resolve `./useThreadMessages`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/notepad/bible/useThreadMessages.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ChatThreadMessage } from './useChatThread';

export interface UseThreadMessagesResult {
  messages: ChatThreadMessage[];
  loading: boolean;
  error: string | null;
}

/** Load one thread's messages (read-only history view). No-ops on a null id. */
export function useThreadMessages(threadId: string | null): UseThreadMessagesResult {
  const [messages, setMessages] = useState<ChatThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessages([]);

    if (!supabase || !threadId) { setLoading(false); return; }

    (async () => {
      const { data, error: qErr } = await supabase
        .from('lamplight_chat_messages')
        .select('id, role, content, citations')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (qErr) { setError(qErr.message); setMessages([]); }
      else setMessages((data ?? []) as ChatThreadMessage[]);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [threadId]);

  return { messages, loading, error };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/bible/useThreadMessages.test.ts`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/bible/useThreadMessages.ts src/notepad/bible/useThreadMessages.test.ts
git commit -m "feat(bible): useThreadMessages loads one reflection thread read-only"
```

---

### Task 3: `ChatHistoryList` component

**Files:**
- Create: `src/notepad/components/lamplight/chat/ChatHistoryList.tsx`
- Test: `src/notepad/components/lamplight/chat/ChatHistoryList.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// src/notepad/components/lamplight/chat/ChatHistoryList.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ChatHistoryList } from './ChatHistoryList';

afterEach(cleanup);

const threads = [
  { id: 't2', title: 'On the gate', created_at: '2026-06-02T00:00:00Z', archived: false },
  { id: 't1', title: 'Study of John 10', created_at: '2026-06-01T00:00:00Z', archived: true },
];

describe('ChatHistoryList', () => {
  it('shows an empty state when there are no threads', () => {
    render(<ChatHistoryList threads={[]} loading={false} onSelect={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText(/no past reflections/i)).toBeInTheDocument();
  });

  it('labels the active thread Current and the rest Past, and selects on click', () => {
    const onSelect = vi.fn();
    render(<ChatHistoryList threads={threads} loading={false} onSelect={onSelect} onBack={vi.fn()} />);
    expect(screen.getByText('On the gate')).toBeInTheDocument();
    expect(screen.getByText(/current/i)).toBeInTheDocument();
    expect(screen.getByText(/past/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Study of John 10'));
    expect(onSelect).toHaveBeenCalledWith('t1');
  });

  it('calls onBack from the back control', () => {
    const onBack = vi.fn();
    render(<ChatHistoryList threads={threads} loading={false} onSelect={vi.fn()} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back to current/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/components/lamplight/chat/ChatHistoryList.test.tsx`
Expected: FAIL — cannot resolve `./ChatHistoryList`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/notepad/components/lamplight/chat/ChatHistoryList.tsx
import { ChevronLeft } from 'lucide-react';
import type { ChatThreadSummary } from '@/notepad/bible/useChatThreadList';

export interface ChatHistoryListProps {
  threads: ChatThreadSummary[];
  loading: boolean;
  onSelect: (threadId: string) => void;
  onBack: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export function ChatHistoryList({ threads, loading, onSelect, onBack }: ChatHistoryListProps) {
  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'Outfit, sans-serif' }}>
      <div className="flex items-center gap-1 px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--pale-stone)' }}>
        <button
          aria-label="Back to current reflection"
          onClick={onBack}
          className="flex items-center gap-1 text-[11px]"
          style={{ color: 'var(--deep-umber)' }}
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to current
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && <p className="text-[11px]" style={{ color: 'var(--silica)' }}>Loading history…</p>}
        {!loading && threads.length === 0 && (
          <p className="text-[11px]" style={{ color: 'var(--silica)' }}>No past reflections for this passage yet.</p>
        )}
        {!loading && threads.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className="w-full text-left p-2.5 rounded-md"
            style={{ background: '#fff', border: '1px solid var(--pale-stone)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium truncate" style={{ color: 'var(--deep-umber)' }}>
                {t.title || 'Untitled reflection'}
              </span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0"
                style={{
                  background: t.archived ? 'rgba(188,179,163,0.25)' : 'rgba(196,154,120,0.18)',
                  color: t.archived ? 'var(--silica)' : '#8a6c50',
                }}
              >
                {t.archived ? 'Past' : 'Current'}
              </span>
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--silica)' }}>{formatDate(t.created_at)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/components/lamplight/chat/ChatHistoryList.test.tsx`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/chat/ChatHistoryList.tsx src/notepad/components/lamplight/chat/ChatHistoryList.test.tsx
git commit -m "feat(bible): ChatHistoryList of a passage's reflection threads"
```

---

### Task 4: `ReflectionThreadView` (read-only message view)

**Files:**
- Create: `src/notepad/components/lamplight/chat/ReflectionThreadView.tsx`
- Test: `src/notepad/components/lamplight/chat/ReflectionThreadView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// src/notepad/components/lamplight/chat/ReflectionThreadView.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const useThreadMessages = vi.fn();
vi.mock('@/notepad/bible/useThreadMessages', () => ({ useThreadMessages: (...a: unknown[]) => useThreadMessages(...a) }));

import { ReflectionThreadView } from './ReflectionThreadView';

afterEach(cleanup);

describe('ReflectionThreadView', () => {
  it('renders the thread messages read-only with no input box', () => {
    useThreadMessages.mockReturnValue({
      loading: false, error: null,
      messages: [
        { id: 'm1', role: 'user', content: 'What is the gate?', citations: [] },
        { id: 'm2', role: 'assistant', content: 'Christ is the gate.', citations: [] },
      ],
    });
    render(<ReflectionThreadView threadId="t1" onBack={vi.fn()} />);
    expect(screen.getByText('What is the gate?')).toBeInTheDocument();
    expect(screen.getByText('Christ is the gate.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/ask about this passage/i)).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  it('calls onBack', () => {
    useThreadMessages.mockReturnValue({ loading: false, error: null, messages: [] });
    const onBack = vi.fn();
    render(<ReflectionThreadView threadId="t1" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back to history/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/components/lamplight/chat/ReflectionThreadView.test.tsx`
Expected: FAIL — cannot resolve `./ReflectionThreadView`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/notepad/components/lamplight/chat/ReflectionThreadView.tsx
import { ChevronLeft } from 'lucide-react';
import { useThreadMessages } from '@/notepad/bible/useThreadMessages';
import { ChatMessage } from './ChatMessage';

export interface ReflectionThreadViewProps {
  threadId: string;
  onBack: () => void;
}

export function ReflectionThreadView({ threadId, onBack }: ReflectionThreadViewProps) {
  const { messages, loading, error } = useThreadMessages(threadId);

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'Outfit, sans-serif', background: 'rgba(255,255,255,0.45)' }}>
      <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--pale-stone)' }}>
        <button
          aria-label="Back to history"
          onClick={onBack}
          className="flex items-center gap-1 text-[11px]"
          style={{ color: 'var(--deep-umber)' }}
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to history
        </button>
        <span className="text-[9px] tracking-wider" style={{ color: 'var(--silica)' }}>READ-ONLY</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && <p className="text-[11px]" style={{ color: 'var(--silica)' }}>Loading reflection…</p>}
        {error && !loading && <p className="text-[11px]" style={{ color: '#b45454' }}>{error}</p>}
        {!loading && !error && messages.map((m) => (
          <ChatMessage key={m.id} role={m.role} content={m.content} citations={m.citations} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/components/lamplight/chat/ReflectionThreadView.test.tsx`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/chat/ReflectionThreadView.tsx src/notepad/components/lamplight/chat/ReflectionThreadView.test.tsx
git commit -m "feat(bible): ReflectionThreadView renders a past thread read-only"
```

---

### Task 5: Wire history into `LamplightChat`

Add a `History` button and a three-state view (`live` → `list` → `thread`).

**Files:**
- Modify: `src/notepad/components/lamplight/chat/LamplightChat.tsx`
- Test: `src/notepad/components/lamplight/chat/LamplightChat.test.tsx` (append)

- [ ] **Step 1: Add the failing tests (append)**

Extend the mocks at the top of the file to cover the history pieces:

```tsx
const useChatThreadList = vi.fn(() => ({ threads: [], loading: false, error: null, reload: vi.fn() }));
vi.mock('@/notepad/bible/useChatThreadList', () => ({ useChatThreadList: (...a: unknown[]) => useChatThreadList(...a) }));
vi.mock('./ChatHistoryList', () => ({
  ChatHistoryList: (p: { onSelect: (id: string) => void; onBack: () => void }) => (
    <div data-testid="history-list">
      <button onClick={() => p.onSelect('t1')}>open-t1</button>
      <button onClick={p.onBack}>list-back</button>
    </div>
  ),
}));
vi.mock('./ReflectionThreadView', () => ({
  ReflectionThreadView: (p: { threadId: string; onBack: () => void }) => (
    <div data-testid="thread-view">{p.threadId}<button onClick={p.onBack}>thread-back</button></div>
  ),
}));
```

Then append:

```tsx
describe('LamplightChat history', () => {
  it('opens the history list, then a thread, then returns to live', async () => {
    setup(); // live thread with messages, from the existing helper
    render(<LamplightChat book="jhn" chapter={10} userId="u1" invoke={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    expect(screen.getByTestId('history-list')).toBeInTheDocument();

    fireEvent.click(screen.getByText('open-t1'));
    expect(screen.getByTestId('thread-view')).toHaveTextContent('t1');

    fireEvent.click(screen.getByText('thread-back'));
    expect(screen.getByTestId('history-list')).toBeInTheDocument();

    fireEvent.click(screen.getByText('list-back'));
    expect(screen.queryByTestId('history-list')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ask about this passage/i)).toBeInTheDocument();
  });
});
```

> Ensure the shared `setup()` default `useChatThread.mockReturnValue` includes `archiveAndReset: vi.fn()` (from Phase 4) so the live view renders.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/components/lamplight/chat/LamplightChat.test.tsx`
Expected: FAIL — no History button / view switching.

- [ ] **Step 3: Implement view switching**

3a. Update imports:

```tsx
import { useChatThreadList } from '@/notepad/bible/useChatThreadList';
import { ChatHistoryList } from './ChatHistoryList';
import { ReflectionThreadView } from './ReflectionThreadView';
```

3b. Add view state + the thread list hook inside the component (near the other state):

```tsx
  type View = { kind: 'live' } | { kind: 'list' } | { kind: 'thread'; threadId: string };
  const [view, setView] = useState<View>({ kind: 'live' });
  const history = useChatThreadList(book, chapter, userId);
```

3c. Reset to `live` whenever the passage changes (so navigating chapters never strands you in an old chapter's history). Add to the existing passage-keyed `useEffect` deps area, or add a dedicated effect:

```tsx
  useEffect(() => { setView({ kind: 'live' }); }, [passageKey]);
```

3d. Render the non-live views early (before the live markup return). At the top of the returned JSX, branch:

```tsx
  if (view.kind === 'list') {
    return (
      <ChatHistoryList
        threads={history.threads}
        loading={history.loading}
        onSelect={(threadId) => setView({ kind: 'thread', threadId })}
        onBack={() => setView({ kind: 'live' })}
      />
    );
  }
  if (view.kind === 'thread') {
    return <ReflectionThreadView threadId={view.threadId} onBack={() => setView({ kind: 'list' })} />;
  }
```

3e. Add a `History` button to the live header. In the header row that holds Phase 4's "+ New reflection" button, add (before or after it):

```tsx
        <button
          onClick={() => { history.reload(); setView({ kind: 'list' }); }}
          className="text-[10px] tracking-wider px-2 py-1 rounded-full"
          style={{ color: 'var(--silica)', border: '1px solid var(--pale-stone)', fontFamily: 'Outfit, sans-serif' }}
        >
          History
        </button>
```

> Place both header buttons in a `flex gap-2` container so "History" and "+ New reflection" sit together.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/components/lamplight/chat/LamplightChat.test.tsx`
Expected: PASS (all prior cases + the history flow).

- [ ] **Step 5: Typecheck + lint + full suite**

Run: `npx tsc -b --noEmit && npm run lint && npm run test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/notepad/components/lamplight/chat/LamplightChat.tsx src/notepad/components/lamplight/chat/LamplightChat.test.tsx
git commit -m "feat(bible): reflection history browser in LamplightChat (live → list → thread)"
```

---

### Task 6: Manual verification

**Files:** none (manual). No deploy required — Phase 5 is client-only on existing tables/RLS.

- [ ] **Step 1: Run the app**

Run: `npm run dev`

- [ ] **Step 2: Verify (desktop and mobile More-sheet Bible segment)**
  - On a passage with at least one past reflection (use Phase 4's "+ New reflection" to create one), tap **History** → the list shows the current thread (Current badge) and past ones (Past badge), newest first.
  - Tap a past thread → its messages render read-only (no input box, "READ-ONLY" label).
  - "Back to history" returns to the list; "Back to current" returns to the live conversation with the input restored.
  - Navigate to a different chapter → the view resets to live for that chapter; History shows that chapter's threads only.
  - As a different user, confirm you never see another user's threads (RLS) — already covered by the Phase 2 chat RLS test.

- [ ] **Step 3: No commit** (verification only).

---

## Self-Review

- **Roadmap coverage:** "list a passage's archived threads so the user can revisit past studies (read-only UI)" ✓ — `useChatThreadList` (Task 1), `useThreadMessages` (Task 2), `ChatHistoryList` (Task 3), `ReflectionThreadView` (Task 4), wired into `LamplightChat` (Task 5).
- **No backend changes:** reads existing `lamplight_chat_threads` / `lamplight_chat_messages` under existing owner RLS — no migration, no edge-function change, no deploy. Correct for a read-only browser.
- **Placeholder scan:** none — complete code per step; commands have expected output.
- **Type consistency:** `ChatThreadSummary` (Task 1) consumed by `ChatHistoryList` (Task 3) and `LamplightChat` (Task 5); `ChatThreadMessage` (from Phase 2's `useChatThread`) reused by `useThreadMessages` (Task 2) and rendered via the existing `ChatMessage` (Task 4); `passageKey` from Phase 3 reused to reset the view on navigation (Task 5).
- **State-reset guard:** view resets to `live` on passage change (Task 5, Step 3c) so chapter navigation never strands the user in a stale history view — verified in Task 6 manual step.

## Follow-on (possible Phase 6)

- Rename a reflection; delete an archived reflection; "resume" an archived thread as the active one (un-archive + re-archive the current); per-thread message-count/preview in the list.
