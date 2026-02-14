-- Receive payments (customer receipts)
-- Permission keys reused: sales_invoices.read/write/delete

create table if not exists public.receive_payments (
  id text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id integer references public.customers(id) on delete set null,
  customer_name text,
  reference text,
  date date not null default current_date,
  status text not null default 'Draft',
  total_amount numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receive_payments_status_check check (status in ('Draft', 'Pending', 'Approved', 'Void', 'Deleted'))
);

alter table public.receive_payments
  add column if not exists reference text;

create index if not exists idx_receive_payments_company_created
  on public.receive_payments(company_id, created_at desc);
create index if not exists idx_receive_payments_customer
  on public.receive_payments(customer_id);

create or replace function public.touch_receive_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_receive_payments_updated_at on public.receive_payments;
create trigger trg_receive_payments_updated_at
before update on public.receive_payments
for each row
execute function public.touch_receive_payments_updated_at();

alter table public.receive_payments enable row level security;

drop policy if exists receive_payments_read on public.receive_payments;
create policy receive_payments_read
on public.receive_payments
for select
to authenticated
using (has_company_permission(company_id, 'sales_invoices.read'));

drop policy if exists receive_payments_insert on public.receive_payments;
create policy receive_payments_insert
on public.receive_payments
for insert
to authenticated
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists receive_payments_update on public.receive_payments;
create policy receive_payments_update
on public.receive_payments
for update
to authenticated
using (has_company_permission(company_id, 'sales_invoices.write'))
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists receive_payments_delete on public.receive_payments;
create policy receive_payments_delete
on public.receive_payments
for delete
to authenticated
using (has_company_permission(company_id, 'sales_invoices.delete'));
