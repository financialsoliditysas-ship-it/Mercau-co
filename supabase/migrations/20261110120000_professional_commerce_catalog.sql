-- Additive migration. Existing catalog rows remain valid and unchanged.
alter table public.business_catalog_products
  add column if not exists publication_type text not null default 'product',
  add column if not exists category text not null default '',
  add column if not exists subcategory text not null default '',
  add column if not exists brand text not null default '',
  add column if not exists condition text not null default '',
  add column if not exists sku text not null default '',
  add column if not exists price_mode text not null default 'fixed',
  add column if not exists attributes jsonb not null default '[]'::jsonb,
  add column if not exists variants jsonb not null default '[]'::jsonb,
  add column if not exists gallery jsonb not null default '[]'::jsonb;

alter table public.business_catalog_products
  drop constraint if exists business_catalog_products_publication_type_check,
  add constraint business_catalog_products_publication_type_check check (publication_type in ('product','service')),
  drop constraint if exists business_catalog_products_price_mode_check,
  add constraint business_catalog_products_price_mode_check check (price_mode in ('fixed','from','quote'));

create index if not exists business_catalog_products_category_idx
  on public.business_catalog_products (business_id, category, subcategory)
  where status = 'published';

comment on column public.business_catalog_products.attributes is 'Structured informational attributes shown to buyers.';
comment on column public.business_catalog_products.variants is 'Selectable variant combinations with availability, inventory, price, SKU and optional image path.';

alter table public.directory_businesses
  add column if not exists subcategory text not null default '',
  add column if not exists secondary_categories text[] not null default '{}',
  add column if not exists tags text[] not null default '{}',
  add column if not exists commerce_plan text;

alter table public.directory_businesses
  drop constraint if exists directory_businesses_commerce_plan_check,
  add constraint directory_businesses_commerce_plan_check
  check (commerce_plan is null or commerce_plan in ('presencia','vitrina','ventas','ventas_plus'));

create table if not exists public.business_catalog_orders (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  business_id text not null references public.directory_businesses(id),
  buyer_id uuid references auth.users(id),
  customer_name text not null,
  customer_phone text not null,
  delivery_municipality text not null,
  delivery_address text not null,
  customer_notes text not null default '',
  items jsonb not null,
  subtotal integer not null check (subtotal >= 0),
  status text not null default 'received' check (status in ('received','accepted','rejected','preparing','ready','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_catalog_orders_business_created_idx
  on public.business_catalog_orders(business_id, created_at desc);
alter table public.business_catalog_orders enable row level security;
revoke all on public.business_catalog_orders from anon, authenticated;
