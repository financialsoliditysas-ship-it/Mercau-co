create sequence if not exists public.delivery_order_public_id_seq;

create or replace function public.next_delivery_public_id()
returns text
language plpgsql
as $$
begin
  return 'MCU-' || lpad(nextval('public.delivery_order_public_id_seq')::text, 6, '0');
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.next_delivery_public_id(),
  service_type text not null,
  customer_name text not null,
  customer_phone text not null,
  pickup_name text not null,
  pickup_address text not null,
  pickup_neighborhood text,
  pickup_contact text,
  pickup_phone text not null,
  pickup_instructions text,
  delivery_name text not null,
  delivery_address text not null,
  delivery_neighborhood text,
  delivery_phone text not null,
  delivery_instructions text,
  description text not null,
  notes text,
  delivery_fee integer not null default 5000,
  status text not null default 'created',
  source text not null default 'WEB',
  shipday_order_id text,
  shipday_status text,
  shipday_tracking_url text,
  shipday_last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  constraint delivery_orders_status_check check (
    status in (
      'created',
      'sent_to_shipday',
      'integration_error',
      'assigned',
      'picked_up',
      'in_transit',
      'delivered',
      'failed',
      'cancelled'
    )
  ),
  constraint delivery_orders_source_check check (source in ('WEB', 'WHATSAPP', 'ADMIN'))
);

drop trigger if exists set_delivery_orders_updated_at on public.delivery_orders;
create trigger set_delivery_orders_updated_at
before update on public.delivery_orders
for each row execute function public.set_updated_at();

create table if not exists public.delivery_status_history (
  id uuid primary key default gen_random_uuid(),
  delivery_order_id uuid not null references public.delivery_orders(id) on delete cascade,
  status text not null,
  source text not null,
  external_status text,
  external_event text,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint delivery_status_history_status_check check (
    status in (
      'created',
      'sent_to_shipday',
      'integration_error',
      'assigned',
      'picked_up',
      'in_transit',
      'delivered',
      'failed',
      'cancelled'
    )
  )
);

create unique index if not exists delivery_status_history_dedupe_key_idx
on public.delivery_status_history (dedupe_key)
where dedupe_key is not null;

create index if not exists delivery_orders_public_id_idx on public.delivery_orders(public_id);
create index if not exists delivery_orders_shipday_order_id_idx on public.delivery_orders(shipday_order_id);
create index if not exists delivery_orders_created_at_idx on public.delivery_orders(created_at desc);
create index if not exists delivery_status_history_order_idx on public.delivery_status_history(delivery_order_id, created_at);

alter table public.delivery_orders enable row level security;
alter table public.delivery_status_history enable row level security;
