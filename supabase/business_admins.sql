create table if not exists public.business_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id text not null,
  business_name text not null default '',
  owner_name text not null default '',
  owner_whatsapp text not null default '',
  private_token text not null,
  status text not null default 'Activo',
  created_at timestamptz not null default now(),
  unique (user_id, business_id),
  unique (private_token)
);

alter table public.business_admins enable row level security;

drop policy if exists "Users can read their own business access" on public.business_admins;
create policy "Users can read their own business access"
on public.business_admins
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own business access" on public.business_admins;
create policy "Users can create their own business access"
on public.business_admins
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own business access" on public.business_admins;
create policy "Users can update their own business access"
on public.business_admins
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
