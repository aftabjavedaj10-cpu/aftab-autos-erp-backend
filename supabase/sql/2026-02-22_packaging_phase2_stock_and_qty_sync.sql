-- Phase 2 consolidation: decimal stock posting + qty sync hardening
-- Safe/idempotent migration to align triggers and quantity fields.

begin;

-- -----------------------------------------------------------------------------
-- A) SALES INVOICES: decimal stock posting from qty_base
-- -----------------------------------------------------------------------------
create or replace function public.sales_invoice_is_effective(status_text text)
returns boolean
language sql
immutable
as $$
  select coalesce(status_text, '') in ('Pending', 'Approved');
$$;

create or replace function public.sales_invoices_apply_stock()
returns trigger
language plpgsql
security definer
as $$
declare
  was_effective boolean := public.sales_invoice_is_effective(old.status);
  is_effective boolean := public.sales_invoice_is_effective(new.status);
begin
  if tg_op = 'INSERT' then
    if public.sales_invoice_is_effective(new.status) then
      delete from public.stock_ledger
      where source = 'sales_invoices'
        and source_id = new.id
        and direction = 'OUT';

      insert into public.stock_ledger (company_id, product_id, qty, direction, reason, source, source_id, source_ref)
      select
        new.company_id,
        i.product_id,
        sum(coalesce(i.qty_base, i.quantity::numeric))::numeric(16,6),
        'OUT',
        case when new.status = 'Pending' then 'invoice_pending' else 'invoice_approved' end,
        'sales_invoices',
        new.id,
        new.id
      from public.sales_invoice_items i
      where i.invoice_id = new.id
        and i.product_id is not null
      group by i.product_id;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if is_effective then
      delete from public.stock_ledger
      where source = 'sales_invoices'
        and source_id = new.id
        and direction = 'OUT';

      insert into public.stock_ledger (company_id, product_id, qty, direction, reason, source, source_id, source_ref)
      select
        new.company_id,
        i.product_id,
        sum(coalesce(i.qty_base, i.quantity::numeric))::numeric(16,6),
        'OUT',
        case when new.status = 'Pending' then 'invoice_pending' else 'invoice_approved' end,
        'sales_invoices',
        new.id,
        new.id
      from public.sales_invoice_items i
      where i.invoice_id = new.id
        and i.product_id is not null
      group by i.product_id;
    end if;

    if was_effective and not is_effective then
      insert into public.stock_ledger (company_id, product_id, qty, direction, reason, source, source_id, source_ref)
      select
        old.company_id,
        led.product_id,
        led.qty,
        'IN',
        'invoice_reversal',
        'sales_invoices',
        old.id,
        old.id
      from public.stock_ledger led
      where led.source = 'sales_invoices'
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
      insert into public.stock_ledger (company_id, product_id, qty, direction, reason, source, source_id, source_ref)
      select
        old.company_id,
        led.product_id,
        led.qty,
        'IN',
        'invoice_reversal',
        'sales_invoices',
        old.id,
        old.id
      from public.stock_ledger led
      where led.source = 'sales_invoices'
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

drop trigger if exists trg_sales_invoices_apply_stock on public.sales_invoices;
create trigger trg_sales_invoices_apply_stock
after insert or update or delete on public.sales_invoices
for each row
execute function public.sales_invoices_apply_stock();

-- Remove legacy duplicate trigger/function if present.
drop trigger if exists trg_sales_invoices_rebuild_stock on public.sales_invoices;
drop function if exists public.sales_invoices_rebuild_stock();

-- -----------------------------------------------------------------------------
-- B) PURCHASE INVOICES: decimal stock posting from qty_base
-- -----------------------------------------------------------------------------
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
      delete from public.stock_ledger
      where source = 'purchase_invoices'
        and source_id = new.id
        and direction = 'IN';

      insert into public.stock_ledger (
        company_id, product_id, qty, direction, reason, source, source_id, source_ref
      )
      select
        new.company_id,
        item.product_id,
        sum(coalesce(item.qty_base, item.quantity::numeric))::numeric(16,6),
        'IN',
        case when new.status = 'Pending' then 'purchase_pending' else 'purchase_approved' end,
        'purchase_invoices',
        new.id,
        new.id
      from public.purchase_invoice_items item
      where item.purchase_invoice_id = new.id
        and item.product_id is not null
      group by item.product_id;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    was_effective := public.purchase_invoice_is_effective(old.status);
    is_effective := public.purchase_invoice_is_effective(new.status);

    if is_effective then
      delete from public.stock_ledger
      where source = 'purchase_invoices'
        and source_id = new.id
        and direction = 'IN';

      insert into public.stock_ledger (
        company_id, product_id, qty, direction, reason, source, source_id, source_ref
      )
      select
        new.company_id,
        item.product_id,
        sum(coalesce(item.qty_base, item.quantity::numeric))::numeric(16,6),
        'IN',
        case when new.status = 'Pending' then 'purchase_pending' else 'purchase_approved' end,
        'purchase_invoices',
        new.id,
        new.id
      from public.purchase_invoice_items item
      where item.purchase_invoice_id = new.id
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
        sum(coalesce(item.qty_base, item.quantity::numeric))::numeric(16,6),
        'OUT',
        'purchase_reversal',
        'purchase_invoices',
        old.id,
        old.id
      from public.purchase_invoice_items item
      where item.purchase_invoice_id = old.id
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
    if public.purchase_invoice_is_effective(old.status) then
      insert into public.stock_ledger (
        company_id, product_id, qty, direction, reason, source, source_id, source_ref
      )
      select
        old.company_id,
        led.product_id,
        led.qty,
        'OUT',
        'purchase_delete',
        'purchase_invoices',
        old.id,
        old.id
      from public.stock_ledger led
      where led.source = 'purchase_invoices'
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

drop trigger if exists trg_purchase_invoices_apply_stock on public.purchase_invoices;
create trigger trg_purchase_invoices_apply_stock
after insert or update or delete on public.purchase_invoices
for each row
execute function public.purchase_invoices_apply_stock();

-- -----------------------------------------------------------------------------
-- C) SALES RETURNS + PURCHASE RETURNS decimal stock posting
-- -----------------------------------------------------------------------------
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
        sum(coalesce(item.qty_base, item.quantity::numeric))::numeric(16,6),
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
        sum(coalesce(item.qty_base, item.quantity::numeric))::numeric(16,6),
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
        sum(coalesce(item.qty_base, item.quantity::numeric))::numeric(16,6),
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
        and direction in ('IN', 'OUT');

      insert into public.stock_ledger
        (company_id, product_id, qty, direction, reason, source, source_id, source_ref)
      select
        new.company_id,
        i.product_id,
        sum(coalesce(i.qty_base, i.quantity::numeric))::numeric(16,6),
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
        sum(coalesce(i.qty_base, i.quantity::numeric))::numeric(16,6),
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

-- -----------------------------------------------------------------------------
-- D) Touch parent header when item rows change (forces stock rebuild on updates)
-- -----------------------------------------------------------------------------
create or replace function public.sales_invoice_items_touch_parent_for_stock()
returns trigger
language plpgsql
security definer
as $$
declare
  v_id text;
begin
  v_id := coalesce(new.invoice_id, old.invoice_id);
  if v_id is not null then
    update public.sales_invoices
    set updated_at = now()
    where id = v_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sales_invoice_items_touch_parent_for_stock on public.sales_invoice_items;
create trigger trg_sales_invoice_items_touch_parent_for_stock
after insert or update or delete on public.sales_invoice_items
for each row
execute function public.sales_invoice_items_touch_parent_for_stock();

create or replace function public.sales_return_items_touch_parent_for_stock()
returns trigger
language plpgsql
security definer
as $$
declare
  v_id text;
begin
  v_id := coalesce(new.sales_return_id, old.sales_return_id);
  if v_id is not null then
    update public.sales_returns
    set updated_at = now()
    where id = v_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sales_return_items_touch_parent_for_stock on public.sales_return_items;
create trigger trg_sales_return_items_touch_parent_for_stock
after insert or update or delete on public.sales_return_items
for each row
execute function public.sales_return_items_touch_parent_for_stock();

create or replace function public.purchase_invoice_items_touch_parent_for_stock()
returns trigger
language plpgsql
security definer
as $$
declare
  v_id text;
begin
  v_id := coalesce(new.purchase_invoice_id, old.purchase_invoice_id);
  if v_id is not null then
    update public.purchase_invoices
    set updated_at = now()
    where id = v_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_purchase_invoice_items_touch_parent_for_stock on public.purchase_invoice_items;
create trigger trg_purchase_invoice_items_touch_parent_for_stock
after insert or update or delete on public.purchase_invoice_items
for each row
execute function public.purchase_invoice_items_touch_parent_for_stock();

-- -----------------------------------------------------------------------------
-- E) Canonical qty synchronization on all item tables
-- -----------------------------------------------------------------------------
create or replace function public.sync_pack_qty_fields()
returns trigger
language plpgsql
as $$
begin
  if new.pack_factor is null or new.pack_factor <= 0 then
    new.pack_factor := 1;
  end if;

  if new.qty_pack is null or new.qty_pack <= 0 then
    if new.quantity is not null and new.quantity > 0 then
      new.qty_pack := new.quantity::numeric;
    else
      new.qty_pack := 1;
    end if;
  end if;

  new.quantity := new.qty_pack;
  new.qty_base := new.qty_pack * new.pack_factor;

  return new;
end;
$$;

drop trigger if exists trg_sync_pack_qty_quotation_items on public.quotation_items;
create trigger trg_sync_pack_qty_quotation_items
before insert or update on public.quotation_items
for each row execute function public.sync_pack_qty_fields();

drop trigger if exists trg_sync_pack_qty_sales_invoice_items on public.sales_invoice_items;
create trigger trg_sync_pack_qty_sales_invoice_items
before insert or update on public.sales_invoice_items
for each row execute function public.sync_pack_qty_fields();

drop trigger if exists trg_sync_pack_qty_sales_return_items on public.sales_return_items;
create trigger trg_sync_pack_qty_sales_return_items
before insert or update on public.sales_return_items
for each row execute function public.sync_pack_qty_fields();

drop trigger if exists trg_sync_pack_qty_purchase_order_items on public.purchase_order_items;
create trigger trg_sync_pack_qty_purchase_order_items
before insert or update on public.purchase_order_items
for each row execute function public.sync_pack_qty_fields();

drop trigger if exists trg_sync_pack_qty_purchase_invoice_items on public.purchase_invoice_items;
create trigger trg_sync_pack_qty_purchase_invoice_items
before insert or update on public.purchase_invoice_items
for each row execute function public.sync_pack_qty_fields();

drop trigger if exists trg_sync_pack_qty_purchase_return_items on public.purchase_return_items;
create trigger trg_sync_pack_qty_purchase_return_items
before insert or update on public.purchase_return_items
for each row execute function public.sync_pack_qty_fields();

-- Backfill existing mismatches
update public.quotation_items
set
  pack_factor = case when coalesce(pack_factor,0) <= 0 then 1 else pack_factor end,
  qty_pack = case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end,
  quantity = case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end,
  qty_base = (case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end)
             * (case when coalesce(pack_factor,0) <= 0 then 1 else pack_factor end);

update public.sales_invoice_items
set
  pack_factor = case when coalesce(pack_factor,0) <= 0 then 1 else pack_factor end,
  qty_pack = case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end,
  quantity = case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end,
  qty_base = (case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end)
             * (case when coalesce(pack_factor,0) <= 0 then 1 else pack_factor end);

update public.sales_return_items
set
  pack_factor = case when coalesce(pack_factor,0) <= 0 then 1 else pack_factor end,
  qty_pack = case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end,
  quantity = case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end,
  qty_base = (case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end)
             * (case when coalesce(pack_factor,0) <= 0 then 1 else pack_factor end);

update public.purchase_order_items
set
  pack_factor = case when coalesce(pack_factor,0) <= 0 then 1 else pack_factor end,
  qty_pack = case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end,
  quantity = case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end,
  qty_base = (case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end)
             * (case when coalesce(pack_factor,0) <= 0 then 1 else pack_factor end);

update public.purchase_invoice_items
set
  pack_factor = case when coalesce(pack_factor,0) <= 0 then 1 else pack_factor end,
  qty_pack = case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end,
  quantity = case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end,
  qty_base = (case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end)
             * (case when coalesce(pack_factor,0) <= 0 then 1 else pack_factor end);

update public.purchase_return_items
set
  pack_factor = case when coalesce(pack_factor,0) <= 0 then 1 else pack_factor end,
  qty_pack = case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end,
  quantity = case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end,
  qty_base = (case when coalesce(qty_pack,0) <= 0 then coalesce(quantity::numeric,1) else qty_pack end)
             * (case when coalesce(pack_factor,0) <= 0 then 1 else pack_factor end);

-- -----------------------------------------------------------------------------
-- F) Track migration
-- -----------------------------------------------------------------------------
insert into public.schema_migrations (filename, note)
select
  '2026-02-22_packaging_phase2_stock_and_qty_sync.sql',
  'Consolidated phase2: decimal stock triggers, touch-parent triggers, and qty sync'
where exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
