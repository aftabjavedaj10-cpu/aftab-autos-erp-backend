-- Backfill/rebuild stock_ledger rows for existing Sales Invoices.
-- Safe to re-run: it only rebuilds OUT rows with source = 'sales_invoices'
-- for invoices that are currently Pending or Approved.

begin;

delete from public.stock_ledger sl
using public.sales_invoices si
where sl.source = 'sales_invoices'
  and sl.direction = 'OUT'
  and sl.source_id = si.id
  and lower(trim(coalesce(si.status, ''))) in ('pending', 'approved');

insert into public.stock_ledger (
  company_id,
  product_id,
  qty,
  direction,
  reason,
  source,
  source_id,
  source_ref
)
select
  coalesce(si.company_id, p.company_id),
  sii.product_id,
  sum(coalesce(sii.qty_base, sii.quantity::numeric))::numeric(16,6) as qty,
  'OUT' as direction,
  case when lower(trim(coalesce(si.status, ''))) = 'pending' then 'invoice_pending' else 'invoice_approved' end as reason,
  'sales_invoices' as source,
  si.id as source_id,
  si.id as source_ref
from public.sales_invoices si
join public.sales_invoice_items sii on sii.invoice_id = si.id
join public.products p on p.id = sii.product_id
where lower(trim(coalesce(si.status, ''))) in ('pending', 'approved')
  and sii.product_id is not null
  and coalesce(si.company_id, p.company_id) is not null
  and lower(coalesce(p.product_type, 'product')) <> 'service'
group by coalesce(si.company_id, p.company_id), si.id, si.status, sii.product_id
having sum(coalesce(sii.qty_base, sii.quantity::numeric)) > 0
on conflict (source, source_id, product_id, direction)
do update set
  company_id = excluded.company_id,
  qty = excluded.qty,
  reason = excluded.reason,
  source_ref = excluded.source_ref,
  created_at = now();

insert into public.schema_migrations (filename, note)
select
  '2026-05-24_backfill_sales_invoice_stock_ledger.sql',
  'Backfill stock ledger rows for existing pending/approved sales invoices'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
