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
