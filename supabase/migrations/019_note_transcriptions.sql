-- 019_note_transcriptions.sql
-- Handwriting transcription provenance + private scan image bucket.

create table if not exists note_transcriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  note_id uuid references notes(id) on delete set null,   -- set when saved to a note
  image_key text not null,            -- note-scans/{user_id}/{uuid}.jpg
  raw_transcription text not null,    -- model output, never mutated → eval set
  confidence numeric,
  uncertain_words jsonb not null default '[]'::jsonb,
  verse_flags jsonb not null default '[]'::jsonb,
  model text,
  status text not null default 'transcribed',  -- 'transcribed' | 'saved'  (discard deletes the row)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists note_transcriptions_user_idx on note_transcriptions(user_id);
create index if not exists note_transcriptions_note_idx on note_transcriptions(note_id);

alter table note_transcriptions enable row level security;

create policy "Users select own transcriptions"
  on note_transcriptions for select using (auth.uid() = user_id);
create policy "Users insert own transcriptions"
  on note_transcriptions for insert with check (auth.uid() = user_id);
create policy "Users update own transcriptions"
  on note_transcriptions for update using (auth.uid() = user_id);
create policy "Users delete own transcriptions"
  on note_transcriptions for delete using (auth.uid() = user_id);

-- Private bucket for original scanned pages (sensitive personal journal content).
insert into storage.buckets (id, name, public)
values ('note-scans', 'note-scans', false)
on conflict (id) do nothing;

create policy "Users upload own scans"
  on storage.objects for insert
  with check (
    bucket_id = 'note-scans' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users read own scans"
  on storage.objects for select
  using (
    bucket_id = 'note-scans' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users update own scans"
  on storage.objects for update
  using (
    bucket_id = 'note-scans' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users delete own scans"
  on storage.objects for delete
  using (
    bucket_id = 'note-scans' and (storage.foldername(name))[1] = auth.uid()::text
  );
