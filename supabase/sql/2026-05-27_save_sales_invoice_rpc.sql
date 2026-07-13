-- Save a sales invoice and its items in one database transaction.
-- This keeps current replace-all-items behavior, but avoids rebuilding stock once
-- per line item and returns the saved invoice with items for the frontend mapper.

begin;

create or replace function public.save_sales_invoice(
  p_invoice jsonb,
  p_items jsonb default '[]'::jsonb,
  p_is_update boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id text := nullif(trim(p_invoice->>'id'), '');
  v_saved public.sales_invoices%rowtype;
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
begin
  if v_id is null then
    raise exception 'Invoice id is required';
  end if;

  perform set_config('app.skip_sales_invoice_stock_trigger', 'on', true);
  perform set_config('app.skip_sales_invoice_item_touch', 'on', true);

  insert into public.sales_invoices (
    id,
    customer_id,
    customer_name,
    reference,
    vehicle_number,
    date,
    due_date,
    status,
    payment_status,
    notes,
    overall_discount,
    amount_received,
    total_amount,
    company_id,
    owner_id,
    updated_at
  )
  values (
    v_id,
    nullif(p_invoice->>'customer_id', '')::integer,
    coalesce(nullif(p_invoice->>'customer_name', ''), 'Unknown'),
    nullif(p_invoice->>'reference', ''),
    nullif(p_invoice->>'vehicle_number', ''),
    nullif(p_invoice->>'date', '')::date,
    nullif(p_invoice->>'due_date', '')::date,
    coalesce(nullif(p_invoice->>'status', ''), 'Draft'),
    coalesce(nullif(p_invoice->>'payment_status', ''), 'Unpaid'),
    nullif(p_invoice->>'notes', ''),
    coalesce(nullif(p_invoice->>'overall_discount', '')::numeric, 0),
    coalesce(nullif(p_invoice->>'amount_received', '')::numeric, 0),
    coalesce(nullif(p_invoice->>'total_amount', '')::numeric, 0),
    nullif(p_invoice->>'company_id', ''),
    nullif(p_invoice->>'owner_id', ''),
    now()
  )
  on conflict (id) do update set
    customer_id = excluded.customer_id,
    customer_name = excluded.customer_name,
    reference = excluded.reference,
    vehicle_number = excluded.vehicle_number,
    date = excluded.date,
    due_date = excluded.due_date,
    status = excluded.status,
    payment_status = excluded.payment_status,
    notes = excluded.notes,
    overall_discount = excluded.overall_discount,
    amount_received = excluded.amount_received,
    total_amount = excluded.total_amount,
    company_id = excluded.company_id,
    owner_id = excluded.owner_id,
    updated_at = now()
  where p_is_update
  returning * into v_saved;

  if v_saved.id is null then
    raise exception 'duplicate key value violates unique constraint "sales_invoices_pkey"';
  end if;

  delete from public.sales_invoice_items
  where invoice_id = v_saved.id;

  insert into public.sales_invoice_items (
    invoice_id,
    line_order,
    product_id,
    product_code,
    product_name,
    description,
    unit,
    quantity,
    packaging_id,
    pack_factor,
    qty_pack,
    qty_base,
    unit_price,
    discount_value,
    discount_type,
    tax,
    total,
    company_id
  )
  select
    v_saved.id,
    coalesce(nullif(item->>'line_order', '')::integer, ordinality::integer),
    nullif(item->>'product_id', '')::integer,
    coalesce(nullif(item->>'product_code', ''), ''),
    coalesce(nullif(item->>'product_name', ''), ''),
    nullif(item->>'description', ''),
    nullif(item->>'unit', ''),
    coalesce(nullif(item->>'quantity', '')::numeric, 0),
    nullif(item->>'packaging_id', '')::uuid,
    coalesce(nullif(item->>'pack_factor', '')::numeric, 1),
    coalesce(nullif(item->>'qty_pack', '')::numeric, nullif(item->>'quantity', '')::numeric, 0),
    coalesce(
      nullif(item->>'qty_base', '')::numeric,
      coalesce(nullif(item->>'qty_pack', '')::numeric, nullif(item->>'quantity', '')::numeric, 0)
        * coalesce(nullif(item->>'pack_factor', '')::numeric, 1)
    ),
    coalesce(nullif(item->>'unit_price', '')::numeric, 0),
    coalesce(nullif(item->>'discount_value', '')::numeric, 0),
    coalesce(nullif(item->>'discount_type', ''), 'fixed'),
    coalesce(nullif(item->>'tax', '')::numeric, 0),
    coalesce(nullif(item->>'total', '')::numeric, 0),
    v_saved.company_id
  from jsonb_array_elements(v_items) with ordinality as rows(item, ordinality);

  perform public.rebuild_sales_invoice_stock(v_saved.id);

  select *
  into v_saved
  from public.sales_invoices
  where id = v_saved.id;

  return to_jsonb(v_saved) || jsonb_build_object(
    'items',
    coalesce(
      (
        select jsonb_agg(to_jsonb(i) order by i.line_order asc, i.id asc)
        from public.sales_invoice_items i
        where i.invoice_id = v_saved.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.save_sales_invoice(jsonb, jsonb, boolean) to authenticated, service_role;

insert into public.schema_migrations (filename, note)
select
  '2026-05-27_save_sales_invoice_rpc.sql',
  'Add transactional sales invoice save RPC with one final stock rebuild'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
