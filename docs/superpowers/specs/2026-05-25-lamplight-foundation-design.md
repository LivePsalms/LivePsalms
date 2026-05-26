# Lamplight — Foundation (Sub-Project 1)

**Status:** Draft (2026-05-25)
**Owner:** Notepad — AI companion feature
**Parent brief:** `Lamplight_AI_details.md` (root)
**Companion sub-projects (future):** Signal Layer · Reasoning Layer · Today's Lamp · Connection Cards · Entitlements UI · Doctrinal Review

## Purpose

Lamplight is the upcoming AI companion that lives inside the notepad — a scripture-grounded, citation-first layer that draws from the user's own notes. The full feature is too large for a single spec, so it has been decomposed into seven sub-projects. **This document specifies sub-project 1: Foundation.**

Foundation delivers a complete, AI-less Lamplight surface: users can see the tab, learn what Lamplight is, opt in (with optional voice + tradition prefs), opt out, change their mind, and turn it off from the profile. Anonymous users see a sign-in gate. **Zero LLM calls, zero embeddings, zero generation** ship in this slice — those layer in via sub-projects 2-5 without schema churn, because Foundation lays down the full Lamplight DB schema today.

The slice is sized for ~1 week, one engineer. It is also the only sub-project that touches the existing notepad tab strip and the existing profile page; later sub-projects build on top of these surfaces, not into them.

## Decisions log

Six brainstorming decisions feed this spec. Each is locked unless explicitly reopened.

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Foundation depth | **Standard** | Migrations + adapter + consent + settings + tab shell + entitlement gate. No LLM scaffolding in this slice. |
| 2 | Consent screen surface | **Inline tab takeover** | Consent UI is a state of the Lamplight tab, not a separate route or modal. |
| 3 | Opted-in state in Foundation | **C — minimal confirmation** | "You're set up. Lamplight will appear here when ready." Voice/tradition echoed. |
| 4 | Schema scope | **Full schema per spec** | All Lamplight tables + `bible_passages` land in 008. Embedding column dimension fixed at `vector(1024)` for Voyage AI `voyage-3-large`. |
| 5 | Tab placement | **C — far right with separator + accent** | Preserves muscle memory; visually marks Lamplight as a categorically different surface. |
| 6 | Onboarding nudge | **None** | The accent-styled `🕯 LAMPLIGHT` tab is the entire nudge. No banner, no modal, no auto-routing. |

Two upstream operational facts inform the design:

- **LLM credentials:** Anthropic API key is provisioned. No embedding provider key yet — Voyage AI key is targeted within ~1 week (before sub-project 2 begins).
- **Existing code surfaces** verified in repo: `src/notepad/utils/tiptap-text.ts` (text extraction), `src/notepad/graph/reference-parser.ts` (verse parser), `src/notepad/storage/adapter.ts` (storage adapter), `src/notepad/gamification/tiers.ts` (8-tier system), `src/notepad/components/LevelUpModal.tsx`, `src/components/sections/Notepad.tsx:21` (tab state), `src/auth/ProfilePage.tsx`, `src/App.tsx:150` (`/welcome` route). Latest migration is `007_profiles_last_acknowledged_tier.sql`, so Lamplight migrations start at **008**.

## Scope

### In

- Three new Supabase migrations (`008_lamplight_schema.sql`, `009_bible_passages.sql`, `010_lamplight_seed.sql`).
- `pgvector` extension enabled.
- RLS policies for every user-scoped Lamplight table.
- `LamplightAdapter` interface + `SupabaseLamplightAdapter` implementation.
- `useLamplightEntitlement()` hook reading `app_config.lamplight_promo_active` + `lamplight_entitlements`.
- Five UI components: `LamplightTabPanel`, `ConsentCard`, `SignInGate`, `LamplightSettingsSection`, `PaywallCard`.
- A fourth tab `'lamplight'` added to the existing notepad tab strip with C-style visual treatment.
- Profile page gains a new "Lamplight" section.
- A "Forget my Lamplight history" destructive action (with confirm dialog) that deletes all `lamplight_*` rows for the calling user.
- Test coverage: RLS isolation, four-state branching, settings round-trip, forget-data flow.

### Out

- Any LLM call. No Anthropic SDK installed in this slice (sub-project 3).
- Any embedding generation. No Voyage AI client installed in this slice (sub-project 2).
- Bible corpus ingest. The `bible_passages` table is created empty; ingest script ships with sub-project 2.
- Today's Lamp generation, Connection Cards, Weekly Insight, Reflections Recap, inline verse suggestions, tier celebration copy.
- `pg_cron` scheduled jobs (no jobs to run yet).
- Supabase Edge Functions (none required by this slice).
- Doctrinal review board sign-off (that gate is for *public AI launch*, not for Foundation merge).
- Quiet Mode UI, inline-suggestion toggle, weekly-email toggle in the settings panel — YAGNI'd until their underlying features ship.

## Database

### Migration `008_lamplight_schema.sql`

Top of file:

```sql
create extension if not exists vector;
```

Then tables in alphabetical order. All user-scoped tables enable RLS with `auth.uid() = user_id`.

| Table | Columns (abridged) | Indexes / constraints |
|---|---|---|
| `app_config` | `key text PK`, `value jsonb`, `updated_at` | Public `select`; `service_role` `insert/update`. |
| `lamplight_artifacts` | `id uuid PK`, `user_id`, `type`, `period_key`, `title`, `body jsonb`, `source_note_ids uuid[]`, `source_verses text[]`, `model_used`, `prompt_version`, `saved_to_notes bool`, `created_at` | Unique `(user_id, type, period_key)`. |
| `lamplight_connections` | `note_id`, `related_note_id`, `score float`, `why text`, `content_hash`, `created_at` | PK `(note_id, related_note_id)`. |
| `lamplight_embeddings` | `id uuid PK`, `user_id`, `source_type` ('note'\|'bible_passage'), `source_id text`, `content_hash`, `embedding vector(1024)`, `metadata jsonb`, `created_at` | `ivfflat (embedding vector_cosine_ops)`. |
| `lamplight_entitlements` | `user_id uuid PK`, `tier text` ('plus'\|'lite'\|'none' default 'none'), `source text`, `granted_at`, `expires_at` | RLS read-only for user; service-role write. |
| `lamplight_jobs` | `id uuid PK`, `user_id`, `kind`, `status` ('queued'\|'running'\|'done'\|'failed'), `payload jsonb`, `attempts int`, `scheduled_at`, `started_at`, `finished_at`, `error text` | Index on `(status, scheduled_at)`. |
| `lamplight_settings` | `user_id uuid PK references profiles(id)`, `enabled bool default false`, `quiet_mode bool default false`, `voice_preference text default 'Lord'`, `tradition_hint text default 'unspecified'`, `inline_suggestions bool default true`, `weekly_email bool default false`, `consent_decided_at timestamptz`, `created_at`, `updated_at` | — |
| `lamplight_suggestions_log` | `id uuid PK`, `user_id`, `note_id`, `verse_ref`, `why`, `shown_at`, `outcome text` ('inserted'\|'dismissed'\|'ignored') | — |

`voice_preference` constrained to `('Lord','Father','Abba','Jesus')` via CHECK.
`tradition_hint` constrained to `('evangelical','catholic','orthodox','unspecified')` via CHECK.

### Migration `009_bible_passages.sql`

```sql
create table bible_passages (
  id text primary key,            -- e.g. 'gen.1.1' or 'psa.23'
  book text not null,
  chapter int not null,
  verse_start int not null,
  verse_end int not null,
  translation text not null,      -- 'BSB' (MVP), 'ESV' (V1 via API)
  text text not null,
  pericope_id text                -- groups passages semantically, e.g. 'Psalm 23'
);
create index on bible_passages (book, chapter);
create index on bible_passages (pericope_id);
-- public read, no RLS — Bible passages are not user-scoped.
```

Table is created empty. Ingest script ships with sub-project 2 (Signal Layer).

### Migration `010_lamplight_seed.sql`

```sql
insert into app_config (key, value) values
  ('lamplight_promo_active', 'true'::jsonb),
  ('lamplight_promo_ends_at', 'null'::jsonb);
```

When the promo period ends, flipping is a single `update app_config set value='false' where key='lamplight_promo_active';` — no code change, no migration, no deploy.

## Adapter layer

### `src/notepad/storage/lamplight-adapter.ts` (new)

Interface peer to the existing `StorageAdapter`:

```ts
export interface LamplightSettings {
  userId: string;
  enabled: boolean;
  quietMode: boolean;
  voicePreference: 'Lord' | 'Father' | 'Abba' | 'Jesus';
  traditionHint: 'evangelical' | 'catholic' | 'orthodox' | 'unspecified';
  inlineSuggestions: boolean;
  weeklyEmail: boolean;
  consentDecidedAt: Date | null;
}

export interface LamplightEntitlement {
  userId: string;
  tier: 'plus' | 'lite' | 'none';
  source: 'promo' | 'subscription' | 'grant' | null;
  grantedAt: Date | null;
  expiresAt: Date | null;
}

export interface PromoConfig {
  promoActive: boolean;
  promoEndsAt: Date | null;
}

export interface LamplightAdapter {
  getSettings(userId: string): Promise<LamplightSettings | null>;
  upsertSettings(userId: string, patch: Partial<LamplightSettings>): Promise<LamplightSettings>;
  deleteAllUserData(userId: string): Promise<void>;
  getEntitlement(userId: string): Promise<LamplightEntitlement | null>;
  getPromoConfig(): Promise<PromoConfig>;
}
```

### `src/notepad/storage/supabase-lamplight-adapter.ts` (new)

Concrete implementation using the existing Supabase client. `deleteAllUserData` deletes from `lamplight_settings`, `lamplight_entitlements`, `lamplight_embeddings`, `lamplight_artifacts`, `lamplight_jobs`, `lamplight_suggestions_log`, `lamplight_connections` for the user — leaves `bible_passages` alone (not user-scoped).

Anonymous users never instantiate this — the `SignInGate` short-circuits before any adapter call. No LocalStorage adapter ships in Foundation. Per locked decision #4 in the brief, anonymous users have no Lamplight.

### `src/notepad/hooks/useLamplightSettings.ts` (new)

Thin React hook over the adapter. Returns `{ isLoading, settings, refetch, upsert, deleteAll }` where `settings: LamplightSettings | null`. `null` means no row exists yet (the "undecided" state). Caches per session; invalidates on `upsert` and `deleteAll`. Sign-out clears the cache.

### `src/notepad/hooks/useLamplightEntitlement.ts` (new)

```ts
export function useLamplightEntitlement(): {
  isLoading: boolean;
  tier: 'plus' | 'lite' | 'none';
  promoActive: boolean;
  hasAccess: (feature: 'today' | 'weekly' | 'reflections' | 'inline') => boolean;
};
```

Caches `app_config` for the session (it changes once, at promo-end). `hasAccess` rules:

- `promoActive === true` → always `true`.
- Else: `tier === 'plus'` → `true` for all features; `tier === 'lite'` → `true` only for `'today'` and `'weekly'`; `tier === 'none'` → `false`.

Every Lamplight surface calls `hasAccess()` before rendering content. In Foundation, the result is universally `true`.

**Product rule:** opt-in is always free — `<ConsentCard />` and the settings panel render regardless of entitlement. The paywall only blocks the *opted-in* content state (`<OptedInPlaceholder />` today, real generation later). So `hasAccess` is checked only inside the opted-in branch of `<LamplightTabPanel />`.

## UI surfaces

Five components, all new.

### `<LamplightTabPanel />`

Lives at `src/notepad/components/lamplight/LamplightTabPanel.tsx`. Renders inside the existing tab content area (currently `<NotepadEditor />`, `<BacklinksPanel />`, `<InfoPanel />` at `src/components/sections/Notepad.tsx:141-143`).

Branches on `useAuthSession` + `useLamplightSettings` (a thin hook over the adapter):

```
not signed-in              → <SignInGate />
signed-in, settings == null → <ConsentCard />
signed-in, !enabled         → <OptedOutCard />
signed-in,  enabled         → <OptedInPlaceholder />
hasAccess === false         → <PaywallCard />   // unreachable while promo active
```

All four-state mockups live on the visual companion under `four-states.html`.

### `<ConsentCard />`

Two-step inline reveal:

1. Initial: heading + body copy + `Turn on Lamplight` (primary) / `Maybe later` (secondary).
2. After "Turn on": revealed inline below — two optional radio groups (voice: Lord/Father/Abba/Jesus, default Lord; tradition: Evangelical/Catholic/Orthodox/Skip) + a `Continue` button.

On Continue → `upsertSettings({ enabled: true, voicePreference, traditionHint, consentDecidedAt: now() })` → component re-renders as `<OptedInPlaceholder />`.

On "Maybe later" → `upsertSettings({ enabled: false, consentDecidedAt: now() })` → re-renders as `<OptedOutCard />`.

### `<SignInGate />`

Blurred mockup background + centered card with "Today's Lamp is waiting for you." + `Sign in` / `Sign up` buttons linking to `/login` + a small `Why sign in?` link to a privacy-commitment popover. No nag, no popup, no auto-redirect.

### `<LamplightSettingsSection />`

Added to `src/auth/ProfilePage.tsx` as a new section. Contains:

- **Master toggle** — `enabled`. Off → confirm dialog ("Lamplight will stop reading new notes. Existing artifacts are preserved.") → writes `enabled=false`.
- **Voice preference** — radio group, four options.
- **Tradition hint** — radio group, four options including Skip → `unspecified`.
- **Forget my Lamplight history** — destructive button + confirm dialog ("This deletes every Lamplight record we have for your account. Cannot be undone."). On confirm → `deleteAllUserData(userId)` → settings reset to undecided. Page reloads its Lamplight state.

Quiet Mode, inline-suggestion toggle, weekly-email toggle are **not present** in Foundation. They appear when their underlying features ship.

### `<PaywallCard />`

Minimal placeholder: "Lamplight is no longer included free. [Contact us for access]". Unreachable while `lamplight_promo_active=true`. Exists so flipping the flag truly is a one-row update with no missing UI.

## Tab strip integration

In `src/components/sections/Notepad.tsx`:

- Line 21: extend the activeTab type to include `'lamplight'`.
- Line 122-138 (tab strip rendering): add a fourth tab item after INFO, preceded by a vertical separator (`<span aria-hidden style="opacity: 0.3; margin: 0 8px;">|</span>`), with the accent color treatment and the 🕯 glyph prefix. Label: `LAMPLIGHT`.
- Line 141-143: add `{activeTab === 'lamplight' && <LamplightTabPanel />}`.

No changes to the existing CONTENT / BACKLINKS / INFO tabs. No state migration. Existing tests continue to pass.

## State transitions

```
                                  signed in?
                                       ├── no  → SignInGate
                                       └── yes → settings row exists?
                                                  ├── no  → ConsentCard
                                                  │        ├── "Turn on"   → enabled=true  → OptedInPlaceholder
                                                  │        └── "Maybe later"→ enabled=false → OptedOutCard
                                                  └── yes → enabled?
                                                            ├── true  → hasAccess?
                                                            │           ├── true (promo active) → OptedInPlaceholder
                                                            │           └── false               → PaywallCard
                                                            └── false → OptedOutCard
                                                                         └── "Change your mind?" → reset to ConsentCard
```

The "reset to ConsentCard" transition deletes the existing settings row (so the user re-experiences the consent flow including optional voice/tradition questions). Alternative: keep the row, just flip `enabled=true` — but then the optional questions get bypassed, which is a worse UX. Spec choice: delete + recreate on change-mind. Cheap because the row is tiny.

## Acceptance criteria

Foundation is done when every item below holds.

1. Migrations 008, 009, 010 run clean against a fresh Supabase project. `vector` extension exists. RLS policies present on all user-scoped tables.
2. Anonymous user at `/notepad/notes` → Lamplight tab visible (no auth required to render the strip) → click → `SignInGate` renders. Sign in / Sign up buttons route to `/login`.
3. Signed-in user with no `lamplight_settings` row → `ConsentCard` renders. "Turn on Lamplight" reveals optional voice + tradition questions inline. Continue → row created with `enabled=true`, chosen preferences stored, `consent_decided_at` set. State 4 (`OptedInPlaceholder`) renders.
4. Signed-in user clicks "Maybe later" → row created with `enabled=false`. State 3 (`OptedOutCard`) renders. "Change your mind?" link → row deleted → ConsentCard renders.
5. Profile page renders a Lamplight section with master toggle, voice preference, tradition hint, and Forget button.
6. Forget button → confirm dialog → all `lamplight_*` rows for the user are deleted. Both profile and notepad Lamplight surfaces reset to undecided.
7. RLS isolation test: user A cannot read or write user B's `lamplight_settings`, `lamplight_entitlements`, `lamplight_embeddings`, `lamplight_artifacts`, `lamplight_jobs`, `lamplight_suggestions_log`, or `lamplight_connections` rows.
8. `useLamplightEntitlement().hasAccess('today')` returns `true` for every user while promo is active. Manually updating `app_config.lamplight_promo_active=false` in the DB causes `<PaywallCard />` to render for users without an entitlement row.
9. `npm run lint`, `tsc -b`, and `vitest run` all pass.
10. No regression in existing notepad tabs (CONTENT / BACKLINKS / INFO continue to render and switch as before).

## Files touched / created

### New files

- `supabase/migrations/008_lamplight_schema.sql`
- `supabase/migrations/009_bible_passages.sql`
- `supabase/migrations/010_lamplight_seed.sql`
- `src/notepad/storage/lamplight-adapter.ts`
- `src/notepad/storage/supabase-lamplight-adapter.ts`
- `src/notepad/hooks/useLamplightSettings.ts`
- `src/notepad/hooks/useLamplightEntitlement.ts`
- `src/notepad/components/lamplight/LamplightTabPanel.tsx`
- `src/notepad/components/lamplight/ConsentCard.tsx`
- `src/notepad/components/lamplight/SignInGate.tsx`
- `src/notepad/components/lamplight/OptedOutCard.tsx`
- `src/notepad/components/lamplight/OptedInPlaceholder.tsx`
- `src/notepad/components/lamplight/PaywallCard.tsx`
- `src/auth/components/LamplightSettingsSection.tsx`
- Test files mirroring each component + an `rls-isolation.test.ts` (integration test against a local Supabase or Supabase test schema).

### Modified files

- `src/components/sections/Notepad.tsx` — extend `activeTab` type, add tab strip entry, add panel render branch.
- `src/auth/ProfilePage.tsx` — insert `<LamplightSettingsSection />`.
- `package.json` — no new runtime dependencies. (Zod, Supabase JS already present.)

### Untouched

- All existing notepad code outside the tab strip.
- All existing migrations 001-007.
- The `notes`, `folders`, `profiles` tables (spec promise: Foundation does not alter existing schema).

## Open follow-ups (later sub-projects)

These are deliberately deferred and called out so they don't get forgotten.

1. **Sub-project 2 (Signal Layer):** Voyage AI client setup, embedding pipeline (note save → debounced job → `lamplight_jobs` → Supabase Edge Function worker → `lamplight_embeddings`), BSB corpus ingest into `bible_passages`. Requires Voyage API key (target: ~1 week from Foundation start).
2. **Sub-project 3 (Reasoning Layer):** `LLMAdapter` interface (Claude under the hood), versioned prompt templates, citation validator, doctrinal guardrail, growth-only language filter.
3. **Sub-project 4 (Today's Lamp):** On-demand generation from the Lamplight tab; this replaces `<OptedInPlaceholder />` with real content.
4. **Sub-project 5 (Connection Cards):** pgvector neighbor lookup + lazy Haiku "why" generation.
5. **Sub-project 6 (Entitlements UI):** Real paywall card, subscription flow, lite-tier gating logic. Replaces the placeholder `<PaywallCard />`.
6. **Sub-project 7 (Doctrinal Review):** `docs/lamplight/doctrinal-review.md`, 30 synthetic-persona sample artifacts, reviewer sign-off. Required before any public AI launch — not required for Foundation merge.

Operational items also flagged in the brief:

- **Promo end date / criteria** — recommend a fixed date in `app_config` set 4 months after public launch.
- **Grandfathering policy** — recommend 60-day grace + 50% lifetime discount for promo-period users.
- **Doctrinal reviewers** — identify two names (one seminary-trained pastor, one theologically-grounded layperson) within two weeks of starting sub-project 3.

## Notes for the implementer

- Migrations land in three files so each can be reverted independently if needed.
- The `LamplightAdapter` interface is intentionally narrower than the eventual full surface area — sub-projects 2-5 will add methods. Keep `lamplight-adapter.ts` open for extension.
- The `LamplightTabPanel` branching logic is the single source of truth for which state renders. All future Lamplight features render *inside* one of those states — not as siblings.
- The "delete row on change-mind" transition (§ State transitions) is mildly surprising; document inline with a code comment so a future engineer doesn't 'fix' it by reusing the row.
- `<PaywallCard />` is unreachable but production-shipped. Resist the temptation to leave it as a `// TODO`. If we flip the flag in a year and forget the UI, we'll embarrass ourselves.
