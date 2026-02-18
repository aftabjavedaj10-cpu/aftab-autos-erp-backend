-- Add reorder quantity to products for low-inventory bulk purchase orders
alter table public.products
add column if not exists reorder_qty integer not null default 1;

