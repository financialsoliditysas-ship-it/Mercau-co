import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getWhatsAppCloudConfig, sendRestaurantOrderTemplate, WhatsAppCloudError } from '@/lib/whatsapp-cloud';

type PendingMessage = {
  id: string;
  order_id: string;
  recipient: string;
  action_path: string;
  attempts: number;
  status: string;
};

function actionToken(path: string) {
  const match = path.match(/^\/gestionar-pedido\/([A-Za-z0-9_-]{43})$/);
  if (!match) throw new WhatsAppCloudError('El enlace protegido del pedido no es válido.');
  return match[1];
}

export async function processRestaurantOrderMessages(limit = 20) {
  if (!getWhatsAppCloudConfig()) return { configured: false, processed: 0, results: [] as Array<Record<string, unknown>> };
  const db = getSupabaseAdminClient();
  await db.from('restaurant_order_messages').update({ status: 'queued', last_error: null })
    .eq('status', 'blocked_provider');
  const pending = await db.from('restaurant_order_messages')
    .select('id,order_id,recipient,action_path,attempts,status')
    .eq('status', 'queued').lt('attempts', 3).order('created_at').limit(limit);
  if (pending.error) throw new Error(`No se pudo consultar la cola de WhatsApp: ${pending.error.message}`);
  const results: Array<Record<string, unknown>> = [];
  for (const candidate of (pending.data || []) as PendingMessage[]) {
    const claimed = await db.from('restaurant_order_messages').update({
      status: 'processing', claimed_at: new Date().toISOString(), attempts: candidate.attempts + 1, last_error: null
    }).eq('id', candidate.id).eq('status', candidate.status).select('id').maybeSingle();
    if (claimed.error || !claimed.data) continue;
    try {
      const order = await db.from('pilot_food_orders')
        .select('public_id,restaurant:pilot_restaurants(name)').eq('id', candidate.order_id).single();
      if (order.error || !order.data) throw new WhatsAppCloudError('No se encontró el pedido para construir el mensaje.');
      const restaurant = Array.isArray(order.data.restaurant) ? order.data.restaurant[0] : order.data.restaurant;
      const sent = await sendRestaurantOrderTemplate({
        recipient: candidate.recipient,
        publicId: order.data.public_id,
        restaurantName: restaurant?.name || 'Tu negocio',
        actionToken: actionToken(candidate.action_path)
      });
      await db.from('restaurant_order_messages').update({
        status: 'sent', provider_message_id: sent.messageId, sent_at: new Date().toISOString(), last_error: null
      }).eq('id', candidate.id).eq('status', 'processing');
      results.push({ id: candidate.id, outcome: 'sent' });
    } catch (error) {
      const outcome = error instanceof WhatsAppCloudError ? error.outcome : 'failed';
      await db.from('restaurant_order_messages').update({
        status: outcome, last_error: error instanceof Error ? error.message.slice(0, 500) : 'Error desconocido'
      }).eq('id', candidate.id).eq('status', 'processing');
      results.push({ id: candidate.id, outcome });
    }
  }
  return { configured: true, processed: results.length, results };
}
