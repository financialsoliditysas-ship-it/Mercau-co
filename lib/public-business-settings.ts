import { getSupabaseAdminClient } from "./supabase-admin";
import type { DirectoryBusiness } from "@/data/directory";
export async function publicBusinessSettings(business: DirectoryBusiness) {
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("business_account_settings")
      .select("data")
      .eq("business_id", business.id)
      .maybeSingle();
    if (error || !data) return null;
    const settings = data.data as Record<string, unknown>,
      log = settings.logistics as Record<string, unknown> | undefined;
    const covered = (process.env.DELIVERY_MUNICIPALITIES || "Nechí")
      .split(",")
      .map((m) => m.trim())
      .includes(business.municipality);
    return {
      schedule:
        Array.isArray(settings.schedule) && settings.schedule.length === 7
          ? (settings.schedule as {
              closed: boolean;
              periods: { start: string; end: string }[];
            }[])
          : null,
      temporaryClosed: settings.temporaryClosed === true,
      specialHours: Array.isArray(settings.specialHours)
        ? (settings.specialHours as {
            date: string;
            closed: boolean;
            periods: { start: string; end: string }[];
          }[])
        : [],
      closedUntil:
        typeof settings.closedUntil === "string" ? settings.closedUntil : "",
      website: typeof settings.website === "string" ? settings.website : "",
      phone: typeof settings.phone === "string" ? settings.phone : "",
      references:
        typeof settings.references === "string" ? settings.references : "",
      logistics:
        settings.temporaryClosed !== true &&
        covered &&
        log &&
        Array.isArray(log.municipalities) &&
        log.municipalities.includes(business.municipality) &&
        ["mercau", "both"].includes(String(log.mode)) &&
        log.available === true
          ? { available: true, mode: log.mode }
          : null,
    };
  } catch {
    return null;
  }
}
