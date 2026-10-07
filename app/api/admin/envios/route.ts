import { NextResponse } from "next/server";
import {
  cancelDeliveryOrder,
  getDeliveryHistory,
  getDeliveryOrderById,
  listDeliveryOrders,
  syncOrderToShipday
} from "@/lib/deliveries";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const password = process.env.ADMIN_METRICS_PASSWORD;
  return Boolean(password && request.headers.get("x-admin-password") === password);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const orders = await listDeliveryOrders();
    return NextResponse.json({ ok: true, orders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron cargar los envios.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = String(body?.action || "");
    const id = String(body?.id || "");
    const order = await getDeliveryOrderById(id);

    if (!order) {
      return NextResponse.json({ ok: false, error: "Orden no encontrada." }, { status: 404 });
    }

    if (action === "retry_shipday") {
      const result = await syncOrderToShipday(order);
      return NextResponse.json({ ok: true, order: result.order, shipdayCreated: result.shipdayCreated });
    }

    if (action === "history") {
      const history = await getDeliveryHistory(order.id);
      return NextResponse.json({ ok: true, order, history });
    }

    if (action === "cancel") {
      const updated = await cancelDeliveryOrder(order);
      return NextResponse.json({ ok: true, order: updated });
    }

    return NextResponse.json({ ok: false, error: "Accion no soportada." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo procesar la accion.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
