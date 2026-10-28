begin;

create table if not exists public.business_catalog_option_groups (
  id uuid primary key default gen_random_uuid(),
  business_id text not null check (business_id ~ '^rec[A-Za-z0-9]{14}$'),
  name text not null check (length(trim(name)) between 1 and 80),
  group_data jsonb not null check (jsonb_typeof(group_data) = 'object'),
  version integer not null default 1 check (version >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists business_catalog_option_groups_name_idx
  on public.business_catalog_option_groups (business_id, lower(trim(name)))
  where active;
create index if not exists business_catalog_option_groups_business_idx
  on public.business_catalog_option_groups (business_id, active, created_at);

create table if not exists public.business_catalog_product_option_groups (
  product_id uuid not null references public.business_catalog_products(id) on delete cascade,
  group_id uuid not null references public.business_catalog_option_groups(id) on delete cascade,
  business_id text not null check (business_id ~ '^rec[A-Za-z0-9]{14}$'),
  position integer not null default 0 check (position between 0 and 7),
  created_at timestamptz not null default now(),
  primary key (product_id, group_id)
);

create index if not exists business_catalog_product_option_groups_business_idx
  on public.business_catalog_product_option_groups (business_id, product_id, position);
create index if not exists business_catalog_product_option_groups_group_idx
  on public.business_catalog_product_option_groups (group_id);

alter table public.business_catalog_option_groups enable row level security;
alter table public.business_catalog_product_option_groups enable row level security;

revoke all on public.business_catalog_option_groups from public, anon, authenticated;
revoke all on public.business_catalog_product_option_groups from public, anon, authenticated;
grant select, insert, update, delete on public.business_catalog_option_groups to service_role;
grant select, insert, update, delete on public.business_catalog_product_option_groups to service_role;

comment on table public.business_catalog_option_groups is
  'Private reusable catalog option groups. Access is restricted to authenticated server routes.';
comment on table public.business_catalog_product_option_groups is
  'Private links between reusable option groups and catalog products.';

commit;
