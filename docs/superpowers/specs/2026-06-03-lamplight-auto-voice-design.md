# Lamplight Auto-Determined Voice & Tradition — Design

**Date:** 2026-06-03
**Status:** Approved (brainstorming) — pending implementation plan
**Feature:** Remove the manual "Voice preference" and "Tradition hint" pickers from Lamplight. The AI auto-determines the divine name (Lord / Father / Abba / Jesus) and the doctrinal framing per artifact, based on the note's content and tone.

---

## Goal

Today a user manually picks a "Voice preference" (how God is addressed: Lord / Father / Abba / Jesus) and a parallel "Tradition hint" (evangelical / catholic / orthodox / unspecified). These are stored on `lamplight_settings` and injected into every Lamplight prompt. We are removing both manual choices and letting the generation model choose the divine name + framing that fits each reflection, reverently, from the content it already reads.

## Decisions locked during brainstorming

1. **Scope:** Auto-determine BOTH voice and tradition. Remove both manual pickers. Lamplight settings collapses to the on/off toggle; onboarding becomes a single consent (no preference choices).
2. **Mechanism:** Inline in the generation prompt — no separate classifier call, no stored "chosen voice." The model already reads the user's notes + retrieved Scripture; it picks the address/framing per artifact. This naturally varies by content, which is the intent ("based on the circumstances and content").
3. **DB columns:** Drop `voice_preference` and `tradition_hint` from `lamplight_settings` via a migration. Deploy ordering is critical (Edge Function first, then migration).

## Non-goals

- No change to the Lamplight voice *principle* (never speak prophetically, never pronounce). This change only affects WHICH divine name is used and the framing — not the reverent, possibility-not-pronouncement stance. The `BANNED_PHRASES` / `CONTESTED_PASSAGES` / `GROWTH_BANNED_PHRASES` rules in `_shared/voice.ts` are untouched.
- No separate classification model / step (explicitly rejected).
- No backfill or data export of existing stored preferences (the values become meaningless).

---

## Section 1 — Behavior change (prompt redesign)

The model receives the user's notes + retrieved passages on every generation. We replace stored-value injection with inline guidance.

### `supabase/functions/_shared/voice.ts` — `LAMPLIGHT_SYSTEM_FRAGMENT`

- **Replace** the line:
  `- Mirror the user's voice for divine names — use "{{voice_preference}}".`
  **with:**
  `- Choose the divine name that best fits the spirit of what the user has written — e.g. "Lord," "Father," "Abba," or "Jesus" — and use it reverently. Let the writer's tone and content guide the choice; don't default mechanically.`
- **Add** (replacing the removed tradition_hint injection):
  `- Frame reflection within historic, creedal Christian orthodoxy. Don't assume a particular denominational tradition unless the user's own writing clearly reflects one.`
- **Remove** `voicePreference` from `ComposeSystemInput`.
- **Remove** the `voice_preference` entry from the `allTokens` map in `composeSystem` (the generic `tokens` map remains for any other substitutions). Any remaining `{{voice_preference}}` token left unsubstituted would otherwise leak literally — there must be none after this change.

### `supabase/functions/lamplight-generate/prompts/connection-why.ts`

- **Delete** the line (≈ line 15): `'- Mirror the user\'s voice preference for divine names: use "{{voice_preference}}".'` — the shared fragment now covers divine-name choice.

### `supabase/functions/lamplight-generate/prompts/daily-devotion.ts`

- **Change** (≈ lines 91-92) from:
  `` `Today is ${ctx.localDate}. User voice preference: "${ctx.voicePreference}". ` + `User tradition hint: "${ctx.traditionHint}".\n` ``
  **to:**
  `` `Today is ${ctx.localDate}.\n` ``

Net behavior: per-artifact, content-driven divine name + framing; zero stored preference; fully within the existing never-prophetic prohibitions.

---

## Section 2 — Removal surface (code)

### Edge Function — `supabase/functions/lamplight-generate/index.ts`
- `lamplight_settings` select: `'enabled, voice_preference, tradition_hint'` → `'enabled'` (retain any other columns actually needed elsewhere in the handler; only the two voice/tradition columns are removed).
- Remove the `voicePreference` / `traditionHint` derivation (the `?? 'Lord'` / `?? 'unspecified'` lines).
- Stop passing `voicePreference` / `traditionHint` into all three pipeline context builders.

### Pipelines
- `daily-devotion-pipeline.ts`, `connection-why-pipeline.ts`, `pipeline.ts` (smoke test): remove `voicePreference` / `traditionHint` from each pipeline's context type/interface and from any `composeSystem({ ..., voicePreference })` call (drop the `voicePreference` argument).

### Client types + adapter
- `src/notepad/storage/lamplight-adapter.ts`: delete `LamplightVoice` and `LamplightTradition` types; remove `voicePreference` and `traditionHint` from the `LamplightSettings` interface and the `upsertSettings` patch type.
- `src/notepad/storage/supabase-lamplight-adapter.ts`: remove the `voice_preference` / `tradition_hint` mapping in `#mapSettings` (read path) and the `payload.voice_preference` / `payload.tradition_hint` lines in `upsertSettings` (write path).
- Update any other implementations of the adapter interface (e.g. a fake/local adapter) to drop the two fields so the interface stays satisfied.

### Settings UI — `src/auth/components/LamplightSettingsSection.tsx`
- Delete the `VOICES` / `TRADITIONS` constants and the two `<select>` blocks (voice id `lamplight-voice`, tradition id `lamplight-tradition`) plus their local state / defaults.
- Keep the Lamplight on/off toggle and any other existing settings. The section remains (toggle + explanatory copy); it is not deleted wholesale.

### Onboarding — `src/notepad/components/lamplight/ConsentCard.tsx`
- Remove the voice/tradition selectors and their state.
- Change `onTurnOn` from `(choices: { voicePreference; traditionHint }) => void` to `() => void`.
- Update callers to invoke `onTurnOn()` and to enable Lamplight with no preference payload (the upsert patch no longer carries voice/tradition).

---

## Section 3 — Migration & deploy ordering

### Migration — new `supabase/migrations/0NN_lamplight_drop_voice_tradition.sql`
```sql
alter table lamplight_settings drop column if exists voice_preference;
alter table lamplight_settings drop column if exists tradition_hint;
```
(Use the next available migration number after the current latest.)

### Deploy ordering (critical)
1. Deploy the updated Edge Function (no longer `select`s `voice_preference` / `tradition_hint`).
2. THEN run the migration to drop the columns.

If the migration runs while the previous Edge Function version is still live, that function's `select` of the dropped columns will error. The plan must state this ordering explicitly.

---

## Section 4 — Tests

- `supabase/functions/_shared/voice.test.ts`: remove `{{voice_preference}}` substitution assertions. Assert the fragment now contains the auto-choose divine-name guidance and the orthodoxy-framing line, that `composeSystem` no longer accepts/requires `voicePreference`, and that the composed output contains no literal `{{voice_preference}}` token.
- `src/auth/components/LamplightSettingsSection.test.tsx`: remove the voice-persistence test (`voicePreference` to be 'Abba'); keep the enable/disable toggle behavior test.
- `src/notepad/hooks/useLamplightSettings.test.ts`: drop `voicePreference` from upsert calls/assertions.
- `src/notepad/storage/supabase-lamplight-adapter.test.ts`: remove `voice_preference` column mapping / upsert assertions.
- `src/notepad/storage/lamplight-rls.test.ts`: drop `voicePreference` from the `upsertSettings` calls.
- ConsentCard test (if present): update to the no-choices `onTurnOn()`.
- Pipeline tests referencing `voicePreference` in their context fixtures: drop the field.

---

## Verification

- `tsc -b` and `vite build` clean (no dangling references to the removed types/fields).
- `npm test` green except the known pre-existing unrelated `garden-scene.test.tsx` failure.
- Grep sweep: no remaining references to `voicePreference`, `voice_preference`, `traditionHint`, `tradition_hint`, `LamplightVoice`, `LamplightTradition`, or `{{voice_preference}}` outside the new migration.

## Deferred / future

- None. This is a self-contained removal + prompt change.
