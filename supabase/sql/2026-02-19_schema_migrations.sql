-- Track applied migrations for safer prod rollouts
create table if not exists public.schema_migrations (
  id bigserial primary key,
  filename text not null unique,
  applied_at timestamptz not null default now(),
  note text
);

-- Seed this migration as applied (idempotent)
insert into public.schema_migrations (filename, note)
values (
  '2026-02-19_schema_migrations.sql',
  'Create schema_migrations tracker table'
)
on conflict (filename) do nothing;

