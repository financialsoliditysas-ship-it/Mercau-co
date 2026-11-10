create table if not exists public.business_catalog_payment_methods (
  business_id text not null references public.directory_businesses(id) on delete cascade,
  method text not null check (method in ('BANCOLOMBIA','NEQUI','BRE_B')),
  enabled boolean not null default false,
  account_holder text not null default '',
  destination text not null default '',
  detail text not null default '',
  updated_at timestamptz not null default now(),
  primary key (business_id,method)
);
alter table public.business_catalog_payment_methods enable row level security;
revoke all on public.business_catalog_payment_methods from anon,authenticated;

alter table public.business_catalog_orders
  add column if not exists payment_method text,
  add column if not exists payment_status text not null default 'reported',
  add column if not exists payment_reference text,
  add column if not exists payment_proof_path text,
  add column if not exists payment_reported_at timestamptz,
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_recipient jsonb not null default '{}'::jsonb,
  add column if not exists commission_rate_bps integer not null default 0,
  add column if not exists commission_amount integer not null default 0;

alter table public.business_catalog_orders
  drop constraint if exists business_catalog_orders_payment_method_check,
  add constraint business_catalog_orders_payment_method_check check (payment_method is null or payment_method in ('BANCOLOMBIA','NEQUI','BRE_B')),
  drop constraint if exists business_catalog_orders_payment_status_check,
  add constraint business_catalog_orders_payment_status_check check (payment_status in ('reported','confirmed','not_received','refunded'));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('commerce-payment-proofs','commerce-payment-proofs',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;
