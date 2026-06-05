-- Newsletter subscribers: insert-only from the client. No SELECT/UPDATE/DELETE
-- policies — reading is service-role only. Unique email constraint means
-- duplicate submissions surface as Postgres 23505, which the client maps to
-- a friendly "you're already in" success state.
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text,
  created_at timestamptz not null default now(),
  unique (email)
);

alter table public.newsletter_subscribers enable row level security;

create policy "Anyone can subscribe"
  on public.newsletter_subscribers for insert
  to anon, authenticated
  with check (true);
