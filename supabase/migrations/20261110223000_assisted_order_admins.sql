create table if not exists public.assisted_order_admins (
  email text primary key check (email = lower(trim(email))),
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assisted_order_admins enable row level security;

insert into public.assisted_order_admins (email, display_name, active)
values
  ('isveri.20@gmail.com', null, true),
  ('yeinsonrivera18@gmail.com', 'Yeison Vega Rivera', true)
on conflict (email) do update
set display_name = excluded.display_name,
    active = excluded.active,
    updated_at = now();
