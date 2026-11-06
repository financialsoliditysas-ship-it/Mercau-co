begin;

-- Supabase-owned directory records. Airtable IDs remain stable so existing
-- public links, catalog rows and historical orders keep their references.
create table if not exists public.directory_businesses (
  id text primary key,
  airtable_record_id text unique,
  name text not null check (length(trim(name)) between 1 and 160),
  category text not null default '',
  municipality text not null default '',
  neighborhood text not null default '',
  description text not null default '' check (length(description) <= 1200),
  whatsapp text not null default '',
  instagram text not null default '',
  facebook text not null default '',
  maps_url text not null default '',
  delivery_notes text not null default '',
  status text not null default 'Borrador'
    check (status in ('Borrador','Verificado','Destacado','Publicado','Archivado')),
  source text not null default 'supabase',
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists directory_businesses_public_idx
on public.directory_businesses (status, municipality, category, name);

create table if not exists public.directory_business_hours (
  business_id text primary key references public.directory_businesses(id) on delete cascade,
  schedule jsonb not null default '{}'::jsonb,
  timezone text not null default 'America/Bogota',
  updated_at timestamptz not null default now()
);

create table if not exists public.directory_business_media (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references public.directory_businesses(id) on delete cascade,
  kind text not null check (kind in ('logo','cover','gallery')),
  storage_path text not null,
  alt_text text not null default '',
  position integer not null default 0 check (position between 0 and 10000),
  created_at timestamptz not null default now(),
  unique (business_id, storage_path)
);

create index if not exists directory_business_media_order_idx
on public.directory_business_media (business_id, kind, position, created_at);

create or replace function public.directory_business_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists directory_business_touch on public.directory_businesses;
create trigger directory_business_touch before update on public.directory_businesses
for each row execute function public.directory_business_touch();

alter table public.directory_businesses enable row level security;
alter table public.directory_business_hours enable row level security;
alter table public.directory_business_media enable row level security;

revoke all on public.directory_businesses from public, anon, authenticated;
revoke all on public.directory_business_hours from public, anon, authenticated;
revoke all on public.directory_business_media from public, anon, authenticated;
grant select, insert, update, delete on public.directory_businesses to service_role;
grant select, insert, update, delete on public.directory_business_hours to service_role;
grant select, insert, update, delete on public.directory_business_media to service_role;

comment on table public.directory_businesses is
  'Supabase-owned public directory; airtable_record_id preserves legacy references during migration.';
comment on table public.directory_business_media is
  'Supabase Storage references for logos and business photos; files are served through checked application routes.';

commit;
