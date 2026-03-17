begin;

alter table if exists public.sales_invoice_items
  add column if not exists line_order integer not null default 0;

with ranked as (
  select
    id,
    row_number() over (
      partition by invoice_id
      order by id
    ) as rn
  from public.sales_invoice_items
)
update public.sales_invoice_items items
set line_order = ranked.rn
from ranked
where items.id = ranked.id
  and coalesce(items.line_order, 0) = 0;

create index if not exists idx_sales_invoice_items_invoice_line_order
  on public.sales_invoice_items(invoice_id, line_order, id);

insert into public.schema_migrations (filename, note)
select
  '2026-03-17_sales_invoice_line_order.sql',
  'Add persisted line_order to sales_invoice_items so revised invoices keep row order'
where exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
