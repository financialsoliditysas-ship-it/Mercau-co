-- PROPOSAL ONLY. Test locally, then obtain approval before applying to production.
-- Keep delivery_safety.sql archived: this supersedes its dispatch claim, not its request-key proposal.
begin;
do $$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='delivery_orders' and column_name='dispatch_attempted_at') then
    alter table public.delivery_orders add column dispatch_attempted_at timestamptz;
    update public.delivery_orders set dispatch_attempted_at = coalesce(updated_at, now())
    where shipday_order_id is null and status in ('created','integration_error');
  end if;
end $$;
alter table public.delivery_orders add column if not exists shipday_event_at timestamptz;

-- Existing rows may already have reached Shipday, even without a stored provider ID.
-- Do not make a historical ambiguous request eligible for automatic resending.

create or replace function public.claim_delivery_dispatch_v2(p_order uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare d public.delivery_orders;
begin
  update public.delivery_orders set dispatch_attempted_at = clock_timestamp()
  where id = p_order and dispatch_attempted_at is null and shipday_order_id is null
    and status in ('created', 'integration_error') returning * into d;
  if not found then return null; end if;
  insert into public.delivery_status_history(delivery_order_id,status,source,external_event,metadata)
  values(d.id,d.status,'MERCAU','DISPATCH_ATTEMPT_RESERVED',jsonb_build_object('attempted_at',d.dispatch_attempted_at));
  return to_jsonb(d);
end;
$$;

create or replace function public.complete_delivery_dispatch_v2(p_order uuid, p_external text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare d public.delivery_orders;
begin
  select * into strict d from public.delivery_orders where id = p_order for update;
  if d.dispatch_attempted_at is null or nullif(p_external, '') is null then
    raise exception 'Despacho sin intento registrado';
  end if;
  if d.shipday_order_id is not null and d.shipday_order_id <> p_external then
    raise exception 'Identificador de Shipday distinto';
  end if;
  update public.delivery_orders set shipday_order_id = p_external,
    status = case when status in ('created', 'integration_error') then 'sent_to_shipday' else status end,
    shipday_status = coalesce(shipday_status, 'ORDER_INSERTED'), shipday_last_error = null
  where id = p_order returning * into d;
  insert into public.delivery_status_history(delivery_order_id,status,source,external_event,dedupe_key,metadata)
  values(d.id,d.status,'SHIPDAY','ORDER_INSERTED','shipday-insert-' || p_external,
    jsonb_build_object('shipday_order_id',p_external)) on conflict do nothing;
  return to_jsonb(d);
end;
$$;

create or replace function public.cancel_unsubmitted_delivery_v2(p_order uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare d public.delivery_orders;
begin
  select * into strict d from public.delivery_orders where id = p_order for update;
  if d.status = 'cancelled' then return to_jsonb(d); end if;
  if d.dispatch_attempted_at is not null or d.shipday_order_id is not null
    or d.status not in ('created','integration_error') then
    raise exception 'Cancela el envio en Shipday y espera su confirmacion. Si el despacho es incierto, concilialo primero.';
  end if;
  update public.delivery_orders set status = 'cancelled', cancelled_at = clock_timestamp()
  where id = p_order returning * into d;
  insert into public.delivery_status_history(delivery_order_id,status,source,external_event)
  values(d.id,'cancelled','ADMIN','ADMIN_CANCELLED_BEFORE_DISPATCH');
  return to_jsonb(d);
end;
$$;

create or replace function public.apply_shipday_event_v2(
  p_public text, p_external text, p_status text, p_event text, p_at timestamptz, p_payload jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare d public.delivery_orders; ignored text; event_key text; carrier jsonb;
  old_rank integer; new_rank integer;
begin
  if nullif(p_external,'') is null or p_at is null or p_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'Evento sin identificador o fecha valida';
  end if;
  select * into strict d from public.delivery_orders
  where shipday_order_id = p_external
    or (public_id = p_public and shipday_order_id is null and dispatch_attempted_at is not null)
  for update;
  if nullif(p_public,'') is not null and d.public_id <> p_public then
    raise exception 'El evento no corresponde al pedido';
  end if;
  event_key := 'shipday-v2-' || p_external || '-' || p_event || '-' || p_at::text;
  if exists(select 1 from public.delivery_status_history where dedupe_key = event_key) then
    return jsonb_build_object('ok',true,'publicId',d.public_id,'status',d.status,'ignored','duplicate');
  end if;
  if p_status not in ('sent_to_shipday','assigned','picked_up','in_transit','delivered','failed','cancelled') then
    ignored := 'unknown_event';
  elsif d.shipday_event_at is not null and p_at <= d.shipday_event_at then
    ignored := 'stale_event';
  elsif d.status in ('delivered','failed','cancelled') and p_status <> d.status then
    ignored := 'terminal_state';
  else
    old_rank := case d.status when 'assigned' then 1 when 'picked_up' then 2 when 'in_transit' then 3 else 0 end;
    new_rank := case p_status when 'assigned' then 1 when 'picked_up' then 2 when 'in_transit' then 3 else 0 end;
    -- Shipday documents explicit operator reversals. They are not delayed ordinary events.
    if p_status not in ('delivered','failed','cancelled') and new_rank < old_rank
      and not (p_event='ORDER_UNASSIGNED' and p_status='sent_to_shipday')
      and not (p_event='ORDER_PIKEDUP_REMOVED' and p_status in ('sent_to_shipday','assigned'))
      and not (p_event='ORDER_ONTHEWAY_REMOVED' and p_status in ('sent_to_shipday','assigned','picked_up'))
      then ignored := 'state_regression'; end if;
  end if;
  if ignored is null then
    carrier := coalesce(p_payload->'carrier','{}'::jsonb);
    update public.delivery_orders set status = p_status, shipday_order_id = p_external,
      shipday_status = coalesce(nullif(p_payload->>'order_status',''),p_event), shipday_event_at = p_at,
      shipday_carrier_id = case when p_event='ORDER_UNASSIGNED' then null else coalesce(nullif(left(carrier->>'id',80),''),shipday_carrier_id) end,
      courier_name = case when p_event='ORDER_UNASSIGNED' then null else coalesce(nullif(left(carrier->>'name',160),''),courier_name) end,
      courier_phone = case when p_event='ORDER_UNASSIGNED' then null else coalesce(nullif(left(carrier->>'phone',40),''),courier_phone) end,
      courier_vehicle = case when p_event='ORDER_UNASSIGNED' then null else coalesce(nullif(left(carrier->>'vehicle_description',160),''),courier_vehicle) end,
      courier_plate = case when p_event='ORDER_UNASSIGNED' then null else coalesce(nullif(left(carrier->>'plate_number',40),''),courier_plate) end,
      assigned_at = case when p_event='ORDER_UNASSIGNED' then null when p_status = 'assigned' then coalesce(assigned_at,p_at) else assigned_at end,
      picked_up_at = case when p_event in ('ORDER_UNASSIGNED','ORDER_PIKEDUP_REMOVED') then null when p_status = 'picked_up' then coalesce(picked_up_at,p_at) else picked_up_at end,
      delivered_at = case when p_status = 'delivered' then coalesce(delivered_at,p_at) else delivered_at end,
      cancelled_at = case when p_status = 'cancelled' then coalesce(cancelled_at,p_at) else cancelled_at end
    where id = d.id returning * into d;
  end if;
  insert into public.delivery_status_history(delivery_order_id,status,source,external_status,external_event,dedupe_key,metadata)
  values(d.id,d.status,'SHIPDAY_WEBHOOK',p_payload->>'order_status',p_event,event_key,
    p_payload || jsonb_build_object('_mercau_ignored',ignored));
  return jsonb_build_object('ok',true,'publicId',d.public_id,'status',d.status,'ignored',ignored);
end;
$$;

revoke all on function public.claim_delivery_dispatch_v2(uuid) from public,anon,authenticated;
revoke all on function public.complete_delivery_dispatch_v2(uuid,text) from public,anon,authenticated;
revoke all on function public.cancel_unsubmitted_delivery_v2(uuid) from public,anon,authenticated;
revoke all on function public.apply_shipday_event_v2(text,text,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.claim_delivery_dispatch_v2(uuid) to service_role;
grant execute on function public.complete_delivery_dispatch_v2(uuid,text) to service_role;
grant execute on function public.cancel_unsubmitted_delivery_v2(uuid) to service_role;
grant execute on function public.apply_shipday_event_v2(text,text,text,text,timestamptz,jsonb) to service_role;
commit;
