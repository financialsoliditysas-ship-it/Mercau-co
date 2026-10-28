import type { DeliveryOrder } from "@/lib/delivery-types";

export type LogisticsCreateResult = {
  provider: "SHIPDAY";
  externalOrderId: string;
  externalStatus?: string;
  trackingUrl?: string;
  raw: unknown;
};

export interface LogisticsProvider {
  createOrder(order: DeliveryOrder): Promise<LogisticsCreateResult>;
}

function cleanPhone(phone: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("57")) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith("3")) return `+57${digits}`;
  return phone;
}

function addressWithContext(address: string, neighborhood: string | null) {
  return [address, neighborhood, "Bajo Cauca, Antioquia, Colombia"]
    .filter(Boolean)
    .join(", ");
}

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function utcTimeAfter(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString().slice(11, 19);
}

export function deliveryMapsUrl(order: Pick<DeliveryOrder, "delivery_latitude" | "delivery_longitude">) {
  if (order.delivery_latitude === null || order.delivery_longitude === null) return null;
  const destination = `${order.delivery_latitude},${order.delivery_longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

export function pickupMapsUrl(order: Pick<DeliveryOrder, "pickup_latitude" | "pickup_longitude">) {
  if (order.pickup_latitude === null || order.pickup_longitude === null) return null;
  const destination = `${order.pickup_latitude},${order.pickup_longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

export class ShipdayProvider implements LogisticsProvider {
  private readonly apiKey: string;
  private readonly apiBaseUrl: string;

  constructor() {
    this.apiKey = process.env.SHIPDAY_API_KEY || "";
    this.apiBaseUrl = process.env.SHIPDAY_API_BASE_URL || "https://api.shipday.com";

    if (!this.apiKey) {
      throw new Error("SHIPDAY_API_KEY no esta configurada.");
    }
  }

  async createOrder(order: DeliveryOrder): Promise<LogisticsCreateResult> {
    const mapsUrl = deliveryMapsUrl(order);
    const pickupUrl = pickupMapsUrl(order);
    const pickupInstruction = [
      order.pickup_instructions,
      pickupUrl ? `Ubicación exacta de recogida: ${pickupUrl}` : ""
    ].filter(Boolean).join("\n");
    const deliveryInstruction = [
      order.commerce_payment_method === "BREB_QR" && order.commerce_payment_status === "CONFIRMED"
        ? "PAGO CONFIRMADO POR MERCAU. NO COBRAR AL CLIENTE."
        : order.commerce_payment_method === "BREB_QR"
          ? "COBRAR AL ENTREGAR MEDIANTE TRANSFERENCIA BRE-B. Mostrar QR de Mercau: https://www.mercau.co/pagos/mercau-breb.jpeg. Verificar destinatario Financial Solidity S.A.S."
          : "COBRAR EN EFECTIVO AL ENTREGAR.",
      order.delivery_instructions,
      mapsUrl ? `Ubicación exacta: ${mapsUrl}` : ""
    ].filter(Boolean).join("\n");
    const response = await fetch(`${this.apiBaseUrl}/orders`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        orderNumber: order.public_id,
        customerName: order.delivery_name,
        customerAddress: addressWithContext(
          order.delivery_address,
          order.delivery_neighborhood
        ),
        customerPhoneNumber: cleanPhone(order.delivery_phone),
        restaurantName: order.pickup_name,
        restaurantAddress: addressWithContext(
          order.pickup_address,
          order.pickup_neighborhood
        ),
        restaurantPhoneNumber: cleanPhone(order.pickup_phone || order.customer_phone),
        expectedDeliveryDate: todayUtcDate(),
        expectedPickupTime: utcTimeAfter(20),
        expectedDeliveryTime: utcTimeAfter(60),
        orderItem: order.commerce_items?.map(({ name, unitPrice, quantity }) => ({ name, unitPrice, quantity })) || [
          {
            name: order.description || order.service_type,
            unitPrice: 0,
            quantity: 1,
            detail: order.notes || order.service_type
          }
        ],
        deliveryFee: order.delivery_fee,
        totalOrderCost: (order.commerce_subtotal || 0) + order.delivery_fee,
        pickupInstruction,
        deliveryInstruction,
        orderSource: "Mercau",
        additionalId: order.id,
        paymentMethod: order.commerce_payment_method === "BREB_QR" && order.commerce_payment_status === "CONFIRMED"
          ? "credit_card"
          : "cash",
        ...(order.commerce_payment_method === "BREB_QR" && order.commerce_payment_status === "CONFIRMED"
          ? { creditCardType: "OTHER", creditCardId: 0 }
          : {})
      })
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success || !result?.orderId) {
      const detail =
        result?.message ||
        result?.response ||
        response.statusText ||
        "Shipday no pudo crear la orden.";
      throw new Error(String(detail));
    }

    return {
      provider: "SHIPDAY",
      externalOrderId: String(result.orderId),
      externalStatus: "ORDER_INSERTED",
      raw: result
    };
  }
}

export function getLogisticsProvider(): LogisticsProvider {
  return new ShipdayProvider();
}
