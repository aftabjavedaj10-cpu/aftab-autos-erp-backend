-- Prevent converting stock-tracked products to Service while stock balance is non-zero.

begin;

create or replace function public.products_block_service_switch_with_stock()
returns trigger
language plpgsql
as $$
declare
  v_old_type text := lower(coalesce(old.product_type, 'product'));
  v_new_type text := lower(coalesce(new.product_type, 'product'));
  v_net_qty numeric(16,6) := 0;
begin
  if tg_op = 'UPDATE'
     and v_old_type <> 'service'
     and v_new_type = 'service' then
    select coalesce(
      sum(
        case
          when sl.direction = 'IN' then sl.qty
          else -sl.qty
        end
      ),
      0
    )::numeric(16,6)
    into v_net_qty
    from public.stock_ledger sl
    where sl.product_id = new.id;

    if abs(v_net_qty) > 0.000001 then
      raise exception 'Cannot change product to Service while stock balance is non-zero (product_id=%, balance=%). Set stock to zero first.', new.id, v_net_qty
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_products_block_service_switch_with_stock on public.products;
create trigger trg_products_block_service_switch_with_stock
before update of product_type on public.products
for each row
execute function public.products_block_service_switch_with_stock();

insert into public.schema_migrations (filename, note)
select
  '2026-02-28_product_to_service_stock_guard.sql',
  'Block Product->Service conversion when stock ledger balance is non-zero'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
