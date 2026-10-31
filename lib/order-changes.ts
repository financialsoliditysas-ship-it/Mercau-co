import { getSupabaseAdminClient } from './supabase-admin';
import { pilotMember, pilotRestaurant, PilotError, validatePilotOrder } from './restaurant-pilot';
import { orderChangesEnabled } from './order-changes-config';
import { sendCustomerChangePush } from './customer-push';

export async function changeOrder(userId:string,body:Record<string,unknown>) {
  if(!orderChangesEnabled())throw new PilotError('Esta opción todavía no está habilitada.',404);
  if(typeof body.publicId!=='string'||!/^(?:PRB-\d+|MCU-1-\d{6})$/.test(body.publicId))throw new PilotError('Pedido inválido.');
  const db=getSupabaseAdminClient();
  const target=await db.from('pilot_food_orders').select('*').eq('public_id',body.publicId).maybeSingle();
  if(target.error)throw new PilotError('No se pudo consultar el pedido.',503);
  const order=target.data;
  if(!order)throw new PilotError('Pedido no disponible.',404);
  const manager=body.action==='propose'||body.action==='withdraw';
  if(manager)await pilotMember(userId,true,order.restaurant_id);
  else if(order.customer_id!==userId)throw new PilotError('Pedido no disponible.',404);
  if(body.action==='propose') {
    if(typeof body.requestKey!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.requestKey))throw new PilotError('Referencia inválida.');
    if(!Array.isArray(body.changes)||!body.changes.length||body.changes.length>20)throw new PilotError('Selecciona qué producto falta.');
    const restaurant=await pilotRestaurant(order.restaurant_id),seen=new Set<string>();
    const edits=new Map<string,Record<string,unknown>>();
    for(const raw of body.changes) {
      if(!raw||typeof raw!=='object')throw new PilotError('Cambio inválido.');
      const item=raw as Record<string,unknown>;
      if(typeof item.lineId!=='string'||seen.has(item.lineId)||!order.lines.some((line:{lineId:string})=>line.lineId===item.lineId)
        ||!['remove','replace'].includes(String(item.action)))throw new PilotError('Revisa los productos seleccionados.');
      seen.add(item.lineId);edits.set(item.lineId,item);
    }
    const lines=order.lines.flatMap((line:{lineId:string;quantity:number})=>{
      const edit=edits.get(line.lineId);if(!edit)return [line];if(edit.action==='remove')return [];
      const input=validatePilotOrder({confirmed:true,requestKey:body.requestKey,name:order.customer_name,phone:order.customer_phone,
        address:order.address,neighborhood:order.neighborhood,paymentMethod:order.payment_method,
        lines:[{lineId:line.lineId,productId:edit.productId,quantity:line.quantity,selections:edit.selections||[],note:''}]},restaurant.menu);
      return input.lines;
    });
    const subtotal=lines.reduce((sum:number,line:{unitPrice:number;quantity:number})=>sum+line.unitPrice*line.quantity,0);
    if(!lines.length||!Number.isSafeInteger(subtotal)||subtotal<=0||subtotal>2147483647)throw new PilotError('La propuesta debe conservar al menos un producto con un total válido.');
    const result=await db.rpc('propose_food_change_v1',{p_order:order.id,p_actor:userId,p_key:body.requestKey,
      p_payload:{old_lines:order.lines,old_subtotal:order.subtotal,new_lines:lines,new_subtotal:subtotal}});
    if(result.error||!result.data?.id)throw new PilotError('El pedido cambió, tiene una propuesta pendiente o ya no admite cambios. Actualiza para revisarlo.',409);
    if(!result.data.replayed)await sendCustomerChangePush(order.customer_id,order.public_id,result.data.id).catch(()=>undefined);
    return {ok:true,replayed:result.data.replayed===true};
  }
  if(!['accept','decline','withdraw'].includes(String(body.action))||typeof body.proposalId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.proposalId))throw new PilotError('Acción inválida.');
  const proposal=await db.from('food_order_change_proposals').select('id').eq('id',body.proposalId).eq('order_id',order.id).maybeSingle();
  if(proposal.error)throw new PilotError('No se pudo comprobar la propuesta.',503);
  if(!proposal.data)throw new PilotError('Propuesta no disponible.',404);
  const result=await db.rpc('respond_food_change_v1',{p_proposal:body.proposalId,p_actor:userId,p_action:body.action});
  if(result.error)throw new PilotError('La propuesta cambió o el pedido ya no admite esta acción. Actualiza antes de continuar.',409);
  return {ok:true,replayed:result.data?.replayed===true};
}
