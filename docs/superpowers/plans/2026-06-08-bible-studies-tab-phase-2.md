# Bible Studies Tab — Phase 2 Implementation Plan (Lamplight Chat: backend + gated UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the gated Lamplight chat to the Bible Studies tab — a per-passage, scripture-grounded chat that answers the user's questions using their own notes, with conversations saved per passage.

**Architecture:** A new `lamplight-chat` Supabase Edge Function mirrors the existing `lamplight-generate` envelope (CORS → JWT identity → opt-in check → entitlement check → quota → retrieval → generate-with-retry → validate → persist). It returns a **structured, citation-validated** reply per turn (NOT streaming — the existing Anthropic adapter is tool-use/structured-output only, and citation validation depends on that structure). The frontend shows a loading state per turn. Threads + messages are saved per passage and reloaded when the user reopens that passage.

**Tech Stack:** Supabase Edge Functions (Deno), Anthropic Messages API via `_shared/anthropic.ts` (tool-use), Voyage embeddings via `_shared/voyage.ts`, pgvector RPCs (`match_user_note_embeddings`, `match_bible_embeddings`), Postgres + RLS; React 19 + Vite + Vitest/@testing-library on the client.

**Prerequisite:** Phase 1 (`docs/superpowers/plans/2026-06-08-bible-studies-tab-phase-1.md`) is merged — `StudyWindow`, `BibleReader`, `useBiblePassages`, and `bible-books` exist. `bible_passages` and `lamplight_embeddings` are populated (the BSB ingest also wrote note+bible embeddings).

**Scope boundary:** This plan delivers the chat backend, gating, send/receive, and saved-thread load/persist. OUT of scope (Phase 3+): the *proactive* opening insight that auto-fires on passage open, and full mobile parity (`LamplightMobileView` wiring). Phase 2 chat is reactive (user sends first).

---

## Design decisions locked for this phase

- **No streaming.** Each turn returns `{ reply, citations[] }` validated against allowed note ids + verse refs. UI shows a "Lamplight is reflecting…" state. Rationale: `_shared/anthropic.ts` is tool-use only; citation-first is enforced via the structured tool output + `validateChatReplyCitations`.
- **Citations optional-but-validated.** Unlike the daily devotion (which requires ≥1 citation), a chat reply MAY have zero citations (e.g. a short clarifying answer), but ANY citation present must resolve to a supplied note id / verse ref. This keeps open Q&A natural while preventing fabricated references.
- **Guardrails retained.** The reply text runs through the existing `applyContentRules` (banned / contested / growth families from `_shared/voice.ts`) and composes under `LAMPLIGHT_SYSTEM_FRAGMENT`, so the "no prophetic / no pastoral-advice / scripture-grounded" stance holds even with open input.
- **Gating = opt-in AND tier.** The function requires `lamplight_settings.enabled = true` AND chat entitlement (tier `plus` OR active promo). The client mirrors this with a new `'chat'` feature in `useLamplightEntitlement`.
- **Saved per passage.** One thread per `(user_id, passage_ref)` where `passage_ref = "{book}.{chapter}"` (e.g. `jhn.10`). Reopening the passage reloads the thread.

## File structure

Backend (Deno):
- Create `supabase/migrations/024_lamplight_chat_threads.sql` — threads + messages tables + RLS.
- Create `supabase/functions/_shared/entitlement.ts` (+ test) — `hasChatAccess({ tier, promoActive })`.
- Modify `supabase/functions/_shared/validators.ts` (+ test) — add `validateChatReplyCitations`.
- Modify `supabase/functions/_shared/retrieval.ts` (+ test) — add `searchUserNotesByQuery`.
- Create `supabase/functions/lamplight-chat/prompts/bible-chat.ts` — system + tool + buildMessages.
- Create `supabase/functions/lamplight-chat/bible-chat-pipeline.ts` (+ test) — generate-with-retry + validate.
- Create `supabase/functions/lamplight-chat/index.ts` — the HTTP handler (envelope + context build + persist).

Frontend (React/TS):
- Modify `src/notepad/hooks/useLamplightEntitlement.ts` (+ test) — add `'chat'` feature.
- Create `src/notepad/bible/lamplight-chat-client.ts` (+ test) — `sendChatMessage`.
- Create `src/notepad/bible/useChatThread.ts` (+ test) — load saved messages for a passage.
- Create `src/notepad/components/lamplight/chat/ChatMessage.tsx` (+ test).
- Create `src/notepad/components/lamplight/chat/LamplightChat.tsx` (+ test).
- Create `src/notepad/bible/BibleStudyPane.tsx` (+ test) — gating + reader + chat.
- Modify `src/components/sections/notepad/StudyWindow.tsx` (+ test) — render `BibleStudyPane` on the Bible tab; accept + pass `lamplightAdapter`.
- Modify `src/components/sections/Notepad.tsx` — pass `lamplightAdapter` to `StudyWindow`.
- Create `src/notepad/storage/lamplight-chat-rls.test.ts` — owner isolation (integration, env-gated).

---

### Task 1: Migration — chat threads + messages tables with RLS

**Files:**
- Create: `supabase/migrations/024_lamplight_chat_threads.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/024_lamplight_chat_threads.sql
-- Bible-study chat: one thread per (user, passage), with an ordered message log.
-- Owner-only RLS mirrors lamplight_artifacts (auth.uid() = user_id).

create table public.lamplight_chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book text not null,
  chapter integer not null,
  passage_ref text not null,           -- "{book}.{chapter}", e.g. "jhn.10"
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, passage_ref)
);

alter table public.lamplight_chat_threads enable row level security;

create policy "Users can view own chat_threads"
  on public.lamplight_chat_threads for select using (auth.uid() = user_id);
create policy "Users can insert own chat_threads"
  on public.lamplight_chat_threads for insert with check (auth.uid() = user_id);
create policy "Users can update own chat_threads"
  on public.lamplight_chat_threads for update using (auth.uid() = user_id);
create policy "Users can delete own chat_threads"
  on public.lamplight_chat_threads for delete using (auth.uid() = user_id);

create table public.lamplight_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.lamplight_chat_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index lamplight_chat_messages_thread_created
  on public.lamplight_chat_messages (thread_id, created_at);

alter table public.lamplight_chat_messages enable row level security;

create policy "Users can view own chat_messages"
  on public.lamplight_chat_messages for select using (auth.uid() = user_id);
create policy "Users can insert own chat_messages"
  on public.lamplight_chat_messages for insert with check (auth.uid() = user_id);
create policy "Users can delete own chat_messages"
  on public.lamplight_chat_messages for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply locally and verify**

Run: `supabase db reset` (local stack) — or `supabase migration up` if you keep data.
Expected: migration `024` applies with no error; `\d public.lamplight_chat_threads` shows the table.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/024_lamplight_chat_threads.sql
git commit -m "feat(db): lamplight chat threads + messages tables with owner RLS"
```

---

### Task 2: Shared entitlement helper (server-side chat gate)

**Files:**
- Create: `supabase/functions/_shared/entitlement.ts`
- Test: `supabase/functions/_shared/entitlement.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/_shared/entitlement.test.ts
import { describe, it, expect } from 'vitest';
import { hasChatAccess } from './entitlement.ts';

describe('hasChatAccess', () => {
  it('grants when an active promo is on, regardless of tier', () => {
    expect(hasChatAccess({ tier: 'none', promoActive: true })).toBe(true);
    expect(hasChatAccess({ tier: 'lite', promoActive: true })).toBe(true);
  });
  it('grants to plus tier', () => {
    expect(hasChatAccess({ tier: 'plus', promoActive: false })).toBe(true);
  });
  it('denies lite and none without promo', () => {
    expect(hasChatAccess({ tier: 'lite', promoActive: false })).toBe(false);
    expect(hasChatAccess({ tier: 'none', promoActive: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- supabase/functions/_shared/entitlement.test.ts`
Expected: FAIL — cannot resolve `./entitlement.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// supabase/functions/_shared/entitlement.ts
// Single source of truth for chat gating. Mirrors useLamplightEntitlement's
// 'chat' branch on the client so server and UI agree. Chat is a `plus`-only
// feature (or anyone while a promo is active).

export type LamplightTier = 'plus' | 'lite' | 'none';

export function hasChatAccess(args: { tier: LamplightTier; promoActive: boolean }): boolean {
  if (args.promoActive) return true;
  return args.tier === 'plus';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- supabase/functions/_shared/entitlement.test.ts`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/entitlement.ts supabase/functions/_shared/entitlement.test.ts
git commit -m "feat(lamplight): shared hasChatAccess entitlement helper"
```

---

### Task 3: Client entitlement — add the `'chat'` feature

**Files:**
- Modify: `src/notepad/hooks/useLamplightEntitlement.ts`
- Test: `src/notepad/hooks/useLamplightEntitlement.test.ts`

- [ ] **Step 1: Add the failing test (append inside the existing describe in the test file)**

```ts
  it('grants chat only to plus or active promo', async () => {
    // plus tier, no promo
    {
      const adapter = makeAdapter({ tier: 'plus', promoActive: false });
      const { result } = renderHook(() => useLamplightEntitlement({ adapter, userId: 'u1' }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.hasAccess('chat')).toBe(true);
    }
    // lite tier, no promo
    {
      const adapter = makeAdapter({ tier: 'lite', promoActive: false });
      const { result } = renderHook(() => useLamplightEntitlement({ adapter, userId: 'u1' }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.hasAccess('chat')).toBe(false);
    }
    // none tier, promo active
    {
      const adapter = makeAdapter({ tier: 'none', promoActive: true });
      const { result } = renderHook(() => useLamplightEntitlement({ adapter, userId: 'u1' }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.hasAccess('chat')).toBe(true);
    }
  });
```

> If `useLamplightEntitlement.test.ts` does not already define a `makeAdapter` helper, add this at the top of the file (after imports):
> ```ts
> function makeAdapter(opts: { tier: 'plus' | 'lite' | 'none'; promoActive: boolean }) {
>   return {
>     getPromoConfig: async () => ({ promoActive: opts.promoActive }),
>     getEntitlement: async () => ({ tier: opts.tier }),
>   } as unknown as import('../storage/lamplight-adapter').LamplightAdapter;
> }
> ```
> Ensure the file imports `renderHook, waitFor` from `@testing-library/react` and uses `// @vitest-environment jsdom`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/hooks/useLamplightEntitlement.test.ts`
Expected: FAIL — `hasAccess('chat')` returns `false` for `plus` is fine, but the type `LamplightFeature` does not include `'chat'` (compile error) / the promo+none case fails.

- [ ] **Step 3: Implement — add `'chat'` to the feature union and the access rule**

3a. Change the feature type:

```ts
export type LamplightFeature = 'today' | 'weekly' | 'reflections' | 'inline' | 'chat';
```

3b. Update the `hasAccess` callback body to:

```ts
  const hasAccess = useCallback(
    (feature: LamplightFeature) => {
      if (promoActive) return true;
      if (feature === 'chat') return tier === 'plus';
      if (tier === 'plus') return true;
      if (tier === 'lite') return feature === 'today' || feature === 'weekly';
      return false;
    },
    [promoActive, tier]
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/hooks/useLamplightEntitlement.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/hooks/useLamplightEntitlement.ts src/notepad/hooks/useLamplightEntitlement.test.ts
git commit -m "feat(lamplight): add gated 'chat' feature to entitlement"
```

---

### Task 4: `validateChatReplyCitations` validator

**Files:**
- Modify: `supabase/functions/_shared/validators.ts`
- Test: `supabase/functions/_shared/validators.test.ts` (append)

- [ ] **Step 1: Write the failing test (append to `validators.test.ts`)**

```ts
import { validateChatReplyCitations } from './validators.ts';

describe('validateChatReplyCitations', () => {
  const allowed = {
    allowedNoteIds: new Set(['note-1']),
    allowedVerseRefs: new Set(['jhn 10:11']),
  };

  it('passes a reply with zero citations', () => {
    const r = validateChatReplyCitations({ reply: 'A short answer.', citations: [] }, allowed);
    expect(r.ok).toBe(true);
  });

  it('passes valid note + verse citations (verse case-insensitive)', () => {
    const r = validateChatReplyCitations(
      { reply: 'x', citations: [{ type: 'note', ref: 'note-1' }, { type: 'verse', ref: 'John 10:11'.toLowerCase() === 'jhn 10:11' ? 'jhn 10:11' : 'JHN 10:11' }] },
      allowed,
    );
    expect(r.ok).toBe(true);
  });

  it('flags an unknown note', () => {
    const r = validateChatReplyCitations({ reply: 'x', citations: [{ type: 'note', ref: 'ghost' }] }, allowed);
    expect(r.ok).toBe(false);
    expect(r.violations[0].reason).toBe('unknown_note');
  });

  it('flags an unknown verse', () => {
    const r = validateChatReplyCitations({ reply: 'x', citations: [{ type: 'verse', ref: 'gen 1:1' }] }, allowed);
    expect(r.ok).toBe(false);
    expect(r.violations[0].reason).toBe('unknown_verse');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- supabase/functions/_shared/validators.test.ts`
Expected: FAIL — `validateChatReplyCitations` is not exported.

- [ ] **Step 3: Implement — append to `validators.ts`**

```ts
// ── Bible-chat reply validator (Phase 2) ───────────────────────────────────
// Chat replies may carry zero citations (a short clarifying answer), but any
// citation present must resolve to a supplied note id or retrieved verse ref.

export interface ChatReply {
  reply: string;
  citations: Citation[];
}

export function validateChatReplyCitations(
  reply: ChatReply,
  allowed: { allowedNoteIds: Set<string>; allowedVerseRefs: Set<string> },
): CitationCheckResult {
  const violations: CitationViolation[] = [];
  const verseRefsLower = new Set<string>();
  for (const r of allowed.allowedVerseRefs) verseRefsLower.add(r.toLowerCase());

  (reply.citations ?? []).forEach((cite) => {
    if (cite.type === 'note' && !allowed.allowedNoteIds.has(cite.ref)) {
      violations.push({ section_index: 0, reason: 'unknown_note', detail: `cited note "${cite.ref}" is not in the user's context` });
    } else if (cite.type === 'verse' && !verseRefsLower.has(cite.ref.toLowerCase())) {
      violations.push({ section_index: 0, reason: 'unknown_verse', detail: `cited verse "${cite.ref}" is not in the retrieved passages` });
    }
  });

  return { ok: violations.length === 0, violations };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- supabase/functions/_shared/validators.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/validators.ts supabase/functions/_shared/validators.test.ts
git commit -m "feat(lamplight): validateChatReplyCitations (citation-first, zero-ok)"
```

---

### Task 5: Retrieval — `searchUserNotesByQuery`

**Files:**
- Modify: `supabase/functions/_shared/retrieval.ts`
- Test: `supabase/functions/_shared/retrieval.test.ts` (append)

- [ ] **Step 1: Write the failing test (append to `retrieval.test.ts`)**

```ts
import { searchUserNotesByQuery } from './retrieval.ts';

describe('searchUserNotesByQuery', () => {
  it('embeds the query and matches the user note RPC, mapping rows', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { id: 'e1', source_id: 'note-1', chunk_index: 0, chunk_text: 'rest as trust', similarity: 0.9, metadata: {} },
        { id: 'e2', source_id: 'note-2', chunk_index: 1, chunk_text: 'shepherd', similarity: 0.8, metadata: {} },
      ],
      error: null,
    });
    const deps = {
      supabase: { rpc } as unknown as import('@supabase/supabase-js').SupabaseClient,
      voyage: { apiKey: 'k', fetch: globalThis.fetch },
      rerankEnabled: false,
    };
    const out = await searchUserNotesByQuery(deps, {
      userId: 'u1', k: 2, queryEmbedding: new Array(1024).fill(0),
    });
    expect(rpc).toHaveBeenCalledWith('match_user_note_embeddings', {
      p_user_id: 'u1',
      p_query_vector: expect.any(Array),
      p_exclude_source_id: null,
      p_limit: 2,
    });
    expect(out.map((r) => r.source_id)).toEqual(['note-1', 'note-2']);
  });
});
```

> `retrieval.test.ts` already imports `vi` from vitest. If not, add `import { describe, it, expect, vi } from 'vitest';` at the top.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- supabase/functions/_shared/retrieval.test.ts`
Expected: FAIL — `searchUserNotesByQuery` is not exported.

- [ ] **Step 3: Implement — append to `retrieval.ts`**

```ts
/**
 * Semantic search over a single user's note embeddings for an arbitrary text
 * query (used by Bible chat). Reuses the existing match_user_note_embeddings
 * RPC with a null exclude id. When rerankEnabled, pulls a larger pool and
 * reranks by the raw query text.
 */
export async function searchUserNotesByQuery(
  deps: RetrievalDeps,
  args: { userId: string; k: number; query?: string; queryEmbedding?: number[] },
): Promise<RetrievedItem[]> {
  const vector = args.queryEmbedding ?? await embedQuery(args.query ?? '', deps.voyage);
  const limit = deps.rerankEnabled ? POOL_SIZE : args.k;
  const { data, error } = await deps.supabase.rpc('match_user_note_embeddings', {
    p_user_id: args.userId,
    p_query_vector: vector,
    p_exclude_source_id: null,
    p_limit: limit,
  });
  if (error) throw error;
  const rows = (data ?? []) as MatchRow[];
  if (rows.length === 0) return [];

  if (!deps.rerankEnabled || !args.query) {
    return rows.slice(0, args.k).map(toRetrievedItem);
  }
  const documents = rows.map((r) => r.chunk_text);
  const scored = await rerank(args.query, documents, args.k, deps.voyage);
  return scored.map((s) => toRetrievedItem({ ...rows[s.index], rerank_score: s.score } as MatchRow & { rerank_score: number }));
}
```

> Add `rerank` to the existing voyage import at the top of `retrieval.ts` if it is not already imported: `import { embedQuery, rerank, type VoyageDeps } from './voyage.ts';` (it already imports `embedQuery, rerank`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- supabase/functions/_shared/retrieval.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/retrieval.ts supabase/functions/_shared/retrieval.test.ts
git commit -m "feat(lamplight): searchUserNotesByQuery for arbitrary-query note retrieval"
```

---

### Task 6: Chat prompt module

**Files:**
- Create: `supabase/functions/lamplight-chat/prompts/bible-chat.ts`

No standalone test (pure prompt data; exercised by the pipeline test in Task 7).

- [ ] **Step 1: Write the prompt module**

```ts
// supabase/functions/lamplight-chat/prompts/bible-chat.ts
// Bible-study chat prompt. Composes under LAMPLIGHT_SYSTEM_FRAGMENT via
// generateWithRetry/composeSystem. Open Q&A, but bounded to Scripture + the
// user's own notes; refuses pastoral/predictive asks per the system fragment.

import type { BibleChatContext } from '../bible-chat-pipeline.ts';

export const BIBLE_CHAT_PROMPT = {
  promptVersion: 'bible-chat-2026-06-08-v1',

  system: `You are helping someone study a specific passage of Scripture. They may ask open questions. Answer ONLY from (a) the passage and cross-reference passages supplied, and (b) the user's own notes supplied. Bring the two into conversation.

Rules (these compound your system fragment):
- Ground every claim in a supplied passage or a supplied note. If you cannot, say so plainly and invite the user back to the text rather than speculating.
- Do not give pastoral, psychological, medical, financial, or predictive advice. Do not speak prophetically or as if relaying a message from God.
- Keep replies conversational and concise (60-160 words). One idea, well grounded.
- citations: list every passage/note you actually leaned on. Cite verses using exactly one of the refs supplied; cite notes using exactly one of the note ids supplied. If you genuinely used none, return an empty array.
- Never quote more than 25 words verbatim from any single note.`,

  tool: {
    name: 'emit_chat_reply',
    description: 'Return the chat reply and its citations.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['reply', 'citations'],
      properties: {
        reply: { type: 'string', minLength: 1, maxLength: 1400 },
        citations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'ref'],
            properties: {
              type: { type: 'string', enum: ['note', 'verse'] },
              ref: { type: 'string', description: 'Exactly one of the supplied note ids (type=note) or verse refs (type=verse).' },
            },
          },
        },
      },
    },
  },

  buildMessages(ctx: BibleChatContext): Array<{ role: 'user' | 'assistant'; content: string }> {
    const passageBlock = `[Open passage ${ctx.passageRef}]\n${ctx.passageText}`;
    const crossRefBlock = ctx.crossRefs.length
      ? `Cross-reference passages:\n${ctx.crossRefs.map((p) => `[${p.ref}]\n${p.text}`).join('\n\n')}`
      : 'Cross-reference passages: (none)';
    const notesBlock = ctx.notes.length
      ? ctx.notes.map((n) => `[note id=${n.id}] ${n.title}\n${n.plaintext}`).join('\n\n')
      : '(the user has no related notes yet)';
    const refsList = [...ctx.allowedVerseRefs].join(', ') || '(none)';
    const noteIdsList = [...ctx.allowedNoteIds].join(', ') || '(none)';

    const priorTurns = ctx.history.map((m) => ({ role: m.role, content: m.content }));

    const contextTurn = {
      role: 'user' as const,
      content:
        `${passageBlock}\n\n${crossRefBlock}\n\n` +
        `User's related notes:\n${notesBlock}\n\n` +
        `When citing, verses MUST be one of: ${refsList}. Notes MUST be one of: ${noteIdsList}.\n\n` +
        `Question: ${ctx.userMessage}`,
    };

    return [...priorTurns, contextTurn];
  },
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/lamplight-chat/prompts/bible-chat.ts
git commit -m "feat(lamplight): bible-chat prompt (open Q&A, scripture+notes grounded)"
```

---

### Task 7: Chat pipeline (generate → validate → retry)

**Files:**
- Create: `supabase/functions/lamplight-chat/bible-chat-pipeline.ts`
- Test: `supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runBibleChatPipeline, type BibleChatContext } from './bible-chat-pipeline.ts';
import type { LLMAdapter } from '../_shared/anthropic.ts';

const baseCtx: BibleChatContext = {
  passageRef: 'jhn 10',
  passageText: 'I am the good shepherd...',
  crossRefs: [],
  notes: [{ id: 'note-1', title: 'Psalm 23 study', plaintext: 'rest as trust' }],
  history: [],
  userMessage: 'What does shepherd mean here?',
  allowedNoteIds: new Set(['note-1']),
  allowedVerseRefs: new Set(['jhn 10:11']),
};

function fakeLLM(reply: unknown): LLMAdapter {
  return {
    generate: vi.fn().mockResolvedValue({
      parsed: reply, modelUsed: 'claude-sonnet-4-6', promptTokens: 10, completionTokens: 20,
    }),
  } as unknown as LLMAdapter;
}

describe('runBibleChatPipeline', () => {
  it('returns the validated reply on a clean generation', async () => {
    const llm = fakeLLM({ reply: 'The shepherd lays down his life.', citations: [{ type: 'verse', ref: 'jhn 10:11' }] });
    const out = await runBibleChatPipeline({ llm, ctx: baseCtx });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.reply).toContain('shepherd');
      expect(out.citations).toEqual([{ type: 'verse', ref: 'jhn 10:11' }]);
      expect(out.usage?.status).toBe('ok');
    }
  });

  it('fails after retry when citations never validate', async () => {
    const llm = fakeLLM({ reply: 'x', citations: [{ type: 'verse', ref: 'gen 1:1' }] });
    const out = await runBibleChatPipeline({ llm, ctx: baseCtx });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('validators_failed');
    expect((llm.generate as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2); // one retry
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts`
Expected: FAIL — cannot resolve `./bible-chat-pipeline.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// supabase/functions/lamplight-chat/bible-chat-pipeline.ts
// Pure LLM control flow for one chat turn: generate → validate (citations +
// content rules) → retry once. No Supabase / persistence (the handler owns
// thread + message writes). Node-testable with a fake LLMAdapter.

import type { LLMAdapter } from '../_shared/anthropic.ts';
import { BANNED_PHRASES, CONTESTED_PASSAGES, GROWTH_BANNED_PHRASES } from '../_shared/voice.ts';
import {
  validateChatReplyCitations,
  applyContentRules,
  formatContentFamilyStricter,
  type ChatReply,
  type CitationViolation,
  type ContentRuleViolation,
} from '../_shared/validators.ts';
import { generateWithRetry } from '../_shared/generate-with-retry.ts';
import { BIBLE_CHAT_PROMPT } from './prompts/bible-chat.ts';
import type { UsageCore } from '../_shared/usage.ts';

export interface BibleChatContext {
  passageRef: string;                  // e.g. "jhn 10"
  passageText: string;                 // open chapter text (joined)
  crossRefs: Array<{ ref: string; text: string }>;
  notes: Array<{ id: string; title: string; plaintext: string }>;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage: string;
  allowedNoteIds: Set<string>;
  allowedVerseRefs: Set<string>;
}

export type BibleChatPipelineResult =
  | { ok: true; reply: string; citations: ChatReply['citations']; modelUsed: string; promptVersion: string; attempts: number; usage: UsageCore | null }
  | { ok: false; reason: 'validators_failed'; promptVersion: string; attempts: number; usage: UsageCore | null };

type ChatViolations = { citation: CitationViolation[]; content: ContentRuleViolation[] };

export async function runBibleChatPipeline(args: {
  llm: LLMAdapter;
  ctx: BibleChatContext;
}): Promise<BibleChatPipelineResult> {
  const promptVersion = BIBLE_CHAT_PROMPT.promptVersion;
  const ctx = args.ctx;

  const outcome = await generateWithRetry<ChatReply, ChatViolations>({
    llm: args.llm,
    model: 'sonnet',
    maxTokens: 1024,
    artifactSystem: BIBLE_CHAT_PROMPT.system,
    messages: BIBLE_CHAT_PROMPT.buildMessages(ctx),
    tool: BIBLE_CHAT_PROMPT.tool as unknown as Parameters<LLMAdapter['generate']>[0]['tool'],
    validate: async (parsed) => {
      const citation = validateChatReplyCitations(parsed, {
        allowedNoteIds: ctx.allowedNoteIds,
        allowedVerseRefs: ctx.allowedVerseRefs,
      });
      const content = await applyContentRules(parsed.reply ?? '', {
        banned: BANNED_PHRASES,
        contested: CONTESTED_PASSAGES,
        growth: GROWTH_BANNED_PHRASES,
      });
      return { ok: citation.ok && content.ok, violations: { citation: citation.violations, content: content.violations } };
    },
    formatStricter: (v) => {
      const parts: string[] = [];
      if (v.citation.length > 0) parts.push('On retry: cite only the supplied verse refs and note ids, or return an empty citations array.');
      parts.push(...formatContentFamilyStricter(v.content));
      return parts.join(' ');
    },
  });

  if (!outcome.ok) {
    return {
      ok: false,
      reason: 'validators_failed',
      promptVersion,
      attempts: outcome.attempts,
      usage: { model: outcome.modelUsed, tokens_in: 0, tokens_out: 0, status: 'error', error_code: 'validators_failed' },
    };
  }

  return {
    ok: true,
    reply: outcome.parsed.reply,
    citations: outcome.parsed.citations ?? [],
    modelUsed: outcome.modelUsed,
    promptVersion,
    attempts: outcome.attempts,
    usage: { model: outcome.modelUsed, tokens_in: outcome.promptTokens, tokens_out: outcome.completionTokens, status: 'ok' },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/lamplight-chat/bible-chat-pipeline.ts supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts
git commit -m "feat(lamplight): bible-chat pipeline (generate→validate→retry)"
```

---

### Task 8: Edge function handler `lamplight-chat/index.ts`

This composes the verified pieces: CORS + JWT identity + opt-in + entitlement + quota + context build + pipeline + persistence. It is verified by the unit tests above (pipeline/validators/retrieval/entitlement), the RLS test (Task 15), and manual smoke (Task 16) — the repo does not unit-test `index.ts` handlers directly (same as `lamplight-generate`).

**Files:**
- Create: `supabase/functions/lamplight-chat/index.ts`

- [ ] **Step 1: Write the handler**

```ts
// supabase/functions/lamplight-chat/index.ts
// Bible-study chat endpoint. Mirrors lamplight-generate's envelope.
// Body: { book: string, chapter: number, message: string }
// Resp: { ok: true, thread_id, reply, citations } | { ok: false, reason }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from '../_shared/supabase.ts';
import { type VoyageDeps, embedQuery } from '../_shared/voyage.ts';
import { searchBible, searchUserNotesByQuery } from '../_shared/retrieval.ts';
import { formatVerseRef } from '../_shared/bible-passage.ts';
import { createAnthropicAdapter } from '../_shared/anthropic.ts';
import { extractTextFromNoteContent } from '../_shared/tiptap-text.ts';
import { hasChatAccess, type LamplightTier } from '../_shared/entitlement.ts';
import { recordLamplightUsage } from '../_shared/usage.ts';
import { runGeneration, type GenerationLifecycleDeps } from '../_shared/generation-lifecycle.ts';
import { bearerToken, deriveUserId } from '../_shared/auth-identity.ts';
import { resolveQuotaLimits, checkQuota, supabaseQuotaDeps } from '../_shared/quota.ts';
import { resolveAllowedOrigins, corsHeaders } from '../_shared/cors.ts';
import { classifyGenerateError } from '../lamplight-generate/classify-error.ts';
import { runBibleChatPipeline, type BibleChatContext } from './bible-chat-pipeline.ts';

const HISTORY_LIMIT = 10;
const NOTE_K = 4;
const CROSSREF_K = 3;

serve(async (req) => {
  const cors = corsHeaders(req, resolveAllowedOrigins(Deno.env));
  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405);
  try {
    return await handleChat(req);
  } catch (err) {
    return jsonResp({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

async function handleChat(req: Request): Promise<Response> {
  const cors = corsHeaders(req, resolveAllowedOrigins(Deno.env));
  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const voyageKey = Deno.env.get('VOYAGE_AI_KEY');
  if (!anthropicKey) return jsonResp({ error: 'ANTHROPIC_API_KEY missing' }, 500);
  if (!voyageKey) return jsonResp({ error: 'VOYAGE_AI_KEY missing' }, 500);

  let body: { book?: string; chapter?: number; message?: string };
  try { body = await req.json(); } catch { return jsonResp({ error: 'bad json' }, 400); }
  if (typeof body.book !== 'string' || typeof body.chapter !== 'number' || typeof body.message !== 'string' || !body.message.trim()) {
    return jsonResp({ error: 'bad payload' }, 400);
  }
  const book = body.book;
  const chapter = body.chapter;
  const message = body.message.trim().slice(0, 2000);
  const passageRef = `${book}.${chapter}`;

  const supabase = serviceClient();

  // Identity from the verified JWT.
  const userId = await deriveUserId(supabase, bearerToken(req));
  if (!userId) return jsonResp({ error: 'unauthorized' }, 401);

  // Opt-in gate (same as lamplight-generate).
  const { data: settings, error: sErr } = await supabase
    .from('lamplight_settings').select('enabled').eq('user_id', userId).maybeSingle();
  if (sErr) return jsonResp({ error: sErr.message }, 500);
  if (!settings?.enabled) return jsonResp({ ok: false, reason: 'not_opted_in' }, 403);

  // Entitlement gate (chat = plus or active promo).
  const [{ data: ent }, { data: promoRow }] = await Promise.all([
    supabase.from('lamplight_entitlements').select('tier').eq('user_id', userId).maybeSingle(),
    supabase.from('app_config').select('value').eq('key', 'lamplight_promo_active').maybeSingle(),
  ]);
  const tier = ((ent?.tier as LamplightTier) ?? 'none');
  const promoActive = promoRow?.value === true || (promoRow?.value as { active?: boolean } | null)?.active === true;
  if (!hasChatAccess({ tier, promoActive })) return jsonResp({ ok: false, reason: 'no_entitlement' }, 402);

  const voyageDeps: VoyageDeps = { apiKey: voyageKey, fetch };
  const rerankEnabled = Deno.env.get('RERANK_ENABLED') === 'true';
  const llm = createAnthropicAdapter({ apiKey: anthropicKey, fetch });
  const quotaCfg = resolveQuotaLimits(Deno.env);

  const lifecycleDeps: GenerationLifecycleDeps = {
    checkQuota: async (uid) => {
      const q = await checkQuota(supabaseQuotaDeps(supabase), quotaCfg.generation, quotaCfg.global, { userId: uid, nowMs: Date.now() });
      return q.ok ? { ok: true } : { ok: false, reason: q.reason };
    },
    recordUsage: (row) => recordLamplightUsage(supabase, row),
    classifyError: classifyGenerateError,
  };

  const { status, response } = await runGeneration(
    lifecycleDeps,
    { userId, artifactKind: 'bible_chat' },
    async () => {
      // 1. Load-or-create the thread for this passage.
      const threadId = await upsertThread(supabase, userId, book, chapter, passageRef, message);

      // 2. Load recent history (oldest→newest), excluding the new message.
      const { data: histRows } = await supabase
        .from('lamplight_chat_messages')
        .select('role, content')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT);
      const history = ((histRows ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>).reverse();

      // 3. Build retrieval context.
      const ctx = await buildChatContext(supabase, { userId, book, chapter, passageRef, message, history, voyageDeps, rerankEnabled });

      // 4. Run the pipeline.
      const result = await runBibleChatPipeline({ llm, ctx });
      if (!result.ok) {
        return { response: { ok: false, reason: result.reason }, usage: result.usage };
      }

      // 5. Persist both messages.
      await supabase.from('lamplight_chat_messages').insert([
        { thread_id: threadId, user_id: userId, role: 'user', content: message, citations: [] },
        { thread_id: threadId, user_id: userId, role: 'assistant', content: result.reply, citations: result.citations },
      ]);
      await supabase.from('lamplight_chat_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);

      return { response: { ok: true, thread_id: threadId, reply: result.reply, citations: result.citations }, usage: result.usage };
    },
  );
  return jsonResp(response, status);
}

async function upsertThread(
  supabase: SupabaseClient, userId: string, book: string, chapter: number, passageRef: string, firstMessage: string,
): Promise<string> {
  const existing = await supabase
    .from('lamplight_chat_threads').select('id').eq('user_id', userId).eq('passage_ref', passageRef).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;
  const title = firstMessage.slice(0, 80);
  const ins = await supabase
    .from('lamplight_chat_threads')
    .insert({ user_id: userId, book, chapter, passage_ref: passageRef, title })
    .select('id').single();
  if (ins.data?.id) return ins.data.id as string;
  // Race: re-read.
  const reread = await supabase
    .from('lamplight_chat_threads').select('id').eq('user_id', userId).eq('passage_ref', passageRef).single();
  if (reread.error || !reread.data) throw ins.error ?? reread.error ?? new Error('thread upsert failed');
  return reread.data.id as string;
}

async function buildChatContext(
  supabase: SupabaseClient,
  args: {
    userId: string; book: string; chapter: number; passageRef: string; message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    voyageDeps: VoyageDeps; rerankEnabled: boolean;
  },
): Promise<BibleChatContext> {
  // Open chapter passages.
  const { data: chapterRows, error: cErr } = await supabase
    .from('bible_passages')
    .select('id, book, chapter, verse_start, verse_end, text')
    .like('id', `${args.book}.${args.chapter}.%`)
    .order('verse_start', { ascending: true });
  if (cErr) throw cErr;
  const verses = (chapterRows ?? []) as Array<{ book: string; chapter: number; verse_start: number; verse_end: number; text: string }>;
  const passageText = verses.map((v) => `${v.verse_start} ${v.text}`).join(' ');
  const passageRefHuman = `${args.book} ${args.chapter}`;
  const chapterVerseRefs = new Set(verses.map((v) => formatVerseRef(v).toLowerCase()));

  // Embed the question once; reuse for both retrievals.
  const queryEmbedding = await embedQuery(args.message, args.voyageDeps);

  // User note neighbors.
  const retrievedNotes = await searchUserNotesByQuery(
    { supabase, voyage: args.voyageDeps, rerankEnabled: args.rerankEnabled },
    { userId: args.userId, k: NOTE_K, query: args.message, queryEmbedding },
  );
  const noteIds = [...new Set(retrievedNotes.map((r) => r.source_id))];
  let notes: BibleChatContext['notes'] = [];
  if (noteIds.length) {
    const { data: noteRows } = await supabase
      .from('notes').select('id, title, content').eq('user_id', args.userId).in('id', noteIds);
    notes = ((noteRows ?? []) as Array<{ id: string; title: string; content: string }>)
      .map((n) => ({ id: n.id, title: (n.title ?? '').trim() || '(untitled)', plaintext: extractTextFromNoteContent(n.content).slice(0, 800) }))
      .filter((n) => n.plaintext.trim().length > 0);
  }

  // Cross-reference passages from the whole Bible.
  const retrievedBible = await searchBible(
    { supabase, voyage: args.voyageDeps, rerankEnabled: args.rerankEnabled },
    { query: args.message, k: CROSSREF_K, queryEmbedding },
  );
  const crossIds = retrievedBible.map((r) => r.source_id);
  let crossRefs: BibleChatContext['crossRefs'] = [];
  const crossRefSet = new Set<string>();
  if (crossIds.length) {
    const { data: crossRows } = await supabase
      .from('bible_passages').select('id, book, chapter, verse_start, verse_end, text').in('id', crossIds);
    crossRefs = ((crossRows ?? []) as Array<{ book: string; chapter: number; verse_start: number; verse_end: number; text: string }>)
      .map((p) => { const ref = formatVerseRef(p); crossRefSet.add(ref.toLowerCase()); return { ref, text: p.text }; });
  }

  const allowedVerseRefs = new Set<string>([...chapterVerseRefs, ...crossRefSet]);

  return {
    passageRef: passageRefHuman,
    passageText,
    crossRefs,
    notes,
    history: args.history,
    userMessage: args.message,
    allowedNoteIds: new Set(notes.map((n) => n.id)),
    allowedVerseRefs,
  };
}
```

> Note: `formatVerseRef` produces abbrev-based refs (e.g. `jhn 10:11`) — consistent with how `lamplight-generate` builds allowed refs, so the validator matching is internally consistent. The client maps abbrev→display name for chips.
> Note: the promo flag is read from `app_config` key `lamplight_promo_active`. If your repo uses a different key/shape for the promo flag (check `supabase-lamplight-adapter.ts` `getPromoConfig`), match that exact key + shape here instead.

- [ ] **Step 2: Typecheck the function imports (Deno)**

Run: `supabase functions serve lamplight-chat --no-verify-jwt` then Ctrl-C after it boots clean (confirms imports resolve). If you don't run Deno locally, this is verified at deploy in Task 16.
Expected: boots without import/resolution errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/lamplight-chat/index.ts
git commit -m "feat(lamplight): lamplight-chat edge function (gated, grounded, persisted)"
```

---

### Task 9: Frontend chat client `sendChatMessage`

**Files:**
- Create: `src/notepad/bible/lamplight-chat-client.ts`
- Test: `src/notepad/bible/lamplight-chat-client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/notepad/bible/lamplight-chat-client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { sendChatMessage } from './lamplight-chat-client';

describe('sendChatMessage', () => {
  it('invokes lamplight-chat with the passage + message and returns the reply', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { ok: true, thread_id: 't1', reply: 'Grace.', citations: [{ type: 'verse', ref: 'jhn 10:11' }] },
      error: null,
    });
    const out = await sendChatMessage(invoke, { book: 'jhn', chapter: 10, message: 'hi' });
    expect(invoke).toHaveBeenCalledWith('lamplight-chat', { body: { book: 'jhn', chapter: 10, message: 'hi' } });
    expect(out).toEqual({ ok: true, threadId: 't1', reply: 'Grace.', citations: [{ type: 'verse', ref: 'jhn 10:11' }] });
  });

  it('maps a function transport error to ok:false', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { message: 'network' } });
    const out = await sendChatMessage(invoke, { book: 'jhn', chapter: 10, message: 'hi' });
    expect(out).toEqual({ ok: false, reason: 'network' });
  });

  it('passes through a server ok:false reason (e.g. no_entitlement)', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: false, reason: 'no_entitlement' }, error: null });
    const out = await sendChatMessage(invoke, { book: 'jhn', chapter: 10, message: 'hi' });
    expect(out).toEqual({ ok: false, reason: 'no_entitlement' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/bible/lamplight-chat-client.test.ts`
Expected: FAIL — cannot resolve `./lamplight-chat-client`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/notepad/bible/lamplight-chat-client.ts
export interface ChatCitation { type: 'note' | 'verse'; ref: string }

export type InvokeFn = (
  name: string,
  options: { body: unknown },
) => Promise<{ data: unknown; error: { message: string } | null }>;

export interface SendChatArgs { book: string; chapter: number; message: string }

export type SendChatResult =
  | { ok: true; threadId: string; reply: string; citations: ChatCitation[] }
  | { ok: false; reason: string };

export async function sendChatMessage(invoke: InvokeFn, args: SendChatArgs): Promise<SendChatResult> {
  const { data, error } = await invoke('lamplight-chat', { body: { book: args.book, chapter: args.chapter, message: args.message } });
  if (error) return { ok: false, reason: error.message };
  const d = data as { ok?: boolean; reason?: string; thread_id?: string; reply?: string; citations?: ChatCitation[] } | null;
  if (!d || d.ok !== true) return { ok: false, reason: d?.reason ?? 'unknown_error' };
  return { ok: true, threadId: d.thread_id ?? '', reply: d.reply ?? '', citations: d.citations ?? [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/bible/lamplight-chat-client.test.ts`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/bible/lamplight-chat-client.ts src/notepad/bible/lamplight-chat-client.test.ts
git commit -m "feat(bible): sendChatMessage client for the lamplight-chat function"
```

---

### Task 10: `useChatThread` — load saved messages per passage

**Files:**
- Create: `src/notepad/bible/useChatThread.ts`
- Test: `src/notepad/bible/useChatThread.test.ts`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// src/notepad/bible/useChatThread.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

const order = vi.fn();
const eqMsg = vi.fn(() => msgBuilder);
const selectMsg = vi.fn(() => msgBuilder);
const eqThread = vi.fn(() => threadBuilder);
const selectThread = vi.fn(() => threadBuilder);
const maybeSingle = vi.fn();
const from = vi.fn((t: string) => (t === 'lamplight_chat_threads' ? threadBuilder : msgBuilder));

const threadBuilder = { select: selectThread, eq: eqThread, maybeSingle };
let orderResult: { data: unknown; error: unknown } = { data: [], error: null };
const msgBuilder = { select: selectMsg, eq: eqMsg, order, then: (r: (v: unknown) => unknown) => Promise.resolve(r(orderResult)) };
order.mockImplementation(() => msgBuilder);

vi.mock('@/lib/supabase', () => ({ supabase: { from } }));
import { useChatThread } from './useChatThread';

beforeEach(() => {
  vi.clearAllMocks();
  from.mockImplementation((t: string) => (t === 'lamplight_chat_threads' ? threadBuilder : msgBuilder));
  order.mockImplementation(() => msgBuilder);
  orderResult = { data: [], error: null };
});
afterEach(cleanup);

describe('useChatThread', () => {
  it('returns [] when no thread exists for the passage', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useChatThread('jhn', 10, 'u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toEqual([]);
  });

  it('loads ordered messages when a thread exists', async () => {
    maybeSingle.mockResolvedValue({ data: { id: 't1' }, error: null });
    orderResult = {
      data: [
        { id: 'm1', role: 'user', content: 'hi', citations: [] },
        { id: 'm2', role: 'assistant', content: 'grace', citations: [{ type: 'verse', ref: 'jhn 10:11' }] },
      ],
      error: null,
    };
    const { result } = renderHook(() => useChatThread('jhn', 10, 'u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(eqMsg).toHaveBeenCalledWith('thread_id', 't1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/bible/useChatThread.test.ts`
Expected: FAIL — cannot resolve `./useChatThread`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/notepad/bible/useChatThread.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ChatCitation } from './lamplight-chat-client';

export interface ChatThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: ChatCitation[];
}

export interface UseChatThreadResult {
  messages: ChatThreadMessage[];
  loading: boolean;
  error: string | null;
  /** Append messages locally (after a send) without a re-fetch. */
  append: (msgs: ChatThreadMessage[]) => void;
  reload: () => void;
}

export function useChatThread(book: string, chapter: number, userId: string | null): UseChatThreadResult {
  const [messages, setMessages] = useState<ChatThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const passageRef = `${book}.${chapter}`;
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const append = useCallback((msgs: ChatThreadMessage[]) => setMessages((prev) => [...prev, ...msgs]), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessages([]);

    if (!supabase || !userId) {
      setLoading(false);
      return;
    }

    (async () => {
      const thread = await supabase
        .from('lamplight_chat_threads')
        .select('id')
        .eq('user_id', userId)
        .eq('passage_ref', passageRef)
        .maybeSingle();
      if (cancelled) return;
      if (thread.error) { setError(thread.error.message); setLoading(false); return; }
      const threadId = (thread.data as { id?: string } | null)?.id;
      if (!threadId) { setMessages([]); setLoading(false); return; }

      const { data, error: mErr } = await supabase
        .from('lamplight_chat_messages')
        .select('id, role, content, citations')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (mErr) { setError(mErr.message); setMessages([]); }
      else setMessages((data ?? []) as ChatThreadMessage[]);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [passageRef, userId, nonce]);

  return { messages, loading, error, append, reload };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/bible/useChatThread.test.ts`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/bible/useChatThread.ts src/notepad/bible/useChatThread.test.ts
git commit -m "feat(bible): useChatThread loads saved chat per passage"
```

---

### Task 11: `ChatMessage` component

**Files:**
- Create: `src/notepad/components/lamplight/chat/ChatMessage.tsx`
- Test: `src/notepad/components/lamplight/chat/ChatMessage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// src/notepad/components/lamplight/chat/ChatMessage.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ChatMessage } from './ChatMessage';

afterEach(cleanup);

describe('ChatMessage', () => {
  it('renders user content', () => {
    render(<ChatMessage role="user" content="What does shepherd mean?" citations={[]} />);
    expect(screen.getByText('What does shepherd mean?')).toBeInTheDocument();
  });

  it('renders an assistant reply with a humanized verse citation chip', () => {
    render(<ChatMessage role="assistant" content="The shepherd gives his life." citations={[{ type: 'verse', ref: 'jhn 10:11' }]} />);
    expect(screen.getByText('The shepherd gives his life.')).toBeInTheDocument();
    expect(screen.getByText('John 10:11')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/components/lamplight/chat/ChatMessage.test.tsx`
Expected: FAIL — cannot resolve `./ChatMessage`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/notepad/components/lamplight/chat/ChatMessage.tsx
import { bookByAbbrev } from '@/notepad/bible/bible-books';
import type { ChatCitation } from '@/notepad/bible/lamplight-chat-client';

export interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  citations: ChatCitation[];
}

/** "jhn 10:11" → "John 10:11"; notes pass through as-is (label resolved by caller upstream if needed). */
function humanizeRef(c: ChatCitation): string {
  if (c.type === 'verse') {
    const m = c.ref.match(/^([0-9a-z]{3})\s+(.+)$/i);
    if (m) return `${bookByAbbrev(m[1].toLowerCase())?.name ?? m[1]} ${m[2]}`;
  }
  return c.ref;
}

export function ChatMessage({ role, content, citations }: ChatMessageProps) {
  const isUser = role === 'user';
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className="max-w-[85%] text-[12px] leading-[1.55] p-2.5"
        style={{
          fontFamily: 'Outfit, sans-serif',
          borderRadius: isUser ? '11px 11px 3px 11px' : '11px 11px 11px 3px',
          background: isUser ? '#C49A78' : '#fff',
          color: isUser ? '#fff' : '#4a4136',
          border: isUser ? 'none' : '1px solid #ece2d4',
        }}
      >
        <span>{content}</span>
        {!isUser && citations.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {citations.map((c, i) => (
              <span
                key={`${c.type}-${c.ref}-${i}`}
                className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(122,155,174,0.14)', color: '#5d7c8b', border: '1px solid rgba(122,155,174,0.3)' }}
              >
                ↳ {humanizeRef(c)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/components/lamplight/chat/ChatMessage.test.tsx`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/chat/ChatMessage.tsx src/notepad/components/lamplight/chat/ChatMessage.test.tsx
git commit -m "feat(bible): ChatMessage bubble with humanized citation chips"
```

---

### Task 12: `LamplightChat` panel (history + input + send)

**Files:**
- Create: `src/notepad/components/lamplight/chat/LamplightChat.tsx`
- Test: `src/notepad/components/lamplight/chat/LamplightChat.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// src/notepad/components/lamplight/chat/LamplightChat.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const useChatThread = vi.fn();
const sendChatMessage = vi.fn();
vi.mock('@/notepad/bible/useChatThread', () => ({ useChatThread: (...a: unknown[]) => useChatThread(...a) }));
vi.mock('@/notepad/bible/lamplight-chat-client', () => ({ sendChatMessage: (...a: unknown[]) => sendChatMessage(...a) }));

import { LamplightChat } from './LamplightChat';

afterEach(cleanup);

function setup(threadOverrides = {}) {
  useChatThread.mockReturnValue({
    messages: [], loading: false, error: null, append: vi.fn(), reload: vi.fn(), ...threadOverrides,
  });
}

describe('LamplightChat', () => {
  it('sends a message and appends the user + assistant turns', async () => {
    const append = vi.fn();
    setup({ append });
    sendChatMessage.mockResolvedValue({ ok: true, threadId: 't1', reply: 'Grace and peace.', citations: [] });
    const invoke = vi.fn();
    render(<LamplightChat book="jhn" chapter={10} userId="u1" invoke={invoke} />);

    fireEvent.change(screen.getByPlaceholderText(/ask about this passage/i), { target: { value: 'what is this about?' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(sendChatMessage).toHaveBeenCalledWith(invoke, { book: 'jhn', chapter: 10, message: 'what is this about?' }));
    await waitFor(() => expect(append).toHaveBeenCalled());
  });

  it('shows an error bubble when the send fails', async () => {
    setup();
    sendChatMessage.mockResolvedValue({ ok: false, reason: 'network' });
    render(<LamplightChat book="jhn" chapter={10} userId="u1" invoke={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/ask about this passage/i), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(screen.getByText(/couldn’t reach lamplight|couldn't reach lamplight/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/components/lamplight/chat/LamplightChat.test.tsx`
Expected: FAIL — cannot resolve `./LamplightChat`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/notepad/components/lamplight/chat/LamplightChat.tsx
import { useState } from 'react';
import { useChatThread, type ChatThreadMessage } from '@/notepad/bible/useChatThread';
import { sendChatMessage, type InvokeFn } from '@/notepad/bible/lamplight-chat-client';
import { ChatMessage } from './ChatMessage';

export interface LamplightChatProps {
  book: string;
  chapter: number;
  userId: string;
  invoke: InvokeFn;
}

let localIdSeq = 0;
const localId = () => `local-${++localIdSeq}`;

export function LamplightChat({ book, chapter, userId, invoke }: LamplightChatProps) {
  const thread = useChatThread(book, chapter, userId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setDraft('');
    setError(null);
    setSending(true);
    const userMsg: ChatThreadMessage = { id: localId(), role: 'user', content: message, citations: [] };
    thread.append([userMsg]);
    try {
      const res = await sendChatMessage(invoke, { book, chapter, message });
      if (res.ok) {
        thread.append([{ id: localId(), role: 'assistant', content: res.reply, citations: res.citations }]);
      } else {
        setError(res.reason);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'rgba(255,255,255,0.45)', fontFamily: 'Outfit, sans-serif' }}>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {thread.loading && <p className="text-[11px]" style={{ color: 'var(--silica)' }}>Loading conversation…</p>}
        {!thread.loading && thread.messages.length === 0 && (
          <p className="text-[11px]" style={{ color: 'var(--silica)' }}>
            Ask Lamplight about this passage — it draws on your own notes.
          </p>
        )}
        {thread.messages.map((m) => (
          <ChatMessage key={m.id} role={m.role} content={m.content} citations={m.citations} />
        ))}
        {sending && <p className="text-[11px] italic" style={{ color: 'var(--silica)' }}>Lamplight is reflecting…</p>}
        {error && (
          <p className="text-[11px]" style={{ color: '#b45454' }}>
            Couldn’t reach Lamplight ({error}). Try again.
          </p>
        )}
      </div>
      <div className="p-2.5 flex gap-2 items-center" style={{ borderTop: '1px solid var(--pale-stone)' }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder="Ask about this passage…"
          className="flex-1 text-[12px] px-3 py-1.5 rounded-full"
          style={{ background: '#fff', border: '1px solid var(--pale-stone)', color: 'var(--deep-umber)' }}
        />
        <button
          aria-label="Send"
          onClick={() => void send()}
          disabled={sending || !draft.trim()}
          className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-40"
          style={{ background: '#C49A78', color: '#fff' }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/components/lamplight/chat/LamplightChat.test.tsx`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/chat/LamplightChat.tsx src/notepad/components/lamplight/chat/LamplightChat.test.tsx
git commit -m "feat(bible): LamplightChat panel (history, send, loading, error)"
```

---

### Task 13: `BibleStudyPane` — reader + chat toggle + gating

**Files:**
- Create: `src/notepad/bible/BibleStudyPane.tsx`
- Test: `src/notepad/bible/BibleStudyPane.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// src/notepad/bible/BibleStudyPane.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const useAuthSession = vi.fn();
const useLamplightSettings = vi.fn();
const useLamplightEntitlement = vi.fn();
vi.mock('@/auth/context/useAuthSession', () => ({ useAuthSession: () => useAuthSession() }));
vi.mock('@/notepad/hooks/useLamplightSettings', () => ({ useLamplightSettings: () => useLamplightSettings() }));
vi.mock('@/notepad/hooks/useLamplightEntitlement', () => ({ useLamplightEntitlement: () => useLamplightEntitlement() }));
vi.mock('./BibleReader', () => ({ BibleReader: (p: { onPassageChange?: (r: unknown) => void }) => {
  // emit a passage on mount so the chat has a book/chapter
  p.onPassageChange?.({ book: 'jhn', chapter: 10 });
  return <div data-testid="bible-reader">reader</div>;
} }));
vi.mock('@/notepad/components/lamplight/chat/LamplightChat', () => ({ LamplightChat: () => <div data-testid="chat">chat</div> }));
vi.mock('@/notepad/components/lamplight/SignInGate', () => ({ SignInGate: () => <div data-testid="signin">signin</div> }));
vi.mock('@/notepad/components/lamplight/PaywallCard', () => ({ PaywallCard: () => <div data-testid="paywall">paywall</div> }));

import { BibleStudyPane } from './BibleStudyPane';

const adapter = {} as never;
beforeEach(() => {
  useAuthSession.mockReturnValue({ user: { id: 'u1' } });
  useLamplightSettings.mockReturnValue({ isLoading: false, settings: { enabled: true } });
  useLamplightEntitlement.mockReturnValue({ isLoading: false, hasAccess: () => true });
});
afterEach(cleanup);

describe('BibleStudyPane', () => {
  it('always shows the reader; chat is hidden until toggled on', () => {
    render(<BibleStudyPane lamplightAdapter={adapter} invoke={vi.fn()} />);
    expect(screen.getByTestId('bible-reader')).toBeInTheDocument();
    expect(screen.queryByTestId('chat')).not.toBeInTheDocument();
  });

  it('opens the chat when the entitled user toggles Lamplight on', async () => {
    render(<BibleStudyPane lamplightAdapter={adapter} invoke={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /lamplight/i }));
    await waitFor(() => expect(screen.getByTestId('chat')).toBeInTheDocument());
  });

  it('shows the paywall (not the chat) when toggled on without entitlement', () => {
    useLamplightEntitlement.mockReturnValue({ isLoading: false, hasAccess: () => false });
    render(<BibleStudyPane lamplightAdapter={adapter} invoke={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /lamplight/i }));
    expect(screen.getByTestId('paywall')).toBeInTheDocument();
    expect(screen.queryByTestId('chat')).not.toBeInTheDocument();
  });

  it('shows the sign-in gate when toggled on while logged out', () => {
    useAuthSession.mockReturnValue({ user: null });
    render(<BibleStudyPane lamplightAdapter={adapter} invoke={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /lamplight/i }));
    expect(screen.getByTestId('signin')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/bible/BibleStudyPane.test.tsx`
Expected: FAIL — cannot resolve `./BibleStudyPane`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/notepad/bible/BibleStudyPane.tsx
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuthSession } from '@/auth/context/useAuthSession';
import { useLamplightSettings } from '@/notepad/hooks/useLamplightSettings';
import { useLamplightEntitlement } from '@/notepad/hooks/useLamplightEntitlement';
import type { LamplightAdapter } from '@/notepad/storage/lamplight-adapter';
import { SignInGate } from '@/notepad/components/lamplight/SignInGate';
import { PaywallCard } from '@/notepad/components/lamplight/PaywallCard';
import { LamplightChat } from '@/notepad/components/lamplight/chat/LamplightChat';
import type { InvokeFn } from './lamplight-chat-client';
import { BibleReader, type PassageRef } from './BibleReader';

export interface BibleStudyPaneProps {
  lamplightAdapter: LamplightAdapter | null;
  invoke: InvokeFn;
}

export function BibleStudyPane({ lamplightAdapter, invoke }: BibleStudyPaneProps) {
  const { user } = useAuthSession();
  const userId = user?.id ?? null;
  const [chatOpen, setChatOpen] = useState(false);
  const [passage, setPassage] = useState<PassageRef>({ book: 'jhn', chapter: 1 });

  // Hooks are always called (Rules of Hooks); they no-op on a null adapter/user.
  const settings = useLamplightSettings({ adapter: lamplightAdapter as LamplightAdapter, userId: lamplightAdapter ? userId : null });
  const entitlement = useLamplightEntitlement({ adapter: lamplightAdapter as LamplightAdapter, userId: lamplightAdapter ? userId : null });

  const renderChatArea = () => {
    if (!user) return <SignInGate />;
    if (settings.isLoading || entitlement.isLoading) {
      return <div className="p-4 text-[11px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>Loading…</div>;
    }
    if (!entitlement.hasAccess('chat')) return <PaywallCard />;
    return <LamplightChat book={passage.book} chapter={passage.chapter} userId={user.id} invoke={invoke} />;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end px-3 py-2 shrink-0">
        <button
          onClick={() => setChatOpen((o) => !o)}
          className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider px-2.5 py-1 rounded-full"
          style={{
            fontFamily: 'Outfit, sans-serif',
            background: chatOpen ? '#C49A78' : '#fff',
            color: chatOpen ? '#fff' : '#8a6c50',
            border: '1px solid #e2d7c8',
          }}
        >
          <Sparkles className="w-3 h-3" /> Lamplight {chatOpen ? '●' : '○'}
        </button>
      </div>

      <div className={chatOpen ? 'flex-1 min-h-0 flex flex-col' : 'flex-1 min-h-0'}>
        <div className={chatOpen ? 'flex-1 min-h-0 overflow-hidden' : 'h-full'}>
          <BibleReader onPassageChange={setPassage} />
        </div>
        {chatOpen && (
          <div className="flex-1 min-h-0" style={{ borderTop: '1px solid var(--pale-stone)' }}>
            {renderChatArea()}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/bible/BibleStudyPane.test.tsx`
Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/bible/BibleStudyPane.tsx src/notepad/bible/BibleStudyPane.test.tsx
git commit -m "feat(bible): BibleStudyPane composes reader + gated Lamplight chat"
```

---

### Task 14: Wire `BibleStudyPane` into `StudyWindow` + `Notepad`

**Files:**
- Modify: `src/components/sections/notepad/StudyWindow.tsx`
- Test: `src/components/sections/notepad/StudyWindow.test.tsx`
- Modify: `src/components/sections/Notepad.tsx`

- [ ] **Step 1: Update the StudyWindow test (replace the BibleReader mock + props)**

In `StudyWindow.test.tsx`, replace the BibleReader mock with a BibleStudyPane mock and pass the new prop:

```tsx
vi.mock('@/notepad/bible/BibleStudyPane', () => ({ BibleStudyPane: () => <div data-testid="bible-study">bible</div> }));
```

Update the three render calls and the default-tab assertion to use the new test id and pass props:

```tsx
  it('defaults to the Bible tab', () => {
    render(<StudyWindow graphOpen={true} lamplightAdapter={null} invoke={vi.fn()} />);
    expect(screen.getByTestId('bible-study')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-pane')).not.toBeInTheDocument();
  });
```

(Apply the same `lamplightAdapter={null} invoke={vi.fn()}` props and `bible-study` test id to the other two cases; remove the old `@/notepad/bible/BibleReader` mock and `bible-reader` references.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/sections/notepad/StudyWindow.test.tsx`
Expected: FAIL — StudyWindow still renders `BibleReader` / doesn't accept `lamplightAdapter`/`invoke`.

- [ ] **Step 3: Update StudyWindow**

3a. Replace the import:

```tsx
import { BibleStudyPane } from '@/notepad/bible/BibleStudyPane';
import type { LamplightAdapter } from '@/notepad/storage/lamplight-adapter';
import type { InvokeFn } from '@/notepad/bible/lamplight-chat-client';
```

(remove `import { BibleReader } from '@/notepad/bible/BibleReader';`)

3b. Extend the props interface:

```tsx
interface StudyWindowProps {
  graphOpen: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  lamplightAdapter: LamplightAdapter | null;
  invoke: InvokeFn;
}
```

3c. Update the signature + body:

```tsx
export function StudyWindow({ graphOpen, expanded = false, onToggleExpand, lamplightAdapter, invoke }: StudyWindowProps) {
```

3d. Replace the Bible-tab body:

```tsx
        {tab === 'bible' ? (
          <BibleStudyPane lamplightAdapter={lamplightAdapter} invoke={invoke} />
        ) : (
          <GraphPane graphOpen={graphOpen} embedded />
        )}
```

- [ ] **Step 4: Update the Notepad mount to pass the new props**

In `src/components/sections/Notepad.tsx`, change the `StudyWindow` usage to:

```tsx
        {/* Study Window — Bible reader + gated Lamplight chat + graph, tabbed */}
        <StudyWindow
          graphOpen={graphOpen}
          expanded={graphExpanded}
          onToggleExpand={() => setGraphExpanded(!graphExpanded)}
          lamplightAdapter={lamplightAdapter}
          invoke={(name, options) => supabase!.functions.invoke(name, options)}
        />
```

> `lamplightAdapter` and `supabase` are already in scope in `Notepad` (lines ~19, ~34, ~53). The `invoke` shape matches the existing `useLamplightEmbeddingTrigger` usage on line 53.

- [ ] **Step 5: Run StudyWindow test + typecheck + lint + full suite**

Run: `npm run test -- src/components/sections/notepad/StudyWindow.test.tsx && npx tsc -b --noEmit && npm run lint && npm run test`
Expected: all pass; no type/lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/notepad/StudyWindow.tsx src/components/sections/notepad/StudyWindow.test.tsx src/components/sections/Notepad.tsx
git commit -m "feat(notepad): wire BibleStudyPane (reader + chat) into StudyWindow"
```

---

### Task 15: RLS isolation test for chat tables

**Files:**
- Create: `src/notepad/storage/lamplight-chat-rls.test.ts`

This mirrors `lamplight-rls.test.ts` (env-gated integration test; skips when test creds are absent).

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const A_EMAIL = process.env.SUPABASE_TEST_USER_A_EMAIL;
const A_PASS = process.env.SUPABASE_TEST_USER_A_PASS;
const B_EMAIL = process.env.SUPABASE_TEST_USER_B_EMAIL;
const B_PASS = process.env.SUPABASE_TEST_USER_B_PASS;
const haveEnv = URL && ANON && A_EMAIL && A_PASS && B_EMAIL && B_PASS;
const maybe = haveEnv ? describe : describe.skip;

async function signIn(email: string, pass: string) {
  const client = createClient(URL!, ANON!);
  const { data, error } = await client.auth.signInWithPassword({ email, password: pass });
  if (error) throw error;
  return { client, userId: data.user!.id };
}

maybe('Lamplight chat RLS isolation (integration)', () => {
  let A: { client: SupabaseClient; userId: string };
  let B: { client: SupabaseClient; userId: string };
  beforeAll(async () => { A = await signIn(A_EMAIL!, A_PASS!); B = await signIn(B_EMAIL!, B_PASS!); });

  it("user B cannot read user A's chat threads", async () => {
    const passageRef = `rls.${Date.now()}`;
    const ins = await A.client.from('lamplight_chat_threads').insert({
      user_id: A.userId, book: 'rls', chapter: 1, passage_ref: passageRef, title: 't',
    }).select('id').single();
    expect(ins.error).toBeNull();

    const leak = await B.client.from('lamplight_chat_threads').select('id').eq('passage_ref', passageRef);
    expect(leak.error).toBeNull();
    expect(leak.data).toEqual([]);

    await A.client.from('lamplight_chat_threads').delete().eq('id', ins.data!.id);
  });

  it("user B cannot insert a chat thread impersonating user A", async () => {
    const { error } = await B.client.from('lamplight_chat_threads').insert({
      user_id: A.userId, book: 'rls', chapter: 2, passage_ref: `imp.${Date.now()}`, title: 't',
    });
    expect(error).not.toBeNull();
  });

  it("user B cannot insert a chat message impersonating user A", async () => {
    const { error } = await B.client.from('lamplight_chat_messages').insert({
      thread_id: '00000000-0000-0000-0000-0000000000aa',
      user_id: A.userId, role: 'user', content: 'x', citations: [],
    });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run (skips without creds; runs in CI where creds exist)**

Run: `npm run test -- src/notepad/storage/lamplight-chat-rls.test.ts`
Expected: PASS or SKIP (skips cleanly when `SUPABASE_TEST_*` env is unset).

- [ ] **Step 3: Commit**

```bash
git add src/notepad/storage/lamplight-chat-rls.test.ts
git commit -m "test(lamplight): chat tables RLS owner-isolation integration test"
```

---

### Task 16: Deploy + manual verification

**Files:** none (ops/manual).

- [ ] **Step 1: Apply the migration to the target project**

Run: `supabase db push` (or `supabase migration up` against the linked project).
Expected: `024_lamplight_chat_threads` applied.

- [ ] **Step 2: Set function secrets + deploy**

Run:
```bash
supabase secrets set ANTHROPIC_API_KEY=... VOYAGE_AI_KEY=... ALLOWED_ORIGINS=https://<your-domain>
supabase functions deploy lamplight-chat
```
Expected: deploy succeeds (confirms Deno imports resolve).

- [ ] **Step 3: Manual end-to-end check**
  - `npm run dev`, open `/notepad` as a user whose `lamplight_settings.enabled = true` and who has `plus` entitlement (or with the promo flag on).
  - Open the right window → Bible tab → toggle **Lamplight ●**.
  - Ask a question about the open chapter. Confirm: loading state → grounded reply → citation chips (verse chips show "John 10:11" style names).
  - Reload the page, reopen the same chapter, toggle Lamplight → the prior conversation reloads.
  - As a non-entitled user, toggling Lamplight shows the paywall; logged-out shows the sign-in gate; the **reader still works** in all cases.
  - Ask an off-topic / pastoral-advice question → confirm Lamplight redirects to Scripture rather than advising.

- [ ] **Step 4: No commit** (verification only).

---

## Self-Review

- **Spec coverage (Phase 2 rows):** new `lamplight-chat` edge function ✓ (Task 8); reuse retrieval/anthropic/guardrail/entitlement ✓ (Tasks 2,4,5,7,8); migration `024` + owner RLS ✓ (Tasks 1,15); `'chat'` entitlement gated to plus/promo ✓ (Tasks 2,3); `LamplightChat`/`ChatMessage` + `SignInGate`/`PaywallCard` gating ✓ (Tasks 11,12,13); `BibleStudyPane` composing reader + chat ✓ (Task 13); saved-per-passage persist + reload ✓ (Tasks 8,10). Proactive opening insight + mobile parity intentionally deferred to Phase 3 (Scope boundary).
- **Deviation from the spec note:** the spec text described SSE streaming; this plan implements structured, non-streaming, citation-validated turns because `_shared/anthropic.ts` is tool-use only and citation-first depends on structured output. Update the spec's data-flow line to match. (Lower risk, stronger grounding; streaming can be a later enhancement.)
- **Placeholder scan:** none — every code step has complete code; every command has expected output.
- **Type consistency:** `ChatReply`/`Citation` from `validators.ts` reused by the pipeline (Task 7) and validator (Task 4); `ChatCitation`/`InvokeFn`/`SendChatResult` from `lamplight-chat-client.ts` reused by `useChatThread` (10), `ChatMessage` (11), `LamplightChat` (12), `BibleStudyPane` (13), `StudyWindow` (14); `BibleChatContext` defined in the pipeline (7) and imported by the prompt (6) and handler (8); `PassageRef` from Phase 1's `BibleReader` reused by `BibleStudyPane` (13); `hasChatAccess`/`LamplightTier` (2) used by the handler (8). `'chat'` feature added to `LamplightFeature` (3) and consumed by `BibleStudyPane` (13).
- **One cross-check to confirm during Task 8:** the promo flag key/shape in `app_config` — match whatever `supabase-lamplight-adapter.ts#getPromoConfig` reads (the plan assumes key `lamplight_promo_active`; adjust if the adapter uses a different key).

## Follow-on (Phase 3+, separate plans)

- **Phase 3 — proactive opening insight** (auto-fire one grounded insight when a passage opens with chat on) + thread title polish + "new thread" affordance.
- **Phase 4 — mobile parity:** wire `BibleStudyPane` into `src/components/sections/notepad/mobile/LamplightMobileView.tsx`.
