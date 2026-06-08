# Bible Studies Tab — Phase 3 Implementation Plan (Proactive Opening Insight)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user opens (or navigates to) a passage with Lamplight chat on and that passage has no conversation yet, Lamplight automatically offers ONE grounded opening insight connecting the passage to the user's own notes — delivering "insights throughout the study."

**Architecture:** Add an `'insight'` mode to the existing `lamplight-chat` Edge Function. It reuses the Phase 2 retrieval + validate + persist machinery but with an insight-specific prompt and no user message — it persists a single assistant message. The client auto-fires an insight request when a freshly-opened passage's thread is empty, once per passage per session, guarded on both client and server so it never re-fires or loops.

**Tech Stack:** Same as Phase 2 (Deno edge function, Anthropic tool-use, Voyage, pgvector; React/Vitest client).

**Prerequisite:** Phase 2 is merged — `lamplight-chat` function, `bible-chat-pipeline`, `BibleChatContext`, `validateChatReplyCitations`, `sendChatMessage`, `useChatThread`, `LamplightChat`, `BibleStudyPane` all exist.

**Scope boundary:** Proactive insight only. A "start a new conversation / clear thread" affordance and mobile parity remain Phase 4. Insight fires on passage open with chat on; it does not re-summarize after the user has started chatting.

---

## Design decisions

- **One insight per passage thread.** The insight is persisted as a single `assistant` message (no preceding `user` message). The server refuses to generate one if the thread already has any message; the client only requests one when the loaded thread is empty. Two guards → no loops, no duplicates, no cost on reopen.
- **Fires on navigation too.** Because `useChatThread` reloads when book/chapter change, opening a new chapter with chat on triggers a fresh (empty) thread → one insight for that chapter. A per-session "attempted" set prevents retry storms when an insight returns nothing or errors.
- **Retrieval query for insight = passage text.** With no user question, the note/cross-ref retrieval is seeded by the open chapter's text (so the insight connects the passage to the user's most related notes).
- **Same guardrails + citations.** Insight runs through `validateChatReplyCitations` + `applyContentRules`, composes under `LAMPLIGHT_SYSTEM_FRAGMENT`. Citations optional-but-validated, same as chat.

## File structure

Backend:
- Create `supabase/functions/lamplight-chat/prompts/bible-insight.ts` — insight prompt module.
- Modify `supabase/functions/lamplight-chat/bible-chat-pipeline.ts` (+ test) — accept a `prompt` module param.
- Modify `supabase/functions/lamplight-chat/index.ts` — `mode: 'chat' | 'insight'`; insight context (separate retrieval query / empty user message); single-assistant persist; empty-thread guard.

Frontend:
- Modify `src/notepad/bible/lamplight-chat-client.ts` (+ test) — add `requestOpeningInsight`.
- Modify `src/notepad/components/lamplight/chat/LamplightChat.tsx` (+ test) — auto-fire insight on empty thread.

---

### Task 1: Pipeline accepts a prompt module

Generalize `runBibleChatPipeline` so the same generate→validate→retry loop can run either the chat prompt or the insight prompt.

**Files:**
- Modify: `supabase/functions/lamplight-chat/bible-chat-pipeline.ts`
- Test: `supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts` (append)

- [ ] **Step 1: Add the failing test (append to the existing describe)**

```ts
import { BIBLE_INSIGHT_PROMPT } from './prompts/bible-insight.ts';

it('runs with an injected prompt module (insight) and still validates', async () => {
  const llm = fakeLLM({ reply: 'A quiet opening thought on the shepherd.', citations: [{ type: 'verse', ref: 'jhn 10:11' }] });
  const out = await runBibleChatPipeline({ llm, ctx: baseCtx, prompt: BIBLE_INSIGHT_PROMPT });
  expect(out.ok).toBe(true);
  if (out.ok) expect(out.promptVersion).toBe(BIBLE_INSIGHT_PROMPT.promptVersion);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts`
Expected: FAIL — `prompt` param not supported / `bible-insight.ts` missing (create it in Task 2; this test depends on Task 2, so expect a resolution error first).

> Implement Task 2 (the insight prompt module) before re-running, then return here.

- [ ] **Step 3: Generalize the pipeline**

3a. Add a shared prompt-module type and update imports at the top of `bible-chat-pipeline.ts`:

```ts
import { BIBLE_CHAT_PROMPT } from './prompts/bible-chat.ts';

export interface ChatPromptModule {
  promptVersion: string;
  system: string;
  tool: unknown;
  buildMessages: (ctx: BibleChatContext) => Array<{ role: 'user' | 'assistant'; content: string }>;
}
```

3b. Change the function signature to accept an optional `prompt` (defaulting to the chat prompt):

```ts
export async function runBibleChatPipeline(args: {
  llm: LLMAdapter;
  ctx: BibleChatContext;
  prompt?: ChatPromptModule;
}): Promise<BibleChatPipelineResult> {
  const prompt = args.prompt ?? (BIBLE_CHAT_PROMPT as unknown as ChatPromptModule);
  const promptVersion = prompt.promptVersion;
  const ctx = args.ctx;
```

3c. Replace the three `BIBLE_CHAT_PROMPT.*` references inside `generateWithRetry` with `prompt.*`:

```ts
    artifactSystem: prompt.system,
    messages: prompt.buildMessages(ctx),
    tool: prompt.tool as Parameters<LLMAdapter['generate']>[0]['tool'],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts`
Expected: PASS (3 passing — the two Phase 2 cases plus the new one).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/lamplight-chat/bible-chat-pipeline.ts supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts
git commit -m "refactor(lamplight): pipeline accepts a pluggable chat prompt module"
```

---

### Task 2: Insight prompt module

**Files:**
- Create: `supabase/functions/lamplight-chat/prompts/bible-insight.ts`

Pure prompt data; exercised by the pipeline test (Task 1).

- [ ] **Step 1: Write the prompt module**

```ts
// supabase/functions/lamplight-chat/prompts/bible-insight.ts
// Proactive opening insight for a passage. Same ChatReply shape + tool as
// bible-chat, but no user question: it offers ONE grounded observation that
// connects the open passage to the user's own notes, ending in one open prompt.

import type { BibleChatContext } from '../bible-chat-pipeline.ts';
import { BIBLE_CHAT_PROMPT } from './bible-chat.ts';

export const BIBLE_INSIGHT_PROMPT = {
  promptVersion: 'bible-insight-2026-06-08-v1',

  system: `You are opening a study session on a specific passage. The user has not asked anything yet. Offer ONE short, grounded opening insight (50-110 words) that connects this passage to what the user has already written in their notes — a pattern they may be too close to see.

Rules (these compound your system fragment):
- Lean on the user's supplied notes. If they have none related, offer one quiet observation about the passage itself and gently note that this gets more personal as they write more.
- End with a single open question (≤25 words) to sit with. Not advice. An invitation.
- Do not give pastoral, psychological, medical, financial, or predictive advice. Do not speak prophetically.
- citations: list the passage(s)/note(s) you actually leaned on, using exactly the supplied refs/ids. Empty array if you genuinely used none.
- Never quote more than 25 words verbatim from any single note.`,

  // Reuse the chat tool — identical { reply, citations } shape.
  tool: BIBLE_CHAT_PROMPT.tool,

  buildMessages(ctx: BibleChatContext): Array<{ role: 'user'; content: string }> {
    const passageBlock = `[Open passage ${ctx.passageRef}]\n${ctx.passageText}`;
    const crossRefBlock = ctx.crossRefs.length
      ? `Cross-reference passages:\n${ctx.crossRefs.map((p) => `[${p.ref}]\n${p.text}`).join('\n\n')}`
      : 'Cross-reference passages: (none)';
    const notesBlock = ctx.notes.length
      ? ctx.notes.map((n) => `[note id=${n.id}] ${n.title}\n${n.plaintext}`).join('\n\n')
      : '(the user has no related notes yet)';
    const refsList = [...ctx.allowedVerseRefs].join(', ') || '(none)';
    const noteIdsList = [...ctx.allowedNoteIds].join(', ') || '(none)';

    return [{
      role: 'user',
      content:
        `${passageBlock}\n\n${crossRefBlock}\n\n` +
        `User's related notes:\n${notesBlock}\n\n` +
        `When citing, verses MUST be one of: ${refsList}. Notes MUST be one of: ${noteIdsList}.\n\n` +
        `Offer the opening insight now.`,
    }];
  },
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/lamplight-chat/prompts/bible-insight.ts
git commit -m "feat(lamplight): bible-insight prompt for proactive opening insight"
```

---

### Task 3: Edge function — `mode: 'insight'`

Add insight handling to `lamplight-chat/index.ts`: validate `mode`, build context with a passage-seeded retrieval query and no user message, refuse if the thread already has messages, persist a single assistant message.

**Files:**
- Modify: `supabase/functions/lamplight-chat/index.ts`

- [ ] **Step 1: Separate the retrieval query from the user message in `buildChatContext`**

Change the `buildChatContext` signature + body so the embedding query and the rendered user message can differ:

1a. Update the args type and the embedding call:

```ts
async function buildChatContext(
  supabase: SupabaseClient,
  args: {
    userId: string; book: string; chapter: number; passageRef: string;
    message: string;          // rendered as the question (empty for insight)
    retrievalQuery: string;   // what we embed for note/cross-ref search
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    voyageDeps: VoyageDeps; rerankEnabled: boolean;
  },
): Promise<BibleChatContext> {
```

1b. Replace `const queryEmbedding = await embedQuery(args.message, args.voyageDeps);` with:

```ts
  const queryEmbedding = await embedQuery(args.retrievalQuery, args.voyageDeps);
```

1c. In the two retrieval calls, replace `query: args.message` with `query: args.retrievalQuery` (both `searchUserNotesByQuery` and `searchBible`).

1d. Leave `userMessage: args.message` as-is at the bottom of the returned context.

- [ ] **Step 2: Add `mode` to the request + branch the body**

2a. Extend the body parse near the top of `handleChat`:

```ts
  let body: { book?: string; chapter?: number; message?: string; mode?: string };
  try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }
  const mode = body.mode === 'insight' ? 'insight' : 'chat';
  if (typeof body.book !== 'string' || typeof body.chapter !== 'number') {
    return jsonResp({ error: 'bad payload' }, 400);
  }
  if (mode === 'chat' && (typeof body.message !== 'string' || !body.message.trim())) {
    return jsonResp({ error: 'bad payload' }, 400);
  }
  const book = body.book;
  const chapter = body.chapter;
  const message = (body.message ?? '').trim().slice(0, 2000);
  const passageRef = `${book}.${chapter}`;
```

2b. Add the insight import near the other prompt import:

```ts
import { BIBLE_INSIGHT_PROMPT } from './prompts/bible-insight.ts';
```

2c. Inside the `runGeneration(...)` body, replace steps 1–5 with a mode-aware version:

```ts
      // 1. Load-or-create the thread for this passage.
      const threadId = await upsertThread(supabase, userId, book, chapter, passageRef, message || `Study of ${book} ${chapter}`);

      // 2. Load existing messages (oldest→newest).
      const { data: histRows } = await supabase
        .from('lamplight_chat_messages')
        .select('role, content')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT);
      const history = ((histRows ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>).reverse();

      // Insight only fires on an empty thread — refuse otherwise (idempotent, no cost).
      if (mode === 'insight' && history.length > 0) {
        return { response: { ok: true, thread_id: threadId, skipped: true }, usage: null };
      }

      // 3. Fetch the open chapter once so insight can seed retrieval from its text.
      //    (buildChatContext fetches it again for allowed refs; acceptable for V1.)
      let retrievalQuery = message;
      if (mode === 'insight') {
        const { data: chRows } = await supabase
          .from('bible_passages')
          .select('text')
          .like('id', `${book}.${chapter}.%`)
          .order('verse_start', { ascending: true })
          .limit(20);
        retrievalQuery = ((chRows ?? []) as Array<{ text: string }>).map((r) => r.text).join(' ').slice(0, 1500) || `${book} ${chapter}`;
      }

      // 4. Build context + run the right prompt.
      const ctx = await buildChatContext(supabase, {
        userId, book, chapter, passageRef,
        message: mode === 'insight' ? '' : message,
        retrievalQuery,
        history,
        voyageDeps, rerankEnabled,
      });
      const result = await runBibleChatPipeline({
        llm, ctx,
        prompt: mode === 'insight' ? (BIBLE_INSIGHT_PROMPT as unknown as Parameters<typeof runBibleChatPipeline>[0]['prompt']) : undefined,
      });
      if (!result.ok) {
        return { response: { ok: false, reason: result.reason }, usage: result.usage };
      }

      // 5. Persist. Insight = one assistant message; chat = user + assistant.
      const rows = mode === 'insight'
        ? [{ thread_id: threadId, user_id: userId, role: 'assistant', content: result.reply, citations: result.citations }]
        : [
            { thread_id: threadId, user_id: userId, role: 'user', content: message, citations: [] },
            { thread_id: threadId, user_id: userId, role: 'assistant', content: result.reply, citations: result.citations },
          ];
      await supabase.from('lamplight_chat_messages').insert(rows);
      await supabase.from('lamplight_chat_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);

      return { response: { ok: true, thread_id: threadId, reply: result.reply, citations: result.citations }, usage: result.usage };
```

- [ ] **Step 3: Re-run the dependent unit tests (pipeline/validators unaffected; confirm green)**

Run: `npm run test -- supabase/functions/lamplight-chat`
Expected: PASS (pipeline tests still green; index.ts is verified via deploy/manual).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/lamplight-chat/index.ts
git commit -m "feat(lamplight): insight mode in lamplight-chat (empty-thread, single assistant msg)"
```

---

### Task 4: Client — `requestOpeningInsight`

**Files:**
- Modify: `src/notepad/bible/lamplight-chat-client.ts`
- Test: `src/notepad/bible/lamplight-chat-client.test.ts` (append)

- [ ] **Step 1: Add the failing test (append)**

```ts
import { requestOpeningInsight } from './lamplight-chat-client';

describe('requestOpeningInsight', () => {
  it('invokes lamplight-chat in insight mode and returns the reply', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { ok: true, thread_id: 't1', reply: 'An opening thought.', citations: [] }, error: null,
    });
    const out = await requestOpeningInsight(invoke, { book: 'jhn', chapter: 10 });
    expect(invoke).toHaveBeenCalledWith('lamplight-chat', { body: { book: 'jhn', chapter: 10, mode: 'insight' } });
    expect(out).toEqual({ ok: true, threadId: 't1', reply: 'An opening thought.', citations: [] });
  });

  it('maps a skipped insight (already has messages) to ok:false reason skipped', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true, thread_id: 't1', skipped: true }, error: null });
    const out = await requestOpeningInsight(invoke, { book: 'jhn', chapter: 10 });
    expect(out).toEqual({ ok: false, reason: 'skipped' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/bible/lamplight-chat-client.test.ts`
Expected: FAIL — `requestOpeningInsight` not exported.

- [ ] **Step 3: Implement — append to `lamplight-chat-client.ts`**

```ts
export interface RequestInsightArgs { book: string; chapter: number }

export async function requestOpeningInsight(invoke: InvokeFn, args: RequestInsightArgs): Promise<SendChatResult> {
  const { data, error } = await invoke('lamplight-chat', { body: { book: args.book, chapter: args.chapter, mode: 'insight' } });
  if (error) return { ok: false, reason: error.message };
  const d = data as { ok?: boolean; reason?: string; skipped?: boolean; thread_id?: string; reply?: string; citations?: ChatCitation[] } | null;
  if (!d || d.ok !== true) return { ok: false, reason: d?.reason ?? 'unknown_error' };
  if (d.skipped || typeof d.reply !== 'string') return { ok: false, reason: 'skipped' };
  return { ok: true, threadId: d.thread_id ?? '', reply: d.reply, citations: d.citations ?? [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/bible/lamplight-chat-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/bible/lamplight-chat-client.ts src/notepad/bible/lamplight-chat-client.test.ts
git commit -m "feat(bible): requestOpeningInsight client for insight mode"
```

---

### Task 5: `LamplightChat` auto-fires the opening insight

**Files:**
- Modify: `src/notepad/components/lamplight/chat/LamplightChat.tsx`
- Test: `src/notepad/components/lamplight/chat/LamplightChat.test.tsx` (append)

- [ ] **Step 1: Add the failing tests (append; extend the existing mock block)**

At the top of the test file, extend the client mock to include `requestOpeningInsight`:

```tsx
const requestOpeningInsight = vi.fn();
vi.mock('@/notepad/bible/lamplight-chat-client', () => ({
  sendChatMessage: (...a: unknown[]) => sendChatMessage(...a),
  requestOpeningInsight: (...a: unknown[]) => requestOpeningInsight(...a),
}));
```

Then append:

```tsx
describe('LamplightChat opening insight', () => {
  it('auto-fires an insight when the loaded thread is empty', async () => {
    const append = vi.fn();
    useChatThread.mockReturnValue({ messages: [], loading: false, error: null, append, reload: vi.fn() });
    requestOpeningInsight.mockResolvedValue({ ok: true, threadId: 't1', reply: 'Opening thought.', citations: [] });
    render(<LamplightChat book="jhn" chapter={10} userId="u1" invoke={vi.fn()} />);
    await waitFor(() => expect(requestOpeningInsight).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(append).toHaveBeenCalledWith([
      expect.objectContaining({ role: 'assistant', content: 'Opening thought.' }),
    ]));
  });

  it('does NOT fire an insight when the thread already has messages', async () => {
    useChatThread.mockReturnValue({
      messages: [{ id: 'm1', role: 'assistant', content: 'prior', citations: [] }],
      loading: false, error: null, append: vi.fn(), reload: vi.fn(),
    });
    render(<LamplightChat book="jhn" chapter={10} userId="u1" invoke={vi.fn()} />);
    await waitFor(() => expect(requestOpeningInsight).not.toHaveBeenCalled());
  });

  it('does not fire while the thread is still loading', async () => {
    useChatThread.mockReturnValue({ messages: [], loading: true, error: null, append: vi.fn(), reload: vi.fn() });
    render(<LamplightChat book="jhn" chapter={10} userId="u1" invoke={vi.fn()} />);
    await waitFor(() => expect(requestOpeningInsight).not.toHaveBeenCalled());
  });
});
```

> Reset `requestOpeningInsight` in the existing `setup`/`beforeEach` (or add `requestOpeningInsight.mockReset()` to the per-test setup) so cases don't leak.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/components/lamplight/chat/LamplightChat.test.tsx`
Expected: FAIL — no auto-fire behavior yet.

- [ ] **Step 3: Implement the auto-fire effect**

3a. Update the import:

```tsx
import { sendChatMessage, requestOpeningInsight, type InvokeFn } from '@/notepad/bible/lamplight-chat-client';
```

3b. Add `useEffect` and `useRef` to the React import:

```tsx
import { useEffect, useRef, useState } from 'react';
```

3c. Inside the component (after the existing `sending`/`error` state), add the once-per-passage guard + effect:

```tsx
  const [insighting, setInsighting] = useState(false);
  const insightAttempted = useRef<Set<string>>(new Set());
  const passageKey = `${book}.${chapter}`;

  useEffect(() => {
    if (thread.loading) return;
    if (thread.messages.length > 0) return;
    if (insightAttempted.current.has(passageKey)) return;
    insightAttempted.current.add(passageKey);

    let cancelled = false;
    setInsighting(true);
    (async () => {
      const res = await requestOpeningInsight(invoke, { book, chapter });
      if (cancelled) return;
      if (res.ok) {
        thread.append([{ id: localId(), role: 'assistant', content: res.reply, citations: res.citations }]);
      }
      setInsighting(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passageKey, thread.loading, thread.messages.length]);
```

3d. Show the insight loading state in the messages area — change the existing `sending` indicator line to also cover insighting:

```tsx
        {(sending || insighting) && <p className="text-[11px] italic" style={{ color: 'var(--silica)' }}>Lamplight is reflecting…</p>}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/components/lamplight/chat/LamplightChat.test.tsx`
Expected: PASS (Phase 2 cases + 3 new).

- [ ] **Step 5: Typecheck + lint + full suite**

Run: `npx tsc -b --noEmit && npm run lint && npm run test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/notepad/components/lamplight/chat/LamplightChat.tsx src/notepad/components/lamplight/chat/LamplightChat.test.tsx
git commit -m "feat(bible): auto-fire Lamplight opening insight on empty passage thread"
```

---

### Task 6: Deploy + manual verification

**Files:** none (ops/manual).

- [ ] **Step 1: Redeploy the function**

Run: `supabase functions deploy lamplight-chat`
Expected: deploy succeeds (confirms the new prompt import resolves).

- [ ] **Step 2: Manual end-to-end**
  - `npm run dev`, sign in as an entitled, opted-in user.
  - Bible tab → toggle **Lamplight ●** on a passage you've never studied → confirm an opening insight appears automatically (one bubble, with citation chips), preceded by "Lamplight is reflecting…".
  - Navigate to a different chapter with chat still on → a new insight fires for that chapter.
  - Reload, reopen the first chapter → the saved insight reloads; NO new insight fires (no duplicate).
  - Toggle off then on for the same chapter in one session → no second insight (per-session guard) and none persisted twice.
  - New user with no related notes → insight still appears, noting it gets more personal as they write.

- [ ] **Step 3: No commit** (verification only).

---

## Self-Review

- **Spec coverage:** "When chat is on, opening/navigating to a passage drops one opening insight grounded in passage + notes" ✓ (Tasks 2–5); "saved-thread restore" already shipped in Phase 2 and is respected here (no re-fire when messages exist, Task 3 server guard + Task 5 client guard).
- **Placeholder scan:** none — complete code in every step; commands have expected output.
- **Type consistency:** `ChatPromptModule` (Task 1) implemented by both `BIBLE_CHAT_PROMPT` (Phase 2) and `BIBLE_INSIGHT_PROMPT` (Task 2); `requestOpeningInsight` returns the Phase 2 `SendChatResult` (Task 4) consumed by `LamplightChat` (Task 5); `BibleChatContext` reused unchanged; insight reuses the Phase 2 `emit_chat_reply` tool + `validateChatReplyCitations`.
- **Loop/duplicate safety:** server refuses insight on a non-empty thread (Task 3); client fires at most once per passage per session via `insightAttempted` ref and only on a loaded empty thread (Task 5). Both must hold — verified in Task 5 tests and Task 6 manual steps.
- **Cost note:** an insight is one LLM call per first-open of each chapter (counts against the existing Lamplight quota). Acceptable for V1; if cost is a concern later, gate insight behind an explicit "Reflect on this passage" affordance instead of auto-fire.

## Follow-on (Phase 4, separate plan)

- **Mobile parity:** wire `BibleStudyPane` (reader + chat + insight) into `src/components/sections/notepad/mobile/LamplightMobileView.tsx`.
- **"New reflection" affordance:** let the user start a fresh thread for a passage (requires relaxing the `unique (user_id, passage_ref)` constraint or archiving the prior thread).
