-- DRAFT: apply only to an isolated test environment first. Never executed by the app.
begin;
alter table public.delivery_orders add column if not exists request_key uuid;
alter table public.delivery_orders add column if not exists request_fingerprint text;
alter table public.delivery_orders add column if not exists dispatch_attempted_at timestamptz;
create unique index if not exists delivery_orders_request_key_idx
  on public.delivery_orders(request_key) where request_key is not null;

-- Historical requests need manual provider reconciliation before another attempt.
update public.delivery_orders set dispatch_attempted_at = coalesce(updated_at, now())
  where request_key is null and dispatch_attempted_at is null;

create or replace function public.claim_delivery_dispatch(p_order uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare claimed uuid;
begin
  update public.delivery_orders set dispatch_attempted_at=now()
    where id=p_order and dispatch_attempted_at is null
      and shipday_order_id is null and status='created'
    returning id into claimed;
  return claimed is not null;
end;
$$;
revoke all on function public.claim_delivery_dispatch(uuid) from public,anon,authenticated;
grant execute on function public.claim_delivery_dispatch(uuid) to service_role;
commit;
