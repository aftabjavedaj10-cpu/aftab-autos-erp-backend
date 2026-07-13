-- Speed up invoice save stock-ledger rebuilds and inventory refresh queries.
-- Safe to re-run: all indexes use if not exists.

begin;

create index if not exists idx_stock_ledger_source_doc_direction
on public.stock_ledger (source, source_id, direction);

create index if not exists idx_stock_ledger_company_created
on public.stock_ledger (company_id, created_at desc);

insert into public.schema_migrations (filename, note)
select
  '2026-05-25_stock_ledger_save_performance_indexes.sql',
  'Add stock ledger indexes for invoice save and inventory refresh performance'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
