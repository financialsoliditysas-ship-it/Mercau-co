begin;

create table if not exists public.pilot_restaurants (
  id text primary key,
  name text not null,
  pickup_address text not null default '',
  pickup_phone text not null default '',
  enabled boolean not null default false,
  delivery_fee integer not null default 5000 check (delivery_fee >= 0),
  menu jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create table if not exists public.pilot_restaurant_members (
  restaurant_id text not null references public.pilot_restaurants(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('manager', 'tester')),
  primary key (restaurant_id, user_id)
);
create sequence if not exists public.pilot_food_public_seq;
create table if not exists public.pilot_food_orders (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default ('PRB-' || lpad(nextval('public.pilot_food_public_seq')::text, 6, '0')),
  restaurant_id text not null references public.pilot_restaurants(id),
  customer_id uuid not null references auth.users(id),
  request_key uuid not null,
  customer_name text not null,
  customer_phone text not null,
  address text not null,
  neighborhood text not null,
  instructions text not null default '',
  delivery_latitude double precision,
  delivery_longitude double precision,
  delivery_location_accuracy_m double precision,
  delivery_location_captured_at timestamptz,
  lines jsonb not null,
  subtotal integer not null check (subtotal > 0),
  delivery_fee integer not null check (delivery_fee >= 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'ready')),
  delivery_order_id uuid unique references public.delivery_orders(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, request_key)
);
create table if not exists public.pilot_food_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pilot_food_orders(id),
  status text not null,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.delivery_orders add column if not exists commerce_items jsonb;
alter table public.delivery_orders add column if not exists commerce_subtotal integer;

create index if not exists pilot_food_orders_customer_idx on public.pilot_food_orders(customer_id, created_at desc);
create index if not exists pilot_food_orders_restaurant_idx on public.pilot_food_orders(restaurant_id, created_at desc);
create index if not exists pilot_food_history_order_idx on public.pilot_food_history(order_id, created_at);
create or replace function public.pilot_food_created()
returns trigger language plpgsql set search_path = public as $$
begin
  insert into public.pilot_food_history(order_id, status, actor_id) values (new.id, 'pending', new.customer_id);
  return new;
end;
$$;
drop trigger if exists pilot_food_created on public.pilot_food_orders;
create trigger pilot_food_created after insert on public.pilot_food_orders
  for each row execute function public.pilot_food_created();

alter table public.pilot_restaurants enable row level security;
alter table public.pilot_restaurant_members enable row level security;
alter table public.pilot_food_orders enable row level security;
alter table public.pilot_food_history enable row level security;
-- Browser roles have no direct access. Server validates the JWT and membership.
revoke all on public.pilot_restaurants, public.pilot_restaurant_members,
  public.pilot_food_orders, public.pilot_food_history from anon, authenticated;

create or replace function public.pilot_food_transition(p_order uuid, p_actor uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare o public.pilot_food_orders; r public.pilot_restaurants; d public.delivery_orders;
begin
  select * into o from public.pilot_food_orders where id = p_order for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if not exists (select 1 from public.pilot_restaurant_members
    where restaurant_id = o.restaurant_id and user_id = p_actor and role = 'manager')
    then raise exception 'Acceso denegado'; end if;
  if p_action not in ('accepted', 'rejected', 'ready') then raise exception 'Accion invalida'; end if;
  if o.status = p_action then return jsonb_build_object('dispatch', false); end if;
  if not ((o.status = 'pending' and p_action in ('accepted', 'rejected'))
       or (o.status = 'accepted' and p_action = 'ready'))
    then raise exception 'Transicion invalida'; end if;
  if p_action = 'ready' then
    select * into r from public.pilot_restaurants where id = o.restaurant_id;
    if not r.enabled or r.pickup_address = '' or r.pickup_phone = ''
      then raise exception 'Recogida sin configurar'; end if;
    insert into public.delivery_orders(service_type, customer_name, customer_phone,
      pickup_name, pickup_address, pickup_neighborhood, pickup_contact, pickup_phone,
      pickup_instructions, delivery_name, delivery_address, delivery_neighborhood,
      delivery_phone, delivery_instructions, delivery_latitude, delivery_longitude,
      delivery_location_accuracy_m, delivery_location_captured_at,
      description, notes, delivery_fee, source,
      commerce_items, commerce_subtotal)
    values ('Recoger una compra', o.customer_name, o.customer_phone,
      r.name || ' [PRUEBA]', r.pickup_address, 'Nechi', r.name, r.pickup_phone,
      'PRUEBA COORDINADA. No comprar ni preparar productos reales.',
      o.customer_name, o.address, o.neighborhood || ', Nechi', o.customer_phone,
      o.instructions, o.delivery_latitude, o.delivery_longitude,
      o.delivery_location_accuracy_m, o.delivery_location_captured_at,
      'Pedido comercial de prueba ' || o.public_id,
      'PRUEBA: cobro simulado, no recaudar dinero real.', o.delivery_fee, 'WEB',
      o.lines, o.subtotal) returning * into d;
    insert into public.delivery_status_history(delivery_order_id, status, source, metadata)
      values (d.id, 'created', 'WEB', jsonb_build_object('food_order', o.public_id, 'test', true));
  end if;
  update public.pilot_food_orders set status = p_action, updated_at = now(),
    delivery_order_id = coalesce(d.id, delivery_order_id) where id = p_order;
  insert into public.pilot_food_history(order_id, status, actor_id) values (p_order, p_action, p_actor);
  return jsonb_build_object('dispatch', p_action = 'ready', 'delivery_id', d.id);
end;
$$;
revoke all on function public.pilot_food_transition(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.pilot_food_transition(uuid, uuid, text) to service_role;

insert into public.pilot_restaurants(id, name, menu)
values ('restaurante-mercado', 'Restaurante Mercado', '[
 {"id":"burger","name":"Hamburguesa Mercado","category":"Hamburguesas","price":22000,"image":"/demo-burger.jpg"},
 {"id":"double","name":"Doble con queso","category":"Hamburguesas","price":28000,"image":"/demo-double.jpg"},
 {"id":"steak","name":"Carne a la plancha","category":"Parrilla","price":30000,"image":"/demo-steak.jpg"},
 {"id":"ribs","name":"Costillas BBQ","category":"Parrilla","price":35000,"image":"/demo-ribs.jpg"},
 {"id":"punta","name":"Punta de anca","category":"Parrilla","price":38000,"image":"/demo-steak.jpg"},
 {"id":"salchi","name":"Salchipapas de la casa","category":"Para compartir","price":18000,"image":"/demo-fries.jpg"},
 {"id":"combo","name":"Combo hamburguesa","category":"Combos","price":26000,"image":"/demo-burger.jpg"},
 {"id":"shake","name":"Malteada de chocolate","category":"Bebidas","price":12000,"image":"/demo-shake.jpg"},
 {"id":"fries","name":"Papas a la francesa","category":"Para compartir","price":8000,"image":"/demo-fries.jpg"}
]') on conflict (id) do nothing;
commit;
