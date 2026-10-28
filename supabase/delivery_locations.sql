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
