import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { messageStatuses, validMetaSignature, validMetaVerificationToken, whatsappDeliveryEvents } from '@/lib/whatsapp-webhook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const challenge = url.searchParams.get('hub.challenge');
  const token = url.searchParams.get('hub.verify_token');

  if (!process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse('Webhook not configured', { status: 503 });
  }
  if (mode !== 'subscribe' || !challenge || !validMetaVerificationToken(token)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!validMetaSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Bad request', { status: 400 });
  }

  const db = getSupabaseAdminClient();
  const deliveryEvents = whatsappDeliveryEvents(payload);
  if (deliveryEvents.length) {
    const { error } = await db
      .from('whatsapp_message_delivery_events')
      .upsert(deliveryEvents, { onConflict: 'message_id,status,occurred_at', ignoreDuplicates: true });
    if (error) return new NextResponse('Storage unavailable', { status: 503 });
  }

  const events = messageStatuses(payload);
  if (events.length > 0) {
    for (const event of events) {
      const update = event.status === 'failed'
        ? { status: 'failed', last_error: event.error || 'Meta informó que el mensaje falló.' }
        : ['sent', 'delivered', 'read'].includes(event.status)
          ? { status: 'sent', last_error: null }
          : null;
      if (!update) continue;
      const result = await db.from('restaurant_order_messages')
        .update(update)
        .eq('provider_message_id', event.id);
      if (result.error) {
        return new NextResponse('Webhook persistence failed', { status: 503 });
      }
    }
  }

  return NextResponse.json(
    { received: true },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
