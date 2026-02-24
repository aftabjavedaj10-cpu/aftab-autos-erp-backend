-- Setup master data: Units and Warehouses (company-scoped)
-- Safe additive migration.

begin;

create table if not exists public.units (
  id bigserial primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.warehouses (
  id bigserial primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create index if not exists idx_units_company_created
  on public.units(company_id, created_at desc);
create index if not exists idx_units_company_active
  on public.units(company_id, is_active);

create index if not exists idx_warehouses_company_created
  on public.warehouses(company_id, created_at desc);
create index if not exists idx_warehouses_company_active
  on public.warehouses(company_id, is_active);

create or replace function public.touch_units_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_units_updated_at on public.units;
create trigger trg_units_updated_at
before update on public.units
for each row
execute function public.touch_units_updated_at();

create or replace function public.touch_warehouses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_warehouses_updated_at on public.warehouses;
create trigger trg_warehouses_updated_at
before update on public.warehouses
for each row
execute function public.touch_warehouses_updated_at();

alter table public.units enable row level security;
alter table public.warehouses enable row level security;

drop policy if exists units_read on public.units;
create policy units_read
on public.units
for select
to authenticated
using (has_company_permission(company_id, 'products.read'));

drop policy if exists units_insert on public.units;
create policy units_insert
on public.units
for insert
to authenticated
with check (has_company_permission(company_id, 'products.write'));

drop policy if exists units_update on public.units;
create policy units_update
on public.units
for update
to authenticated
using (has_company_permission(company_id, 'products.write'))
with check (has_company_permission(company_id, 'products.write'));

drop policy if exists units_delete on public.units;
create policy units_delete
on public.units
for delete
to authenticated
using (has_company_permission(company_id, 'products.delete'));

drop policy if exists warehouses_read on public.warehouses;
create policy warehouses_read
on public.warehouses
for select
to authenticated
using (has_company_permission(company_id, 'products.read'));

drop policy if exists warehouses_insert on public.warehouses;
create policy warehouses_insert
on public.warehouses
for insert
to authenticated
with check (has_company_permission(company_id, 'products.write'));

drop policy if exists warehouses_update on public.warehouses;
create policy warehouses_update
on public.warehouses
for update
to authenticated
using (has_company_permission(company_id, 'products.write'))
with check (has_company_permission(company_id, 'products.write'));

drop policy if exists warehouses_delete on public.warehouses;
create policy warehouses_delete
on public.warehouses
for delete
to authenticated
using (has_company_permission(company_id, 'products.delete'));

insert into public.schema_migrations (filename, note)
select
  '2026-02-23_setup_units_warehouses.sql',
  'Create units and warehouses master tables with RLS policies'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'schema_migrations'
)
on conflict (filename) do nothing;

commit;
