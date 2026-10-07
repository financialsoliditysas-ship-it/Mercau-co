export const serviceTypes = [
  "Recoger una compra",
  "Enviar un paquete",
  "Enviar un documento",
  "Diligencia",
  "Otro"
] as const;

export const deliverySources = ["WEB", "WHATSAPP", "ADMIN"] as const;

export const deliveryStatuses = [
  "created",
  "sent_to_shipday",
  "integration_error",
  "assigned",
  "picked_up",
  "in_transit",
  "delivered",
  "failed",
  "cancelled"
] as const;

export type ServiceType = (typeof serviceTypes)[number];
export type DeliverySource = (typeof deliverySources)[number];
export type DeliveryStatus = (typeof deliveryStatuses)[number];

export type DeliveryOrderInput = {
  serviceType: string;
  customerName: string;
  customerPhone: string;
  pickupName: string;
  pickupAddress: string;
  pickupNeighborhood: string;
  pickupContact: string;
  pickupPhone: string;
  pickupInstructions: string;
  deliveryName: string;
  deliveryAddress: string;
  deliveryNeighborhood: string;
  deliveryPhone: string;
  deliveryInstructions: string;
  description: string;
  notes: string;
  source?: string;
};

export type DeliveryOrder = {
  id: string;
  public_id: string;
  service_type: string;
  customer_name: string;
  customer_phone: string;
  pickup_name: string;
  pickup_address: string;
  pickup_neighborhood: string | null;
  pickup_contact: string | null;
  pickup_phone: string;
  pickup_instructions: string | null;
  delivery_name: string;
  delivery_address: string;
  delivery_neighborhood: string | null;
  delivery_phone: string;
  delivery_instructions: string | null;
  description: string;
  notes: string | null;
  delivery_fee: number;
  status: DeliveryStatus;
  source: DeliverySource;
  shipday_order_id: string | null;
  shipday_status: string | null;
  shipday_tracking_url: string | null;
  shipday_last_error: string | null;
  created_at: string;
  updated_at: string;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
};

export type DeliveryStatusHistory = {
  id: string;
  delivery_order_id: string;
  status: DeliveryStatus;
  source: string;
  external_status: string | null;
  external_event: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
