-- Purchase Orders (separate from purchase invoices)
-- Permission keys reused: sales_invoices.read/write/delete

create table if not exists public.purchase_orders (
  id text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  vendor_id integer references public.vendors(id) on delete set null,
  vendor_name text,
  reference text,
  vehicle_number text,
  date date not null default current_date,
  due_date date,
  status text not null default 'Draft',
  payment_status text not null default 'Unpaid',
  notes text,
  overall_discount numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_orders_status_check check (status in ('Draft', 'Pending', 'Approved', 'Void', 'Deleted')),
  constraint purchase_orders_payment_status_check check (payment_status in ('Unpaid', 'Partial', 'Paid'))
);

create table if not exists public.purchase_order_items (
  id bigserial primary key,
  purchase_order_id text not null references public.purchase_orders(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id integer references public.products(id) on delete set null,
  product_code text,
  product_name text not null,
  unit text,
  quantity integer not null default 1,
  unit_cost numeric(12, 2) not null default 0,
  discount_value numeric(12, 2) not null default 0,
  discount_type text not null default 'fixed',
  tax numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_orders_company_created
  on public.purchase_orders(company_id, created_at desc);
create index if not exists idx_purchase_orders_vendor
  on public.purchase_orders(vendor_id);
create index if not exists idx_purchase_order_items_order
  on public.purchase_order_items(purchase_order_id);
create index if not exists idx_purchase_order_items_company
  on public.purchase_order_items(company_id);

create or replace function public.touch_purchase_order_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_purchase_orders_updated_at on public.purchase_orders;
create trigger trg_purchase_orders_updated_at
before update on public.purchase_orders
for each row
execute function public.touch_purchase_order_updated_at();

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

drop policy if exists purchase_orders_read on public.purchase_orders;
create policy purchase_orders_read
on public.purchase_orders
for select
to authenticated
using (has_company_permission(company_id, 'sales_invoices.read'));

drop policy if exists purchase_orders_insert on public.purchase_orders;
create policy purchase_orders_insert
on public.purchase_orders
for insert
to authenticated
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists purchase_orders_update on public.purchase_orders;
create policy purchase_orders_update
on public.purchase_orders
for update
to authenticated
using (has_company_permission(company_id, 'sales_invoices.write'))
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists purchase_orders_delete on public.purchase_orders;
create policy purchase_orders_delete
on public.purchase_orders
for delete
to authenticated
using (has_company_permission(company_id, 'sales_invoices.delete'));

drop policy if exists purchase_order_items_read on public.purchase_order_items;
create policy purchase_order_items_read
on public.purchase_order_items
for select
to authenticated
using (has_company_permission(company_id, 'sales_invoices.read'));

drop policy if exists purchase_order_items_insert on public.purchase_order_items;
create policy purchase_order_items_insert
on public.purchase_order_items
for insert
to authenticated
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists purchase_order_items_update on public.purchase_order_items;
create policy purchase_order_items_update
on public.purchase_order_items
for update
to authenticated
using (has_company_permission(company_id, 'sales_invoices.write'))
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists purchase_order_items_delete on public.purchase_order_items;
create policy purchase_order_items_delete
on public.purchase_order_items
for delete
to authenticated
using (has_company_permission(company_id, 'sales_invoices.delete'));
