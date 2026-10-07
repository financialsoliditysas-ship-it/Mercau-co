import { NextResponse } from "next/server";
import { applyShipdayWebhook } from "@/lib/deliveries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const token = request.headers.get("token");
    const result = await applyShipdayWebhook(payload || {}, token);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo procesar el webhook.";
    const status = message.includes("autorizado") ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
