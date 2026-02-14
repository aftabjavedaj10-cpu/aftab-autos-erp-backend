-- Sales returns + stock ledger posting (idempotent)
-- Permission keys reused: sales_invoices.read/write/delete

create table if not exists public.sales_returns (
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
  amount_refunded numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  voided_from_status text,
  voided_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_returns_status_check check (status in ('Draft', 'Pending', 'Approved', 'Void', 'Deleted')),
  constraint sales_returns_payment_status_check check (payment_status in ('Unpaid', 'Partial', 'Paid'))
);

create table if not exists public.sales_return_items (
  id bigserial primary key,
  sales_return_id text not null references public.sales_returns(id) on delete cascade,
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

create index if not exists idx_sales_returns_company_created
  on public.sales_returns(company_id, created_at desc);
create index if not exists idx_sales_returns_customer
  on public.sales_returns(customer_id);
create index if not exists idx_sales_return_items_return
  on public.sales_return_items(sales_return_id);
create index if not exists idx_sales_return_items_company
  on public.sales_return_items(company_id);

create or replace function public.touch_sales_returns_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sales_returns_updated_at on public.sales_returns;
create trigger trg_sales_returns_updated_at
before update on public.sales_returns
for each row
execute function public.touch_sales_returns_updated_at();

create or replace function public.sales_return_is_effective(status_text text)
returns boolean
language sql
immutable
as $$
  select coalesce(status_text, '') in ('Pending', 'Approved');
$$;

create or replace function public.sales_returns_apply_stock()
returns trigger
language plpgsql
security definer
as $$
declare
  was_effective boolean;
  is_effective boolean;
begin
  if tg_op = 'INSERT' then
    if public.sales_return_is_effective(new.status) then
      delete from public.stock_ledger
      where source = 'sales_returns'
        and source_id = new.id
        and direction = 'IN';

      insert into public.stock_ledger (
        company_id, product_id, qty, direction, reason, source, source_id, source_ref
      )
      select
        new.company_id,
        item.product_id,
        sum(item.quantity)::integer,
        'IN',
        case when new.status = 'Pending' then 'sales_return_pending' else 'sales_return_approved' end,
        'sales_returns',
        new.id,
        new.id
      from public.sales_return_items item
      where item.sales_return_id = new.id
        and item.product_id is not null
      group by item.product_id;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    was_effective := public.sales_return_is_effective(old.status);
    is_effective := public.sales_return_is_effective(new.status);

    if is_effective then
      delete from public.stock_ledger
      where source = 'sales_returns'
        and source_id = new.id
        and direction = 'IN';

      insert into public.stock_ledger (
        company_id, product_id, qty, direction, reason, source, source_id, source_ref
      )
      select
        new.company_id,
        item.product_id,
        sum(item.quantity)::integer,
        'IN',
        case when new.status = 'Pending' then 'sales_return_pending' else 'sales_return_approved' end,
        'sales_returns',
        new.id,
        new.id
      from public.sales_return_items item
      where item.sales_return_id = new.id
        and item.product_id is not null
      group by item.product_id;
    end if;

    if (was_effective and not is_effective) then
      insert into public.stock_ledger (
        company_id, product_id, qty, direction, reason, source, source_id, source_ref
      )
      select
        old.company_id,
        item.product_id,
        sum(item.quantity)::integer,
        'OUT',
        'sales_return_reversal',
        'sales_returns',
        old.id,
        old.id
      from public.sales_return_items item
      where item.sales_return_id = old.id
        and item.product_id is not null
      group by item.product_id
      on conflict (source, source_id, product_id, direction)
      do update set
        qty = excluded.qty,
        reason = excluded.reason,
        source_ref = excluded.source_ref,
        created_at = now();
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if public.sales_return_is_effective(old.status) then
      insert into public.stock_ledger (
        company_id, product_id, qty, direction, reason, source, source_id, source_ref
      )
      select
        old.company_id,
        led.product_id,
        led.qty,
        'OUT',
        'sales_return_delete',
        'sales_returns',
        old.id,
        old.id
      from public.stock_ledger led
      where led.source = 'sales_returns'
        and led.source_id = old.id
        and led.direction = 'IN'
      on conflict (source, source_id, product_id, direction)
      do update set
        qty = excluded.qty,
        reason = excluded.reason,
        source_ref = excluded.source_ref,
        created_at = now();
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sales_returns_apply_stock on public.sales_returns;
create trigger trg_sales_returns_apply_stock
after insert or update or delete on public.sales_returns
for each row
execute function public.sales_returns_apply_stock();

alter table public.sales_returns enable row level security;
alter table public.sales_return_items enable row level security;

drop policy if exists sales_returns_read on public.sales_returns;
create policy sales_returns_read
on public.sales_returns
for select
to authenticated
using (has_company_permission(company_id, 'sales_invoices.read'));

drop policy if exists sales_returns_insert on public.sales_returns;
create policy sales_returns_insert
on public.sales_returns
for insert
to authenticated
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists sales_returns_update on public.sales_returns;
create policy sales_returns_update
on public.sales_returns
for update
to authenticated
using (has_company_permission(company_id, 'sales_invoices.write'))
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists sales_returns_delete on public.sales_returns;
create policy sales_returns_delete
on public.sales_returns
for delete
to authenticated
using (has_company_permission(company_id, 'sales_invoices.delete'));

drop policy if exists sales_return_items_read on public.sales_return_items;
create policy sales_return_items_read
on public.sales_return_items
for select
to authenticated
using (has_company_permission(company_id, 'sales_invoices.read'));

drop policy if exists sales_return_items_insert on public.sales_return_items;
create policy sales_return_items_insert
on public.sales_return_items
for insert
to authenticated
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists sales_return_items_update on public.sales_return_items;
create policy sales_return_items_update
on public.sales_return_items
for update
to authenticated
using (has_company_permission(company_id, 'sales_invoices.write'))
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists sales_return_items_delete on public.sales_return_items;
create policy sales_return_items_delete
on public.sales_return_items
for delete
to authenticated
using (has_company_permission(company_id, 'sales_invoices.delete'));

