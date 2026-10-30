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
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  pickupLocationAccuracyM: number | null;
  pickupLocationCapturedAt: string | null;
  deliveryName: string;
  deliveryAddress: string;
  deliveryNeighborhood: string;
  deliveryPhone: string;
  deliveryInstructions: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  deliveryLocationAccuracyM: number | null;
  deliveryLocationCapturedAt: string | null;
  description: string;
  notes: string;
  source?: string;
};

export type DeliveryOrder = {
  commerce_items?: { name: string; unitPrice: number; quantity: number }[] | null;
  commerce_subtotal?: number | null;
  commerce_payment_method?: 'CASH' | 'BREB_QR' | null;
  commerce_payment_status?: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED' | null;
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
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  pickup_location_accuracy_m: number | null;
  pickup_location_captured_at: string | null;
  delivery_name: string;
  delivery_address: string;
  delivery_neighborhood: string | null;
  delivery_phone: string;
  delivery_instructions: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_location_accuracy_m: number | null;
  delivery_location_captured_at: string | null;
  description: string;
  notes: string | null;
  delivery_fee: number;
  status: DeliveryStatus;
  source: DeliverySource;
  shipday_order_id: string | null;
  shipday_status: string | null;
  shipday_tracking_url: string | null;
  shipday_last_error: string | null;
  dispatch_attempted_at?: string | null;
  shipday_event_at?: string | null;
  shipday_carrier_id?: string | null;
  courier_name?: string | null;
  courier_phone?: string | null;
  courier_vehicle?: string | null;
  courier_plate?: string | null;
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
