-- Add Urdu name support to products
alter table if exists public.products
add column if not exists urdu_name text;
