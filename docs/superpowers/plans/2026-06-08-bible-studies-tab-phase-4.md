# Bible Studies Tab — Phase 4 Implementation Plan (Mobile Parity + New-Reflection Affordance)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Bible Studies experience (reader + gated chat + proactive insight) to mobile, and let a user start a fresh reflection thread for a passage they've already studied.

**Architecture:** Part A adds a **Bible** segment to the existing `MobileMoreSheet` (which already hosts the graph), rendering the same `BibleStudyPane` used on desktop — so mobile reuses all Phase 1–3 work. Part B replaces the "one thread per passage forever" rule with "one *active* thread per passage" (an `archived` flag + partial-unique index), and adds a "Start a new reflection" control that archives the current thread so a new one (and a fresh opening insight) begins.

**Tech Stack:** React 19 + Vite + Vitest/@testing-library (client); Supabase Postgres migration + the Deno `lamplight-chat` function (server).

**Prerequisite:** Phases 1–3 are merged — `BibleStudyPane`, `LamplightChat`, `useChatThread`, `lamplight-chat-client`, `requestOpeningInsight`, and the `lamplight-chat` function (`mode: 'chat' | 'insight'`) all exist.

**Scope boundary:** Mobile parity + fresh-thread reset only. No thread *history browser* (listing past archived reflections) — that's a possible Phase 5.

---

## Part A — Mobile parity

### Task 1: Add a Bible segment to `MobileMoreSheet`

`MobileMoreSheet` currently shows `Backlinks | Info | Graph`. Add `Bible` and render `BibleStudyPane`. The sheet needs the Lamplight adapter + an `invoke` function (passed in Task 2).

**Files:**
- Modify: `src/components/sections/notepad/mobile/MobileMoreSheet.tsx`
- Test: `src/components/sections/notepad/mobile/MobileMoreSheet.test.tsx`

- [ ] **Step 1: Add the failing test (append to the existing describe)**

At the top of `MobileMoreSheet.test.tsx`, add a mock for `BibleStudyPane`:

```tsx
vi.mock('@/notepad/bible/BibleStudyPane', () => ({ BibleStudyPane: () => <div data-testid="bible-study">bible</div> }));
```

Then append a test (the existing tests render `<MobileMoreSheet open onClose={...} onOpenNote={...} />`; add the two new props):

```tsx
it('shows the Bible study pane on the Bible segment', () => {
  const { getByRole, getByTestId } = render(
    <MobileMoreSheet open onClose={() => {}} onOpenNote={() => {}} lamplightAdapter={null} invoke={vi.fn()} />,
  );
  fireEvent.click(getByRole('button', { name: /bible/i }));
  expect(getByTestId('bible-study')).toBeInTheDocument();
});
```

> Ensure `fireEvent` is imported from `@testing-library/react` in this test file (add it if missing). The existing render calls also need the new `lamplightAdapter={null} invoke={vi.fn()}` props — add them so the file type-checks.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/sections/notepad/mobile/MobileMoreSheet.test.tsx`
Expected: FAIL — no Bible segment / `MobileMoreSheet` doesn't accept `lamplightAdapter`/`invoke`.

- [ ] **Step 3: Implement**

3a. Update imports + type:

```tsx
import { BibleStudyPane } from '@/notepad/bible/BibleStudyPane';
import type { LamplightAdapter } from '../../../../notepad/storage/lamplight-adapter';
import type { InvokeFn } from '@/notepad/bible/lamplight-chat-client';
```

3b. Change the segment union and props interface:

```tsx
type DetailSegment = 'backlinks' | 'info' | 'graph' | 'bible';

export interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenNote: (id: string) => void;
  lamplightAdapter: LamplightAdapter | null;
  invoke: InvokeFn;
}
```

3c. Update the function signature:

```tsx
export function MobileMoreSheet({ open, onClose, onOpenNote, lamplightAdapter, invoke }: MobileMoreSheetProps) {
```

3d. Add `Bible` to the `Segmented` options array (after `graph`):

```tsx
              { value: 'graph', label: 'Graph' },
              { value: 'bible', label: 'Bible' },
```

3e. Render the pane (add after the `segment === 'graph'` block, before the closing `</div>` of the scroll area):

```tsx
          {segment === 'bible' && (
            <div className="h-full min-h-[60vh]">
              <BibleStudyPane lamplightAdapter={lamplightAdapter} invoke={invoke} />
            </div>
          )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/sections/notepad/mobile/MobileMoreSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/MobileMoreSheet.tsx src/components/sections/notepad/mobile/MobileMoreSheet.test.tsx
git commit -m "feat(mobile): Bible study segment in the More sheet"
```

---

### Task 2: Expose `invoke` from the workspace model and pass props through

**Files:**
- Modify: `src/components/sections/notepad/mobile/useMobileWorkspaceModel.ts`
- Modify: `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx`
- Test: `src/components/sections/notepad/mobile/useMobileWorkspaceModel.test.tsx` (append a light assertion)

- [ ] **Step 1: Add the failing test (append)**

```tsx
it('exposes an invoke function', () => {
  const { result } = renderHook(() => useMobileWorkspaceModel(), { wrapper: Wrapper });
  expect(typeof result.current.invoke).toBe('function');
});
```

> Reuse whatever provider `Wrapper`/setup the existing `useMobileWorkspaceModel.test.tsx` already defines. If the file has no such helper, model this after the existing test's render setup in that file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/sections/notepad/mobile/useMobileWorkspaceModel.test.tsx`
Expected: FAIL — `invoke` is not on the model.

- [ ] **Step 3: Implement**

3a. In `useMobileWorkspaceModel.ts`, import the type and add `invoke` to the interface:

```ts
import type { InvokeFn } from '@/notepad/bible/lamplight-chat-client';
```

Add to `MobileWorkspaceModel`:

```ts
  invoke: InvokeFn;
```

3b. Build a stable `invoke` (no-op when offline/unconfigured) and return it. Add before the `return`:

```ts
  const invoke: InvokeFn = useCallback(
    (name, options) =>
      supabase
        ? supabase.functions.invoke(name, options)
        : Promise.resolve({ data: null, error: { message: 'offline' } }),
    [],
  );
```

Add `invoke` to the returned object:

```ts
    loadNeighborNotes,
    invoke,
  };
```

3c. In `MobileNotepadWorkspace.tsx`, pass the new props to `MobileMoreSheet` (line ~175):

```tsx
      <MobileMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onOpenNote={handleOpenNote}
        lamplightAdapter={model.lamplightAdapter}
        invoke={model.invoke}
      />
```

- [ ] **Step 4: Run test + typecheck + lint + full suite**

Run: `npm run test -- src/components/sections/notepad/mobile/useMobileWorkspaceModel.test.tsx && npx tsc -b --noEmit && npm run lint && npm run test`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/mobile/useMobileWorkspaceModel.ts src/components/sections/notepad/mobile/useMobileWorkspaceModel.test.tsx src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx
git commit -m "feat(mobile): thread lamplightAdapter + invoke into the More sheet"
```

---

## Part B — New-reflection affordance (fresh thread)

### Task 3: Migration — `archived` flag + active-thread partial unique

**Files:**
- Create: `supabase/migrations/025_lamplight_chat_thread_archive.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/025_lamplight_chat_thread_archive.sql
-- Allow a user to start a fresh reflection on a passage they've already studied.
-- The "one thread per passage" rule becomes "one ACTIVE (non-archived) thread
-- per passage": archive the current thread, and a new one can begin.

alter table public.lamplight_chat_threads
  add column archived boolean not null default false;

-- Replace the unconditional unique with a partial unique over active threads.
alter table public.lamplight_chat_threads
  drop constraint lamplight_chat_threads_user_id_passage_ref_key;

create unique index lamplight_chat_threads_active_passage
  on public.lamplight_chat_threads (user_id, passage_ref)
  where archived = false;
```

> The dropped constraint name `lamplight_chat_threads_user_id_passage_ref_key` is Postgres's default for `unique (user_id, passage_ref)` from migration 024. Verify with `\d public.lamplight_chat_threads` before applying; if your local Postgres named it differently, drop that name instead.

- [ ] **Step 2: Apply + verify**

Run: `supabase db reset` (local) or `supabase migration up`.
Expected: `025` applies; `\d public.lamplight_chat_threads` shows the `archived` column and the partial unique index.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/025_lamplight_chat_thread_archive.sql
git commit -m "feat(db): archived flag + active-thread partial unique for chat threads"
```

---

### Task 4: Server + client read only the active thread

**Files:**
- Modify: `supabase/functions/lamplight-chat/index.ts` (`upsertThread`)
- Modify: `src/notepad/bible/useChatThread.ts`
- Test: `src/notepad/bible/useChatThread.test.ts` (append)

- [ ] **Step 1: Add the failing test (append to `useChatThread.test.ts`)**

```ts
it('only loads the active (non-archived) thread', async () => {
  maybeSingle.mockResolvedValue({ data: { id: 't1' }, error: null });
  orderResult = { data: [], error: null };
  const { result } = renderHook(() => useChatThread('jhn', 10, 'u1'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(eqThread).toHaveBeenCalledWith('archived', false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/bible/useChatThread.test.ts`
Expected: FAIL — `archived` filter not applied.

- [ ] **Step 3: Implement**

3a. In `useChatThread.ts`, add the `archived` filter to the thread lookup:

```ts
      const thread = await supabase
        .from('lamplight_chat_threads')
        .select('id')
        .eq('user_id', userId)
        .eq('passage_ref', passageRef)
        .eq('archived', false)
        .maybeSingle();
```

3b. In `lamplight-chat/index.ts`, update `upsertThread`'s existing-row lookup AND the race re-read to filter active threads:

```ts
  const existing = await supabase
    .from('lamplight_chat_threads').select('id')
    .eq('user_id', userId).eq('passage_ref', passageRef).eq('archived', false).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;
```

and the re-read:

```ts
  const reread = await supabase
    .from('lamplight_chat_threads').select('id')
    .eq('user_id', userId).eq('passage_ref', passageRef).eq('archived', false).single();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/bible/useChatThread.test.ts`
Expected: PASS (Phase 2/3 cases + the new one).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/bible/useChatThread.ts supabase/functions/lamplight-chat/index.ts src/notepad/bible/useChatThread.test.ts
git commit -m "feat(lamplight): read only the active thread per passage"
```

---

### Task 5: "Start a new reflection" — archive + reset

Add `archiveAndReset` to `useChatThread` (sets `archived = true` on the active thread, then reloads → empty), and a button in `LamplightChat` that calls it and clears the insight guard so a fresh opening insight fires.

**Files:**
- Modify: `src/notepad/bible/useChatThread.ts`
- Test: `src/notepad/bible/useChatThread.test.ts` (append)
- Modify: `src/notepad/components/lamplight/chat/LamplightChat.tsx`
- Test: `src/notepad/components/lamplight/chat/LamplightChat.test.tsx` (append)

- [ ] **Step 1: Add the failing hook test (append)**

```ts
it('archiveAndReset archives the active thread then reloads', async () => {
  maybeSingle.mockResolvedValue({ data: { id: 't1' }, error: null });
  orderResult = { data: [{ id: 'm1', role: 'assistant', content: 'x', citations: [] }], error: null };

  // update().eq().eq().eq() chain returns { error: null }
  const updEq3 = vi.fn().mockResolvedValue({ error: null });
  const updEq2 = vi.fn(() => ({ eq: updEq3 }));
  const updEq1 = vi.fn(() => ({ eq: updEq2 }));
  const update = vi.fn(() => ({ eq: updEq1 }));
  from.mockImplementation((t: string) =>
    t === 'lamplight_chat_threads' ? { ...threadBuilder, update } : msgBuilder,
  );

  const { result } = renderHook(() => useChatThread('jhn', 10, 'u1'));
  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () => { await result.current.archiveAndReset(); });
  expect(update).toHaveBeenCalledWith({ archived: true });
});
```

> Add `act` to the testing-library import in this file: `import { renderHook, waitFor, cleanup, act } from '@testing-library/react';`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/bible/useChatThread.test.ts`
Expected: FAIL — `archiveAndReset` not defined.

- [ ] **Step 3: Implement `archiveAndReset` in `useChatThread.ts`**

3a. Add it to the result interface:

```ts
  /** Archive the active thread for this passage, then reload (becomes empty). */
  archiveAndReset: () => Promise<void>;
```

3b. Implement inside the hook (after `append`):

```ts
  const archiveAndReset = useCallback(async () => {
    if (!supabase || !userId) return;
    await supabase
      .from('lamplight_chat_threads')
      .update({ archived: true })
      .eq('user_id', userId)
      .eq('passage_ref', passageRef)
      .eq('archived', false);
    setMessages([]);
    setNonce((n) => n + 1);
  }, [userId, passageRef]);
```

3c. Return it:

```ts
  return { messages, loading, error, append, reload, archiveAndReset };
```

- [ ] **Step 4: Run hook test to verify it passes**

Run: `npm run test -- src/notepad/bible/useChatThread.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the failing LamplightChat test (append)**

```tsx
it('archives + clears the insight guard so a fresh insight can fire', async () => {
  const archiveAndReset = vi.fn().mockResolvedValue(undefined);
  useChatThread.mockReturnValue({
    messages: [{ id: 'm1', role: 'assistant', content: 'old insight', citations: [] }],
    loading: false, error: null, append: vi.fn(), reload: vi.fn(), archiveAndReset,
  });
  render(<LamplightChat book="jhn" chapter={10} userId="u1" invoke={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /new reflection/i }));
  await waitFor(() => expect(archiveAndReset).toHaveBeenCalledTimes(1));
});
```

> Make sure the per-test `useChatThread.mockReturnValue` calls elsewhere in the file include `archiveAndReset: vi.fn()` so the component never calls an undefined function (add it to the shared `setup` default).

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test -- src/notepad/components/lamplight/chat/LamplightChat.test.tsx`
Expected: FAIL — no "New reflection" button.

- [ ] **Step 7: Implement the button in `LamplightChat.tsx`**

7a. Add a handler inside the component (after the `send` function):

```tsx
  const startNewReflection = async () => {
    insightAttempted.current.delete(passageKey); // allow a fresh opening insight
    await thread.archiveAndReset();
  };
```

7b. Add the control to the header area. Replace the messages-area wrapper's opening (or add a small header row above the scroll area) with a header containing the button — insert this as the first child of the component's outer `<div className="flex flex-col h-full" ...>`:

```tsx
      <div className="flex justify-end px-3 pt-2 shrink-0">
        <button
          onClick={() => void startNewReflection()}
          className="text-[10px] tracking-wider px-2 py-1 rounded-full"
          style={{ color: 'var(--silica)', border: '1px solid var(--pale-stone)', fontFamily: 'Outfit, sans-serif' }}
        >
          + New reflection
        </button>
      </div>
```

- [ ] **Step 8: Run test + typecheck + lint + full suite**

Run: `npm run test -- src/notepad/components/lamplight/chat/LamplightChat.test.tsx && npx tsc -b --noEmit && npm run lint && npm run test`
Expected: green.

- [ ] **Step 9: Commit**

```bash
git add src/notepad/bible/useChatThread.ts src/notepad/bible/useChatThread.test.ts src/notepad/components/lamplight/chat/LamplightChat.tsx src/notepad/components/lamplight/chat/LamplightChat.test.tsx
git commit -m "feat(bible): Start-a-new-reflection archives the thread and re-fires insight"
```

---

### Task 6: Deploy + manual verification

**Files:** none (ops/manual).

- [ ] **Step 1: Apply migration + redeploy function**

Run:
```bash
supabase db push
supabase functions deploy lamplight-chat
```
Expected: `025` applied; function redeploys clean.

- [ ] **Step 2: Manual — mobile**
  - On a phone viewport (or device): open the **More** sheet → **Bible** segment.
  - Confirm the reader works, the Lamplight toggle gates correctly (paywall / sign-in), and chat + opening insight behave as on desktop.

- [ ] **Step 3: Manual — new reflection**
  - Open a passage with an existing conversation → tap **+ New reflection**.
  - Confirm the thread clears, a fresh opening insight fires, and the new conversation saves independently.
  - Reopen the passage later → the NEW (active) thread loads, not the archived one.
  - In the DB, confirm the prior thread row has `archived = true` and a new active row exists for the same `passage_ref`.

- [ ] **Step 4: No commit** (verification only).

---

## Self-Review

- **Spec/roadmap coverage:** mobile parity ✓ (Tasks 1–2 — reuses `BibleStudyPane`, so reader + gated chat + Phase 3 insight all come for free on mobile); new-reflection affordance ✓ (Tasks 3–5).
- **Placeholder scan:** none — complete code per step; commands have expected output.
- **Type consistency:** `InvokeFn` (from `lamplight-chat-client`) flows model → `MobileMoreSheet` → `BibleStudyPane` (Tasks 1–2); `archiveAndReset` added to `UseChatThreadResult` (Task 5) and consumed by `LamplightChat`; `insightAttempted`/`passageKey` from Phase 3 reused by `startNewReflection` so the guard clears correctly.
- **Consistency guard:** the active-thread filter (`archived = false`) is applied in BOTH the client read (`useChatThread`, Task 4) and the server `upsertThread` (Task 4) — they must agree, or a reset could read one thread while the server writes to another. Verified by the Task 4 test + Task 6 manual DB check.
- **Constraint-name risk:** Task 3 drops a Postgres-default constraint name; the step calls out verifying it with `\d` first. If the name differs in your environment, adjust before applying.

## Follow-on (possible Phase 5)

- **Reflection history browser:** list a passage's archived threads so the user can revisit past studies (the data already persists; this is read-only UI).
