-- Make payments (vendor payments)
-- Permission keys reused: sales_invoices.read/write/delete

create table if not exists public.make_payments (
  id text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  vendor_id integer references public.vendors(id) on delete set null,
  vendor_name text,
  invoice_id text,
  reference text,
  date date not null default current_date,
  status text not null default 'Draft',
  total_amount numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint make_payments_status_check check (status in ('Draft', 'Pending', 'Approved', 'Void', 'Deleted'))
);

create index if not exists idx_make_payments_company_created
  on public.make_payments(company_id, created_at desc);
create index if not exists idx_make_payments_vendor
  on public.make_payments(vendor_id);

create or replace function public.touch_make_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_make_payments_updated_at on public.make_payments;
create trigger trg_make_payments_updated_at
before update on public.make_payments
for each row
execute function public.touch_make_payments_updated_at();

alter table public.make_payments enable row level security;

drop policy if exists make_payments_read on public.make_payments;
create policy make_payments_read
on public.make_payments
for select
to authenticated
using (has_company_permission(company_id, 'sales_invoices.read'));

drop policy if exists make_payments_insert on public.make_payments;
create policy make_payments_insert
on public.make_payments
for insert
to authenticated
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists make_payments_update on public.make_payments;
create policy make_payments_update
on public.make_payments
for update
to authenticated
using (has_company_permission(company_id, 'sales_invoices.write'))
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists make_payments_delete on public.make_payments;
create policy make_payments_delete
on public.make_payments
for delete
to authenticated
using (has_company_permission(company_id, 'sales_invoices.delete'));
