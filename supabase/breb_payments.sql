begin;

alter table public.pilot_food_orders
  add column if not exists payment_method text not null default 'CASH',
  add column if not exists payment_reference text,
  add column if not exists payment_reported_at timestamptz;

alter table public.pilot_food_orders
  drop constraint if exists pilot_food_orders_payment_method_check,
  add constraint pilot_food_orders_payment_method_check
    check (payment_method in ('CASH', 'BREB_QR'));

alter table public.delivery_orders
  add column if not exists commerce_payment_method text,
  add column if not exists commerce_payment_status text;

alter table public.delivery_orders
  drop constraint if exists delivery_orders_commerce_payment_method_check,
  drop constraint if exists delivery_orders_commerce_payment_status_check,
  add constraint delivery_orders_commerce_payment_method_check
    check (commerce_payment_method is null or commerce_payment_method in ('CASH', 'BREB_QR')),
  add constraint delivery_orders_commerce_payment_status_check
    check (commerce_payment_status is null or commerce_payment_status in ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED'));

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
    mercau_delivery_share, logistics_pool, courier_share, vega_share, payment_method)
  values (new.id, new.delivery_order_id, new.public_id, new.restaurant_id,
    new.subtotal, new.delivery_fee, new.subtotal + new.delivery_fee,
    commission_total, commission_base, commission_total - commission_base, new.subtotal - commission_total,
    platform_share, pool, courier_amount, pool - courier_amount, new.payment_method)
  on conflict (food_order_id) do update set
    delivery_order_id = coalesce(excluded.delivery_order_id, public.order_financial_snapshots.delivery_order_id),
    payment_method = case when public.order_financial_snapshots.payment_status = 'PENDING'
      then excluded.payment_method else public.order_financial_snapshots.payment_method end,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists financial_snapshot_on_food_order on public.pilot_food_orders;
create trigger financial_snapshot_on_food_order
after insert or update of delivery_order_id, payment_method on public.pilot_food_orders
for each row execute function public.financial_snapshot_food_order();

update public.order_financial_snapshots s
set payment_method = o.payment_method, updated_at = now()
from public.pilot_food_orders o
where s.food_order_id = o.id and s.payment_status = 'PENDING';

commit;
