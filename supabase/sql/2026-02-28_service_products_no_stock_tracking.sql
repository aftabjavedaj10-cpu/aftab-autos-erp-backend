-- Ensure Service products never affect inventory tracking.
-- 1) Exclude Service products from all stock-posting triggers.
-- 2) Guard stock_ledger writes so Service products cannot be inserted/updated.

begin;

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
      join public.products p on p.id = i.product_id
      where i.invoice_id = new.id
        and i.product_id is not null
        and lower(coalesce(p.product_type, 'product')) <> 'service'
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
      join public.products p on p.id = i.product_id
      where i.invoice_id = new.id
        and i.product_id is not null
        and lower(coalesce(p.product_type, 'product')) <> 'service'
      group by i.product_id;
    end if;

    if was_effective and not is_effective then
      update public.stock_ledger
      set reason = case
        when reason = 'invoice_pending' then 'invoice_voided'
        else reason
      end
      where source = 'sales_invoices'
        and source_id = old.id
        and direction = 'OUT';

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
      update public.stock_ledger
      set reason = case
        when reason = 'invoice_pending' then 'invoice_voided'
        else reason
      end
      where source = 'sales_invoices'
        and source_id = old.id
        and direction = 'OUT';

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
      join public.products p on p.id = item.product_id
      where item.purchase_invoice_id = new.id
        and item.product_id is not null
        and lower(coalesce(p.product_type, 'product')) <> 'service'
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
      join public.products p on p.id = item.product_id
      where item.purchase_invoice_id = new.id
        and item.product_id is not null
        and lower(coalesce(p.product_type, 'product')) <> 'service'
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
      join public.products p on p.id = item.product_id
      where item.purchase_invoice_id = old.id
        and item.product_id is not null
        and lower(coalesce(p.product_type, 'product')) <> 'service'
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
      join public.products p on p.id = item.product_id
      where item.sales_return_id = new.id
        and item.product_id is not null
        and lower(coalesce(p.product_type, 'product')) <> 'service'
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
      join public.products p on p.id = item.product_id
      where item.sales_return_id = new.id
        and item.product_id is not null
        and lower(coalesce(p.product_type, 'product')) <> 'service'
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
      join public.products p on p.id = item.product_id
      where item.sales_return_id = old.id
        and item.product_id is not null
        and lower(coalesce(p.product_type, 'product')) <> 'service'
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
      join public.products p on p.id = i.product_id
      where i.purchase_return_id = new.id
        and i.product_id is not null
        and lower(coalesce(p.product_type, 'product')) <> 'service'
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
      join public.products p on p.id = i.product_id
      where i.purchase_return_id = new.id
        and i.product_id is not null
        and lower(coalesce(p.product_type, 'product')) <> 'service'
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

create or replace function public.stock_ledger_block_service_products()
returns trigger
language plpgsql
as $$
declare
  v_is_service boolean := false;
begin
  if new.product_id is null then
    return new;
  end if;

  select lower(coalesce(p.product_type, 'product')) = 'service'
  into v_is_service
  from public.products p
  where p.id = new.product_id;

  if coalesce(v_is_service, false) then
    raise exception 'Service products are not stock-tracked and cannot be posted to stock_ledger (product_id=%).', new.product_id
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

delete from public.stock_ledger sl
using public.products p
where p.id = sl.product_id
  and lower(coalesce(p.product_type, 'product')) = 'service';

drop trigger if exists trg_stock_ledger_block_service_products on public.stock_ledger;
create trigger trg_stock_ledger_block_service_products
before insert or update of product_id on public.stock_ledger
for each row
execute function public.stock_ledger_block_service_products();

insert into public.schema_migrations (filename, note)
select
  '2026-02-28_service_products_no_stock_tracking.sql',
  'Exclude Service products from stock posting and block service rows in stock_ledger'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
