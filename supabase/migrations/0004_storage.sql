-- Media bucket: public read, writes limited to people who can edit the school.
-- Object path convention: <school_id>/<filename>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-media', 'school-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "school media read" on storage.objects for select using (bucket_id = 'school-media');
create policy "school media insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'school-media' and private.can_edit_school(((storage.foldername(name))[1])::uuid, 'media.write'));
create policy "school media update" on storage.objects for update to authenticated
  using (bucket_id = 'school-media' and private.can_edit_school(((storage.foldername(name))[1])::uuid, 'media.write'));
create policy "school media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'school-media' and private.can_edit_school(((storage.foldername(name))[1])::uuid, 'media.write'));
