alter table public.pilot_food_orders
  add column if not exists order_source text not null default 'CUSTOMER',
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null;

alter table public.pilot_food_orders
  drop constraint if exists pilot_food_orders_order_source_check,
  add constraint pilot_food_orders_order_source_check
  check (order_source in ('CUSTOMER','ADMIN_ASSISTED'));

create index if not exists pilot_food_orders_order_source_created_idx
  on public.pilot_food_orders(order_source,created_at desc);
