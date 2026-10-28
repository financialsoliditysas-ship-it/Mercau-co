import {
  photoAttachments,
  photoFieldId,
  validatePhoto,
  safeAttachmentUrl,
} from "./business-photo";
import { getSupabaseAdminClient } from "./supabase-admin";
import { AccountError } from "./account-server";
export const galleryLimit = 8;
export type GalleryPhoto = {
  id: string;
  kind: "cover" | "gallery";
  url: string;
  hidden: boolean;
};
function config() {
  const key = process.env.AIRTABLE_API_KEY,
    base = process.env.AIRTABLE_BASE_ID,
    table = process.env.AIRTABLE_NEGOCIOS_TABLE_ID;
  if (!key || !base || !table) throw Error("Image storage unavailable");
  return { key, base, table };
}
export async function businessGallery(
  businessId: string,
  owner = false,
): Promise<GalleryPhoto[]> {
  const { key, base, table } = config();
  const record = await fetch(
    `https://api.airtable.com/v0/${base}/${table}/${businessId}?returnFieldsByFieldId=true`,
    { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" },
  );
  if (!record.ok) throw Error("Image record unavailable");
  const { fields } = await record.json();
  if (
    !owner &&
    !["Destacado", "Verificado", "Publicado"].includes(
      fields?.fldyyLYvoyMdiK13C,
    )
  )
    return [];
  const settings = await getSupabaseAdminClient()
    .from("business_account_settings")
    .select("data,version")
    .eq("business_id", businessId)
    .maybeSingle();
  if (settings.error) throw Error("Gallery configuration unavailable");
  const hidden = settings.data?.data?.galleryHiddenIds || [];
  const photos = photoAttachments(fields?.[photoFieldId])
    .filter(
      (item) =>
        /^mercau-(galeria|portada)-/.test(item.filename) &&
        safeAttachmentUrl(item.url),
    )
    .map((item) => ({
      id: item.id,
      kind: item.filename.startsWith("mercau-portada-")
        ? ("cover" as const)
        : ("gallery" as const),
      url: `/api/negocios/${businessId}/foto?image=${item.id}`,
      hidden: Array.isArray(hidden) && hidden.includes(item.id),
    }));
  if (owner) return photos;
  const visible = photos.filter((p) => !p.hidden),
    cover = visible.filter((p) => p.kind === "cover").at(-1);
  return [
    ...(cover ? [cover] : []),
    ...visible.filter((p) => p.kind === "gallery").slice(0, galleryLimit),
  ];
}
export async function addGalleryPhoto(
  businessId: string,
  body: Record<string, unknown>,
) {
  if (!["cover", "gallery"].includes(String(body.kind)))
    throw new AccountError("Selecciona portada o galería.");
  let upload;
  try {
    upload = validatePhoto({ ...body, kind: "photo" });
  } catch {
    throw new AccountError(
      "Selecciona una imagen JPG, PNG o WebP de hasta 2 MB.",
    );
  }
  upload.filename = upload.filename.replace(
    "mercau-foto-",
    body.kind === "cover" ? "mercau-portada-" : "mercau-galeria-",
  );
  const photos = await businessGallery(businessId, true);
  const { key, base } = config();
  const configuration = config();
  const prior = await fetch(
    `https://api.airtable.com/v0/${base}/${configuration.table}/${businessId}?returnFieldsByFieldId=true`,
    { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" },
  );
  if (!prior.ok) throw Error("Image record unavailable");
  if (
    photoAttachments((await prior.json()).fields?.[photoFieldId]).some(
      (p) => p.filename === upload.filename,
    )
  )
    return photos;
  if (
    body.kind === "gallery" &&
    photos.filter((p) => p.kind === "gallery" && !p.hidden).length >=
      galleryLimit
  )
    throw new AccountError(
      `Puedes mostrar hasta ${galleryLimit} fotos en la galería. Oculta una antes de agregar otra.`,
    );
  const response = await fetch(
    `https://content.airtable.com/v0/${base}/${businessId}/${photoFieldId}/uploadAttachment`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(upload),
    },
  );
  if (!response.ok) throw Error("Image upload failed");
  // Appending an attachment does not reorder or replace the existing primary image.
  return businessGallery(businessId, true);
}
