# Bible Studies Tab — Design Spec

**Date:** 2026-06-07
**Status:** Approved (brainstorming) — ready for implementation plan
**Surface:** `/notepad` right-hand pane (the current "graph window")

## Summary

Turn the right-hand pane into a tabbed window with two tabs: **Bible** (first)
and **Graph** (second). The Bible tab contains a full Bible reader for navigating
all 66 books, plus a Lamplight AI chat that comments on the passage being studied
and answers the user's questions — personalized to the user's own notes via the
existing Lamplight retrieval layer.

The Bible reader is **free for all users**. The Lamplight chat is **gated** behind
the existing Lamplight paid entitlement. Study conversations are **saved per
passage**. Ships for **desktop and mobile** together.

## Goals

- Add a Bible reader the user can navigate (book → chapter → verse), reading from
  the existing `bible_passages` corpus.
- Add a Lamplight chat that (a) proactively offers an opening insight when a passage
  is opened with chat on, and (b) answers open devotional questions — always
  scripture-grounded, citation-first, and personalized to the user's notes.
- Reuse the existing Lamplight architecture (retrieval, entitlement, citation
  validator, doctrinal guardrail) rather than building parallel machinery.

## Non-Goals

- No new Bible-text data pipeline. The BSB corpus (`scripts/data/bsb.txt`, ~31k
  verses, 66 books, public domain) and its ingest into `bible_passages` +
  `lamplight_embeddings` already exist.
- No fine-tuning / model training. "Trained on the user's notes" = retrieval over
  existing note embeddings (RAG personalization).
- The chat does not become a pastor/counselor. Even with open Q&A, the doctrinal
  guardrail stays in force (no pastoral/prophetic/psychological advice; plain
  reading of Scripture only).

## Key Decisions

| Decision | Choice |
|---|---|
| Tab order | **Bible** first, **Graph** second |
| Chat scope | Open devotional Q&A, with doctrinal guardrails retained |
| Access gating | Reader free; chat gated behind Lamplight entitlement |
| Chat history | Saved per passage (one thread per user per passage) |
| Platform | Desktop pane + mobile view together |
| LLM integration | New streaming `lamplight-chat` Edge Function (Approach A) |
| Proactive insight | When chat is on, opening/navigating to a passage drops one opening insight grounded in passage + notes; text box always available |

### Note on the architecture brief tension

`Lamplight_AI_details.md` lists "not a general-purpose chatbot / no ask-anything
surface" as a non-goal. This feature intentionally introduces an open chat, scoped
to Bible study. The reconciliation: input is open, but **behavior stays bounded** by
the existing citation validator + doctrinal guardrail. Off-topic or
pastoral-advice asks are redirected to Scripture rather than answered. This
supersedes the prior non-goal for this surface only.

## Architecture

### Frontend

- `src/components/sections/notepad/StudyWindow.tsx` — new thin container. Renders the
  tab bar (`Bible` | `Graph`), owns `activeTab` state, switches panels. `GraphPane`
  stays behaviorally unchanged; its internal `GRAPH` `<h3>` header is removed (tab
  label replaces it).
- `src/notepad/bible/`
  - `bible-books.ts` — canonical 66-book metadata (name, order, chapter counts). Pure data.
  - `useBiblePassages.ts` — hook reading `bible_passages` (public read) for a book/chapter.
  - `BibleReader.tsx` — book→chapter navigation, verse rendering, verse selection
    (selected verse(s) become the chat focus).
  - `BibleStudyPane.tsx` — composes reader + chat + the chat on/off toggle.
- `src/notepad/components/lamplight/chat/`
  - `LamplightChat.tsx` — message list + streaming input.
  - `ChatMessage.tsx` — renders a message with citation chips linking to notes / verses.
  - Gating reuses existing `SignInGate`, `ConsentCard`, `PaywallCard`.
- Mobile: wire `BibleStudyPane` into existing `LamplightMobileView.tsx` (already hosts
  `GraphPane`), so the tabs appear in the mobile sheet too.

Component state: `activeTab`, current `book`/`chapter`, selected verse(s), chat
on/off, active thread id.

### Backend

- `supabase/functions/lamplight-chat/index.ts` — new streaming (SSE) Edge Function,
  structured after `lamplight-generate`:
  1. **Auth + entitlement** — verify JWT, then server-side Lamplight entitlement check
     (never trust client toggle). No entitlement → `402`.
  2. **Retrieval** — reuse `_shared/retrieval.ts`: embed user message (+ open passage
     ref), pull top-K from `lamplight_embeddings` (notes + Bible corpus), plus the exact
     open passage via `_shared/bible-passage.ts`.
  3. **Context build** — open passage (always) + retrieved note snippets + recent
     thread messages.
  4. **LLM** — Claude (mid-tier per brief), streamed.
  5. **Validation** — existing citation validator + doctrinal guardrail; citations
     resolve to real note IDs or verse refs.
  6. **Persist** — append user + assistant messages (with `citations`) to the thread;
     upsert thread on first message for a passage.

### Data model — migration `024_lamplight_chat_threads.sql`

- `lamplight_chat_threads`
  - `(id, user_id, book, chapter, passage_ref, title, created_at, updated_at)`
  - One thread per user per passage.
- `lamplight_chat_messages`
  - `(id, thread_id, user_id, role, content, citations jsonb, created_at)`
- RLS: owner-only, mirroring existing `lamplight_artifacts` policies.
- `bible_passages` already has public-read RLS — no new policy needed.

## Data Flow (one turn)

User opens John 10 with chat on → client loads-or-creates the thread → proactive
opening insight requested (passage + notes) → user types → SSE stream renders
token-by-token → citation chips appear → both messages saved → reopening John 10
later restores the thread.

## Error Handling / Failure Modes

- LLM/stream failure → graceful "couldn't reach Lamplight, retry" bubble; partial
  stream discarded, not saved.
- Guardrail trip (off-topic / pastoral-advice ask) → Lamplight redirects to Scripture
  rather than answering.
- Reader works fully independent of the AI (free, no function dependency).
- Empty corpus (new user) → chat works on the passage alone; insight notes that it
  gets more personal as the user writes more.

## Testing

- `bible-books.test.ts` — metadata integrity (66 books, chapter counts).
- `useBiblePassages` — fetch/format; `BibleReader` navigation rendering.
- `lamplight-chat-threads.rls.test.ts` — owner isolation (precedent: `lamplight-rls.test.ts`).
- Edge function — retrieval context-builder unit tests; reuse existing
  guardrail/citation validation suites.
- Entitlement gating — reader visible logged-out; chat shows `SignInGate` /
  `PaywallCard` appropriately.

## Phasing (single spec, staged build)

1. Tabbed window + free Bible reader.
2. Chat data model + edge function + gated chat.
3. Proactive opening insight + saved-thread restore.
4. Mobile parity + polish.
