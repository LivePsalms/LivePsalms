# Lamplight chat: toggle gate + reliable no-notes insight

**Date:** 2026-06-10
**Status:** Approved (design)

## Problem

Two related issues on the notepad's Bible-study pane:

1. **The "Lamplight Chat" button is clickable even when Lamplight is toggled OFF** in
   settings (`/profile` → Lamplight section). Clicking it opens the chat and calls the
   `lamplight-chat` edge function, which returns **403 `not_opted_in`**
   ([supabase/functions/lamplight-chat/index.ts:73](../../../supabase/functions/lamplight-chat/index.ts#L73)).
   Supabase surfaces that as the user-facing error:
   *"Couldn't reach Lamplight (Edge Function returned a non-2xx status code). Try again."*

2. **When a user has no notes the AI can read from**, the opening insight should still
   give insight on the passage and gently acknowledge the absence of notes. The
   opening-insight prompt already intends this, but the wording is soft and unreliable.

The root cause of the visible error in (1) is that the chat area in
[BibleStudyPane.tsx:41-48](../../../src/notepad/bible/BibleStudyPane.tsx#L41-L48) gates on
**sign-in** and **entitlement**, but **not** on `settings.enabled`.

## Goals

- When signed in and Lamplight is OFF, the chat is not reachable from the UI (so the
  `not_opted_in` 403 is unreachable) and the user is told where to enable it.
- The opening insight reliably acknowledges a no-notes state while still giving
  passage insight.

## Non-goals

- The desktop **Lamplight tab** (daily devotion) and **mobile** today/connections
  surfaces. Those use `LamplightTabPanel`, which self-gates via its own opt-in flow.
  Mobile has no separate chat entry point (verified: no `LamplightChat` usage under
  `src/components/sections/notepad/mobile/`).
- Changing ongoing chat replies (`BIBLE_CHAT_PROMPT`). The no-notes acknowledgment
  lives in the **opening insight only**, so it does not repeat each turn.

## Design

### Part 1 — Gate the chat button on `settings.enabled`

**File:** `src/notepad/bible/BibleStudyPane.tsx`

- Derive `lamplightOn = settings.settings?.enabled === true` (the `useLamplightSettings`
  hook is already wired in at line 38).
- The **"Lamplight Chat" button** is disabled (greyed, `cursor: not-allowed`, not
  clickable) when **all** of: the user is signed in, settings have finished loading
  (`!settings.isLoading`), and `!lamplightOn`.
- A small hint renders adjacent to the button when disabled:
  **"Enable Lamplight in Settings to chat"**, linking to `/profile`.
- **Defense in depth:** `renderChatArea()` also returns the same hint when `!lamplightOn`,
  so even if the panel is already open (e.g. toggled off in another tab) it cannot call
  the edge function.
- **Signed-out users keep today's behavior:** the button stays enabled and opens the
  existing `SignInGate`. The disable applies only when a user is signed in (a signed-out
  user can't act on "enable in Settings").
- **While settings are loading**, the button stays enabled to avoid flicker; clicking
  during load shows the existing "Loading…" state in the panel.

Result: the edge function's `not_opted_in` 403 is unreachable from the UI; the error
goes away for the toggle-off case. (If the error recurs while Lamplight is ON, it is a
different cause — missing API keys, quota, or entitlement — and out of scope here.)

### Part 2 — Strengthen the no-notes opening insight

**File:** `supabase/functions/lamplight-chat/prompts/bible-insight.ts`

- Tighten the `system` rule so that when no related notes are supplied, the insight
  reliably:
  1. names the absence warmly in one short sentence (e.g. "you haven't connected any
     notes to this yet…"), then
  2. offers a grounded observation on the passage itself, ending in the single open
     question already required.
- Stays within the Lamplight voice principle: possibility, never pronouncement; no
  prophetic/pastoral/predictive speech.
- Bump `promptVersion` → `bible-insight-2026-06-10-v3`.
- `buildMessages` already emits `(the user has no related notes yet)` when `ctx.notes`
  is empty; keep that signal.

## Testing (TDD)

- **Part 1** — `BibleStudyPane` test:
  - signed in + `enabled: false` (loaded) → button disabled, hint shown, edge function
    not called on click.
  - signed in + `enabled: true` → button enabled, chat opens.
  - signed out → button enabled, opens `SignInGate`.
- **Part 2** — `bible-chat-pipeline` test:
  - insight path with an empty-notes context produces a non-error reply with the
    expected `{ reply, citations }` structure (the acknowledgment prose is model-driven,
    so assert structure/branch, not exact wording).

## Files touched

- `src/notepad/bible/BibleStudyPane.tsx` (+ test)
- `supabase/functions/lamplight-chat/prompts/bible-insight.ts`
- `supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts` (or a sibling test)
