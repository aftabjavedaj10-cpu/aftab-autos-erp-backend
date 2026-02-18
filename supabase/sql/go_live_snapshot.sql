-- Go-live daily snapshot (read-only)
-- Run in Supabase SQL editor and copy results into go-live-state-2026-02-18.md

-- 1) Active companies
select id, name, created_at
from public.companies
order by created_at desc;

-- 2) Core table row counts
select 'products' as table_name, count(*) as row_count from public.products
union all select 'customers', count(*) from public.customers
union all select 'vendors', count(*) from public.vendors
union all select 'categories', count(*) from public.categories
union all select 'sales_invoices', count(*) from public.sales_invoices
union all select 'purchase_invoices', count(*) from public.purchase_invoices
union all select 'purchase_orders', count(*) from public.purchase_orders
union all select 'purchase_returns', count(*) from public.purchase_returns
union all select 'receive_payments', count(*) from public.receive_payments
union all select 'make_payments', count(*) from public.make_payments
union all select 'stock_ledger', count(*) from public.stock_ledger
order by table_name;

-- 3) RLS status for public.users
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'users'
  and c.relkind = 'r';

-- 4) Check sensitive password column presence on public.users
select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'password'
  ) as password_column_exists;

-- 5) Quick pending-status counts for operations
-- Safe variant: returns 0 if a table does not exist.
select 'quotation_pending' as metric,
case when to_regclass('public.quotations') is not null then
  (xpath('/row/cnt/text()', query_to_xml(
    'select count(*) as cnt from public.quotations where status = ''Pending''',
    true, true, ''
  )))[1]::text::int
else 0 end as total
union all
select 'sales_orders_pending',
case when to_regclass('public.sales_orders') is not null then
  (xpath('/row/cnt/text()', query_to_xml(
    'select count(*) as cnt from public.sales_orders where status = ''Pending''',
    true, true, ''
  )))[1]::text::int
else 0 end
union all
select 'sales_invoices_pending',
case when to_regclass('public.sales_invoices') is not null then
  (xpath('/row/cnt/text()', query_to_xml(
    'select count(*) as cnt from public.sales_invoices where status = ''Pending''',
    true, true, ''
  )))[1]::text::int
else 0 end
union all
select 'sales_returns_pending',
case when to_regclass('public.sales_returns') is not null then
  (xpath('/row/cnt/text()', query_to_xml(
    'select count(*) as cnt from public.sales_returns where status = ''Pending''',
    true, true, ''
  )))[1]::text::int
else 0 end
union all
select 'receive_payments_pending',
case when to_regclass('public.receive_payments') is not null then
  (xpath('/row/cnt/text()', query_to_xml(
    'select count(*) as cnt from public.receive_payments where status = ''Pending''',
    true, true, ''
  )))[1]::text::int
else 0 end
union all
select 'purchase_orders_pending',
case when to_regclass('public.purchase_orders') is not null then
  (xpath('/row/cnt/text()', query_to_xml(
    'select count(*) as cnt from public.purchase_orders where status = ''Pending''',
    true, true, ''
  )))[1]::text::int
else 0 end
union all
select 'purchase_invoices_pending',
case when to_regclass('public.purchase_invoices') is not null then
  (xpath('/row/cnt/text()', query_to_xml(
    'select count(*) as cnt from public.purchase_invoices where status = ''Pending''',
    true, true, ''
  )))[1]::text::int
else 0 end
union all
select 'purchase_returns_pending',
case when to_regclass('public.purchase_returns') is not null then
  (xpath('/row/cnt/text()', query_to_xml(
    'select count(*) as cnt from public.purchase_returns where status = ''Pending''',
    true, true, ''
  )))[1]::text::int
else 0 end
union all
select 'make_payments_pending',
case when to_regclass('public.make_payments') is not null then
  (xpath('/row/cnt/text()', query_to_xml(
    'select count(*) as cnt from public.make_payments where status = ''Pending''',
    true, true, ''
  )))[1]::text::int
else 0 end;
