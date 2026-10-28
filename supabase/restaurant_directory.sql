begin;
alter table public.pilot_restaurants add column if not exists directory_business_id text;
alter table public.pilot_restaurants add column if not exists directory_initialized boolean not null default false;
alter table public.pilot_restaurants add column if not exists directory_setup_key uuid;
alter table public.pilot_restaurants add column if not exists directory_setup_until timestamptz;
alter table public.business_catalog_products add column if not exists pilot_product_id text;
create unique index if not exists catalog_pilot_product_idx
on public.business_catalog_products(business_id,pilot_product_id) where pilot_product_id is not null;
create unique index if not exists pilot_directory_business_idx
on public.pilot_restaurants(directory_business_id) where directory_business_id is not null;

create or replace function public.pilot_directory_claim(p_key uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.pilot_restaurants
  set directory_setup_key=p_key, directory_setup_until=now()+interval '2 minutes'
  where id='restaurante-mercado'
    and (directory_setup_until is null or directory_setup_until<now());
  return found;
end;
$$;
revoke all on function public.pilot_directory_claim(uuid) from public, anon, authenticated;
grant execute on function public.pilot_directory_claim(uuid) to service_role;
commit;
