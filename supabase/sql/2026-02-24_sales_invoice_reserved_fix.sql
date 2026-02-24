-- Fix reserved-qty leak on sales invoice void/delete transitions.
-- When an effective invoice (especially Pending) becomes non-effective,
-- keep stock reversal but stop counting old OUT rows as reserved.

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
      -- Critical fix: pending OUT rows must not remain "invoice_pending"
      -- after void/delete transitions, otherwise reserved qty stays stuck.
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

insert into public.schema_migrations (filename, note)
select
  '2026-02-24_sales_invoice_reserved_fix.sql',
  'Fix reserved qty leak on sales invoice void/delete by relabeling pending OUT rows'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;

