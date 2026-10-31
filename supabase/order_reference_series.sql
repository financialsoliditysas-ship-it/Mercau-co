begin;

-- Activate only after deploying readers compatible with both reference formats.
create sequence if not exists public.food_order_mcu_1_seq
  as bigint start with 1 minvalue 1 maxvalue 999999 no cycle;
revoke all on sequence public.food_order_mcu_1_seq from public, anon, authenticated;
grant usage, select on sequence public.food_order_mcu_1_seq to service_role;

alter table public.pilot_food_orders alter column public_id set default
  ('MCU-1-' || lpad(nextval('public.food_order_mcu_1_seq')::text, 6, '0'));

commit;
