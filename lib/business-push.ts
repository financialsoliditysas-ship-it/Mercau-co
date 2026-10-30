import webpush from "web-push";
import { getSupabaseAdminClient } from "./supabase-admin";

type PushPayload = { businessId: string; orderId: string; customerName: string; total: number };

export function configureWebPush() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT || "mailto:gerencia@financialsolidity.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export function getWebPushPublicKey() { return process.env.WEB_PUSH_PUBLIC_KEY || ""; }

export async function sendNewOrderPush(payload: PushPayload) {
  if (!configureWebPush()) return { sent: 0, unavailable: true };
  const db = getSupabaseAdminClient();
  const subscriptions = await db.from("business_push_subscriptions")
    .select("id,endpoint,p256dh,auth").eq("business_id", payload.businessId).is("disabled_at", null);
  if (subscriptions.error || !subscriptions.data?.length) return { sent: 0 };
  const url = payload.businessId === "restaurante-mercado"
    ? `/piloto/restaurante?pedido=${encodeURIComponent(payload.orderId)}`
    : `/mi-negocio/${encodeURIComponent(payload.businessId)}/pedidos?pedido=${encodeURIComponent(payload.orderId)}`;
  const message = JSON.stringify({
    title: "NUEVO PEDIDO EN MERCÁU",
    body: `${payload.orderId} · ${payload.customerName} · ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(payload.total)} · Toca para atenderlo`,
    icon: "/logo-mercau.png", badge: "/logo-mercau.png", tag: `mercau-order-${payload.orderId}`, url, orderId: payload.orderId,
  });
  let sent = 0;
  await Promise.all(subscriptions.data.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, message, { TTL: 300, urgency: "high" });
      sent += 1;
      await db.from("business_push_subscriptions").update({ last_seen_at: new Date().toISOString() }).eq("id", subscription.id);
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410)
        await db.from("business_push_subscriptions").update({ disabled_at: new Date().toISOString() }).eq("id", subscription.id);
    }
  }));
  return { sent };
}
