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
