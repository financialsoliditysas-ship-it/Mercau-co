import { NextResponse } from "next/server";
import { applyShipdayWebhook, DeliveryControlError } from "@/lib/deliveries";
import { requireShipdayWebhookToken, WebhookAuthError } from '@/lib/shipday-webhook-auth';

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireShipdayWebhookToken(request.headers.get('token'));
    const payload = await request.json();
    const token = request.headers.get("token");
    const result = await applyShipdayWebhook(payload || {}, token);

    return NextResponse.json(result);
  } catch (error) {
    const message = 'No se pudo procesar el webhook.';
    const status = error instanceof WebhookAuthError || error instanceof DeliveryControlError ? error.status : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
