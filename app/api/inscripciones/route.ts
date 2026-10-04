import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { directoryCategories } from "@/data/directory";

const FIELD_IDS = {
  businessName: "fldZAuId3Z7tmNg1y",
  ownerName: "fldnTNuAH1PTyItul",
  whatsapp: "fldCe1uBzTZhUZQMj",
  category: "fldyp3od5rTBa74il",
  municipality: "fldAziT6B2rW6HcyT",
  neighborhood: "fldzy7nwjlebys4w0",
  description: "fldlAXHZlQY2PLtvX",
  hours: "fldGg2RLescrYR2Z6",
  deliveries: "fldmIVPP97MTqrUfZ",
  wantsMarketplace: "fldQaB5YMQonivZKG",
  instagram: "fldkT6oBXKONCkak6",
  facebook: "fldC9M9vXoMFhdqUK",
  status: "fldyyLYvoyMdiK13C",
  source: "fldOZnz4JnwxkLTYA",
  notes: "fldrZ1LUWRcvKklVQ",
  updateToken: "fldSXi5dNYP1WaWKq",
  updateLink: "fldINHrjgKw2AATkZ"
};

const OPTIONAL_CATEGORY_FIELD_IDS = {
  primaryCategory: process.env.AIRTABLE_CATEGORIA_PRINCIPAL_FIELD_ID || "",
  subcategory: process.env.AIRTABLE_SUBCATEGORIA_FIELD_ID || "",
  secondaryCategories: process.env.AIRTABLE_CATEGORIAS_SECUNDARIAS_FIELD_ID || "",
  tags: process.env.AIRTABLE_ETIQUETAS_FIELD_ID || "",
  legacyCategory: process.env.AIRTABLE_CATEGORIA_ANTERIOR_FIELD_ID || "",
  otherActivity: process.env.AIRTABLE_OTRA_ACTIVIDAD_FIELD_ID || ""
};

const allowedCategories = new Set<string>(directoryCategories.map((category) => category.name));
const allowedSubcategories = new Set(directoryCategories.flatMap((category) => category.subcategories));

const allowedMunicipalities = new Set([
  "Cáceres",
  "Nechí",
  "Caucasia",
  "Tarazá",
  "El Bagre",
  "Zaragoza"
]);

function normalizeMunicipality(value: unknown) {
  const municipality = cleanText(value, 80);
  return municipality === "Bagre" ? "El Bagre" : municipality;
}

function cleanText(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function normalizePhone(value: unknown) {
  return cleanText(value, 32).replace(/[^\d+]/g, "");
}

function cleanSocial(value: unknown) {
  return cleanText(value, 180).replace(/\s+/g, " ");
}

function setOptionalField(
  fields: Record<string, string | string[]>,
  fieldId: string,
  value: string | string[]
) {
  if (!fieldId) return;
  if (Array.isArray(value) && value.length === 0) return;
  if (!Array.isArray(value) && !value) return;
  fields[fieldId] = value;
}

function appUrl(request: NextRequest) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";

  return host ? `${proto}://${host}` : "https://mercau-co.vercel.app";
}

export async function POST(request: NextRequest) {
  const token = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_NEGOCIOS_TABLE_ID;

  if (!token || !baseId || !tableId) {
    return NextResponse.json(
      { error: "Airtable no esta configurado en este entorno." },
      { status: 503 }
    );
  }

  const body = await request.json();
  const businessName = cleanText(body.businessName, 100);
  const ownerName = cleanText(body.ownerName, 100);
  const whatsapp = normalizePhone(body.whatsapp);
  const category = allowedCategories.has(body.category) ? body.category : "";
  const subcategory = allowedSubcategories.has(body.subcategory)
    ? cleanText(body.subcategory, 100)
    : body.subcategory === "Otra actividad"
      ? "Otra actividad"
      : "";
  const secondaryCategories = Array.isArray(body.secondaryCategories)
    ? body.secondaryCategories
        .map((value: unknown) => cleanText(value, 100))
        .filter((value: string) => allowedCategories.has(value) && value !== category)
    : [];
  const tags = cleanText(body.tags, 240);
  const otherActivity = cleanText(body.otherActivity, 240);
  const requestedMunicipality = normalizeMunicipality(body.municipality);
  const municipality = allowedMunicipalities.has(requestedMunicipality)
    ? requestedMunicipality
    : "";
  const updateToken = randomBytes(18).toString("base64url");
  const updateLink = `${appUrl(request)}/actualizar/${updateToken}`;

  if (!businessName || !ownerName || !whatsapp || !category || !municipality) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios." },
      { status: 400 }
    );
  }

  const notes = [
    "Inscripcion recibida desde el MVP publico de Mercáu.",
    subcategory ? `Subcategoria: ${subcategory}.` : "",
    secondaryCategories.length ? `Categorias secundarias: ${secondaryCategories.join(", ")}.` : "",
    tags ? `Etiquetas o servicios: ${tags}.` : "",
    otherActivity ? `Otra actividad para revision: ${otherActivity}.` : ""
  ].filter(Boolean).join("\n");

  const fields: Record<string, string | string[]> = {
    [FIELD_IDS.businessName]: businessName,
    [FIELD_IDS.ownerName]: ownerName,
    [FIELD_IDS.whatsapp]: whatsapp,
    [FIELD_IDS.category]: category,
    [FIELD_IDS.municipality]: municipality,
    [FIELD_IDS.neighborhood]: cleanText(body.neighborhood, 100),
    [FIELD_IDS.description]: cleanText(body.description, 600),
    [FIELD_IDS.hours]: cleanText(body.hours, 80) || "Consultar por WhatsApp",
    [FIELD_IDS.deliveries]:
      body.deliveries === "Si" ? "Si" : body.deliveries === "No" ? "No" : "Consultar",
    [FIELD_IDS.wantsMarketplace]: body.wantsMarketplace === "Si" ? "Si" : "Despues",
    [FIELD_IDS.instagram]: cleanSocial(body.instagram),
    [FIELD_IDS.facebook]: cleanSocial(body.facebook),
    [FIELD_IDS.status]: "Pendiente",
    [FIELD_IDS.source]: "Formulario",
    [FIELD_IDS.notes]: notes,
    [FIELD_IDS.updateToken]: updateToken,
    [FIELD_IDS.updateLink]: updateLink
  };

  setOptionalField(fields, OPTIONAL_CATEGORY_FIELD_IDS.primaryCategory, category);
  setOptionalField(fields, OPTIONAL_CATEGORY_FIELD_IDS.subcategory, subcategory);
  setOptionalField(fields, OPTIONAL_CATEGORY_FIELD_IDS.secondaryCategories, secondaryCategories);
  setOptionalField(
    fields,
    OPTIONAL_CATEGORY_FIELD_IDS.tags,
    tags
      .split(",")
      .map((tag) => cleanText(tag, 60))
      .filter(Boolean)
  );
  setOptionalField(fields, OPTIONAL_CATEGORY_FIELD_IDS.legacyCategory, category);
  setOptionalField(fields, OPTIONAL_CATEGORY_FIELD_IDS.otherActivity, otherActivity);

  Object.keys(fields).forEach((key) => {
    if (!fields[key]) delete fields[key];
  });

  const response = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields, typecast: true })
  });

  const result = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      {
        error: "No se pudo crear el registro en Airtable.",
        detail: result?.error?.message || result?.error || "Error desconocido"
      },
      { status: response.status }
    );
  }

  return NextResponse.json(
    { ok: true, recordId: result.id, status: "Pendiente" },
    { status: 201 }
  );
}
