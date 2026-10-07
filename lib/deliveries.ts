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
    deliveryName: cleanText(body.deliveryName, 160),
    deliveryAddress: cleanText(body.deliveryAddress, 240),
    deliveryNeighborhood: cleanText(body.deliveryNeighborhood, 120),
    deliveryPhone: cleanText(body.deliveryPhone, 40),
    deliveryInstructions: cleanText(body.deliveryInstructions, 500),
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

export async function createDeliveryOrder(rawBody: Record<string, unknown>) {
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
    delivery_name: input.deliveryName,
    delivery_address: input.deliveryAddress,
    delivery_neighborhood: input.deliveryNeighborhood,
    delivery_phone: input.deliveryPhone,
    delivery_instructions: input.deliveryInstructions,
    description: input.description,
    notes: input.notes,
    delivery_fee: getDeliveryFeeCop(),
    status: "created",
    source: input.source
  };

  const { data, error } = await supabase
    .from("delivery_orders")
    .insert(insertPayload)
    .select("*")
    .single();

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

export async function syncOrderToShipday(order: DeliveryOrder) {
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
  const expectedToken = process.env.SHIPDAY_WEBHOOK_TOKEN || "";
  if (expectedToken && token !== expectedToken) {
    throw new Error("Webhook no autorizado.");
  }

  const shipdayOrder = (payload.order || {}) as Record<string, unknown>;
  const shipdayOrderId = cleanText(shipdayOrder.id, 80);
  const publicId = cleanText(shipdayOrder.order_number, 80);
  const event = cleanText(payload.event, 80);
  const externalStatus = cleanText(payload.order_status, 80);
  const timestamp = cleanText(payload.timestamp, 80);
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

  if (status === "assigned") updates.assigned_at = now;
  if (status === "picked_up") updates.picked_up_at = now;
  if (status === "delivered") updates.delivered_at = now;
  if (status === "cancelled") updates.cancelled_at = now;

  await updateDeliveryOrder(order.id, updates);

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
