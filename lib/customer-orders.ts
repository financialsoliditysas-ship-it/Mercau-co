import { getSupabaseAdminClient } from './supabase-admin';
import type { CustomerOrder } from './customer-order-status';

export async function listCustomerOrders(userId: string): Promise<CustomerOrder[]> {
  const { data, error } = await getSupabaseAdminClient().from('pilot_food_orders')
    .select('public_id,status,created_at,address,lines,subtotal,delivery_fee,delivery_mode,restaurant:pilot_restaurants(name,directory_business_id),delivery:delivery_orders(status)')
    .eq('customer_id', userId).order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error('No se pudieron consultar tus pedidos.');
  return (data || []).map(order => {
    // Supabase relation shapes can be objects or arrays depending on generated types.
    const restaurant = Array.isArray(order.restaurant) ? order.restaurant[0] : order.restaurant;
    const delivery = Array.isArray(order.delivery) ? order.delivery[0] : order.delivery;
    return { public_id: order.public_id, status: order.status, created_at: order.created_at,
      address: order.address, lines: order.lines, subtotal: order.subtotal, delivery_fee: order.delivery_fee, delivery_mode: order.delivery_mode,
      restaurant_name: restaurant?.name, business_id: restaurant?.directory_business_id,
      delivery: delivery ? { status: delivery.status } : null };
  });
}
