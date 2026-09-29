create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, business_id)
);

alter table public.favorites enable row level security;

drop policy if exists "Users can read their own favorites" on public.favorites;
create policy "Users can read their own favorites"
on public.favorites
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can add their own favorites" on public.favorites;
create policy "Users can add their own favorites"
on public.favorites
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own favorites" on public.favorites;
create policy "Users can delete their own favorites"
on public.favorites
for delete
to authenticated
using (auth.uid() = user_id);
