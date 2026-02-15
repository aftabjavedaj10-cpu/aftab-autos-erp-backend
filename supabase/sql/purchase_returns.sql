-- Purchase returns + stock ledger posting
-- Effect: effective purchase returns (Pending/Approved) move stock OUT.
-- Permission keys reused: sales_invoices.read/write/delete

create table if not exists public.purchase_returns (
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
  constraint purchase_returns_status_check check (status in ('Draft', 'Pending', 'Approved', 'Void', 'Deleted')),
  constraint purchase_returns_payment_status_check check (payment_status in ('Unpaid', 'Partial', 'Paid'))
);

create table if not exists public.purchase_return_items (
  id bigserial primary key,
  purchase_return_id text not null references public.purchase_returns(id) on delete cascade,
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

create index if not exists idx_purchase_returns_company_created
  on public.purchase_returns(company_id, created_at desc);
create index if not exists idx_purchase_returns_vendor
  on public.purchase_returns(vendor_id);
create index if not exists idx_purchase_return_items_return
  on public.purchase_return_items(purchase_return_id);
create index if not exists idx_purchase_return_items_company
  on public.purchase_return_items(company_id);

create or replace function public.touch_purchase_return_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_purchase_returns_updated_at on public.purchase_returns;
create trigger trg_purchase_returns_updated_at
before update on public.purchase_returns
for each row
execute function public.touch_purchase_return_updated_at();

create or replace function public.purchase_return_is_effective(status_text text)
returns boolean
language sql
immutable
as $$
  select coalesce(status_text, '') in ('Pending', 'Approved');
$$;

create or replace function public.purchase_returns_rebuild_stock()
returns trigger
language plpgsql
security definer
as $$
declare
  was_effective boolean := public.purchase_return_is_effective(old.status);
  is_effective  boolean := public.purchase_return_is_effective(new.status);
begin
  if tg_op = 'INSERT' then
    if is_effective then
      delete from public.stock_ledger
      where source = 'purchase_returns'
        and source_id = new.id
        and direction = 'IN';

      delete from public.stock_ledger
      where source = 'purchase_returns'
        and source_id = new.id
        and direction = 'OUT';

      insert into public.stock_ledger
        (company_id, product_id, qty, direction, reason, source, source_id, source_ref)
      select
        new.company_id,
        i.product_id,
        sum(i.quantity)::int,
        'OUT',
        case when new.status = 'Pending' then 'purchase_return_pending' else 'purchase_return_approved' end,
        'purchase_returns',
        new.id,
        new.id
      from public.purchase_return_items i
      where i.purchase_return_id = new.id
        and i.product_id is not null
      group by i.product_id
      on conflict (source, source_id, product_id, direction)
      do update set
        qty = excluded.qty,
        reason = excluded.reason,
        source_ref = excluded.source_ref,
        created_at = now();
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if is_effective then
      if not was_effective then
        delete from public.stock_ledger
        where source = 'purchase_returns'
          and source_id = new.id
          and direction = 'IN';
      end if;

      delete from public.stock_ledger
      where source = 'purchase_returns'
        and source_id = new.id
        and direction = 'OUT';

      insert into public.stock_ledger
        (company_id, product_id, qty, direction, reason, source, source_id, source_ref)
      select
        new.company_id,
        i.product_id,
        sum(i.quantity)::int,
        'OUT',
        case when new.status = 'Pending' then 'purchase_return_pending' else 'purchase_return_approved' end,
        'purchase_returns',
        new.id,
        new.id
      from public.purchase_return_items i
      where i.purchase_return_id = new.id
        and i.product_id is not null
      group by i.product_id
      on conflict (source, source_id, product_id, direction)
      do update set
        qty = excluded.qty,
        reason = excluded.reason,
        source_ref = excluded.source_ref,
        created_at = now();
    end if;

    if was_effective and not is_effective then
      insert into public.stock_ledger
        (company_id, product_id, qty, direction, reason, source, source_id, source_ref)
      select
        old.company_id,
        led.product_id,
        led.qty,
        'IN',
        'purchase_return_reversal',
        'purchase_returns',
        old.id,
        old.id
      from public.stock_ledger led
      where led.source = 'purchase_returns'
        and led.source_id = old.id
        and led.direction = 'OUT'
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
    if was_effective then
      insert into public.stock_ledger
        (company_id, product_id, qty, direction, reason, source, source_id, source_ref)
      select
        old.company_id,
        led.product_id,
        led.qty,
        'IN',
        'purchase_return_delete',
        'purchase_returns',
        old.id,
        old.id
      from public.stock_ledger led
      where led.source = 'purchase_returns'
        and led.source_id = old.id
        and led.direction = 'OUT'
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

drop trigger if exists trg_purchase_returns_rebuild_stock on public.purchase_returns;
create trigger trg_purchase_returns_rebuild_stock
after insert or update or delete on public.purchase_returns
for each row
execute function public.purchase_returns_rebuild_stock();

alter table public.purchase_returns enable row level security;
alter table public.purchase_return_items enable row level security;

drop policy if exists purchase_returns_read on public.purchase_returns;
create policy purchase_returns_read
on public.purchase_returns
for select
to authenticated
using (has_company_permission(company_id, 'sales_invoices.read'));

drop policy if exists purchase_returns_insert on public.purchase_returns;
create policy purchase_returns_insert
on public.purchase_returns
for insert
to authenticated
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists purchase_returns_update on public.purchase_returns;
create policy purchase_returns_update
on public.purchase_returns
for update
to authenticated
using (has_company_permission(company_id, 'sales_invoices.write'))
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists purchase_returns_delete on public.purchase_returns;
create policy purchase_returns_delete
on public.purchase_returns
for delete
to authenticated
using (has_company_permission(company_id, 'sales_invoices.delete'));

drop policy if exists purchase_return_items_read on public.purchase_return_items;
create policy purchase_return_items_read
on public.purchase_return_items
for select
to authenticated
using (has_company_permission(company_id, 'sales_invoices.read'));

drop policy if exists purchase_return_items_insert on public.purchase_return_items;
create policy purchase_return_items_insert
on public.purchase_return_items
for insert
to authenticated
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists purchase_return_items_update on public.purchase_return_items;
create policy purchase_return_items_update
on public.purchase_return_items
for update
to authenticated
using (has_company_permission(company_id, 'sales_invoices.write'))
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists purchase_return_items_delete on public.purchase_return_items;
create policy purchase_return_items_delete
on public.purchase_return_items
for delete
to authenticated
using (has_company_permission(company_id, 'sales_invoices.delete'));
