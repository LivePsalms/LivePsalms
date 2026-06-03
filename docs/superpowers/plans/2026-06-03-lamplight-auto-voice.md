# Lamplight Auto-Determined Voice & Tradition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the manual "Voice preference" and "Tradition hint" pickers from Lamplight; the generation model chooses the divine name + doctrinal framing per artifact from the note content it already reads.

**Architecture:** Replace stored-value prompt injection with inline guidance in the shared Lamplight system fragment; strip `voicePreference`/`traditionHint` from the Edge Function, pipelines, client types, adapter, settings UI and onboarding; drop the two DB columns. Ordered so `tsc -b` stays green after every task (consumers updated before the shared types are deleted).

**Tech Stack:** React + Vite + TypeScript, Supabase (Postgres + Deno Edge Functions), Anthropic Claude, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-03-lamplight-auto-voice-design.md`

**Test commands:** `npm test` = `vitest run` (covers `src/**` + `supabase/functions/**`). Single file: `npx vitest run <path>`. Full build (stricter, project-mode tsc): `npm run build`.

**Task order (must be sequential — type coupling):** Task 1 (server) → Task 2 (client UI consumers) → Task 3 (client adapter + type removal) → Task 4 (migration). Each leaves the build green.

---

## File Structure

**Modify — server (Task 1):**
- `supabase/functions/_shared/voice.ts` — fragment text; drop `voicePreference` from `ComposeSystemInput` + the `voice_preference` token.
- `supabase/functions/_shared/voice.test.ts` — rewrite voice-token tests.
- `supabase/functions/lamplight-generate/prompts/daily-devotion.ts` — drop voice/tradition from the user message.
- `supabase/functions/lamplight-generate/prompts/connection-why.ts` — delete the voice line.
- `supabase/functions/lamplight-generate/prompts/smoke-test.ts` — drop voice/tradition from the user message.
- `supabase/functions/lamplight-generate/daily-devotion-pipeline.ts`, `connection-why-pipeline.ts`, `pipeline.ts` — drop `voicePreference`/`traditionHint` from contexts + `composeSystem` calls.
- `supabase/functions/lamplight-generate/index.ts` — settings select, derivation, and all context-builder threading.
- Pipeline tests: `daily-devotion-pipeline.test.ts`, `connection-why-pipeline.test.ts`, `pipeline.test.ts`.

**Modify — client UI consumers (Task 2):**
- `src/auth/components/LamplightSettingsSection.tsx` (+ `.test.tsx`)
- `src/notepad/components/lamplight/ConsentCard.tsx` (+ `.test.tsx`)
- `src/notepad/components/lamplight/LamplightTabPanel.tsx` (+ `.test.tsx`)
- `src/notepad/components/lamplight/TodaysLampCard.tsx` (+ `.test.tsx`)

**Modify — client adapter + types (Task 3):**
- `src/notepad/storage/supabase-lamplight-adapter.ts` (+ `.test.ts`)
- `src/notepad/storage/fake-lamplight-adapter.ts`
- `src/notepad/storage/lamplight-adapter.ts` (delete types + interface fields)
- `src/notepad/hooks/useLamplightSettings.test.ts`
- `src/notepad/storage/lamplight-rls.test.ts`

**Create — migration (Task 4):**
- `supabase/migrations/020_lamplight_drop_voice_tradition.sql`

---

## Task 1: Server — prompts, voice fragment, pipelines, Edge Function

This is one cohesive Edge-Function unit. After it, `npx vitest run supabase/functions` is green and the client is untouched.

**Files:** all server files listed above.

- [ ] **Step 1: Update the voice fragment + `composeSystem` in `supabase/functions/_shared/voice.ts`**

Replace the single fragment line:
```
- Mirror the user's voice for divine names — use "{{voice_preference}}".
```
with these two lines:
```
- Choose the divine name that best fits the spirit of what the user has written — e.g. "Lord," "Father," "Abba," or "Jesus" — and use it reverently. Let the writer's tone and content guide the choice; don't default mechanically.
- Frame reflection within historic, creedal Christian orthodoxy. Don't assume a particular denominational tradition unless the user's own writing clearly reflects one.
```

Then change `ComposeSystemInput` and `composeSystem`. Old:
```ts
export interface ComposeSystemInput {
  base: string;
  artifact: string;
  voicePreference: string;
  stricter?: string;
  tokens?: Record<string, string>;
}

export function composeSystem(input: ComposeSystemInput): string {
  const allTokens: Record<string, string> = {
    voice_preference: input.voicePreference,
    ...(input.tokens ?? {}),
  };
```
New:
```ts
export interface ComposeSystemInput {
  base: string;
  artifact: string;
  stricter?: string;
  tokens?: Record<string, string>;
}

export function composeSystem(input: ComposeSystemInput): string {
  const allTokens: Record<string, string> = {
    ...(input.tokens ?? {}),
  };
```
(The rest of `composeSystem` — substitute/parts/join — is unchanged.)

- [ ] **Step 2: Rewrite the affected tests in `supabase/functions/_shared/voice.test.ts`**

Replace the `it('contains the {{voice_preference}} substitution token', …)` test with:
```ts
  it('instructs the model to choose the divine name from the content', () => {
    expect(LAMPLIGHT_SYSTEM_FRAGMENT).toMatch(/choose the divine name that best fits/i);
    expect(LAMPLIGHT_SYSTEM_FRAGMENT).not.toContain('{{voice_preference}}');
  });

  it('frames reflection within historic Christian orthodoxy', () => {
    expect(LAMPLIGHT_SYSTEM_FRAGMENT).toMatch(/historic, creedal Christian orthodoxy/i);
  });
```

In the `describe('composeSystem', …)` block, remove `voicePreference` from every `composeSystem({...})` call and rewrite the two voice-token tests. Replace the first two `it(...)` (the `{{voice_preference}}` substitution + "replaces every occurrence") with a single test that proves no implicit voice token exists:
```ts
  it('does not define an implicit voice_preference token', () => {
    const out = composeSystem({
      base: 'Voice token: {{voice_preference}}.',
      artifact: '',
    });
    // No built-in substitution for voice_preference anymore — left as-is.
    expect(out).toContain('Voice token: {{voice_preference}}.');
  });
```
For the remaining `composeSystem` tests ("concatenates base + artifact + stricter", "omits the stricter section", "substitutes additional {{tokens}}", "leaves unknown {{tokens}} unsubstituted"): delete the `voicePreference: '…',` line from each call. For the "substitutes additional {{tokens}}" test, change `base` to not reference `{{voice_preference}}` — use `base: 'Today: {{local_date}}.'` and drop the `Voice: …` assertion; keep the `local_date` assertions. For "leaves unknown {{tokens}} unsubstituted", change `base` to `base: 'Today: {{local_date}}.'` and keep only the `Today: {{local_date}}` assertion.

- [ ] **Step 3: Run the voice tests — expect PASS**

Run: `npx vitest run supabase/functions/_shared/voice.test.ts`
Expected: PASS (the fragment-stance and banned-phrase tests still pass; the rewritten token tests pass). It is fine to write Steps 1+2 together since this is a refactor of existing behavior.

- [ ] **Step 4: Update the three prompt files**

`prompts/daily-devotion.ts` — change:
```ts
        `Today is ${ctx.localDate}. User voice preference: "${ctx.voicePreference}". ` +
        `User tradition hint: "${ctx.traditionHint}".\n` +
```
to:
```ts
        `Today is ${ctx.localDate}.\n` +
```

`prompts/connection-why.ts` — delete this array element line entirely:
```ts
    '- Mirror the user\'s voice preference for divine names: use "{{voice_preference}}".',
```

`prompts/smoke-test.ts` — change the user content (line ~60) from:
```ts
      content: `User recent notes:\n${notesBlock}\n\nRetrieved passages:\n${passagesBlock}\n\nUser settings: voice="${ctx.voicePreference}", tradition_hint="${ctx.traditionHint}".\n\nReflect briefly. Cite passages using these exact refs: ${[...ctx.allowedVerseRefs].join(', ')}.`,
```
to:
```ts
      content: `User recent notes:\n${notesBlock}\n\nRetrieved passages:\n${passagesBlock}\n\nReflect briefly. Cite passages using these exact refs: ${[...ctx.allowedVerseRefs].join(', ')}.`,
```

- [ ] **Step 5: Update the three pipelines (contexts + composeSystem calls)**

`daily-devotion-pipeline.ts`:
- In `DailyDevotionContext`, delete the two lines `voicePreference: string;` and `traditionHint: string;`.
- In the `composeSystem({...})` call, delete the line `voicePreference: ctx.voicePreference,`.

`connection-why-pipeline.ts`:
- In `ConnectionWhyContext`, delete `voicePreference: string;`.
- In the `composeSystem({...})` call, delete `voicePreference: ctx.voicePreference,`.

`pipeline.ts` (smoke test):
- In `SmokeTestContext`, delete `voicePreference: string;` and `traditionHint: string;`.
- In the `composeSystem({...})` call, delete `voicePreference: ctx.voicePreference,`.

- [ ] **Step 6: Update the Edge Function `index.ts`**

- Settings select (line ~84): change `.select('enabled, voice_preference, tradition_hint')` → `.select('enabled')`.
- Delete the derivation lines (~93-94):
  ```ts
  const voicePreference = (settings.voice_preference as string) ?? 'Lord';
  const traditionHint = (settings.tradition_hint as string) ?? 'unspecified';
  ```
- `buildSmokeTestContext` call (~98): change `{ userId: body.user_id, voicePreference, traditionHint, voyageDeps, rerankEnabled }` → `{ userId: body.user_id, voyageDeps, rerankEnabled }`.
- `buildDailyDevotionContext` call (~111): change `{ userId, localDate, voicePreference, traditionHint, voyageDeps, rerankEnabled }` → `{ userId, localDate, voyageDeps, rerankEnabled }`.
- `buildConnectionWhyContext` call (~142-147): delete the `voicePreference,` line from the args object.
- `buildSmokeTestContext` signature (~208): remove `voicePreference: string; traditionHint: string;` from the args type; in its returned object delete `voicePreference: args.voicePreference,` and `traditionHint: args.traditionHint,`.
- `buildDailyDevotionContext` signature (~270): remove `voicePreference: string; traditionHint: string;` from the args type; in its returned object delete `voicePreference: args.voicePreference,` and `traditionHint: args.traditionHint,`.
- `buildConnectionWhyContext` signature (~381): remove `voicePreference: string;` from the args type; in its returned `context` object delete `voicePreference: args.voicePreference,`.

- [ ] **Step 7: Update pipeline test fixtures**

- `pipeline.test.ts` (~12-13): delete `voicePreference: 'Lord',` and `traditionHint: 'unspecified',` from the `makeCtx`/context fixture.
- `daily-devotion-pipeline.test.ts` (~15-16): delete `voicePreference: 'Lord',` and `traditionHint: 'unspecified',`.
- `connection-why-pipeline.test.ts` (~14): delete `voicePreference: 'Lord',`. Line ~215 (`makeCtx({ voicePreference: 'Father' })`) — change to `makeCtx({})` (or drop the override entirely). Line ~220 (`expect(sys).not.toContain('{{voice_preference}}')`) — KEEP it (still a valid guarantee).

- [ ] **Step 8: Verify server**

Run: `npx vitest run supabase/functions`
Expected: PASS. Then grep to confirm the server side is clean:
`grep -rn "voicePreference\|voice_preference\|traditionHint\|tradition_hint" supabase/functions` → only allowed hits: none (the migration is added later). Expected: no matches.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions
git commit -m "feat(lamplight): auto-determine voice/tradition in prompts; drop from edge fn"
```

---

## Task 2: Client — UI consumers (settings, consent, tab panel, today's lamp)

Updates every component that references the fields, while the shared types still exist (so `tsc` stays green). After this, only the type definitions + adapter mapping still mention the fields (removed in Task 3).

**Files:** `LamplightSettingsSection.tsx` (+test), `ConsentCard.tsx` (+test), `LamplightTabPanel.tsx` (+test), `TodaysLampCard.tsx` (+test).

- [ ] **Step 1: `LamplightSettingsSection.tsx` — remove both pickers**

- Remove `LamplightVoice` and `LamplightTradition` from the `import type { … }` block (keep `LamplightAdapter`, `LamplightEntitlement`, `PromoConfig`).
- Delete the constants:
  ```ts
  const VOICES: LamplightVoice[] = ['Lord', 'Father', 'Abba', 'Jesus'];
  const TRADITIONS: LamplightTradition[] = ['evangelical', 'catholic', 'orthodox', 'unspecified'];
  ```
- Delete the two derived lines:
  ```ts
  const voice = settings?.voicePreference ?? 'Lord';
  const tradition = settings?.traditionHint ?? 'unspecified';
  ```
- Delete both `<label>`+`<select>` blocks: the `id="lamplight-voice"` block (label "Voice preference" through its closing `</select>`) and the `id="lamplight-tradition"` block (label "Tradition hint" through its closing `</select>`). Leave everything else (the "Lamplight on" checkbox, the `EntitlementBlock`, the `AlertDialog` turn-off flow) intact.

- [ ] **Step 2: `LamplightSettingsSection.test.tsx` — drop the voice-persistence assertion**

Remove the test/assertion at ~line 38 (`expect(adapter.settings.get('user-1')?.voicePreference).toBe('Abba');`) and any select-change interaction that drove it. Keep the enable/disable toggle tests. If a whole `it(...)` block existed only to test voice persistence, delete that block.

- [ ] **Step 3: `ConsentCard.tsx` — remove voice/tradition selection**

- Remove the `import type { LamplightVoice, LamplightTradition } …` line.
- Change the props:
  ```ts
  export interface ConsentCardProps {
    onTurnOn: () => void;
    onMaybeLater: () => void;
  }
  ```
- Delete the `VOICES`/`TRADITIONS` constants and the `useState` for `voice`/`tradition`. Keep the `revealed` state OR simplify: change the "Turn on Lamplight" button to call `onTurnOn()` directly and delete the entire `{revealed && (…)}` block (the tradition + voice fieldsets + Continue button) and the `setRevealed`/`revealed` state. Result: "Turn on Lamplight" → `onClick={onTurnOn}`; "Maybe later" → `onClick={onMaybeLater}` (unchanged).

- [ ] **Step 4: `ConsentCard.test.tsx` — assert no-arg `onTurnOn`**

Change the two assertions (~41, ~49) from `expect(onTurnOn).toHaveBeenCalledWith({ voicePreference: …, traditionHint: … })` to `expect(onTurnOn).toHaveBeenCalled();` (or `toHaveBeenCalledTimes(1)`). Remove any test steps that selected a voice/tradition radio before clicking; the test now just clicks "Turn on Lamplight".

- [ ] **Step 5: `LamplightTabPanel.tsx` — simplify the consent + card wiring**

- The `ConsentCard` usage (~46-52): change
  ```tsx
  onTurnOn={({ voicePreference, traditionHint }) =>
    settingsState.upsert({
      enabled: true,
      voicePreference,
      traditionHint,
      consentDecidedAt: new Date().toISOString(),
    })
  }
  ```
  to
  ```tsx
  onTurnOn={() =>
    settingsState.upsert({
      enabled: true,
      consentDecidedAt: new Date().toISOString(),
    })
  }
  ```
- The `TodaysLampCard` usage (~79-80): delete the props `voicePreference={settingsState.settings.voicePreference}` and `traditionHint={settingsState.settings.traditionHint}`.

- [ ] **Step 6: `LamplightTabPanel.test.tsx` — drop voice/tradition expectations**

At ~67-68 the test asserts an upsert payload containing `voicePreference: 'Father', traditionHint: 'evangelical'`. Update the expected upsert payload to `{ enabled: true, consentDecidedAt: expect.any(String) }` (match however the test currently asserts — remove the two fields). If the test simulated picking a voice/tradition in ConsentCard, remove those interactions.

- [ ] **Step 7: `TodaysLampCard.tsx` — remove the props + the "Voice/Tradition" footer**

- Remove `LamplightVoice, LamplightTradition` from the `import type { … }` line (keep `LamplightAdapter`).
- In `TodaysLampCardProps`: delete `voicePreference: LamplightVoice;` and `traditionHint: LamplightTradition;`.
- In the `TodaysLampCard({ … })` destructure: remove `voicePreference, traditionHint,`.
- The `<Devotion>` render: remove `voicePreference={voicePreference}` and `traditionHint={traditionHint}`.
- In `function Devotion(props: {…})`: delete `voicePreference: LamplightVoice;` and `traditionHint: LamplightTradition;` from the props type, and remove them from the `const { … } = props;` destructure.
- Delete the entire footer block that renders the preferences:
  ```tsx
  <div className="flex items-center gap-3 text-[11px]" style={{ … opacity: 0.7 }}>
    <span>Voice: {voicePreference}</span>
    <span aria-hidden>·</span>
    <span>Tradition: {traditionHint}</span>
    <span aria-hidden>·</span>
    <Link to="/profile" className="underline" …>Edit preferences →</Link>
  </div>
  ```
  (If `Link` from `react-router-dom` becomes unused after this, remove its import.)

- [ ] **Step 8: `TodaysLampCard.test.tsx` — drop the two props**

Remove `voicePreference="Lord"` and `traditionHint="unspecified"` (~22-23) from the render. Remove any assertion checking the "Voice:"/"Tradition:" footer text.

- [ ] **Step 9: Verify client consumers**

Run: `npx tsc --noEmit` — expect no NEW errors. (The shared types still exist, so the adapter/interface still compile.)
Run: `npx vitest run src/auth/components/LamplightSettingsSection.test.tsx src/notepad/components/lamplight/ConsentCard.test.tsx src/notepad/components/lamplight/LamplightTabPanel.test.tsx src/notepad/components/lamplight/TodaysLampCard.test.tsx`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/auth/components/LamplightSettingsSection.tsx src/auth/components/LamplightSettingsSection.test.tsx src/notepad/components/lamplight/ConsentCard.tsx src/notepad/components/lamplight/ConsentCard.test.tsx src/notepad/components/lamplight/LamplightTabPanel.tsx src/notepad/components/lamplight/LamplightTabPanel.test.tsx src/notepad/components/lamplight/TodaysLampCard.tsx src/notepad/components/lamplight/TodaysLampCard.test.tsx
git commit -m "feat(lamplight): remove voice/tradition pickers + display from UI"
```

---

## Task 3: Client — adapter mapping, fake adapter, and type removal

Now nothing references the fields except the adapter mapping and the type definitions. Remove the mappings first, then the types/interface fields, in one task so `tsc` ends green.

**Files:** `supabase-lamplight-adapter.ts` (+test), `fake-lamplight-adapter.ts`, `lamplight-adapter.ts`, `useLamplightSettings.test.ts`, `lamplight-rls.test.ts`.

- [ ] **Step 1: `supabase-lamplight-adapter.ts` — remove the read/write mapping**

- In `upsertSettings`, delete the two lines:
  ```ts
  if (patch.voicePreference !== undefined) payload.voice_preference = patch.voicePreference;
  if (patch.traditionHint !== undefined) payload.tradition_hint = patch.traditionHint;
  ```
- In `#mapSettings`, delete the two lines:
  ```ts
  voicePreference: row.voice_preference as LamplightVoice,
  traditionHint: row.tradition_hint as LamplightTradition,
  ```
- Remove `LamplightVoice, LamplightTradition` from the `import type { … }` block (keep `LamplightSettings`, `LamplightAdapter`, etc.).

- [ ] **Step 2: `fake-lamplight-adapter.ts` — drop the defaults**

In the `merged: LamplightSettings = { … }` object (~55-56), delete `voicePreference: 'Lord',` and `traditionHint: 'unspecified',`. (If the file imports `LamplightVoice`/`LamplightTradition`, remove those.)

- [ ] **Step 3: `lamplight-adapter.ts` — delete the types + interface fields**

- Delete the type declarations:
  ```ts
  export type LamplightVoice = 'Lord' | 'Father' | 'Abba' | 'Jesus';
  export type LamplightTradition =
    'evangelical' | 'catholic' | 'orthodox' | 'unspecified';
  ```
  (Match the exact current formatting of the `LamplightTradition` union.)
- In the `LamplightSettings` interface, delete:
  ```ts
  voicePreference: LamplightVoice;
  traditionHint: LamplightTradition;
  ```

- [ ] **Step 4: Update remaining tests**

- `supabase-lamplight-adapter.test.ts`: in the row-shape type (`voice_preference: string;` ~9, `tradition_hint: string;` ~10) delete both. In the mock row fixtures (~85-86, ~143-144, ~183) delete `voice_preference: …` and `tradition_hint: …`. In the upsert-call inputs (~156-157, ~169) delete `voicePreference`/`traditionHint`. Delete the assertions at ~174-175 (`expect(s.voicePreference)…`, `expect(s.traditionHint)…`).
- `useLamplightSettings.test.ts`: in the upsert calls (~23, ~34) remove `voicePreference: 'Father'` / `voicePreference: 'Abba'` (keep `enabled: true`). Delete the assertions at ~27, ~37 (`expect(...settings?.voicePreference)…`).
- `lamplight-rls.test.ts` (~37): change `upsertSettings(userA.userId, { enabled: true, voicePreference: 'Father' })` → `upsertSettings(userA.userId, { enabled: true })`.

- [ ] **Step 5: Verify the whole client**

Run: `npx tsc --noEmit` — expect zero errors.
Run: `npm run build` — expect a clean `tsc -b` + `vite build` (this catches the stricter project-mode type checking).
Run: `npm test` — expect only the known pre-existing `garden-scene.test.tsx` failure; no new failures.

- [ ] **Step 6: Commit**

```bash
git add src/notepad/storage/supabase-lamplight-adapter.ts src/notepad/storage/supabase-lamplight-adapter.test.ts src/notepad/storage/fake-lamplight-adapter.ts src/notepad/storage/lamplight-adapter.ts src/notepad/hooks/useLamplightSettings.test.ts src/notepad/storage/lamplight-rls.test.ts
git commit -m "feat(lamplight): drop voicePreference/traditionHint from types + adapter"
```

---

## Task 4: Migration — drop the columns

**Files:** Create `supabase/migrations/020_lamplight_drop_voice_tradition.sql`.

- [ ] **Step 1: Write the migration**

```sql
-- 020_lamplight_drop_voice_tradition.sql
-- Voice + tradition are now auto-determined by the model from note content;
-- these manual-preference columns are no longer read or written.
alter table lamplight_settings drop column if exists voice_preference;
alter table lamplight_settings drop column if exists tradition_hint;
```

- [ ] **Step 2: Static check (do NOT apply — deploy ordering matters; see below)**

Verify the filename is the next number (latest existing is `019_note_transcriptions.sql`) and the SQL is well-formed. Do not run it locally as part of code review; it is applied at deploy time after the Edge Function ships (see Deploy Ordering).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/020_lamplight_drop_voice_tradition.sql
git commit -m "feat(lamplight): drop voice_preference/tradition_hint columns"
```

---

## Deploy Ordering (CRITICAL — call out to the operator)

1. Deploy the updated `lamplight-generate` Edge Function FIRST (it no longer `select`s `voice_preference`/`tradition_hint`).
2. THEN apply migration `020`.

If `020` runs while the previous Edge Function version is still live, that version's `select('enabled, voice_preference, tradition_hint')` will error. (`drop column if exists` is itself safe/idempotent; the ordering is purely about the still-running old function.)

---

## Final Verification

- [ ] Grep sweep — zero matches outside the migration:
  ```bash
  grep -rn "voicePreference\|voice_preference\|traditionHint\|tradition_hint\|LamplightVoice\|LamplightTradition\|{{voice_preference}}" src supabase | grep -v "020_lamplight_drop_voice_tradition.sql"
  ```
  Expected: no output.
- [ ] `npm run build` clean (tsc -b + vite build).
- [ ] `npm test` — only the pre-existing unrelated `garden-scene.test.tsx` failure remains.
- [ ] Spot-confirm the Lamplight settings card now shows only the on/off toggle, and onboarding ConsentCard turns on with a single click (no pickers).
