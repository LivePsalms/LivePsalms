# Lamplight Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI-less Foundation slice of Lamplight — full DB schema, adapter, four-state Lamplight tab, consent flow, profile settings section, and entitlement gate seeded with promo-active. No LLM calls; no embeddings generated.

**Architecture:** Three Supabase migrations (`008`, `009`, `010`) land the full Lamplight schema + pgvector + RLS + seed. A `LamplightAdapter` interface peers the existing `StorageAdapter`. Two hooks (`useLamplightSettings`, `useLamplightEntitlement`) bridge adapter → React. Five components render the four tab states + a placeholder paywall; one container (`LamplightTabPanel`) branches on auth + settings + entitlement. The tab strip in `src/components/sections/Notepad.tsx` gains a fourth `'lamplight'` tab with a separator + accent treatment. The profile page gains a `<LamplightSettingsSection />`.

**Tech Stack:** React 19 + Vite + TypeScript + TailwindCSS + Supabase Postgres + Supabase JS 2 + Vitest + Radix UI primitives (`alert-dialog`, `radio-group`, `switch`). Follows existing project patterns: hand-crafted fake Supabase clients for unit tests, RLS-only auth scoping, CSS-variable theming.

**Spec:** `docs/superpowers/specs/2026-05-25-lamplight-foundation-design.md`

---

## File Structure

### Created files

```
supabase/migrations/008_lamplight_schema.sql
supabase/migrations/009_bible_passages.sql
supabase/migrations/010_lamplight_seed.sql

src/notepad/storage/lamplight-adapter.ts                    # Interface + types
src/notepad/storage/supabase-lamplight-adapter.ts           # Concrete impl
src/notepad/storage/fake-lamplight-adapter.ts               # Test helper
src/notepad/storage/supabase-lamplight-adapter.test.ts      # Adapter unit tests
src/notepad/storage/lamplight-rls.test.ts                   # RLS isolation integration test

src/notepad/hooks/useLamplightSettings.ts                   # Settings + mutations
src/notepad/hooks/useLamplightSettings.test.ts
src/notepad/hooks/useLamplightEntitlement.ts                # Entitlement + hasAccess
src/notepad/hooks/useLamplightEntitlement.test.ts

src/notepad/components/lamplight/LamplightTabPanel.tsx       # Container — state branching
src/notepad/components/lamplight/LamplightTabPanel.test.tsx
src/notepad/components/lamplight/SignInGate.tsx
src/notepad/components/lamplight/SignInGate.test.tsx
src/notepad/components/lamplight/ConsentCard.tsx
src/notepad/components/lamplight/ConsentCard.test.tsx
src/notepad/components/lamplight/OptedOutCard.tsx
src/notepad/components/lamplight/OptedOutCard.test.tsx
src/notepad/components/lamplight/OptedInPlaceholder.tsx
src/notepad/components/lamplight/OptedInPlaceholder.test.tsx
src/notepad/components/lamplight/PaywallCard.tsx
src/notepad/components/lamplight/PaywallCard.test.tsx

src/auth/components/LamplightSettingsSection.tsx
src/auth/components/LamplightSettingsSection.test.tsx
```

### Modified files

- `src/components/sections/Notepad.tsx` — extend `activeTab` type, add tab strip entry, render `<LamplightTabPanel />` branch.
- `src/auth/ProfilePage.tsx` — insert `<LamplightSettingsSection />` between existing sections.

### Boundary intent

- The `lamplight-adapter.ts` file is **interface + types only**. Subsequent sub-projects will extend it; keeping it free of implementation prevents merge churn.
- The `LamplightTabPanel.tsx` is the **only place** that switches on auth/settings/entitlement state. Future Lamplight features render *inside* one of the four state components, never as siblings of the panel.
- Each state component (`SignInGate`, `ConsentCard`, etc.) is pure-presentational + calls mutations via injected props — testable without React context.

---

## Task 1: Migration `008_lamplight_schema.sql` — extension, tables, RLS

**Files:**
- Create: `supabase/migrations/008_lamplight_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Lamplight core schema: opt-in settings, entitlements, embeddings, artifacts,
-- jobs, suggestions log, and connections cache. All user-scoped tables enforce
-- RLS via auth.uid() = user_id. The embeddings column is vector(1024) to match
-- Voyage AI voyage-3-large at default dimension.

create extension if not exists vector;

-- ── app_config ───────────────────────────────────────────────────────────
-- Global key/value config. Public read so the promo flag is readable without
-- a session; only service-role can write.
create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

create policy "Anyone can read app_config"
  on public.app_config for select using (true);

-- ── lamplight_settings ───────────────────────────────────────────────────
create table public.lamplight_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  quiet_mode boolean not null default false,
  voice_preference text not null default 'Lord'
    check (voice_preference in ('Lord', 'Father', 'Abba', 'Jesus')),
  tradition_hint text not null default 'unspecified'
    check (tradition_hint in ('evangelical', 'catholic', 'orthodox', 'unspecified')),
  inline_suggestions boolean not null default true,
  weekly_email boolean not null default false,
  consent_decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lamplight_settings enable row level security;

create policy "Users can view own lamplight_settings"
  on public.lamplight_settings for select using (auth.uid() = user_id);
create policy "Users can insert own lamplight_settings"
  on public.lamplight_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own lamplight_settings"
  on public.lamplight_settings for update using (auth.uid() = user_id);
create policy "Users can delete own lamplight_settings"
  on public.lamplight_settings for delete using (auth.uid() = user_id);

-- ── lamplight_entitlements ───────────────────────────────────────────────
create table public.lamplight_entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tier text not null default 'none'
    check (tier in ('plus', 'lite', 'none')),
  source text check (source in ('promo', 'subscription', 'grant')),
  granted_at timestamptz,
  expires_at timestamptz
);

alter table public.lamplight_entitlements enable row level security;

create policy "Users can view own lamplight_entitlements"
  on public.lamplight_entitlements for select using (auth.uid() = user_id);

-- ── lamplight_embeddings ─────────────────────────────────────────────────
create table public.lamplight_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null check (source_type in ('note', 'bible_passage')),
  source_id text not null,
  content_hash text not null,
  embedding vector(1024) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index lamplight_embeddings_ivfflat
  on public.lamplight_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index lamplight_embeddings_user_source
  on public.lamplight_embeddings (user_id, source_type, source_id);

alter table public.lamplight_embeddings enable row level security;

create policy "Users can view own lamplight_embeddings"
  on public.lamplight_embeddings for select using (auth.uid() = user_id);
create policy "Users can insert own lamplight_embeddings"
  on public.lamplight_embeddings for insert with check (auth.uid() = user_id);
create policy "Users can update own lamplight_embeddings"
  on public.lamplight_embeddings for update using (auth.uid() = user_id);
create policy "Users can delete own lamplight_embeddings"
  on public.lamplight_embeddings for delete using (auth.uid() = user_id);

-- ── lamplight_artifacts ──────────────────────────────────────────────────
create table public.lamplight_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null
    check (type in ('daily_devotion', 'weekly_insight', 'reflection_recap', 'tier_celebration')),
  period_key text not null,
  title text not null default '',
  body jsonb not null default '{}'::jsonb,
  source_note_ids uuid[] not null default '{}',
  source_verses text[] not null default '{}',
  model_used text,
  prompt_version text,
  saved_to_notes boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, type, period_key)
);

alter table public.lamplight_artifacts enable row level security;

create policy "Users can view own lamplight_artifacts"
  on public.lamplight_artifacts for select using (auth.uid() = user_id);
create policy "Users can insert own lamplight_artifacts"
  on public.lamplight_artifacts for insert with check (auth.uid() = user_id);
create policy "Users can update own lamplight_artifacts"
  on public.lamplight_artifacts for update using (auth.uid() = user_id);
create policy "Users can delete own lamplight_artifacts"
  on public.lamplight_artifacts for delete using (auth.uid() = user_id);

-- ── lamplight_jobs ───────────────────────────────────────────────────────
create table public.lamplight_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error text
);

create index lamplight_jobs_status_scheduled
  on public.lamplight_jobs (status, scheduled_at);

alter table public.lamplight_jobs enable row level security;

create policy "Users can view own lamplight_jobs"
  on public.lamplight_jobs for select using (auth.uid() = user_id);
create policy "Users can insert own lamplight_jobs"
  on public.lamplight_jobs for insert with check (auth.uid() = user_id);
create policy "Users can update own lamplight_jobs"
  on public.lamplight_jobs for update using (auth.uid() = user_id);
create policy "Users can delete own lamplight_jobs"
  on public.lamplight_jobs for delete using (auth.uid() = user_id);

-- ── lamplight_suggestions_log ────────────────────────────────────────────
create table public.lamplight_suggestions_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  note_id uuid references public.notes(id) on delete cascade,
  verse_ref text not null,
  why text not null default '',
  shown_at timestamptz not null default now(),
  outcome text check (outcome in ('inserted', 'dismissed', 'ignored'))
);

alter table public.lamplight_suggestions_log enable row level security;

create policy "Users can view own lamplight_suggestions_log"
  on public.lamplight_suggestions_log for select using (auth.uid() = user_id);
create policy "Users can insert own lamplight_suggestions_log"
  on public.lamplight_suggestions_log for insert with check (auth.uid() = user_id);
create policy "Users can update own lamplight_suggestions_log"
  on public.lamplight_suggestions_log for update using (auth.uid() = user_id);
create policy "Users can delete own lamplight_suggestions_log"
  on public.lamplight_suggestions_log for delete using (auth.uid() = user_id);

-- ── lamplight_connections ────────────────────────────────────────────────
create table public.lamplight_connections (
  note_id uuid not null references public.notes(id) on delete cascade,
  related_note_id uuid not null references public.notes(id) on delete cascade,
  score real not null,
  why text not null default '',
  content_hash text not null,
  created_at timestamptz not null default now(),
  primary key (note_id, related_note_id)
);

alter table public.lamplight_connections enable row level security;

create policy "Users can view own lamplight_connections"
  on public.lamplight_connections for select
  using (exists (
    select 1 from public.notes n
    where n.id = lamplight_connections.note_id and n.user_id = auth.uid()
  ));
create policy "Users can insert own lamplight_connections"
  on public.lamplight_connections for insert
  with check (exists (
    select 1 from public.notes n
    where n.id = lamplight_connections.note_id and n.user_id = auth.uid()
  ));
create policy "Users can delete own lamplight_connections"
  on public.lamplight_connections for delete
  using (exists (
    select 1 from public.notes n
    where n.id = lamplight_connections.note_id and n.user_id = auth.uid()
  ));
```

- [ ] **Step 2: Apply locally and smoke-test**

Run: `supabase db reset`
Expected: All migrations 001–010 run, exit 0. (If `supabase db reset` is destructive in the current dev environment, use `supabase migration up` instead.)

Then verify with psql via the supabase CLI:

```
supabase db psql -c "\dt public.lamplight_*"
```
Expected output: lists `lamplight_artifacts`, `lamplight_connections`, `lamplight_embeddings`, `lamplight_entitlements`, `lamplight_jobs`, `lamplight_settings`, `lamplight_suggestions_log`.

```
supabase db psql -c "SELECT extname FROM pg_extension WHERE extname='vector';"
```
Expected: returns one row `vector`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/008_lamplight_schema.sql
git commit -m "feat(db): Lamplight core schema (settings, entitlements, embeddings, artifacts, jobs, suggestions log, connections) + RLS"
```

---

## Task 2: Migration `009_bible_passages.sql`

**Files:**
- Create: `supabase/migrations/009_bible_passages.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Bible passages table. Public read (translations are not user-scoped). The
-- table is created empty here; the BSB ingest script lives in sub-project 2.

create table public.bible_passages (
  id text primary key,
  book text not null,
  chapter integer not null,
  verse_start integer not null,
  verse_end integer not null,
  translation text not null,
  text text not null,
  pericope_id text
);

create index bible_passages_book_chapter on public.bible_passages (book, chapter);
create index bible_passages_pericope on public.bible_passages (pericope_id) where pericope_id is not null;

alter table public.bible_passages enable row level security;

create policy "Anyone can read bible_passages"
  on public.bible_passages for select using (true);
```

- [ ] **Step 2: Apply and verify**

Run: `supabase db reset` (or `supabase migration up`)
Then: `supabase db psql -c "\d public.bible_passages"`
Expected: table exists with columns `id`, `book`, `chapter`, `verse_start`, `verse_end`, `translation`, `text`, `pericope_id`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/009_bible_passages.sql
git commit -m "feat(db): bible_passages table (empty; ingest in sub-project 2)"
```

---

## Task 3: Migration `010_lamplight_seed.sql`

**Files:**
- Create: `supabase/migrations/010_lamplight_seed.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Seed app_config with the Lamplight promo flag. While
-- lamplight_promo_active = true, every user has full Lamplight access
-- regardless of entitlement. Flipping this flag is a one-row update;
-- no code change, no migration, no deploy.

insert into public.app_config (key, value) values
  ('lamplight_promo_active', 'true'::jsonb),
  ('lamplight_promo_ends_at', 'null'::jsonb)
on conflict (key) do nothing;
```

- [ ] **Step 2: Apply and verify**

Run: `supabase db reset`
Then: `supabase db psql -c "SELECT key, value FROM public.app_config WHERE key LIKE 'lamplight%';"`
Expected: two rows — `lamplight_promo_active` = `true`, `lamplight_promo_ends_at` = `null`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/010_lamplight_seed.sql
git commit -m "feat(db): seed app_config with lamplight_promo_active=true"
```

---

## Task 4: `LamplightAdapter` interface + types

**Files:**
- Create: `src/notepad/storage/lamplight-adapter.ts`

- [ ] **Step 1: Write the interface file**

```ts
// Lamplight adapter contract. Implementations live in
// supabase-lamplight-adapter.ts (production) and fake-lamplight-adapter.ts
// (tests). This file is intentionally narrow — sub-projects 2-5 will extend
// it; keep it free of implementation to minimise merge churn.

export type LamplightVoice = 'Lord' | 'Father' | 'Abba' | 'Jesus';
export type LamplightTradition =
  | 'evangelical'
  | 'catholic'
  | 'orthodox'
  | 'unspecified';
export type LamplightTier = 'plus' | 'lite' | 'none';
export type LamplightEntitlementSource =
  | 'promo'
  | 'subscription'
  | 'grant';

export interface LamplightSettings {
  userId: string;
  enabled: boolean;
  quietMode: boolean;
  voicePreference: LamplightVoice;
  traditionHint: LamplightTradition;
  inlineSuggestions: boolean;
  weeklyEmail: boolean;
  consentDecidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LamplightEntitlement {
  userId: string;
  tier: LamplightTier;
  source: LamplightEntitlementSource | null;
  grantedAt: string | null;
  expiresAt: string | null;
}

export interface PromoConfig {
  promoActive: boolean;
  promoEndsAt: string | null;
}

export interface LamplightAdapter {
  getSettings(userId: string): Promise<LamplightSettings | null>;
  upsertSettings(
    userId: string,
    patch: Partial<Omit<LamplightSettings, 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<LamplightSettings>;
  deleteAllUserData(userId: string): Promise<void>;
  getEntitlement(userId: string): Promise<LamplightEntitlement | null>;
  getPromoConfig(): Promise<PromoConfig>;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc -b`
Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/notepad/storage/lamplight-adapter.ts
git commit -m "feat(lamplight): adapter interface + types"
```

---

## Task 5: `FakeLamplightAdapter` test helper

**Files:**
- Create: `src/notepad/storage/fake-lamplight-adapter.ts`

- [ ] **Step 1: Write the fake adapter**

```ts
import type {
  LamplightAdapter,
  LamplightSettings,
  LamplightEntitlement,
  PromoConfig,
} from './lamplight-adapter';

/**
 * In-memory LamplightAdapter for unit tests. Mirrors the Supabase
 * behaviour for read/write/delete without going through Postgres.
 */
export class FakeLamplightAdapter implements LamplightAdapter {
  settings = new Map<string, LamplightSettings>();
  entitlements = new Map<string, LamplightEntitlement>();
  promo: PromoConfig = { promoActive: true, promoEndsAt: null };
  deleteAllUserDataCalls: string[] = [];

  async getSettings(userId: string): Promise<LamplightSettings | null> {
    return this.settings.get(userId) ?? null;
  }

  async upsertSettings(
    userId: string,
    patch: Partial<Omit<LamplightSettings, 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<LamplightSettings> {
    const now = new Date().toISOString();
    const existing = this.settings.get(userId);
    const merged: LamplightSettings = {
      userId,
      enabled: false,
      quietMode: false,
      voicePreference: 'Lord',
      traditionHint: 'unspecified',
      inlineSuggestions: true,
      weeklyEmail: false,
      consentDecidedAt: null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...existing,
      ...patch,
    };
    this.settings.set(userId, merged);
    return { ...merged };
  }

  async deleteAllUserData(userId: string): Promise<void> {
    this.deleteAllUserDataCalls.push(userId);
    this.settings.delete(userId);
    this.entitlements.delete(userId);
  }

  async getEntitlement(userId: string): Promise<LamplightEntitlement | null> {
    return this.entitlements.get(userId) ?? null;
  }

  async getPromoConfig(): Promise<PromoConfig> {
    return { ...this.promo };
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc -b`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/notepad/storage/fake-lamplight-adapter.ts
git commit -m "test(lamplight): in-memory FakeLamplightAdapter for unit tests"
```

---

## Task 6: `SupabaseLamplightAdapter` — settings methods (TDD)

**Files:**
- Create: `src/notepad/storage/supabase-lamplight-adapter.ts`
- Create: `src/notepad/storage/supabase-lamplight-adapter.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// supabase-lamplight-adapter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseLamplightAdapter } from './supabase-lamplight-adapter';

interface SettingsRow {
  user_id: string;
  enabled: boolean;
  quiet_mode: boolean;
  voice_preference: string;
  tradition_hint: string;
  inline_suggestions: boolean;
  weekly_email: boolean;
  consent_decided_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EntitlementRow {
  user_id: string;
  tier: string;
  source: string | null;
  granted_at: string | null;
  expires_at: string | null;
}

interface ConfigRow {
  key: string;
  value: unknown;
}

interface Backend {
  settings: SettingsRow[];
  entitlements: EntitlementRow[];
  config: ConfigRow[];
  deletes: { table: string; userId: string }[];
}

function makeClient(backend: Backend): SupabaseClient {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq(_col: string, val: string) {
              return {
                async maybeSingle() {
                  if (table === 'lamplight_settings') {
                    return { data: backend.settings.find((r) => r.user_id === val) ?? null, error: null };
                  }
                  if (table === 'lamplight_entitlements') {
                    return { data: backend.entitlements.find((r) => r.user_id === val) ?? null, error: null };
                  }
                  if (table === 'app_config') {
                    return { data: backend.config.find((r) => r.key === val) ?? null, error: null };
                  }
                  return { data: null, error: null };
                },
              };
            },
            in(_col: string, vals: string[]) {
              return {
                async then(resolve: (v: { data: unknown[]; error: null }) => void) {
                  if (table === 'app_config') {
                    resolve({ data: backend.config.filter((r) => vals.includes(r.key)), error: null });
                  }
                },
              };
            },
          };
        },
        upsert(payload: Record<string, unknown>) {
          return {
            select() {
              return {
                async single() {
                  if (table === 'lamplight_settings') {
                    const userId = payload.user_id as string;
                    const idx = backend.settings.findIndex((r) => r.user_id === userId);
                    const now = new Date().toISOString();
                    const existing = idx >= 0 ? backend.settings[idx] : null;
                    const row: SettingsRow = {
                      user_id: userId,
                      enabled: false,
                      quiet_mode: false,
                      voice_preference: 'Lord',
                      tradition_hint: 'unspecified',
                      inline_suggestions: true,
                      weekly_email: false,
                      consent_decided_at: null,
                      created_at: existing?.created_at ?? now,
                      updated_at: now,
                      ...(existing ?? {}),
                      ...payload,
                    } as SettingsRow;
                    if (idx >= 0) backend.settings[idx] = row;
                    else backend.settings.push(row);
                    return { data: row, error: null };
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        delete() {
          return {
            async eq(_col: string, val: string) {
              backend.deletes.push({ table, userId: val });
              if (table === 'lamplight_settings') backend.settings = backend.settings.filter((r) => r.user_id !== val);
              if (table === 'lamplight_entitlements') backend.entitlements = backend.entitlements.filter((r) => r.user_id !== val);
              return { error: null };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe('SupabaseLamplightAdapter — settings', () => {
  let backend: Backend;
  let adapter: SupabaseLamplightAdapter;

  beforeEach(() => {
    backend = { settings: [], entitlements: [], config: [], deletes: [] };
    adapter = new SupabaseLamplightAdapter(makeClient(backend));
  });

  it('returns null when no settings row exists for the user', async () => {
    expect(await adapter.getSettings('user-1')).toBeNull();
  });

  it('returns mapped settings when a row exists', async () => {
    backend.settings.push({
      user_id: 'user-1',
      enabled: true,
      quiet_mode: false,
      voice_preference: 'Father',
      tradition_hint: 'evangelical',
      inline_suggestions: true,
      weekly_email: false,
      consent_decided_at: '2026-05-25T00:00:00Z',
      created_at: '2026-05-25T00:00:00Z',
      updated_at: '2026-05-25T00:00:00Z',
    });
    const s = await adapter.getSettings('user-1');
    expect(s).toEqual({
      userId: 'user-1',
      enabled: true,
      quietMode: false,
      voicePreference: 'Father',
      traditionHint: 'evangelical',
      inlineSuggestions: true,
      weeklyEmail: false,
      consentDecidedAt: '2026-05-25T00:00:00Z',
      createdAt: '2026-05-25T00:00:00Z',
      updatedAt: '2026-05-25T00:00:00Z',
    });
  });

  it('upserts settings with defaults on first write', async () => {
    const s = await adapter.upsertSettings('user-1', {
      enabled: true,
      voicePreference: 'Abba',
      consentDecidedAt: '2026-05-25T00:00:00Z',
    });
    expect(s.userId).toBe('user-1');
    expect(s.enabled).toBe(true);
    expect(s.voicePreference).toBe('Abba');
    expect(s.traditionHint).toBe('unspecified');
    expect(s.consentDecidedAt).toBe('2026-05-25T00:00:00Z');
    expect(backend.settings).toHaveLength(1);
  });

  it('deletes settings + entitlements rows for the user via deleteAllUserData', async () => {
    backend.settings.push({
      user_id: 'user-1', enabled: true, quiet_mode: false,
      voice_preference: 'Lord', tradition_hint: 'unspecified',
      inline_suggestions: true, weekly_email: false,
      consent_decided_at: null,
      created_at: '2026-05-25T00:00:00Z', updated_at: '2026-05-25T00:00:00Z',
    });
    backend.entitlements.push({
      user_id: 'user-1', tier: 'plus', source: 'grant',
      granted_at: '2026-05-25T00:00:00Z', expires_at: null,
    });
    await adapter.deleteAllUserData('user-1');
    expect(backend.settings).toHaveLength(0);
    expect(backend.entitlements).toHaveLength(0);
    // Foundation slice: deletes from 7 tables (most are empty today).
    const deletedTables = backend.deletes.map((d) => d.table).sort();
    expect(deletedTables).toEqual([
      'lamplight_artifacts',
      'lamplight_connections',
      'lamplight_embeddings',
      'lamplight_entitlements',
      'lamplight_jobs',
      'lamplight_settings',
      'lamplight_suggestions_log',
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/notepad/storage/supabase-lamplight-adapter.test.ts`
Expected: FAIL — "Cannot find module './supabase-lamplight-adapter'".

- [ ] **Step 3: Implement the adapter (settings methods)**

```ts
// supabase-lamplight-adapter.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LamplightAdapter,
  LamplightSettings,
  LamplightEntitlement,
  PromoConfig,
  LamplightVoice,
  LamplightTradition,
  LamplightTier,
  LamplightEntitlementSource,
} from './lamplight-adapter';

const LAMPLIGHT_USER_TABLES = [
  'lamplight_settings',
  'lamplight_entitlements',
  'lamplight_embeddings',
  'lamplight_artifacts',
  'lamplight_jobs',
  'lamplight_suggestions_log',
  'lamplight_connections',
] as const;

export class SupabaseLamplightAdapter implements LamplightAdapter {
  #client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.#client = client;
  }

  async getSettings(userId: string): Promise<LamplightSettings | null> {
    const { data, error } = await this.#client
      .from('lamplight_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? this.#mapSettings(data) : null;
  }

  async upsertSettings(
    userId: string,
    patch: Partial<Omit<LamplightSettings, 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<LamplightSettings> {
    const payload: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
    if (patch.enabled !== undefined) payload.enabled = patch.enabled;
    if (patch.quietMode !== undefined) payload.quiet_mode = patch.quietMode;
    if (patch.voicePreference !== undefined) payload.voice_preference = patch.voicePreference;
    if (patch.traditionHint !== undefined) payload.tradition_hint = patch.traditionHint;
    if (patch.inlineSuggestions !== undefined) payload.inline_suggestions = patch.inlineSuggestions;
    if (patch.weeklyEmail !== undefined) payload.weekly_email = patch.weeklyEmail;
    if (patch.consentDecidedAt !== undefined) payload.consent_decided_at = patch.consentDecidedAt;

    const { data, error } = await this.#client
      .from('lamplight_settings')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return this.#mapSettings(data);
  }

  async deleteAllUserData(userId: string): Promise<void> {
    for (const table of LAMPLIGHT_USER_TABLES) {
      const { error } = await this.#client.from(table).delete().eq('user_id', userId);
      if (error) throw error;
    }
  }

  async getEntitlement(_userId: string): Promise<LamplightEntitlement | null> {
    throw new Error('not implemented yet');
  }

  async getPromoConfig(): Promise<PromoConfig> {
    throw new Error('not implemented yet');
  }

  #mapSettings(row: Record<string, unknown>): LamplightSettings {
    return {
      userId: row.user_id as string,
      enabled: row.enabled as boolean,
      quietMode: row.quiet_mode as boolean,
      voicePreference: row.voice_preference as LamplightVoice,
      traditionHint: row.tradition_hint as LamplightTradition,
      inlineSuggestions: row.inline_suggestions as boolean,
      weeklyEmail: row.weekly_email as boolean,
      consentDecidedAt: (row.consent_decided_at as string) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  #mapEntitlement(row: Record<string, unknown>): LamplightEntitlement {
    return {
      userId: row.user_id as string,
      tier: row.tier as LamplightTier,
      source: (row.source as LamplightEntitlementSource) ?? null,
      grantedAt: (row.granted_at as string) ?? null,
      expiresAt: (row.expires_at as string) ?? null,
    };
  }
}
```

Note `#mapEntitlement` is defined now but unused until Task 7 — that's fine; suppress with a `// eslint-disable-next-line @typescript-eslint/no-unused-private-class-members` comment above it if the project's eslint flags it.

- [ ] **Step 4: Run tests — verify pass**

Run: `npx vitest run src/notepad/storage/supabase-lamplight-adapter.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/storage/supabase-lamplight-adapter.ts src/notepad/storage/supabase-lamplight-adapter.test.ts
git commit -m "feat(lamplight): SupabaseLamplightAdapter — settings methods (get/upsert/deleteAll)"
```

---

## Task 7: `SupabaseLamplightAdapter` — entitlement + promo config (TDD)

**Files:**
- Modify: `src/notepad/storage/supabase-lamplight-adapter.ts`
- Modify: `src/notepad/storage/supabase-lamplight-adapter.test.ts`

- [ ] **Step 1: Add failing tests**

Append inside the existing `describe('SupabaseLamplightAdapter — settings', …)` block, or add a sibling `describe`:

```ts
describe('SupabaseLamplightAdapter — entitlement + promo', () => {
  let backend: Backend;
  let adapter: SupabaseLamplightAdapter;

  beforeEach(() => {
    backend = { settings: [], entitlements: [], config: [], deletes: [] };
    adapter = new SupabaseLamplightAdapter(makeClient(backend));
  });

  it('returns null when no entitlement row exists', async () => {
    expect(await adapter.getEntitlement('user-1')).toBeNull();
  });

  it('returns mapped entitlement when a row exists', async () => {
    backend.entitlements.push({
      user_id: 'user-1', tier: 'plus', source: 'grant',
      granted_at: '2026-05-25T00:00:00Z', expires_at: null,
    });
    const e = await adapter.getEntitlement('user-1');
    expect(e).toEqual({
      userId: 'user-1',
      tier: 'plus',
      source: 'grant',
      grantedAt: '2026-05-25T00:00:00Z',
      expiresAt: null,
    });
  });

  it('returns { promoActive: false, promoEndsAt: null } when config rows are absent', async () => {
    expect(await adapter.getPromoConfig()).toEqual({ promoActive: false, promoEndsAt: null });
  });

  it('returns promo config values from app_config', async () => {
    backend.config.push({ key: 'lamplight_promo_active', value: true });
    backend.config.push({ key: 'lamplight_promo_ends_at', value: null });
    expect(await adapter.getPromoConfig()).toEqual({ promoActive: true, promoEndsAt: null });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run src/notepad/storage/supabase-lamplight-adapter.test.ts`
Expected: 4 new tests FAIL with "not implemented yet" or similar.

- [ ] **Step 3: Implement `getEntitlement` and `getPromoConfig`**

Replace the two stubbed methods in `supabase-lamplight-adapter.ts`:

```ts
async getEntitlement(userId: string): Promise<LamplightEntitlement | null> {
  const { data, error } = await this.#client
    .from('lamplight_entitlements')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? this.#mapEntitlement(data) : null;
}

async getPromoConfig(): Promise<PromoConfig> {
  const { data, error } = await this.#client
    .from('app_config')
    .select('key,value')
    .in('key', ['lamplight_promo_active', 'lamplight_promo_ends_at']);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ key: string; value: unknown }>;
  const promoRow = rows.find((r) => r.key === 'lamplight_promo_active');
  const endsRow = rows.find((r) => r.key === 'lamplight_promo_ends_at');
  return {
    promoActive: promoRow ? Boolean(promoRow.value) : false,
    promoEndsAt: endsRow && endsRow.value ? String(endsRow.value) : null,
  };
}
```

- [ ] **Step 4: Run tests — verify pass**

Run: `npx vitest run src/notepad/storage/supabase-lamplight-adapter.test.ts`
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/storage/supabase-lamplight-adapter.ts src/notepad/storage/supabase-lamplight-adapter.test.ts
git commit -m "feat(lamplight): SupabaseLamplightAdapter — entitlement + promo config"
```

---

## Task 8: `useLamplightSettings` hook (TDD)

**Files:**
- Create: `src/notepad/hooks/useLamplightSettings.ts`
- Create: `src/notepad/hooks/useLamplightSettings.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// useLamplightSettings.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { FakeLamplightAdapter } from '../storage/fake-lamplight-adapter';
import { useLamplightSettings } from './useLamplightSettings';

describe('useLamplightSettings', () => {
  let adapter: FakeLamplightAdapter;

  beforeEach(() => {
    adapter = new FakeLamplightAdapter();
  });

  it('returns isLoading=true initially then settings=null when no row', async () => {
    const { result } = renderHook(() => useLamplightSettings({ adapter, userId: 'user-1' }));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings).toBeNull();
  });

  it('returns existing settings when the row exists', async () => {
    await adapter.upsertSettings('user-1', { enabled: true, voicePreference: 'Father' });
    const { result } = renderHook(() => useLamplightSettings({ adapter, userId: 'user-1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings?.enabled).toBe(true);
    expect(result.current.settings?.voicePreference).toBe('Father');
  });

  it('upsert mutates the row and updates state', async () => {
    const { result } = renderHook(() => useLamplightSettings({ adapter, userId: 'user-1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.upsert({ enabled: true, voicePreference: 'Abba' });
    });
    expect(result.current.settings?.enabled).toBe(true);
    expect(result.current.settings?.voicePreference).toBe('Abba');
  });

  it('deleteAll removes the row and resets settings to null', async () => {
    await adapter.upsertSettings('user-1', { enabled: true });
    const { result } = renderHook(() => useLamplightSettings({ adapter, userId: 'user-1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.deleteAll();
    });
    expect(result.current.settings).toBeNull();
    expect(adapter.deleteAllUserDataCalls).toEqual(['user-1']);
  });

  it('returns settings=null + isLoading=false when userId is null (anonymous)', async () => {
    const { result } = renderHook(() => useLamplightSettings({ adapter, userId: null }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run src/notepad/hooks/useLamplightSettings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

```ts
// useLamplightSettings.ts
import { useEffect, useState, useCallback, useRef } from 'react';
import type { LamplightAdapter, LamplightSettings } from '../storage/lamplight-adapter';

export interface UseLamplightSettingsArgs {
  adapter: LamplightAdapter;
  userId: string | null;
}

export interface UseLamplightSettingsResult {
  isLoading: boolean;
  settings: LamplightSettings | null;
  refetch: () => Promise<void>;
  upsert: (patch: Partial<Omit<LamplightSettings, 'userId' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteAll: () => Promise<void>;
}

export function useLamplightSettings({
  adapter,
  userId,
}: UseLamplightSettingsArgs): UseLamplightSettingsResult {
  const [settings, setSettings] = useState<LamplightSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetch = useCallback(async () => {
    if (!userId) {
      setSettings(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const row = await adapter.getSettings(userId);
    if (mountedRef.current) {
      setSettings(row);
      setIsLoading(false);
    }
  }, [adapter, userId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const upsert = useCallback(
    async (patch: Partial<Omit<LamplightSettings, 'userId' | 'createdAt' | 'updatedAt'>>) => {
      if (!userId) return;
      const next = await adapter.upsertSettings(userId, patch);
      if (mountedRef.current) setSettings(next);
    },
    [adapter, userId]
  );

  const deleteAll = useCallback(async () => {
    if (!userId) return;
    await adapter.deleteAllUserData(userId);
    if (mountedRef.current) setSettings(null);
  }, [adapter, userId]);

  return { isLoading, settings, refetch: fetch, upsert, deleteAll };
}
```

- [ ] **Step 4: Run tests — verify pass**

Run: `npx vitest run src/notepad/hooks/useLamplightSettings.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/hooks/useLamplightSettings.ts src/notepad/hooks/useLamplightSettings.test.ts
git commit -m "feat(lamplight): useLamplightSettings hook"
```

---

## Task 9: `useLamplightEntitlement` hook (TDD)

**Files:**
- Create: `src/notepad/hooks/useLamplightEntitlement.ts`
- Create: `src/notepad/hooks/useLamplightEntitlement.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// useLamplightEntitlement.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { FakeLamplightAdapter } from '../storage/fake-lamplight-adapter';
import { useLamplightEntitlement } from './useLamplightEntitlement';

describe('useLamplightEntitlement', () => {
  let adapter: FakeLamplightAdapter;

  beforeEach(() => {
    adapter = new FakeLamplightAdapter();
    adapter.promo = { promoActive: true, promoEndsAt: null };
  });

  it('hasAccess() returns true for every feature while promo is active', async () => {
    const { result } = renderHook(() => useLamplightEntitlement({ adapter, userId: 'user-1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.promoActive).toBe(true);
    expect(result.current.hasAccess('today')).toBe(true);
    expect(result.current.hasAccess('weekly')).toBe(true);
    expect(result.current.hasAccess('reflections')).toBe(true);
    expect(result.current.hasAccess('inline')).toBe(true);
  });

  it('hasAccess() returns true for all features when tier=plus and promo off', async () => {
    adapter.promo = { promoActive: false, promoEndsAt: null };
    await adapter.upsertSettings('user-1', {});
    adapter.entitlements.set('user-1', {
      userId: 'user-1', tier: 'plus', source: 'subscription',
      grantedAt: '2026-05-25T00:00:00Z', expiresAt: null,
    });
    const { result } = renderHook(() => useLamplightEntitlement({ adapter, userId: 'user-1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasAccess('today')).toBe(true);
    expect(result.current.hasAccess('reflections')).toBe(true);
  });

  it('hasAccess() returns true only for today+weekly when tier=lite', async () => {
    adapter.promo = { promoActive: false, promoEndsAt: null };
    adapter.entitlements.set('user-1', {
      userId: 'user-1', tier: 'lite', source: 'subscription',
      grantedAt: '2026-05-25T00:00:00Z', expiresAt: null,
    });
    const { result } = renderHook(() => useLamplightEntitlement({ adapter, userId: 'user-1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasAccess('today')).toBe(true);
    expect(result.current.hasAccess('weekly')).toBe(true);
    expect(result.current.hasAccess('reflections')).toBe(false);
    expect(result.current.hasAccess('inline')).toBe(false);
  });

  it('hasAccess() returns false for every feature when tier=none and promo off', async () => {
    adapter.promo = { promoActive: false, promoEndsAt: null };
    const { result } = renderHook(() => useLamplightEntitlement({ adapter, userId: 'user-1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tier).toBe('none');
    expect(result.current.hasAccess('today')).toBe(false);
    expect(result.current.hasAccess('weekly')).toBe(false);
    expect(result.current.hasAccess('reflections')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run src/notepad/hooks/useLamplightEntitlement.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

```ts
// useLamplightEntitlement.ts
import { useEffect, useState, useCallback, useRef } from 'react';
import type { LamplightAdapter, LamplightTier } from '../storage/lamplight-adapter';

export type LamplightFeature = 'today' | 'weekly' | 'reflections' | 'inline';

export interface UseLamplightEntitlementArgs {
  adapter: LamplightAdapter;
  userId: string | null;
}

export interface UseLamplightEntitlementResult {
  isLoading: boolean;
  tier: LamplightTier;
  promoActive: boolean;
  hasAccess: (feature: LamplightFeature) => boolean;
}

export function useLamplightEntitlement({
  adapter,
  userId,
}: UseLamplightEntitlementArgs): UseLamplightEntitlementResult {
  const [tier, setTier] = useState<LamplightTier>('none');
  const [promoActive, setPromoActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const [promo, ent] = await Promise.all([
        adapter.getPromoConfig(),
        userId ? adapter.getEntitlement(userId) : Promise.resolve(null),
      ]);
      if (cancelled || !mountedRef.current) return;
      setPromoActive(promo.promoActive);
      setTier(ent?.tier ?? 'none');
      setIsLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [adapter, userId]);

  const hasAccess = useCallback(
    (feature: LamplightFeature) => {
      if (promoActive) return true;
      if (tier === 'plus') return true;
      if (tier === 'lite') return feature === 'today' || feature === 'weekly';
      return false;
    },
    [promoActive, tier]
  );

  return { isLoading, tier, promoActive, hasAccess };
}
```

- [ ] **Step 4: Run tests — verify pass**

Run: `npx vitest run src/notepad/hooks/useLamplightEntitlement.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/hooks/useLamplightEntitlement.ts src/notepad/hooks/useLamplightEntitlement.test.ts
git commit -m "feat(lamplight): useLamplightEntitlement hook"
```

---

## Task 10: `SignInGate` component

**Files:**
- Create: `src/notepad/components/lamplight/SignInGate.tsx`
- Create: `src/notepad/components/lamplight/SignInGate.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// SignInGate.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignInGate } from './SignInGate';

describe('SignInGate', () => {
  it('renders the waiting line, sign-in + sign-up CTAs, and a Why-sign-in link', () => {
    render(<MemoryRouter><SignInGate /></MemoryRouter>);
    expect(screen.getByText(/today's lamp is waiting for you/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/login');
    expect(screen.getByText(/why sign in\?/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src/notepad/components/lamplight/SignInGate.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```tsx
// SignInGate.tsx
import { Link } from 'react-router-dom';

export function SignInGate() {
  return (
    <div
      className="relative flex items-center justify-center min-h-[420px] px-6"
      style={{ background: 'linear-gradient(180deg, var(--plaster) 0%, var(--alabaster) 100%)' }}
    >
      {/* Blurred mockup behind the card */}
      <div className="absolute inset-0 pointer-events-none" style={{ filter: 'blur(8px)', opacity: 0.4 }}>
        <div className="p-8" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--silica)' }}>
            Today's Lamp
          </div>
          <div className="text-base leading-relaxed" style={{ color: 'var(--deep-umber)' }}>
            "You've been writing about waiting. Three notes mention Psalm 27…"
          </div>
        </div>
      </div>

      {/* Gate card */}
      <div
        className="relative z-10 max-w-sm w-full text-center px-6 py-6 rounded-lg"
        style={{
          background: 'var(--alabaster)',
          border: '1px solid var(--pale-stone)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        }}
      >
        <div className="text-2xl mb-2" aria-hidden>🕯</div>
        <h3
          className="text-base mb-1"
          style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
        >
          Today's Lamp is waiting for you.
        </h3>
        <p className="text-xs mb-4" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
          Sign in to begin.
        </p>
        <div className="flex gap-2 justify-center mb-3">
          <Link
            to="/login"
            className="px-4 py-2 text-xs rounded transition-colors"
            style={{
              background: 'var(--deep-umber)',
              color: 'var(--alabaster)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Sign in
          </Link>
          <Link
            to="/login"
            className="px-4 py-2 text-xs rounded transition-colors"
            style={{
              background: 'transparent',
              border: '1px solid var(--pale-stone)',
              color: 'var(--deep-umber)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Sign up
          </Link>
        </div>
        <a
          href="https://livepsalms.com/privacy#lamplight"
          target="_blank"
          rel="noreferrer"
          className="text-[10px] underline"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Why sign in?
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test — verify pass**

Run: `npx vitest run src/notepad/components/lamplight/SignInGate.test.tsx`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/SignInGate.tsx src/notepad/components/lamplight/SignInGate.test.tsx
git commit -m "feat(lamplight): SignInGate component"
```

---

## Task 11: `ConsentCard` component (two-step inline reveal)

**Files:**
- Create: `src/notepad/components/lamplight/ConsentCard.tsx`
- Create: `src/notepad/components/lamplight/ConsentCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// ConsentCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsentCard } from './ConsentCard';

describe('ConsentCard', () => {
  it('renders the welcome copy and both CTAs in the initial step', () => {
    render(<ConsentCard onTurnOn={vi.fn()} onMaybeLater={vi.fn()} />);
    expect(screen.getByText(/welcome the lamp/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /turn on lamplight/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /maybe later/i })).toBeInTheDocument();
  });

  it('calls onMaybeLater immediately when "Maybe later" is clicked', () => {
    const onMaybeLater = vi.fn();
    render(<ConsentCard onTurnOn={vi.fn()} onMaybeLater={onMaybeLater} />);
    fireEvent.click(screen.getByRole('button', { name: /maybe later/i }));
    expect(onMaybeLater).toHaveBeenCalledOnce();
  });

  it('reveals voice + tradition questions when "Turn on Lamplight" is clicked', () => {
    render(<ConsentCard onTurnOn={vi.fn()} onMaybeLater={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /turn on lamplight/i }));
    expect(screen.getByText(/how would you like lamplight to refer to god/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lord/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/father/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/abba/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/jesus/i)).toBeInTheDocument();
    expect(screen.getByText(/optional/i)).toBeInTheDocument();
  });

  it('calls onTurnOn with selected voice + tradition on "Continue"', () => {
    const onTurnOn = vi.fn();
    render(<ConsentCard onTurnOn={onTurnOn} onMaybeLater={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /turn on lamplight/i }));
    fireEvent.click(screen.getByLabelText(/abba/i));
    fireEvent.click(screen.getByLabelText(/catholic/i));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onTurnOn).toHaveBeenCalledWith({ voicePreference: 'Abba', traditionHint: 'catholic' });
  });

  it('uses default Lord + unspecified when continue is pressed without changing selections', () => {
    const onTurnOn = vi.fn();
    render(<ConsentCard onTurnOn={onTurnOn} onMaybeLater={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /turn on lamplight/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onTurnOn).toHaveBeenCalledWith({ voicePreference: 'Lord', traditionHint: 'unspecified' });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run src/notepad/components/lamplight/ConsentCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```tsx
// ConsentCard.tsx
import { useState } from 'react';
import type { LamplightVoice, LamplightTradition } from '../../storage/lamplight-adapter';

export interface ConsentCardProps {
  onTurnOn: (choices: { voicePreference: LamplightVoice; traditionHint: LamplightTradition }) => void;
  onMaybeLater: () => void;
}

const VOICES: LamplightVoice[] = ['Lord', 'Father', 'Abba', 'Jesus'];
const TRADITIONS: { value: LamplightTradition; label: string }[] = [
  { value: 'evangelical', label: 'Evangelical' },
  { value: 'catholic', label: 'Catholic' },
  { value: 'orthodox', label: 'Orthodox' },
  { value: 'unspecified', label: 'Skip' },
];

export function ConsentCard({ onTurnOn, onMaybeLater }: ConsentCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [voice, setVoice] = useState<LamplightVoice>('Lord');
  const [tradition, setTradition] = useState<LamplightTradition>('unspecified');

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[420px] px-6 py-10 text-center"
      style={{ background: 'var(--alabaster)' }}
    >
      <div className="text-3xl mb-3" aria-hidden>🕯</div>
      <h3
        className="text-xl mb-3"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
      >
        Welcome the lamp.
      </h3>
      <p
        className="text-sm max-w-md leading-relaxed mb-4"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        A quiet companion that draws a daily devotion from your own journey.
        It reads only your notes, cites every verse, and never trains on your data.
      </p>

      {!revealed && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="px-4 py-2 text-xs rounded"
            style={{
              background: 'var(--deep-umber)', color: 'var(--alabaster)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Turn on Lamplight
          </button>
          <button
            type="button"
            onClick={onMaybeLater}
            className="px-4 py-2 text-xs rounded"
            style={{
              background: 'transparent',
              border: '1px solid var(--pale-stone)',
              color: 'var(--deep-umber)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Maybe later
          </button>
        </div>
      )}

      {revealed && (
        <div className="w-full max-w-md mt-4 text-left">
          <p
            className="text-[11px] uppercase tracking-widest mb-2"
            style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
          >
            Optional — helps Lamplight speak in your tradition
          </p>
          <fieldset className="mb-4">
            <legend className="text-xs mb-1" style={{ color: 'var(--deep-umber)' }}>
              Tradition
            </legend>
            <div className="flex gap-3 flex-wrap">
              {TRADITIONS.map((t) => (
                <label key={t.value} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="tradition"
                    value={t.value}
                    checked={tradition === t.value}
                    onChange={() => setTradition(t.value)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mb-4">
            <legend className="text-xs mb-1" style={{ color: 'var(--deep-umber)' }}>
              How would you like Lamplight to refer to God?
            </legend>
            <div className="flex gap-3 flex-wrap">
              {VOICES.map((v) => (
                <label key={v} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="voice"
                    value={v}
                    checked={voice === v}
                    onChange={() => setVoice(v)}
                  />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            onClick={() => onTurnOn({ voicePreference: voice, traditionHint: tradition })}
            className="px-4 py-2 text-xs rounded"
            style={{
              background: 'var(--deep-umber)', color: 'var(--alabaster)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — verify pass**

Run: `npx vitest run src/notepad/components/lamplight/ConsentCard.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/ConsentCard.tsx src/notepad/components/lamplight/ConsentCard.test.tsx
git commit -m "feat(lamplight): ConsentCard with two-step inline reveal"
```

---

## Task 12: `OptedOutCard` component

**Files:**
- Create: `src/notepad/components/lamplight/OptedOutCard.tsx`
- Create: `src/notepad/components/lamplight/OptedOutCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// OptedOutCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OptedOutCard } from './OptedOutCard';

describe('OptedOutCard', () => {
  it('renders the off-state copy and a change-mind link', () => {
    render(<OptedOutCard onChangeMind={vi.fn()} />);
    expect(screen.getByText(/lamplight is off/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is being analyzed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change your mind\? turn on lamplight/i })).toBeInTheDocument();
  });

  it('calls onChangeMind when the change-mind button is clicked', () => {
    const onChangeMind = vi.fn();
    render(<OptedOutCard onChangeMind={onChangeMind} />);
    fireEvent.click(screen.getByRole('button', { name: /change your mind/i }));
    expect(onChangeMind).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src/notepad/components/lamplight/OptedOutCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```tsx
// OptedOutCard.tsx
export interface OptedOutCardProps {
  onChangeMind: () => void;
}

export function OptedOutCard({ onChangeMind }: OptedOutCardProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[420px] px-6 text-center"
      style={{ background: 'var(--alabaster)' }}
    >
      <div className="text-2xl mb-2 opacity-50" aria-hidden>🕯</div>
      <h3
        className="text-base mb-2"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)', opacity: 0.85 }}
      >
        Lamplight is off.
      </h3>
      <p
        className="text-xs mb-4"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        Your notes remain private. Nothing is being analyzed.
      </p>
      <button
        type="button"
        onClick={onChangeMind}
        className="text-xs underline"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        Change your mind? Turn on Lamplight →
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test — verify pass**

Run: `npx vitest run src/notepad/components/lamplight/OptedOutCard.test.tsx`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/OptedOutCard.tsx src/notepad/components/lamplight/OptedOutCard.test.tsx
git commit -m "feat(lamplight): OptedOutCard component"
```

---

## Task 13: `OptedInPlaceholder` component

**Files:**
- Create: `src/notepad/components/lamplight/OptedInPlaceholder.tsx`
- Create: `src/notepad/components/lamplight/OptedInPlaceholder.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// OptedInPlaceholder.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OptedInPlaceholder } from './OptedInPlaceholder';

describe('OptedInPlaceholder', () => {
  it('shows the set-up confirmation and echoes voice + tradition', () => {
    render(
      <MemoryRouter>
        <OptedInPlaceholder voicePreference="Abba" traditionHint="evangelical" />
      </MemoryRouter>
    );
    expect(screen.getByText(/you're set up/i)).toBeInTheDocument();
    expect(screen.getByText(/lamplight will appear here when ready/i)).toBeInTheDocument();
    expect(screen.getByText(/voice: abba/i)).toBeInTheDocument();
    expect(screen.getByText(/tradition: evangelical/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /edit preferences/i })).toHaveAttribute('href', '/profile');
  });

  it('renders "unspecified" tradition cleanly', () => {
    render(
      <MemoryRouter>
        <OptedInPlaceholder voicePreference="Lord" traditionHint="unspecified" />
      </MemoryRouter>
    );
    expect(screen.getByText(/tradition: unspecified/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src/notepad/components/lamplight/OptedInPlaceholder.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```tsx
// OptedInPlaceholder.tsx
import { Link } from 'react-router-dom';
import type { LamplightVoice, LamplightTradition } from '../../storage/lamplight-adapter';

export interface OptedInPlaceholderProps {
  voicePreference: LamplightVoice;
  traditionHint: LamplightTradition;
}

export function OptedInPlaceholder({
  voicePreference,
  traditionHint,
}: OptedInPlaceholderProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[420px] px-6 text-center"
      style={{ background: 'var(--alabaster)' }}
    >
      <div className="text-3xl mb-3" aria-hidden>🕯</div>
      <h3
        className="text-base mb-2"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
      >
        You're set up.
      </h3>
      <p
        className="text-xs mb-3"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        Lamplight will appear here when ready.
      </p>
      <p
        className="text-[11px] mb-4"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif', opacity: 0.7 }}
      >
        Voice: <em>{voicePreference}</em> · Tradition: <em>{traditionHint}</em>
      </p>
      <Link
        to="/profile"
        className="text-[11px] underline"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        Edit preferences →
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Run test — verify pass**

Run: `npx vitest run src/notepad/components/lamplight/OptedInPlaceholder.test.tsx`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/OptedInPlaceholder.tsx src/notepad/components/lamplight/OptedInPlaceholder.test.tsx
git commit -m "feat(lamplight): OptedInPlaceholder component"
```

---

## Task 14: `PaywallCard` component

**Files:**
- Create: `src/notepad/components/lamplight/PaywallCard.tsx`
- Create: `src/notepad/components/lamplight/PaywallCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// PaywallCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaywallCard } from './PaywallCard';

describe('PaywallCard', () => {
  it('renders the promo-ended copy and a contact link', () => {
    render(<PaywallCard />);
    expect(screen.getByText(/lamplight is no longer included free/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contact us for access/i })).toHaveAttribute('href', '/contact');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src/notepad/components/lamplight/PaywallCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```tsx
// PaywallCard.tsx
import { Link } from 'react-router-dom';

export function PaywallCard() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[420px] px-6 text-center"
      style={{ background: 'var(--alabaster)' }}
    >
      <div className="text-2xl mb-3" aria-hidden>🕯</div>
      <p
        className="text-sm max-w-sm mb-4"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        Lamplight is no longer included free.
      </p>
      <Link
        to="/contact"
        className="text-xs underline"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        Contact us for access
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Run test — verify pass**

Run: `npx vitest run src/notepad/components/lamplight/PaywallCard.test.tsx`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/PaywallCard.tsx src/notepad/components/lamplight/PaywallCard.test.tsx
git commit -m "feat(lamplight): PaywallCard placeholder (reachable when promo flag flips)"
```

---

## Task 15: `LamplightTabPanel` — state branching container

**Files:**
- Create: `src/notepad/components/lamplight/LamplightTabPanel.tsx`
- Create: `src/notepad/components/lamplight/LamplightTabPanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// LamplightTabPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FakeLamplightAdapter } from '../../storage/fake-lamplight-adapter';
import { LamplightTabPanel } from './LamplightTabPanel';

vi.mock('@/auth/context/useAuthSession', () => ({
  useAuthSession: vi.fn(),
}));
import { useAuthSession } from '@/auth/context/useAuthSession';

const useAuthSessionMock = useAuthSession as unknown as ReturnType<typeof vi.fn>;

function renderPanel(adapter: FakeLamplightAdapter) {
  return render(
    <MemoryRouter>
      <LamplightTabPanel lamplightAdapter={adapter} />
    </MemoryRouter>
  );
}

describe('LamplightTabPanel', () => {
  let adapter: FakeLamplightAdapter;

  beforeEach(() => {
    adapter = new FakeLamplightAdapter();
    useAuthSessionMock.mockReturnValue({ user: null });
  });

  it('shows SignInGate for anonymous users', async () => {
    renderPanel(adapter);
    await waitFor(() => {
      expect(screen.getByText(/today's lamp is waiting for you/i)).toBeInTheDocument();
    });
  });

  it('shows ConsentCard for signed-in users with no settings row', async () => {
    useAuthSessionMock.mockReturnValue({ user: { id: 'user-1' } });
    renderPanel(adapter);
    await waitFor(() => {
      expect(screen.getByText(/welcome the lamp/i)).toBeInTheDocument();
    });
  });

  it('shows OptedOutCard for signed-in users with enabled=false', async () => {
    useAuthSessionMock.mockReturnValue({ user: { id: 'user-1' } });
    await adapter.upsertSettings('user-1', {
      enabled: false,
      consentDecidedAt: new Date().toISOString(),
    });
    renderPanel(adapter);
    await waitFor(() => {
      expect(screen.getByText(/lamplight is off/i)).toBeInTheDocument();
    });
  });

  it('shows OptedInPlaceholder for signed-in users with enabled=true while promo is active', async () => {
    useAuthSessionMock.mockReturnValue({ user: { id: 'user-1' } });
    await adapter.upsertSettings('user-1', {
      enabled: true,
      voicePreference: 'Father',
      traditionHint: 'evangelical',
      consentDecidedAt: new Date().toISOString(),
    });
    renderPanel(adapter);
    await waitFor(() => {
      expect(screen.getByText(/you're set up/i)).toBeInTheDocument();
      expect(screen.getByText(/voice: father/i)).toBeInTheDocument();
    });
  });

  it('shows PaywallCard for opted-in users when promo is off and tier=none', async () => {
    useAuthSessionMock.mockReturnValue({ user: { id: 'user-1' } });
    adapter.promo = { promoActive: false, promoEndsAt: null };
    await adapter.upsertSettings('user-1', {
      enabled: true,
      consentDecidedAt: new Date().toISOString(),
    });
    renderPanel(adapter);
    await waitFor(() => {
      expect(screen.getByText(/lamplight is no longer included free/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run src/notepad/components/lamplight/LamplightTabPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the container**

```tsx
// LamplightTabPanel.tsx
import { useAuthSession } from '@/auth/context/useAuthSession';
import type { LamplightAdapter } from '../../storage/lamplight-adapter';
import { useLamplightSettings } from '../../hooks/useLamplightSettings';
import { useLamplightEntitlement } from '../../hooks/useLamplightEntitlement';
import { SignInGate } from './SignInGate';
import { ConsentCard } from './ConsentCard';
import { OptedOutCard } from './OptedOutCard';
import { OptedInPlaceholder } from './OptedInPlaceholder';
import { PaywallCard } from './PaywallCard';

export interface LamplightTabPanelProps {
  lamplightAdapter: LamplightAdapter;
}

export function LamplightTabPanel({ lamplightAdapter }: LamplightTabPanelProps) {
  const { user } = useAuthSession();
  const userId = user?.id ?? null;

  const settingsState = useLamplightSettings({ adapter: lamplightAdapter, userId });
  const entitlementState = useLamplightEntitlement({ adapter: lamplightAdapter, userId });

  if (!user) return <SignInGate />;

  if (settingsState.isLoading || entitlementState.isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-[420px]"
        style={{ background: 'var(--alabaster)' }}
      >
        <p
          className="text-xs"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Loading…
        </p>
      </div>
    );
  }

  if (settingsState.settings === null) {
    return (
      <ConsentCard
        onTurnOn={({ voicePreference, traditionHint }) =>
          settingsState.upsert({
            enabled: true,
            voicePreference,
            traditionHint,
            consentDecidedAt: new Date().toISOString(),
          })
        }
        onMaybeLater={() =>
          settingsState.upsert({
            enabled: false,
            consentDecidedAt: new Date().toISOString(),
          })
        }
      />
    );
  }

  if (!settingsState.settings.enabled) {
    return <OptedOutCard onChangeMind={() => settingsState.deleteAll()} />;
  }

  // Opted-in branch — entitlement gates content (paywall placeholder only).
  if (!entitlementState.hasAccess('today')) {
    return <PaywallCard />;
  }

  return (
    <OptedInPlaceholder
      voicePreference={settingsState.settings.voicePreference}
      traditionHint={settingsState.settings.traditionHint}
    />
  );
}
```

- [ ] **Step 4: Run tests — verify pass**

Run: `npx vitest run src/notepad/components/lamplight/LamplightTabPanel.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/LamplightTabPanel.tsx src/notepad/components/lamplight/LamplightTabPanel.test.tsx
git commit -m "feat(lamplight): LamplightTabPanel — 5-way state branching"
```

---

## Task 16: Wire `LamplightTabPanel` into the notepad tab strip

**Files:**
- Modify: `src/components/sections/Notepad.tsx`

- [ ] **Step 1: Add the `'lamplight'` tab value and adapter wiring**

Modify line 21 (the `activeTab` state):

```ts
const [activeTab, setActiveTab] = useState<'content' | 'backlinks' | 'info' | 'lamplight'>('content');
```

After the existing imports (around line 13), add:

```ts
import { LamplightTabPanel } from '@/notepad/components/lamplight/LamplightTabPanel';
import { SupabaseLamplightAdapter } from '@/notepad/storage/supabase-lamplight-adapter';
import { supabase } from '@/lib/supabase';
import { useMemo } from 'react';
```

(Adjust the `useMemo` import to merge with the existing `useState`/`useCallback` import line.)

Inside `NotepadWorkspace`, after the existing `const { user, adapter } = useAuthSession();` line, add:

```ts
const lamplightAdapter = useMemo(
  () => (supabase ? new SupabaseLamplightAdapter(supabase) : null),
  []
);
```

Replace the tab strip render at lines 121–138 with:

```tsx
{/* Tab Bar */}
<div
  className="flex items-center gap-0 border-b shrink-0"
  style={{ borderColor: 'var(--pale-stone)' }}
>
  {(['content', 'backlinks', 'info'] as const).map((tab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className="px-5 py-3 text-[11px] font-medium tracking-wider transition-colors relative"
      style={{
        color: activeTab === tab ? 'var(--deep-umber)' : 'var(--silica)',
        fontFamily: 'Outfit, sans-serif',
      }}
    >
      {tab.charAt(0).toUpperCase() + tab.slice(1)}
      {activeTab === tab && (
        <div
          className="absolute bottom-0 left-5 right-5 h-px"
          style={{ background: 'var(--deep-umber)' }}
        />
      )}
    </button>
  ))}
  {/* Separator before Lamplight */}
  <span
    aria-hidden
    className="mx-2"
    style={{ color: 'var(--silica)', opacity: 0.3 }}
  >
    |
  </span>
  <button
    onClick={() => setActiveTab('lamplight')}
    className="px-5 py-3 text-[11px] font-medium tracking-wider transition-colors relative"
    style={{
      color: activeTab === 'lamplight' ? 'var(--deep-umber)' : '#b8843a',
      fontFamily: 'Outfit, sans-serif',
    }}
  >
    🕯 Lamplight
    {activeTab === 'lamplight' && (
      <div
        className="absolute bottom-0 left-5 right-5 h-px"
        style={{ background: 'var(--deep-umber)' }}
      />
    )}
  </button>
</div>
```

Replace the tab content render at lines 141–143 with:

```tsx
{/* Tab Content */}
{activeTab === 'content' && <NotepadEditor />}
{activeTab === 'backlinks' && <BacklinksPanel />}
{activeTab === 'info' && <InfoPanel />}
{activeTab === 'lamplight' && lamplightAdapter && (
  <LamplightTabPanel lamplightAdapter={lamplightAdapter} />
)}
{activeTab === 'lamplight' && !lamplightAdapter && (
  <div
    className="flex items-center justify-center min-h-[420px]"
    style={{ background: 'var(--alabaster)' }}
  >
    <p className="text-xs" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
      Lamplight unavailable — Supabase not configured.
    </p>
  </div>
)}
```

- [ ] **Step 2: Verify lint + typecheck**

Run: `npx tsc -b && npx eslint src/components/sections/Notepad.tsx`
Expected: exit 0, no errors.

- [ ] **Step 3: Run the full test suite to make sure existing tests still pass**

Run: `npx vitest run`
Expected: all tests pass. Lamplight tests pass and no notepad-section tests regress.

- [ ] **Step 4: Manual browser check**

Start dev server: `npm run dev`
Open the notepad in a browser. Verify:
- The strip shows `Content · Backlinks · Info | 🕯 Lamplight`.
- Clicking each existing tab renders its old content (no regression).
- Clicking Lamplight renders SignInGate when anonymous, ConsentCard when signed in fresh.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/Notepad.tsx
git commit -m "feat(lamplight): wire LamplightTabPanel as fourth notepad tab"
```

---

## Task 17: `LamplightSettingsSection` in the profile page

**Files:**
- Create: `src/auth/components/LamplightSettingsSection.tsx`
- Create: `src/auth/components/LamplightSettingsSection.test.tsx`
- Modify: `src/auth/ProfilePage.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// LamplightSettingsSection.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FakeLamplightAdapter } from '@/notepad/storage/fake-lamplight-adapter';
import { LamplightSettingsSection } from './LamplightSettingsSection';

describe('LamplightSettingsSection', () => {
  let adapter: FakeLamplightAdapter;

  beforeEach(() => {
    adapter = new FakeLamplightAdapter();
  });

  it('renders disabled controls + master-toggle off when no settings row', async () => {
    render(<LamplightSettingsSection adapter={adapter} userId="user-1" />);
    await waitFor(() => expect(screen.getByLabelText(/lamplight on/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/lamplight on/i)).not.toBeChecked();
  });

  it('upserts settings when the master toggle is flipped on', async () => {
    render(<LamplightSettingsSection adapter={adapter} userId="user-1" />);
    await waitFor(() => screen.getByLabelText(/lamplight on/i));
    fireEvent.click(screen.getByLabelText(/lamplight on/i));
    await waitFor(() => {
      const row = adapter.settings.get('user-1');
      expect(row?.enabled).toBe(true);
    });
  });

  it('updates voice preference via the dropdown', async () => {
    await adapter.upsertSettings('user-1', { enabled: true });
    render(<LamplightSettingsSection adapter={adapter} userId="user-1" />);
    await waitFor(() => screen.getByLabelText(/voice preference/i));
    fireEvent.change(screen.getByLabelText(/voice preference/i), { target: { value: 'Abba' } });
    await waitFor(() => {
      expect(adapter.settings.get('user-1')?.voicePreference).toBe('Abba');
    });
  });

  it('opens confirm + calls deleteAllUserData when Forget is confirmed', async () => {
    await adapter.upsertSettings('user-1', { enabled: true });
    render(<LamplightSettingsSection adapter={adapter} userId="user-1" />);
    await waitFor(() => screen.getByRole('button', { name: /forget my lamplight history/i }));
    fireEvent.click(screen.getByRole('button', { name: /forget my lamplight history/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^delete everything$/i }));
    await waitFor(() => {
      expect(adapter.deleteAllUserDataCalls).toEqual(['user-1']);
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run src/auth/components/LamplightSettingsSection.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the section**

```tsx
// LamplightSettingsSection.tsx
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type {
  LamplightAdapter,
  LamplightVoice,
  LamplightTradition,
} from '@/notepad/storage/lamplight-adapter';
import { useLamplightSettings } from '@/notepad/hooks/useLamplightSettings';

export interface LamplightSettingsSectionProps {
  adapter: LamplightAdapter;
  userId: string;
}

const VOICES: LamplightVoice[] = ['Lord', 'Father', 'Abba', 'Jesus'];
const TRADITIONS: LamplightTradition[] = ['evangelical', 'catholic', 'orthodox', 'unspecified'];

export function LamplightSettingsSection({ adapter, userId }: LamplightSettingsSectionProps) {
  const { settings, upsert, deleteAll, isLoading } = useLamplightSettings({ adapter, userId });
  const [confirmTurnOff, setConfirmTurnOff] = useState(false);

  if (isLoading) {
    return (
      <div
        className="px-6 py-6 rounded-xl"
        style={{ background: 'var(--alabaster)', border: '1px solid var(--pale-stone)' }}
      >
        <p className="text-xs" style={{ color: 'var(--silica)' }}>Loading Lamplight settings…</p>
      </div>
    );
  }

  const enabled = settings?.enabled ?? false;
  const voice = settings?.voicePreference ?? 'Lord';
  const tradition = settings?.traditionHint ?? 'unspecified';

  const handleToggle = async (next: boolean) => {
    if (!next && enabled) {
      setConfirmTurnOff(true);
      return;
    }
    await upsert({
      enabled: next,
      consentDecidedAt: new Date().toISOString(),
    });
  };

  const handleConfirmTurnOff = async () => {
    await upsert({ enabled: false });
    setConfirmTurnOff(false);
  };

  return (
    <div
      className="px-6 py-6 rounded-xl"
      style={{ background: 'var(--alabaster)', border: '1px solid var(--pale-stone)' }}
    >
      <h3
        className="text-sm mb-4"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
      >
        Lamplight
      </h3>

      <label className="flex items-center gap-2 mb-4 text-xs cursor-pointer">
        <input
          type="checkbox"
          aria-label="Lamplight on"
          checked={enabled}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <span style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
          Lamplight on
        </span>
      </label>

      <label className="block text-xs mb-1" htmlFor="lamplight-voice" style={{ color: 'var(--silica)' }}>
        Voice preference
      </label>
      <select
        id="lamplight-voice"
        aria-label="Voice preference"
        value={voice}
        disabled={!enabled}
        onChange={(e) => upsert({ voicePreference: e.target.value as LamplightVoice })}
        className="block w-full mb-4 px-3 py-2 text-xs rounded"
        style={{
          background: 'var(--plaster)', color: 'var(--deep-umber)',
          border: '1px solid var(--pale-stone)',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>

      <label className="block text-xs mb-1" htmlFor="lamplight-tradition" style={{ color: 'var(--silica)' }}>
        Tradition hint
      </label>
      <select
        id="lamplight-tradition"
        aria-label="Tradition hint"
        value={tradition}
        disabled={!enabled}
        onChange={(e) => upsert({ traditionHint: e.target.value as LamplightTradition })}
        className="block w-full mb-6 px-3 py-2 text-xs rounded"
        style={{
          background: 'var(--plaster)', color: 'var(--deep-umber)',
          border: '1px solid var(--pale-stone)',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        {TRADITIONS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="text-xs"
            style={{ color: '#b04040', fontFamily: 'Outfit, sans-serif' }}
          >
            Forget my Lamplight history
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete every Lamplight record?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes every Lamplight record we have for your account — settings,
              entitlements, embeddings, artifacts, jobs, suggestions, and connections.
              Your notes are not touched. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteAll()}>
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmTurnOff} onOpenChange={setConfirmTurnOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn Lamplight off?</AlertDialogTitle>
            <AlertDialogDescription>
              Lamplight will stop reading new notes. Your existing artifacts are preserved
              — you can turn it back on anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmTurnOff()}>
              Turn off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 4: Wire into `ProfilePage.tsx`**

Inside `ProfilePage`, locate a structural section break (e.g. just before the "Account actions" / sign-out region — search the file for the existing tier display or `accountActions` block). Import the new section near the existing imports:

```tsx
import { LamplightSettingsSection } from './components/LamplightSettingsSection';
import { SupabaseLamplightAdapter } from '@/notepad/storage/supabase-lamplight-adapter';
import { supabase } from '@/lib/supabase';
import { useMemo } from 'react';
```

After the existing `const { user, loading, session } = useAuthSession();` block, add:

```tsx
const lamplightAdapter = useMemo(
  () => (supabase ? new SupabaseLamplightAdapter(supabase) : null),
  []
);
```

In the rendered JSX, between the existing profile-edit block and the destructive actions, insert:

```tsx
{user && lamplightAdapter && (
  <LamplightSettingsSection adapter={lamplightAdapter} userId={user.id} />
)}
```

- [ ] **Step 5: Run tests — verify all pass**

Run: `npx vitest run src/auth/components/LamplightSettingsSection.test.tsx`
Expected: 4 tests pass.

Then full suite: `npx vitest run`
Expected: all pass.

- [ ] **Step 6: Manual browser check**

Restart dev server if needed: `npm run dev`. Sign in. Visit `/profile`. Verify:
- Lamplight section renders with master toggle off.
- Flipping on → confirm dialog is NOT shown (no `enabled=true` previously), settings row created, voice + tradition dropdowns become enabled.
- Flipping off → confirm dialog appears, Cancel keeps it on, Turn off persists `enabled=false`.
- Forget button → confirm dialog appears, Delete everything → settings row gone, master toggle returns to off.

- [ ] **Step 7: Commit**

```bash
git add src/auth/components/LamplightSettingsSection.tsx src/auth/components/LamplightSettingsSection.test.tsx src/auth/ProfilePage.tsx
git commit -m "feat(lamplight): Lamplight section in profile (toggle + voice + tradition + forget)"
```

---

## Task 18: RLS isolation integration test

**Files:**
- Create: `src/notepad/storage/lamplight-rls.test.ts`

This test verifies real RLS behaviour against a live local Supabase instance. Skip the file gracefully when env vars are missing so CI on environments without Supabase doesn't error.

- [ ] **Step 1: Write the integration test**

```ts
// lamplight-rls.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SupabaseLamplightAdapter } from './supabase-lamplight-adapter';

const SUPABASE_URL = process.env.SUPABASE_TEST_URL;
const SUPABASE_ANON = process.env.SUPABASE_TEST_ANON_KEY;
const USER_A_EMAIL = process.env.SUPABASE_TEST_USER_A_EMAIL;
const USER_A_PASS = process.env.SUPABASE_TEST_USER_A_PASS;
const USER_B_EMAIL = process.env.SUPABASE_TEST_USER_B_EMAIL;
const USER_B_PASS = process.env.SUPABASE_TEST_USER_B_PASS;

const haveEnv =
  SUPABASE_URL && SUPABASE_ANON && USER_A_EMAIL && USER_A_PASS && USER_B_EMAIL && USER_B_PASS;

const maybeDescribe = haveEnv ? describe : describe.skip;

async function signedClient(email: string, password: string): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(SUPABASE_URL!, SUPABASE_ANON!);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client, userId: data.user!.id };
}

maybeDescribe('Lamplight RLS isolation (integration)', () => {
  let userA: { client: SupabaseClient; userId: string };
  let userB: { client: SupabaseClient; userId: string };

  beforeAll(async () => {
    userA = await signedClient(USER_A_EMAIL!, USER_A_PASS!);
    userB = await signedClient(USER_B_EMAIL!, USER_B_PASS!);
  });

  it("user B cannot read user A's lamplight_settings", async () => {
    const adapterA = new SupabaseLamplightAdapter(userA.client);
    await adapterA.upsertSettings(userA.userId, { enabled: true, voicePreference: 'Father' });

    const adapterB = new SupabaseLamplightAdapter(userB.client);
    const leaked = await adapterB.getSettings(userA.userId);
    expect(leaked).toBeNull();
  });

  it("user B cannot insert a lamplight_settings row impersonating user A", async () => {
    const adapterB = new SupabaseLamplightAdapter(userB.client);
    await expect(
      adapterB.upsertSettings(userA.userId, { enabled: true })
    ).rejects.toThrow();
  });

  it("getPromoConfig is readable by all signed-in users", async () => {
    const adapterB = new SupabaseLamplightAdapter(userB.client);
    const promo = await adapterB.getPromoConfig();
    expect(typeof promo.promoActive).toBe('boolean');
  });
});
```

- [ ] **Step 2: Document the env setup (no commit yet)**

Set up the local environment. Either:
- Use `supabase start` then create two test users via the dashboard or `supabase db psql` and set the env vars in your shell, OR
- Skip this test in CI by leaving the env vars unset (the test auto-skips).

For one-time local verification, set:

```bash
export SUPABASE_TEST_URL="http://localhost:54321"
export SUPABASE_TEST_ANON_KEY="<anon-key-from-supabase-status>"
export SUPABASE_TEST_USER_A_EMAIL="test-a@example.com"
export SUPABASE_TEST_USER_A_PASS="…"
export SUPABASE_TEST_USER_B_EMAIL="test-b@example.com"
export SUPABASE_TEST_USER_B_PASS="…"
```

- [ ] **Step 3: Run the test locally**

Run: `npx vitest run src/notepad/storage/lamplight-rls.test.ts`
Expected (with env): 3 tests pass.
Expected (without env): 3 tests skipped.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/storage/lamplight-rls.test.ts
git commit -m "test(lamplight): RLS isolation integration test (env-gated; auto-skips in CI without creds)"
```

---

## Task 19: Manual end-to-end smoke (no commit)

This is the human-eyes acceptance check. Run before declaring the feature done.

- [ ] **Step 1: Reset to a clean local DB**

Run: `supabase db reset`
Expected: clean DB with migrations 001–010 applied.

- [ ] **Step 2: Start dev server**

Run: `npm run dev`
Open the URL in a browser. Use a private window so cookies are fresh.

- [ ] **Step 3: Anonymous flow**

Navigate to `/notepad/notes`. Click the `🕯 Lamplight` tab.
Expected: SignInGate renders. Sign in / Sign up buttons link to `/login`.

- [ ] **Step 4: Signup → consent**

Sign up a fresh user. Verify routing lands you on `/notepad/notes`. Click `🕯 Lamplight`.
Expected: ConsentCard renders ("Welcome the lamp.").

- [ ] **Step 5: Maybe later**

Click "Maybe later".
Expected: OptedOutCard renders ("Lamplight is off."). DB check: `lamplight_settings` row exists with `enabled=false`.

- [ ] **Step 6: Change mind**

Click "Change your mind? Turn on Lamplight →".
Expected: ConsentCard returns. DB check: `lamplight_settings` row deleted.

- [ ] **Step 7: Turn on with prefs**

Click "Turn on Lamplight". Pick `Father` voice + `Evangelical` tradition. Click Continue.
Expected: OptedInPlaceholder renders. Echoes "Voice: Father · Tradition: evangelical". DB check: settings row exists with those prefs + `enabled=true` + `consent_decided_at` set.

- [ ] **Step 8: Profile settings round-trip**

Visit `/profile`. Verify Lamplight section shows toggle on, voice = Father, tradition = evangelical. Change voice to `Abba`. Verify DB row updated.

- [ ] **Step 9: Forget my Lamplight history**

Click Forget → Delete everything. Confirm.
Expected: Settings reset. Tab returns to ConsentCard. DB check: all `lamplight_*` rows for the user are gone (including the entitlements row if any existed).

- [ ] **Step 10: Paywall sanity check**

In `supabase db psql`:

```sql
UPDATE public.app_config SET value = 'false'::jsonb WHERE key = 'lamplight_promo_active';
```

Refresh the browser. Opt in again → expect `PaywallCard` instead of `OptedInPlaceholder`.

Restore: `UPDATE public.app_config SET value = 'true'::jsonb WHERE key = 'lamplight_promo_active';`

- [ ] **Step 11: Existing tab regression**

Click Content / Backlinks / Info. Verify each renders normally — no regression from the tab strip edit.

If every step passes, the Foundation slice is done. No commit for this task — it's a checklist.

---

## Self-Review (post-plan)

Run this before handing off to execution.

**Spec coverage** — each spec section maps to a task:

- § Database → Tasks 1, 2, 3.
- § Adapter layer → Tasks 4, 5, 6, 7.
- § UI surfaces (5 components) → Tasks 10, 11, 12, 13, 14, 15.
- § Tab strip integration → Task 16.
- § Onboarding nudge (no auto-routing) → enforced by absence of any task that adds routing.
- § State transitions → Task 15 implements the branching exactly; Task 19 verifies in the browser.
- § Acceptance criteria 1–10 → all covered: Tasks 1-3 (#1), Task 19 step 3 (#2), Task 19 steps 4-7 (#3-4), Task 17 (#5-6), Task 18 (#7), Task 19 step 10 (#8), Tasks 1-17 lint/typecheck/test (#9), Task 19 step 11 (#10).
- § Settings panel scope → Task 17 ships master toggle + voice + tradition + Forget. Quiet Mode / inline-suggestions / weekly-email deliberately omitted.

**Placeholder scan** — no TBDs, no "implement later", no "add appropriate error handling". Each step has exact code.

**Type consistency** — `LamplightSettings`, `LamplightVoice`, `LamplightTradition`, `LamplightTier`, `LamplightFeature`, `LamplightAdapter` are defined once (Task 4) and reused consistently (Tasks 5-17). Method names match across files: `getSettings`, `upsertSettings`, `deleteAllUserData`, `getEntitlement`, `getPromoConfig`, `hasAccess`.

If you find a spec requirement with no task during execution, stop and add the task.
