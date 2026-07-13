-- Centralize sales-invoice stock posting so normal triggers and future RPC saves
-- rebuild stock through the same path.

begin;

create or replace function public.rebuild_sales_invoice_stock(p_invoice_id text)
returns void
language plpgsql
security definer
as $$
declare
  v_invoice public.sales_invoices%rowtype;
begin
  select *
  into v_invoice
  from public.sales_invoices
  where id = p_invoice_id;

  if not found then
    return;
  end if;

  delete from public.stock_ledger
  where source = 'sales_invoices'
    and source_id = v_invoice.id
    and direction = 'OUT';

  if not public.sales_invoice_is_effective(v_invoice.status) then
    return;
  end if;

  insert into public.stock_ledger (
    company_id,
    product_id,
    qty,
    direction,
    reason,
    source,
    source_id,
    source_ref
  )
  select
    v_invoice.company_id,
    i.product_id,
    sum(coalesce(i.qty_base, i.quantity::numeric))::numeric(16,6),
    'OUT',
    case when v_invoice.status = 'Pending' then 'invoice_pending' else 'invoice_approved' end,
    'sales_invoices',
    v_invoice.id,
    v_invoice.id
  from public.sales_invoice_items i
  join public.products p on p.id = i.product_id
  where i.invoice_id = v_invoice.id
    and i.product_id is not null
    and lower(coalesce(p.product_type, 'product')) <> 'service'
  group by i.product_id
  having sum(coalesce(i.qty_base, i.quantity::numeric)) > 0;
end;
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
  if current_setting('app.skip_sales_invoice_stock_trigger', true) = 'on' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if public.sales_invoice_is_effective(new.status) then
      perform public.rebuild_sales_invoice_stock(new.id);
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if is_effective then
      perform public.rebuild_sales_invoice_stock(new.id);
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

create or replace function public.sales_invoice_items_touch_parent_for_stock()
returns trigger
language plpgsql
security definer
as $$
declare
  v_id text;
begin
  if current_setting('app.skip_sales_invoice_item_touch', true) = 'on' then
    return coalesce(new, old);
  end if;

  v_id := coalesce(new.invoice_id, old.invoice_id);
  if v_id is not null then
    update public.sales_invoices
    set updated_at = now()
    where id = v_id;
  end if;
  return coalesce(new, old);
end;
$$;

insert into public.schema_migrations (filename, note)
select
  '2026-05-26_sales_invoice_stock_rebuild_helper.sql',
  'Centralize sales invoice stock rebuilds and add item-touch bypass for RPC saves'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
