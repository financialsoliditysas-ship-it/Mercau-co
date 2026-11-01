import { getSupabaseAdminClient } from './supabase-admin';

const ACTIVE_DELIVERY_STATES = ['created', 'sent_to_shipday', 'assigned', 'picked_up', 'in_transit'];

function colombiaDay(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

export async function getOperationsDashboard() {
  const db = getSupabaseAdminClient();
  const dayStart = new Date(`${colombiaDay()}T00:00:00-05:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const [deliveriesResult, foodResult, financeResult, settledResult, todayFoodResult] = await Promise.all([
    db.from('delivery_orders').select('id,public_id,customer_name,pickup_name,delivery_address,status,shipday_status,shipday_order_id,shipday_last_error,shipday_carrier_id,courier_name,courier_phone,delivery_fee,created_at,updated_at,assigned_at,picked_up_at,delivered_at').order('created_at', { ascending: false }).limit(200),
    db.from('pilot_food_orders').select('id,public_id,restaurant_id,customer_name,status,subtotal,delivery_fee,delivery_order_id,created_at').order('created_at', { ascending: false }).limit(200),
    db.from('order_financial_snapshots').select('id,restaurant_id,delivery_order_id,merchant_net,merchant_delivery_share,courier_share,vega_share,payment_status,settlement_status,created_at').eq('payment_status', 'CONFIRMED').neq('settlement_status', 'SETTLED').limit(500),
    db.from('financial_settlement_items').select('snapshot_id,component,settlement:financial_settlements!inner(status)').eq('settlement.status', 'CONFIRMED'),
    db.from('pilot_food_orders').select('id', { count: 'exact', head: true }).gte('created_at', dayStart.toISOString()).lt('created_at', dayEnd.toISOString())
  ]);
  if (deliveriesResult.error || foodResult.error || financeResult.error || settledResult.error || todayFoodResult.error) throw new Error('No se pudo consolidar la operación diaria.');

  const deliveries = deliveriesResult.data || [];
  const foodOrders = foodResult.data || [];
  const snapshots = financeResult.data || [];
  const settled = new Set((settledResult.data || []).map(row => `${row.snapshot_id}:${row.component}`));
  const restaurantIds = [...new Set([...foodOrders.map(order => order.restaurant_id), ...snapshots.map(row => row.restaurant_id)].filter(Boolean))];
  const restaurantsResult = restaurantIds.length ? await db.from('pilot_restaurants').select('id,name,is_live').in('id', restaurantIds) : { data: [], error: null };
  if (restaurantsResult.error) throw new Error('No se pudieron identificar los negocios de los pedidos.');
  const restaurantNames = new Map((restaurantsResult.data || []).map(row => [row.id, row.name]));
  const liveRestaurants = new Set((restaurantsResult.data || []).filter(row => row.is_live).map(row => row.id));
  const deliveriesById = new Map(deliveries.map(order => [order.id, order]));
  const now = Date.now();

  const issues = [
    ...deliveries.filter(order => order.status === 'integration_error' || order.status === 'failed').map(order => ({
      key: `delivery-${order.id}`, severity: 'critical', type: 'SHIPDAY', public_id: order.public_id,
      title: order.status === 'integration_error' ? 'Error al enviar a Shipday' : 'Entrega no completada',
      detail: order.shipday_last_error || order.shipday_status || 'Requiere revisión manual.', href: '/admin/envios'
    })),
    ...deliveries.filter(order => ACTIVE_DELIVERY_STATES.includes(order.status) && now - new Date(order.updated_at).getTime() > 30 * 60 * 1000).map(order => ({
      key: `stalled-${order.id}`, severity: 'warning', type: 'DEMORA', public_id: order.public_id,
      title: 'Envío sin cambios durante más de 30 minutos', detail: `${order.pickup_name} · ${order.status}`, href: '/admin/envios'
    })),
    ...foodOrders.filter(order => order.status === 'pending' && now - new Date(order.created_at).getTime() > 10 * 60 * 1000).map(order => ({
      key: `food-${order.id}`, severity: 'warning', type: 'NEGOCIO', public_id: order.public_id,
      title: 'Pedido sin respuesta del negocio', detail: restaurantNames.get(order.restaurant_id) || order.restaurant_id, href: '/admin/operaciones'
    }))
  ];

  const today = colombiaDay();
  const active = deliveries.filter(order => ACTIVE_DELIVERY_STATES.includes(order.status));
  const completedToday = deliveries.filter(order => order.delivered_at && colombiaDay(new Date(order.delivered_at)) === today);
  const pendingRestaurant = foodOrders.filter(order => order.status === 'pending');

  const merchantBalances = new Map<string, { reference: string; name: string; amount: number; orders: number; items: string[] }>();
  const courierBalances = new Map<string, { reference: string; name: string; amount: number; orders: number; items: string[] }>();
  let vegaBalance = 0;
  const vegaItems: string[] = [];
  for (const row of snapshots) {
    if (!settled.has(`${row.id}:MERCHANT_NET`)) {
      const merchant = merchantBalances.get(row.restaurant_id) || { reference: row.restaurant_id, name: restaurantNames.get(row.restaurant_id) || row.restaurant_id, amount: 0, orders: 0, items: [] as string[] };
      merchant.amount += Number(row.merchant_net || 0)+Number(row.merchant_delivery_share||0); merchant.orders += 1; merchant.items.push(row.id); merchantBalances.set(row.restaurant_id, merchant);
    }
    const delivery = row.delivery_order_id ? deliveriesById.get(row.delivery_order_id) : null;
    const courierReference = delivery?.shipday_carrier_id || delivery?.courier_name || 'SIN_MENSAJERO';
    if (Number(row.courier_share||0)>0&&!settled.has(`${row.id}:COURIER_SHARE`)) {
      const courier = courierBalances.get(courierReference) || { reference: courierReference, name: delivery?.courier_name || 'Mensajero no identificado', amount: 0, orders: 0, items: [] as string[] };
      courier.amount += Number(row.courier_share || 0); courier.orders += 1; courier.items.push(row.id); courierBalances.set(courierReference, courier);
    }
    if (Number(row.vega_share||0)>0&&!settled.has(`${row.id}:VEGA_SHARE`)) { vegaBalance += Number(row.vega_share || 0); vegaItems.push(row.id); }
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: { ordersToday: todayFoodResult.count || 0, pendingRestaurant: pendingRestaurant.length, activeDeliveries: active.length, completedToday: completedToday.length, issues: issues.length },
    orders: foodOrders.map(order => ({ public_id: order.public_id, customer_name: order.customer_name,
      business_name: restaurantNames.get(order.restaurant_id) || 'Negocio sin identificar',
      is_test: !liveRestaurants.has(order.restaurant_id), status: order.status,
      delivery_status: order.delivery_order_id ? deliveriesById.get(order.delivery_order_id)?.status || null : null,
      subtotal: order.subtotal, delivery_fee: order.delivery_fee, created_at: order.created_at })),
    issues: issues.slice(0, 50),
    active: active.slice(0, 50),
    balances: { merchants: [...merchantBalances.values()].sort((a, b) => b.amount - a.amount), couriers: [...courierBalances.values()].sort((a, b) => b.amount - a.amount), vega: { reference: 'VEGA_EXPRESS', name: 'Vega Express', amount: vegaBalance, orders: vegaItems.length, items: vegaItems } }
  };
}

export async function recordSettlementBatch(input: { component: string; payeeReference: string; method: string; externalReference: string; snapshotIds: string[] }) {
  const allowed = ['MERCHANT_NET', 'COURIER_SHARE', 'VEGA_SHARE'];
  if (!allowed.includes(input.component)) throw new Error('Componente inválido.');
  if (!['CASH', 'BREB_QR', 'BANK_TRANSFER', 'INTERNAL'].includes(input.method)) throw new Error('Método inválido.');
  const reference = String(input.externalReference || '').trim().slice(0, 100);
  if (reference.length < 4) throw new Error('Escribe una referencia verificable.');
  const snapshots = [...new Set(input.snapshotIds)].filter(id => /^[a-f0-9-]{36}$/i.test(id));
  if (!snapshots.length || snapshots.length > 100) throw new Error('No hay pedidos válidos para liquidar.');
  const db = getSupabaseAdminClient();
  const results = [];
  for (const snapshotId of snapshots) {
    const key = `settle-${input.component}-${snapshotId}-${reference}`.slice(0, 240);
    const { data, error } = await db.rpc('financial_record_settlement', { p_snapshot: snapshotId, p_component: input.component,
      p_payee_reference: input.payeeReference, p_method: input.method, p_external_reference: reference, p_idempotency_key: key });
    if (error) throw new Error(error.message || 'No se pudo registrar la liquidación.');
    results.push(data);
  }
  return results;
}
