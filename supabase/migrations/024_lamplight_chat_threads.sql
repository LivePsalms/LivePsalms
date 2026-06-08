-- supabase/migrations/024_lamplight_chat_threads.sql
-- Bible-study chat: one thread per (user, passage), with an ordered message log.
-- Owner-only RLS mirrors lamplight_artifacts (auth.uid() = user_id).

create table public.lamplight_chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book text not null,
  chapter integer not null,
  passage_ref text not null,           -- "{book}.{chapter}", e.g. "jhn.10"
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, passage_ref)
);

alter table public.lamplight_chat_threads enable row level security;

create policy "Users can view own chat_threads"
  on public.lamplight_chat_threads for select using (auth.uid() = user_id);
create policy "Users can insert own chat_threads"
  on public.lamplight_chat_threads for insert with check (auth.uid() = user_id);
create policy "Users can update own chat_threads"
  on public.lamplight_chat_threads for update using (auth.uid() = user_id);
create policy "Users can delete own chat_threads"
  on public.lamplight_chat_threads for delete using (auth.uid() = user_id);

create table public.lamplight_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.lamplight_chat_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index lamplight_chat_messages_thread_created
  on public.lamplight_chat_messages (thread_id, created_at);

alter table public.lamplight_chat_messages enable row level security;

create policy "Users can view own chat_messages"
  on public.lamplight_chat_messages for select using (auth.uid() = user_id);
create policy "Users can insert own chat_messages"
  on public.lamplight_chat_messages for insert with check (auth.uid() = user_id);
create policy "Users can delete own chat_messages"
  on public.lamplight_chat_messages for delete using (auth.uid() = user_id);
