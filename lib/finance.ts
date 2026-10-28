import { getSupabaseAdminClient } from './supabase-admin';

export const FINANCE_POLICY = {
  merchantCommissionBps: 1500,
  mercauDeliveryShareBps: 500,
  courierLogisticsShareBps: 7000,
  vatRateBps: 1900
} as const;

function portion(amount: number, basisPoints: number) {
  return Math.round((amount * basisPoints) / 10_000);
}

export function calculateOrderAllocation(productSubtotal: number, deliveryFee: number, policy:{merchantCommissionBps?:number;customerMarkupBps?:number;deliveryMode?:'MERCAU'|'OWN'}={}) {
  if (!Number.isInteger(productSubtotal) || productSubtotal < 0 || !Number.isInteger(deliveryFee) || deliveryFee < 0) {
    throw new Error('Los valores financieros deben ser enteros no negativos.');
  }

  const commissionBps=policy.merchantCommissionBps??FINANCE_POLICY.merchantCommissionBps;
  const customerMarkupBps=policy.customerMarkupBps??0;
  const deliveryMode=policy.deliveryMode??'MERCAU';
  if(!Number.isInteger(commissionBps)||commissionBps<0||commissionBps>10000||!Number.isInteger(customerMarkupBps)||customerMarkupBps<0||customerMarkupBps>commissionBps||!['MERCAU','OWN'].includes(deliveryMode))throw new Error('La política financiera no es válida.');
  // The catalog price is the real order subtotal. The commercial markup is only
  // guidance for the merchant when choosing that published price.
  const productBaseSubtotal=productSubtotal;
  const customerMarkupTotal=0;
  const merchantCommissionTotal = portion(productSubtotal, commissionBps);
  const merchantCommissionBase = Math.round((merchantCommissionTotal * 10_000) / (10_000 + FINANCE_POLICY.vatRateBps));
  const merchantCommissionShare=merchantCommissionTotal;
  const mercauDeliveryShare = deliveryMode==='OWN'?0:portion(deliveryFee, FINANCE_POLICY.mercauDeliveryShareBps);
  const logisticsPool = deliveryMode==='OWN'?0:deliveryFee - mercauDeliveryShare;
  const courierShare = portion(logisticsPool, FINANCE_POLICY.courierLogisticsShareBps);

  return {
    productSubtotal,
    productBaseSubtotal,
    customerMarkupTotal,
    deliveryFee,
    customerTotal: productSubtotal + deliveryFee,
    merchantCommissionTotal,
    merchantCommissionShare,
    merchantCommissionBase,
    merchantCommissionVat: merchantCommissionTotal - merchantCommissionBase,
    merchantNet: productSubtotal - merchantCommissionTotal,
    merchantDeliveryShare:deliveryMode==='OWN'?deliveryFee:0,
    deliveryMode,
    mercauDeliveryShare,
    logisticsPool,
    courierShare,
    vegaShare: logisticsPool - courierShare
  };
}

export async function getFinanceDashboard() {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.from('order_financial_snapshots')
    .select('id,food_order_id,order_public_id,restaurant_id,currency,product_subtotal,product_base_subtotal,customer_markup_total,delivery_fee,customer_total,merchant_commission_rate_bps,merchant_commission_total,merchant_commission_share,merchant_commission_vat,merchant_net,delivery_mode,merchant_delivery_share,mercau_delivery_share,courier_share,vega_share,payment_method,payment_status,settlement_status,created_at')
    .order('created_at', { ascending: false }).limit(200);
  if (error) throw new Error('No se pudo cargar el libro financiero.');

  const snapshots = data || [];
  const foodIds = snapshots.map(order => order.food_order_id).filter(Boolean);
  const foodResult = foodIds.length ? await db.from('pilot_food_orders')
    .select('id,customer_name,customer_phone,address,neighborhood,status,lines,delivery_order_id,restaurant_id,payment_reference,payment_reported_at')
    .in('id', foodIds) : { data: [], error: null };
  if (foodResult.error) throw new Error('No se pudieron cargar los clientes de los pedidos.');
  const foodOrders = new Map((foodResult.data || []).map(order => [order.id, order]));
  const restaurantIds = [...new Set(snapshots.map(order => order.restaurant_id).filter(Boolean))];
  const restaurantResult = restaurantIds.length ? await db.from('pilot_restaurants').select('id,name').in('id', restaurantIds) : { data: [], error: null };
  const restaurants = new Map((restaurantResult.data || []).map(restaurant => [restaurant.id, restaurant.name]));
  const deliveryIds = (foodResult.data || []).map(order => order.delivery_order_id).filter(Boolean);
  const deliveryResult = deliveryIds.length ? await db.from('delivery_orders')
    .select('id,public_id,status,shipday_order_id,shipday_status,shipday_tracking_url,assigned_at,picked_up_at,delivered_at')
    .in('id', deliveryIds) : { data: [], error: null };
  const deliveries = new Map((deliveryResult.data || []).map(delivery => [delivery.id, delivery]));
  const historyResult = deliveryIds.length ? await db.from('delivery_status_history')
    .select('delivery_order_id,metadata,created_at').in('delivery_order_id', deliveryIds)
    .order('created_at', { ascending: false }) : { data: [], error: null };
  const carriers = new Map<string, { id: string; name: string; phone: string; vehicle: string; plate: string }>();
  for (const event of historyResult.data || []) {
    if (carriers.has(event.delivery_order_id)) continue;
    const metadata = (event.metadata || {}) as Record<string, unknown>;
    const carrier = (metadata.carrier || {}) as Record<string, unknown>;
    if (carrier.name || carrier.id) carriers.set(event.delivery_order_id, {
      id: String(carrier.id || ''), name: String(carrier.name || ''), phone: String(carrier.phone || ''),
      vehicle: String(carrier.vehicle_description || ''), plate: String(carrier.plate_number || '')
    });
  }
  const orders = snapshots.map(snapshot => {
    const food = foodOrders.get(snapshot.food_order_id);
    return { ...snapshot, restaurant_name: restaurants.get(snapshot.restaurant_id) || snapshot.restaurant_id,
      customer_name: food?.customer_name || 'No disponible', customer_phone: food?.customer_phone || '',
      payment_reference: food?.payment_reference || null, payment_reported_at: food?.payment_reported_at || null,
      delivery_address: food ? `${food.address}${food.neighborhood ? `, ${food.neighborhood}` : ''}` : '',
      food_status: food?.status || null, lines: food?.lines || [], delivery: food?.delivery_order_id ? deliveries.get(food.delivery_order_id) || null : null,
      courier: food?.delivery_order_id ? carriers.get(food.delivery_order_id) || null : null };
  });
  const totals = orders.reduce((sum, order) => ({
    customerTotal: sum.customerTotal + Number(order.customer_total || 0),
    merchantNet: sum.merchantNet + Number(order.merchant_net || 0)+Number(order.merchant_delivery_share||0),
    mercauGross: sum.mercauGross + Number(order.merchant_commission_total || 0) + Number(order.mercau_delivery_share || 0),
    commissionVat: sum.commissionVat + Number(order.merchant_commission_vat || 0),
    courierShare: sum.courierShare + Number(order.courier_share || 0),
    vegaShare: sum.vegaShare + Number(order.vega_share || 0)
  }), { customerTotal: 0, merchantNet: 0, mercauGross: 0, commissionVat: 0, courierShare: 0, vegaShare: 0 });

  return { orders, totals };
}

export async function confirmOrderPayment(snapshotId: string, reference: string) {
  if (!/^[a-f0-9-]{36}$/i.test(snapshotId)) throw new Error('Registro financiero inválido.');
  const cleanReference = String(reference || '').trim().slice(0, 100);
  if (cleanReference.length < 4) throw new Error('Escribe una referencia verificable del movimiento bancario.');
  const db = getSupabaseAdminClient();
  const snapshot = await db.from('order_financial_snapshots').select('payment_method,payment_status').eq('id', snapshotId).single();
  if (snapshot.error) throw new Error('No se encontró el registro financiero.');
  if (snapshot.data.payment_method !== 'BREB_QR') throw new Error('Este pedido no fue marcado para pago Bre-B.');
  const eventKey = `breb-confirm-${snapshotId}`;
  const { data, error } = await db.rpc('financial_record_payment', { p_snapshot: snapshotId, p_event_key: eventKey,
    p_method: 'BREB_QR', p_external_reference: cleanReference, p_actor_type: 'ADMIN', p_actor_reference: 'MERCAU_ADMIN' });
  if (error) throw new Error(error.message || 'No se pudo confirmar el pago.');
  return data;
}
