import { NextResponse } from "next/server";
import { getDeliveryFeeCop } from "@/lib/delivery-config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    deliveryFee: getDeliveryFeeCop()
  });
}
