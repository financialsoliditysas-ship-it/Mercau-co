begin;

-- The worker atomically claims queued WhatsApp messages before sending them.
alter table public.restaurant_order_messages
  add column if not exists claimed_at timestamptz;

-- Test restaurants must never consume the commercial MCU sequence.
create or replace function public.assign_pilot_food_public_id()
returns trigger language plpgsql set search_path = public
as $$
declare
  restaurant_is_live boolean;
begin
  select is_live into restaurant_is_live
    from public.pilot_restaurants where id = new.restaurant_id;
  if coalesce(restaurant_is_live, false) = false then
    new.public_id := 'PRB-' || lpad(nextval('public.pilot_food_public_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists pilot_food_public_id_before_insert on public.pilot_food_orders;
create trigger pilot_food_public_id_before_insert
before insert on public.pilot_food_orders
for each row execute function public.assign_pilot_food_public_id();

revoke all on function public.assign_pilot_food_public_id() from public, anon, authenticated;

commit;
