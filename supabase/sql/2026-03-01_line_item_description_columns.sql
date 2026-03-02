-- Add per-line description fields for document item tables.
-- Used by form-level editable item descriptions and print templates.

begin;

alter table if exists public.sales_invoice_items
  add column if not exists description text;

alter table if exists public.quotation_items
  add column if not exists description text;

alter table if exists public.sales_return_items
  add column if not exists description text;

alter table if exists public.purchase_invoice_items
  add column if not exists description text;

alter table if exists public.purchase_order_items
  add column if not exists description text;

alter table if exists public.purchase_return_items
  add column if not exists description text;

insert into public.schema_migrations (filename, note)
select
  '2026-03-01_line_item_description_columns.sql',
  'Add description column on invoice/order/return item tables for user-entered line descriptions'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
