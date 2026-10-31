begin;
set local lock_timeout = '5s';

-- Preserve the deployed transition, changing only the reference of new food deliveries.
do $$
declare
  definition text := pg_get_functiondef('public.pilot_food_transition(uuid,uuid,text)'::regprocedure);
  before_columns text := 'insert into public.delivery_orders(service_type,customer_name,customer_phone,';
  after_columns text := 'insert into public.delivery_orders(public_id,service_type,customer_name,customer_phone,';
  before_values text := 'values (''Recoger una compra'',o.customer_name,o.customer_phone,';
  after_values text := 'values (case when o.public_id ~ ''^MCU-1-[0-9]{6}$'' then o.public_id else public.next_delivery_public_id() end,''Recoger una compra'',o.customer_name,o.customer_phone,';
begin
  if strpos(definition,after_columns)>0 and strpos(definition,after_values)>0 then return; end if;
  if strpos(definition,before_columns)=0 or strpos(definition,before_values)=0 then
    raise exception 'Unexpected food transition; reference migration not applied';
  end if;
  definition := replace(replace(definition,before_columns,after_columns),before_values,after_values);
  execute definition;
end $$;

commit;
