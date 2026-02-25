-- Fix Supabase lint security findings:
-- 1) security_definer_view on public.stock_balance
-- 2) rls_disabled_in_public on public.product_packagings
-- 3) rls_disabled_in_public on public.schema_migrations

begin;

-- Ensure stock_balance runs with querying-user permissions (not definer).
do $$
begin
  if to_regclass('public.stock_balance') is not null then
    execute 'alter view public.stock_balance set (security_invoker = true)';
  end if;
end $$;

-- Enable RLS for product_packagings and scope access through parent product.company_id.
alter table if exists public.product_packagings enable row level security;

drop policy if exists product_packagings_read on public.product_packagings;
create policy product_packagings_read
on public.product_packagings
for select
to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_packagings.product_id
      and has_company_permission(p.company_id, 'products.read')
  )
);

drop policy if exists product_packagings_insert on public.product_packagings;
create policy product_packagings_insert
on public.product_packagings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.products p
    where p.id = product_packagings.product_id
      and has_company_permission(p.company_id, 'products.write')
  )
);

drop policy if exists product_packagings_update on public.product_packagings;
create policy product_packagings_update
on public.product_packagings
for update
to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_packagings.product_id
      and has_company_permission(p.company_id, 'products.write')
  )
)
with check (
  exists (
    select 1
    from public.products p
    where p.id = product_packagings.product_id
      and has_company_permission(p.company_id, 'products.write')
  )
);

drop policy if exists product_packagings_delete on public.product_packagings;
create policy product_packagings_delete
on public.product_packagings
for delete
to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_packagings.product_id
      and has_company_permission(p.company_id, 'products.delete')
  )
);

-- Keep migration tracker non-public by enabling RLS (no authenticated policies).
alter table if exists public.schema_migrations enable row level security;

insert into public.schema_migrations (filename, note)
select
  '2026-02-25_security_lint_fixes.sql',
  'Fix stock_balance security invoker and enable RLS on product_packagings/schema_migrations'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
