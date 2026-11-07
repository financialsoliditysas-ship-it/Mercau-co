import { NextResponse } from 'next/server';
import { processDueRestaurantDispatches } from '@/lib/restaurant-dispatch';

export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const secret = process.env.RESTAURANT_DISPATCH_SCHEDULER_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`
    || request.headers.get('x-restaurant-dispatch-secret') === secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Scheduler no autorizado o no configurado.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    return NextResponse.json(await processDueRestaurantDispatches(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo procesar el scheduler.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' }
    });
  }
}
