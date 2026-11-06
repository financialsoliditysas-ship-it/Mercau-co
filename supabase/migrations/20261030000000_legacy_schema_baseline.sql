-- Generated baseline from the repository schema files. Keep before incremental migrations.

-- SOURCE: delivery_orders.sql

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
  pickup_latitude double precision,
  pickup_longitude double precision,
  pickup_location_accuracy_m double precision,
  pickup_location_captured_at timestamptz,
  delivery_name text not null,
  delivery_address text not null,
  delivery_neighborhood text,
  delivery_phone text not null,
  delivery_instructions text,
  delivery_latitude double precision,
  delivery_longitude double precision,
  delivery_location_accuracy_m double precision,
  delivery_location_captured_at timestamptz,
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

-- SOURCE: restaurant_pilot.sql

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

-- SOURCE: business_admins.sql

create table if not exists public.business_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id text not null,
  business_name text not null default '',
  owner_name text not null default '',
  owner_whatsapp text not null default '',
  private_token text not null,
  status text not null default 'Activo',
  created_at timestamptz not null default now(),
  unique (user_id, business_id),
  unique (private_token)
);

alter table public.business_admins enable row level security;

drop policy if exists "Users can read their own business access" on public.business_admins;
create policy "Users can read their own business access"
on public.business_admins
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own business access" on public.business_admins;
create policy "Users can create their own business access"
on public.business_admins
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own business access" on public.business_admins;
create policy "Users can update their own business access"
on public.business_admins
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- SOURCE: business_catalog.sql

begin;

create table if not exists public.business_catalog_products (
  id uuid primary key default gen_random_uuid(),
  business_id text not null check (business_id ~ '^rec[A-Za-z0-9]{14}$'),
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 600),
  section text not null default '' check (length(section) <= 80),
  price integer not null check (price between 0 and 100000000),
  available boolean not null default true,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  image_path text,
  position integer not null default 0 check (position between 0 and 10000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_catalog_business_status_idx
on public.business_catalog_products (business_id, status, position, created_at);

create or replace function public.business_catalog_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_catalog_touch on public.business_catalog_products;
create trigger business_catalog_touch before update on public.business_catalog_products
for each row execute function public.business_catalog_touch();

alter table public.business_catalog_products enable row level security;
revoke all on public.business_catalog_products from public, anon, authenticated;
grant select, insert, update on public.business_catalog_products to service_role;

-- Private files are served only through checked Mercau endpoints or short-lived owner URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-catalog', 'business-catalog', false, 2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists business_catalog_server_only on storage.objects;
create policy business_catalog_server_only on storage.objects
as restrictive for all to anon, authenticated
using (bucket_id <> 'business-catalog')
with check (bucket_id <> 'business-catalog');

commit;

-- SOURCE: catalog_product_options.sql

begin;

alter table public.business_catalog_products
  add column if not exists option_groups jsonb not null default '[]'::jsonb;

alter table public.business_catalog_products
  drop constraint if exists business_catalog_option_groups_shape;

alter table public.business_catalog_products
  add constraint business_catalog_option_groups_shape
  check (jsonb_typeof(option_groups) = 'array' and jsonb_array_length(option_groups) <= 8);

comment on column public.business_catalog_products.option_groups is
  'Validated product customization groups. Order lines keep an immutable snapshot of selected labels and prices.';

commit;

-- SOURCE: catalog_shared_option_groups.sql

begin;

create table if not exists public.business_catalog_option_groups (
  id uuid primary key default gen_random_uuid(),
  business_id text not null check (business_id ~ '^rec[A-Za-z0-9]{14}$'),
  name text not null check (length(trim(name)) between 1 and 80),
  group_data jsonb not null check (jsonb_typeof(group_data) = 'object'),
  version integer not null default 1 check (version >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists business_catalog_option_groups_name_idx
  on public.business_catalog_option_groups (business_id, lower(trim(name)))
  where active;
create index if not exists business_catalog_option_groups_business_idx
  on public.business_catalog_option_groups (business_id, active, created_at);

create table if not exists public.business_catalog_product_option_groups (
  product_id uuid not null references public.business_catalog_products(id) on delete cascade,
  group_id uuid not null references public.business_catalog_option_groups(id) on delete cascade,
  business_id text not null check (business_id ~ '^rec[A-Za-z0-9]{14}$'),
  position integer not null default 0 check (position between 0 and 7),
  created_at timestamptz not null default now(),
  primary key (product_id, group_id)
);

create index if not exists business_catalog_product_option_groups_business_idx
  on public.business_catalog_product_option_groups (business_id, product_id, position);
create index if not exists business_catalog_product_option_groups_group_idx
  on public.business_catalog_product_option_groups (group_id);

alter table public.business_catalog_option_groups enable row level security;
alter table public.business_catalog_product_option_groups enable row level security;

revoke all on public.business_catalog_option_groups from public, anon, authenticated;
revoke all on public.business_catalog_product_option_groups from public, anon, authenticated;
grant select, insert, update, delete on public.business_catalog_option_groups to service_role;
grant select, insert, update, delete on public.business_catalog_product_option_groups to service_role;

comment on table public.business_catalog_option_groups is
  'Private reusable catalog option groups. Access is restricted to authenticated server routes.';
comment on table public.business_catalog_product_option_groups is
  'Private links between reusable option groups and catalog products.';

commit;

-- SOURCE: restaurant_directory.sql

begin;
alter table public.pilot_restaurants add column if not exists directory_business_id text;
alter table public.pilot_restaurants add column if not exists directory_initialized boolean not null default false;
alter table public.pilot_restaurants add column if not exists directory_setup_key uuid;
alter table public.pilot_restaurants add column if not exists directory_setup_until timestamptz;
alter table public.business_catalog_products add column if not exists pilot_product_id text;
create unique index if not exists catalog_pilot_product_idx
on public.business_catalog_products(business_id,pilot_product_id) where pilot_product_id is not null;
create unique index if not exists pilot_directory_business_idx
on public.pilot_restaurants(directory_business_id) where directory_business_id is not null;

create or replace function public.pilot_directory_claim(p_key uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.pilot_restaurants
  set directory_setup_key=p_key, directory_setup_until=now()+interval '2 minutes'
  where id='restaurante-mercado'
    and (directory_setup_until is null or directory_setup_until<now());
  return found;
end;
$$;
revoke all on function public.pilot_directory_claim(uuid) from public, anon, authenticated;
grant execute on function public.pilot_directory_claim(uuid) to service_role;
commit;

-- SOURCE: account_workspace.sql

begin;

create table if not exists public.account_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.account_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('buyer','business_owner','admin','courier')),
  primary key(user_id, role)
);
create table if not exists public.account_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, body text not null default '', href text,
  event_key text,
  read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.account_recent_businesses (
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id text not null check (business_id ~ '^rec[A-Za-z0-9]{14}$'),
  viewed_at timestamptz not null default now(), primary key(user_id,business_id)
);
create table if not exists public.business_account_settings (
  business_id text primary key check (business_id ~ '^rec[A-Za-z0-9]{14}$'),
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  version integer not null default 1,
  review_requested_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.account_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  business_id text, action text not null,
  fields text[] not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.business_daily_activity (
  business_id text not null check (business_id ~ '^rec[A-Za-z0-9]{14}$'),
  day date not null default current_date,
  profile_views integer not null default 0,
  whatsapp_clicks integer not null default 0,
  call_clicks integer not null default 0,
  primary key (business_id,day)
);

alter table public.delivery_orders add column if not exists customer_user_id uuid references auth.users(id) on delete set null;
alter table public.delivery_orders add column if not exists pickup_business_id text;
create index if not exists delivery_orders_customer_user_idx on public.delivery_orders(customer_user_id,created_at desc);
create index if not exists delivery_orders_pickup_business_idx on public.delivery_orders(pickup_business_id,created_at desc);
create index if not exists account_notifications_user_idx on public.account_notifications(user_id,created_at desc);
alter table public.account_notifications add column if not exists event_key text;
create unique index if not exists account_notifications_event_key_idx on public.account_notifications(event_key);
create index if not exists account_audit_business_idx on public.account_audit(business_id,created_at desc);

-- Do not derive privileged roles from editable user_metadata.
insert into public.account_roles(user_id,role) select id,'buyer' from auth.users on conflict do nothing;
insert into public.account_roles(user_id,role)
  select distinct user_id,'business_owner' from public.business_admins where status='Activo' on conflict do nothing;

do $$ declare name text; begin
  foreach name in array array['account_profiles','account_roles','account_notifications','account_recent_businesses',
    'business_account_settings','account_audit','business_daily_activity'] loop
    execute format('alter table public.%I enable row level security',name);
    execute format('revoke all on public.%I from public, anon, authenticated',name);
    execute format('grant select, insert, update, delete on public.%I to service_role',name);
  end loop;
end $$;

-- Keep the pre-existing relationship authoritative; a browser cannot self-assign it.
drop policy if exists "Users can create their own business access" on public.business_admins;
drop policy if exists "Users can update their own business access" on public.business_admins;
revoke insert, update, delete on public.business_admins from anon, authenticated;

create or replace function public.account_save_profile(p_user uuid,p_data jsonb,p_version integer)
returns integer language plpgsql security definer set search_path=public as $$
declare v integer; begin
  if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>18000 then raise exception 'Invalid profile'; end if;
  perform pg_advisory_xact_lock(hashtextextended('account:'||p_user::text,0));
  select version into v from public.account_profiles where user_id=p_user for update;
  if found and v<>p_version then raise exception 'VERSION_CONFLICT'; end if;
  if not found and p_version<>0 then raise exception 'VERSION_CONFLICT'; end if;
  v:=coalesce(v,0)+1;
  insert into public.account_profiles(user_id,data,version) values(p_user,p_data,v)
    on conflict(user_id) do update set data=excluded.data,version=excluded.version,updated_at=now();
  -- Compatibility with the checkout and delivery form already in production.
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb) ||
    jsonb_build_object('name',p_data->>'name','delivery_profile',p_data) where id=p_user;
  insert into public.account_roles values(p_user,'buyer') on conflict do nothing;
  insert into public.account_audit(actor_id,action,fields) values(p_user,'profile_saved',array['profile']);
  return v;
end $$;

create or replace function public.account_save_business(p_user uuid,p_business text,p_data jsonb,p_version integer,p_review boolean default false)
returns integer language plpgsql security definer set search_path=public as $$
declare v integer; begin
  if not exists(select 1 from public.business_admins where user_id=p_user and business_id=p_business and status='Activo') then
    raise exception 'ACCESS_DENIED'; end if;
  if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>24000 then raise exception 'Invalid business data'; end if;
  perform pg_advisory_xact_lock(hashtextextended('business-account:'||p_business,0));
  select version into v from public.business_account_settings where business_id=p_business for update;
  if found and v<>p_version then raise exception 'VERSION_CONFLICT'; end if;
  if not found and p_version<>0 then raise exception 'VERSION_CONFLICT'; end if;
  v:=coalesce(v,0)+1;
  insert into public.business_account_settings(business_id,data,version,review_requested_at)
    values(p_business,p_data,v,case when p_review then now() end)
    on conflict(business_id) do update set data=excluded.data,version=excluded.version,updated_at=now(),
      review_requested_at=case when p_review then now() else public.business_account_settings.review_requested_at end;
  insert into public.account_audit(actor_id,business_id,action,fields)
    values(p_user,p_business,case when p_review then 'business_review_requested' else 'business_settings_saved' end,array['settings']);
  return v;
end $$;

create or replace function public.record_business_activity(p_business text,p_event text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_event not in ('profile_view','whatsapp_click','call_click') then raise exception 'Invalid event'; end if;
  insert into public.business_daily_activity(business_id,day,profile_views,whatsapp_clicks,call_clicks)
    values(p_business,(now() at time zone 'America/Bogota')::date,
      (p_event='profile_view')::integer,(p_event='whatsapp_click')::integer,(p_event='call_click')::integer)
    on conflict(business_id,day) do update set
      profile_views=public.business_daily_activity.profile_views+excluded.profile_views,
      whatsapp_clicks=public.business_daily_activity.whatsapp_clicks+excluded.whatsapp_clicks,
      call_clicks=public.business_daily_activity.call_clicks+excluded.call_clicks;
end $$;
revoke all on function public.account_save_profile(uuid,jsonb,integer) from public,anon,authenticated;
revoke all on function public.account_save_business(uuid,text,jsonb,integer,boolean) from public,anon,authenticated;
revoke all on function public.record_business_activity(text,text) from public,anon,authenticated;
grant execute on function public.account_save_profile(uuid,jsonb,integer) to service_role;
grant execute on function public.account_save_business(uuid,text,jsonb,integer,boolean) to service_role;
grant execute on function public.record_business_activity(text,text) to service_role;

-- Internal notices only. Historical orders are not reassigned or backfilled.
create or replace function public.account_order_notice()
returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; preference text; label text; target text; begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  if tg_table_name='delivery_orders' then
    recipient:=new.customer_user_id; preference:='deliveries'; target:='/envio/'||new.public_id;
    label:=case new.status when 'created' then 'Solicitud recibida' when 'integration_error' then 'Estamos procesando tu solicitud'
      when 'sent_to_shipday' then 'Buscando mensajero' when 'assigned' then 'Mensajero asignado' when 'picked_up' then 'Tu envío fue recogido'
      when 'in_transit' then 'Tu envío va en camino' when 'delivered' then 'Envío entregado' when 'cancelled' then 'Envío cancelado'
      when 'failed' then 'No se pudo completar el envío' end;
  else
    recipient:=new.customer_id; preference:='orders'; target:='/mi-cuenta/pedidos';
    label:=case new.status when 'pending' then 'Pedido recibido' when 'accepted' then 'Tu pedido está en preparación'
      when 'rejected' then 'El negocio no pudo aceptar tu pedido' when 'ready' then 'Tu pedido está listo para recoger' end;
  end if;
  if recipient is null or label is null then return new; end if;
  if exists(select 1 from public.account_profiles where user_id=recipient and data->'notifications'->preference='false'::jsonb) then return new; end if;
  insert into public.account_notifications(user_id,title,body,href,event_key)
    values(recipient,label,'Solicitud '||new.public_id,target,tg_table_name||':'||new.id::text||':'||new.status)
    on conflict(event_key) do nothing;
  return new;
exception when others then
  raise warning 'Account notification unavailable';
  return new;
end $$;
revoke all on function public.account_order_notice() from public,anon,authenticated;
drop trigger if exists account_delivery_notice on public.delivery_orders;
create trigger account_delivery_notice after insert or update of status on public.delivery_orders
  for each row execute function public.account_order_notice();
do $$ begin
  if to_regclass('public.pilot_food_orders') is not null then
    execute 'drop trigger if exists account_food_notice on public.pilot_food_orders';
    execute 'create trigger account_food_notice after insert or update of status on public.pilot_food_orders for each row execute function public.account_order_notice()';
  end if;
end $$;
commit;

-- SOURCE: favorites.sql

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, business_id)
);

alter table public.favorites enable row level security;

drop policy if exists "Users can read their own favorites" on public.favorites;
create policy "Users can read their own favorites"
on public.favorites
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can add their own favorites" on public.favorites;
create policy "Users can add their own favorites"
on public.favorites
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own favorites" on public.favorites;
create policy "Users can delete their own favorites"
on public.favorites
for delete
to authenticated
using (auth.uid() = user_id);

-- SOURCE: business_public_links.sql

begin;

create table if not exists public.business_public_links (
  slug text primary key check (length(slug) <= 150 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  business_id text not null check (business_id ~ '^rec[A-Za-z0-9]{14}$'),
  is_canonical boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists business_public_links_canonical_idx
  on public.business_public_links(business_id) where is_canonical;
alter table public.business_public_links enable row level security;
revoke all on public.business_public_links from public, anon, authenticated;
grant select, insert, update on public.business_public_links to service_role;

create or replace function public.ensure_business_public_links(p_businesses jsonb)
returns table(business_id text, slug text)
language plpgsql security definer set search_path = public
as $$
declare
  item jsonb;
  v_id text;
  v_base text;
  v_location text;
  v_candidate text;
  v_slug text;
  attempt integer;
begin
  if p_businesses is null or jsonb_typeof(p_businesses) <> 'array' or jsonb_array_length(p_businesses) > 500 then
    raise exception 'Lista de negocios invalida';
  end if;
  -- Serialize this small registry so simultaneous batches cannot claim the same name.
  perform pg_advisory_xact_lock(hashtextextended('mercau-public-links', 0));
  for item in select value from jsonb_array_elements(p_businesses) order by value->>'business_id' loop
    v_id := item->>'business_id';
    v_base := item->>'base_slug';
    v_location := item->>'municipality_slug';
    if v_id is null or v_id !~ '^rec[A-Za-z0-9]{14}$'
      or v_base is null or length(v_base) > 80 or v_base !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or v_location is null or length(v_location) > 32 or v_location !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'Datos del enlace invalidos';
    end if;
    select links.slug into v_slug from public.business_public_links links
      where links.business_id = v_id and links.is_canonical;
    if not found then
      attempt := 0;
      v_candidate := v_base;
      loop
        insert into public.business_public_links as links(slug, business_id, is_canonical)
          values (v_candidate, v_id, true)
          on conflict on constraint business_public_links_pkey do nothing
          returning links.slug into v_slug;
        if found then exit; end if;
        attempt := attempt + 1;
        if attempt = 1 then v_candidate := v_base || '-' || v_location;
        elsif attempt = 2 then v_candidate := v_base || '-' || v_location || '-' || lower(v_id);
        else v_candidate := v_base || '-' || v_location || '-' || lower(v_id) || '-' || attempt::text;
        end if;
        if attempt > 1000 then raise exception 'No se pudo reservar el enlace'; end if;
      end loop;
    end if;
    return query select v_id, v_slug;
  end loop;
end;
$$;
revoke all on function public.ensure_business_public_links(jsonb) from public, anon, authenticated;
grant execute on function public.ensure_business_public_links(jsonb) to service_role;

-- First real link also exercises the reservation function. No business record is changed.
select * from public.ensure_business_public_links('[{"business_id":"recGLMhJYXTRE46st","base_slug":"financial-solidity-sas","municipality_slug":"nechi"}]'::jsonb);

commit;

-- SOURCE: business_push_notifications.sql

begin;
create table if not exists public.business_push_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  business_id text not null check (length(business_id) between 3 and 80), endpoint text not null check (length(endpoint) <= 2000),
  p256dh text not null check (length(p256dh) between 40 and 256), auth text not null check (length(auth) between 10 and 128),
  user_agent text not null default '', created_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), disabled_at timestamptz
);
create unique index if not exists business_push_subscriptions_access_endpoint_idx
  on public.business_push_subscriptions (user_id, business_id, endpoint);
create index if not exists business_push_subscriptions_business_active_idx on public.business_push_subscriptions (business_id) where disabled_at is null;
create index if not exists business_push_subscriptions_user_idx on public.business_push_subscriptions (user_id);
alter table public.business_push_subscriptions enable row level security;
revoke all on public.business_push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.business_push_subscriptions to service_role;
commit;

-- SOURCE: delivery_locations.sql

begin;

alter table public.delivery_orders
  add column if not exists delivery_latitude double precision,
  add column if not exists delivery_longitude double precision,
  add column if not exists delivery_location_accuracy_m double precision,
  add column if not exists delivery_location_captured_at timestamptz;

alter table public.delivery_orders
  drop constraint if exists delivery_orders_delivery_latitude_check,
  drop constraint if exists delivery_orders_delivery_longitude_check,
  drop constraint if exists delivery_orders_delivery_accuracy_check,
  add constraint delivery_orders_delivery_latitude_check
    check (delivery_latitude is null or delivery_latitude between -90 and 90),
  add constraint delivery_orders_delivery_longitude_check
    check (delivery_longitude is null or delivery_longitude between -180 and 180),
  add constraint delivery_orders_delivery_accuracy_check
    check (delivery_location_accuracy_m is null or delivery_location_accuracy_m >= 0);

commit;

-- SOURCE: pickup_locations.sql

begin;

alter table public.delivery_orders
  add column if not exists pickup_latitude double precision,
  add column if not exists pickup_longitude double precision,
  add column if not exists pickup_location_accuracy_m double precision,
  add column if not exists pickup_location_captured_at timestamptz;

alter table public.delivery_orders
  drop constraint if exists delivery_orders_pickup_latitude_check,
  drop constraint if exists delivery_orders_pickup_longitude_check,
  drop constraint if exists delivery_orders_pickup_accuracy_check,
  add constraint delivery_orders_pickup_latitude_check
    check (pickup_latitude is null or pickup_latitude between -90 and 90),
  add constraint delivery_orders_pickup_longitude_check
    check (pickup_longitude is null or pickup_longitude between -180 and 180),
  add constraint delivery_orders_pickup_accuracy_check
    check (pickup_location_accuracy_m is null or pickup_location_accuracy_m >= 0);

commit;

-- SOURCE: financial_ledger.sql

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

-- SOURCE: breb_payments.sql

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

-- SOURCE: business_order_configuration.sql

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

-- SOURCE: business_order_pricing_correction.sql

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

-- SOURCE: food_delivery_reference.sql

begin;
set local lock_timeout = '5s';

-- Preserve the deployed transition, changing only the reference of new food deliveries.
do $$
declare
  definition text := pg_get_functiondef('public.pilot_food_transition(uuid,uuid,text)'::regprocedure);
  before_columns text := 'insert into public.delivery_orders(service_type,customer_name,customer_phone,';
  after_columns text := 'insert into public.delivery_orders(public_id,service_type,customer_name,customer_phone,';
  before_values text := 'values (''Recoger una compra'',o.customer_name,o.customer_phone,';
  after_values text := 'values (case when o.public_id ~ ''^MCU-1-[0-9]{6}$'' then o.public_id else public.next_delivery_public_id() end,''Recoger una compra'',o.customer_name,o.customer_phone,';
begin
  if strpos(definition,after_columns)>0 and strpos(definition,after_values)>0 then return; end if;
  if strpos(definition,before_columns)=0 or strpos(definition,before_values)=0 then
    raise exception 'Unexpected food transition; reference migration not applied';
  end if;
  definition := replace(replace(definition,before_columns,after_columns),before_values,after_values);
  execute definition;
end $$;

commit;

-- SOURCE: order_reference_series.sql

begin;

-- Activate only after deploying readers compatible with both reference formats.
create sequence if not exists public.food_order_mcu_1_seq
  as bigint start with 1 minvalue 1 maxvalue 999999 no cycle;
revoke all on sequence public.food_order_mcu_1_seq from public, anon, authenticated;
grant usage, select on sequence public.food_order_mcu_1_seq to service_role;

alter table public.pilot_food_orders alter column public_id set default
  ('MCU-1-' || lpad(nextval('public.food_order_mcu_1_seq')::text, 6, '0'));

commit;

-- SOURCE: pilot_operations_settlements.sql

begin;

create or replace function public.financial_record_settlement(
  p_snapshot uuid,
  p_component text,
  p_payee_reference text,
  p_method text,
  p_external_reference text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.order_financial_snapshots;
  settlement public.financial_settlements;
  expected_amount bigint;
  expected_type text;
  completed_components integer;
begin
  if p_component not in ('MERCHANT_NET','COURIER_SHARE','VEGA_SHARE') then raise exception 'Componente de liquidacion invalido'; end if;
  if p_method not in ('CASH','BREB_QR','BANK_TRANSFER','INTERNAL') then raise exception 'Metodo de liquidacion invalido'; end if;
  if length(trim(coalesce(p_payee_reference,''))) < 2 then raise exception 'Beneficiario invalido'; end if;
  if length(trim(coalesce(p_external_reference,''))) < 4 then raise exception 'Referencia de liquidacion invalida'; end if;
  if length(trim(coalesce(p_idempotency_key,''))) < 12 then raise exception 'Clave de idempotencia invalida'; end if;

  select * into s from public.order_financial_snapshots where id = p_snapshot for update;
  if not found then raise exception 'Registro financiero no encontrado'; end if;
  if s.payment_status <> 'CONFIRMED' then raise exception 'El recaudo aun no esta confirmado'; end if;

  if p_component = 'MERCHANT_NET' then expected_amount := s.merchant_net; expected_type := 'MERCHANT';
  elsif p_component = 'COURIER_SHARE' then expected_amount := s.courier_share; expected_type := 'COURIER';
  else expected_amount := s.vega_share; expected_type := 'VEGA_EXPRESS';
  end if;

  select fs.* into settlement from public.financial_settlements fs where fs.idempotency_key = trim(p_idempotency_key);
  if found then return jsonb_build_object('ok',true,'duplicate',true,'settlement_id',settlement.id); end if;

  if exists (
    select 1 from public.financial_settlement_items fsi
    join public.financial_settlements fs on fs.id = fsi.settlement_id
    where fsi.snapshot_id = s.id and fsi.component = p_component and fs.status = 'CONFIRMED'
  ) then raise exception 'Este componente ya fue liquidado'; end if;

  insert into public.financial_settlements(payee_type,payee_reference,amount,method,status,external_reference,idempotency_key,settled_at)
  values(expected_type,trim(p_payee_reference),expected_amount,p_method,'CONFIRMED',trim(p_external_reference),trim(p_idempotency_key),now())
  returning * into settlement;
  insert into public.financial_settlement_items(settlement_id,snapshot_id,component,amount)
  values(settlement.id,s.id,p_component,expected_amount);

  select count(distinct fsi.component) into completed_components
  from public.financial_settlement_items fsi
  join public.financial_settlements fs on fs.id = fsi.settlement_id
  where fsi.snapshot_id = s.id and fsi.component in ('MERCHANT_NET','COURIER_SHARE','VEGA_SHARE') and fs.status = 'CONFIRMED';

  update public.order_financial_snapshots
  set settlement_status = case when completed_components = 3 then 'SETTLED' else 'PARTIAL' end, updated_at = now()
  where id = s.id;

  return jsonb_build_object('ok',true,'duplicate',false,'settlement_id',settlement.id,'component',p_component,'amount',expected_amount);
end;
$$;

revoke all on function public.financial_record_settlement(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.financial_record_settlement(uuid,text,text,text,text,text) to service_role;

commit;

-- SOURCE: restaurant_order_locations.sql

begin;

alter table public.pilot_food_orders
  add column if not exists delivery_latitude double precision,
  add column if not exists delivery_longitude double precision,
  add column if not exists delivery_location_accuracy_m double precision,
  add column if not exists delivery_location_captured_at timestamptz;

alter table public.pilot_food_orders
  drop constraint if exists pilot_food_orders_delivery_latitude_check,
  drop constraint if exists pilot_food_orders_delivery_longitude_check,
  drop constraint if exists pilot_food_orders_delivery_accuracy_check,
  add constraint pilot_food_orders_delivery_latitude_check
    check (delivery_latitude is null or delivery_latitude between -90 and 90),
  add constraint pilot_food_orders_delivery_longitude_check
    check (delivery_longitude is null or delivery_longitude between -180 and 180),
  add constraint pilot_food_orders_delivery_accuracy_check
    check (delivery_location_accuracy_m is null or delivery_location_accuracy_m >= 0);

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

commit;

-- SOURCE: shipday_carriers.sql

begin;

alter table public.delivery_orders
  add column if not exists shipday_carrier_id text,
  add column if not exists courier_name text,
  add column if not exists courier_phone text,
  add column if not exists courier_vehicle text,
  add column if not exists courier_plate text;

create index if not exists delivery_orders_shipday_carrier_idx
  on public.delivery_orders(shipday_carrier_id, delivered_at desc);

with latest_carrier as (
  select distinct on (h.delivery_order_id)
    h.delivery_order_id,
    nullif(h.metadata #>> '{carrier,id}', '') as carrier_id,
    nullif(h.metadata #>> '{carrier,name}', '') as carrier_name,
    nullif(h.metadata #>> '{carrier,phone}', '') as carrier_phone,
    nullif(h.metadata #>> '{carrier,vehicle_description}', '') as carrier_vehicle,
    nullif(h.metadata #>> '{carrier,plate_number}', '') as carrier_plate
  from public.delivery_status_history h
  where h.metadata ? 'carrier'
  order by h.delivery_order_id, h.created_at desc
)
update public.delivery_orders d set
  shipday_carrier_id = c.carrier_id,
  courier_name = c.carrier_name,
  courier_phone = c.carrier_phone,
  courier_vehicle = c.carrier_vehicle,
  courier_plate = c.carrier_plate
from latest_carrier c
where d.id = c.delivery_order_id;

commit;

-- SOURCE: business_access_server_only.sql

-- Apply with the server activation route. Existing access rows are preserved.
begin;
drop policy if exists "Users can create their own business access" on public.business_admins;
drop policy if exists "Users can update their own business access" on public.business_admins;
revoke insert, update, delete on public.business_admins from anon, authenticated;
commit;
