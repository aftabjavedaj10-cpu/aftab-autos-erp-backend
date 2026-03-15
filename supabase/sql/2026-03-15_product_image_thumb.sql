begin;

alter table if exists public.products
  add column if not exists image_thumb text;

insert into public.schema_migrations (filename, note)
select
  '2026-03-15_product_image_thumb.sql',
  'Add products.image_thumb for lightweight list thumbnails'
where exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
