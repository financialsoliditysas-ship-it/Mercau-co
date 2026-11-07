import { DeliveryControlError, getDeliveryOrderById, syncOrderToShipday } from '@/lib/deliveries';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

type DueFoodOrder = {
  id: string;
  public_id: string;
  restaurant_id: string;
  delivery_order_id: string | null;
  status: 'accepted' | 'ready';
  dispatch_due_at: string | null;
};

export async function processDueRestaurantDispatches(now = new Date(), limit = 50) {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.from('pilot_food_orders')
    .select('id,public_id,restaurant_id,delivery_order_id,status,dispatch_due_at')
    .eq('delivery_mode', 'MERCAU')
    .in('status', ['accepted', 'ready'])
    .not('delivery_order_id', 'is', null)
    .not('dispatch_due_at', 'is', null)
    .lte('dispatch_due_at', now.toISOString())
    .order('dispatch_due_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`No se pudieron consultar los despachos programados: ${error.message}`);
  const results: Array<Record<string, unknown>> = [];
  for (const foodOrder of (data || []) as DueFoodOrder[]) {
    if (!foodOrder.delivery_order_id) continue;
    const delivery = await getDeliveryOrderById(foodOrder.delivery_order_id);
    if (!delivery || delivery.status === 'cancelled' || delivery.shipday_order_id || delivery.dispatch_attempted_at) {
      results.push({ publicId: foodOrder.public_id, outcome: 'already_started_or_cancelled' });
      continue;
    }
    try {
      const sent = await syncOrderToShipday(delivery);
      const startedAt = new Date().toISOString();
      await db.from('pilot_food_orders').update({
        dispatch_search_started_at: startedAt,
        dispatch_search_source: 'server_scheduler'
      }).eq('id', foodOrder.id).is('dispatch_search_started_at', null);
      await db.from('delivery_orders').update({
        dispatch_search_started_at: startedAt,
        dispatch_search_source: 'server_scheduler'
      }).eq('id', delivery.id).is('dispatch_search_started_at', null);
      await db.from('pilot_food_history').insert({
        order_id: foodOrder.id,
        status: 'dispatch_search_started',
        actor_type: 'system_scheduler',
        actor_reference: 'restaurant_dispatch_scheduler',
        metadata: { source: 'server_scheduler', shipday_created: sent.shipdayCreated }
      });
      results.push({ publicId: foodOrder.public_id, outcome: sent.shipdayCreated ? 'sent' : 'provider_uncertain' });
    } catch (error) {
      const outcome = error instanceof DeliveryControlError && /conciliar|intento|proceso/i.test(error.message)
        ? 'requires_reconciliation' : 'failed_before_provider';
      await db.from('pilot_food_history').insert({
        order_id: foodOrder.id,
        status: 'dispatch_search_error',
        actor_type: 'system_scheduler',
        actor_reference: 'restaurant_dispatch_scheduler',
        metadata: { source: 'server_scheduler', outcome, message: error instanceof Error ? error.message : 'Error desconocido' }
      });
      results.push({ publicId: foodOrder.public_id, outcome });
    }
  }
  return { checkedAt: now.toISOString(), processed: results.length, results };
}
