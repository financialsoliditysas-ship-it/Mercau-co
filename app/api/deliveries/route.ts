import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from 'node:crypto';
import { createDeliveryOrder, lookupDeliveryIntent, DeliveryControlError } from "@/lib/deliveries";
import { accountUser, AccountError } from '@/lib/account-server';
import { loadDirectoryBusiness } from '@/lib/airtable-directory';

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let guestId: string | undefined;
  let issueGuestCookie = false;
  const respond = (body: Record<string,unknown>, status = 200) => {
    const response = NextResponse.json(body,{ status, headers:{'Cache-Control':'no-store'} });
    if(issueGuestCookie && guestId)response.cookies.set('mercau-delivery-session',guestId,
      {httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:2592000});
    return response;
  };
  try {
    const wrapped = new NextRequest(request);
    const body = await wrapped.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return respond({ok:false,error:'Solicitud inválida.'},400);
    const user = request.headers.has('authorization') ? await accountUser(request) : null;
    const businessId=typeof body.pickupBusinessId==='string' && /^rec[A-Za-z0-9]{14}$/.test(body.pickupBusinessId)?body.pickupBusinessId:undefined;
    if(body.action!=='lookup_intent' && businessId && !await loadDirectoryBusiness(businessId))return NextResponse.json({ok:false,error:'El negocio no está disponible.'},{status:400});
    const source=String(body.source||'WEB').toUpperCase();
    if(source!=='WEB' && (!process.env.DELIVERY_CHANNEL_TOKEN || request.headers.get('x-delivery-channel-token')!==process.env.DELIVERY_CHANNEL_TOKEN))return NextResponse.json({ok:false,error:'Canal no autorizado.'},{status:403});
    if(!user && source==='WEB') {
      const saved=wrapped.cookies.get('mercau-delivery-session')?.value;
      guestId=saved && /^[a-f0-9-]{36}$/i.test(saved)?saved:randomUUID(); issueGuestCookie=guestId!==saved;
    }
    const context={userId:user?.id,businessId,...(guestId?{guestId}:{})};
    if(body.action==='lookup_intent')return respond({ok:true,...await lookupDeliveryIntent(String(body.requestKey || ''),context,source)});
    const result = await createDeliveryOrder(body || {},context);

    return respond({
      ok: true,
      publicId: result.order.public_id,
      status: result.order.status,
      shipdayCreated: result.shipdayCreated,
      trackingUrl: `/envio/${result.order.public_id}`,
      message: result.shipdayCreated
        ? "Solicitud creada y enviada a despacho."
        : "Recibimos tu solicitud, pero estamos terminando de procesarla."
    });
  } catch (error) {
    const known = error instanceof AccountError || error instanceof DeliveryControlError;
    const message = known ? error.message : "No se pudo crear la solicitud. Revisa los campos obligatorios e intenta nuevamente.";
    return respond({ ok: false, error: message,
      ...(error instanceof DeliveryControlError && error.previousPublicId ? {previousPublicId:error.previousPublicId,canRepeat:error.canRepeat}: {}) }, known ? error.status : 400);
  }
}
