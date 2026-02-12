-- Purchase invoices + stock ledger posting (idempotent)
-- Permission keys reused: sales_invoices.read/write/delete

create table if not exists public.purchase_invoices (
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
  constraint purchase_invoices_status_check check (status in ('Draft', 'Pending', 'Approved')),
  constraint purchase_invoices_payment_status_check check (payment_status in ('Unpaid', 'Partial', 'Paid'))
);

create table if not exists public.purchase_invoice_items (
  id bigserial primary key,
  purchase_invoice_id text not null references public.purchase_invoices(id) on delete cascade,
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

create index if not exists idx_purchase_invoices_company_created
  on public.purchase_invoices(company_id, created_at desc);
create index if not exists idx_purchase_invoices_vendor
  on public.purchase_invoices(vendor_id);
create index if not exists idx_purchase_invoice_items_invoice
  on public.purchase_invoice_items(purchase_invoice_id);
create index if not exists idx_purchase_invoice_items_company
  on public.purchase_invoice_items(company_id);

create or replace function public.touch_purchase_invoice_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_purchase_invoices_updated_at on public.purchase_invoices;
create trigger trg_purchase_invoices_updated_at
before update on public.purchase_invoices
for each row
execute function public.touch_purchase_invoice_updated_at();

create or replace function public.purchase_invoice_is_effective(status_text text)
returns boolean
language sql
immutable
as $$
  select coalesce(status_text, '') in ('Pending', 'Approved');
$$;

create or replace function public.purchase_invoices_apply_stock()
returns trigger
language plpgsql
security definer
as $$
declare
  was_effective boolean;
  is_effective boolean;
begin
  if tg_op = 'INSERT' then
    if public.purchase_invoice_is_effective(new.status) then
      insert into public.stock_ledger (
        company_id, product_id, qty, direction, reason, source, source_id, source_ref
      )
      select
        new.company_id,
        item.product_id,
        item.quantity,
        'IN',
        case when new.status = 'Pending' then 'purchase_pending' else 'purchase_approved' end,
        'purchase_invoices',
        new.id,
        new.id
      from public.purchase_invoice_items item
      where item.purchase_invoice_id = new.id
        and item.product_id is not null;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    was_effective := public.purchase_invoice_is_effective(old.status);
    is_effective := public.purchase_invoice_is_effective(new.status);

    if (not was_effective and is_effective) then
      insert into public.stock_ledger (
        company_id, product_id, qty, direction, reason, source, source_id, source_ref
      )
      select
        new.company_id,
        item.product_id,
        item.quantity,
        'IN',
        case when new.status = 'Pending' then 'purchase_pending' else 'purchase_approved' end,
        'purchase_invoices',
        new.id,
        new.id
      from public.purchase_invoice_items item
      where item.purchase_invoice_id = new.id
        and item.product_id is not null;
    end if;

    if (was_effective and not is_effective) then
      insert into public.stock_ledger (
        company_id, product_id, qty, direction, reason, source, source_id, source_ref
      )
      select
        old.company_id,
        item.product_id,
        item.quantity,
        'OUT',
        'purchase_reversal',
        'purchase_invoices',
        old.id,
        old.id
      from public.purchase_invoice_items item
      where item.purchase_invoice_id = old.id
        and item.product_id is not null;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if public.purchase_invoice_is_effective(old.status) then
      insert into public.stock_ledger (
        company_id, product_id, qty, direction, reason, source, source_id, source_ref
      )
      select
        old.company_id,
        item.product_id,
        item.quantity,
        'OUT',
        'purchase_delete',
        'purchase_invoices',
        old.id,
        old.id
      from public.purchase_invoice_items item
      where item.purchase_invoice_id = old.id
        and item.product_id is not null;
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_purchase_invoices_apply_stock on public.purchase_invoices;
create trigger trg_purchase_invoices_apply_stock
after insert or update or delete on public.purchase_invoices
for each row
execute function public.purchase_invoices_apply_stock();

create or replace function public.purchase_invoice_items_apply_stock()
returns trigger
language plpgsql
security definer
as $$
declare
  inv record;
begin
  if tg_op = 'INSERT' then
    select id, company_id, status into inv
    from public.purchase_invoices
    where id = new.purchase_invoice_id;

    if public.purchase_invoice_is_effective(inv.status) and new.product_id is not null then
      insert into public.stock_ledger (
        company_id, product_id, qty, direction, reason, source, source_id, source_ref
      )
      values (
        inv.company_id,
        new.product_id,
        new.quantity,
        'IN',
        case when inv.status = 'Pending' then 'purchase_pending' else 'purchase_approved' end,
        'purchase_invoices',
        inv.id,
        inv.id
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    select id, company_id, status into inv
    from public.purchase_invoices
    where id = new.purchase_invoice_id;

    if public.purchase_invoice_is_effective(inv.status) then
      if old.product_id is not null then
        insert into public.stock_ledger (
          company_id, product_id, qty, direction, reason, source, source_id, source_ref
        )
        values (
          inv.company_id,
          old.product_id,
          old.quantity,
          'OUT',
          'purchase_line_reversal',
          'purchase_invoices',
          inv.id,
          inv.id
        );
      end if;

      if new.product_id is not null then
        insert into public.stock_ledger (
          company_id, product_id, qty, direction, reason, source, source_id, source_ref
        )
        values (
          inv.company_id,
          new.product_id,
          new.quantity,
          'IN',
          case when inv.status = 'Pending' then 'purchase_pending' else 'purchase_approved' end,
          'purchase_invoices',
          inv.id,
          inv.id
        );
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    select id, company_id, status into inv
    from public.purchase_invoices
    where id = old.purchase_invoice_id;

    if public.purchase_invoice_is_effective(inv.status) and old.product_id is not null then
      insert into public.stock_ledger (
        company_id, product_id, qty, direction, reason, source, source_id, source_ref
      )
      values (
        inv.company_id,
        old.product_id,
        old.quantity,
        'OUT',
        'purchase_line_delete',
        'purchase_invoices',
        inv.id,
        inv.id
      );
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_purchase_invoice_items_apply_stock on public.purchase_invoice_items;
create trigger trg_purchase_invoice_items_apply_stock
after insert or update or delete on public.purchase_invoice_items
for each row
execute function public.purchase_invoice_items_apply_stock();

alter table public.purchase_invoices enable row level security;
alter table public.purchase_invoice_items enable row level security;

drop policy if exists purchase_invoices_read on public.purchase_invoices;
create policy purchase_invoices_read
on public.purchase_invoices
for select
to authenticated
using (has_company_permission(company_id, 'sales_invoices.read'));

drop policy if exists purchase_invoices_insert on public.purchase_invoices;
create policy purchase_invoices_insert
on public.purchase_invoices
for insert
to authenticated
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists purchase_invoices_update on public.purchase_invoices;
create policy purchase_invoices_update
on public.purchase_invoices
for update
to authenticated
using (has_company_permission(company_id, 'sales_invoices.write'))
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists purchase_invoices_delete on public.purchase_invoices;
create policy purchase_invoices_delete
on public.purchase_invoices
for delete
to authenticated
using (has_company_permission(company_id, 'sales_invoices.delete'));

drop policy if exists purchase_invoice_items_read on public.purchase_invoice_items;
create policy purchase_invoice_items_read
on public.purchase_invoice_items
for select
to authenticated
using (has_company_permission(company_id, 'sales_invoices.read'));

drop policy if exists purchase_invoice_items_insert on public.purchase_invoice_items;
create policy purchase_invoice_items_insert
on public.purchase_invoice_items
for insert
to authenticated
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists purchase_invoice_items_update on public.purchase_invoice_items;
create policy purchase_invoice_items_update
on public.purchase_invoice_items
for update
to authenticated
using (has_company_permission(company_id, 'sales_invoices.write'))
with check (has_company_permission(company_id, 'sales_invoices.write'));

drop policy if exists purchase_invoice_items_delete on public.purchase_invoice_items;
create policy purchase_invoice_items_delete
on public.purchase_invoice_items
for delete
to authenticated
using (has_company_permission(company_id, 'sales_invoices.delete'));
