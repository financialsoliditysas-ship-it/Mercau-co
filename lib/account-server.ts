import type { User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { GET as readPrivateBusiness } from "@/app/api/actualizaciones/[token]/route";
import { getSupabaseAdminClient } from "./supabase-admin";
export class AccountError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function accountUser(request: Request): Promise<User> {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new AccountError("Entra a tu cuenta para continuar.", 401);
  const { data, error } = await getSupabaseAdminClient().auth.getUser(token);
  if (error || !data.user || !data.user.email_confirmed_at)
    throw new AccountError(
      "Tu sesión terminó o falta confirmar el correo. Entra nuevamente.",
      401,
    );
  return data.user;
}
export async function accountBusiness(userId: string, businessId: string) {
  if (!/^rec[A-Za-z0-9]{14}$/.test(businessId))
    throw new AccountError("Negocio no válido.", 400);
  const { data, error } = await getSupabaseAdminClient()
    .from("business_admins")
    .select("business_id,business_name,status,private_token")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .eq("status", "Activo")
    .maybeSingle();
  if (error) throw new AccountError("No se pudo comprobar tu permiso.", 503);
  if (!data)
    throw new AccountError(
      "No tienes permiso para administrar este negocio.",
      403,
    );
  const proof = await readPrivateBusiness(
    new NextRequest("http://mercau.internal/owner"),
    { params: { token: data.private_token } },
  );
  if (!proof.ok)
    throw new AccountError(
      "La invitación de esta ficha necesita revisión de Mercáu.",
      403,
    );
  const verified = await proof.json();
  if (verified.business?.id !== businessId)
    throw new AccountError("La vinculación no corresponde a esta ficha.", 403);
  return {
    business_id: data.business_id,
    business_name: data.business_name,
    status: data.status,
    business_status: String(verified.business.status || ""),
  };
}
export async function accountBody(request: Request, max = 24000) {
  const raw = await request.text();
  if (raw.length > max)
    throw new AccountError("La solicitud es demasiado grande.", 413);
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw Error();
    return body as Record<string, unknown>;
  } catch {
    throw new AccountError("Revisa los datos de la solicitud.");
  }
}
export function accountJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function accountFailure(error: unknown) {
  return accountJson(
    {
      error:
        error instanceof AccountError
          ? error.message
          : "No se pudo completar la operación. Tus datos no se han descartado; intenta nuevamente.",
    },
    error instanceof AccountError ? error.status : 503,
  );
}
