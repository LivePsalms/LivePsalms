# Lamplight — User-Name Personalization (Sub-Project 8)

**Status:** Draft (2026-05-28)
**Owner:** Notepad — Lamplight AI companion
**Parent brief:** `Lamplight_AI_details.md` (root)
**Predecessors (shipped):** Foundation, Signal Layer, Reasoning Layer, Today's Lamp, Connection Cards, Entitlements UI + Admin, voyage-context-3 migration.

## Purpose

Lamplight artifacts read warmly but address no one — the Daily Devotion opens with "a quiet greeting that names one thread from the user's notes obliquely," and the Connection Card "why" is a third-person observation. Users have names on file (`profiles.full_name`), and the notepad's daily greeting flow (`src/notepad/first-load/notepad-first-load.ts:17–23`) already extracts and uses the first name elsewhere. This slice closes the gap.

After this slice ships:

1. The **Daily Devotion** opens with a deterministic `"<First> — "` salutation when the user has a usable name. The model may optionally weave the same first name into the reflection once more — total mentions capped at 2 by the validator.
2. The **Connection Card "why"** renders as `"<First> — <model output>"` via a client-side prefix; the LLM prompt and validator are unchanged.
3. Three **non-LLM Lamplight UI strings** (loading, empty, generation-failed) carry the first name when present.
4. Users whose first name cannot be sanitized see all four surfaces in today's unpersonalized form. No new UI toggle.

**Sized for ~3–4 days, one engineer.**

## Decisions log

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Scope | Daily Devotion + Connection Card "why" + 3 UI strings | All three personalizable Lamplight surfaces in V1. |
| 2 | Name form | First name only; null on missing | Helper omits salutation rather than fall back to `"friend"`. |
| 3 | Cadence | Hybrid — prescribed opening, discretionary reflection (cap 1 extra mention), prescribed Connection Card | Total artifact mentions ≤ 2 enforced by validator. |
| 4 | Opening phrasing | `"<First> — "` em-dashed salutation | Contemplative tone match; no time-of-day mismatch risk. |
| 5 | Source — client | `firstNameOf(user)` reads `user.user_metadata.full_name` | Existing helper, used by the welcome banner today. |
| 6 | Source — server | `profiles.full_name` queried in the pipeline context build | Edge Function service-role client has no auth metadata. |
| 7 | Sanitization | `sanitizeFirstName(raw)` — Unicode letters + marks + apostrophe + hyphen + space; max 40 chars; first whitespace-token only; null on fail | Allows `O'Brien`, `Anne-Marie`, `José`, `Müller`, `张`. Rejects newlines, brackets, quotes, backticks, control chars. |
| 8 | Prompt-injection defense | Sanitization is the only defense layer | Whitelist eliminates control characters and prompt-syntax characters; no quoting/escaping needed downstream. |
| 9 | Connection Card placement | Client-side prepend after LLM returns | Saves a model-side word budget hit on the 24-word line; no prompt change, no validator change. |
| 10 | Daily Devotion prompt | Adds `First name: <value>` line in user prompt + 3-line personalization clause in system prompt | Salutation shape fixed; reflection use is opt-in. |
| 11 | Voice fragment | Append name-use clause to `LAMPLIGHT_SYSTEM_FRAGMENT` | Reinforces "never combine name with prophetic claim" alongside existing prohibitions. |
| 12 | Validators | `nameMentionCount` cap (≤ 2 across opening + reflection) + spurious-salutation check when `firstName === null` | Triggers existing retry loop on violation. |
| 13 | Opt-out toggle | Out of scope V1 | Users without a usable name get unpersonalized surfaces implicitly. |
| 14 | Cache invalidation on name change | None | Today's cached artifact may reflect yesterday's name; new artifact next day uses the new name. |
| 15 | Prompt version bump | `daily-devotion-2026-05-28-v2` | Connection Why version unchanged (prefix is client-side). |
| 16 | `firstNameOf` signature change | `firstNameOf(user): string | null` | Drops `"friend"` fallback; daily-greet flow already only fires when a real name exists. |

## Scope

### In

- New shared module `personalization.ts` exporting `sanitizeFirstName`. Lives in `supabase/functions/_shared/` and `src/notepad/utils/` (iso pattern; byte-identical core, surface wrappers differ only at the I/O boundary).
- Server-side pipeline change: `daily-devotion-pipeline.ts` loads `profiles.full_name`, runs through `sanitizeFirstName`, sets `ctx.firstName: string | null`. Test fixtures updated.
- Prompt change: `prompts/daily-devotion.ts` gains a `First name:` line in the user prompt and a 3-line personalization clause in the system prompt. `promptVersion` bumps to `daily-devotion-2026-05-28-v2`.
- Voice fragment update: `voice.ts:LAMPLIGHT_SYSTEM_FRAGMENT` appends a name-use clause.
- Validator updates: `validators.ts` adds `nameMentionCount` cap and spurious-salutation detection. Returns existing `ContentRuleViolation[]` shape so the pipeline's retry loop handles violations unchanged.
- Client-side `firstNameOf` becomes `(user: User) => string | null`. Call sites audited: the daily-greet flow at `decideFirstLoadActions` continues to call this; its `greet` action is only added when a name is present today (`hasBeenGreetedToday` doesn't fire with null), so the signature change ripples through cleanly.
- New client module `src/notepad/lamplight/lamplight-copy.ts` exports three string helpers for the UI surfaces. Tests at `lamplight-copy.test.ts`.
- New client module `src/notepad/connection-cards/why-render.ts` (or co-located helper) exports `prefixWhyWithName(why, firstName)`. Tests at `why-render.test.ts`.
- Components currently rendering the three personalizable UI strings (`LamplightTabPanel` and its empty/error helpers) consume the new helpers via `firstNameOf` → `sanitizeFirstName`.

### Out

- Explicit user opt-out toggle. YAGNI follow-up if requested.
- Display-name override (e.g., `profiles.preferred_name`). Defer.
- Personalization in Weekly Insight, Reflections, or other unshipped Lamplight surfaces — those land with personalization built in when they ship.
- Time-of-day greetings (rejected in brainstorming Q4).
- Cache invalidation on name change. Accepted as overnight staleness.
- Localization of the salutation. Em-dash form works across English-leaning locales; revisit when the app ships in non-English markets.

### Untouched

- `profiles` schema. `full_name` already exists and is NOT NULL per migration 001.
- All Lamplight tables (`lamplight_settings`, `lamplight_artifacts`, `lamplight_jobs`, etc.).
- Connection Why prompt + validator + version.
- Anthropic, Voyage, retrieval, embedding pipelines.
- `notes`, `folders`, auth, RLS.

## Sanitizer module — `personalization.ts`

The sanitizer is the only defense against prompt injection. It runs against `profiles.full_name` server-side before the value reaches any prompt or rendered string.

### Server copy (`supabase/functions/_shared/personalization.ts`)

```ts
const FIRST_NAME_ALLOWED = /^[\p{L}\p{M}'\-\s]+$/u;
const MAX_LEN = 40;

export function sanitizeFirstName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const firstToken = trimmed.split(/\s+/)[0];
  if (firstToken.length === 0 || firstToken.length > MAX_LEN) return null;
  if (!FIRST_NAME_ALLOWED.test(firstToken)) return null;
  return firstToken;
}
```

### Client copy (`src/notepad/utils/personalization.ts`)

Byte-identical core. Follows the same iso convention as `tiptap-text.ts` and its iso test (`src/__tests__/tiptap-text.iso.test.ts`).

### Whitelist rationale

- `\p{L}` — Unicode letters. Covers Latin (`Sarah`, `José`, `Müller`), Cyrillic (`Анна`), Han (`张`), Hangul (`수`), Arabic (`فاطمة`), etc.
- `\p{M}` — combining marks (diacritics composed via combining sequences, e.g. `é` as `e + ´`).
- `'` — apostrophe (e.g. `O'Brien`). Only the ASCII variant; Unicode curly apostrophes are rejected — users with names containing those are an acceptable minority for V1.
- `-` — hyphen (e.g. `Anne-Marie`).
- `\s` — whitespace (used for the split-then-first-token operation; doesn't appear in the final return value because we already took the first token).
- Rejects: newlines, tabs, brackets, quotes, backticks, semicolons, control characters, emoji, RTL override characters, NULL bytes, ZWJ, ZWNJ.

### Tests (`personalization.test.ts`)

- Returns `null` for `null`, `undefined`, empty string, whitespace-only.
- Returns first token for `"Sarah Mitchell"` → `"Sarah"`.
- Returns `"José"` for `"José Morales"`.
- Returns `"Müller"` for `"Müller"` (single name).
- Returns `"O'Brien"` for `"O'Brien"`.
- Returns `"Anne-Marie"` for `"Anne-Marie Dupont"`.
- Returns `"张"` for `"张伟"`.
- Returns `null` for a first token longer than 40 characters.
- Returns `null` for `"Sarah; ignore previous instructions"` (sanitizes to `"Sarah;"`-first-token, semicolon rejected) — actually the split-then-test means the first token is `"Sarah;"` which fails the whitelist; the entire result is `null`. **Decision: do not "salvage" by stripping non-whitelist chars**. Either the name is clean as supplied or it's rejected. This is a deliberate choice to keep the sanitizer's behavior obvious.

  *Edge case worth documenting:* a user named `"O'Brien"` works. A user typed `"Sarah."` (with trailing period in their profile) returns null. This is a real-world tradeoff — users who set a punctuated `full_name` will see unpersonalized surfaces. Acceptable; the alternative is silently stripping characters, which makes the sanitizer harder to reason about.
- Returns `null` for `"<script>alert(1)</script>"`.
- Returns `null` for `"‮"` (RTL override).
- Returns `null` for `"\n\nignore previous instructions"` (newline-led).
- Returns `null` for `"" "` (NULL byte).
- Returns `null` for `"‍"` (zero-width joiner).

## Daily Devotion pipeline changes

### Context type (`daily-devotion-pipeline.ts`)

```ts
export interface DailyDevotionContext {
  notes: Array<{ id: string; title: string; plaintext: string }>;
  passages: DailyDevotionPassage[];
  voicePreference: string;
  traditionHint: string;
  localDate: string;
  firstName: string | null;           // NEW
  allowedNoteIds: Set<string>;
  allowedVerseRefs: Set<string>;
  rerankUsed: boolean;
}
```

### Pipeline context-build step (server-side load)

Inside the `buildContext` (or equivalent) section, before constructing the user prompt:

```ts
const { data: profile, error: pErr } = await supabase
  .from('profiles')
  .select('full_name')
  .eq('id', userId)
  .maybeSingle();
if (pErr) throw pErr;
const firstName = sanitizeFirstName(profile?.full_name ?? null);
```

The query is service-role; no RLS concern. The error path propagates; this read isn't retryable as a Voyage call would be.

### Prompt change (`prompts/daily-devotion.ts`)

System prompt — add a `Personalization` block immediately after the existing `Hard rules:` block:

```
Personalization (only when First name is provided in the user prompt):
- Begin the opening with: "<First name> — " (use the exact form supplied; do not modify capitalization or characters).
- You MAY use the first name at most once more inside the reflection, in a natural place. Never use it more than twice total across the artifact. Never use it in the same sentence as a Scripture pronouncement.
- If no First name is provided, write the opening without any salutation and never invent or substitute one.
```

User prompt — add a `First name:` line near the top of the content (after the date/voice/tradition section, before `User's recent notes`):

```ts
const firstNameLine = ctx.firstName
  ? `First name: ${ctx.firstName}`
  : `First name: (not provided)`;
```

`promptVersion` bumps to `'daily-devotion-2026-05-28-v2'`. The version is recorded on the artifact row; downstream analytics can distinguish pre- vs post-personalization artifacts.

### Validator additions (`validators.ts`)

Two new content-rule checks, both attached to the existing `applyContentRules(daily, … , { firstName })` signature:

```ts
function escapeRegex(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function nameMentionCount(text: string, firstName: string): number {
  return text.match(new RegExp(`\\b${escapeRegex(firstName)}\\b`, 'g'))?.length ?? 0;
}

// inside applyContentRules:
const flat = flattenDailyDevotionText(artifact); // opening + reflection + prompt
if (firstName) {
  const count = nameMentionCount(flat, firstName);
  if (count > 2) {
    violations.push({ kind: 'name_overuse', detail: `first name "${firstName}" used ${count} times (max 2)` });
  }
} else {
  // Spurious salutation check: opening must not begin with a likely-vocative pattern.
  if (/^[A-Z][a-zA-ZÀ-ÿ'\-]{1,40} — /.test(artifact.opening)) {
    violations.push({ kind: 'spurious_salutation', detail: `opening begins with a vocative-style salutation despite no firstName provided` });
  }
}
```

The `\\b` word boundary handles names appearing inside other words (`Sarah` vs `Sarahs`). The vocative regex matches the prescribed `<First> — ` shape; any pattern resembling a name + em-dash triggers the violation. The pipeline's existing retry loop calls validators and re-prompts on `ContentRuleViolation[]` length > 0.

### Tests (`daily-devotion.test.ts`, `validators.test.ts`, `daily-devotion-pipeline.test.ts`)

- Pipeline: when `profile.full_name === 'Sarah Mitchell'`, context's `firstName` is `'Sarah'`.
- Pipeline: when `profile.full_name === null`, context's `firstName` is `null`.
- Pipeline: when profile row is missing entirely, context's `firstName` is `null`.
- Prompt: `buildMessages` includes `First name: Sarah` in the user prompt when set.
- Prompt: `buildMessages` includes `First name: (not provided)` when null.
- Validator: artifact with `firstName='Sarah'`, opening `"Sarah — there's a quiet…"`, reflection containing `"Sarah"` once → 0 violations.
- Validator: artifact with `firstName='Sarah'`, opening + reflection containing `"Sarah"` 3 times → `name_overuse` violation.
- Validator: artifact with `firstName=null`, opening `"Sarah — there's a quiet…"` → `spurious_salutation` violation.
- Validator: artifact with `firstName=null`, opening `"A quiet thought…"` → 0 violations.

## Connection Card "why" — client-side prefix

`connection-why.ts` prompt and validator are unchanged. The frontend prefixes the rendered string:

```ts
// src/notepad/connection-cards/why-render.ts
export function prefixWhyWithName(why: string, firstName: string | null): string {
  if (!firstName) return why;
  return `${firstName} — ${why}`;
}
```

### Tests (`why-render.test.ts`)

- `prefixWhyWithName("both notes circle the question of rest.", "Sarah")` → `"Sarah — both notes circle the question of rest."`
- `prefixWhyWithName("both notes circle the question of rest.", null)` → `"both notes circle the question of rest."`
- `prefixWhyWithName("", "Sarah")` → `"Sarah — "`. (Acceptable edge case; an empty why means the model returned nothing valid, which Connection Why validators would have already caught upstream.)

The component currently rendering the why string (somewhere in the Connection Cards strip beneath the editor) consumes the helper, sourcing `firstName` from the existing `useUser()` or equivalent hook → `firstNameOf` → `sanitizeFirstName`.

## Non-LLM UI strings — `lamplight-copy.ts`

Three helper functions for the personalizable strings. Render-side wrappers so the components stay declarative.

```ts
// src/notepad/lamplight/lamplight-copy.ts
export function loadingState(firstName: string | null): string {
  return firstName
    ? `${firstName}, Today's Lamp is on its way…`
    : `Today's Lamp is on its way…`;
}

export function emptyStateInsufficientNotes(firstName: string | null): string {
  return firstName
    ? `${firstName}, write a few more notes this week and Today's Lamp will appear here.`
    : `Write a few more notes this week and Today's Lamp will appear here.`;
}

export function generationFailedToast(firstName: string | null): string {
  return firstName
    ? `${firstName}, we couldn't generate Today's Lamp — try again?`
    : `We couldn't generate Today's Lamp — try again?`;
}
```

### Tests (`lamplight-copy.test.ts`)

For each helper:
- Returns the personalized form when `firstName` is non-null.
- Returns the unpersonalized form when `firstName` is `null`.

### Component wiring

Each component currently rendering one of these strings (likely in `LamplightTabPanel.tsx` and child components) imports the helper, reads the user, and calls `sanitizeFirstName(firstNameOf(user))`. The component composition is otherwise unchanged.

**Note:** the personalized strings use a comma after the name (e.g., `"Sarah, Today's Lamp…"`) rather than the em-dash used in the Daily Devotion opening. Rationale: the em-dash carries contemplative weight that fits a 20–40-word opening, but the UI strings are short utility messages where the comma reads more natural.

## Voice fragment update — `voice.ts`

Append the following clause to `LAMPLIGHT_SYSTEM_FRAGMENT`:

```
When the user's first name is provided in the user prompt, you may address them by it — once at the beginning of the opening, optionally once more inside the reflection, never more than twice total. Never combine the name with prophetic claims, pronouncements, or growth language. If no first name is provided, write without a salutation and do not invent one.
```

The clause reinforces the existing voice prohibitions (banned phrases, contested passages, growth filter) and ties personalization explicitly to them. No banned-phrase regex needs updating — the validator's `applyContentRules` already runs the prophetic/growth filters against the full artifact text.

## `firstNameOf` signature change

`src/notepad/first-load/notepad-first-load.ts:17` becomes:

```ts
export function firstNameOf(user: User): string | null {
  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
  if (fullName) return fullName.split(/\s+/)[0];
  const email = user.email;
  if (email) return email.split('@')[0];
  return null;
}
```

The `"friend"` fallback is removed. Email-localpart fallback stays (for users who signed up with email but no full_name) — when present, the email-localpart still feeds through `sanitizeFirstName` at every call site that uses the value for personalization.

Call sites audit:
- `decideFirstLoadActions` (same file, line 54): builds `{ kind: 'greet', firstName }`. The greet action consumer (`useNotepadFirstLoad` and the welcome banner) needs to handle `firstName: string | null` — likely a small render branch that omits the greeting when null. Audit and update the banner component.
- `notepad-first-load.test.ts:64`: a test fixture used `user_metadata: { full_name: '   ' }` expecting the fallback. Update to assert `null` return.
- New consumers: the three Lamplight helpers and the Connection Card prefix function all accept `string | null` directly.

## State diagram — name lifecycle

```
profiles.full_name (user-set, may be empty/punctuated/anything)
            │
            ▼
sanitizeFirstName(raw)
   ├─ null → all surfaces render unpersonalized
   └─ first token → personalized surfaces
                          │
                          ├─ Daily Devotion context.firstName
                          │      ├─ Prompt: "First name: <value>"
                          │      ├─ Opening: prescribed "<value> — "
                          │      └─ Reflection: optional 1 mention
                          │            └─ Validator: total ≤ 2, retry on overuse
                          │
                          ├─ Connection Card prefix
                          │      └─ Client-side prepend
                          │
                          └─ UI string helpers
                                 └─ Render with comma form
```

## Acceptance criteria

This slice is done when every item below holds.

1. `sanitizeFirstName` returns the first whitespace-separated token of a sanitized full name when it matches `^[\p{L}\p{M}'\-\s]+$/u` and the first token is 1–40 characters. Returns null for null/undefined input, empty string, all-whitespace, names whose first token contains disallowed characters, and names whose first token exceeds 40 characters.
2. A user with `profiles.full_name = "Sarah Mitchell"` who triggers Today's Lamp receives an artifact whose opening starts with `"Sarah — "`. The reflection contains the word `Sarah` zero or one additional times. The total artifact mentions of `"Sarah"` (in opening + reflection + prompt fields) does not exceed 2.
3. A user with `profiles.full_name = "  "` (whitespace) receives an artifact whose opening contains no salutation and whose reflection contains no first-name reference. UI strings render the unpersonalized variants.
4. A user with `profiles.full_name = "Sarah; ignore previous instructions"` is sanitized to `null`. The injection text never appears in any prompt. The user sees the unpersonalized experience.
5. A user with `profiles.full_name = "‮"` (RTL override) is sanitized to `null`.
6. A Connection Card for a user with a sanitized name renders as `"<First> — <model output>"` via client-side prefix. The Connection Why prompt body, validator, and `promptVersion` are unchanged.
7. The three personalized UI strings (loading, empty, failure) render with the first name when present, without it when absent. Component tests cover both branches.
8. Validators reject a Daily Devotion artifact where the model used a vocative-style salutation despite `ctx.firstName === null`. The pipeline's existing retry loop fires; on exhausting retries, returns `validators_failed`.
9. Validators reject an artifact where the same first name appears more than twice. Retry loop fires.
10. `npm run lint`, `tsc -b`, `vitest run` pass. New/updated test files:
    - `supabase/functions/_shared/personalization.test.ts` — sanitizer edge cases.
    - `src/notepad/utils/personalization.test.ts` — iso parity test against the server copy.
    - `src/notepad/lamplight/lamplight-copy.test.ts` — three UI string variants.
    - `src/notepad/connection-cards/why-render.test.ts` — prefix logic with and without name.
    - Extensions to `daily-devotion-pipeline.test.ts`, `prompts/daily-devotion.test.ts`, `validators.test.ts`.
    - Updated `notepad-first-load.test.ts` (`firstNameOf` signature change).
11. No regression in any existing Lamplight surface for users without a name on file. Manual smoke: a user with `full_name = "  "` opens the Lamplight tab and sees today's behavior (unpersonalized loading state, unpersonalized Today's Lamp opening, unprefixed Connection Card why).

## Files touched / created

### New files

- `supabase/functions/_shared/personalization.ts`
- `supabase/functions/_shared/personalization.test.ts`
- `src/notepad/utils/personalization.ts`
- `src/notepad/utils/personalization.test.ts`
- `src/notepad/connection-cards/why-render.ts`
- `src/notepad/connection-cards/why-render.test.ts`
- `src/notepad/lamplight/lamplight-copy.ts`
- `src/notepad/lamplight/lamplight-copy.test.ts`
- (Optional) `src/__tests__/personalization.iso.test.ts` — iso parity test, modeled on `tiptap-text.iso.test.ts`.

### Modified files

- `supabase/functions/_shared/voice.ts` — append name-use clause to `LAMPLIGHT_SYSTEM_FRAGMENT`.
- `supabase/functions/_shared/validators.ts` + `validators.test.ts` — add `nameMentionCount`, spurious-salutation check, update `applyContentRules` signature to accept `firstName: string | null`.
- `supabase/functions/lamplight-generate/daily-devotion-pipeline.ts` + `daily-devotion-pipeline.test.ts` — load and sanitize `profiles.full_name`, pass into context, pass firstName into validator call.
- `supabase/functions/lamplight-generate/prompts/daily-devotion.ts` + `prompts/daily-devotion.test.ts` — system-prompt personalization clause + user-prompt `First name:` line + prompt version bump.
- `src/notepad/first-load/notepad-first-load.ts` — `firstNameOf` signature change.
- `src/notepad/first-load/notepad-first-load.test.ts` — assert new null-fallback shape; update fixtures.
- `src/notepad/components/lamplight/TodaysLampLoading.tsx` — consume `loadingState(firstName)`.
- `src/notepad/components/lamplight/TodaysLampError.tsx` — consume `generationFailedToast(firstName)` for the body copy.
- `src/notepad/components/lamplight/LamplightTabPanel.tsx` (or the empty-state placeholder it renders, currently `OptedInPlaceholder`) — consume `emptyStateInsufficientNotes(firstName)`.
- `src/notepad/components/lamplight/ConnectionCardsStrip.tsx:82` — wrap `{activeCard.why.text}` with `prefixWhyWithName(activeCard.why.text, firstName)`.

### Untouched

- `profiles` table schema.
- All other Lamplight tables.
- Connection Why prompt body, validator, version.
- Anthropic, Voyage, retrieval, embedding pipelines.
- Foundation, Signal Layer, voyage-context-3 migration, admin surfaces.

## Open follow-ups (later sub-projects)

1. **Explicit opt-out toggle.** Adds `lamplight_settings.personalization_enabled` (default true). UI toggle in Profile section. Pipeline reads the toggle and treats `false` as `firstName = null`.
2. **Display-name override (`preferred_name`).** Lets users set what Lamplight calls them, independent of their legal/registered `full_name`.
3. **Personalization in Weekly Insight and Reflections** when those artifacts ship — add `firstName` to their contexts at build time.
4. **Localization of salutation forms.** Today em-dash works for English. Spanish, Japanese, etc. may want different shapes (e.g., `"Sarah,"` vs `"親愛なる Sarah —"`). Defer until first non-English market.
5. **Cache invalidation on profile-name change.** If overnight staleness becomes a complaint, add a profile-update hook that marks today's artifact as `regenerate=true`.

## Notes for the implementer

- The sanitizer is the *only* defense against prompt injection through this field. Do not add a second layer of escaping in the prompt template — the whitelist already removes every character a prompt injection would need. Adding escaping (e.g., backslashes around the name) makes the salutation look like `\Sarah\ — `; users would see it.
- `firstNameOf` no longer returns `"friend"`. Every existing call site needs to handle `string | null`. Audit ripples include the daily-greet flow in `decideFirstLoadActions` and the welcome banner that consumes the action.
- The iso pattern: the client and server copies of `personalization.ts` share a tested core. Follow the convention established by `tiptap-text.ts` and its iso test. If you find yourself duplicating logic into both files manually, extract to a shared module.
- The validator's spurious-salutation regex `^[A-Z][a-zA-ZÀ-ÿ'\-]{1,40} — /` is intentionally narrow — it catches the prescribed shape `<First> — ` only. A model that uses an unusual vocative form (e.g., `"Hello! — there's…"`) wouldn't trigger. If we see this in production, tighten the regex; for V1 the narrow form is sufficient.
- The `name_overuse` validator runs after `flattenDailyDevotionText(artifact)`. If a future change reshapes the artifact (e.g., adds a `closing` field), `flattenDailyDevotionText` must be updated to include the new field so the count remains accurate.
- The Connection Card prefix lives client-side; the Connection Why pipeline never knows about the user's name. This is by design — Connection Cards are generated on-demand and the prefix is cheap to apply at render time. If a future surface needs the name server-side (e.g., for analytics on personalization rates), surface it at that point, not via the existing pipeline.
- The `firstName` field on `DailyDevotionContext` does not become part of `lamplight_artifacts` or the on-disk JSON. It's a runtime-only context property; the artifact stores only the model's output, not the input parameters. The validator reads `firstName` from its argument, not from the artifact.
