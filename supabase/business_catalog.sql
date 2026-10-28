begin;

create table if not exists public.business_catalog_products (
  id uuid primary key default gen_random_uuid(),
  business_id text not null check (business_id ~ '^rec[A-Za-z0-9]{14}$'),
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 600),
  section text not null default '' check (length(section) <= 80),
  price integer not null check (price between 0 and 100000000),
  available boolean not null default true,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  image_path text,
  position integer not null default 0 check (position between 0 and 10000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_catalog_business_status_idx
on public.business_catalog_products (business_id, status, position, created_at);

create or replace function public.business_catalog_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_catalog_touch on public.business_catalog_products;
create trigger business_catalog_touch before update on public.business_catalog_products
for each row execute function public.business_catalog_touch();

alter table public.business_catalog_products enable row level security;
revoke all on public.business_catalog_products from public, anon, authenticated;
grant select, insert, update on public.business_catalog_products to service_role;

-- Private files are served only through checked Mercau endpoints or short-lived owner URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-catalog', 'business-catalog', false, 2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists business_catalog_server_only on storage.objects;
create policy business_catalog_server_only on storage.objects
as restrictive for all to anon, authenticated
using (bucket_id <> 'business-catalog')
with check (bucket_id <> 'business-catalog');

commit;
