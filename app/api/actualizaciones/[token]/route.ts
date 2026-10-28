import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NEGOCIOS_FIELD_IDS = {
  businessName: "fldZAuId3Z7tmNg1y",
  whatsapp: "fldCe1uBzTZhUZQMj",
  category: "fldyp3od5rTBa74il",
  municipality: "fldAziT6B2rW6HcyT",
  neighborhood: "fldzy7nwjlebys4w0",
  description: "fldlAXHZlQY2PLtvX",
  hours: "fldGg2RLescrYR2Z6",
  deliveries: "fldmIVPP97MTqrUfZ",
  instagram: "fldkT6oBXKONCkak6",
  facebook: "fldC9M9vXoMFhdqUK",
  mapsUrl: "fld79aU7BULwF5b65",
  status: "fldyyLYvoyMdiK13C",
  updateToken: "fldSXi5dNYP1WaWKq"
};

const SOLICITUD_FIELD_IDS = {
  requestName: "fldw0euO9G9yzQolB",
  business: "fldRn5vmrSMFc4xAb",
  status: "fldxcaBA32ryuBUya",
  confirmationWhatsapp: "fldBNOc5AlqDz3Ca6",
  requestedChanges: "fldwaqSezmV71z0d7",
  newDescription: "fldvfa8cy8ZV4xquD",
  newWhatsapp: "fldjY6CEsYHyJnBbQ",
  newNeighborhood: "fld1jU61ntd250csD",
  newHours: "fldMsiMikQRpKW6YY",
  deliveries: "fldxITFwlegSY2hFp",
  instagram: "fldb37RSOmv5op09a",
  facebook: "fldyyeqCumnxqjG3x",
  mapsUrl: "fldDn2C4jBQQjD3yG",
  internalComment: "fld5XhR6GjiKu6fF3"
};

const ACTUALIZACIONES_TABLE_ID = "tblZFp7SvVV7MuBWD";

function cleanText(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function normalizePhone(value: unknown) {
  return cleanText(value, 32).replace(/[^\d+]/g, "");
}

function selectName(value: unknown) {
  if (typeof value === "object" && value && "name" in value) {
    return String((value as { name?: unknown }).name || "");
  }

  return String(value || "");
}

function tokenIsValid(token: string) {
  return /^[A-Za-z0-9_-]{20,80}$/.test(token);
}

function airtableConfig() {
  const token = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const negociosTableId = process.env.AIRTABLE_NEGOCIOS_TABLE_ID;
  const solicitudesTableId =
    process.env.AIRTABLE_ACTUALIZACIONES_TABLE_ID || ACTUALIZACIONES_TABLE_ID;

  if (!token || !baseId || !negociosTableId) return null;

  return { token, baseId, negociosTableId, solicitudesTableId };
}

async function findBusinessByToken(tokenValue: string) {
  const config = airtableConfig();
  if (!config) return { error: "Airtable no esta configurado en este entorno.", status: 503 };

  const params = new URLSearchParams({
    pageSize: "1",
    returnFieldsByFieldId: "true",
    filterByFormula: `{Token de actualización} = '${tokenValue.replace(/'/g, "\\'")}'`
  });

  const response = await fetch(
    `https://api.airtable.com/v0/${config.baseId}/${config.negociosTableId}?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${config.token}` },
      cache: "no-store"
    }
  );
  const result = await response.json();

  if (!response.ok) {
    return {
      error: "No se pudo consultar el negocio.",
      detail: result?.error?.message || result?.error || "Error desconocido",
      status: response.status
    };
  }

  const record = result.records?.[0];
  if (!record) return { error: "El enlace privado no existe o fue cambiado.", status: 404 };

  return { config, record };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = cleanText(params.token, 100);
  if (!tokenIsValid(token)) {
    return NextResponse.json({ error: "Enlace privado invalido." }, { status: 400 });
  }

  const lookup = await findBusinessByToken(token);
  if ("error" in lookup) {
    return NextResponse.json(
      { error: lookup.error, detail: lookup.detail },
      { status: lookup.status }
    );
  }

  const fields = lookup.record.fields || {};

  return NextResponse.json({
    business: {
      id: lookup.record.id,
      name: cleanText(fields[NEGOCIOS_FIELD_IDS.businessName], 120),
      category: selectName(fields[NEGOCIOS_FIELD_IDS.category]),
      municipality: selectName(fields[NEGOCIOS_FIELD_IDS.municipality]),
      neighborhood: cleanText(fields[NEGOCIOS_FIELD_IDS.neighborhood], 120),
      description: cleanText(fields[NEGOCIOS_FIELD_IDS.description], 700),
      hours: cleanText(fields[NEGOCIOS_FIELD_IDS.hours], 100),
      whatsapp: cleanText(fields[NEGOCIOS_FIELD_IDS.whatsapp], 40),
      deliveries: selectName(fields[NEGOCIOS_FIELD_IDS.deliveries]),
      instagram: cleanText(fields[NEGOCIOS_FIELD_IDS.instagram], 180),
      facebook: cleanText(fields[NEGOCIOS_FIELD_IDS.facebook], 180),
      mapsUrl: cleanText(fields[NEGOCIOS_FIELD_IDS.mapsUrl], 240),
      status: selectName(fields[NEGOCIOS_FIELD_IDS.status])
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = cleanText(params.token, 100);
  if (!tokenIsValid(token)) {
    return NextResponse.json({ error: "Enlace privado invalido." }, { status: 400 });
  }

  const lookup = await findBusinessByToken(token);
  if ("error" in lookup) {
    return NextResponse.json(
      { error: lookup.error, detail: lookup.detail },
      { status: lookup.status }
    );
  }

  const body = await request.json();
  const fields = lookup.record.fields || {};
  const businessName = cleanText(fields[NEGOCIOS_FIELD_IDS.businessName], 120);
  const requestedChanges = cleanText(body.requestedChanges, 1200);
  const newDescription = cleanText(body.newDescription, 700);
  const newWhatsapp = normalizePhone(body.newWhatsapp);
  const newNeighborhood = cleanText(body.newNeighborhood, 120);
  const newHours = cleanText(body.newHours, 100);
  const deliveries =
    body.deliveries === "Si" ? "Si" : body.deliveries === "No" ? "No" : "";
  const instagram = cleanText(body.instagram, 180);
  const facebook = cleanText(body.facebook, 180);
  const mapsUrl = cleanText(body.mapsUrl, 240);

  const hasChanges = [
    requestedChanges,
    newDescription,
    newWhatsapp,
    newNeighborhood,
    newHours,
    deliveries,
    instagram,
    facebook,
    mapsUrl
  ].some(Boolean);

  if (!hasChanges) {
    return NextResponse.json(
      { error: "Escribe al menos un dato para actualizar." },
      { status: 400 }
    );
  }

  const requestFields: Record<string, string | string[]> = {
    [SOLICITUD_FIELD_IDS.requestName]: `Cambio - ${businessName}`,
    [SOLICITUD_FIELD_IDS.business]: [lookup.record.id],
    [SOLICITUD_FIELD_IDS.status]: "Pendiente",
    [SOLICITUD_FIELD_IDS.confirmationWhatsapp]: normalizePhone(body.confirmationWhatsapp),
    [SOLICITUD_FIELD_IDS.requestedChanges]: requestedChanges,
    [SOLICITUD_FIELD_IDS.newDescription]: newDescription,
    [SOLICITUD_FIELD_IDS.newWhatsapp]: newWhatsapp,
    [SOLICITUD_FIELD_IDS.newNeighborhood]: newNeighborhood,
    [SOLICITUD_FIELD_IDS.newHours]: newHours,
    [SOLICITUD_FIELD_IDS.deliveries]: deliveries,
    [SOLICITUD_FIELD_IDS.instagram]: instagram,
    [SOLICITUD_FIELD_IDS.facebook]: facebook,
    [SOLICITUD_FIELD_IDS.mapsUrl]: mapsUrl,
    [SOLICITUD_FIELD_IDS.internalComment]:
      "Solicitud recibida desde link privado. Revisar antes de aplicar en la ficha publica."
  };

  Object.keys(requestFields).forEach((key) => {
    const value = requestFields[key];
    if (!value || (Array.isArray(value) && value.length === 0)) delete requestFields[key];
  });

  const response = await fetch(
    `https://api.airtable.com/v0/${lookup.config.baseId}/${lookup.config.solicitudesTableId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lookup.config.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields: requestFields, typecast: true })
    }
  );
  const result = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      {
        error: "No se pudo crear la solicitud de actualizacion.",
        detail: result?.error?.message || result?.error || "Error desconocido"
      },
      { status: response.status }
    );
  }

  return NextResponse.json({ ok: true, requestId: result.id, status: "Pendiente" }, { status: 201 });
}
