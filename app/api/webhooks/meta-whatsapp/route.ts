import { NextResponse } from 'next/server';
import { validMetaSignature, validMetaVerificationToken, whatsappDeliveryEvents } from '@/lib/whatsapp-webhook';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

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

  try {
    const events = whatsappDeliveryEvents(JSON.parse(rawBody));
    if (events.length) {
      const { error } = await getSupabaseAdminClient()
        .from('whatsapp_message_delivery_events')
        .upsert(events, { onConflict: 'message_id,status,occurred_at', ignoreDuplicates: true });
      if (error) return new NextResponse('Storage unavailable', { status: 503 });
    }
  } catch {
    return new NextResponse('Bad request', { status: 400 });
  }

  return NextResponse.json(
    { received: true },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
