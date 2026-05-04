-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update note_count and highest_note_count when notes change
create or replace function public.update_note_count()
returns trigger as $$
declare
  target_user_id uuid;
  new_count integer;
begin
  if tg_op = 'DELETE' then
    target_user_id := old.user_id;
  else
    target_user_id := new.user_id;
  end if;

  select count(*) into new_count
  from public.notes
  where user_id = target_user_id and word_count >= 20;

  update public.profiles
  set
    note_count = new_count,
    highest_note_count = greatest(highest_note_count, new_count),
    updated_at = now()
  where id = target_user_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_note_change
  after insert or update or delete on public.notes
  for each row execute function public.update_note_count();

-- Auto-update updated_at on notes
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger notes_updated_at
  before update on public.notes
  for each row execute function public.update_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();
