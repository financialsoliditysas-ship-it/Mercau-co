alter table public.business_catalog_orders
  add column if not exists action_token_hash text unique,
  add column if not exists action_expires_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists whatsapp_status text not null default 'not_attempted',
  add column if not exists whatsapp_message_id text,
  add column if not exists whatsapp_error text;

create table if not exists public.business_catalog_order_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.business_catalog_orders(id) on delete cascade,
  status text not null,
  actor_type text not null,
  actor_reference text,
  created_at timestamptz not null default now()
);
create index if not exists business_catalog_order_history_order_idx on public.business_catalog_order_history(order_id,created_at);
alter table public.business_catalog_order_history enable row level security;
revoke all on public.business_catalog_order_history from anon, authenticated;
