begin;

do $$
declare
  manager_id uuid;
  tester_id uuid;
begin
  select id into manager_id
  from auth.users
  where lower(email) = lower('GERENCIA@FINANCIALSOLIDITY.COM')
  limit 1;

  select id into tester_id
  from auth.users
  where lower(email) = lower('ISVERI.20@GMAIL.COM')
  limit 1;

  if manager_id is null then
    raise exception 'No existe la cuenta administrativa GERENCIA@FINANCIALSOLIDITY.COM';
  end if;

  if tester_id is null then
    raise exception 'No existe la cuenta de prueba ISVERI.20@GMAIL.COM';
  end if;

  if not exists (
    select 1
    from public.pilot_restaurant_members
    where restaurant_id = 'restaurante-mercado'
      and user_id = manager_id
      and role = 'manager'
  ) then
    raise exception 'La cuenta administrativa no tiene rol manager. No se modificaron accesos.';
  end if;

  insert into public.pilot_restaurant_members (restaurant_id, user_id, role)
  values ('restaurante-mercado', tester_id, 'tester')
  on conflict (restaurant_id, user_id)
  do update set role = excluded.role;
end;
$$;

commit;

select lower(u.email) as correo, m.role as permiso
from public.pilot_restaurant_members m
join auth.users u on u.id = m.user_id
where m.restaurant_id = 'restaurante-mercado'
  and lower(u.email) in (
    lower('GERENCIA@FINANCIALSOLIDITY.COM'),
    lower('ISVERI.20@GMAIL.COM')
  )
order by m.role;
