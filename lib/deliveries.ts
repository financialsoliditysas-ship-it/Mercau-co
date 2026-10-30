import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getDeliveryFeeCop } from "@/lib/delivery-config";
import {
  deliverySources,
  type DeliveryOrder,
  type DeliveryOrderInput,
  type DeliverySource,
  type DeliveryStatus
} from "@/lib/delivery-types";
import { getLogisticsProvider } from "@/lib/shipday";
import { requireShipdayWebhookToken } from '@/lib/shipday-webhook-auth';
import { prepareDispatchFinance } from './dispatch-finance';
import { queryShipdayOrder } from './shipday-reconciliation';

export class DeliveryControlError extends Error {
  constructor(message: string, public status = 409, public previousPublicId?: string, public canRepeat = false) { super(message); }
}
type DeliveryContext={userId?:string;businessId?:string;guestId?:string};
function deliveryIntentScope(context: DeliveryContext, source: string) {
  return context.userId ? `delivery:user:${context.userId}` : source !== 'WEB' ? `delivery:channel:${source}`
    : context.guestId ? `delivery:guest:${context.guestId}` : '';
}
export async function lookupDeliveryIntent(key: string, context: DeliveryContext, source = 'WEB') {
  const scope=deliveryIntentScope(context,source);
  if(!scope || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key))throw new DeliveryControlError('Referencia de solicitud inválida.',400);
  const {data,error}=await getSupabaseAdminClient().rpc('lookup_order_receipt_v3',{p_scope:scope,p_key:key});
  if(error || !data)throw new DeliveryControlError('No se pudo consultar el intento anterior. Conserva su referencia; no crees otra solicitud.',503);
  return data;
}

function cleanText(value: unknown, max = 300) {
  return String(value || "").trim().slice(0, max);
}

function parseSource(value: unknown): DeliverySource {
  const source = cleanText(value, 20).toUpperCase();
  return deliverySources.includes(source as DeliverySource)
    ? (source as DeliverySource)
    : "WEB";
}

function requireField(value: string, label: string) {
  if (!value) throw new Error(`Falta ${label}.`);
}

function optionalNumber(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function normalizeDeliveryInput(body: Record<string, unknown>): DeliveryOrderInput {
  const input = {
    serviceType: cleanText(body.serviceType, 80),
    customerName: cleanText(body.customerName, 120),
    customerPhone: cleanText(body.customerPhone, 40),
    pickupName: cleanText(body.pickupName, 160),
    pickupAddress: cleanText(body.pickupAddress, 240),
    pickupNeighborhood: cleanText(body.pickupNeighborhood, 120),
    pickupContact: cleanText(body.pickupContact, 120),
    pickupPhone: cleanText(body.pickupPhone, 40),
    pickupInstructions: cleanText(body.pickupInstructions, 500),
    pickupLatitude: optionalNumber(body.pickupLatitude, -90, 90),
    pickupLongitude: optionalNumber(body.pickupLongitude, -180, 180),
    pickupLocationAccuracyM: optionalNumber(body.pickupLocationAccuracyM, 0, 100000),
    pickupLocationCapturedAt: cleanText(body.pickupLocationCapturedAt, 40) || null,
    deliveryName: cleanText(body.deliveryName, 160),
    deliveryAddress: cleanText(body.deliveryAddress, 240),
    deliveryNeighborhood: cleanText(body.deliveryNeighborhood, 120),
    deliveryPhone: cleanText(body.deliveryPhone, 40),
    deliveryInstructions: cleanText(body.deliveryInstructions, 500),
    deliveryLatitude: optionalNumber(body.deliveryLatitude, -90, 90),
    deliveryLongitude: optionalNumber(body.deliveryLongitude, -180, 180),
    deliveryLocationAccuracyM: optionalNumber(body.deliveryLocationAccuracyM, 0, 100000),
    deliveryLocationCapturedAt: cleanText(body.deliveryLocationCapturedAt, 40) || null,
    description: cleanText(body.description, 500),
    notes: cleanText(body.notes, 700),
    source: parseSource(body.source)
  };

  requireField(input.serviceType, "el tipo de servicio");
  requireField(input.customerName, "el nombre de quien solicita");
  requireField(input.customerPhone, "el telefono de quien solicita");
  requireField(input.pickupName, "el punto de recogida");
  requireField(input.pickupAddress, "la direccion de recogida");
  requireField(input.pickupPhone, "el telefono de recogida");
  requireField(input.deliveryName, "el destinatario");
  requireField(input.deliveryAddress, "la direccion de entrega");
  requireField(input.deliveryPhone, "el telefono de entrega");
  requireField(input.description, "que vamos a llevar");
  if ((input.pickupLatitude === null) !== (input.pickupLongitude === null)) {
    throw new Error("La ubicación de recogida está incompleta.");
  }
  if ((input.deliveryLatitude === null) !== (input.deliveryLongitude === null)) {
    throw new Error("La ubicación de entrega está incompleta.");
  }

  return input;
}

export async function createDeliveryOrder(rawBody: Record<string, unknown>, context: DeliveryContext = {}) {
  const input = normalizeDeliveryInput(rawBody);
  const supabase = getSupabaseAdminClient();

  const insertPayload = {
    service_type: input.serviceType,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    pickup_name: input.pickupName,
    pickup_address: input.pickupAddress,
    pickup_neighborhood: input.pickupNeighborhood,
    pickup_contact: input.pickupContact,
    pickup_phone: input.pickupPhone,
    pickup_instructions: input.pickupInstructions,
    pickup_latitude: input.pickupLatitude,
    pickup_longitude: input.pickupLongitude,
    pickup_location_accuracy_m: input.pickupLocationAccuracyM,
    pickup_location_captured_at: input.pickupLocationCapturedAt,
    delivery_name: input.deliveryName,
    delivery_address: input.deliveryAddress,
    delivery_neighborhood: input.deliveryNeighborhood,
    delivery_phone: input.deliveryPhone,
    delivery_instructions: input.deliveryInstructions,
    delivery_latitude: input.deliveryLatitude,
    delivery_longitude: input.deliveryLongitude,
    delivery_location_accuracy_m: input.deliveryLocationAccuracyM,
    delivery_location_captured_at: input.deliveryLocationCapturedAt,
    description: input.description,
    notes: input.notes,
    delivery_fee: getDeliveryFeeCop(),
    status: "created",
    source: input.source
    ,...(context.userId ? {customer_user_id:context.userId}:{}),...(context.businessId ? {pickup_business_id:context.businessId}:{})
  };

  const requestKey = cleanText(rawBody.requestKey, 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestKey)) {
    throw new DeliveryControlError('Falta una referencia válida para conservar la solicitud al reintentar.',400);
  }
  const scope = deliveryIntentScope(context,input.source || 'WEB');
  if (!scope) throw new DeliveryControlError('No se pudo conservar la sesión de la solicitud. Recarga antes de continuar.',400);
  const { data, error } = await supabase.rpc('create_delivery_once_v3', {
    p_scope: scope, p_key: requestKey, p_payload: {...insertPayload,
      ...(rawBody.repeatConfirmed===true && typeof rawBody.repeatOf==='string' && /^MCU-\d+$/.test(rawBody.repeatOf)?{_repeat_of:rawBody.repeatOf}:{})}
  });
  if (error || !data) throw new DeliveryControlError('No se pudo comprobar la solicitud. Conserva la referencia y reintenta.',503);
  if (data.outcome === 'conflict') throw new DeliveryControlError('Esta referencia ya se usó con otros datos. Revisa la solicitud anterior antes de crear otra.',409,data.previous_public_id);
  if(data.outcome==='duplicate')throw new DeliveryControlError('Ya tienes una solicitud reciente igual. ¿Quieres revisarla o hacer otra?',409,data.previous_public_id,true);
  if(data.outcome==='uncertain')throw new DeliveryControlError('La solicitud anterior tiene un despacho incierto. Revisa su estado o contacta a Mercáu antes de repetirla.',409,data.previous_public_id);
  const order = data.order as DeliveryOrder;
  if (data.outcome === 'existing') return { order, shipdayCreated: Boolean(order.shipday_order_id) };
  return syncOrderToShipday(order);
}

export async function reconcileDeliveryDispatch(id: string) {
  const order = await getDeliveryOrderById(id);
  if (!order) throw new DeliveryControlError('Envío no encontrado.',404);
  if (!order.dispatch_attempted_at) throw new DeliveryControlError('Este envío no tiene un intento externo que conciliar.');
  let result;
  try { result = await queryShipdayOrder(order); }
  catch { result = { outcome: 'unavailable' as const, checkedAt: new Date().toISOString(), count: 0 }; }
  const recorded = await getSupabaseAdminClient().rpc('record_dispatch_reconciliation_v3', {
    p_order: order.id, p_attempt: order.dispatch_attempted_at, p_outcome: result.outcome,
    p_external: 'providerId' in result ? result.providerId || null : null, p_checked_at: result.checkedAt
  });
  if (recorded.error || !recorded.data) throw new DeliveryControlError('No se pudo guardar la conciliación. No vuelvas a despachar este envío.',503);
  const messages = {
    matched: 'Envío encontrado y vinculado a Shipday. No se creó otro despacho.',
    not_found: 'Shipday no devolvió coincidencias. Esto no confirma que el envío nunca existió: continúa bloqueado y requiere revisión con el operador.',
    multiple: 'Hay varias coincidencias en Shipday. Requiere revisión con el operador; no se reenviará.',
    mismatch: 'Los datos de Shipday no coinciden con el envío. Requiere revisión; no se vinculará ni reenviará.',
    unavailable: 'No se pudo consultar Shipday. El despacho continúa bloqueado; puedes volver a consultar.'
  };
  return { ...recorded.data, message: messages[result.outcome] };
}

export async function syncOrderToShipday(order: DeliveryOrder) {
  const supabase = getSupabaseAdminClient();
  const current = await getDeliveryOrderById(order.id);
  if (!current) throw new DeliveryControlError('Envío no encontrado.', 404);
  if (current.shipday_order_id) return { order: current, shipdayCreated: true };
  if (current.dispatch_attempted_at) {
    throw new DeliveryControlError('Este envío ya tuvo un intento de despacho. Revisa Shipday antes de volver a enviarlo.');
  }
  if (!['created', 'integration_error'].includes(current.status)) {
    throw new DeliveryControlError('El estado del envío no permite solicitar un domiciliario.');
  }
  // Validate configuration and recorded collection instructions before taking the one-use claim.
  const provider = getLogisticsProvider();
  await prepareDispatchFinance(current);
  const claim = await supabase.rpc('claim_delivery_dispatch_v2', { p_order: order.id });
  if (claim.error) throw new DeliveryControlError('No se pudo reservar el despacho. No se contactó a Shipday.', 503);
  if (!claim.data) {
    const latest = await getDeliveryOrderById(order.id);
    if (latest?.shipday_order_id) return { order: latest, shipdayCreated: true };
    throw new DeliveryControlError('El despacho ya está en proceso, fue cancelado o requiere conciliación.');
  }
  let externalId: string;
  try {
    const result = await provider.createOrder(claim.data as DeliveryOrder);
    externalId = result.externalOrderId;
  } catch {
    // A timeout does not prove that the provider rejected the request. Never clear the claim.
    await supabase.from('delivery_orders').update({
      status: "integration_error",
      shipday_last_error: 'Resultado de despacho incierto. Conciliar en Shipday antes de reintentar.'
    }).eq('id', order.id).is('shipday_order_id', null).in('status', ['created', 'integration_error']);
    const latest = await getDeliveryOrderById(order.id);
    if (latest?.shipday_order_id) return { order: latest, shipdayCreated: true };
    return { order: latest || claim.data as DeliveryOrder, shipdayCreated: false };
  }
  const completed = await supabase.rpc('complete_delivery_dispatch_v2', { p_order: order.id, p_external: externalId });
  if (completed.error || !completed.data) {
    throw new DeliveryControlError('Shipday recibió el envío, pero falta confirmar su registro en Mercáu. Revisa administración; no vuelvas a despacharlo.', 503);
  }
  return { order: completed.data as DeliveryOrder, shipdayCreated: true };
}

export async function getDeliveryOrderByPublicId(publicId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("delivery_orders")
    .select("*")
    .eq("public_id", publicId)
    .single();

  if (error) return null;
  return data as DeliveryOrder;
}

export async function getDeliveryHistory(orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("delivery_status_history")
    .select("*")
    .eq("delivery_order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) return [];
  return data || [];
}

export async function listDeliveryOrders() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("delivery_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data || []) as DeliveryOrder[];
}

export async function getDeliveryOrderById(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("delivery_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as DeliveryOrder;
}

export async function cancelDeliveryOrder(order: DeliveryOrder) {
  const { data, error } = await getSupabaseAdminClient().rpc('cancel_unsubmitted_delivery_v2', { p_order: order.id });
  if (error || !data) throw new DeliveryControlError('No se confirmó la cancelación. Si el envío salió o pudo salir, cancélalo en Shipday y espera su confirmación.');
  return data as DeliveryOrder;
}

export function mapShipdayEventToStatus(event: string, orderStatus: string): DeliveryStatus {
  const normalizedEvent = cleanText(event, 80).toUpperCase();
  const normalizedStatus = cleanText(orderStatus, 80).toUpperCase();

  if (normalizedEvent === "ORDER_COMPLETED" || normalizedStatus === "ALREADY_DELIVERED") return "delivered";
  if (normalizedEvent === "ORDER_FAILED" || normalizedEvent === "ORDER_INCOMPLETE" || normalizedStatus === "FAILED_DELIVERY" || normalizedStatus === "INCOMPLETE") return "failed";
  if (normalizedEvent === "ORDER_DELETE") return "cancelled";
  if (normalizedEvent === "ORDER_UNASSIGNED") return "sent_to_shipday";
  if (normalizedEvent === "ORDER_ONTHEWAY" || normalizedStatus === "READY_TO_DELIVER") return "in_transit";
  if (normalizedEvent === "ORDER_PIKEDUP" || normalizedStatus === "PICKED_UP") return "picked_up";
  if (normalizedEvent === "ORDER_ASSIGNED" || normalizedEvent === "ORDER_ACCEPTED_AND_STARTED" || normalizedStatus === "STARTED") return "assigned";

  return "sent_to_shipday";
}

export async function applyShipdayWebhook(payload: Record<string, unknown>, token: string | null) {
  requireShipdayWebhookToken(token);
  const shipdayOrder = (payload.order || {}) as Record<string, unknown>;
  const shipdayOrderId = cleanText(shipdayOrder.id, 80);
  const publicId = cleanText(shipdayOrder.order_number, 80);
  const event = cleanText(payload.event, 80);
  const externalStatus = cleanText(payload.order_status, 80);
  const timestamp = Number(payload.timestamp);
  if (!shipdayOrderId || !Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp > Date.now() + 300000) {
    throw new DeliveryControlError('Evento Shipday sin identificador o fecha válida.', 400);
  }
  const mapped = mapShipdayEventToStatus(event, externalStatus);
  const known = ['ORDER_INSERTED','ORDER_COMPLETED','ORDER_FAILED','ORDER_INCOMPLETE','ORDER_DELETE',
    'ORDER_ONTHEWAY','ORDER_PIKEDUP','ORDER_ASSIGNED','ORDER_ACCEPTED_AND_STARTED',
    'ORDER_UNASSIGNED','ORDER_PIKEDUP_REMOVED','ORDER_ONTHEWAY_REMOVED'].includes(event.toUpperCase());
  const status = mapped === 'sent_to_shipday' && !known ? 'unknown' : mapped;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc('apply_shipday_event_v2', {
    p_public: publicId, p_external: shipdayOrderId, p_status: status, p_event: event,
    p_at: new Date(timestamp).toISOString(), p_payload: payload
  });
  if (error || !data) throw new DeliveryControlError('No se pudo registrar el evento Shipday. Requiere revisión o reintento del proveedor.', 503);
  return data;
}
