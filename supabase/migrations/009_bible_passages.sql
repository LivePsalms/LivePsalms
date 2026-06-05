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
