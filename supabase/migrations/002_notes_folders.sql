-- Folders table
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  parent_id uuid references public.folders(id) on delete set null,
  "order" integer not null default 0,
  icon text,
  color text,
  created_at timestamptz not null default now()
);

alter table public.folders enable row level security;

create policy "Users can view own folders"
  on public.folders for select using (auth.uid() = user_id);
create policy "Users can insert own folders"
  on public.folders for insert with check (auth.uid() = user_id);
create policy "Users can update own folders"
  on public.folders for update using (auth.uid() = user_id);
create policy "Users can delete own folders"
  on public.folders for delete using (auth.uid() = user_id);

-- Notes table
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled',
  content text not null default '',
  folder_id uuid references public.folders(id) on delete set null,
  type text not null default 'devotion' check (type in ('devotion', 'sermon', 'theme')),
  tags text[] not null default '{}',
  word_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

create policy "Users can view own notes"
  on public.notes for select using (auth.uid() = user_id);
create policy "Users can insert own notes"
  on public.notes for insert with check (auth.uid() = user_id);
create policy "Users can update own notes"
  on public.notes for update using (auth.uid() = user_id);
create policy "Users can delete own notes"
  on public.notes for delete using (auth.uid() = user_id);
