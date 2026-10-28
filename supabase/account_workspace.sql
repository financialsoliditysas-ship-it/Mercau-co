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
