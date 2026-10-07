import { NextResponse } from "next/server";
import { createDeliveryOrder } from "@/lib/deliveries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createDeliveryOrder(body || {});

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
    const message = error instanceof Error ? error.message : "No se pudo crear la solicitud.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
