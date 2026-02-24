-- Phase 4: Urdu label support for multi packaging rows
-- Safe additive migration.

begin;

alter table if exists public.product_packagings
  add column if not exists urdu_name text;

create index if not exists idx_product_packagings_urdu_name
  on public.product_packagings (urdu_name);

insert into public.schema_migrations (filename, note)
select
  '2026-02-23_packaging_phase4_urdu_name.sql',
  'Add urdu_name to product_packagings for multilingual labels in forms/prints'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
