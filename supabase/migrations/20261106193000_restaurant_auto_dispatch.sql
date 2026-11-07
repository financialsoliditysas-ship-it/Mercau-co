begin;

-- Acceptance creates one scheduled delivery record. Shipday is contacted only by
-- the server scheduler or the explicit "Pedido listo" action.
alter table public.pilot_restaurants
  add column if not exists preparation_minutes integer not null default 15,
  add column if not exists dispatch_lead_minutes integer not null default 3;

alter table public.pilot_restaurants
  drop constraint if exists pilot_restaurants_preparation_minutes_check,
  drop constraint if exists pilot_restaurants_dispatch_lead_minutes_check,
  add constraint pilot_restaurants_preparation_minutes_check
    check (preparation_minutes between 1 and 240),
  add constraint pilot_restaurants_dispatch_lead_minutes_check
    check (dispatch_lead_minutes between 0 and 60);

alter table public.pilot_food_orders
  add column if not exists accepted_at timestamptz,
  add column if not exists estimated_preparation_minutes integer,
  add column if not exists dispatch_due_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists dispatch_search_started_at timestamptz,
  add column if not exists dispatch_search_source text;

alter table public.pilot_food_orders
  drop constraint if exists pilot_food_orders_estimated_preparation_check,
  add constraint pilot_food_orders_estimated_preparation_check
    check (estimated_preparation_minutes is null or estimated_preparation_minutes between 1 and 240);

alter table public.delivery_orders
  add column if not exists dispatch_scheduled_at timestamptz,
  add column if not exists dispatch_search_started_at timestamptz,
  add column if not exists dispatch_search_source text;

create index if not exists pilot_food_dispatch_due_idx
  on public.pilot_food_orders(dispatch_due_at)
  where dispatch_due_at is not null and status in ('accepted', 'ready');
create index if not exists delivery_orders_dispatch_schedule_idx
  on public.delivery_orders(dispatch_scheduled_at)
  where dispatch_scheduled_at is not null and shipday_order_id is null;

alter table public.pilot_food_history
  add column if not exists actor_type text not null default 'business',
  add column if not exists actor_reference text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.restaurant_order_action_links (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references public.pilot_restaurants(id),
  order_id uuid not null unique references public.pilot_food_orders(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists restaurant_order_action_links_expiry_idx
  on public.restaurant_order_action_links(expires_at)
  where revoked_at is null;

create table if not exists public.restaurant_order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pilot_food_orders(id) on delete cascade,
  link_id uuid not null references public.restaurant_order_action_links(id) on delete cascade,
  message_kind text not null default 'NEW_ORDER',
  channel text not null default 'WHATSAPP',
  recipient text not null,
  action_path text not null,
  message_body text not null,
  status text not null default 'blocked_provider',
  provider_message_id text,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint restaurant_order_messages_kind_check check (message_kind = 'NEW_ORDER'),
  constraint restaurant_order_messages_channel_check check (channel = 'WHATSAPP'),
  constraint restaurant_order_messages_status_check check (status in ('blocked_provider', 'queued', 'processing', 'sent', 'failed', 'uncertain')),
  unique (order_id, message_kind)
);

alter table public.restaurant_order_action_links enable row level security;
alter table public.restaurant_order_messages enable row level security;
revoke all on public.restaurant_order_action_links, public.restaurant_order_messages from public, anon, authenticated;
grant select, insert, update, delete on public.restaurant_order_action_links to service_role;
grant select, insert, update, delete on public.restaurant_order_messages to service_role;

create or replace function public.pilot_food_transition_v4(
  p_order uuid,
  p_actor uuid,
  p_action text,
  p_actor_type text default 'business',
  p_actor_reference text default null
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  o public.pilot_food_orders;
  r public.pilot_restaurants;
  d public.delivery_orders;
  action_link public.restaurant_order_action_links;
  dispatch_due timestamptz;
  should_dispatch boolean := false;
begin
  select * into o from public.pilot_food_orders where id = p_order for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  select * into r from public.pilot_restaurants where id = o.restaurant_id;
  if not found then raise exception 'Negocio no encontrado'; end if;

  if p_actor_type = 'whatsapp_link' then
    if p_action not in ('accepted', 'rejected', 'ready')
      or p_actor_reference is null
      or p_actor_reference !~* '^[0-9a-f-]{36}$' then
      raise exception 'Accion no disponible desde este enlace';
    end if;
    select * into action_link
      from public.restaurant_order_action_links
      where id = p_actor_reference::uuid
        and order_id = o.id
        and restaurant_id = o.restaurant_id
        and revoked_at is null
        and expires_at > now()
      for update;
    if not found then raise exception 'Este enlace ya no esta disponible'; end if;
    update public.restaurant_order_action_links set last_used_at = now() where id = action_link.id;
  elsif p_actor_type = 'business' then
    if p_actor is null then raise exception 'Acceso denegado'; end if;
    if r.is_live then
      if not exists (select 1 from public.business_admins
        where business_id = r.directory_business_id and user_id = p_actor and status = 'Activo') then
        raise exception 'Acceso denegado';
      end if;
    elsif not exists (select 1 from public.pilot_restaurant_members
      where restaurant_id = o.restaurant_id and user_id = p_actor and role = 'manager') then
      raise exception 'Acceso denegado';
    end if;
  else
    raise exception 'Origen de accion invalido';
  end if;

  if p_action not in ('accepted', 'rejected', 'ready', 'out_for_delivery', 'delivered') then
    raise exception 'Accion invalida';
  end if;
  if o.status = p_action then
    return jsonb_build_object('dispatch', false, 'delivery_id', o.delivery_order_id,
      'delivery_mode', o.delivery_mode, 'status', o.status, 'dispatch_scheduled_at', o.dispatch_due_at);
  end if;
  if not ((o.status = 'pending' and p_action in ('accepted', 'rejected'))
       or (o.status = 'accepted' and p_action = 'ready')
       or (p_actor_type = 'business' and o.delivery_mode = 'OWN' and o.status = 'ready' and p_action = 'out_for_delivery')
       or (p_actor_type = 'business' and o.delivery_mode = 'OWN' and o.status = 'out_for_delivery' and p_action = 'delivered')) then
    raise exception 'Transicion invalida';
  end if;

  if p_action = 'accepted' and o.delivery_mode = 'MERCAU' then
    if not r.enabled or r.pickup_address = '' or r.pickup_phone = '' then
      raise exception 'Recogida sin configurar';
    end if;
    dispatch_due := now() + greatest(r.preparation_minutes - r.dispatch_lead_minutes, 0) * interval '1 minute';
    insert into public.delivery_orders(service_type, customer_name, customer_phone,
      pickup_name, pickup_address, pickup_neighborhood, pickup_contact, pickup_phone,
      pickup_instructions, delivery_name, delivery_address, delivery_neighborhood,
      delivery_phone, delivery_instructions, description, notes, delivery_fee, source,
      commerce_items, commerce_subtotal, delivery_latitude, delivery_longitude,
      delivery_location_accuracy_m, delivery_location_captured_at, dispatch_scheduled_at)
    values ('Recoger una compra', o.customer_name, o.customer_phone,
      r.name || case when r.is_live then '' else ' [PRUEBA]' end,
      r.pickup_address, 'Nechi', r.name, r.pickup_phone,
      case when r.is_live then 'Recoger pedido aceptado por el negocio.'
        else 'PRUEBA COORDINADA. No comprar ni preparar productos reales.' end,
      o.customer_name, o.address, o.neighborhood || ', Nechi', o.customer_phone,
      o.instructions, 'Pedido ' || o.public_id,
      case when r.is_live then 'Efectivo contra entrega. Productos: COP ' || o.subtotal::text ||
        '. Domicilio: COP ' || o.delivery_fee::text || '. Total a cobrar: COP ' || (o.subtotal + o.delivery_fee)::text || '.'
        else 'PRUEBA: cobro simulado, no recaudar dinero real.' end,
      o.delivery_fee, 'WEB', o.lines, o.subtotal, o.delivery_latitude, o.delivery_longitude,
      o.delivery_location_accuracy_m, o.delivery_location_captured_at, dispatch_due)
    returning * into d;
    insert into public.delivery_status_history(delivery_order_id, status, source, metadata)
      values (d.id, 'created', 'WEB', jsonb_build_object('food_order', o.public_id,
        'test', not r.is_live, 'dispatch_scheduled_at', dispatch_due));
  elsif p_action = 'ready' and o.delivery_mode = 'MERCAU' and o.delivery_order_id is null then
    if not r.enabled or r.pickup_address = '' or r.pickup_phone = '' then
      raise exception 'Recogida sin configurar';
    end if;
    insert into public.delivery_orders(service_type, customer_name, customer_phone,
      pickup_name, pickup_address, pickup_neighborhood, pickup_contact, pickup_phone,
      pickup_instructions, delivery_name, delivery_address, delivery_neighborhood,
      delivery_phone, delivery_instructions, description, notes, delivery_fee, source,
      commerce_items, commerce_subtotal, delivery_latitude, delivery_longitude,
      delivery_location_accuracy_m, delivery_location_captured_at, dispatch_scheduled_at)
    values ('Recoger una compra', o.customer_name, o.customer_phone,
      r.name || case when r.is_live then '' else ' [PRUEBA]' end, r.pickup_address, 'Nechi', r.name, r.pickup_phone,
      case when r.is_live then 'Recoger pedido listo por el negocio.' else 'PRUEBA COORDINADA. No comprar ni preparar productos reales.' end,
      o.customer_name, o.address, o.neighborhood || ', Nechi', o.customer_phone, o.instructions,
      'Pedido ' || o.public_id,
      case when r.is_live then 'Efectivo contra entrega. Productos: COP ' || o.subtotal::text ||
        '. Domicilio: COP ' || o.delivery_fee::text || '. Total a cobrar: COP ' || (o.subtotal + o.delivery_fee)::text || '.'
        else 'PRUEBA: cobro simulado, no recaudar dinero real.' end,
      o.delivery_fee, 'WEB', o.lines, o.subtotal, o.delivery_latitude, o.delivery_longitude,
      o.delivery_location_accuracy_m, o.delivery_location_captured_at, now())
    returning * into d;
    insert into public.delivery_status_history(delivery_order_id, status, source, metadata)
      values (d.id, 'created', 'WEB', jsonb_build_object('food_order', o.public_id,
        'test', not r.is_live, 'dispatch_scheduled_at', now()));
  end if;

  if d.id is null and o.delivery_order_id is not null then
    select * into d from public.delivery_orders where id = o.delivery_order_id for update;
  end if;
  if p_action = 'ready' and o.delivery_mode = 'MERCAU' and d.id is not null then
    if d.status = 'created' and d.shipday_order_id is null and d.dispatch_attempted_at is null then
      update public.delivery_orders set dispatch_scheduled_at = now() where id = d.id;
      d.dispatch_scheduled_at := now();
      should_dispatch := true;
    end if;
  end if;
  if p_action = 'rejected' and o.delivery_order_id is not null then
    if d.status = 'created' and d.shipday_order_id is null and d.dispatch_attempted_at is null then
      update public.delivery_orders set status = 'cancelled', cancelled_at = now(), dispatch_scheduled_at = null
        where id = d.id and status = 'created' and shipday_order_id is null and dispatch_attempted_at is null;
      insert into public.delivery_status_history(delivery_order_id, status, source, metadata)
        values (d.id, 'cancelled', 'WEB', jsonb_build_object('food_order', o.public_id, 'reason', 'food_order_rejected'));
    end if;
  end if;

  update public.pilot_food_orders set
    status = p_action,
    accepted_at = case when p_action = 'accepted' then coalesce(accepted_at, now()) else accepted_at end,
    estimated_preparation_minutes = case when p_action = 'accepted' then r.preparation_minutes else estimated_preparation_minutes end,
    dispatch_due_at = case when p_action = 'accepted' then dispatch_due
      when p_action = 'ready' and o.delivery_mode = 'MERCAU' then now()
      else dispatch_due_at end,
    ready_at = case when p_action = 'ready' then coalesce(ready_at, now()) else ready_at end,
    delivery_order_id = coalesce(d.id, delivery_order_id),
    updated_at = now()
  where id = p_order;
  insert into public.pilot_food_history(order_id, status, actor_id, actor_type, actor_reference, metadata)
    values (p_order, p_action, p_actor, p_actor_type, coalesce(p_actor_reference, p_actor::text),
      jsonb_build_object('dispatch_due_at', case when p_action in ('accepted', 'ready') then coalesce(dispatch_due, now()) else null end));
  return jsonb_build_object('dispatch', should_dispatch, 'delivery_id', d.id,
    'delivery_mode', o.delivery_mode, 'status', p_action,
    'dispatch_scheduled_at', case when p_action in ('accepted', 'ready') then coalesce(dispatch_due, now()) else null end);
end;
$$;

revoke all on function public.pilot_food_transition_v4(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.pilot_food_transition_v4(uuid, uuid, text, text, text) to service_role;

commit;
