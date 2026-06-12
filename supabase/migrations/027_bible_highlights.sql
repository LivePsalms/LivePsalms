-- supabase/migrations/027_bible_highlights.sql
-- Per-user whole-verse Bible highlights. verse_id matches bible_passages ids
-- (OSIS book + chapter + verse, e.g. 'jhn.1.1'); swatch_id is a style-asset id
-- from the highlight palette (e.g. 'highlight-03'). Owner-only RLS mirrors
-- lamplight_chat_threads (auth.uid() = user_id).
create table if not exists public.bible_highlights (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  verse_id   text not null,
  swatch_id  text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, verse_id)
);

-- Fast lookup of a single chapter's highlights for a user (prefix scan on verse_id).
create index if not exists bible_highlights_user_verse_idx
  on public.bible_highlights (user_id, verse_id text_pattern_ops);

alter table public.bible_highlights enable row level security;

create policy "Users can view own bible_highlights"
  on public.bible_highlights for select using (auth.uid() = user_id);
create policy "Users can insert own bible_highlights"
  on public.bible_highlights for insert with check (auth.uid() = user_id);
create policy "Users can update own bible_highlights"
  on public.bible_highlights for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own bible_highlights"
  on public.bible_highlights for delete using (auth.uid() = user_id);
