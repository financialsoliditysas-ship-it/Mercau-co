import { getSupabaseAdminClient } from './supabase-admin';
import { getDeliveryOrderById, syncOrderToShipday } from './deliveries';
import { sendNewOrderPush } from './business-push';
import { catalogOptionGroups, type CatalogOptionGroup } from './catalog-validation';
import { pilotOrderSelection, customerPaymentFinance } from './pilot-order-finance';
import { orderChangesEnabled } from './order-changes-config';
import { changeSelection, type OrderChange } from './order-changes-model';

export const pilotId = 'restaurante-mercado';
export class PilotError extends Error {
  constructor(message: string, public status = 400, public previousPublicId?: string, public canRepeat = false) { super(message); }
}
export type PilotProduct = { id: string; name: string; description?: string; category: string; price: number; image: string; optionGroups:CatalogOptionGroup[] };

export async function pilotUser(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new PilotError('Entra con tu cuenta para continuar.', 401);
  const { data, error } = await getSupabaseAdminClient().auth.getUser(token);
  if (error || !data.user) throw new PilotError('Tu sesion vencio. Vuelve a entrar.', 401);
  return data.user;
}
export async function pilotMember(userId: string, manager = false, restaurantId = pilotId) {
  if (restaurantId !== pilotId) {
    const restaurant = await pilotRestaurant(restaurantId);
    if (!manager) return;
    const { data, error } = await getSupabaseAdminClient().from('business_admins').select('business_id')
      .eq('business_id', restaurant.directory_business_id).eq('user_id', userId).eq('status', 'Activo').maybeSingle();
    if (error) throw new PilotError('No se pudo comprobar tu acceso al negocio.', 503);
    if (!data) throw new PilotError('No administras este negocio.', 403);
    return;
  }
  const { data, error } = await getSupabaseAdminClient().from('pilot_restaurant_members')
    .select('role').eq('restaurant_id', pilotId).eq('user_id', userId).maybeSingle();
  if (error) throw new PilotError('La prueba todavia no esta configurada.', 503);
  if (!data || (manager && data.role !== 'manager'))
    throw new PilotError('Esta cuenta no tiene acceso a esta prueba privada.', 403);
}
export async function pilotRestaurant(restaurantId = pilotId) {
  if (restaurantId !== pilotId && !/^rec[a-zA-Z0-9]{14}$/.test(restaurantId)) throw new PilotError('Negocio no disponible.', 404);
  const { data, error } = await getSupabaseAdminClient().from('pilot_restaurants').select('*').eq('id', restaurantId).single();
  if (error || !data) throw new PilotError('La prueba todavia no esta configurada.', 503);
  if (restaurantId !== pilotId && (!data.is_live || !data.directory_initialized || data.directory_business_id !== restaurantId))
    throw new PilotError('Este negocio no tiene pedidos habilitados.', 404);
  if(data.directory_initialized && data.directory_business_id) {
    const menu=await getSupabaseAdminClient().from('business_catalog_products').select('id,name,description,section,price,image_path,version,option_groups')
      .eq('business_id',data.directory_business_id).eq('status','published').eq('available',true).order('position').order('created_at');
    if(menu.error)throw new PilotError('No se pudo cargar el catálogo de la prueba.',503);
    data.menu=(menu.data || []).filter(product=>!data.is_live || product.price > 0).map(product=>({id:product.id,name:product.name,description:product.description,category:product.section || 'Otros',price:product.price,
      image:product.image_path ? `/api/negocios/${data.directory_business_id}/catalogo/${product.id}/foto?v=${product.version}` : '',optionGroups:catalogOptionGroups(product.option_groups || [])}));
  } else {
    data.menu=(data.menu || []).map((product:PilotProduct)=>({...product,optionGroups:catalogOptionGroups(product.optionGroups || [])}));
  }
  return data;
}
function text(value: unknown, length: number) { return typeof value === 'string' ? value.trim().slice(0, length) : ''; }
function optionalNumber(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function validatePilotOrder(body: Record<string, unknown>, menu: PilotProduct[]) {
  if (body.confirmed !== true) throw new PilotError('Confirma el resumen de tu pedido.');
  const requestKey = text(body.requestKey, 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestKey))
    throw new PilotError('Identificador de solicitud invalido.');
  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 20) throw new PilotError('Revisa tu carrito.');
  const seen = new Set<string>();
  const lines = body.lines.map(raw => {
    const line = raw as Record<string, unknown>;
    const product = menu.find(p => p.id === line?.productId);
    const lineId=text(line.lineId,36);
    if (!product || !/^[a-f0-9-]{36}$/i.test(lineId) || seen.has(lineId) || !Number.isInteger(line.quantity) || Number(line.quantity) < 1 || Number(line.quantity) > 10)
      throw new PilotError('Revisa los productos y cantidades.');
    seen.add(lineId);
    const rawSelections=Array.isArray(line.selections)?line.selections:[];
    const selectionMap=new Map(rawSelections.map(rawSelection=>{
      const selection=rawSelection as Record<string,unknown>;
      return [text(selection.groupId,36),Array.isArray(selection.choiceIds)?selection.choiceIds.map(value=>text(value,36)):[]];
    }));
    if(selectionMap.size!==rawSelections.length)throw new PilotError(`Revisa las opciones de ${product.name}.`);
    let extras=0;
    const selections=product.optionGroups.map(group=>{
      const choiceIds=selectionMap.get(group.id) || [];
      if(new Set(choiceIds).size!==choiceIds.length)throw new PilotError(`Hay opciones repetidas en ${product.name}.`);
      const choices=choiceIds.map(choiceId=>group.choices.find(choice=>choice.id===choiceId));
      if(choices.some(choice=>!choice))throw new PilotError(`Una opción de ${product.name} ya no está disponible.`);
      if(choiceIds.length<group.minSelections || choiceIds.length>group.maxSelections || (group.required && !choiceIds.length))throw new PilotError(`Completa “${group.name}” en ${product.name}.`);
      extras+=choices.reduce((sum,choice)=>sum+(choice?.priceDelta || 0),0);
      return {groupId:group.id,groupName:group.name,choices:choices.map(choice=>({choiceId:choice!.id,name:choice!.name,priceDelta:choice!.priceDelta}))};
    });
    if([...selectionMap.keys()].some(groupId=>!product.optionGroups.some(group=>group.id===groupId)))throw new PilotError(`Una opción de ${product.name} ya no está disponible.`);
    return { lineId,productId: product.id, name: product.name, basePrice:product.price,unitPrice: product.price+extras, quantity: Number(line.quantity),selections,note:text(line.note,240) };
  });
  const name = text(body.name, 120), phone = text(body.phone, 40).replace(/\D/g, '');
  const address = text(body.address, 240), neighborhood = text(body.neighborhood, 120);
  if (!name || !address || !neighborhood || !/^(57)?3\d{9}$/.test(phone))
    throw new PilotError('Completa nombre, direccion, barrio y celular colombiano.');
  const deliveryLatitude = optionalNumber(body.deliveryLatitude, -90, 90);
  const deliveryLongitude = optionalNumber(body.deliveryLongitude, -180, 180);
  if ((deliveryLatitude === null) !== (deliveryLongitude === null)) throw new PilotError('La ubicación de entrega está incompleta.');
  const paymentMethod = text(body.paymentMethod, 20).toUpperCase() || 'CASH';
  if (!['CASH', 'BREB_QR'].includes(paymentMethod)) throw new PilotError('Selecciona una forma de pago válida.');
  return { request_key: requestKey, customer_name: name, customer_phone: phone,
    address, neighborhood, instructions: text(body.instructions, 500), lines,
    delivery_latitude: deliveryLatitude, delivery_longitude: deliveryLongitude,
    delivery_location_accuracy_m: optionalNumber(body.deliveryLocationAccuracyM, 0, 100000),
    delivery_location_captured_at: text(body.deliveryLocationCapturedAt, 40) || null,
    payment_method: paymentMethod,
    subtotal: lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) };
}

export async function reportPilotPayment(userId: string, publicId: string, reference: string, restaurantId = pilotId) {
  await pilotMember(userId, false, restaurantId);
  const cleanReference = text(reference, 80);
  if (cleanReference.length < 4) throw new PilotError('Escribe los últimos cuatro dígitos o la referencia de la transferencia.');
  const db = getSupabaseAdminClient();
  const order = await db.from('pilot_food_orders').select('id,payment_method,payment_reported_at')
    .eq('public_id', publicId).eq('restaurant_id', restaurantId).eq('customer_id', userId).maybeSingle();
  if (order.error) throw new PilotError('No se pudo comprobar el pedido.', 503);
  if (!order.data) throw new PilotError('Pedido no encontrado.', 404);
  if (order.data.payment_method !== 'BREB_QR') throw new PilotError('Este pedido no utiliza Bre-B.');
  const updated = await db.from('pilot_food_orders').update({ payment_reference: cleanReference, payment_reported_at: new Date().toISOString() })
    .eq('id', order.data.id).select('id').single();
  if (updated.error) throw new PilotError('No se pudo registrar la referencia.', 503);
  await db.from('pilot_food_history').insert({ order_id: order.data.id, status: 'payment_reported', actor_id: userId });
  return { ok: true, message: 'Transferencia reportada. Mercáu verificará el ingreso antes de autorizar la preparación.' };
}

export async function lookupPilotOrderIntent(userId: string, requestKey: string, restaurantId = pilotId) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestKey) || (restaurantId !== pilotId && !/^rec[a-zA-Z0-9]{14}$/.test(restaurantId))) {
    throw new PilotError('Referencia de pedido inválida.');
  }
  const {data,error}=await getSupabaseAdminClient().rpc('lookup_order_receipt_v3',{
    p_scope:`food:${userId}:${restaurantId}`,p_key:requestKey
  });
  if(error || !data)throw new PilotError('No se pudo consultar el intento anterior. No crees otra referencia; vuelve a consultar.',503);
  return data;
}

export async function createPilotOrder(userId: string, body: Record<string, unknown>, restaurantId = pilotId) {
  await pilotMember(userId, false, restaurantId);
  const db = getSupabaseAdminClient();
  const restaurant = await pilotRestaurant(restaurantId);
  if (!restaurant.enabled) throw new PilotError('La prueba no esta recibiendo pedidos.', 503);
  const input = validatePilotOrder(body, restaurant.menu);
  const repeatOf = typeof body.repeatOf === 'string' ? body.repeatOf : '';
  if(repeatOf && (!/^PRB-\d+$/.test(repeatOf) || body.repeatConfirmed!==true))throw new PilotError('Confirma explícitamente la compra adicional.');
  const { data, error } = await db.rpc('create_food_order_once_v3', {
    p_scope: `food:${userId}:${restaurantId}`, p_key: input.request_key,
    p_payload: { ...input, restaurant_id: restaurantId, customer_id: userId,
      delivery_fee: restaurant.delivery_fee, delivery_mode: restaurant.delivery_mode,
      commission_rate_bps: restaurant.commission_rate_bps, customer_markup_bps: restaurant.customer_markup_bps,
      ...(repeatOf?{_repeat_of:repeatOf}:{}) }
  });
  if (error) throw new PilotError('No se pudo guardar el pedido. Puedes reintentar con el mismo carrito.', 503);
  if (data?.outcome === 'conflict') throw new PilotError('Esta referencia ya se usó con otros datos. Revisa el pedido anterior antes de volver a pedir.',409,data.previous_public_id);
  if(data?.outcome==='duplicate')throw new PilotError('Ya tienes un pedido reciente igual. ¿Quieres revisarlo o hacer otro?',409,data.previous_public_id,true);
  if(data?.outcome==='uncertain')throw new PilotError('El pedido anterior está registrado, pero su despacho necesita revisión. Revisa su estado o contacta a Mercáu antes de repetirlo.',409,data.previous_public_id);
  if (!data?.public_id) throw new PilotError('No se pudo comprobar el pedido. Revisa Mis pedidos antes de reintentar.',503);
  if (data.outcome === 'existing') return { public_id: data.public_id, replayed: true };
  await sendNewOrderPush({ businessId: restaurantId, orderId: data.public_id,
    customerName: input.customer_name, total: input.subtotal + Number(restaurant.delivery_fee || 0) }).catch(() => undefined);
  return { public_id: data.public_id, replayed: false };
}

export async function listPilotOrders(userId: string, manager: boolean, restaurantId = pilotId, publicId?: string) {
  await pilotMember(userId, manager, restaurantId);
  let query = getSupabaseAdminClient().from('pilot_food_orders')
    .select((pilotOrderSelection(manager)+(orderChangesEnabled()?`,changes:food_order_change_proposals(${changeSelection})`:'')) as ReturnType<typeof pilotOrderSelection>)
    .eq('restaurant_id', restaurantId).order('created_at', { ascending: false }).limit(50);
  if (!manager) query = query.eq('customer_id', userId);
  if(publicId){
    if(!/^PRB-\d+$/.test(publicId))throw new PilotError('Referencia de pedido inválida.');
    query=query.eq('public_id',publicId);
  }
  const { data, error } = await query;
  if (error) throw new PilotError('No se pudieron cargar los pedidos.', 503);
  // Only staff receive internal IDs; customer responses omit operational identifiers.
  return (data || []).map(o => manager ? o : {
    public_id: o.public_id, lines: o.lines, subtotal: o.subtotal, delivery_fee: o.delivery_fee,
    status: o.status, created_at: o.created_at, address: o.address, payment_method: o.payment_method,
    delivery_mode: o.delivery_mode,
    payment_reference: o.payment_reference, payment_reported_at: o.payment_reported_at, finance: customerPaymentFinance(o.finance),
    delivery: o.delivery ? { status: o.delivery.status } : null,
    ...(orderChangesEnabled()?{changes:(o as typeof o & {changes?:OrderChange[]}).changes||[]}: {})
  });
}

export async function transitionPilotOrder(userId: string, id: string, action: string, restaurantId = pilotId) {
  await pilotMember(userId, true, restaurantId);
  const db = getSupabaseAdminClient();
  const target = await db.from('pilot_food_orders').select('id,payment_method')
    .eq('id', id).eq('restaurant_id', restaurantId).maybeSingle();
  if (target.error) throw new PilotError('No se pudo comprobar el pedido.', 503);
  if (!target.data) throw new PilotError('Pedido no encontrado en este negocio.', 404);
  const { data, error } = await db.rpc('pilot_food_transition', {
    p_order: id, p_actor: userId, p_action: action
  });
  if (error) throw new PilotError('El pedido cambio o esta accion no esta disponible. Actualiza la lista.', 409);
  if (data?.dispatch && data.delivery_id) {
    // The dispatch service validates and persists the same recorded amounts on first send and retries.
    const delivery = await getDeliveryOrderById(data.delivery_id);
    if (!delivery) throw new PilotError('Pedido guardado. Revisa el despacho en administracion.', 503);
    let result;
    try {
      result = await syncOrderToShipday(delivery);
    } catch {
      throw new PilotError('Pedido guardado. No se confirmó el despacho. Revisa Admin / Envíos antes de volver a solicitar domiciliario.', 503);
    }
    return { ok: true, message: result.shipdayCreated ? 'Pedido enviado a Shipday.' :
      'Pedido guardado. El despacho requiere revision en Admin / Envios.' };
  }
  if (data?.delivery_mode === 'OWN') {
    return { ok:true, message: action === 'ready' ? 'Pedido listo para el domiciliario del negocio.'
      : action === 'out_for_delivery' ? 'El pedido quedó marcado en camino.'
      : action === 'delivered' ? 'Pedido marcado como entregado.' : 'Pedido actualizado.' };
  }
  return { ok: true, message: 'Pedido actualizado.' };
}
