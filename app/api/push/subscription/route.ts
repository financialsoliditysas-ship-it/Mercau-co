import { NextResponse } from "next/server";
import { getWebPushPublicKey } from "@/lib/business-push";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { pilotMember, pilotUser, PilotError } from "@/lib/restaurant-pilot";

export const dynamic = "force-dynamic";
function businessId(request: Request) { return new URL(request.url).searchParams.get("business") || ""; }
function failure(error: unknown) {
  const known = error instanceof PilotError;
  return NextResponse.json({ error: known ? error.message : "No se pudo configurar la notificación." }, { status: known ? error.status : 503 });
}
async function authorized(request: Request) {
  const user = await pilotUser(request);
  const business = businessId(request);
  if (!business || (business !== "restaurante-mercado" && !/^rec[a-zA-Z0-9]{14}$/.test(business))) throw new PilotError("Negocio inválido.");
  await pilotMember(user.id, true, business);
  return { user, business };
}
export async function GET(request: Request) {
  try {
    const { user, business } = await authorized(request);
    const key = getWebPushPublicKey();
    if (!key) return NextResponse.json({ available: false, subscribed: false });
    const result = await getSupabaseAdminClient().from("business_push_subscriptions")
      .select("id").eq("user_id", user.id).eq("business_id", business).is("disabled_at", null).limit(1);
    if (result.error) throw new PilotError("Las notificaciones todavía no están configuradas.", 503);
    return NextResponse.json({ available: true, subscribed: Boolean(result.data?.length), publicKey: key });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const { user, business } = await authorized(request);
    const body = await request.json();
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
    const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh.trim() : "";
    const auth = typeof body?.keys?.auth === "string" ? body.keys.auth.trim() : "";
    if (!endpoint.startsWith("https://") || endpoint.length > 2000 || p256dh.length < 40 || p256dh.length > 256 || auth.length < 10 || auth.length > 128) throw new PilotError("Suscripción inválida.");
    const db = getSupabaseAdminClient();
    const result = await db.from("business_push_subscriptions").upsert({
      user_id: user.id, business_id: business, endpoint, p256dh, auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) || "", disabled_at: null, last_seen_at: new Date().toISOString(),
    }, { onConflict: "user_id,business_id,endpoint" });
    if (result.error) throw new PilotError("No se pudo guardar este dispositivo.", 503);
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try {
    const { user, business } = await authorized(request);
    const body = await request.json().catch(() => ({}));
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
    let query = getSupabaseAdminClient().from("business_push_subscriptions").update({ disabled_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("business_id", business);
    if (endpoint) query = query.eq("endpoint", endpoint);
    const result = await query;
    if (result.error) throw new PilotError("No se pudo desactivar la notificación.", 503);
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
