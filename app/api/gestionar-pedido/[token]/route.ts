import { NextResponse } from 'next/server';
import { getRestaurantActionOrder, RestaurantActionError, transitionRestaurantOrderByActionLink } from '@/lib/restaurant-order-action-link';

export const dynamic = 'force-dynamic';

type Context = { params: { token: string } };

function failure(error: unknown) {
  const status = error instanceof RestaurantActionError
    ? error.status : 503;
  const message = error instanceof Error ? error.message : 'No se pudo cargar el pedido.';
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const order = await getRestaurantActionOrder(params.token);
    return NextResponse.json({ order }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const raw = await request.text();
    if (raw.length > 1000) return NextResponse.json({ error: 'Solicitud demasiado extensa.' }, { status: 413 });
    let body: { action?: unknown };
    try { body = JSON.parse(raw) as { action?: unknown }; } catch { return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 }); }
    if (typeof body.action !== 'string') return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
    return NextResponse.json(await transitionRestaurantOrderByActionLink(params.token, body.action), {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    return failure(error);
  }
}
