begin;

do $$
declare
  old_user_id uuid;
  new_user_id uuid;
  target_business_id text;
begin
  select id into old_user_id
  from auth.users
  where lower(email) = lower('gerencia@financialsolidity.com')
  limit 1;

  select id into new_user_id
  from auth.users
  where lower(email) = lower('soybajocaucano@gmail.com')
  limit 1;

  if old_user_id is null then
    raise exception 'No existe la cuenta anterior gerencia@financialsolidity.com';
  end if;

  if new_user_id is null then
    raise exception 'No existe la cuenta nueva soybajocaucano@gmail.com';
  end if;

  if old_user_id = new_user_id then
    raise exception 'Las dos direcciones corresponden al mismo usuario';
  end if;

  select directory_business_id into target_business_id
  from public.pilot_restaurants
  where id = 'restaurante-mercado'
    and name = 'Restaurante Mercado';

  if target_business_id is null then
    raise exception 'No se encontró el Restaurante Mercado de prueba';
  end if;

  if not exists (
    select 1 from public.business_admins
    where user_id = old_user_id
      and business_id = target_business_id
      and business_name = 'Restaurante Mercado [PRUEBA]'
      and status = 'Activo'
  ) then
    raise exception 'La cuenta anterior no administra la ficha objetivo';
  end if;

  if exists (
    select 1 from public.business_admins
    where user_id = new_user_id
      and business_id = target_business_id
  ) then
    raise exception 'La cuenta nueva ya tiene una relación con esta ficha';
  end if;

  if not exists (
    select 1 from public.pilot_restaurant_members
    where restaurant_id = 'restaurante-mercado'
      and user_id = old_user_id
      and role = 'manager'
  ) then
    raise exception 'La cuenta anterior no tiene el rol manager del piloto';
  end if;

  update public.business_admins
  set user_id = new_user_id,
      owner_name = coalesce(
        nullif((select raw_user_meta_data->>'name' from auth.users where id = new_user_id), ''),
        owner_name
      )
  where user_id = old_user_id
    and business_id = target_business_id
    and status = 'Activo';

  insert into public.pilot_restaurant_members (restaurant_id, user_id, role)
  values ('restaurante-mercado', new_user_id, 'manager')
  on conflict (restaurant_id, user_id)
  do update set role = 'manager';

  delete from public.pilot_restaurant_members
  where restaurant_id = 'restaurante-mercado'
    and user_id = old_user_id;

  insert into public.account_roles (user_id, role)
  values (new_user_id, 'business_owner')
  on conflict do nothing;

  delete from public.account_roles
  where user_id = old_user_id
    and role = 'business_owner'
    and not exists (
      select 1 from public.business_admins
      where user_id = old_user_id and status = 'Activo'
    );

  update public.business_push_subscriptions
  set disabled_at = now()
  where user_id = old_user_id
    and business_id = target_business_id
    and disabled_at is null;

  insert into public.account_audit (actor_id, business_id, action, fields)
  values (
    null,
    target_business_id,
    'admin_transfer_business_access',
    array['from:gerencia@financialsolidity.com', 'to:soybajocaucano@gmail.com']
  );
end;
$$;

commit;

select
  b.business_id,
  b.business_name,
  lower(u.email) as correo,
  b.status,
  m.role as permiso_piloto
from public.business_admins b
join auth.users u on u.id = b.user_id
left join public.pilot_restaurant_members m
  on m.user_id = b.user_id
 and m.restaurant_id = 'restaurante-mercado'
where b.business_id = (
  select directory_business_id
  from public.pilot_restaurants
  where id = 'restaurante-mercado'
    and name = 'Restaurante Mercado'
);
