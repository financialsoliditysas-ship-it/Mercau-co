import type { DeliveryOrder } from './delivery-types';

type ProviderOrder = Record<string, unknown>;
function phone(value: unknown) { return String(value || '').replace(/\D/g, '').replace(/^57(?=\d{10}$)/, ''); }
function text(value: unknown) { return String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase(); }
function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export type ReconciliationResult = {
  outcome: 'matched' | 'not_found' | 'multiple' | 'mismatch';
  providerId?: string;
  checkedAt: string;
  count: number;
};

// Pure matching: never trust the order number alone or return provider personal data to the UI.
export function matchShipdayOrder(order: DeliveryOrder, payload: unknown): ReconciliationResult {
  if (!Array.isArray(payload)) throw new Error('Respuesta de consulta Shipday no reconocida. El despacho sigue bloqueado.');
  const matches = (payload as ProviderOrder[]).filter(row => String(row?.orderNumber) === order.public_id);
  const result = { checkedAt: new Date().toISOString(), count: matches.length };
  if (!matches.length) return { ...result, outcome: 'not_found' };
  if (matches.length !== 1) return { ...result, outcome: 'multiple' };
  const row = matches[0], customer = object(row.customer), restaurant = object(row.restaurant), costing = object(row.costing);
  const expectedItems = order.commerce_items?.length ? order.commerce_items : [{ name: order.description || order.service_type, quantity: 1, unitPrice: 0 }];
  const itemsKey = (items: unknown) => Array.isArray(items) ? JSON.stringify(items.map(item => {
    const record = object(item);
    return [text(record.name), Number(record.quantity), Number(record.unitPrice)];
  }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))) : null;
  const id = String(row.orderId || '');
  const identityMatches = /^\d+$/.test(id)
    && text(customer.name) === text(order.delivery_name)
    && Boolean(phone(order.delivery_phone)) && phone(customer.phoneNumber) === phone(order.delivery_phone)
    && Boolean(phone(order.pickup_phone)) && phone(restaurant.phoneNumber) === phone(order.pickup_phone)
    && text(customer.address) === text([order.delivery_address, order.delivery_neighborhood, 'Bajo Cauca, Antioquia, Colombia'].filter(Boolean).join(', '))
    && text(restaurant.address) === text([order.pickup_address, order.pickup_neighborhood, 'Bajo Cauca, Antioquia, Colombia'].filter(Boolean).join(', '))
    && costing.deliveryFee !== null && costing.deliveryFee !== undefined && Number(costing.deliveryFee) === Number(order.delivery_fee)
    && itemsKey(row.orderItems) === itemsKey(expectedItems);
  if (!identityMatches || (order.shipday_order_id && order.shipday_order_id !== id)) return { ...result, outcome: 'mismatch' };
  return { ...result, outcome: 'matched', providerId: id };
}

export async function queryShipdayOrder(order: DeliveryOrder): Promise<ReconciliationResult> {
  const key = process.env.SHIPDAY_API_KEY;
  if (!key) throw new Error('Shipday no está configurado. El despacho sigue bloqueado.');
  const base = process.env.SHIPDAY_API_BASE_URL || 'https://api.shipday.com';
  // Documented lookup by customer-platform order number, not the active-orders listing.
  const response = await fetch(`${base}/orders/${encodeURIComponent(order.public_id)}`, {
    method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json', Authorization: `Basic ${key}` }
  });
  if (!response.ok) throw new Error('No se pudo consultar Shipday. El despacho sigue bloqueado.');
  return matchShipdayOrder(order, await response.json());
}
