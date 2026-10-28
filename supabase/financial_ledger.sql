begin;

create table if not exists public.order_financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  food_order_id uuid not null unique references public.pilot_food_orders(id),
  delivery_order_id uuid references public.delivery_orders(id),
  order_public_id text not null unique,
  restaurant_id text not null references public.pilot_restaurants(id),
  currency text not null default 'COP' check (currency = 'COP'),
  product_subtotal bigint not null check (product_subtotal >= 0),
  delivery_fee bigint not null check (delivery_fee >= 0),
  customer_total bigint not null check (customer_total = product_subtotal + delivery_fee),
  merchant_commission_rate_bps integer not null default 1500 check (merchant_commission_rate_bps between 0 and 10000),
  merchant_commission_total bigint not null check (merchant_commission_total >= 0),
  merchant_commission_base bigint not null check (merchant_commission_base >= 0),
  merchant_commission_vat bigint not null check (merchant_commission_vat >= 0),
  merchant_net bigint not null check (merchant_net >= 0),
  mercau_delivery_rate_bps integer not null default 500 check (mercau_delivery_rate_bps between 0 and 10000),
  mercau_delivery_share bigint not null check (mercau_delivery_share >= 0),
  logistics_pool bigint not null check (logistics_pool >= 0),
  courier_rate_bps integer not null default 7000 check (courier_rate_bps between 0 and 10000),
  courier_share bigint not null check (courier_share >= 0),
  vega_share bigint not null check (vega_share >= 0),
  payment_method text not null default 'CASH' check (payment_method in ('CASH','BREB_QR')),
  payment_status text not null default 'PENDING' check (payment_status in ('PENDING','CONFIRMED','FAILED','REFUNDED')),
  settlement_status text not null default 'PENDING' check (settlement_status in ('PENDING','PARTIAL','SETTLED','DISPUTED')),
  policy_version text not null default '2026-10-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (merchant_commission_total = merchant_commission_base + merchant_commission_vat),
  check (merchant_net + merchant_commission_total = product_subtotal),
  check (mercau_delivery_share + logistics_pool = delivery_fee),
  check (courier_share + vega_share = logistics_pool)
);

create table if not exists public.financial_events (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.order_financial_snapshots(id),
  event_key text not null unique,
  event_type text not null check (event_type in ('PAYMENT_CONFIRMED','PAYMENT_FAILED','REFUND','SETTLEMENT','ADJUSTMENT','CASH_HANDOVER')),
  amount bigint not null check (amount >= 0),
  method text check (method in ('CASH','BREB_QR','BANK_TRANSFER','INTERNAL')),
  external_reference text,
  actor_type text not null default 'SYSTEM' check (actor_type in ('SYSTEM','ADMIN','MERCHANT','COURIER')),
  actor_reference text,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.financial_journals (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.order_financial_snapshots(id),
  event_id uuid not null unique references public.financial_events(id),
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.financial_journals(id),
  account_code text not null,
  party_type text not null check (party_type in ('CUSTOMER','MERCHANT','MERCAU','VEGA_EXPRESS','COURIER','CASH_CLEARING','BANK_CLEARING')),
  party_reference text,
  debit bigint not null default 0 check (debit >= 0),
  credit bigint not null default 0 check (credit >= 0),
  currency text not null default 'COP' check (currency = 'COP'),
  created_at timestamptz not null default now(),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create table if not exists public.financial_settlements (
  id uuid primary key default gen_random_uuid(),
  payee_type text not null check (payee_type in ('MERCHANT','COURIER','VEGA_EXPRESS','MERCAU')),
  payee_reference text,
  amount bigint not null check (amount > 0),
  method text not null check (method in ('CASH','BREB_QR','BANK_TRANSFER','INTERNAL')),
  status text not null default 'PENDING' check (status in ('PENDING','CONFIRMED','VOID')),
  external_reference text,
  idempotency_key text not null unique,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_settlement_items (
  settlement_id uuid not null references public.financial_settlements(id),
  snapshot_id uuid not null references public.order_financial_snapshots(id),
  component text not null check (component in ('MERCHANT_NET','COURIER_SHARE','VEGA_SHARE','MERCAU_INCOME','REFUND','ADJUSTMENT')),
  amount bigint not null check (amount > 0),
  primary key (settlement_id, snapshot_id, component)
);

create index if not exists financial_snapshot_restaurant_idx on public.order_financial_snapshots(restaurant_id, created_at desc);
create index if not exists financial_event_snapshot_idx on public.financial_events(snapshot_id, occurred_at);
create index if not exists financial_entry_journal_idx on public.financial_ledger_entries(journal_id);

create or replace function public.financial_snapshot_food_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  commission_total bigint; commission_base bigint; platform_share bigint;
  pool bigint; courier_amount bigint;
begin
  commission_total := round(new.subtotal * 0.15);
  commission_base := round(commission_total / 1.19);
  platform_share := round(new.delivery_fee * 0.05);
  pool := new.delivery_fee - platform_share;
  courier_amount := round(pool * 0.70);
  insert into public.order_financial_snapshots(
    food_order_id, delivery_order_id, order_public_id, restaurant_id,
    product_subtotal, delivery_fee, customer_total,
    merchant_commission_total, merchant_commission_base, merchant_commission_vat, merchant_net,
    mercau_delivery_share, logistics_pool, courier_share, vega_share)
  values (new.id, new.delivery_order_id, new.public_id, new.restaurant_id,
    new.subtotal, new.delivery_fee, new.subtotal + new.delivery_fee,
    commission_total, commission_base, commission_total - commission_base, new.subtotal - commission_total,
    platform_share, pool, courier_amount, pool - courier_amount)
  on conflict (food_order_id) do update set delivery_order_id = coalesce(excluded.delivery_order_id, public.order_financial_snapshots.delivery_order_id), updated_at = now();
  return new;
end;
$$;

drop trigger if exists financial_snapshot_on_food_order on public.pilot_food_orders;
create trigger financial_snapshot_on_food_order after insert or update of delivery_order_id on public.pilot_food_orders
for each row execute function public.financial_snapshot_food_order();

insert into public.order_financial_snapshots(
  food_order_id, delivery_order_id, order_public_id, restaurant_id,
  product_subtotal, delivery_fee, customer_total,
  merchant_commission_total, merchant_commission_base, merchant_commission_vat, merchant_net,
  mercau_delivery_share, logistics_pool, courier_share, vega_share)
select o.id, o.delivery_order_id, o.public_id, o.restaurant_id,
  o.subtotal, o.delivery_fee, o.subtotal + o.delivery_fee,
  round(o.subtotal * 0.15), round(round(o.subtotal * 0.15) / 1.19),
  round(o.subtotal * 0.15) - round(round(o.subtotal * 0.15) / 1.19),
  o.subtotal - round(o.subtotal * 0.15),
  round(o.delivery_fee * 0.05), o.delivery_fee - round(o.delivery_fee * 0.05),
  round((o.delivery_fee - round(o.delivery_fee * 0.05)) * 0.70),
  (o.delivery_fee - round(o.delivery_fee * 0.05)) - round((o.delivery_fee - round(o.delivery_fee * 0.05)) * 0.70)
from public.pilot_food_orders o
on conflict (food_order_id) do nothing;

alter table public.order_financial_snapshots enable row level security;
alter table public.financial_events enable row level security;
alter table public.financial_journals enable row level security;
alter table public.financial_ledger_entries enable row level security;
alter table public.financial_settlements enable row level security;
alter table public.financial_settlement_items enable row level security;

revoke all on public.order_financial_snapshots, public.financial_events, public.financial_journals,
  public.financial_ledger_entries, public.financial_settlements, public.financial_settlement_items from public, anon, authenticated;
grant select, insert, update, delete on public.order_financial_snapshots, public.financial_events, public.financial_journals,
  public.financial_ledger_entries, public.financial_settlements, public.financial_settlement_items to service_role;

revoke all on function public.financial_snapshot_food_order() from public, anon, authenticated;

create or replace function public.financial_record_payment(
  p_snapshot uuid, p_event_key text, p_method text, p_external_reference text default null,
  p_actor_type text default 'ADMIN', p_actor_reference text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.order_financial_snapshots; e public.financial_events; j public.financial_journals;
begin
  if p_event_key is null or length(trim(p_event_key)) < 8 then raise exception 'Clave de idempotencia invalida'; end if;
  if p_method not in ('CASH','BREB_QR') then raise exception 'Metodo de pago invalido'; end if;
  select * into s from public.order_financial_snapshots where id = p_snapshot for update;
  if not found then raise exception 'Registro financiero no encontrado'; end if;
  select * into e from public.financial_events where event_key = p_event_key;
  if found then return jsonb_build_object('ok', true, 'duplicate', true, 'event_id', e.id); end if;
  if s.payment_status = 'CONFIRMED' then raise exception 'El pago ya fue confirmado con otro evento'; end if;

  insert into public.financial_events(snapshot_id,event_key,event_type,amount,method,external_reference,actor_type,actor_reference)
  values(s.id,trim(p_event_key),'PAYMENT_CONFIRMED',s.customer_total,p_method,nullif(trim(p_external_reference),''),p_actor_type,p_actor_reference)
  returning * into e;
  insert into public.financial_journals(snapshot_id,event_id,description)
  values(s.id,e.id,'Recaudo confirmado para ' || s.order_public_id) returning * into j;

  insert into public.financial_ledger_entries(journal_id,account_code,party_type,party_reference,debit,credit) values
    (j.id,case when p_method='CASH' then '1105-CASH-CLEARING' else '1110-BANK-CLEARING' end,
      case when p_method='CASH' then 'CASH_CLEARING' else 'BANK_CLEARING' end,null,s.customer_total,0),
    (j.id,'2205-MERCHANT-PAYABLE','MERCHANT',s.restaurant_id,0,s.merchant_net),
    (j.id,'4135-MERCHANT-COMMISSION','MERCAU',null,0,s.merchant_commission_base),
    (j.id,'2408-VAT-PAYABLE','MERCAU',null,0,s.merchant_commission_vat),
    (j.id,'4140-DELIVERY-PLATFORM','MERCAU',null,0,s.mercau_delivery_share),
    (j.id,'2210-COURIER-PAYABLE','COURIER',null,0,s.courier_share),
    (j.id,'2215-VEGA-ALLOCATION','VEGA_EXPRESS',null,0,s.vega_share);

  if (select coalesce(sum(debit),0) from public.financial_ledger_entries where journal_id=j.id)
     <> (select coalesce(sum(credit),0) from public.financial_ledger_entries where journal_id=j.id)
    then raise exception 'Asiento desbalanceado'; end if;
  update public.order_financial_snapshots set payment_method=p_method,payment_status='CONFIRMED',updated_at=now() where id=s.id;
  return jsonb_build_object('ok',true,'duplicate',false,'event_id',e.id,'journal_id',j.id);
end;
$$;
revoke all on function public.financial_record_payment(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.financial_record_payment(uuid,text,text,text,text,text) to service_role;

commit;
