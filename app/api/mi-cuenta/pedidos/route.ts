import { NextResponse } from "next/server";
import { pilotUser, PilotError } from "@/lib/restaurant-pilot";
import { listCustomerOrders } from "@/lib/customer-orders";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const user = await pilotUser(request);
    return NextResponse.json(
      { orders: await listCustomerOrders(user.id) },
      { headers },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof PilotError
            ? error.message
            : "No se pudieron consultar tus pedidos. Intenta nuevamente.",
      },
      { status: error instanceof PilotError ? error.status : 503, headers },
    );
  }
}
