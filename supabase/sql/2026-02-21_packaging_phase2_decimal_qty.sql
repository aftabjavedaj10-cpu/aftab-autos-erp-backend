-- Phase 2: switch line-item quantity columns to decimal and sync with phase-1 packaging fields
-- Safe for repeated runs.

begin;

do $$
declare
  t text;
  item_tables text[] := array[
    'quotation_items',
    'sales_invoice_items',
    'sales_return_items',
    'purchase_order_items',
    'purchase_invoice_items',
    'purchase_return_items'
  ];
begin
  foreach t in array item_tables loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;

    -- Change legacy quantity to decimal so existing reads/writes and triggers continue to work.
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t
        and column_name = 'quantity'
        and data_type in ('smallint', 'integer', 'bigint')
    ) then
      execute format(
        'alter table public.%I alter column quantity type numeric(14,3) using quantity::numeric',
        t
      );
    end if;

    -- Keep phase-1 columns consistent and required.
    execute format('update public.%I set pack_factor = 1 where pack_factor is null or pack_factor <= 0', t);
    execute format('update public.%I set qty_pack = quantity where qty_pack is null', t);
    execute format('update public.%I set qty_base = qty_pack * pack_factor where qty_base is null', t);

    execute format('alter table public.%I alter column quantity set default 1', t);
    execute format('alter table public.%I alter column quantity set not null', t);
    execute format('alter table public.%I alter column qty_pack set default 1', t);
    execute format('alter table public.%I alter column qty_pack set not null', t);
    execute format('alter table public.%I alter column qty_base set default 1', t);
    execute format('alter table public.%I alter column qty_base set not null', t);
  end loop;
end $$;

insert into public.schema_migrations (filename, note)
select
  '2026-02-21_packaging_phase2_decimal_qty.sql',
  'Phase 2 decimal quantity on line items + packaging sync'
where exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
