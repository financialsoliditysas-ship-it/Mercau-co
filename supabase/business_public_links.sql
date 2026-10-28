begin;

create table if not exists public.business_public_links (
  slug text primary key check (length(slug) <= 150 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  business_id text not null check (business_id ~ '^rec[A-Za-z0-9]{14}$'),
  is_canonical boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists business_public_links_canonical_idx
  on public.business_public_links(business_id) where is_canonical;
alter table public.business_public_links enable row level security;
revoke all on public.business_public_links from public, anon, authenticated;
grant select, insert, update on public.business_public_links to service_role;

create or replace function public.ensure_business_public_links(p_businesses jsonb)
returns table(business_id text, slug text)
language plpgsql security definer set search_path = public
as $$
declare
  item jsonb;
  v_id text;
  v_base text;
  v_location text;
  v_candidate text;
  v_slug text;
  attempt integer;
begin
  if p_businesses is null or jsonb_typeof(p_businesses) <> 'array' or jsonb_array_length(p_businesses) > 500 then
    raise exception 'Lista de negocios invalida';
  end if;
  -- Serialize this small registry so simultaneous batches cannot claim the same name.
  perform pg_advisory_xact_lock(hashtextextended('mercau-public-links', 0));
  for item in select value from jsonb_array_elements(p_businesses) order by value->>'business_id' loop
    v_id := item->>'business_id';
    v_base := item->>'base_slug';
    v_location := item->>'municipality_slug';
    if v_id is null or v_id !~ '^rec[A-Za-z0-9]{14}$'
      or v_base is null or length(v_base) > 80 or v_base !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or v_location is null or length(v_location) > 32 or v_location !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'Datos del enlace invalidos';
    end if;
    select links.slug into v_slug from public.business_public_links links
      where links.business_id = v_id and links.is_canonical;
    if not found then
      attempt := 0;
      v_candidate := v_base;
      loop
        insert into public.business_public_links as links(slug, business_id, is_canonical)
          values (v_candidate, v_id, true)
          on conflict on constraint business_public_links_pkey do nothing
          returning links.slug into v_slug;
        if found then exit; end if;
        attempt := attempt + 1;
        if attempt = 1 then v_candidate := v_base || '-' || v_location;
        elsif attempt = 2 then v_candidate := v_base || '-' || v_location || '-' || lower(v_id);
        else v_candidate := v_base || '-' || v_location || '-' || lower(v_id) || '-' || attempt::text;
        end if;
        if attempt > 1000 then raise exception 'No se pudo reservar el enlace'; end if;
      end loop;
    end if;
    return query select v_id, v_slug;
  end loop;
end;
$$;
revoke all on function public.ensure_business_public_links(jsonb) from public, anon, authenticated;
grant execute on function public.ensure_business_public_links(jsonb) to service_role;

-- First real link also exercises the reservation function. No business record is changed.
select * from public.ensure_business_public_links('[{"business_id":"recGLMhJYXTRE46st","base_slug":"financial-solidity-sas","municipality_slug":"nechi"}]'::jsonb);

commit;
