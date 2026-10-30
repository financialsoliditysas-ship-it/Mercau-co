-- PROPOSAL ONLY. Requires logistics_controls_v2.sql. Do not apply remotely without approval.
begin;
create table if not exists public.order_creation_receipts (
  scope text not null,
  request_key uuid not null,
  fingerprint text not null,
  food_order_id uuid references public.pilot_food_orders(id),
  delivery_order_id uuid references public.delivery_orders(id),
  repeat_of_public_id text,
  created_at timestamptz not null default now(),
  primary key(scope,request_key),
  check ((food_order_id is null) <> (delivery_order_id is null))
);
alter table public.order_creation_receipts add column if not exists repeat_of_public_id text;
alter table public.order_creation_receipts enable row level security;
revoke all on public.order_creation_receipts from public,anon,authenticated;
grant select,insert on public.order_creation_receipts to service_role;
create index if not exists order_creation_fingerprint_idx
on public.order_creation_receipts(scope,fingerprint,created_at desc);
create unique index if not exists order_delivery_request_key_idx
on public.order_creation_receipts(request_key) where delivery_order_id is not null;
create index if not exists food_recent_comparison_idx on public.pilot_food_orders(customer_id,restaurant_id,created_at desc);
-- Existing duplicate provider IDs must be investigated, not silently rewritten by a migration.
create unique index if not exists delivery_shipday_unique_v3 on public.delivery_orders(shipday_order_id)
where shipday_order_id is not null;

-- Canonical, validated server payload. Ignore only transport IDs and GPS capture metadata.
create or replace function public.order_payload_fingerprint_v3(p_payload jsonb)
returns text language sql immutable security invoker set search_path='' as $$
  select encode(sha256(convert_to((
    (p_payload - array['request_key','delivery_location_accuracy_m','delivery_location_captured_at',
      'pickup_location_accuracy_m','pickup_location_captured_at','_repeat_of'])
    || case when p_payload ? 'lines' then jsonb_build_object('lines',
      (select coalesce(jsonb_agg(line - 'lineId' order by (line - 'lineId')::text),'[]'::jsonb)
       from jsonb_array_elements(p_payload->'lines') as lines(line))) else '{}'::jsonb end
  )::text,'UTF8')),'hex');
$$;

-- Comparison is intentionally different from a request fingerprint: price/payment updates
-- do not turn the same products, quantities, options and destination into a different intent.
create or replace function public.food_comparison_fingerprint_v3(p_payload jsonb)
returns text language sql immutable security invoker set search_path='' as $$
  with identities as (
    select jsonb_build_object('product',coalesce(line->>'productId',line->>'name'),
      'note',btrim(coalesce(line->>'note','')),'selections',(
        select coalesce(jsonb_agg(jsonb_build_object('group',selection->>'groupId','choices',(
          select coalesce(jsonb_agg(choice->>'choiceId' order by choice->>'choiceId'),'[]'::jsonb)
          from jsonb_array_elements(coalesce(selection->'choices','[]'::jsonb)) as choices(choice)
        )) order by selection->>'groupId'),'[]'::jsonb)
        from jsonb_array_elements(coalesce(line->'selections','[]'::jsonb)) as selections(selection)
      )) as identity, (line->>'quantity')::integer as quantity
    from jsonb_array_elements(p_payload->'lines') as lines(line)
  ), grouped as (select identity,sum(quantity) as quantity from identities group by identity)
  select encode(sha256(convert_to(jsonb_build_object(
    'address',lower(regexp_replace(btrim(coalesce(p_payload->>'address','')),'\s+',' ','g')),
    'neighborhood',lower(regexp_replace(btrim(coalesce(p_payload->>'neighborhood','')),'\s+',' ','g')),
    'latitude',p_payload->'delivery_latitude','longitude',p_payload->'delivery_longitude',
    'instructions',btrim(coalesce(p_payload->>'instructions','')),
    'lines',(select jsonb_agg(identity || jsonb_build_object('quantity',quantity) order by identity::text) from grouped)
  )::text,'UTF8')),'hex');
$$;

create or replace function public.lookup_order_receipt_v3(p_scope text,p_key uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.order_creation_receipts; o public.pilot_food_orders; d public.delivery_orders;
begin
  select * into r from public.order_creation_receipts where scope=p_scope and request_key=p_key;
  if found then
    if r.food_order_id is not null then
      select * into strict o from public.pilot_food_orders where id=r.food_order_id;
      return jsonb_build_object('outcome','existing','public_id',o.public_id);
    end if;
    select * into strict d from public.delivery_orders where id=r.delivery_order_id;
    return jsonb_build_object('outcome','existing','public_id',d.public_id,'status',d.status,'shipdayCreated',d.shipday_order_id is not null);
  end if;
  select * into o from public.pilot_food_orders where request_key=p_key and p_scope='food:' || customer_id::text || ':' || restaurant_id;
  if found then return jsonb_build_object('outcome','existing','public_id',o.public_id); end if;
  return jsonb_build_object('outcome','not_found');
end;
$$;

create or replace function public.create_food_order_once_v3(p_scope text,p_key uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt public.order_creation_receipts; o public.pilot_food_orders; old_payload jsonb; uncertain boolean;
  fp text := public.order_payload_fingerprint_v3(p_payload);
begin
  if p_scope <> 'food:' || (p_payload->>'customer_id') || ':' || (p_payload->>'restaurant_id') then
    raise exception 'Ambito de pedido invalido';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_scope,0));
  select * into receipt from public.order_creation_receipts where scope=p_scope and request_key=p_key;
  if found then
    select * into strict o from public.pilot_food_orders where id=receipt.food_order_id;
    if receipt.fingerprint <> fp then
      return jsonb_build_object('outcome','conflict','previous_public_id',o.public_id);
    end if;
    return jsonb_build_object('outcome','existing','public_id',o.public_id);
  end if;
  -- Check a legacy reference before the comparison window: a retry remains a retry.
  select * into o from public.pilot_food_orders where customer_id=(p_payload->>'customer_id')::uuid and request_key=p_key;
  if found then
    if o.restaurant_id <> p_payload->>'restaurant_id' then return jsonb_build_object('outcome','conflict'); end if;
    select jsonb_object_agg(key,to_jsonb(o)->key) into old_payload from jsonb_object_keys(p_payload) as keys(key);
    if public.order_payload_fingerprint_v3(old_payload)<>fp then return jsonb_build_object('outcome','conflict','previous_public_id',o.public_id); end if;
    insert into public.order_creation_receipts(scope,request_key,fingerprint,food_order_id) values(p_scope,p_key,fp,o.id);
    return jsonb_build_object('outcome','existing','public_id',o.public_id);
  end if;
  if nullif(p_payload->>'_repeat_of','') is not null and not exists(
    select 1 from public.pilot_food_orders original
    where original.public_id=p_payload->>'_repeat_of' and original.customer_id=(p_payload->>'customer_id')::uuid
      and original.restaurant_id=p_payload->>'restaurant_id'
      and public.food_comparison_fingerprint_v3(to_jsonb(original))=public.food_comparison_fingerprint_v3(p_payload)
  ) then return jsonb_build_object('outcome','conflict'); end if;
  -- Uncertainty is a dispatch safety condition, not an expiring comparison window.
  select previous.* into o from public.pilot_food_orders previous
    join public.delivery_orders delivery on delivery.id=previous.delivery_order_id
  where previous.customer_id=(p_payload->>'customer_id')::uuid and previous.restaurant_id=p_payload->>'restaurant_id'
    and previous.status not in ('rejected','cancelled') and delivery.status<>'cancelled'
    and delivery.dispatch_attempted_at is not null and delivery.shipday_order_id is null
    and public.food_comparison_fingerprint_v3(to_jsonb(previous))=public.food_comparison_fingerprint_v3(p_payload)
  order by previous.created_at desc limit 1;
  if found then return jsonb_build_object('outcome','uncertain','previous_public_id',o.public_id); end if;
  select previous.* into o from public.pilot_food_orders previous
    left join public.delivery_orders delivery on delivery.id=previous.delivery_order_id
  where previous.customer_id=(p_payload->>'customer_id')::uuid and previous.restaurant_id=p_payload->>'restaurant_id'
    and previous.created_at>=clock_timestamp()-interval '5 minutes'
    and previous.status not in ('rejected','cancelled') and coalesce(delivery.status,'')<>'cancelled'
    and public.food_comparison_fingerprint_v3(to_jsonb(previous))=public.food_comparison_fingerprint_v3(p_payload)
  order by previous.created_at desc,previous.public_id desc limit 1;
  if found then
    select dispatch_attempted_at is not null and shipday_order_id is null into uncertain
      from public.delivery_orders where id=o.delivery_order_id;
    if coalesce(uncertain,false) then return jsonb_build_object('outcome','uncertain','previous_public_id',o.public_id); end if;
    if coalesce(p_payload->>'_repeat_of','')<>o.public_id then
      return jsonb_build_object('outcome','duplicate','previous_public_id',o.public_id);
    end if;
  end if;
  insert into public.pilot_food_orders(restaurant_id,customer_id,request_key,customer_name,customer_phone,
    address,neighborhood,instructions,lines,subtotal,delivery_fee,payment_method,delivery_mode,commission_rate_bps,
    customer_markup_bps,delivery_latitude,delivery_longitude,delivery_location_accuracy_m,delivery_location_captured_at)
  select restaurant_id,customer_id,p_key,customer_name,customer_phone,address,neighborhood,instructions,lines,
    subtotal,delivery_fee,payment_method,delivery_mode,commission_rate_bps,customer_markup_bps,delivery_latitude,
    delivery_longitude,delivery_location_accuracy_m,delivery_location_captured_at
  from jsonb_populate_record(null::public.pilot_food_orders,p_payload) returning * into o;
  insert into public.order_creation_receipts(scope,request_key,fingerprint,food_order_id,repeat_of_public_id)
  values(p_scope,p_key,fp,o.id,nullif(p_payload->>'_repeat_of',''));
  return jsonb_build_object('outcome','created','public_id',o.public_id);
end;
$$;

create or replace function public.create_delivery_once_v3(p_scope text,p_key uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt public.order_creation_receipts; d public.delivery_orders;
  fp text := public.order_payload_fingerprint_v3(p_payload);
begin
  if nullif(p_scope,'') is null or length(p_scope)>200 then raise exception 'Ambito de envio invalido'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_scope,0));
  select * into receipt from public.order_creation_receipts where scope=p_scope and request_key=p_key;
  if found then
    select * into strict d from public.delivery_orders where id=receipt.delivery_order_id;
    if receipt.fingerprint <> fp then return jsonb_build_object('outcome','conflict','previous_public_id',d.public_id); end if;
    return jsonb_build_object('outcome','existing','order',to_jsonb(d));
  end if;
  if nullif(p_payload->>'_repeat_of','') is not null and not exists(
    select 1 from public.delivery_orders original join public.order_creation_receipts r on r.delivery_order_id=original.id
    where original.public_id=p_payload->>'_repeat_of' and r.scope=p_scope and r.fingerprint=fp
  ) then return jsonb_build_object('outcome','conflict'); end if;
  select previous.* into d from public.delivery_orders previous
    join public.order_creation_receipts r on r.delivery_order_id=previous.id
  where r.scope=p_scope and r.fingerprint=fp and previous.status<>'cancelled'
    and previous.dispatch_attempted_at is not null and previous.shipday_order_id is null
  order by previous.created_at desc limit 1;
  if found then return jsonb_build_object('outcome','uncertain','previous_public_id',d.public_id); end if;
  select previous.* into d from public.delivery_orders previous
    join public.order_creation_receipts r on r.delivery_order_id=previous.id
  where r.scope=p_scope and r.fingerprint=fp and previous.created_at>=clock_timestamp()-interval '5 minutes'
    and previous.status<>'cancelled'
  order by previous.created_at desc,previous.public_id desc limit 1;
  if found then
    if d.dispatch_attempted_at is not null and d.shipday_order_id is null then
      return jsonb_build_object('outcome','uncertain','previous_public_id',d.public_id);
    end if;
    if coalesce(p_payload->>'_repeat_of','')<>d.public_id then
      return jsonb_build_object('outcome','duplicate','previous_public_id',d.public_id);
    end if;
  end if;
  insert into public.delivery_orders(service_type,customer_name,customer_phone,pickup_name,pickup_address,
    pickup_neighborhood,pickup_contact,pickup_phone,pickup_instructions,pickup_latitude,pickup_longitude,
    pickup_location_accuracy_m,pickup_location_captured_at,delivery_name,delivery_address,delivery_neighborhood,
    delivery_phone,delivery_instructions,delivery_latitude,delivery_longitude,delivery_location_accuracy_m,
    delivery_location_captured_at,description,notes,delivery_fee,source,customer_user_id,pickup_business_id)
  select service_type,customer_name,customer_phone,pickup_name,pickup_address,pickup_neighborhood,pickup_contact,
    pickup_phone,pickup_instructions,pickup_latitude,pickup_longitude,pickup_location_accuracy_m,pickup_location_captured_at,
    delivery_name,delivery_address,delivery_neighborhood,delivery_phone,delivery_instructions,delivery_latitude,
    delivery_longitude,delivery_location_accuracy_m,delivery_location_captured_at,description,notes,delivery_fee,
    source,customer_user_id,pickup_business_id
  from jsonb_populate_record(null::public.delivery_orders,p_payload) returning * into d;
  insert into public.order_creation_receipts(scope,request_key,fingerprint,delivery_order_id,repeat_of_public_id)
  values(p_scope,p_key,fp,d.id,nullif(p_payload->>'_repeat_of',''));
  insert into public.delivery_status_history(delivery_order_id,status,source,metadata)
  values(d.id,'created',d.source,jsonb_build_object('public_id',d.public_id));
  return jsonb_build_object('outcome','created','order',to_jsonb(d));
end;
$$;

create or replace function public.record_dispatch_reconciliation_v3(
  p_order uuid,p_attempt timestamptz,p_outcome text,p_external text,p_checked_at timestamptz
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.delivery_orders;
begin
  select * into strict d from public.delivery_orders where id=p_order for update;
  if d.dispatch_attempted_at is null or d.dispatch_attempted_at is distinct from p_attempt then
    raise exception 'El intento de despacho cambio';
  end if;
  if p_outcome not in ('matched','not_found','multiple','mismatch','unavailable') then raise exception 'Resultado invalido'; end if;
  if p_outcome='matched' then
    if p_external is null or p_external !~ '^[0-9]+$' then raise exception 'Identificador invalido'; end if;
    perform pg_advisory_xact_lock(hashtextextended('shipday:' || p_external,0));
    if exists(select 1 from public.delivery_orders where shipday_order_id=p_external and id<>p_order) then
      raise exception 'El envio Shipday ya esta vinculado a otro pedido';
    end if;
    if d.shipday_order_id is not null and d.shipday_order_id<>p_external then raise exception 'Vinculo diferente'; end if;
    update public.delivery_orders set shipday_order_id=p_external,
      status=case when status in ('created','integration_error') then 'sent_to_shipday' else status end,
      shipday_last_error=null where id=p_order returning * into d;
  end if;
  insert into public.delivery_status_history(delivery_order_id,status,source,external_event,metadata)
  values(d.id,d.status,'ADMIN','SHIPDAY_RECONCILIATION',jsonb_build_object(
    'outcome',p_outcome,'shipday_order_id',p_external,'checked_at',p_checked_at));
  return jsonb_build_object('ok',true,'outcome',p_outcome,'publicId',d.public_id);
end;
$$;

revoke all on function public.order_payload_fingerprint_v3(jsonb) from public,anon,authenticated;
revoke all on function public.food_comparison_fingerprint_v3(jsonb) from public,anon,authenticated;
revoke all on function public.lookup_order_receipt_v3(text,uuid) from public,anon,authenticated;
revoke all on function public.create_food_order_once_v3(text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.create_delivery_once_v3(text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.record_dispatch_reconciliation_v3(uuid,timestamptz,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.order_payload_fingerprint_v3(jsonb) to service_role;
grant execute on function public.food_comparison_fingerprint_v3(jsonb) to service_role;
grant execute on function public.lookup_order_receipt_v3(text,uuid) to service_role;
grant execute on function public.create_food_order_once_v3(text,uuid,jsonb) to service_role;
grant execute on function public.create_delivery_once_v3(text,uuid,jsonb) to service_role;
grant execute on function public.record_dispatch_reconciliation_v3(uuid,timestamptz,text,text,timestamptz) to service_role;
commit;
