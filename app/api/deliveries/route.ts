import { NextResponse } from "next/server";
import { createDeliveryOrder } from "@/lib/deliveries";
import { accountUser, AccountError } from '@/lib/account-server';
import { loadDirectoryBusiness } from '@/lib/airtable-directory';

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = request.headers.has('authorization') ? await accountUser(request) : null;
    const businessId=typeof body.pickupBusinessId==='string' && /^rec[A-Za-z0-9]{14}$/.test(body.pickupBusinessId)?body.pickupBusinessId:undefined;
    if(businessId && !await loadDirectoryBusiness(businessId))return NextResponse.json({ok:false,error:'El negocio no está disponible.'},{status:400});
    const source=String(body.source||'WEB').toUpperCase();
    if(source!=='WEB' && (!process.env.DELIVERY_CHANNEL_TOKEN || request.headers.get('x-delivery-channel-token')!==process.env.DELIVERY_CHANNEL_TOKEN))return NextResponse.json({ok:false,error:'Canal no autorizado.'},{status:403});
    const result = await createDeliveryOrder(body || {},{userId:user?.id,businessId});

    return NextResponse.json({
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
    const message = error instanceof AccountError ? error.message : "No se pudo crear la solicitud. Revisa los campos obligatorios e intenta nuevamente.";
    return NextResponse.json({ ok: false, error: message }, { status: error instanceof AccountError ? error.status : 400 });
  }
}
