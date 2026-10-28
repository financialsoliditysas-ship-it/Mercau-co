begin;

create or replace function public.financial_record_settlement(
  p_snapshot uuid,
  p_component text,
  p_payee_reference text,
  p_method text,
  p_external_reference text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.order_financial_snapshots;
  settlement public.financial_settlements;
  expected_amount bigint;
  expected_type text;
  completed_components integer;
begin
  if p_component not in ('MERCHANT_NET','COURIER_SHARE','VEGA_SHARE') then raise exception 'Componente de liquidacion invalido'; end if;
  if p_method not in ('CASH','BREB_QR','BANK_TRANSFER','INTERNAL') then raise exception 'Metodo de liquidacion invalido'; end if;
  if length(trim(coalesce(p_payee_reference,''))) < 2 then raise exception 'Beneficiario invalido'; end if;
  if length(trim(coalesce(p_external_reference,''))) < 4 then raise exception 'Referencia de liquidacion invalida'; end if;
  if length(trim(coalesce(p_idempotency_key,''))) < 12 then raise exception 'Clave de idempotencia invalida'; end if;

  select * into s from public.order_financial_snapshots where id = p_snapshot for update;
  if not found then raise exception 'Registro financiero no encontrado'; end if;
  if s.payment_status <> 'CONFIRMED' then raise exception 'El recaudo aun no esta confirmado'; end if;

  if p_component = 'MERCHANT_NET' then expected_amount := s.merchant_net; expected_type := 'MERCHANT';
  elsif p_component = 'COURIER_SHARE' then expected_amount := s.courier_share; expected_type := 'COURIER';
  else expected_amount := s.vega_share; expected_type := 'VEGA_EXPRESS';
  end if;

  select fs.* into settlement from public.financial_settlements fs where fs.idempotency_key = trim(p_idempotency_key);
  if found then return jsonb_build_object('ok',true,'duplicate',true,'settlement_id',settlement.id); end if;

  if exists (
    select 1 from public.financial_settlement_items fsi
    join public.financial_settlements fs on fs.id = fsi.settlement_id
    where fsi.snapshot_id = s.id and fsi.component = p_component and fs.status = 'CONFIRMED'
  ) then raise exception 'Este componente ya fue liquidado'; end if;

  insert into public.financial_settlements(payee_type,payee_reference,amount,method,status,external_reference,idempotency_key,settled_at)
  values(expected_type,trim(p_payee_reference),expected_amount,p_method,'CONFIRMED',trim(p_external_reference),trim(p_idempotency_key),now())
  returning * into settlement;
  insert into public.financial_settlement_items(settlement_id,snapshot_id,component,amount)
  values(settlement.id,s.id,p_component,expected_amount);

  select count(distinct fsi.component) into completed_components
  from public.financial_settlement_items fsi
  join public.financial_settlements fs on fs.id = fsi.settlement_id
  where fsi.snapshot_id = s.id and fsi.component in ('MERCHANT_NET','COURIER_SHARE','VEGA_SHARE') and fs.status = 'CONFIRMED';

  update public.order_financial_snapshots
  set settlement_status = case when completed_components = 3 then 'SETTLED' else 'PARTIAL' end, updated_at = now()
  where id = s.id;

  return jsonb_build_object('ok',true,'duplicate',false,'settlement_id',settlement.id,'component',p_component,'amount',expected_amount);
end;
$$;

revoke all on function public.financial_record_settlement(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.financial_record_settlement(uuid,text,text,text,text,text) to service_role;

commit;
