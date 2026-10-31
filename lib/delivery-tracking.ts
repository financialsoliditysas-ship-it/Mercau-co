import { AccountError } from './account-server';
import { getSupabaseAdminClient } from './supabase-admin';
import { deliveryLabels } from './account-model';
export async function authorizedDeliveryTracking(userId: string, publicId: string) {
  if (!/^(?:MCU-\d{6,}|MCU-1-\d{6})$/.test(publicId)) throw new AccountError('Seguimiento no disponible.', 404);
  const db = getSupabaseAdminClient();
  const result = await db.from('delivery_orders')
    .select('id,public_id,customer_user_id,status,created_at,updated_at')
    .eq('public_id', publicId).maybeSingle();
  if (result.error) throw new AccountError('No pudimos consultar el seguimiento.', 503);
  const order = result.data;
  if (!order) throw new AccountError('Seguimiento no disponible.', 404);
  if (order.customer_user_id !== userId) {
    const food = await db.from('pilot_food_orders').select('id')
      .eq('delivery_order_id', order.id).eq('customer_id', userId).maybeSingle();
    if (food.error) throw new AccountError('No pudimos comprobar el acceso.', 503);
    if (!food.data) throw new AccountError('Seguimiento no disponible.', 404);
  }
  // Exclude contacts, coordinates, provider URLs and raw webhook metadata.
  return { publicId: order.public_id, status: order.status,
    label: deliveryLabels[order.status] || 'Estado en revisión',
    createdAt: order.created_at, updatedAt: order.updated_at };
}
