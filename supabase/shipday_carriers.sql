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
