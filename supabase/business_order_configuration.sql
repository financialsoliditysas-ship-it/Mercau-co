begin;

alter table public.pilot_restaurants
  add column if not exists delivery_mode text not null default 'MERCAU',
  add column if not exists commission_rate_bps integer not null default 1500,
  add column if not exists customer_markup_bps integer not null default 0;

alter table public.pilot_restaurants drop constraint if exists pilot_restaurants_delivery_mode_check;
alter table public.pilot_restaurants add constraint pilot_restaurants_delivery_mode_check
  check (delivery_mode in ('MERCAU','OWN'));
alter table public.pilot_restaurants drop constraint if exists pilot_restaurants_commission_check;
alter table public.pilot_restaurants add constraint pilot_restaurants_commission_check
  check (commission_rate_bps between 0 and 10000 and customer_markup_bps between 0 and commission_rate_bps);

alter table public.pilot_food_orders
  add column if not exists delivery_mode text not null default 'MERCAU',
  add column if not exists commission_rate_bps integer not null default 1500,
  add column if not exists customer_markup_bps integer not null default 0;

alter table public.pilot_food_orders drop constraint if exists pilot_food_orders_delivery_mode_check;
alter table public.pilot_food_orders add constraint pilot_food_orders_delivery_mode_check
  check (delivery_mode in ('MERCAU','OWN'));
alter table public.pilot_food_orders drop constraint if exists pilot_food_orders_commission_check;
alter table public.pilot_food_orders add constraint pilot_food_orders_commission_check
  check (commission_rate_bps between 0 and 10000 and customer_markup_bps between 0 and commission_rate_bps);

alter table public.order_financial_snapshots
  add column if not exists product_base_subtotal bigint not null default 0,
  add column if not exists customer_markup_total bigint not null default 0,
  add column if not exists merchant_commission_share bigint not null default 0,
  add column if not exists merchant_delivery_share bigint not null default 0,
  add column if not exists delivery_mode text not null default 'MERCAU';

update public.order_financial_snapshots set
  product_base_subtotal=product_subtotal,
  customer_markup_total=0,
  merchant_commission_share=merchant_commission_total,
  merchant_delivery_share=0,
  delivery_mode='MERCAU'
where product_base_subtotal=0 and product_subtotal>0;

alter table public.order_financial_snapshots drop constraint if exists order_financial_snapshot_pricing_split;
alter table public.order_financial_snapshots add constraint order_financial_snapshot_pricing_split check (
  product_base_subtotal >= 0 and customer_markup_total >= 0 and merchant_commission_share >= 0
  and product_base_subtotal + customer_markup_total = product_subtotal
  and merchant_commission_share + customer_markup_total = merchant_commission_total
);
alter table public.order_financial_snapshots drop constraint if exists order_financial_snapshot_delivery_mode;
alter table public.order_financial_snapshots add constraint order_financial_snapshot_delivery_mode check (
  delivery_mode in ('MERCAU','OWN') and merchant_delivery_share >= 0
  and mercau_delivery_share + logistics_pool + merchant_delivery_share = delivery_fee
);
alter table public.order_financial_snapshots drop constraint if exists order_financial_snapshots_check3;

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

create or replace function public.pilot_food_transition(p_order uuid,p_actor uuid,p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.pilot_food_orders; r public.pilot_restaurants; d public.delivery_orders;
begin
  select * into o from public.pilot_food_orders where id=p_order for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  select * into r from public.pilot_restaurants where id=o.restaurant_id;
  if r.is_live then
    if not exists(select 1 from public.business_admins where business_id=r.directory_business_id and user_id=p_actor and status='Activo')
      then raise exception 'Acceso denegado'; end if;
  elsif not exists(select 1 from public.pilot_restaurant_members where restaurant_id=o.restaurant_id and user_id=p_actor and role='manager')
    then raise exception 'Acceso denegado'; end if;
  if p_action not in ('accepted','rejected','ready','out_for_delivery','delivered') then raise exception 'Accion invalida'; end if;
  if o.status=p_action then return jsonb_build_object('dispatch',false,'delivery_mode',o.delivery_mode); end if;
  if not ((o.status='pending' and p_action in ('accepted','rejected'))
    or (o.status='accepted' and p_action='ready')
    or (o.delivery_mode='OWN' and o.status='ready' and p_action='out_for_delivery')
    or (o.delivery_mode='OWN' and o.status='out_for_delivery' and p_action='delivered'))
    then raise exception 'Transicion invalida'; end if;
  if p_action='ready' and o.delivery_mode='MERCAU' then
    if not r.enabled or r.pickup_address='' or r.pickup_phone='' then raise exception 'Recogida sin configurar'; end if;
    insert into public.delivery_orders(service_type,customer_name,customer_phone,
      pickup_name,pickup_address,pickup_neighborhood,pickup_contact,pickup_phone,pickup_instructions,
      delivery_name,delivery_address,delivery_neighborhood,delivery_phone,delivery_instructions,
      description,notes,delivery_fee,source,commerce_items,commerce_subtotal,
      delivery_latitude,delivery_longitude,delivery_location_accuracy_m,delivery_location_captured_at)
    values ('Recoger una compra',o.customer_name,o.customer_phone,
      r.name||case when r.is_live then '' else ' [PRUEBA]' end,r.pickup_address,'Nechi',r.name,r.pickup_phone,
      case when r.is_live then 'Recoger pedido confirmado por el negocio.' else 'PRUEBA COORDINADA. No comprar ni preparar productos reales.' end,
      o.customer_name,o.address,o.neighborhood||', Nechi',o.customer_phone,o.instructions,'Pedido '||o.public_id,
      case when r.is_live then 'Cobrar al cliente COP '||(o.subtotal+o.delivery_fee)::text||'. Pagar al negocio el valor indicado por Mercau.'
        else 'PRUEBA: cobro simulado, no recaudar dinero real.' end,
      o.delivery_fee,'WEB',o.lines,o.subtotal,o.delivery_latitude,o.delivery_longitude,
      o.delivery_location_accuracy_m,o.delivery_location_captured_at) returning * into d;
    insert into public.delivery_status_history(delivery_order_id,status,source,metadata)
      values(d.id,'created','WEB',jsonb_build_object('food_order',o.public_id,'test',not r.is_live));
  end if;
  update public.pilot_food_orders set status=p_action,updated_at=now(),delivery_order_id=coalesce(d.id,delivery_order_id) where id=p_order;
  insert into public.pilot_food_history(order_id,status,actor_id) values(p_order,p_action,p_actor);
  return jsonb_build_object('dispatch',p_action='ready' and o.delivery_mode='MERCAU','delivery_id',d.id,'delivery_mode',o.delivery_mode);
end;
$$;

create or replace function public.financial_record_payment(
  p_snapshot uuid,p_event_key text,p_method text,p_external_reference text default null,
  p_actor_type text default 'ADMIN',p_actor_reference text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.order_financial_snapshots; e public.financial_events; j public.financial_journals;
begin
  if p_event_key is null or length(trim(p_event_key))<8 then raise exception 'Clave de idempotencia invalida'; end if;
  if p_method not in ('CASH','BREB_QR') then raise exception 'Metodo de pago invalido'; end if;
  select * into s from public.order_financial_snapshots where id=p_snapshot for update;
  if not found then raise exception 'Registro financiero no encontrado'; end if;
  select * into e from public.financial_events where event_key=p_event_key;
  if found then return jsonb_build_object('ok',true,'duplicate',true,'event_id',e.id); end if;
  if s.payment_status='CONFIRMED' then raise exception 'El pago ya fue confirmado con otro evento'; end if;
  insert into public.financial_events(snapshot_id,event_key,event_type,amount,method,external_reference,actor_type,actor_reference)
    values(s.id,trim(p_event_key),'PAYMENT_CONFIRMED',s.customer_total,p_method,nullif(trim(p_external_reference),''),p_actor_type,p_actor_reference) returning * into e;
  insert into public.financial_journals(snapshot_id,event_id,description)
    values(s.id,e.id,'Recaudo confirmado para '||s.order_public_id) returning * into j;
  insert into public.financial_ledger_entries(journal_id,account_code,party_type,party_reference,debit,credit) values
    (j.id,case when p_method='CASH' then '1105-CASH-CLEARING' else '1110-BANK-CLEARING' end,
      case when p_method='CASH' then 'CASH_CLEARING' else 'BANK_CLEARING' end,null,s.customer_total,0),
    (j.id,'2205-MERCHANT-PAYABLE','MERCHANT',s.restaurant_id,0,s.merchant_net+s.merchant_delivery_share),
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

create or replace function public.financial_record_settlement(
  p_snapshot uuid,p_component text,p_payee_reference text,p_method text,p_external_reference text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.order_financial_snapshots; settlement public.financial_settlements;
  expected_amount bigint; expected_type text; completed_components integer; required_components integer;
begin
  if p_component not in ('MERCHANT_NET','COURIER_SHARE','VEGA_SHARE') then raise exception 'Componente de liquidacion invalido'; end if;
  if p_method not in ('CASH','BREB_QR','BANK_TRANSFER','INTERNAL') then raise exception 'Metodo de liquidacion invalido'; end if;
  if length(trim(coalesce(p_payee_reference,'')))<2 then raise exception 'Beneficiario invalido'; end if;
  if length(trim(coalesce(p_external_reference,'')))<4 then raise exception 'Referencia de liquidacion invalida'; end if;
  if length(trim(coalesce(p_idempotency_key,'')))<12 then raise exception 'Clave de idempotencia invalida'; end if;
  select * into s from public.order_financial_snapshots where id=p_snapshot for update;
  if not found then raise exception 'Registro financiero no encontrado'; end if;
  if s.payment_status<>'CONFIRMED' then raise exception 'El recaudo aun no esta confirmado'; end if;
  if p_component='MERCHANT_NET' then expected_amount:=s.merchant_net+s.merchant_delivery_share;expected_type:='MERCHANT';
  elsif p_component='COURIER_SHARE' then expected_amount:=s.courier_share;expected_type:='COURIER';
  else expected_amount:=s.vega_share;expected_type:='VEGA_EXPRESS'; end if;
  if expected_amount<=0 then raise exception 'Este pedido no tiene saldo para este beneficiario'; end if;
  select fs.* into settlement from public.financial_settlements fs where fs.idempotency_key=trim(p_idempotency_key);
  if found then return jsonb_build_object('ok',true,'duplicate',true,'settlement_id',settlement.id); end if;
  if exists(select 1 from public.financial_settlement_items fsi join public.financial_settlements fs on fs.id=fsi.settlement_id where fsi.snapshot_id=s.id and fsi.component=p_component and fs.status='CONFIRMED')
    then raise exception 'Este componente ya fue liquidado'; end if;
  insert into public.financial_settlements(payee_type,payee_reference,amount,method,status,external_reference,idempotency_key,settled_at)
    values(expected_type,trim(p_payee_reference),expected_amount,p_method,'CONFIRMED',trim(p_external_reference),trim(p_idempotency_key),now()) returning * into settlement;
  insert into public.financial_settlement_items(settlement_id,snapshot_id,component,amount) values(settlement.id,s.id,p_component,expected_amount);
  select count(*) into required_components from (values
    ('MERCHANT_NET',s.merchant_net+s.merchant_delivery_share),('COURIER_SHARE',s.courier_share),('VEGA_SHARE',s.vega_share)) v(component,amount) where amount>0;
  select count(distinct fsi.component) into completed_components from public.financial_settlement_items fsi
    join public.financial_settlements fs on fs.id=fsi.settlement_id
    where fsi.snapshot_id=s.id and fsi.component in ('MERCHANT_NET','COURIER_SHARE','VEGA_SHARE') and fs.status='CONFIRMED';
  update public.order_financial_snapshots set settlement_status=case when completed_components>=required_components then 'SETTLED' else 'PARTIAL' end,updated_at=now() where id=s.id;
  return jsonb_build_object('ok',true,'duplicate',false,'settlement_id',settlement.id,'component',p_component,'amount',expected_amount);
end;
$$;

revoke all on function public.pilot_food_transition(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.financial_snapshot_food_order() from public,anon,authenticated;
revoke all on function public.financial_record_payment(uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.financial_record_settlement(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.pilot_food_transition(uuid,uuid,text) to service_role;
grant execute on function public.financial_record_payment(uuid,text,text,text,text,text) to service_role;
grant execute on function public.financial_record_settlement(uuid,text,text,text,text,text) to service_role;

commit;
