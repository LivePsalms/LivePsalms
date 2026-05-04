-- Profiles table: extends auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  avatar_url text,
  note_count integer not null default 0,
  highest_note_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
