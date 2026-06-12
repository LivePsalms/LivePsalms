# Notepad Onboarding — Design

**Date:** 2026-06-11
**Status:** Approved (brainstorm with visual companion)

## Purpose

Two onboarding experiences for the notepad:

1. **Anonymous first visit** to `/notepad/notes` — a spotlight tour plus a persistent "Get started" checklist, ending in a sign-up nudge.
2. **Post-signup** — a guided first-study note plus a week-paced "Your journey" checklist, building on the existing `/welcome` flow (which stays unchanged).

## User flows

### Anonymous lane

1. First load detected: signed out, no `onboarding_anon_tour_done` key in localStorage.
2. **Spotlight tour auto-starts.** Five stops, skippable at every step:
   1. Create a note (sidebar new-note button)
   2. Verse linking / Bible panel
   3. Highlights & decorations
   4. Backlinks & connections graph
   5. Lamplight (AI)
   - Final card: sign-up nudge.
3. **"Get started" checklist** remains: a floating panel (collapsible to a pill, dismissible) with four items that complete by observing real actions:
   - Write your first note
   - Link a verse
   - Highlight something
   - Create an account
4. Checklist progress persists across visits in localStorage.

### Sign-up merge (carry progress)

On the first signed-in notepad load, anonymous progress merges into the account:

- Note / verse-link / highlight completions pre-credit the journey checklist.
- A completed anonymous "first note" auto-skips the guided first-study note.
- Local keys are cleared; a `merged` flag makes the merge idempotent.

### Signed-up lane

1. Existing `/welcome` flow (profile → import) — **unchanged**.
2. **Guided first-study note**: a templated TipTap note opens with inline do-it prompts (link a verse, highlight it, ask Lamplight). Offered, skippable, auto-skipped if already done anonymously.
3. **"Your journey" checklist** — seven items:
   1. Complete your first study note (often pre-credited)
   2. Create a folder
   3. Scan a handwritten note
   4. Explore Lamplight connections
   5. Visit your connections graph
   6. Study 3 days in a row
   7. Search your notes
4. Each completion gets a small celebration; finishing the checklist gets a LevelUpModal-style finale. The checklist retires itself when complete (or when dismissed).

### Rewards decision

Tiers are driven by note count (`getTierForCount(highestNoteCount)`), not points. Journey items therefore do **not** award tier points — notes created along the way advance tiers naturally. A real points system is out of scope (possible later project).

### Rollout gating

- Journey checklist + guided note: only for **accounts created after this feature launches**. Existing users see nothing new.
- Anonymous tour: only on first-ever notepad visit (localStorage-gated), which handles existing anonymous visitors naturally.

## Architecture

New module: `src/notepad/onboarding/`. Pure, tested decision logic separated from UI, mirroring the `notepad-first-load.ts` pattern.

```
src/notepad/onboarding/
  onboarding-state.ts        Pure decision functions: (auth state, storage flags,
                             progress) -> actions: start-tour | show-get-started |
                             offer-guided-note | show-journey. No React.
  onboarding-storage.ts      Persistence boundary (localStorage + Supabase).
  merge-anon-progress.ts     One-time idempotent sign-up merge.
  OnboardingProvider.tsx     Context: progress state + reportOnboardingEvent().
  tour/
    SpotlightTour.tsx        Dimmed overlay with rect cutout + tooltip card.
                             animejs transitions.
    tour-steps.ts            The 5 stop definitions (anchor, copy, placement).
  checklist/
    ChecklistPanel.tsx       Floating panel <-> collapsed pill. Renders either
                             item set.
    get-started-items.ts     Anonymous items (4).
    journey-items.ts         Account items (7).
  guided-note/
    guided-note-template.ts  TipTap JSON template with "try it" prompts in
                             the content.
```

Integration points (no structural changes to existing components):

- **Tour anchors:** `data-tour="..."` attributes added to the sidebar new-note button, editor, highlight toolbar, graph entry, and Lamplight panel.
- **Event observers:** natural completion points call `reportOnboardingEvent(event)` — NoteCollection create (`note-created`), verse-link extension (`verse-linked`), highlight pill (`highlight-created`), scan accept (`scan-completed`), folder create (`folder-created`), graph route visit (`graph-visited`), Lamplight connection (`lamplight-connection`), search dialog open (`search-used`).
- **First-load:** a `useOnboarding` hook (sibling to `useNotepadFirstLoad`) consults `onboarding-state.ts` on notepad mount.
- **Tour engine:** fully custom — no new dependencies. Positioning from `getBoundingClientRect` with throttled `resize`/`scroll` recompute.

## Data flow & persistence

- **Anonymous:** namespaced localStorage keys (`onboarding_anon_tour_done`, `onboarding_anon_checklist`), same pattern as `welcomed_once_<userId>`.
- **Account:** `onboarding_progress` JSONB keyed by user via the existing Supabase adapter — guided-note status (`done`/`skipped`), per-item completion timestamps, dismissed flag, study-date array, merged flag.
- **Writes are optimistic:** panel updates immediately, Supabase write follows. On write failure, progress stays in memory + localStorage cache and retries on next load.
- **Streak:** computed from distinct study dates appended per session with any note edit; three consecutive days completes the item.
- **Supabase null/unreachable:** onboarding degrades silently. It never blocks or breaks the notepad — every entry point is wrapped.

## Edge cases & error handling

- **Missing tour anchor** (collapsed panel, mobile): step skipped silently, tour continues.
- **Resize/scroll mid-tour:** positions recompute (throttled); small screens use a bottom-sheet tooltip placement.
- **Reduced motion:** `prefers-reduced-motion` disables animejs transitions.
- **Tour interrupted** (refresh): treated as skipped; the checklist panel contains a "Replay tour" link so the tour is never permanently lost.
- **Multiple tabs:** last-write-wins; acceptable for this data.

## Testing

Vitest + RTL, matching repo conventions:

- **Unit:** `onboarding-state.ts` decision table (every auth/storage combination → expected actions); merge idempotency; streak calculation; storage serialization round-trips.
- **Component:** `SpotlightTour` step navigation, skip, missing-anchor skip; `ChecklistPanel` both item sets, completion ticks, collapse, dismiss.
- **Integration:** observers fire — e.g. creating a note via NoteCollection marks the checklist item.
- Deletion-test discipline applies: each new module earns its keep.

## Out of scope

- A points-based gamification system (tiers stay note-count-driven).
- Changes to the `/welcome` wizard.
- Onboarding for existing accounts (gated to new signups).
- Import-your-old-notes as a journey item (already covered by `/welcome`).
