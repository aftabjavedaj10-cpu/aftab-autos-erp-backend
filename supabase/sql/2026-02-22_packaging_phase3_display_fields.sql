-- Phase 3: packaging display fields for direct variant search in forms.
-- Safe additive migration.

begin;

alter table if exists public.product_packagings
  add column if not exists display_name text,
  add column if not exists display_code text;

create index if not exists idx_product_packagings_display_name
  on public.product_packagings (display_name);

create index if not exists idx_product_packagings_display_code
  on public.product_packagings (display_code);

insert into public.schema_migrations (filename, note)
select
  '2026-02-22_packaging_phase3_display_fields.sql',
  'Add packaging display_name/display_code for variant search'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
