begin;

-- Existing Mercado rows stay in test mode. Only explicitly enabled businesses sell.
alter table public.pilot_restaurants add column if not exists is_live boolean not null default false;

create or replace function public.pilot_food_transition(p_order uuid, p_actor uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare o public.pilot_food_orders; r public.pilot_restaurants; d public.delivery_orders;
begin
  select * into o from public.pilot_food_orders where id = p_order for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  select * into r from public.pilot_restaurants where id = o.restaurant_id;
  if r.is_live then
    if not exists (select 1 from public.business_admins where business_id = r.directory_business_id
      and user_id = p_actor and status = 'Activo') then raise exception 'Acceso denegado'; end if;
  elsif not exists (select 1 from public.pilot_restaurant_members
    where restaurant_id = o.restaurant_id and user_id = p_actor and role = 'manager') then
    raise exception 'Acceso denegado';
  end if;
  if p_action not in ('accepted', 'rejected', 'ready') then raise exception 'Accion invalida'; end if;
  if o.status = p_action then return jsonb_build_object('dispatch', false); end if;
  if not ((o.status = 'pending' and p_action in ('accepted', 'rejected'))
       or (o.status = 'accepted' and p_action = 'ready')) then raise exception 'Transicion invalida'; end if;
  if p_action = 'ready' then
    if not r.enabled or r.pickup_address = '' or r.pickup_phone = '' then raise exception 'Recogida sin configurar'; end if;
    insert into public.delivery_orders(service_type, customer_name, customer_phone,
      pickup_name, pickup_address, pickup_neighborhood, pickup_contact, pickup_phone,
      pickup_instructions, delivery_name, delivery_address, delivery_neighborhood,
      delivery_phone, delivery_instructions, description, notes, delivery_fee, source,
      commerce_items, commerce_subtotal, delivery_latitude, delivery_longitude,
      delivery_location_accuracy_m, delivery_location_captured_at)
    values ('Recoger una compra', o.customer_name, o.customer_phone,
      r.name || case when r.is_live then '' else ' [PRUEBA]' end,
      r.pickup_address, 'Nechi', r.name, r.pickup_phone,
      case when r.is_live then 'Recoger pedido confirmado por el negocio. Pago en efectivo contra entrega.'
        else 'PRUEBA COORDINADA. No comprar ni preparar productos reales.' end,
      o.customer_name, o.address, o.neighborhood || ', Nechi', o.customer_phone,
      o.instructions, 'Pedido ' || o.public_id,
      case when r.is_live then 'Efectivo contra entrega. Productos: COP ' || o.subtotal::text ||
        '. Domicilio: COP ' || o.delivery_fee::text || '. Total a cobrar: COP ' || (o.subtotal + o.delivery_fee)::text || '.'
        else 'PRUEBA: cobro simulado, no recaudar dinero real.' end,
      o.delivery_fee, 'WEB', o.lines, o.subtotal, o.delivery_latitude, o.delivery_longitude,
      o.delivery_location_accuracy_m, o.delivery_location_captured_at) returning * into d;
    insert into public.delivery_status_history(delivery_order_id, status, source, metadata)
      values (d.id, 'created', 'WEB', jsonb_build_object('food_order', o.public_id, 'test', not r.is_live));
  end if;
  update public.pilot_food_orders set status = p_action, updated_at = now(),
    delivery_order_id = coalesce(d.id, delivery_order_id) where id = p_order;
  insert into public.pilot_food_history(order_id, status, actor_id) values (p_order, p_action, p_actor);
  return jsonb_build_object('dispatch', p_action = 'ready', 'delivery_id', d.id);
end;
$$;
revoke all on function public.pilot_food_transition(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.pilot_food_transition(uuid, uuid, text) to service_role;

-- Do not enable ordering without an existing owner and a real published menu.
do $$
begin
  if not exists (select 1 from public.business_admins where business_id = 'rece62hjPb3DM0l8P' and status = 'Activo') then
    raise exception 'Kikiriki necesita un administrador activo antes de habilitar pedidos';
  end if;
  if not exists (select 1 from public.business_catalog_products
    where business_id = 'rece62hjPb3DM0l8P' and status = 'published' and available = true and price > 0) then
    raise exception 'Kikiriki necesita productos publicados disponibles';
  end if;
end;
$$;
insert into public.pilot_restaurants(id, name, pickup_address, pickup_phone, delivery_fee,
  enabled, directory_business_id, directory_initialized, is_live)
values ('rece62hjPb3DM0l8P', 'Kikiriki y Quesudos', 'Cra 30 diagonal al D1, Nechi, Antioquia, Colombia',
  '3106628098', 5000, true, 'rece62hjPb3DM0l8P', true, true)
on conflict (id) do update set delivery_fee = 5000, enabled = true, is_live = true,
  directory_business_id = excluded.directory_business_id, directory_initialized = true;

commit;
