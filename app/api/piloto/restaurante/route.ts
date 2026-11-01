import { NextResponse } from 'next/server';
import { createPilotOrder, listPilotOrders, lookupPilotOrderIntent, pilotId, pilotRestaurant, pilotUser, PilotError, reportPilotPayment, transitionPilotOrder } from '@/lib/restaurant-pilot';

export const dynamic = 'force-dynamic';
function restaurantId(request: Request) {
  return new URL(request.url).searchParams.get('restaurant') || pilotId;
}
async function userFor(request: Request) {
  const user = await pilotUser(request);
  if (restaurantId(request) !== pilotId && !user.email_confirmed_at)
    throw new PilotError('Confirma tu correo antes de hacer pedidos.', 403);
  return user;
}
function failure(error: unknown) {
  const known = error instanceof PilotError;
  return NextResponse.json({ error: known ? error.message : 'No se pudo procesar la solicitud.',
    ...(known && error.previousPublicId ? {previousPublicId:error.previousPublicId,canRepeat:error.canRepeat} : {}) },
    { status: known ? error.status : 503, headers: { 'Cache-Control': 'no-store' } });
}
export async function GET(request: Request) {
  try {
    const mode = new URL(request.url).searchParams.get('mode');
    if (mode === 'menu' || mode === 'availability') {
      const r = await pilotRestaurant(restaurantId(request),mode==='menu');
      if(mode==='availability')return NextResponse.json({enabled:r.enabled&&r.schedule_open!==false,availabilityMessage:r.availability_message || ''},{headers:{'Cache-Control':'no-store'}});
      return NextResponse.json({ name: r.name, menu: r.menu, fee: r.delivery_fee, enabled: r.enabled&&r.schedule_open!==false, availabilityMessage:r.availability_message || '', live: r.is_live === true,
        deliveryMode: r.delivery_mode || 'MERCAU' },
        { headers: { 'Cache-Control': 'no-store' } });
    }
    const user = await userFor(request);
    if(mode==='intent')return NextResponse.json(await lookupPilotOrderIntent(user.id,new URL(request.url).searchParams.get('requestKey') || '',restaurantId(request)),{headers:{'Cache-Control':'no-store'}});
    return NextResponse.json({ orders: await listPilotOrders(user.id, mode === 'manager', restaurantId(request),new URL(request.url).searchParams.get('publicId') || undefined) },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const user = await userFor(request);
    const raw = await request.text();
    if (raw.length > 12000) throw new PilotError('Solicitud demasiado extensa.', 413);
    let body;
    try { body = JSON.parse(raw); } catch { throw new PilotError('Solicitud invalida.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PilotError('Solicitud invalida.');
    return NextResponse.json(await createPilotOrder(user.id, body, restaurantId(request)), { status: 201 });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    const user = await userFor(request);
    const body = await request.json();
    if (body?.action === 'report_payment') {
      if (typeof body.publicId !== 'string' || !/^(?:PRB-\d{6}|MCU-1-\d{6})$/.test(body.publicId)) throw new PilotError('Pedido inválido.');
      return NextResponse.json(await reportPilotPayment(user.id, body.publicId, body.reference, restaurantId(request)));
    }
    if (!body || typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.id) ||
      !['accepted', 'rejected', 'ready', 'out_for_delivery', 'delivered'].includes(body.action)) throw new PilotError('Accion invalida.');
    return NextResponse.json(await transitionPilotOrder(user.id, body.id, body.action, restaurantId(request)));
  } catch (error) { return failure(error); }
}
