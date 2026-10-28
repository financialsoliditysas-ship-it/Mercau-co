begin;

-- Only declared date validation. This is not identity or document verification.
create or replace function public.account_birth_date_error(p_birth text, p_today date)
returns text language plpgsql immutable security invoker set search_path='' as $$
declare birth date; years integer; begin
  if p_birth is null or p_birth !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or p_today is null then
    return 'Ingresa una fecha de nacimiento válida.';
  end if;
  begin
    birth:=p_birth::date;
  exception when datetime_field_overflow or invalid_datetime_format then
    return 'Ingresa una fecha de nacimiento válida.';
  end;
  if to_char(birth,'YYYY-MM-DD')<>p_birth then return 'Ingresa una fecha de nacimiento válida.'; end if;
  if birth>p_today then return 'La fecha de nacimiento no puede estar en el futuro.'; end if;
  years:=extract(year from p_today)::integer-extract(year from birth)::integer-
    case when to_char(p_today,'MMDD')<to_char(birth,'MMDD') then 1 else 0 end;
  if years<18 then return 'Para crear una cuenta en Mercáu debes tener 18 años cumplidos.'; end if;
  return null;
end $$;

-- Enable this function as the Before User Created hook after the UI is deployed.
create or replace function public.hook_mercau_adult_signup(event jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare problem text; begin
  problem:=public.account_birth_date_error(event->'user'->'user_metadata'->>'birth_date',(now() at time zone 'America/Bogota')::date);
  if problem is not null then
    return jsonb_build_object('error',jsonb_build_object('http_code',403,'message',problem));
  end if;
  return '{}'::jsonb;
end $$;

revoke all on function public.account_birth_date_error(text,date) from public,anon,authenticated;
revoke all on function public.hook_mercau_adult_signup(jsonb) from public,anon,authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.account_birth_date_error(text,date) to supabase_auth_admin;
grant execute on function public.hook_mercau_adult_signup(jsonb) to supabase_auth_admin;
commit;
