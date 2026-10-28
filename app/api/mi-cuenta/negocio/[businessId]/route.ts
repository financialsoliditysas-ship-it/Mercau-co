import {
  accountUser,
  accountBusiness,
  accountJson,
  accountFailure,
  accountBody,
  AccountError,
} from "@/lib/account-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadDirectoryBusiness } from "@/lib/airtable-directory";
import { directoryMunicipalities } from "@/data/directory";
import { accountBusinessState } from "@/lib/account-business-state";
export const dynamic = "force-dynamic";
type Context = { params: { businessId: string } };
export async function GET(request: Request, { params }: Context) {
  try {
    const user = await accountUser(request),
      access = await accountBusiness(user.id, params.businessId),
      db = getSupabaseAdminClient();
    const settings = await db
      .from("business_account_settings")
      .select("data,version,review_requested_at")
      .eq("business_id", params.businessId)
      .maybeSingle();
    if (settings.error)
      throw new AccountError(
        "No se pudo cargar la configuración del negocio.",
        503,
      );
    const business = await loadDirectoryBusiness(params.businessId);
    const status = accountBusinessState(access.business_status);
    return accountJson({
      business,
      access,
      settings: settings.data?.data || {},
      version: settings.data?.version || 0,
      reviewRequestedAt: settings.data?.review_requested_at || null,
      status,
      editable: !["Suspendida", "Archivada", "Estado en revisión"].includes(
        status,
      ),
    });
  } catch (error) {
    return accountFailure(error);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    const user = await accountUser(request);
    const access = await accountBusiness(user.id, params.businessId);
    const status = accountBusinessState(access.business_status);
    if (["Suspendida", "Archivada", "Estado en revisión"].includes(status))
      throw new AccountError(
        "Esta ficha no admite cambios en su estado actual.",
        403,
      );
    const body = await accountBody(request),
      data = body.settings as Record<string, unknown>;
    if (
      !Number.isInteger(body.version) ||
      Number(body.version) < 0 ||
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    )
      throw new AccountError("Recarga la configuración antes de guardar.");
    if (
      Object.keys(data).some(
        (k) =>
          ![
            "schedule",
            "specialHours",
            "logistics",
            "references",
            "website",
            "contactPreference",
            "phone",
            "temporaryClosed",
            "closedUntil",
            "galleryHiddenIds",
          ].includes(k),
      )
    )
      throw new AccountError("Hay opciones no permitidas.");
    const log = data.logistics as Record<string, unknown>;
    if (
      data.galleryHiddenIds !== undefined &&
      (!Array.isArray(data.galleryHiddenIds) ||
        data.galleryHiddenIds.length > 100 ||
        data.galleryHiddenIds.some(
          (id) => typeof id !== "string" || !/^att[A-Za-z0-9]+$/.test(id),
        ))
    )
      throw new AccountError("Revisa las fotos ocultas de la galería.");
    if (log) {
      if (
        !["none", "own", "mercau", "both"].includes(String(log.mode)) ||
        !Array.isArray(log.municipalities) ||
        log.municipalities.some((m) => !directoryMunicipalities.includes(m)) ||
        typeof log.available !== "boolean" ||
        ["hours", "products", "notes", "conditions"].some(
          (k) => typeof log[k] !== "string" || String(log[k]).length > 500,
        )
      )
        throw new AccountError("Revisa la configuración de entregas.");
    }
    const special = data.specialHours;
    if (
      special !== undefined &&
      (!Array.isArray(special) ||
        special.length > 10 ||
        special.some(
          (d) =>
            !d ||
            typeof d.date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(d.date) ||
            !Number.isFinite(Date.parse(d.date)),
        ) ||
        new Set(special.map((d) => d.date)).size !== special.length)
    )
      throw new AccountError("Revisa las fechas de los horarios especiales.");
    const schedule = data.schedule;
    if (
      schedule !== undefined &&
      (!Array.isArray(schedule) || schedule.length !== 7)
    )
      throw new AccountError("Revisa los siete días del horario.");
    const allDays = [
      ...(Array.isArray(schedule) ? schedule : []),
      ...(Array.isArray(special) ? special : []),
    ];
    for (const day of allDays) {
      if (
        !day ||
        typeof day.closed !== "boolean" ||
        !Array.isArray(day.periods) ||
        day.periods.length > 2
      )
        throw new AccountError("Revisa el horario por día.");
      if (!day.closed && !day.periods.length)
        throw new AccountError(
          "Agrega un horario de apertura o marca el día cerrado.",
        );
      for (const p of day.periods)
        if (
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.start) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.end) ||
          p.start >= p.end
        )
          throw new AccountError(
            "El cierre debe ser posterior a la apertura. Para horario nocturno usa tramos por día.",
          );
      if (day.periods.length === 2 && day.periods[1].start < day.periods[0].end)
        throw new AccountError("Los dos horarios del día no deben cruzarse.");
    }
    for (const key of [
      "references",
      "website",
      "contactPreference",
      "phone",
      "closedUntil",
    ])
      if (
        data[key] !== undefined &&
        (typeof data[key] !== "string" || String(data[key]).length > 500)
      )
        throw new AccountError("Revisa los datos adicionales.");
    if (data.phone && !/^\+?[\d ()-]{7,25}$/.test(String(data.phone)))
      throw new AccountError("Revisa el teléfono para llamadas.");
    if (
      data.contactPreference &&
      !["whatsapp", "phone"].includes(String(data.contactPreference))
    )
      throw new AccountError(
        "Selecciona WhatsApp o llamadas como canal preferido.",
      );
    if (
      data.closedUntil &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.closedUntil)) ||
        !Number.isFinite(Date.parse(String(data.closedUntil))))
    )
      throw new AccountError("Revisa la fecha de cierre.");
    if (
      data.temporaryClosed !== undefined &&
      typeof data.temporaryClosed !== "boolean"
    )
      throw new AccountError("Revisa el cierre temporal.");
    if (data.website) {
      let url;
      try {
        url = new URL(String(data.website));
      } catch {
        throw new AccountError("Revisa el sitio web.");
      }
      if (url.protocol !== "https:" && url.protocol !== "http:")
        throw new AccountError("Utiliza un sitio web http o https.");
    }
    const result = await getSupabaseAdminClient().rpc("account_save_business", {
      p_user: user.id,
      p_business: params.businessId,
      p_data: data,
      p_version: body.version,
      p_review: body.requestReview === true,
    });
    if (result.error)
      throw new AccountError(
        String(result.error.message).includes("VERSION_CONFLICT")
          ? "La configuración cambió. Recárgala antes de guardar."
          : "No se pudo guardar la configuración.",
        String(result.error.message).includes("VERSION_CONFLICT") ? 409 : 503,
      );
    return accountJson({ ok: true, version: result.data });
  } catch (error) {
    return accountFailure(error);
  }
}
