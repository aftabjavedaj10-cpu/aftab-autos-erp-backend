-- Phase 5: packaging active toggle for form visibility
-- Safe additive migration.

begin;

alter table if exists public.product_packagings
  add column if not exists is_active boolean not null default true;

create index if not exists idx_product_packagings_is_active
  on public.product_packagings (is_active);

insert into public.schema_migrations (filename, note)
select
  '2026-02-23_packaging_phase5_active_toggle.sql',
  'Add is_active to product_packagings for form visibility toggle'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
