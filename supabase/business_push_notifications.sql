begin;
create table if not exists public.business_push_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  business_id text not null check (length(business_id) between 3 and 80), endpoint text not null check (length(endpoint) <= 2000),
  p256dh text not null check (length(p256dh) between 40 and 256), auth text not null check (length(auth) between 10 and 128),
  user_agent text not null default '', created_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), disabled_at timestamptz
);
create unique index if not exists business_push_subscriptions_access_endpoint_idx
  on public.business_push_subscriptions (user_id, business_id, endpoint);
create index if not exists business_push_subscriptions_business_active_idx on public.business_push_subscriptions (business_id) where disabled_at is null;
create index if not exists business_push_subscriptions_user_idx on public.business_push_subscriptions (user_id);
alter table public.business_push_subscriptions enable row level security;
revoke all on public.business_push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.business_push_subscriptions to service_role;
commit;
