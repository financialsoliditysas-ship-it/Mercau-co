import {
  accountUser,
  accountBusiness,
  accountJson,
  accountFailure,
  AccountError,
} from "@/lib/account-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { deliveryLabels } from "@/lib/account-model";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: { businessId: string } },
) {
  try {
    const user = await accountUser(request);
    await accountBusiness(user.id, params.businessId);
    const days = Number(new URL(request.url).searchParams.get("days") || 30);
    if (![7, 30, 90].includes(days))
      throw new AccountError("Selecciona 7, 30 o 90 días.");
    const since = new Date(Date.now() - days * 86400000).toISOString(),
      db = getSupabaseAdminClient();
    const metrics = await db
      .from("business_daily_activity")
      .select("day,profile_views,whatsapp_clicks,call_clicks")
      .eq("business_id", params.businessId)
      .gte("day", since.slice(0, 10));
    const favorites = await db
      .from("favorites")
      .select("id", { count: "exact", head: true })
      .eq("business_id", params.businessId)
      .gte("created_at", since);
    const requests = await db
      .from("delivery_orders")
      .select(
        "public_id,created_at,status,customer_name,delivery_neighborhood,delivery_address,delivery_phone,delivery_latitude,delivery_longitude,description",
        { count: "exact" },
      )
      .eq("pickup_business_id", params.businessId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);
    if (metrics.error || favorites.error || requests.error)
      throw new AccountError(
        "No se pudo consultar la actividad del negocio.",
        503,
      );
    const summary = (metrics.data || []).reduce(
      (sum, row) => ({
        views: sum.views + row.profile_views,
        whatsapp: sum.whatsapp + row.whatsapp_clicks,
        calls: sum.calls + row.call_clicks,
      }),
      { views: 0, whatsapp: 0, calls: 0 },
    );
    return accountJson({
      days,
      measuredSince: metrics.data?.length
        ? metrics.data.map((d) => d.day).sort()[0]
        : null,
      summary,
      favorites: favorites.count,
      requestsCount: requests.count,
      requests: (requests.data || []).map((row) => {
        const contactNeeded = ["assigned", "picked_up", "in_transit"].includes(
          row.status,
        );
        return {
          public_id: row.public_id,
          created_at: row.created_at,
          statusLabel: deliveryLabels[row.status] || "Estado en revisión",
          customer: row.customer_name.split(" ")[0],
          sector: row.delivery_neighborhood,
          description: row.description,
          ...(contactNeeded
            ? {
                address: row.delivery_address,
                phone: row.delivery_phone,
                mapsUrl:
                  row.delivery_latitude !== null && row.delivery_longitude !== null
                    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${row.delivery_latitude},${row.delivery_longitude}`)}&travelmode=driving`
                    : undefined,
              }
            : {}),
        };
      }),
    });
  } catch (error) {
    return accountFailure(error);
  }
}
