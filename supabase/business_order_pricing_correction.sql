begin;

comment on column public.pilot_restaurants.customer_markup_bps is
  'Referencia comercial para que el negocio defina manualmente su precio publicado. No es un cobro separado ni modifica la liquidacion.';
comment on column public.pilot_food_orders.customer_markup_bps is
  'Copia de la referencia comercial vigente al crear el pedido. No interviene en el calculo financiero.';

create or replace function public.financial_snapshot_food_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_subtotal bigint; markup_total bigint; commission_total bigint; commission_base bigint;
  merchant_share bigint; platform_share bigint; merchant_delivery bigint; pool bigint; courier_amount bigint;
begin
  base_subtotal := new.subtotal;
  markup_total := 0;
  commission_total := round(new.subtotal * new.commission_rate_bps / 10000.0);
  merchant_share := commission_total;
  commission_base := round(commission_total / 1.19);
  if new.delivery_mode = 'OWN' then
    platform_share := 0; pool := 0; courier_amount := 0; merchant_delivery := new.delivery_fee;
  else
    platform_share := round(new.delivery_fee * 0.05); pool := new.delivery_fee - platform_share;
    courier_amount := round(pool * 0.70); merchant_delivery := 0;
  end if;
  insert into public.order_financial_snapshots(
    food_order_id, delivery_order_id, order_public_id, restaurant_id,
    product_subtotal, product_base_subtotal, customer_markup_total, delivery_fee, customer_total,
    merchant_commission_rate_bps, merchant_commission_total, merchant_commission_base,
    merchant_commission_vat, merchant_commission_share, merchant_net,
    mercau_delivery_share, logistics_pool, courier_share, vega_share, merchant_delivery_share,
    delivery_mode, payment_method, policy_version)
  values (new.id, new.delivery_order_id, new.public_id, new.restaurant_id,
    new.subtotal, base_subtotal, markup_total, new.delivery_fee, new.subtotal + new.delivery_fee,
    new.commission_rate_bps, commission_total, commission_base,
    commission_total - commission_base, merchant_share, new.subtotal - commission_total,
    platform_share, pool, courier_amount, pool - courier_amount, merchant_delivery,
    new.delivery_mode, new.payment_method, '2026-10-v3')
  on conflict (food_order_id) do update set
    delivery_order_id=coalesce(excluded.delivery_order_id,public.order_financial_snapshots.delivery_order_id),
    payment_method=case when public.order_financial_snapshots.payment_status='PENDING'
      then excluded.payment_method else public.order_financial_snapshots.payment_method end,
    updated_at=now();
  return new;
end;
$$;

commit;
