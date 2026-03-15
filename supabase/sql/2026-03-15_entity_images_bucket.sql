begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'entity-images',
  'entity-images',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists entity_images_public_read on storage.objects;
create policy entity_images_public_read
on storage.objects
for select
to public
using (bucket_id = 'entity-images');

drop policy if exists entity_images_authenticated_insert on storage.objects;
create policy entity_images_authenticated_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'entity-images');

drop policy if exists entity_images_authenticated_update on storage.objects;
create policy entity_images_authenticated_update
on storage.objects
for update
to authenticated
using (bucket_id = 'entity-images')
with check (bucket_id = 'entity-images');

drop policy if exists entity_images_authenticated_delete on storage.objects;
create policy entity_images_authenticated_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'entity-images');

insert into public.schema_migrations (filename, note)
select
  '2026-03-15_entity_images_bucket.sql',
  'Create public entity-images bucket for product/customer/vendor image storage'
where exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
