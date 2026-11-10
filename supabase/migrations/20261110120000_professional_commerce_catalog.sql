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
  add column if not exists tags text[] not null default '{}';
