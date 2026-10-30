begin;

create table public.food_order_change_proposals (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pilot_food_orders(id),
  request_key uuid not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn','cancelled')),
  old_lines jsonb not null, new_lines jsonb not null,
  old_subtotal integer not null check (old_subtotal>0),
  new_subtotal integer not null check (new_subtotal>0),
  finance_before jsonb not null, finance_after jsonb,
  proposed_by uuid not null references auth.users(id),
  responded_by uuid references auth.users(id),
  created_at timestamptz not null default clock_timestamp(), responded_at timestamptz,
  unique(order_id,request_key)
);
create unique index food_change_unresolved_idx on public.food_order_change_proposals(order_id)
  where status in ('pending','declined');
create index food_change_order_idx on public.food_order_change_proposals(order_id,created_at desc);
alter table public.food_order_change_proposals enable row level security;
revoke all on public.food_order_change_proposals from public,anon,authenticated,service_role;
grant select,insert on public.food_order_change_proposals to service_role;
grant update(status,responded_by,responded_at,finance_after) on public.food_order_change_proposals to service_role;

create table public.customer_push_subscriptions (
  endpoint text primary key check(length(endpoint)<=2000),
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null, auth text not null,
  created_at timestamptz not null default now(), disabled_at timestamptz,
  last_seen_at timestamptz not null default now()
);
create index customer_push_user_idx on public.customer_push_subscriptions(user_id) where disabled_at is null;
alter table public.customer_push_subscriptions enable row level security;
revoke all on public.customer_push_subscriptions from public,anon,authenticated,service_role;
grant select,insert,update on public.customer_push_subscriptions to service_role;

create function public.food_change_guard_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.status='rejected' then
    update public.food_order_change_proposals set status='cancelled',responded_at=clock_timestamp()
      where order_id=old.id and status in ('pending','declined');
  elsif exists(select 1 from public.food_order_change_proposals where order_id=old.id and status in ('pending','declined'))
    and (new.status is distinct from old.status or new.delivery_order_id is distinct from old.delivery_order_id
      or new.lines is distinct from old.lines or new.subtotal is distinct from old.subtotal) then
    raise exception 'Resuelve la propuesta de cambio antes de continuar el pedido';
  end if;
  return new;
end;
$$;
create trigger food_change_guard before update of status,delivery_order_id,lines,subtotal
  on public.pilot_food_orders for each row execute function public.food_change_guard_v1();

create function public.propose_food_change_v1(p_order uuid,p_actor uuid,p_key uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.pilot_food_orders; r public.pilot_restaurants;
  s public.order_financial_snapshots; c public.food_order_change_proposals; amount bigint;
begin
  if p_actor is null then raise exception 'Acceso denegado'; end if;
  select * into o from public.pilot_food_orders where id=p_order for update;
  if not found then raise exception 'Pedido no disponible'; end if;
  select * into r from public.pilot_restaurants where id=o.restaurant_id;
  if (r.is_live and not exists(select 1 from public.business_admins where business_id=r.directory_business_id and user_id=p_actor and status='Activo'))
    or (not r.is_live and not exists(select 1 from public.pilot_restaurant_members where restaurant_id=o.restaurant_id and user_id=p_actor and role='manager')) then
    raise exception 'Acceso denegado';
  end if;
  select * into c from public.food_order_change_proposals where order_id=o.id and request_key=p_key;
  if found then
    if c.new_lines is distinct from p_payload->'new_lines' then raise exception 'Referencia utilizada con otra propuesta'; end if;
    return jsonb_build_object('id',c.id,'replayed',true);
  end if;
  if o.status not in ('pending','accepted') or o.delivery_order_id is not null then raise exception 'El pedido ya no admite cambios'; end if;
  select * into s from public.order_financial_snapshots where food_order_id=o.id for update;
  if not found or s.payment_status<>'PENDING' or s.settlement_status<>'PENDING'
    or exists(select 1 from public.financial_events where snapshot_id=s.id)
    then raise exception 'El pedido tiene movimientos financieros y requiere soporte'; end if;
  if o.lines is distinct from p_payload->'old_lines' or o.subtotal is distinct from (p_payload->>'old_subtotal')::integer
    then raise exception 'El pedido cambio. Actualiza antes de proponer'; end if;
  if jsonb_typeof(p_payload->'new_lines') is distinct from 'array'
    or jsonb_array_length(p_payload->'new_lines') not between 1 and 20
    or o.lines=p_payload->'new_lines' then raise exception 'Propuesta invalida'; end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'new_lines') l
    where (l->>'quantity')::integer not between 1 and 10 or (l->>'unitPrice')::bigint<0) then raise exception 'Importe invalido'; end if;
  select sum((l->>'unitPrice')::bigint*(l->>'quantity')::bigint) into amount from jsonb_array_elements(p_payload->'new_lines') l;
  if amount is null or amount<=0 or amount>2147483647 or amount is distinct from (p_payload->>'new_subtotal')::bigint then raise exception 'Total invalido'; end if;
  if exists(select 1 from public.food_order_change_proposals where order_id=o.id and status='pending') then raise exception 'Ya hay una propuesta pendiente'; end if;
  if (select count(*) from public.food_order_change_proposals where order_id=o.id)>=10 then raise exception 'Este pedido requiere soporte'; end if;
  update public.food_order_change_proposals set status='withdrawn' where order_id=o.id and status='declined';
  insert into public.food_order_change_proposals(order_id,request_key,old_lines,new_lines,old_subtotal,new_subtotal,finance_before,proposed_by)
    values(o.id,p_key,o.lines,p_payload->'new_lines',o.subtotal,amount,to_jsonb(s),p_actor) returning * into c;
  insert into public.pilot_food_history(order_id,status,actor_id) values(o.id,'change_proposed',p_actor);
  return jsonb_build_object('id',c.id,'replayed',false);
end;
$$;

create function public.respond_food_change_v1(p_proposal uuid,p_actor uuid,p_action text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.pilot_food_orders; r public.pilot_restaurants; c public.food_order_change_proposals;
  s public.order_financial_snapshots; commission bigint; base bigint; target text;
begin
  if p_actor is null then raise exception 'Acceso denegado'; end if;
  select fo.* into o from public.pilot_food_orders fo join public.food_order_change_proposals cp on cp.order_id=fo.id where cp.id=p_proposal for update of fo;
  if not found then raise exception 'Propuesta no disponible'; end if;
  select * into c from public.food_order_change_proposals where id=p_proposal for update;
  if p_action in ('accept','decline') then
    if o.customer_id<>p_actor then raise exception 'Acceso denegado'; end if;
  elsif p_action='withdraw' then
    select * into r from public.pilot_restaurants where id=o.restaurant_id;
    if (r.is_live and not exists(select 1 from public.business_admins where business_id=r.directory_business_id and user_id=p_actor and status='Activo'))
      or (not r.is_live and not exists(select 1 from public.pilot_restaurant_members where restaurant_id=o.restaurant_id and user_id=p_actor and role='manager')) then raise exception 'Acceso denegado'; end if;
  else raise exception 'Accion invalida'; end if;
  target:=case p_action when 'accept' then 'accepted' when 'decline' then 'declined' else 'withdrawn' end;
  if c.status=target then return jsonb_build_object('ok',true,'replayed',true); end if;
  if (c.status<>'pending' and not(p_action='withdraw' and c.status='declined'))
    or o.status not in ('pending','accepted') or o.delivery_order_id is not null then raise exception 'La propuesta ya no esta disponible'; end if;
  select * into s from public.order_financial_snapshots where food_order_id=o.id for update;
  if not found then raise exception 'No se pudo comprobar el registro financiero'; end if;
  if p_action='accept' and (s.payment_status<>'PENDING' or s.settlement_status<>'PENDING'
    or exists(select 1 from public.financial_events where snapshot_id=s.id)
    or o.lines is distinct from c.old_lines or o.subtotal<>c.old_subtotal
    or s.product_subtotal<>o.subtotal or s.delivery_fee<>o.delivery_fee) then raise exception 'El pedido cambio o tiene pagos. Contacta a Mercau'; end if;
  update public.food_order_change_proposals set status=target,responded_by=p_actor,responded_at=clock_timestamp() where id=c.id;
  if p_action='accept' then
    commission:=round(c.new_subtotal::numeric*s.merchant_commission_rate_bps/10000.0);
    base:=round(commission/1.19);
    update public.pilot_food_orders set lines=c.new_lines,subtotal=c.new_subtotal,updated_at=now() where id=o.id;
    update public.order_financial_snapshots set product_subtotal=c.new_subtotal,product_base_subtotal=c.new_subtotal,
      customer_markup_total=0,customer_total=c.new_subtotal+delivery_fee,
      merchant_commission_total=commission,merchant_commission_share=commission,
      merchant_commission_base=base,merchant_commission_vat=commission-base,merchant_net=c.new_subtotal-commission,updated_at=now()
      where id=s.id returning * into s;
    update public.food_order_change_proposals set finance_after=to_jsonb(s) where id=c.id;
  end if;
  insert into public.pilot_food_history(order_id,status,actor_id) values(o.id,'change_'||target,p_actor);
  return jsonb_build_object('ok',true,'replayed',false);
end;
$$;

revoke all on function public.food_change_guard_v1() from public,anon,authenticated;
revoke all on function public.propose_food_change_v1(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.respond_food_change_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.food_change_guard_v1() to service_role;
grant execute on function public.propose_food_change_v1(uuid,uuid,uuid,jsonb) to service_role;
grant execute on function public.respond_food_change_v1(uuid,uuid,text) to service_role;

commit;
