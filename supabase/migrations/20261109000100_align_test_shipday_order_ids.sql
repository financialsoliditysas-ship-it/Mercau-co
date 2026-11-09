begin;

-- A demo order and its Shipday dispatch must share the same PRB reference.
create or replace function public.pilot_food_transition_v6(
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
begin
  prior := public.pilot_food_transition_v5(
    p_order, p_actor, p_action, p_actor_type, p_actor_reference
  );

  if p_action = 'accepted'
    and coalesce((prior->>'dispatch')::boolean, false)
    and coalesce((prior->>'delivery_id')::uuid, null) is not null then
    select * into o from public.pilot_food_orders where id = p_order;
    select * into r from public.pilot_restaurants where id = o.restaurant_id;
    if r.is_live = false then
      update public.delivery_orders
        set public_id = o.public_id
        where id = (prior->>'delivery_id')::uuid
          and shipday_order_id is null
          and dispatch_attempted_at is null;
    end if;
  end if;

  return prior;
end;
$$;

revoke all on function public.pilot_food_transition_v6(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.pilot_food_transition_v6(uuid, uuid, text, text, text) to service_role;

commit;
