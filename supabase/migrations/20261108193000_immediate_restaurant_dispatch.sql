begin;

-- Shipday receives the order as soon as the restaurant accepts it. The pickup
-- estimate remains a business setting, independently of when dispatch starts.
alter table public.delivery_orders
  add column if not exists expected_pickup_at timestamptz;

create index if not exists delivery_orders_expected_pickup_idx
  on public.delivery_orders(expected_pickup_at)
  where expected_pickup_at is not null;

create or replace function public.pilot_food_transition_v5(
  p_order uuid,
  p_actor uuid,
  p_action text,
  p_actor_type text default 'business',
  p_actor_reference text default null
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  prior jsonb;
  o public.pilot_food_orders;
  r public.pilot_restaurants;
  d public.delivery_orders;
  pickup_at timestamptz;
  previous_status text;
begin
  select status into previous_status from public.pilot_food_orders where id = p_order for update;
  prior := public.pilot_food_transition_v4(
    p_order, p_actor, p_action, p_actor_type, p_actor_reference
  );

  if p_action = 'accepted'
    and previous_status = 'pending'
    and prior->>'status' = 'accepted'
    and prior->>'delivery_mode' = 'MERCAU'
    and coalesce((prior->>'delivery_id')::uuid, null) is not null then
    select * into o from public.pilot_food_orders where id = p_order;
    select * into r from public.pilot_restaurants where id = o.restaurant_id;
    pickup_at := coalesce(o.accepted_at, now())
      + coalesce(r.preparation_minutes, 15) * interval '1 minute';

    update public.delivery_orders
      set expected_pickup_at = pickup_at,
          dispatch_scheduled_at = now()
      where id = (prior->>'delivery_id')::uuid
      returning * into d;

    update public.pilot_food_orders
      set dispatch_due_at = now(), updated_at = now()
      where id = p_order;

    insert into public.pilot_food_history(order_id, status, actor_id, actor_type, actor_reference, metadata)
      values (p_order, 'dispatch_search_started', p_actor, p_actor_type,
        coalesce(p_actor_reference, p_actor::text),
        jsonb_build_object('source', 'restaurant_acceptance', 'expected_pickup_at', pickup_at));

    return prior || jsonb_build_object(
      'dispatch', d.status = 'created' and d.shipday_order_id is null and d.dispatch_attempted_at is null,
      'expected_pickup_at', pickup_at,
      'dispatch_scheduled_at', now()
    );
  end if;

  if p_action = 'ready'
    and prior->>'delivery_mode' = 'MERCAU'
    and coalesce((prior->>'delivery_id')::uuid, null) is not null then
    update public.delivery_orders
      set expected_pickup_at = now()
      where id = (prior->>'delivery_id')::uuid
        and shipday_order_id is null
        and dispatch_attempted_at is null;
  end if;

  return prior;
end;
$$;

revoke all on function public.pilot_food_transition_v5(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.pilot_food_transition_v5(uuid, uuid, text, text, text) to service_role;

commit;
