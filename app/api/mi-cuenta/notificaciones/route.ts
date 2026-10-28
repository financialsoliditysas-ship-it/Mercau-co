import {
  accountUser,
  accountJson,
  accountFailure,
  accountBody,
  AccountError,
} from "@/lib/account-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await accountUser(request);
    const { data, error } = await getSupabaseAdminClient()
      .from("account_notifications")
      .select("id,title,body,href,read_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error)
      throw new AccountError(
        "No se pudieron consultar las notificaciones.",
        503,
      );
    return accountJson({
      notifications: (data || []).map((n) => ({
        ...n,
        href:
          typeof n.href === "string" &&
          /^\/(?!\/)/.test(n.href) &&
          !/[\\\u0000-\u0020]/.test(n.href)
            ? n.href
            : null,
      })),
    });
  } catch (error) {
    return accountFailure(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const user = await accountUser(request),
      body = await accountBody(request);
    if (typeof body.id !== "string" || !/^[a-f\d-]{36}$/i.test(body.id))
      throw new AccountError("Notificación no válida.");
    const { error } = await getSupabaseAdminClient()
      .from("account_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", body.id)
      .eq("user_id", user.id);
    if (error)
      throw new AccountError("No se pudo marcar la notificación.", 503);
    return accountJson({ ok: true });
  } catch (error) {
    return accountFailure(error);
  }
}
