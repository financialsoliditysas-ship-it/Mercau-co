begin;

alter table public.business_catalog_products
  add column if not exists option_groups jsonb not null default '[]'::jsonb;

alter table public.business_catalog_products
  drop constraint if exists business_catalog_option_groups_shape;

alter table public.business_catalog_products
  add constraint business_catalog_option_groups_shape
  check (jsonb_typeof(option_groups) = 'array' and jsonb_array_length(option_groups) <= 8);

comment on column public.business_catalog_products.option_groups is
  'Validated product customization groups. Order lines keep an immutable snapshot of selected labels and prices.';

commit;
