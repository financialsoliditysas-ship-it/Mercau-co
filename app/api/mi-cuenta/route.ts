import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  accountUser,
  accountJson,
  accountFailure,
  accountBody,
  AccountError,
} from "@/lib/account-server";
import {
  legacyAccountProfile,
  validateAccountProfile,
} from "@/lib/account-model";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await accountUser(request),
      db = getSupabaseAdminClient();
    const profile = await db
      .from("account_profiles")
      .select("data,version")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile.error)
      throw new AccountError(
        "La actualización de cuentas necesita preparación. Contacta a Mercáu.",
        503,
      );
    const accesses = await db
      .from("business_admins")
      .select("business_id,business_name,status")
      .eq("user_id", user.id);
    const roles = await db
      .from("account_roles")
      .select("role")
      .eq("user_id", user.id);
    if (accesses.error || roles.error)
      throw new AccountError(
        "No se pudo comprobar el acceso a tus perfiles.",
        503,
      );
    const owner = (accesses.data || []).some((a) => a.status === "Activo");
    return accountJson({
      profile: profile.data?.data || legacyAccountProfile(user.user_metadata),
      version: profile.data?.version || 0,
      roles: [
        "buyer",
        ...(owner ? ["business_owner"] : []),
        ...(roles.data || [])
          .filter((r) => ["admin", "courier"].includes(r.role))
          .map((r) => r.role),
      ],
      businesses: accesses.data || [],
    });
  } catch (error) {
    return accountFailure(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const user = await accountUser(request),
      body = await accountBody(request);
    let profile;
    try {
      profile = validateAccountProfile(body.profile);
    } catch (error) {
      throw new AccountError(
        error instanceof Error ? error.message : "Revisa tus datos.",
      );
    }
    if (!Number.isInteger(body.version) || Number(body.version) < 0)
      throw new AccountError("Recarga tu perfil antes de guardar.");
    const result = await getSupabaseAdminClient().rpc("account_save_profile", {
      p_user: user.id,
      p_data: profile,
      p_version: body.version,
    });
    if (result.error)
      throw new AccountError(
        String(result.error.message).includes("VERSION_CONFLICT")
          ? "Tus datos cambiaron en otra ventana. Recarga antes de guardar."
          : "No se pudieron guardar tus datos.",
        String(result.error.message).includes("VERSION_CONFLICT") ? 409 : 503,
      );
    return accountJson({ ok: true, profile, version: result.data });
  } catch (error) {
    return accountFailure(error);
  }
}
