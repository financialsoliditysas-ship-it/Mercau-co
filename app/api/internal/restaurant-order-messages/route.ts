import { NextResponse } from 'next/server';
import { processRestaurantOrderMessages } from '@/lib/restaurant-order-messages';

export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const secret = process.env.RESTAURANT_MESSAGE_WORKER_SECRET;
  return Boolean(secret && (request.headers.get('authorization') === `Bearer ${secret}`
    || request.headers.get('x-restaurant-message-secret') === secret));
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Procesador no autorizado o no configurado.' }, { status: 401 });
  try {
    return NextResponse.json(await processRestaurantOrderMessages(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo procesar la cola.' }, { status: 503 });
  }
}
