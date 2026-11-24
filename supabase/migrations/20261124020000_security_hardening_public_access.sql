-- These tables are reached through authenticated server routes. RLS is already
-- enabled with no client policies, so remove broad default Data API grants.
revoke all on table public.assisted_order_admins from anon, authenticated;
revoke all on table public.delivery_orders from anon, authenticated;
revoke all on table public.delivery_status_history from anon, authenticated;

-- Both functions use only schema-qualified objects or pg_catalog built-ins.
-- An empty search_path prevents caller-controlled object resolution.
alter function public.next_delivery_public_id() set search_path = '';
alter function public.set_updated_at() set search_path = '';
