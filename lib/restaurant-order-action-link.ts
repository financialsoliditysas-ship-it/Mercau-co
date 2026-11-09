import { createHash, randomBytes } from 'node:crypto';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendCustomerChangePush } from '@/lib/customer-push';

export class RestaurantActionError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function tokenPath(token: string) {
  return `/gestionar-pedido/${token}`;
}

export type RestaurantActionOrder = {
  link: { id: string; restaurant_id: string; order_id: string };
  order: {
    id: string;
    public_id: string;
    status: string;
    instructions: string;
    lines: unknown;
    subtotal: number;
    delivery_mode: string;
    restaurant_name: string;
    finance: unknown;
  };
};

export async function ensureRestaurantOrderActionLink(input: {
  orderId: string;
  orderPublicId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantPhone: string;
}) {
  const db = getSupabaseAdminClient();
  const existing = await db.from('restaurant_order_action_links')
    .select('id,order_id,restaurant_id').eq('order_id', input.orderId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { id: existing.data.id as string, actionPath: null as string | null, existing: true };

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  const link = await db.from('restaurant_order_action_links').insert({
    restaurant_id: input.restaurantId,
    order_id: input.orderId,
    token_hash: hashToken(token),
    expires_at: expiresAt
  }).select('id').single();
  if (link.error || !link.data) throw link.error || new Error('No se pudo crear el enlace protegido.');

  const actionPath = tokenPath(token);
  const publicBaseUrl = (process.env.MERCAU_PUBLIC_URL || 'https://www.mercau.co').replace(/\/$/, '');
  const messageBody = `Nuevo pedido ${input.orderPublicId} en Mercáu. Gestiona el pedido aquí: ${publicBaseUrl}${actionPath}`;
  const queued = await db.from('restaurant_order_messages').insert({
    order_id: input.orderId,
    link_id: link.data.id,
    recipient: input.restaurantPhone,
    action_path: actionPath,
    message_body: messageBody,
    status: 'queued',
    last_error: null
  });
  if (queued.error && queued.error.code !== '23505') throw queued.error;
  return { id: link.data.id as string, actionPath, existing: false, provider: 'not_configured' as const };
}

async function findActionOrder(token: string): Promise<RestaurantActionOrder> {
  if (!tokenPattern.test(token)) throw new RestaurantActionError('Enlace de pedido inválido.', 404);
  const db = getSupabaseAdminClient();
  const link = await db.from('restaurant_order_action_links')
    .select('id,restaurant_id,order_id,expires_at,revoked_at').eq('token_hash', hashToken(token)).maybeSingle();
  if (link.error || !link.data || link.data.revoked_at || new Date(link.data.expires_at).getTime() <= Date.now())
    throw new RestaurantActionError('Este enlace de pedido ya no está disponible.', 410);
  const order = await db.from('pilot_food_orders')
    .select('id,public_id,status,instructions,lines,subtotal,delivery_mode,restaurant_id,restaurant:pilot_restaurants(name),finance:order_financial_snapshots(product_subtotal,merchant_commission_rate_bps,merchant_commission_total,merchant_net)')
    .eq('id', link.data.order_id).eq('restaurant_id', link.data.restaurant_id).single();
  if (order.error || !order.data) throw new RestaurantActionError('Pedido no encontrado.', 404);
  const restaurant = Array.isArray(order.data.restaurant) ? order.data.restaurant[0] : order.data.restaurant;
  const finance = Array.isArray(order.data.finance) ? order.data.finance[0] : order.data.finance;
  return {
    link: { id: link.data.id, restaurant_id: link.data.restaurant_id, order_id: link.data.order_id },
    order: {
      id: order.data.id,
      public_id: order.data.public_id,
      status: order.data.status,
      instructions: order.data.instructions || '',
      lines: order.data.lines,
      subtotal: order.data.subtotal,
      delivery_mode: order.data.delivery_mode || 'MERCAU',
      restaurant_name: restaurant?.name || 'Tu negocio',
      finance: finance || null
    }
  };
}

export async function getRestaurantActionOrder(token: string) {
  const result = await findActionOrder(token);
  const lines = Array.isArray(result.order.lines) ? result.order.lines.map((line: any) => ({
    lineId: typeof line?.lineId === 'string' ? line.lineId : '',
    name: typeof line?.name === 'string' ? line.name : 'Producto',
    quantity: Number(line?.quantity || 0),
    unitPrice: Number(line?.unitPrice || 0),
    note: typeof line?.note === 'string' ? line.note : '',
    selections: Array.isArray(line?.selections) ? line.selections : []
  })) : [];
  const { pilotRestaurant } = await import('@/lib/restaurant-pilot');
  const restaurant = await pilotRestaurant(result.link.restaurant_id);
  return {
    ...result.order,
    lines,
    menu: restaurant.menu.map((product: any) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      optionGroups: product.optionGroups
    }))
  };
}

export async function proposeRestaurantOrderChangeByActionLink(token: string, body: Record<string, unknown>) {
  const result = await findActionOrder(token);
  const db = getSupabaseAdminClient();
  const target = await db.from('pilot_food_orders').select('*')
    .eq('id', result.link.order_id).eq('restaurant_id', result.link.restaurant_id).maybeSingle();
  if (target.error) throw new RestaurantActionError('No se pudo comprobar el pedido.', 503);
  if (!target.data) throw new RestaurantActionError('Pedido no disponible.', 404);

  const { prepareFoodChangeProposal } = await import('@/lib/order-changes');
  const proposal = await prepareFoodChangeProposal(target.data, body);
  const response = await db.rpc('propose_food_change_v2', {
    p_order: target.data.id,
    p_actor: null,
    p_link: result.link.id,
    p_key: proposal.requestKey,
    p_payload: {
      old_lines: target.data.lines,
      old_subtotal: target.data.subtotal,
      new_lines: proposal.lines,
      new_subtotal: proposal.subtotal
    }
  });
  if (response.error || !response.data?.id) {
    throw new RestaurantActionError('El pedido cambió, tiene una propuesta pendiente o ya no admite cambios. Actualiza para revisarlo.', 409);
  }
  if (!response.data.replayed) {
    await sendCustomerChangePush(target.data.customer_id, target.data.public_id, response.data.id).catch(() => undefined);
  }
  return { ok: true, replayed: response.data.replayed === true, message: 'Propuesta enviada al comprador para su aprobación.' };
}

export async function transitionRestaurantOrderByActionLink(token: string, action: string) {
  const result = await findActionOrder(token);
  if (!['accepted', 'rejected', 'ready'].includes(action)) throw new RestaurantActionError('Acción no disponible.', 400);
  const db = getSupabaseAdminClient();
  const transition = await db.rpc('pilot_food_transition_v6', {
    p_order: result.order.id,
    p_actor: null,
    p_action: action,
    p_actor_type: 'whatsapp_link',
    p_actor_reference: result.link.id
  });
  if (transition.error) throw new RestaurantActionError('El pedido cambió o esta acción ya no está disponible. Actualiza la pantalla.', 409);
  if (transition.data?.dispatch && transition.data.delivery_id) {
    const { getDeliveryOrderById, syncOrderToShipday } = await import('@/lib/deliveries');
    const delivery = await getDeliveryOrderById(transition.data.delivery_id);
    if (!delivery) throw new RestaurantActionError('Pedido listo. Mercáu debe revisar la recogida.', 503);
    await syncOrderToShipday(delivery);
  }
  return {
    ok: true,
    status: transition.data?.status || action,
    message: action === 'accepted' ? 'Pedido aceptado.'
      : action === 'rejected' ? 'Pedido rechazado.'
      : 'Pedido listo. Mercáu coordina la recogida.'
  };
}
