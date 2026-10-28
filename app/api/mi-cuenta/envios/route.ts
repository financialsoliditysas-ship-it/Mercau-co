import {
  accountUser,
  accountJson,
  accountFailure,
  AccountError,
} from "@/lib/account-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { deliveryLabels } from "@/lib/account-model";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await accountUser(request);
    const { data, error } = await getSupabaseAdminClient()
      .from("delivery_orders")
      .select(
        "public_id,service_type,pickup_name,pickup_neighborhood,delivery_neighborhood,delivery_fee,status,created_at",
      )
      .eq("customer_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new AccountError("No se pudieron cargar tus envíos.", 503);
    return accountJson({
      deliveries: (data || []).map((d) => ({
        ...d,
        statusLabel: deliveryLabels[d.status] || "Estado en revisión",
      })),
    });
  } catch (error) {
    return accountFailure(error);
  }
}
