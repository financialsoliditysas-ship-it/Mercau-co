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
import { createHash } from 'node:crypto';

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

async function addHistory(params: {
  deliveryOrderId: string;
  status: DeliveryStatus;
  source: string;
  externalStatus?: string | null;
  externalEvent?: string | null;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdminClient();
  const payload = {
    delivery_order_id: params.deliveryOrderId,
    status: params.status,
    source: params.source,
    external_status: params.externalStatus || null,
    external_event: params.externalEvent || null,
    dedupe_key: params.dedupeKey || null,
    metadata: params.metadata || {}
  };

  const { error } = await supabase.from("delivery_status_history").insert(payload);
  if (error && !String(error.message || "").includes("duplicate key")) {
    console.error("delivery_history_insert_error", error.message);
  }
}

async function updateDeliveryOrder(
  id: string,
  updates: Partial<DeliveryOrder> & Record<string, unknown>
) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("delivery_orders")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as DeliveryOrder;
}

export async function createDeliveryOrder(rawBody: Record<string, unknown>, context: {userId?:string;businessId?:string} = {}) {
  const input = normalizeDeliveryInput(rawBody);
  const requestKey = String(rawBody.requestKey || '');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestKey)) {
    throw new Error('Actualiza el formulario antes de enviar la solicitud.');
  }
  const fingerprint = createHash('sha256').update(JSON.stringify({ input,
    userId: context.userId || null, businessId: context.businessId || null })).digest('hex');
  const supabase = getSupabaseAdminClient();

  const insertPayload = {
    request_key: requestKey,
    request_fingerprint: fingerprint,
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

  const { data, error } = await supabase
    .from("delivery_orders")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error?.code === '23505') {
    const existing = await supabase.from('delivery_orders').select('*').eq('request_key', requestKey).maybeSingle();
    if (existing.error || !existing.data || existing.data.request_fingerprint !== fingerprint) {
      throw new Error('La solicitud cambió. Revisa su estado antes de intentar nuevamente.');
    }
    return { order: existing.data as DeliveryOrder, shipdayCreated: Boolean(existing.data.shipday_order_id) };
  }
  if (error) throw new Error(error.message);

  const order = data as DeliveryOrder;
  await addHistory({
    deliveryOrderId: order.id,
    status: "created",
    source: order.source,
    metadata: { public_id: order.public_id }
  });

  return syncOrderToShipday(order);
}

export async function syncOrderToShipday(order: DeliveryOrder): Promise<{order: DeliveryOrder; shipdayCreated: boolean; blocked?: boolean}> {
  if (order.shipday_order_id) return { order, shipdayCreated: true };
  const claim = await getSupabaseAdminClient().rpc('claim_delivery_dispatch', { p_order: order.id });
  if (claim.error) throw new Error('El despacho necesita revisión de configuración. No se envió una nueva solicitud.');
  if (claim.data !== true) {
    const current = await getDeliveryOrderById(order.id);
    if (!current) throw new Error('No se pudo comprobar el despacho.');
    return { order: current, shipdayCreated: Boolean(current.shipday_order_id), blocked: !current.shipday_order_id };
  }
  try {
    const provider = getLogisticsProvider();
    const result = await provider.createOrder(order);
    const updated = await updateDeliveryOrder(order.id, {
      status: "sent_to_shipday",
      shipday_order_id: result.externalOrderId,
      shipday_status: result.externalStatus || null,
      shipday_tracking_url: result.trackingUrl || null,
      shipday_last_error: null
    });

    await addHistory({
      deliveryOrderId: order.id,
      status: "sent_to_shipday",
      source: "SHIPDAY",
      externalStatus: result.externalStatus || null,
      externalEvent: "ORDER_INSERTED",
      dedupeKey: `shipday-insert-${result.externalOrderId}`,
      metadata: { shipday_order_id: result.externalOrderId, response: result.raw }
    });

    return { order: updated, shipdayCreated: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    const updated = await updateDeliveryOrder(order.id, {
      status: "integration_error",
      shipday_last_error: message
    });

    await addHistory({
      deliveryOrderId: order.id,
      status: "integration_error",
      source: "SHIPDAY",
      externalStatus: null,
      externalEvent: "SHIPDAY_CREATE_FAILED",
      metadata: { error: message }
    });

    return { order: updated, shipdayCreated: false };
  }
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
  const updated = await updateDeliveryOrder(order.id, {
    status: "cancelled",
    cancelled_at: new Date().toISOString()
  });

  await addHistory({
    deliveryOrderId: order.id,
    status: "cancelled",
    source: "ADMIN",
    externalEvent: "ADMIN_CANCELLED",
    metadata: { previous_status: order.status }
  });

  return updated;
}

export function mapShipdayEventToStatus(event: string, orderStatus: string): DeliveryStatus {
  const normalizedEvent = cleanText(event, 80).toUpperCase();
  const normalizedStatus = cleanText(orderStatus, 80).toUpperCase();

  if (normalizedEvent === "ORDER_COMPLETED" || normalizedStatus === "ALREADY_DELIVERED") return "delivered";
  if (normalizedEvent === "ORDER_FAILED" || normalizedEvent === "ORDER_INCOMPLETE" || normalizedStatus === "FAILED_DELIVERY" || normalizedStatus === "INCOMPLETE") return "failed";
  if (normalizedEvent === "ORDER_DELETE") return "cancelled";
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
  const timestamp = cleanText(payload.timestamp, 80);
  const carrier = (payload.carrier || {}) as Record<string, unknown>;
  const status = mapShipdayEventToStatus(event, externalStatus);
  const supabase = getSupabaseAdminClient();

  let query = supabase.from("delivery_orders").select("*");
  query = shipdayOrderId
    ? query.eq("shipday_order_id", shipdayOrderId)
    : query.eq("public_id", publicId);

  const { data: order, error } = await query.single();
  if (error || !order) throw new Error("Orden Mercau no encontrada para webhook Shipday.");

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status,
    shipday_status: externalStatus || event || null
  };
  if (carrier.id) updates.shipday_carrier_id = cleanText(carrier.id, 80);
  if (carrier.name) updates.courier_name = cleanText(carrier.name, 160);
  if (carrier.phone) updates.courier_phone = cleanText(carrier.phone, 40);
  if (carrier.vehicle_description) updates.courier_vehicle = cleanText(carrier.vehicle_description, 160);
  if (carrier.plate_number) updates.courier_plate = cleanText(carrier.plate_number, 40);

  if (status === "assigned") updates.assigned_at = now;
  if (status === "picked_up") updates.picked_up_at = now;
  if (status === "delivered") updates.delivered_at = now;
  if (status === "cancelled") updates.cancelled_at = now;

  try {
    await updateDeliveryOrder(order.id, updates);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("courier_") && !message.includes("shipday_carrier_id")) throw error;
    delete updates.shipday_carrier_id;
    delete updates.courier_name;
    delete updates.courier_phone;
    delete updates.courier_vehicle;
    delete updates.courier_plate;
    await updateDeliveryOrder(order.id, updates);
  }

  await addHistory({
    deliveryOrderId: order.id,
    status,
    source: "SHIPDAY_WEBHOOK",
    externalStatus,
    externalEvent: event,
    dedupeKey: `shipday-${shipdayOrderId || publicId}-${event}-${timestamp}`,
    metadata: payload
  });

  return { ok: true, publicId: order.public_id, status };
}
