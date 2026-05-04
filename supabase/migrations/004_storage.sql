-- Create avatars bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

-- Policy: users can upload their own avatar
create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: users can update their own avatar
create policy "Users can update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: users can delete their own avatar
create policy "Users can delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: avatars are publicly readable (for displaying in UI)
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');
