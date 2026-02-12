-- Quotations + items (idempotent)
-- Uses existing permission key family: sales_invoices.read/write/delete

create table if not exists public.quotations (
  id text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id integer references public.customers(id) on delete set null,
  customer_name text,
  reference text,
  vehicle_number text,
  date date not null default current_date,
  due_date date,
  status text not null default 'Draft',
  payment_status text not null default 'Unpaid',
  notes text,
  overall_discount numeric(12, 2) not null default 0,
  amount_received numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotations_status_check check (status in ('Draft', 'Pending', 'Approved')),
  constraint quotations_payment_status_check check (payment_status in ('Unpaid', 'Partial', 'Paid'))
);

create table if not exists public.quotation_items (
  id bigserial primary key,
  quotation_id text not null references public.quotations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id integer references public.products(id) on delete set null,
  product_code text,
  product_name text not null,
  unit text,
  quantity integer not null default 1,
  unit_price numeric(12, 2) not null default 0,
  discount_value numeric(12, 2) not null default 0,
  discount_type text not null default 'fixed',
  tax numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_quotations_company_created
  on public.quotations(company_id, created_at desc);
create index if not exists idx_quotations_customer
  on public.quotations(customer_id);
create index if not exists idx_quotation_items_quotation
  on public.quotation_items(quotation_id);
create index if not exists idx_quotation_items_company
  on public.quotation_items(company_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_quotations_updated_at on public.quotations;
create trigger trg_quotations_updated_at
before update on public.quotations
for each row
execute function public.touch_updated_at();

alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;

drop policy if exists quotations_read on public.quotations;
create policy quotations_read
on public.quotations
for select
to authenticated
using (has_company_permission(company_id, 'sales_invoices.read'));

drop policy if exists quotations_insert on public.quotations;
create policy quotations_insert
on public.quotations
for insert
to authenticated
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists quotations_update on public.quotations;
create policy quotations_update
on public.quotations
for update
to authenticated
using (has_company_permission(company_id, 'sales_invoices.write'))
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists quotations_delete on public.quotations;
create policy quotations_delete
on public.quotations
for delete
to authenticated
using (has_company_permission(company_id, 'sales_invoices.delete'));

drop policy if exists quotation_items_read on public.quotation_items;
create policy quotation_items_read
on public.quotation_items
for select
to authenticated
using (has_company_permission(company_id, 'sales_invoices.read'));

drop policy if exists quotation_items_insert on public.quotation_items;
create policy quotation_items_insert
on public.quotation_items
for insert
to authenticated
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists quotation_items_update on public.quotation_items;
create policy quotation_items_update
on public.quotation_items
for update
to authenticated
using (has_company_permission(company_id, 'sales_invoices.write'))
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists quotation_items_delete on public.quotation_items;
create policy quotation_items_delete
on public.quotation_items
for delete
to authenticated
using (has_company_permission(company_id, 'sales_invoices.delete'));
