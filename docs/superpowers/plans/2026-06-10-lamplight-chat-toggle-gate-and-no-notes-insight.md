# Lamplight Chat Toggle Gate + No-Notes Insight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Bible-study "Lamplight Chat" button non-clickable (disabled + hint) when a signed-in user has Lamplight toggled off, and make the opening insight reliably acknowledge a no-notes state while still giving passage insight.

**Architecture:** Part 1 is a pure client-side gate in `BibleStudyPane.tsx` reading the already-wired `useLamplightSettings` hook. Part 2 is a prompt-wording tightening in the `lamplight-chat` edge function's opening-insight prompt. No new modules, no schema changes, no edge-function logic changes.

**Tech Stack:** React + TypeScript, Vitest + Testing Library (client), Deno edge function (prompt module, Vitest-tested via existing harness).

---

## File Structure

- `src/notepad/bible/BibleStudyPane.tsx` — add `lamplightOn`/`chatDisabled` derivation, disable the button, add the "Enable in Settings" hint, add the off-state guard inside `renderChatArea()`.
- `src/notepad/bible/BibleStudyPane.test.tsx` — add cases for the disabled button + hint, and that signed-out behavior is unchanged.
- `supabase/functions/lamplight-chat/prompts/bible-insight.ts` — tighten the no-notes system rule and bump `promptVersion`.
- `supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts` — add the no-notes insight structural guard + assert the new `promptVersion`.

---

## Task 1: Gate the Lamplight Chat button + panel on `settings.enabled`

**Files:**
- Modify: `src/notepad/bible/BibleStudyPane.tsx`
- Test: `src/notepad/bible/BibleStudyPane.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add these three cases inside the `describe('BibleStudyPane', ...)` block in `src/notepad/bible/BibleStudyPane.test.tsx` (after the existing `it('shows the sign-in gate ...')` case):

```tsx
  it('disables the chat button and shows the Settings hint when Lamplight is off', () => {
    useLamplightSettings.mockReturnValue({ isLoading: false, settings: { enabled: false } });
    render(<BibleStudyPane lamplightAdapter={adapter} invoke={vi.fn()} />);
    const button = screen.getByRole('button', { name: /lamplight/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/enable lamplight in settings/i)).toBeInTheDocument();
  });

  it('does not open the chat when the button is clicked while Lamplight is off', () => {
    useLamplightSettings.mockReturnValue({ isLoading: false, settings: { enabled: false } });
    render(<BibleStudyPane lamplightAdapter={adapter} invoke={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /lamplight/i }));
    expect(screen.queryByTestId('chat')).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('keeps the button enabled for signed-out users (sign-in flow preserved)', () => {
    useAuthSession.mockReturnValue({ user: null });
    useLamplightSettings.mockReturnValue({ isLoading: false, settings: null });
    render(<BibleStudyPane lamplightAdapter={adapter} invoke={vi.fn()} />);
    const button = screen.getByRole('button', { name: /lamplight/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(screen.getByTestId('signin')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/notepad/bible/BibleStudyPane.test.tsx`
Expected: the three new cases FAIL — the button is not disabled (no `disabled` attribute yet) and the hint text "Enable Lamplight in Settings to chat" is not found. The existing 5 cases still PASS.

- [ ] **Step 3: Implement the gate in `BibleStudyPane.tsx`**

In `src/notepad/bible/BibleStudyPane.tsx`, add the derived flags immediately after the two hook calls (currently lines 38-39):

```tsx
  // Hooks are always called (Rules of Hooks); they no-op on a null adapter/user.
  const settings = useLamplightSettings({ adapter: lamplightAdapter as LamplightAdapter, userId: lamplightAdapter ? userId : null });
  const entitlement = useLamplightEntitlement({ adapter: lamplightAdapter as LamplightAdapter, userId: lamplightAdapter ? userId : null });

  const lamplightOn = settings.settings?.enabled === true;
  // Only block a SIGNED-IN user who has loaded settings with Lamplight off. Signed-out
  // users keep the existing flow (button opens → SignInGate); they can't act on a
  // "turn it on in Settings" hint anyway.
  const chatDisabled = !!user && !settings.isLoading && !lamplightOn;
```

Replace the `renderChatArea` function (currently lines 41-48) with this version — it adds an off-state guard between the loading check and the entitlement check:

```tsx
  const renderChatArea = () => {
    if (!user) return <SignInGate />;
    if (settings.isLoading || entitlement.isLoading) {
      return <div className="p-4 text-[11px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>Loading…</div>;
    }
    if (!lamplightOn) {
      return (
        <div className="p-4 text-[11px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
          Lamplight is off. <a href="/profile" style={{ color: '#8a6c50', textDecoration: 'underline' }}>Enable it in Settings</a> to chat.
        </div>
      );
    }
    if (!entitlement.hasAccess('chat')) return <PaywallCard />;
    return <LamplightChat book={passage.book} chapter={passage.chapter} userId={user.id} invoke={invoke} />;
  };
```

Replace the button container block (currently lines 52-65) with this version — it disables the button, dims it, blocks the open toggle, and renders the hint:

```tsx
      <div className="flex flex-col items-end gap-1 px-3 py-2 shrink-0">
        <button
          onClick={() => { if (!chatDisabled) setChatOpen((o) => !o); }}
          disabled={chatDisabled}
          aria-disabled={chatDisabled}
          className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider px-2.5 py-1 rounded-full"
          style={{
            fontFamily: 'Outfit, sans-serif',
            background: chatOpen ? '#C49A78' : '#fff',
            color: chatDisabled ? '#b8ab99' : chatOpen ? '#fff' : '#8a6c50',
            border: '1px solid #e2d7c8',
            cursor: chatDisabled ? 'not-allowed' : 'pointer',
            opacity: chatDisabled ? 0.6 : 1,
          }}
        >
          <Sparkles className="w-3 h-3" /> Lamplight Chat {chatOpen ? '●' : '○'}
        </button>
        {chatDisabled && (
          <a
            href="/profile"
            className="text-[10px]"
            style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--silica)', textDecoration: 'underline' }}
          >
            Enable Lamplight in Settings to chat
          </a>
        )}
      </div>
```

Note: a plain `<a href="/profile">` is used (not react-router `Link`) so the component needs no Router context in tests; a full navigation to the settings page is acceptable for this hint.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/notepad/bible/BibleStudyPane.test.tsx`
Expected: all 8 cases PASS (5 existing + 3 new).

- [ ] **Step 5: Typecheck the touched file compiles**

Run: `npx tsc --noEmit`
Expected: no NEW errors in `BibleStudyPane.tsx`. (Per the repo's known baseline, only the pre-existing `force-sphere.test.ts` tsc errors may appear — ignore those.)

- [ ] **Step 6: Commit**

```bash
git add src/notepad/bible/BibleStudyPane.tsx src/notepad/bible/BibleStudyPane.test.tsx
git commit -m "fix(lamplight): disable Bible-study chat when Lamplight toggled off

Gates the chat button + panel on settings.enabled for signed-in users,
with an 'Enable in Settings' hint. Removes the not_opted_in 403 path that
surfaced as 'Edge Function returned a non-2xx status code'.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Reliable no-notes acknowledgment in the opening insight

**Files:**
- Modify: `supabase/functions/lamplight-chat/prompts/bible-insight.ts`
- Test: `supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these two cases inside the `describe('runBibleChatPipeline', ...)` block in `supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts` (after the existing insight case). The `promptVersion` assertion is the red→green driver (it fails until Step 3 bumps the version); the empty-notes case is a structural guard that the insight path tolerates zero notes.

```ts
  it('uses the bumped insight prompt version', () => {
    expect(BIBLE_INSIGHT_PROMPT.promptVersion).toBe('bible-insight-2026-06-10-v3');
  });

  it('runs the insight path cleanly with an empty-notes context', async () => {
    const emptyNotesCtx: BibleChatContext = {
      ...baseCtx,
      notes: [],
      allowedNoteIds: new Set<string>(),
      userMessage: '',
    };
    // buildMessages must still emit the no-notes marker the model relies on.
    const msg = BIBLE_INSIGHT_PROMPT.buildMessages(emptyNotesCtx)[0].content;
    expect(msg).toContain('no related notes yet');

    const llm = fakeLLM({
      reply: 'You haven’t connected any notes here yet — still, the shepherd lays down his life freely.',
      citations: [{ type: 'verse', ref: 'jhn 10:11' }],
    });
    const out = await runBibleChatPipeline({ llm, ctx: emptyNotesCtx, prompt: BIBLE_INSIGHT_PROMPT });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.citations).toEqual([{ type: 'verse', ref: 'jhn 10:11' }]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts`
Expected: the `uses the bumped insight prompt version` case FAILS (current version is `bible-insight-2026-06-09-v2`). The empty-notes case should PASS (it is a structural guard). Existing cases still PASS.

- [ ] **Step 3: Tighten the prompt and bump the version**

In `supabase/functions/lamplight-chat/prompts/bible-insight.ts`:

Change the version line from:

```ts
  promptVersion: 'bible-insight-2026-06-09-v2',
```

to:

```ts
  promptVersion: 'bible-insight-2026-06-10-v3',
```

Replace the first bullet of the `system` string from:

```ts
- Lean on the user's supplied notes. If they have none related, offer one sharp, grounded observation about the passage itself and gently note that this gets more personal as they write more.
```

to:

```ts
- If the user supplied related notes, lean on them. If NO notes are supplied, OPEN with one short, warm sentence naming that they haven't connected any notes to this passage yet — then offer one sharp, grounded observation about the passage itself. Never invent notes, and never imply you can see notes that were not supplied.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts`
Expected: all cases PASS (existing 3 + 2 new).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/lamplight-chat/prompts/bible-insight.ts supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts
git commit -m "feat(lamplight): opening insight reliably acknowledges no-notes state

Tightens the bible-insight system prompt so a no-notes session opens by
naming the absence warmly, then still gives grounded passage insight.
Bumps promptVersion to bible-insight-2026-06-10-v3.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run both touched test files together**

Run: `npx vitest run src/notepad/bible/BibleStudyPane.test.tsx supabase/functions/lamplight-chat/bible-chat-pipeline.test.ts`
Expected: all cases PASS.

- [ ] **Step 2: Lint the touched files**

Run: `npx eslint src/notepad/bible/BibleStudyPane.tsx supabase/functions/lamplight-chat/prompts/bible-insight.ts`
Expected: ZERO new errors/warnings on these files. (Repo ships with a known lint baseline elsewhere; only these files matter here.)

- [ ] **Step 3: Manual smoke (optional, requires running app + Supabase)**

1. Sign in. On `/profile`, toggle Lamplight **off**. Open the notepad Bible-study pane → the "Lamplight Chat" button is greyed/disabled with the "Enable Lamplight in Settings to chat" hint. No 403 error fires.
2. Toggle Lamplight **on** (entitled account). The button is clickable; opening the chat on a passage with no related notes yields an insight that names the missing notes and still comments on the passage.

---

## Notes / out of scope

- Desktop **Lamplight tab** (daily devotion) and **mobile** today/connections surfaces use `LamplightTabPanel`'s own opt-in flow and are unchanged. Verified: no `LamplightChat` usage exists under `src/components/sections/notepad/mobile/`, so there is no separate ungated mobile chat entry.
- If the "non-2xx" error ever recurs while Lamplight is **on**, it is a different cause (missing `ANTHROPIC_API_KEY`/`VOYAGE_AI_KEY`, quota ceiling, or entitlement) and is outside this plan.
