import { NextRequest } from "next/server";
import { GET as authorizedDetails } from "../route";
import {
  accountUser,
  accountJson,
  accountBody,
  accountFailure,
  AccountError,
} from "@/lib/account-server";
import {
  businessGallery,
  addGalleryPhoto,
  galleryLimit,
} from "@/lib/business-gallery";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
type Context = { params: { businessId: string } };
export const dynamic = "force-dynamic";
async function owner(request: NextRequest, context: Context) {
  const response = await authorizedDetails(request, context);
  if (!response.ok) {
    const body = await response.json();
    throw new AccountError(
      body.error || "No tienes permiso para estas fotos.",
      response.status,
    );
  }
  return accountUser(request);
}
export async function GET(request: NextRequest, context: Context) {
  try {
    await owner(request, context);
    return accountJson({
      photos: await businessGallery(context.params.businessId, true),
      limit: galleryLimit,
    });
  } catch (error) {
    return accountFailure(error);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await owner(request, context);
    const body = await accountBody(request, 2900000);
    const photos = await addGalleryPhoto(context.params.businessId, body);
    const audit = await getSupabaseAdminClient()
      .from("account_audit")
      .insert({
        actor_id: user.id,
        business_id: context.params.businessId,
        action: "business_photo_uploaded",
        fields: [body.kind === "cover" ? "cover" : "gallery"],
      });
    if (audit.error) console.error("[account] gallery audit unavailable");
    return accountJson({ photos, limit: galleryLimit });
  } catch (error) {
    return accountFailure(error);
  }
}
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const user = await owner(request, context),
      body = await accountBody(request),
      id = context.params.businessId;
    if (typeof body.hidden !== "boolean" || typeof body.id !== "string")
      throw new AccountError("Foto no válida.");
    const photos = await businessGallery(id, true);
    if (!photos.some((p) => p.id === body.id))
      throw new AccountError("La foto no pertenece a tu negocio.", 404);
    const db = getSupabaseAdminClient(),
      current = await db
        .from("business_account_settings")
        .select("data,version")
        .eq("business_id", id)
        .maybeSingle();
    if (current.error)
      throw new AccountError("No se pudo comprobar la galería.", 503);
    const settings = current.data?.data || {},
      previous = Array.isArray(settings.galleryHiddenIds)
        ? settings.galleryHiddenIds
        : [];
    const hidden = body.hidden
      ? Array.from(new Set([...previous, body.id]))
      : previous.filter((value: string) => value !== body.id);
    const saved = await db.rpc("account_save_business", {
      p_user: user.id,
      p_business: id,
      p_data: { ...settings, galleryHiddenIds: hidden },
      p_version: current.data?.version || 0,
      p_review: false,
    });
    if (saved.error)
      throw new AccountError(
        "La galería cambió. Actualiza antes de reintentar.",
        409,
      );
    return accountJson({
      photos: await businessGallery(id, true),
      limit: galleryLimit,
    });
  } catch (error) {
    return accountFailure(error);
  }
}
